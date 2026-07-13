/**
 * Sens 2 de l'intelligence de cave : vins à leur apogée → « à boire »,
 * avec les plats suggérés par l'analyse ZAPPA. Calcul local (aucun appel
 * réseau) à partir des items dont attributes.analysis est renseigné.
 */
import type { DrinkNowSuggestion, VelumItem, WineAnalysisPayload } from '@velum/core';
import { drinkNowSuggestions, type AnalyzedCellarWine } from '@velum/domain-wine';

/** Mapping pur items → vins analysés (les items sans analyse sont ignorés). */
export function toAnalyzedCellarWines(items: VelumItem[]): AnalyzedCellarWine[] {
  const wines: AnalyzedCellarWine[] = [];
  for (const item of items) {
    if (item.domain !== 'wine') continue;
    const attrs = item.attributes as { analysis?: unknown; vintage?: unknown };
    const analysis = attrs.analysis;
    if (!analysis || typeof analysis !== 'object') continue;
    wines.push({
      itemId: item.id,
      label: item.title ?? 'Vin',
      vintage: typeof attrs.vintage === 'number' ? attrs.vintage : undefined,
      storageLocation: item.storageLocation ?? undefined,
      payload: analysis as WineAnalysisPayload,
    });
  }
  return wines;
}

/** Suggestions « à boire » pour l'année donnée, urgentes d'abord. */
export function drinkNowForItems(items: VelumItem[], year: number): DrinkNowSuggestion[] {
  return drinkNowSuggestions(toAnalyzedCellarWines(items), year);
}
