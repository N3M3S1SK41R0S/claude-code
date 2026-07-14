import { describe, expect, it, vi } from 'vitest';
import { isVelumError, type VelumItem } from '@velum/core';
import type { NewItemMedia } from '@velum/api-client';

import { insertCapturedItem } from './capturePersistence';

const item: VelumItem = {
  id: 'item-1',
  ownerId: 'user-1',
  domain: 'wine',
  title: 'Château Test 2019',
  attributes: {},
  confidence: 0.8,
  acquiredAt: null,
  acquiredPrice: null,
  condition: null,
  notes: null,
  storageLocation: null,
  createdAt: '2026-07-14T12:00:00Z',
  updatedAt: '2026-07-14T12:00:00Z',
};

const input = {
  ownerId: 'user-1',
  domain: 'wine' as const,
  title: 'Château Test 2019',
};

describe('insertCapturedItem', () => {
  it('crée un objet texte sans appeler item_media', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => []);

    await expect(
      insertCapturedItem(input, [], {
        items: { insert, remove },
        itemMedia: { addMany },
      }),
    ).resolves.toBe(item);

    expect(insert).toHaveBeenCalledOnce();
    expect(addMany).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('rattache les chemins non vides et déduplique chaque rôle', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => []);

    await insertCapturedItem(
      input,
      [
        { role: 'label', storagePath: ' user-1/ancienne.jpg ' },
        { role: 'capsule' },
        { role: 'label', storagePath: 'user-1/label.jpg' },
      ],
      { items: { insert, remove }, itemMedia: { addMany } },
    );

    expect(addMany).toHaveBeenCalledWith([
      { itemId: 'item-1', kind: 'label', storagePath: 'user-1/label.jpg' },
    ]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('supprime l’objet incomplet si le rattachement échoue', async () => {
    const attachmentError = new Error('item_media indisponible');
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => {
      throw attachmentError;
    });

    await expect(
      insertCapturedItem(
        input,
        [{ role: 'label', storagePath: 'user-1/label.jpg' }],
        { items: { insert, remove }, itemMedia: { addMany } },
      ),
    ).rejects.toBe(attachmentError);

    expect(remove).toHaveBeenCalledWith('item-1');
  });

  it('rend visible un échec du rollback avec l’identifiant de l’objet', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => {
      throw new Error('suppression refusée');
    });
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => {
      throw new Error('rattachement refusé');
    });

    await expect(
      insertCapturedItem(
        input,
        [{ role: 'label', storagePath: 'user-1/label.jpg' }],
        { items: { insert, remove }, itemMedia: { addMany } },
      ),
    ).rejects.toSatisfy(
      (cause: unknown) =>
        isVelumError(cause) &&
        cause.code === 'SOURCE_UNAVAILABLE' &&
        cause.details?.['itemId'] === 'item-1',
    );
  });
});
