import {
  VelumError,
  type MediaRole,
  type VelumItem,
} from '@velum/core';
import type {
  ItemMediaRepo,
  ItemsRepo,
  NewItem,
  NewItemMedia,
} from '@velum/api-client';

export interface CapturedMediaReference {
  role: MediaRole;
  storagePath?: string;
}

export interface CapturePersistenceDeps {
  items: Pick<ItemsRepo, 'insert' | 'remove'>;
  itemMedia: Pick<ItemMediaRepo, 'addMany'>;
}

function persistentMedia(
  itemId: string,
  media: CapturedMediaReference[],
): NewItemMedia[] {
  const pathByRole = new Map<MediaRole, string>();
  for (const entry of media) {
    const path = entry.storagePath?.trim();
    if (path) pathByRole.set(entry.role, path);
  }
  return [...pathByRole].map(([kind, storagePath]) => ({
    itemId,
    kind,
    storagePath,
  }));
}

/**
 * Crée l'objet puis rattache, en une insertion atomique, tous les chemins déjà
 * téléversés. Si le rattachement échoue, l'objet incomplet est supprimé avant
 * de rendre l'erreur visible afin qu'une nouvelle tentative ne crée pas de doublon.
 */
export async function insertCapturedItem(
  input: NewItem,
  media: CapturedMediaReference[],
  deps: CapturePersistenceDeps,
): Promise<VelumItem> {
  const item = await deps.items.insert(input);
  const attachments = persistentMedia(item.id, media);
  if (attachments.length === 0) return item;

  try {
    await deps.itemMedia.addMany(attachments);
    return item;
  } catch (attachmentError) {
    try {
      await deps.items.remove(item.id);
    } catch (rollbackError) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        "L’objet a été créé sans ses médias et la suppression de sécurité a échoué.",
        {
          itemId: item.id,
          attachmentCause:
            attachmentError instanceof Error ? attachmentError.message : String(attachmentError),
          rollbackCause:
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        },
      );
    }
    throw attachmentError;
  }
}
