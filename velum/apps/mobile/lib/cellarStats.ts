/**
 * Statistiques de cave (offre Gold+) — fonctions PURES (testées vitest,
 * environnement node). Répartition des vins par région, couleur et millésime,
 * valeur estimée par catégorie, et repérage des bouteilles « à boire bientôt »
 * (dernière année d'apogée). Aucune dépendance React Native ni réseau : lit les
 * attributs de l'item (directs ou via attributes.analysis).
 */
import type { ValuationRecord, VelumItem } from '@velum/core';

/** Une catégorie de la répartition : clé lisible, effectif et valeur estimée. */
export interface StatBucket {
  key: string;
  count: number;
  valueEUR: number;
}

/** Bouteille dont l'apogée se termine dans l'année (à prioriser). */
export interface DrinkSoonEntry {
  itemId: string;
  label: string;
  windowTo: number;
}

export interface CellarStats {
  count: number;
  valuedCount: number;
  totalEUR: number;
  byRegion: StatBucket[];
  byColor: StatBucket[];
  byVintage: StatBucket[];
  drinkSoon: DrinkSoonEntry[];
}

function analysisOf(item: VelumItem): Record<string, unknown> | null {
  const raw = item.attributes['analysis'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function identificationOf(item: VelumItem): Record<string, unknown> | null {
  const raw = analysisOf(item)?.['identification'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/** Chaîne non vide depuis attributes[key] puis analysis.identification[key]. */
function readString(item: VelumItem, key: string): string | null {
  const direct = item.attributes[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const nested = identificationOf(item)?.[key];
  if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim();
  return null;
}

/** Nombre fini depuis attributes[key] puis analysis.identification[key]. */
function readNumber(item: VelumItem, key: string): number | null {
  const direct = item.attributes[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const nested = identificationOf(item)?.[key];
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
  return null;
}

/** Fenêtre d'apogée {from,to} lue dans analysis.tasting.drinkWindow. */
function drinkWindowOf(item: VelumItem): { from: number; to: number } | null {
  const tasting = analysisOf(item)?.['tasting'];
  const window = tasting && typeof tasting === 'object'
    ? (tasting as Record<string, unknown>)['drinkWindow']
    : null;
  if (!window || typeof window !== 'object') return null;
  const from = (window as Record<string, unknown>)['from'];
  const to = (window as Record<string, unknown>)['to'];
  if (typeof from === 'number' && typeof to === 'number' && Number.isFinite(from) && Number.isFinite(to)) {
    return { from, to };
  }
  return null;
}

/** Agrège une dimension (region/color/vintage) en catégories triées. */
function bucketize(
  entries: { key: string; valueEUR: number }[],
  order: 'countDesc' | 'keyAsc',
): StatBucket[] {
  const map = new Map<string, StatBucket>();
  for (const { key, valueEUR } of entries) {
    const bucket = map.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.valueEUR += valueEUR;
    } else {
      map.set(key, { key, count: 1, valueEUR });
    }
  }
  const list = [...map.values()];
  if (order === 'keyAsc') {
    return list.sort((a, b) => a.key.localeCompare(b.key, 'fr', { numeric: true }));
  }
  return list.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'fr'));
}

/**
 * Statistiques de la cave à partir des vins et de leurs dernières
 * valorisations. `currentYear` sert au calcul des bouteilles « à boire
 * bientôt » (apogée active dont la fin est cette année ou l'an prochain).
 */
export function cellarStats(
  wines: VelumItem[],
  latestByItem: Record<string, ValuationRecord | null>,
  currentYear: number,
): CellarStats {
  const regionEntries: { key: string; valueEUR: number }[] = [];
  const colorEntries: { key: string; valueEUR: number }[] = [];
  const vintageEntries: { key: string; valueEUR: number }[] = [];
  const drinkSoon: DrinkSoonEntry[] = [];
  let totalEUR = 0;
  let valuedCount = 0;

  for (const item of wines) {
    const valueEUR = latestByItem[item.id]?.central ?? 0;
    if (latestByItem[item.id]) {
      totalEUR += valueEUR;
      valuedCount += 1;
    }
    const region = readString(item, 'region');
    if (region) regionEntries.push({ key: region, valueEUR });
    const color = readString(item, 'color');
    if (color) colorEntries.push({ key: color, valueEUR });
    const vintage = readNumber(item, 'vintage');
    if (vintage !== null) vintageEntries.push({ key: String(vintage), valueEUR });

    const window = drinkWindowOf(item);
    if (window && window.from <= currentYear && currentYear <= window.to && window.to - currentYear <= 1) {
      drinkSoon.push({ itemId: item.id, label: item.title ?? '', windowTo: window.to });
    }
  }

  return {
    count: wines.length,
    valuedCount,
    totalEUR,
    byRegion: bucketize(regionEntries, 'countDesc'),
    byColor: bucketize(colorEntries, 'countDesc'),
    byVintage: bucketize(vintageEntries, 'keyAsc'),
    drinkSoon: drinkSoon.sort((a, b) => a.windowTo - b.windowTo),
  };
}
