/** Pagination et découpage défensifs pour la purge du bucket `item-media`. */
export const STORAGE_LIST_PAGE_SIZE = 500;
export const STORAGE_DELETE_BATCH_SIZE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} doit être un entier strictement positif`);
  }
}

/**
 * Extrait les chemins Storage d'une page PostgREST. Une ligne malformée est une
 * panne de purge : on ne l'ignore jamais, sinon le compte pourrait être supprimé
 * alors qu'un média reste stocké.
 */
export function storageObjectNames(rows: unknown): string[] {
  if (!Array.isArray(rows)) {
    throw new TypeError('Résultat storage.objects invalide : tableau attendu');
  }

  return rows.map((row, index) => {
    if (!isRecord(row)) {
      throw new TypeError(`Ligne storage.objects ${index} invalide : objet attendu`);
    }
    const name = row['name'];
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError(`Ligne storage.objects ${index} invalide : nom non vide attendu`);
    }
    return name;
  });
}

export type StoragePageFetcher = (from: number, to: number) => Promise<unknown>;

/** Liste toutes les pages avec des bornes inclusives compatibles PostgREST. */
export async function collectStorageObjectNames(
  fetchPage: StoragePageFetcher,
  pageSize = STORAGE_LIST_PAGE_SIZE,
): Promise<string[]> {
  assertPositiveInteger(pageSize, 'La taille de page');

  const names: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = storageObjectNames(await fetchPage(from, from + pageSize - 1));
    names.push(...page);
    if (page.length < pageSize) return names;
  }
}

/** Découpe les suppressions pour éviter une requête Storage surdimensionnée. */
export function chunkStorageObjectNames(
  names: readonly string[],
  size = STORAGE_DELETE_BATCH_SIZE,
): string[][] {
  assertPositiveInteger(size, 'La taille de lot');

  const batches: string[][] = [];
  for (let index = 0; index < names.length; index += size) {
    batches.push(names.slice(index, index + size));
  }
  return batches;
}
