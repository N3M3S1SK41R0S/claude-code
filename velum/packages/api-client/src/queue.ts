/**
 * File de mutations hors-ligne (§offline-first) : les écritures faites sans
 * réseau sont enfilées, persistées en JSON dans le StorageAdapter, puis
 * rejouées séquentiellement (FIFO) au retour du réseau.
 *
 * Résolution de conflit last-write-wins par horodatage : un `update` est
 * ignoré (compté `skipped`) si le serveur porte un `updated_at` strictement
 * plus récent que le `updatedAt` du payload. Quand la mutation porte la
 * version éditée (`base`), la résolution se fait PAR CHAMP : seuls les champs
 * que le serveur a modifiés depuis cette version perdent, les autres sont
 * appliqués (une écriture en ligne de l'acquisition ne fait plus perdre une
 * correction d'identité restée en file).
 *
 * Un échec réseau laisse la mutation en file (compté `failed`) et interrompt
 * le rejeu — les mutations suivantes seront retentées plus tard, dans l'ordre.
 * Un REFUS définitif du serveur (règle métier, contrainte, donnée invalide,
 * droit insuffisant) retire la mutation (comptée `rejected`, motif dans
 * `rejections`) : rejouée, elle serait refusée à l'identique et bloquerait
 * toutes les suivantes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { itemPayloadToRow } from './mappers';
import type { StorageAdapter } from './storage';

/** Clé de persistance de la file — versionnée pour les migrations futures. */
export const MUTATION_QUEUE_STORAGE_KEY = 'velum.mutation-queue.v1';

export interface QueuedMutation {
  /** Identifiant unique de la mutation (uuid côté client). */
  id: string;
  table: 'items';
  type: 'insert' | 'update' | 'delete';
  /** Payload camelCase (mappé en snake_case au rejeu via les mappers). */
  payload: Record<string, unknown>;
  /** Horodatage ISO de la mise en file. */
  queuedAt: string;
  /**
   * `update` : valeurs camelCase des champs modifiés TELLES QU'AVANT la
   * modification locale (version éditée). Permet la fusion par champ au
   * rejeu ; absent (mutations plus anciennes) → last-write-wins sur la ligne.
   */
  base?: Record<string, unknown>;
}

/** Mutation refusée définitivement par le serveur (retirée de la file). */
export interface QueuedRejection {
  mutationId: string;
  type: QueuedMutation['type'];
  /** Identifiant de la ligne visée, si connu. */
  rowId: string | null;
  /** Code SQLSTATE / PostgREST du refus (ex. 'P0001'). */
  code: string;
  /** Message du serveur (motif rédigé pour l'utilisateur quand le code est P0001). */
  message: string;
}

export interface ReplayReport {
  applied: number;
  skipped: number;
  failed: number;
  /**
   * Mutations refusées définitivement par le serveur, retirées de la file.
   * Optionnel (ajout additif d'octobre 2026) : absent = 0.
   */
  rejected?: number;
  /** Détail des refus, dans l'ordre de la file (pour en informer l'utilisateur). */
  rejections?: QueuedRejection[];
}

/** Erreur PostgREST minimale relue au rejeu. */
interface PostgrestErrorLike {
  message?: unknown;
  code?: unknown;
}

/**
 * true si le serveur a RÉPONDU et refusé l'écriture pour de bon : la rejouer
 * donnerait le même refus. Règle métier (`raise exception`, P0001), donnée
 * invalide (classe 22), contrainte (classe 23), droit insuffisant (42501).
 * Une panne de transport (aucun code), un jeton expiré (PGRST3xx), un conflit
 * ou une surcharge transitoires (classes 08, 40, 53, 57…) restent réessayables.
 */
export function isDefinitiveRefusal(error: PostgrestErrorLike | null | undefined): boolean {
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === 'P0001' || code === '42501' || /^2[23][0-9A-Z]{3}$/.test(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Égalité de valeurs JSON relues de PostgREST : objets comparés sans tenir
 * compte de l'ordre des clés (jsonb les réordonne), nombre et chaîne
 * numérique égaux (numeric peut revenir en chaîne), undefined ≡ null.
 */
export function sameJsonValue(a: unknown, b: unknown): boolean {
  const left = a === undefined ? null : a;
  const right = b === undefined ? null : b;
  if (left === right) return true;
  if (typeof left === 'number' || typeof right === 'number') {
    const l = typeof left === 'string' && left.trim() !== '' ? Number(left) : left;
    const r = typeof right === 'string' && right.trim() !== '' ? Number(right) : right;
    return typeof l === 'number' && typeof r === 'number' && Number.isFinite(l) && l === r;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameJsonValue(value, right[index]));
  }
  if (isPlainRecord(left) && isPlainRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!sameJsonValue(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

type ApplyOutcome =
  | { kind: 'applied' | 'skipped' | 'failed' }
  | { kind: 'rejected'; rejection: QueuedRejection };

const APPLIED: ApplyOutcome = { kind: 'applied' };
const SKIPPED: ApplyOutcome = { kind: 'skipped' };
const FAILED: ApplyOutcome = { kind: 'failed' };

export class MutationQueue {
  private readonly supabase: SupabaseClient;
  private readonly storage: StorageAdapter;

  constructor(supabase: SupabaseClient, storage: StorageAdapter) {
    this.supabase = supabase;
    this.storage = storage;
  }

  /** Ajoute une mutation en fin de file et persiste immédiatement. */
  async enqueue(mutation: QueuedMutation): Promise<void> {
    const queue = await this.load();
    queue.push(mutation);
    await this.save(queue);
  }

  /** Nombre de mutations en attente (relu depuis le stockage). */
  async size(): Promise<number> {
    return (await this.load()).length;
  }

  /** Vide la file (abandonne toutes les mutations en attente). */
  async clear(): Promise<void> {
    await this.storage.removeItem(MUTATION_QUEUE_STORAGE_KEY);
  }

  /**
   * Rejoue la file en séquence FIFO. Chaque mutation appliquée, ignorée ou
   * refusée définitivement est retirée et la file est re-persistée aussitôt
   * (un crash au milieu du rejeu ne rejoue jamais deux fois la même
   * mutation). Au premier échec réseau, le rejeu s'arrête : la mutation
   * fautive et les suivantes restent en file.
   */
  async replay(): Promise<ReplayReport> {
    const report: ReplayReport = { applied: 0, skipped: 0, failed: 0, rejected: 0, rejections: [] };
    let queue = await this.load();
    while (queue.length > 0) {
      const mutation = queue[0] as QueuedMutation;
      const outcome = await this.apply(mutation);
      if (outcome.kind === 'failed') {
        report.failed += 1;
        break; // probablement hors-ligne : on retentera plus tard, dans l'ordre
      }
      if (outcome.kind === 'rejected') {
        // Refus définitif : la mutation ne passera jamais, elle ne bloque pas la file.
        report.rejected = (report.rejected ?? 0) + 1;
        report.rejections = [...(report.rejections ?? []), outcome.rejection];
      } else {
        report[outcome.kind] += 1;
      }
      queue = queue.slice(1);
      await this.save(queue);
    }
    return report;
  }

  private async apply(mutation: QueuedMutation): Promise<ApplyOutcome> {
    const rowId = typeof mutation.payload['id'] === 'string' ? mutation.payload['id'] : null;
    /** Écriture refusée : refus définitif (retiré de la file) ou panne (retentée). */
    const outcomeOf = (error: PostgrestErrorLike): ApplyOutcome =>
      isDefinitiveRefusal(error)
        ? {
            kind: 'rejected',
            rejection: {
              mutationId: mutation.id,
              type: mutation.type,
              rowId,
              code: String(error.code),
              message: typeof error.message === 'string' ? error.message : '',
            },
          }
        : FAILED;
    try {
      switch (mutation.type) {
        case 'insert': {
          const { error } = await this.supabase
            .from(mutation.table)
            .insert(itemPayloadToRow(mutation.payload));
          return error ? outcomeOf(error) : APPLIED;
        }

        case 'update': {
          const id = mutation.payload['id'];
          const updatedAt = mutation.payload['updatedAt'];
          if (typeof id !== 'string' || typeof updatedAt !== 'string') {
            return SKIPPED; // mutation malformée : abandonnée (jamais rejouable)
          }
          const row = itemPayloadToRow(mutation.payload);
          delete row['id']; // la clé primaire ne se met pas à jour
          const baseRow = isPlainRecord(mutation.base) ? itemPayloadToRow(mutation.base) : null;
          // Last-write-wins : lire l'horodatage serveur (et, pour la fusion par
          // champ, les colonnes de la version éditée) avant d'écraser.
          const columns = [
            'updated_at',
            ...Object.keys(baseRow ?? {}).filter((column) => column !== 'updated_at'),
          ];
          const { data: server, error: readError } = await this.supabase
            .from(mutation.table)
            .select(columns.join(','))
            .eq('id', id)
            .maybeSingle();
          if (readError) return outcomeOf(readError);
          if (server === null) return SKIPPED; // objet supprimé côté serveur
          // Projection dynamique : supabase-js ne type pas la ligne, on la relit défensivement.
          const serverRow: Record<string, unknown> = isPlainRecord(server) ? server : {};
          const serverUpdatedAt = serverRow['updated_at'];
          if (
            typeof serverUpdatedAt === 'string' &&
            Date.parse(serverUpdatedAt) > Date.parse(updatedAt)
          ) {
            // Le serveur a changé depuis : sans version éditée, la mutation
            // locale perd en entier ; avec, seuls les champs modifiés des deux
            // côtés perdent (le serveur l'emporte), les autres s'appliquent.
            if (baseRow === null) return SKIPPED;
            for (const column of Object.keys(row)) {
              if (column === 'updated_at') continue;
              const untouched =
                Object.prototype.hasOwnProperty.call(baseRow, column) &&
                sameJsonValue(serverRow[column], baseRow[column]);
              if (!untouched) delete row[column];
            }
            if (Object.keys(row).every((column) => column === 'updated_at')) return SKIPPED;
          }
          const { error } = await this.supabase.from(mutation.table).update(row).eq('id', id);
          return error ? outcomeOf(error) : APPLIED;
        }

        case 'delete': {
          const id = mutation.payload['id'];
          if (typeof id !== 'string') return SKIPPED; // mutation malformée
          const { error } = await this.supabase.from(mutation.table).delete().eq('id', id);
          return error ? outcomeOf(error) : APPLIED;
        }
      }
    } catch {
      return FAILED; // exception transport (fetch) → échec réseau
    }
  }

  private async load(): Promise<QueuedMutation[]> {
    const raw = await this.storage.getItem(MUTATION_QUEUE_STORAGE_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
    } catch {
      return []; // contenu corrompu : on repart d'une file vide
    }
  }

  private async save(queue: QueuedMutation[]): Promise<void> {
    if (queue.length === 0) {
      await this.storage.removeItem(MUTATION_QUEUE_STORAGE_KEY);
    } else {
      await this.storage.setItem(MUTATION_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  }
}
