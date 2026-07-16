import type { ValuationRecord, VelumItem } from '@velum/core';

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

/**
 * Charge le carnet sans rendre une panne de cote indistinguable d'un objet
 * réellement non valorisé. La collection reste consultable en dégradation
 * partielle, mais chaque échec est conservé afin que l'UI marque les totaux
 * incomplets et propose une relance.
 */
export async function loadCarnetData(sources: CarnetDataSources): Promise<CarnetData> {
  const items = await sources.listItems();
  const outcomes = await Promise.all(
    items.map(async (item) => {
      try {
        return {
          itemId: item.id,
          valuation: await sources.latestValuation(item.id),
          failed: false,
        } as const;
      } catch {
        return {
          itemId: item.id,
          valuation: null,
          failed: true,
        } as const;
      }
    }),
  );

  const latestByItem: Record<string, ValuationRecord | null> = {};
  const failedValuationItemIds: string[] = [];
  for (const outcome of outcomes) {
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
