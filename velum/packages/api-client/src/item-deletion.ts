import type { SupabaseClient } from '@supabase/supabase-js';
import { VelumError } from '@velum/core';

export const ITEM_MEDIA_BUCKET = 'item-media';

function unavailable(context: string, cause: { message: string }): VelumError {
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${cause.message}`);
}

/**
 * Valide et déduplique les chemins Storage conservés en base. Une ligne
 * malformée bloque toute suppression : mieux vaut laisser l’objet intact que
 * perdre la référence SQL sans savoir quel blob privé devait être purgé.
 */
export function itemMediaStoragePaths(rows: unknown): string[] {
  if (!Array.isArray(rows)) {
    throw new VelumError('SOURCE_UNAVAILABLE', 'Lecture des médias impossible : réponse invalide');
  }

  const paths: string[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object') {
      throw new VelumError('SOURCE_UNAVAILABLE', 'Lecture des médias impossible : ligne invalide');
    }
    const path = (row as { storage_path?: unknown }).storage_path;
    if (typeof path !== 'string' || path.trim().length === 0) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        'Lecture des médias impossible : chemin Storage invalide',
      );
    }
    paths.push(path.trim());
  }
  return [...new Set(paths)];
}

/**
 * Supprime un objet sans laisser ses médias privés dans Storage.
 *
 * Ordre volontaire :
 *   1. lire et valider toutes les références `item_media` ;
 *   2. supprimer les blobs du bucket privé ;
 *   3. supprimer l’item, dont les lignes filles disparaissent par cascade SQL.
 *
 * L’opération est rejouable : si un premier essai a déjà supprimé les blobs,
 * une nouvelle suppression Storage des mêmes chemins reste sans effet avant la
 * cascade SQL. En cas d’échec Storage, la ligne `items` n’est jamais touchée.
 */
export async function deleteItemWithMedia(
  supabase: SupabaseClient,
  itemId: string,
): Promise<void> {
  if (itemId.trim().length === 0) {
    throw new VelumError('INVALID_INPUT', "Identifiant d'objet invalide");
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from('item_media')
    .select('storage_path')
    .eq('item_id', itemId);
  if (mediaError) throw unavailable('Lecture des médias impossible', mediaError);

  const paths = itemMediaStoragePaths(mediaRows);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(ITEM_MEDIA_BUCKET)
      .remove(paths);
    if (storageError) throw unavailable('Suppression des médias impossible', storageError);
  }

  const { error: itemError } = await supabase.from('items').delete().eq('id', itemId);
  if (itemError) throw unavailable("Suppression de l'objet impossible", itemError);
}
