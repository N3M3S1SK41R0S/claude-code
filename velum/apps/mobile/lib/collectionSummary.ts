import type { ValuationRecord, VelumItem } from '@velum/core';

export interface CollectionSummary {
  /** Null lorsqu’une panne de cote rendrait le total partiel et trompeur. */
  totalValue: number | null;
  /** Null si le total est incomplet ou si aucun prix d’acquisition comparable n’existe. */
  gainLoss: number | null;
}

/**
 * Calcule le résumé global sans présenter un sous-total comme une valeur de
 * portefeuille complète. Une seule lecture de cote en échec masque donc le
 * total et la plus/moins-value jusqu’à la prochaine relance réussie.
 *
 * La plus/moins-value porte uniquement sur les objets qui possèdent à la fois
 * une cote et un prix d’acquisition : un objet sans coût connu ne peut pas être
 * compté comme un gain égal à toute sa valeur courante.
 */
export function collectionSummary(
  items: readonly VelumItem[],
  latestByItem: Readonly<Record<string, ValuationRecord | null>>,
  failedValuationItemIds: readonly string[],
): CollectionSummary {
  if (failedValuationItemIds.length > 0) {
    return { totalValue: null, gainLoss: null };
  }

  let totalValue = 0;
  let comparableCurrentValue = 0;
  let acquiredValue = 0;
  let hasComparableAcquisition = false;

  for (const item of items) {
    const valuation = latestByItem[item.id] ?? null;
    if (valuation === null) continue;

    totalValue += valuation.central;
    if (item.acquiredPrice !== null) {
      comparableCurrentValue += valuation.central;
      acquiredValue += item.acquiredPrice;
      hasComparableAcquisition = true;
    }
  }

  return {
    totalValue,
    gainLoss: hasComparableAcquisition ? comparableCurrentValue - acquiredValue : null,
  };
}
