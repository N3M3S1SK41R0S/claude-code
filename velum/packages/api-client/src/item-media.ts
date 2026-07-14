import type { SupabaseClient } from '@supabase/supabase-js';
import { VelumError, type ItemMedia, type MediaRole } from '@velum/core';

/** Ligne brute de la table `item_media`. */
export interface ItemMediaRow {
  id: string;
  item_id: string;
  kind: MediaRole;
  storage_path: string;
  created_at: string;
}

/** Média déjà téléversé à rattacher à un objet. */
export interface NewItemMedia {
  itemId: string;
  kind: MediaRole;
  storagePath: string;
}

export function rowToItemMedia(row: ItemMediaRow): ItemMedia {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export function newItemMediaToRow(input: NewItemMedia): Record<string, unknown> {
  return {
    item_id: input.itemId,
    kind: input.kind,
    storage_path: input.storagePath,
  };
}

function dbError(context: string, cause: { message: string }): VelumError {
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${cause.message}`);
}

export interface ItemMediaRepo {
  /** Médias d'un objet, dans leur ordre d'ajout. */
  list(itemId: string): Promise<ItemMedia[]>;
  /**
   * Rattache plusieurs objets Storage par une seule instruction Postgres :
   * toutes les lignes sont créées ou aucune ne l'est.
   */
  addMany(inputs: NewItemMedia[]): Promise<ItemMedia[]>;
}

export function createItemMediaRepo(supabase: SupabaseClient): ItemMediaRepo {
  return {
    async list(itemId) {
      const { data, error } = await supabase
        .from('item_media')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw dbError('Lecture des médias impossible', error);
      return ((data ?? []) as ItemMediaRow[]).map(rowToItemMedia);
    },

    async addMany(inputs) {
      if (inputs.length === 0) return [];
      const rows = inputs.map(newItemMediaToRow);
      const { data, error } = await supabase
        .from('item_media')
        .insert(rows)
        .select('*');
      if (error || !Array.isArray(data)) {
        throw dbError(
          'Rattachement des médias impossible',
          error ?? { message: 'réponse invalide' },
        );
      }
      return (data as ItemMediaRow[]).map(rowToItemMedia);
    },
  };
}
