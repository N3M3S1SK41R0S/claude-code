/**
 * Intelligence de cave côté app — calculs LOCAUX (aucun appel réseau) à
 * partir des items vin et de leur fiche ZAPPA (attributes.analysis) :
 *  - sens 2 : vins à leur apogée → « à boire », avec plats suggérés
 *    (bandeau de la collection, écran « Mes vins à leur apogée », rappels) ;
 *  - sens 1 : plat → vins de MA cave, appariement déterministe instantané
 *    (« Suggestion rapide » du sommelier, sans IA).
 */
import type {
  CellarPeakReport,
  CellarWineEntry,
  DrinkNowSuggestion,
  LocalPairingResult,
  VelumItem,
  WineAnalysisPayload,
} from '@velum/core';
import {
  cellarAtPeak,
  drinkNowSuggestions,
  localPairing,
  type AnalyzedCellarWine,
  type CellarAtPeakOptions,
  type LocalPairingOptions,
} from '@velum/domain-wine';

import { itemAnalysis, itemDrinkWindow, itemIdentification, itemNumber, itemString } from './itemAttributes';

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

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Accords mets-vins de la fiche ZAPPA (chaînes non vides). */
function foodPairingsOf(item: VelumItem): string[] | undefined {
  const comparisons = itemAnalysis(item)?.['comparisons'];
  if (!comparisons || typeof comparisons !== 'object') return undefined;
  const raw = (comparisons as Record<string, unknown>)['foodPairings'];
  if (!Array.isArray(raw)) return undefined;
  const pairings = raw.map(nonEmpty).filter((p): p is string => p !== undefined);
  return pairings.length > 0 ? pairings : undefined;
}

/** Cépages : attribut direct (chaînes) puis fiche ZAPPA (`[{ name }]`). */
function grapesOf(item: VelumItem): string[] | undefined {
  const sources = [item.attributes['grapes'], itemIdentification(item)?.['grapes']];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const names = source
      .map((g) => nonEmpty(g && typeof g === 'object' ? (g as Record<string, unknown>)['name'] : g))
      .filter((g): g is string => g !== undefined);
    if (names.length > 0) return [...new Set(names)];
  }
  return undefined;
}

/**
 * Libellé : titre, sinon producteur / cuvée / millésime, sinon chaîne VIDE —
 * le repli « Vin sans étiquette » est traduit à l'affichage (displayWineLabel).
 */
function wineLabel(item: VelumItem): string {
  const title = nonEmpty(item.title);
  if (title) return title;
  const vintage = itemNumber(item, 'vintage');
  const composed = [itemString(item, 'producer'), itemString(item, 'cuvee'), vintage === null ? null : String(vintage)]
    .filter((part): part is string => part !== null)
    .join(' ');
  return composed;
}

/**
 * Inventaire de cave (même forme que celui transmis au sommelier IA) : les
 * attributs corrigés par l'utilisateur priment sur la fiche ZAPPA. Fenêtre,
 * quantité et cépages invalides sont omis — jamais devinés.
 */
export function toCellarWineEntries(items: readonly VelumItem[]): CellarWineEntry[] {
  const entries: CellarWineEntry[] = [];
  for (const item of items) {
    if (item.domain !== 'wine') continue;
    const vintage = itemNumber(item, 'vintage');
    const color = itemString(item, 'color');
    const region = itemString(item, 'region');
    const appellation = itemString(item, 'appellation');
    const quantity = item.attributes['quantity'];
    const window = itemDrinkWindow(item);
    const pairings = foodPairingsOf(item);
    const grapes = grapesOf(item);
    const location = nonEmpty(item.storageLocation);
    entries.push({
      itemId: item.id,
      label: wineLabel(item),
      ...(vintage !== null ? { vintage } : {}),
      ...(color ? { color } : {}),
      ...(region ? { region } : {}),
      ...(appellation ? { appellation } : {}),
      ...(grapes ? { grapes } : {}),
      ...(location ? { storageLocation: location } : {}),
      ...(typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
      ...(window && window.from <= window.to ? { drinkWindow: window } : {}),
      ...(pairings ? { foodPairings: pairings } : {}),
    });
  }
  return entries;
}

/** « Mes vins à leur apogée » pour l'année donnée (horloge injectée). */
export function cellarPeakForItems(
  items: readonly VelumItem[],
  year: number,
  options?: CellarAtPeakOptions,
): CellarPeakReport {
  return cellarAtPeak(toCellarWineEntries(items), year, options);
}

/** Plat → vins de ma cave, instantanément et hors-ligne (sans IA). */
export function localPairingForItems(
  dish: string,
  items: readonly VelumItem[],
  year: number,
  options?: LocalPairingOptions,
): LocalPairingResult {
  return localPairing(dish, toCellarWineEntries(items), year, options);
}
