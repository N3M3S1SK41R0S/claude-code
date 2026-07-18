/**
 * File de mutations hors-ligne (§offline-first) : les écritures faites sans
 * réseau sont enfilées, persistées en JSON dans le StorageAdapter, puis
 * rejouées séquentiellement (FIFO) au retour du réseau.
 *
 * Résolution de conflit last-write-wins par horodatage : un `update` est
 * ignoré (compté `skipped`) si le serveur porte un `updated_at` strictement
 * plus récent que le `updatedAt` du payload. Un échec réseau laisse la
 * mutation en file (compté `failed`) et interrompt le rejeu — les mutations
 * suivantes seront retentées plus tard, dans l'ordre.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteItemWithMedia } from './item-deletion';
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
}

export interface ReplayReport {
  applied: number;
  skipped: number;
  failed: number;
}

type ApplyOutcome = 'applied' | 'skipped' | 'failed';

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
   * Rejoue la file en séquence FIFO. Chaque mutation appliquée ou ignorée est
   * retirée et la file est re-persistée aussitôt (un crash au milieu du rejeu
   * ne rejoue jamais deux fois la même mutation). Au premier échec réseau, le
   * rejeu s'arrête : la mutation fautive et les suivantes restent en file.
   */
  async replay(): Promise<ReplayReport> {
    const report: ReplayReport = { applied: 0, skipped: 0, failed: 0 };
    let queue = await this.load();
    while (queue.length > 0) {
      const mutation = queue[0] as QueuedMutation;
      const outcome = await this.apply(mutation);
      if (outcome === 'failed') {
        report.failed += 1;
        break; // probablement hors-ligne : on retentera plus tard, dans l'ordre
      }
      report[outcome] += 1;
      queue = queue.slice(1);
      await this.save(queue);
    }
    return report;
  }

  private async apply(mutation: QueuedMutation): Promise<ApplyOutcome> {
    try {
      switch (mutation.type) {
        case 'insert': {
          const { error } = await this.supabase
            .from(mutation.table)
            .insert(itemPayloadToRow(mutation.payload));
          return error ? 'failed' : 'applied';
        }

        case 'update': {
          const id = mutation.payload['id'];
          const updatedAt = mutation.payload['updatedAt'];
          if (typeof id !== 'string' || typeof updatedAt !== 'string') {
            return 'skipped'; // mutation malformée : abandonnée (jamais rejouable)
          }
          // Last-write-wins : lire l'horodatage serveur avant d'écraser.
          const { data: server, error: readError } = await this.supabase
            .from(mutation.table)
            .select('updated_at')
            .eq('id', id)
            .maybeSingle();
          if (readError) return 'failed';
          if (server === null) return 'skipped'; // objet supprimé côté serveur
          const serverUpdatedAt = (server as { updated_at?: unknown }).updated_at;
          if (
            typeof serverUpdatedAt === 'string' &&
            Date.parse(serverUpdatedAt) > Date.parse(updatedAt)
          ) {
            return 'skipped'; // le serveur est plus récent : la mutation locale perd
          }
          const row = itemPayloadToRow(mutation.payload);
          delete row['id']; // la clé primaire ne se met pas à jour
          const { error } = await this.supabase.from(mutation.table).update(row).eq('id', id);
          return error ? 'failed' : 'applied';
        }

        case 'delete': {
          const id = mutation.payload['id'];
          if (typeof id !== 'string') return 'skipped'; // mutation malformée
          // Compatibilité avec les anciennes files persistées : une suppression
          // rejouée purge elle aussi les blobs privés avant la cascade SQL.
          await deleteItemWithMedia(this.supabase, id);
          return 'applied';
        }
      }
    } catch {
      return 'failed'; // exception transport (fetch) → échec réseau
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
