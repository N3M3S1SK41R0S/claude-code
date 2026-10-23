/**
 * Liste d'envies et d'idées par catégorie — dépôt PostgREST sur la table
 * `wishlist_entries` (RLS : owner_id = auth.uid()). Les mappers sont locaux à
 * ce module : la table n'a aucune relation avec les autres repos.
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

export function rowToWishlistEntry(row: WishlistRow): WishlistEntry {
  const target = row.target_price;
  return {
    id: row.id,
    ownerId: row.owner_id,
    domain: row.domain,
    kind: row.kind,
    title: row.title,
    notes: row.notes,
    attributes: row.attributes ?? {},
    source: row.source,
    sourceItemId: row.source_item_id,
    targetPrice: target === null ? null : typeof target === 'number' ? target : Number(target),
    priority: row.priority,
    acquired: row.acquired,
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function newWishlistEntryToRow(
  input: NewWishlistEntry,
  ownerId: string,
): Record<string, unknown> {
  return {
    owner_id: ownerId,
    domain: input.domain,
    kind: input.kind ?? 'wish',
    title: input.title,
    notes: input.notes ?? null,
    attributes: input.attributes ?? {},
    source: input.source ?? 'manual',
    source_item_id: input.sourceItemId ?? null,
    target_price: input.targetPrice ?? null,
    priority: input.priority ?? 'medium',
  };
}

export function wishlistPatchToRow(patch: WishlistPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.kind !== undefined) row['kind'] = patch.kind;
  if (patch.title !== undefined) row['title'] = patch.title;
  if (patch.notes !== undefined) row['notes'] = patch.notes;
  if (patch.attributes !== undefined) row['attributes'] = patch.attributes;
  if (patch.targetPrice !== undefined) row['target_price'] = patch.targetPrice;
  if (patch.priority !== undefined) row['priority'] = patch.priority;
  if (patch.domain !== undefined) row['domain'] = patch.domain;
  if (patch.acquired !== undefined) row['acquired'] = patch.acquired;
  return row;
}

function dbError(context: string, error: { message: string }): VelumError {
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${error.message}`);
}

export interface WishlistRepo {
  /** Entrées (non acquises d'abord, puis les plus récentes), filtrées par domaine si fourni. */
  list(domain?: VelumDomain): Promise<WishlistEntry[]>;
  add(input: NewWishlistEntry): Promise<WishlistEntry>;
  update(id: string, patch: WishlistPatch): Promise<WishlistEntry>;
  remove(id: string): Promise<void>;
}

export function createWishlistRepo(supabase: SupabaseClient): WishlistRepo {
  return {
    async list(domain) {
      let query = supabase.from('wishlist_entries').select('*');
      if (domain !== undefined) query = query.eq('domain', domain);
      const { data, error } = await query
        .order('acquired', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw dbError('Lecture de la liste d’envies impossible', error);
      return ((data ?? []) as WishlistRow[]).map(rowToWishlistEntry);
    },

    async add(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      if (!ownerId) throw new VelumError('UNAUTHORIZED', 'Session requise pour la liste d’envies');
      const { data, error } = await supabase
        .from('wishlist_entries')
        .insert(newWishlistEntryToRow(input, ownerId))
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Ajout à la liste d’envies impossible', error ?? { message: 'réponse vide' });
      }
      return rowToWishlistEntry(data as WishlistRow);
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from('wishlist_entries')
        .update(wishlistPatchToRow(patch))
        .eq('id', id)
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Mise à jour de l’envie impossible', error ?? { message: 'entrée introuvable' });
      }
      return rowToWishlistEntry(data as WishlistRow);
    },

    async remove(id) {
      const { error } = await supabase.from('wishlist_entries').delete().eq('id', id);
      if (error) throw dbError('Suppression de l’envie impossible', error);
    },
  };
}
