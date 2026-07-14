import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';

import {
  createItemMediaRepo,
  newItemMediaToRow,
  rowToItemMedia,
  type ItemMediaRow,
} from './item-media';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

const firstRow: ItemMediaRow = {
  id: 'media-1',
  item_id: 'item-1',
  kind: 'label',
  storage_path: 'user-1/label.jpg',
  created_at: '2026-07-14T10:00:00Z',
};

describe('mappers item_media', () => {
  it('convertit les lignes Postgres dans les deux sens utiles', () => {
    expect(rowToItemMedia(firstRow)).toEqual({
      id: 'media-1',
      itemId: 'item-1',
      kind: 'label',
      storagePath: 'user-1/label.jpg',
      createdAt: '2026-07-14T10:00:00Z',
    });
    expect(
      newItemMediaToRow({
        itemId: 'item-1',
        kind: 'capsule',
        storagePath: 'user-1/capsule.webp',
      }),
    ).toEqual({
      item_id: 'item-1',
      kind: 'capsule',
      storage_path: 'user-1/capsule.webp',
    });
  });
});

describe('item media repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['item_media'] = [
      { ...firstRow, id: 'media-2', kind: 'capsule', created_at: '2026-07-14T11:00:00Z' },
      firstRow,
      { ...firstRow, id: 'other', item_id: 'item-2' },
    ];
  });

  it('liste uniquement les médias de l’objet dans leur ordre de création', async () => {
    const media = await createItemMediaRepo(asSupabase(fake)).list('item-1');
    expect(media.map((entry) => entry.id)).toEqual(['media-1', 'media-2']);
    expect(media.map((entry) => entry.kind)).toEqual(['label', 'capsule']);
  });

  it('rattache plusieurs chemins par une insertion PostgREST unique', async () => {
    fake.tables['item_media'] = [];
    const created = await createItemMediaRepo(asSupabase(fake)).addMany([
      { itemId: 'item-1', kind: 'label', storagePath: 'user-1/label.jpg' },
      { itemId: 'item-1', kind: 'capsule', storagePath: 'user-1/capsule.jpg' },
    ]);

    expect(created).toHaveLength(2);
    expect(created.map((entry) => entry.kind)).toEqual(['label', 'capsule']);
    expect(fake.tables['item_media']?.map((row) => row['storage_path'])).toEqual([
      'user-1/label.jpg',
      'user-1/capsule.jpg',
    ]);
  });

  it('ne contacte pas PostgREST pour une liste vide', async () => {
    fake.offline = true;
    await expect(createItemMediaRepo(asSupabase(fake)).addMany([])).resolves.toEqual([]);
  });

  it('rend une panne PostgREST visible', async () => {
    fake.offline = true;
    await expect(
      createItemMediaRepo(asSupabase(fake)).addMany([
        { itemId: 'item-1', kind: 'front', storagePath: 'user-1/front.jpg' },
      ]),
    ).rejects.toSatisfy(
      (cause: unknown) => isVelumError(cause) && cause.code === 'SOURCE_UNAVAILABLE',
    );
  });
});
