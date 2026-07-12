/**
 * Détection de « trous de série » (offre Gold+) — fonctions PURES (testées
 * vitest). Regroupe les objets d'un domaine par SÉRIE (ex. un type de pièce,
 * une famille de catalogue) puis repère les numéros/années MANQUANTS entre le
 * plus petit et le plus grand présents. Utile pour compléter une collection.
 * Aucune dépendance React Native ni réseau.
 */
import type { VelumDomain, VelumItem } from '@velum/core';

/** Un trou de série : ce qui est présent, ce qui manque, la plage couverte. */
export interface SeriesGap {
  series: string;
  present: number[];
  missing: number[];
  from: number;
  to: number;
}

/** Une entrée normalisée avant agrégation : à quelle série et quel rang. */
export interface SeriesEntry {
  series: string;
  n: number;
}

/** Borne de sécurité : au-delà, la « série » est trop large pour être utile. */
const MAX_MISSING = 200;

/**
 * À partir d'entrées (série, rang entier), renvoie un trou par série ayant au
 * moins deux rangs distincts ET au moins un manquant, présents triés, plage
 * [from, to]. Les séries sont triées par nombre de manquants décroissant.
 */
export function detectSeriesGaps(entries: SeriesEntry[]): SeriesGap[] {
  const bySeries = new Map<string, Set<number>>();
  for (const { series, n } of entries) {
    if (!Number.isInteger(n)) continue;
    const set = bySeries.get(series) ?? new Set<number>();
    set.add(n);
    bySeries.set(series, set);
  }

  const gaps: SeriesGap[] = [];
  for (const [series, set] of bySeries) {
    if (set.size < 2) continue; // une seule valeur : pas de plage, pas de trou
    const present = [...set].sort((a, b) => a - b);
    const from = present[0] as number;
    const to = present[present.length - 1] as number;
    if (to - from > MAX_MISSING) continue; // plage aberrante, on n'inonde pas
    const missing: number[] = [];
    for (let n = from; n <= to; n++) {
      if (!set.has(n)) missing.push(n);
    }
    if (missing.length > 0) gaps.push({ series, present, missing, from, to });
  }
  return gaps.sort((a, b) => b.missing.length - a.missing.length || a.series.localeCompare(b.series, 'fr'));
}

function analysisId(item: VelumItem): Record<string, unknown> | null {
  const analysis = item.attributes['analysis'];
  const id = analysis && typeof analysis === 'object'
    ? (analysis as Record<string, unknown>)['identification']
    : null;
  return id && typeof id === 'object' ? (id as Record<string, unknown>) : null;
}

function attrString(item: VelumItem, key: string): string | null {
  const direct = item.attributes[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const nested = analysisId(item)?.[key];
  return typeof nested === 'string' && nested.trim().length > 0 ? nested.trim() : null;
}

function attrYear(item: VelumItem): number | null {
  const direct = item.attributes['year'];
  if (typeof direct === 'number' && Number.isFinite(direct)) return Math.trunc(direct);
  const nested = analysisId(item)?.['year'];
  return typeof nested === 'number' && Number.isFinite(nested) ? Math.trunc(nested) : null;
}

/**
 * Adapte les items d'un domaine sériel (pièces, timbres) en entrées de série :
 *  - pièces : série = type (ex. « 5 Francs Semeuse »), rang = année ;
 *  - timbres : série = pays + catalogue (ex. « France yvert_tellier »), rang = année.
 * Les autres domaines n'ont pas de notion de série (renvoie []).
 */
export function seriesGapsForItems(items: VelumItem[], domain: VelumDomain): SeriesGap[] {
  const entries: SeriesEntry[] = [];
  for (const item of items) {
    if (item.domain !== domain) continue;
    const year = attrYear(item);
    if (year === null) continue;
    let series: string | null = null;
    if (domain === 'coin') {
      series = attrString(item, 'type');
    } else if (domain === 'stamp') {
      const country = attrString(item, 'country');
      const catalog = attrString(item, 'catalog');
      series = [country, catalog].filter(Boolean).join(' ') || null;
    }
    if (series) entries.push({ series, n: year });
  }
  return detectSeriesGaps(entries);
}
