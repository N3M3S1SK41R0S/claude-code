import type { ValuationRecord, VelumItem } from '@velum/core';

export const MAX_CONCURRENT_VALUATION_READS = 8;

export interface CarnetData {
  items: VelumItem[];
  latestByItem: Record<string, ValuationRecord | null>;
  /** Identifiants dont la cote n'a pas pu être relue ; distincts d'une vraie absence. */
  failedValuationItemIds: string[];
}

export interface CarnetDataSources {
  listItems(): Promise<VelumItem[]>;
  latestValuation(itemId: string): Promise<ValuationRecord | null>;
}

interface ValuationOutcome {
  itemId: string;
  valuation: ValuationRecord | null;
  failed: boolean;
}

function normalizedConcurrency(requested: number | undefined, itemCount: number): number {
  if (itemCount === 0) return 0;
  if (requested === undefined) return Math.min(MAX_CONCURRENT_VALUATION_READS, itemCount);
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new RangeError('La concurrence des cotes doit être un entier strictement positif.');
  }
  return Math.min(requested, itemCount);
}

/**
 * Charge le carnet sans rendre une panne de cote indistinguable d'un objet
 * réellement non valorisé. La collection reste consultable en dégradation
 * partielle, mais chaque échec est conservé afin que l'UI marque les totaux
 * incomplets et propose une relance.
 *
 * Les lectures sont bornées : une grande collection ne doit jamais ouvrir une
 * requête PostgREST par objet en parallèle.
 */
export async function loadCarnetData(
  sources: CarnetDataSources,
  options: { concurrency?: number } = {},
): Promise<CarnetData> {
  const items = await sources.listItems();
  const outcomes: Array<ValuationOutcome | undefined> = new Array(items.length);
  const workerCount = normalizedConcurrency(options.concurrency, items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      const item = items[index];
      if (item === undefined) continue;
      try {
        outcomes[index] = {
          itemId: item.id,
          valuation: await sources.latestValuation(item.id),
          failed: false,
        };
      } catch {
        outcomes[index] = {
          itemId: item.id,
          valuation: null,
          failed: true,
        };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const latestByItem: Record<string, ValuationRecord | null> = {};
  const failedValuationItemIds: string[] = [];
  for (const outcome of outcomes) {
    if (outcome === undefined) continue;
    latestByItem[outcome.itemId] = outcome.valuation;
    if (outcome.failed) failedValuationItemIds.push(outcome.itemId);
  }

  return { items, latestByItem, failedValuationItemIds };
}

/** Nombre d'échecs de cote dans le sous-ensemble actuellement affiché. */
export function countFailedValuations(
  items: readonly VelumItem[],
  failedValuationItemIds: readonly string[],
): number {
  if (items.length === 0 || failedValuationItemIds.length === 0) return 0;
  const failed = new Set(failedValuationItemIds);
  return items.reduce((count, item) => count + (failed.has(item.id) ? 1 : 0), 0);
}
