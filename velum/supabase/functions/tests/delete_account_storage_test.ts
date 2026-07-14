import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'jsr:@std/assert@1';

import {
  chunkStorageObjectNames,
  collectStorageObjectNames,
  STORAGE_DELETE_BATCH_SIZE,
  STORAGE_LIST_PAGE_SIZE,
  storageObjectNames,
} from '../delete-account/storage.ts';

Deno.test('storageObjectNames refuse une ligne malformée au lieu de la masquer', () => {
  assertEquals(storageObjectNames([{ name: 'user/a.jpg' }, { name: 'user/b.webp' }]), [
    'user/a.jpg',
    'user/b.webp',
  ]);
  assertThrows(
    () => storageObjectNames([{ name: 'user/a.jpg' }, { name: 42 }]),
    TypeError,
    'nom non vide attendu',
  );
  assertThrows(() => storageObjectNames(null), TypeError, 'tableau attendu');
});

Deno.test('collectStorageObjectNames parcourt toutes les pages PostgREST', async () => {
  const rows = Array.from({ length: STORAGE_LIST_PAGE_SIZE * 2 + 1 }, (_, index) => ({
    name: `user/${String(index).padStart(4, '0')}.jpg`,
  }));
  const ranges: Array<[number, number]> = [];

  const names = await collectStorageObjectNames(async (from, to) => {
    ranges.push([from, to]);
    return rows.slice(from, to + 1);
  });

  assertEquals(names, rows.map((row) => row.name));
  assertEquals(ranges, [
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});

Deno.test('collectStorageObjectNames refuse une taille de page invalide', async () => {
  await assertRejects(
    () => collectStorageObjectNames(async () => [], 0),
    RangeError,
    'entier strictement positif',
  );
});

Deno.test('chunkStorageObjectNames découpe sans perdre ni dupliquer', () => {
  const names = Array.from(
    { length: STORAGE_DELETE_BATCH_SIZE * 2 + 1 },
    (_, index) => `user/${index}.jpg`,
  );
  const batches = chunkStorageObjectNames(names);

  assertEquals(batches.map((batch) => batch.length), [100, 100, 1]);
  assertEquals(batches.flat(), names);
});

Deno.test('chunkStorageObjectNames refuse une taille de lot invalide', () => {
  assertThrows(() => chunkStorageObjectNames(['a'], 0), RangeError);
  assertThrows(() => chunkStorageObjectNames(['a'], 1.5), RangeError);
});
