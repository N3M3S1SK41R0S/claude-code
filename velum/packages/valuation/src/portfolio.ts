/**
 * Valorisation de portefeuille patrimonial (§7 étendu) — Pari #2.
 *
 * Le carnet unifié (cave, table de pièces, galerie, album) devient un
 * portefeuille revalorisé en continu : agrégation multi-actifs des 4 domaines,
 * normalisation déjà en EUR (le moteur §7 sort en EUR), et historique de
 * valorisation daté → mouvement de valeur dans le temps.
 *
 * Honnêteté des intervalles : l'agrégation des IC est COMONOTONE (on somme les
 * bornes basses entre elles et les hautes entre elles). C'est la borne la plus
 * large — jamais un resserrement trompeur né d'une hypothèse d'indépendance que
 * l'on ne peut garantir (principe #1 : jamais de fausse certitude).
 *
 * Fonctions PURES, sans réseau. Les dates sont passées en paramètre (jamais
 * `Date.now()` en dur → rejouable et testable).
 */
import type { ValuationResult, VelumDomain } from '@velum/core';

export interface ItemValuation {
  itemId: string;
  domain: VelumDomain;
  /** Valorisation §7 de l'objet (déjà en EUR). */
  valuation: ValuationResult;
  /** Quantité détenue (bouteilles, exemplaires…) ; défaut 1. */
  quantity?: number;
}

export interface DomainBreakdown {
  total: number;
  nItems: number;
}

export interface PortfolioValuation {
  total: number;
  /** IC 80 % agrégé (borne comonotone — honnête). */
  ci80: [number, number];
  ci95: [number, number];
  nItems: number;
  byDomain: Partial<Record<VelumDomain, DomainBreakdown>>;
  /** Le portefeuille n'est jamais plus sûr que son actif le plus incertain. */
  minReliability: number;
  /** Moyenne pondérée par la valeur des scores de fiabilité (0..100). */
  weightedReliability: number;
}

/** Agrège les valorisations d'objets en une valorisation de portefeuille. */
export function aggregatePortfolio(items: ItemValuation[]): PortfolioValuation {
  const byDomain: Partial<Record<VelumDomain, DomainBreakdown>> = {};
  let total = 0;
  let ci80Low = 0;
  let ci80High = 0;
  let ci95Low = 0;
  let ci95High = 0;
  let minReliability = items.length > 0 ? 100 : 0;
  let reliabilityValueSum = 0;

  for (const it of items) {
    const q = it.quantity ?? 1;
    const v = it.valuation;
    total += v.central * q;
    ci80Low += v.ci80[0] * q;
    ci80High += v.ci80[1] * q;
    ci95Low += v.ci95[0] * q;
    ci95High += v.ci95[1] * q;
    minReliability = Math.min(minReliability, v.reliability);
    reliabilityValueSum += v.reliability * v.central * q;

    const d = byDomain[it.domain] ?? { total: 0, nItems: 0 };
    d.total += v.central * q;
    d.nItems += 1;
    byDomain[it.domain] = d;
  }

  return {
    total: Math.round(total),
    ci80: [Math.round(ci80Low), Math.round(ci80High)],
    ci95: [Math.round(ci95Low), Math.round(ci95High)],
    nItems: items.length,
    byDomain,
    minReliability,
    weightedReliability: total > 0 ? Math.round(reliabilityValueSum / total) : 0,
  };
}

/** Instantané daté de la valeur du portefeuille (persisté pour l'historique). */
export interface PortfolioSnapshot {
  /** Horodatage ISO (fourni par l'appelant — jamais Date.now() ici). */
  at: string;
  total: number;
  ci80: [number, number];
}

export type MovementDirection = 'up' | 'down' | 'flat';

export interface PortfolioMovement {
  absolute: number;
  /** Variation relative (−1..+∞). */
  pct: number;
  direction: MovementDirection;
  from: string;
  to: string;
}

/** Seuil relatif en-deçà duquel un mouvement est considéré « plat ». */
export const FLAT_MOVEMENT_THRESHOLD = 0.01;

/** Mouvement de valeur entre deux instantanés (récent vs antérieur). */
export function portfolioMovement(
  previous: PortfolioSnapshot,
  current: PortfolioSnapshot,
  flatThreshold = FLAT_MOVEMENT_THRESHOLD,
): PortfolioMovement {
  const absolute = Math.round(current.total - previous.total);
  const pct = previous.total > 0 ? (current.total - previous.total) / previous.total : 0;
  const direction: MovementDirection =
    Math.abs(pct) < flatThreshold ? 'flat' : pct > 0 ? 'up' : 'down';
  return {
    absolute,
    pct: Number(pct.toFixed(4)),
    direction,
    from: previous.at,
    to: current.at,
  };
}

/**
 * Construit un instantané daté à partir d'une valorisation de portefeuille.
 * @param at horodatage ISO fourni par l'appelant.
 */
export function toSnapshot(p: PortfolioValuation, at: string): PortfolioSnapshot {
  return { at, total: p.total, ci80: p.ci80 };
}
