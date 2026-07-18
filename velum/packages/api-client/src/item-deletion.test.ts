import { describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';

import {
  deleteItemWithMedia,
  ITEM_MEDIA_BUCKET,
  itemMediaStoragePaths,
} from './item-deletion';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

describe('itemMediaStoragePaths', () => {
  it('normalise et déduplique les chemins', () => {
    expect(
      itemMediaStoragePaths([
        { storage_path: 'usr-1/items/a/front.jpg' },
        { storage_path: ' usr-1/items/a/front.jpg ' },
        { storage_path: 'usr-1/items/a/back.jpg' },
      ]),
    ).toEqual(['usr-1/items/a/front.jpg', 'usr-1/items/a/back.jpg']);
  });

  it('refuse toute ligne ou chemin malformé', () => {
    expect(() => itemMediaStoragePaths({})).toThrowError(/réponse invalide/i);
    expect(() => itemMediaStoragePaths([null])).toThrowError(/ligne invalide/i);
    expect(() => itemMediaStoragePaths([{ storage_path: '' }])).toThrowError(/chemin Storage invalide/i);
  });
});

describe('deleteItemWithMedia', () => {
  it('purge les blobs privés avant de supprimer la ligne items', async () => {
    const fake = new FakeSupabase();
    fake.tables['items'] = [{ id: 'i1' }];
    fake.tables['item_media'] = [
      { id: 'm1', item_id: 'i1', storage_path: 'usr-1/items/i1/front.jpg' },
      { id: 'm2', item_id: 'i1', storage_path: 'usr-1/items/i1/back.jpg' },
    ];
    fake.storageObjects[ITEM_MEDIA_BUCKET] = new Set([
      'usr-1/items/i1/front.jpg',
      'usr-1/items/i1/back.jpg',
    ]);

    await deleteItemWithMedia(asSupabase(fake), 'i1');

    expect(fake.storageRemovals).toEqual([
      {
        bucket: ITEM_MEDIA_BUCKET,
        paths: ['usr-1/items/i1/front.jpg', 'usr-1/items/i1/back.jpg'],
      },
    ]);
    expect(fake.storageObjects[ITEM_MEDIA_BUCKET]?.size).toBe(0);
    expect(fake.row('items', 'i1')).toBeUndefined();
  });

  it('laisse l’objet intact lorsque Storage refuse la purge', async () => {
    const fake = new FakeSupabase();
    fake.tables['items'] = [{ id: 'i1' }];
    fake.tables['item_media'] = [
      { id: 'm1', item_id: 'i1', storage_path: 'usr-1/items/i1/front.jpg' },
    ];
    fake.storageObjects[ITEM_MEDIA_BUCKET] = new Set(['usr-1/items/i1/front.jpg']);
    fake.storageError = { message: 'bucket indisponible' };

    await expect(deleteItemWithMedia(asSupabase(fake), 'i1')).rejects.toSatisfy(
      (error: unknown) => isVelumError(error) && error.code === 'SOURCE_UNAVAILABLE',
    );
    expect(fake.row('items', 'i1')).toBeDefined();
    expect(fake.storageObjects[ITEM_MEDIA_BUCKET]?.has('usr-1/items/i1/front.jpg')).toBe(true);
  });

  it('ne touche ni Storage ni SQL lorsqu’une référence média est corrompue', async () => {
    const fake = new FakeSupabase();
    fake.tables['items'] = [{ id: 'i1' }];
    fake.tables['item_media'] = [{ id: 'm1', item_id: 'i1', storage_path: null }];

    await expect(deleteItemWithMedia(asSupabase(fake), 'i1')).rejects.toBeDefined();
    expect(fake.storageRemovals).toEqual([]);
    expect(fake.row('items', 'i1')).toBeDefined();
  });

  it('reste idempotent pour un objet déjà absent', async () => {
    const fake = new FakeSupabase();
    fake.tables['items'] = [];
    fake.tables['item_media'] = [];

    await expect(deleteItemWithMedia(asSupabase(fake), 'absent')).resolves.toBeUndefined();
  });
});
