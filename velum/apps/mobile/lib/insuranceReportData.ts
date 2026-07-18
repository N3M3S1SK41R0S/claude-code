import { VelumError } from '@velum/core';

import type { CarnetData } from './carnetData';
import type { InsuranceEntry } from './exporters';

/**
 * Construit les lignes du rapport assurance uniquement lorsque l’état de chaque
 * cote est connu. Une vraie absence (`null`) reste exportable comme « non
 * valorisé » ; une panne ou une ligne manquante interdit le rapport afin de ne
 * jamais sous-évaluer silencieusement un patrimoine.
 */
export function insuranceReportEntries(data: CarnetData): InsuranceEntry[] {
  const failed = new Set(data.failedValuationItemIds);
  const unavailableItemIds = data.items
    .filter(
      (item) =>
        failed.has(item.id) ||
        !Object.prototype.hasOwnProperty.call(data.latestByItem, item.id),
    )
    .map((item) => item.id);

  if (unavailableItemIds.length > 0) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      'Rapport non généré : certaines cotes sont temporairement indisponibles.',
      { itemIds: unavailableItemIds },
    );
  }

  return data.items.map((item) => ({
    item,
    valuation: data.latestByItem[item.id] ?? null,
  }));
}
