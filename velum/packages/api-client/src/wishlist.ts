/**
 * Liste d'envies et d'idées par catégorie — dépôt PostgREST sur la table
 * `wishlist_entries` (migration 20261023110000_wishlist.sql ; RLS :
 * owner_id = auth.uid()). Les mappers sont locaux à ce module : la table n'a
 * aucune relation avec les autres repos.
 *
 * Les bornes de la migration (titre, notes, prix cible) sont vérifiées AVANT
 * l'appel réseau : une saisie invalide donne une erreur INVALID_INPUT claire
 * plutôt qu'un refus SQL opaque. `acquired_at` est géré par trigger serveur :
 * le client ne l'envoie jamais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VelumError,
  type NewWishlistEntry,
  type VelumDomain,
  type WishlistEntry,
  type WishlistKind,
  type WishlistPatch,
  type WishlistPriority,
  type WishlistSource,
} from '@velum/core';

/** Longueur maximale du titre (contrainte `wishlist_entries_title_check`). */
export const WISHLIST_TITLE_MAX_LENGTH = 200;
/** Longueur maximale des notes (contrainte `wishlist_entries_notes_check`). */
export const WISHLIST_NOTES_MAX_LENGTH = 2000;
/** Plafond de `numeric(14, 2)`. */
export const WISHLIST_TARGET_PRICE_MAX = 999_999_999_999.99;

/** Ligne Postgres de `wishlist_entries` (snake_case). */
export interface WishlistRow {
  id: string;
  owner_id: string;
  domain: VelumDomain;
  kind: WishlistKind;
  title: string;
  notes: string | null;
  attributes: Record<string, unknown> | null;
  source: WishlistSource;
  source_item_id: string | null;
  target_price: number | string | null;
  priority: WishlistPriority;
  acquired: boolean;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Prix relu de PostgREST (numeric → chaîne) ; valeur illisible → null, jamais NaN. */
function readPrice(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rowToWishlistEntry(row: WishlistRow): WishlistEntry {
  return {
    id: row.id,
    ownerId: row.owner_id,
    domain: row.domain,
    kind: row.kind,
    title: row.title,
    notes: row.notes,
    // JSONB défensif : seul un objet est un jeu d'attributs valide.
    attributes: isPlainRecord(row.attributes) ? row.attributes : {},
    source: row.source,
    sourceItemId: row.source_item_id,
    targetPrice: readPrice(row.target_price),
    priority: row.priority,
    acquired: row.acquired === true,
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function invalid(message: string): never {
  throw new VelumError('INVALID_INPUT', message);
}

/** Titre normalisé (espaces de bord retirés) ou INVALID_INPUT. */
function checkedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) invalid('Le titre de l’envie est obligatoire');
  if (trimmed.length > WISHLIST_TITLE_MAX_LENGTH) {
    invalid(`Titre trop long (${WISHLIST_TITLE_MAX_LENGTH} caractères maximum)`);
  }
  return trimmed;
}

/** Notes normalisées : vides → null. */
function checkedNotes(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? '').trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WISHLIST_NOTES_MAX_LENGTH) {
    invalid(`Notes trop longues (${WISHLIST_NOTES_MAX_LENGTH} caractères maximum)`);
  }
  return trimmed;
}

/** Prix cible : null, ou montant fini ≥ 0 arrondi au centime. */
function checkedTargetPrice(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  if (!Number.isFinite(price) || price < 0 || price > WISHLIST_TARGET_PRICE_MAX) {
    invalid('Prix cible invalide : montant positif attendu');
  }
  return Math.round(price * 100) / 100;
}

function checkedAttributes(attributes: Record<string, unknown> | undefined): Record<string, unknown> {
  if (attributes === undefined) return {};
  if (!isPlainRecord(attributes)) invalid('Attributs d’identification invalides');
  return attributes;
}

export function newWishlistEntryToRow(
  input: NewWishlistEntry,
  ownerId: string,
): Record<string, unknown> {
  return {
    owner_id: ownerId,
    domain: input.domain,
    kind: input.kind ?? 'wish',
    title: checkedTitle(input.title),
    notes: checkedNotes(input.notes),
    attributes: checkedAttributes(input.attributes),
    source: input.source ?? 'manual',
    source_item_id: input.sourceItemId ?? null,
    target_price: checkedTargetPrice(input.targetPrice),
    priority: input.priority ?? 'medium',
  };
}

export function wishlistPatchToRow(patch: WishlistPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.kind !== undefined) row['kind'] = patch.kind;
  if (patch.title !== undefined) row['title'] = checkedTitle(patch.title);
  if (patch.notes !== undefined) row['notes'] = checkedNotes(patch.notes);
  if (patch.attributes !== undefined) row['attributes'] = checkedAttributes(patch.attributes);
  if (patch.targetPrice !== undefined) row['target_price'] = checkedTargetPrice(patch.targetPrice);
  if (patch.priority !== undefined) row['priority'] = patch.priority;
  if (patch.domain !== undefined) row['domain'] = patch.domain;
  if (patch.acquired !== undefined) row['acquired'] = patch.acquired;
  return row;
}

/** Erreur PostgREST minimale (le code SQLSTATE est présent sur un vrai serveur). */
export interface WishlistDbErrorLike {
  message: string;
  code?: string;
}

/** SQLSTATE d'une saisie refusée par une contrainte (CHECK, NOT NULL, type, longueur). */
const INVALID_INPUT_CODES: ReadonlySet<string> = new Set(['23514', '23502', '22P02', '22001', '22003']);

/**
 * Convertit une erreur PostgREST en VelumError : contrainte → INVALID_INPUT,
 * RLS → UNAUTHORIZED, ligne absente (PGRST116) → INVALID_INPUT, le reste
 * (réseau, serveur) → SOURCE_UNAVAILABLE réessayable.
 */
export function wishlistDbError(context: string, error: WishlistDbErrorLike): VelumError {
  const code = error.code ?? '';
  if (INVALID_INPUT_CODES.has(code) || code === '23503') {
    return new VelumError('INVALID_INPUT', `${context} : ${error.message}`);
  }
  if (code === '42501') {
    return new VelumError('UNAUTHORIZED', `${context} : accès refusé`);
  }
  if (code === 'PGRST116') {
    return new VelumError('INVALID_INPUT', `${context} : envie introuvable`);
  }
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${error.message}`);
}

/**
 * Ordre canonique de `list()` : envies en cours d'abord, puis obtenues ; les
 * plus récentes en tête (création, à défaut identifiant pour la stabilité).
 */
export function compareWishlistEntries(a: WishlistEntry, b: WishlistEntry): number {
  if (a.acquired !== b.acquired) return a.acquired ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface WishlistRepo {
  /** Entrées (non acquises d'abord, puis les plus récentes), filtrées par domaine si fourni. */
  list(domain?: VelumDomain): Promise<WishlistEntry[]>;
  add(input: NewWishlistEntry): Promise<WishlistEntry>;
  update(id: string, patch: WishlistPatch): Promise<WishlistEntry>;
  remove(id: string): Promise<void>;
}

export function createWishlistRepo(supabase: SupabaseClient): WishlistRepo {
  const fetchOne = async (id: string): Promise<WishlistEntry> => {
    const { data, error } = await supabase.from('wishlist_entries').select('*').eq('id', id).single();
    if (error || data === null) {
      throw wishlistDbError('Lecture de l’envie impossible', error ?? { message: 'entrée introuvable', code: 'PGRST116' });
    }
    return rowToWishlistEntry(data as WishlistRow);
  };

  return {
    async list(domain) {
      let query = supabase.from('wishlist_entries').select('*');
      if (domain !== undefined) query = query.eq('domain', domain);
      const { data, error } = await query
        .order('acquired', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw wishlistDbError('Lecture de la liste d’envies impossible', error);
      // Tri garanti côté client aussi : le contrat ne dépend pas du serveur.
      return ((data ?? []) as WishlistRow[]).map(rowToWishlistEntry).sort(compareWishlistEntries);
    },

    async add(input) {
      // Validation locale d'abord : aucune requête pour une saisie invalide.
      const draft = newWishlistEntryToRow(input, '');
      const { data: sessionData } = await supabase.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      if (!ownerId) throw new VelumError('UNAUTHORIZED', 'Session requise pour la liste d’envies');
      const { data, error } = await supabase
        .from('wishlist_entries')
        .insert({ ...draft, owner_id: ownerId })
        .select('*')
        .single();
      if (error || data === null) {
        throw wishlistDbError('Ajout à la liste d’envies impossible', error ?? { message: 'réponse vide' });
      }
      return rowToWishlistEntry(data as WishlistRow);
    },

    async update(id, patch) {
      const row = wishlistPatchToRow(patch);
      // Rien à modifier : on relit l'entrée plutôt qu'envoyer un UPDATE vide.
      if (Object.keys(row).length === 0) return fetchOne(id);
      const { data, error } = await supabase
        .from('wishlist_entries')
        .update(row)
        .eq('id', id)
        .select('*')
        .single();
      if (error || data === null) {
        throw wishlistDbError(
          'Mise à jour de l’envie impossible',
          error ?? { message: 'entrée introuvable', code: 'PGRST116' },
        );
      }
      return rowToWishlistEntry(data as WishlistRow);
    },

    async remove(id) {
      const { error } = await supabase.from('wishlist_entries').delete().eq('id', id);
      if (error) throw wishlistDbError('Suppression de l’envie impossible', error);
    },
  };
}
