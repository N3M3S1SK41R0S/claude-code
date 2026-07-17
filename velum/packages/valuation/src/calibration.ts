/**
 * Calibration du moteur de valorisation (§7) — Pari #1.
 *
 * La douve : ne pas seulement afficher un intervalle de confiance, mais
 * PROUVER qu'il est calibré — c.-à-d. mesurer à quelle fréquence le prix
 * réellement réalisé tombe dans l'IC 80/95 % annoncé. Aucun concurrent ne
 * peut afficher cette métrique sans reconstruire le moteur §7 et posséder
 * un historique prédit-vs-réalisé.
 *
 * Amorçage cold-start (QW #2) : `backtest()` rejoue le moteur sur des ventes
 * PUBLIQUES déjà branchées (Heritage, Drouot, eBay sold, Delcampe, iDealwine)
 * — la calibration est mesurable dès J1, avant tout volume de transactions
 * maison. Fonctions PURES, déterministes, sans réseau.
 */
import {
  isVelumError,
  type CalibrationStatus,
  type FxRates,
  type PriceObservation,
  type SourceKind,
  type ValuationResult,
  type VelumDomain,
} from '@velum/core';
import { toEUR, valuate, type ValuateOptions } from './engine.ts';

// Compatibilité : le type reste importable depuis @velum/valuation.
export type { CalibrationStatus } from '@velum/core';

/** Une prédiction confrontée à son prix réellement réalisé (en EUR). */
export interface PriceOutcome {
  central: number;
  ci80: [number, number];
  ci95: [number, number];
  /** Prix de vente réellement observé, en EUR. */
  realized: number;
  domain?: VelumDomain;
}

export interface CalibrationResult {
  n: number;
  /** Fraction des réalisés tombant dans l'IC 80 % (cible 0,80). */
  coverage80: number;
  /** Fraction des réalisés tombant dans l'IC 95 % (cible 0,95). */
  coverage95: number;
  /** Écart signé couverture − cible (positif = IC trop larges). */
  gap80: number;
  gap95: number;
  /** Largeur relative médiane de l'IC 80 % (IC80 / central). */
  medianWidthRatio80: number;
  /** Erreur relative absolue médiane du central vs réalisé (MdAPE). */
  medianAbsPctError: number;
  status: CalibrationStatus;
}

/** Seuil d'échantillon en-deçà duquel on n'affiche qu'un badge « en cours ». */
export const MIN_CALIBRATION_SAMPLE = 30;
/** Tolérances de statut autour des cibles (honnêtement bornées). */
export const COVERAGE80_TARGET = 0.8;
export const COVERAGE95_TARGET = 0.95;
const COVERAGE80_TOL = 0.08; // 0,72..0,88 = bien calibré
const COVERAGE95_TOL = 0.04; // 0,91..0,99 = bien calibré

function within([lo, hi]: [number, number], x: number): boolean {
  return x >= lo && x <= hi;
}

function medianOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/**
 * Calcule la calibration d'un lot de prédictions confrontées au réalisé.
 * @param minSample seuil en-deçà duquel status = 'calibrating' (défaut 30).
 */
export function calibrate(
  outcomes: PriceOutcome[],
  options: { minSample?: number } = {},
): CalibrationResult {
  const minSample = options.minSample ?? MIN_CALIBRATION_SAMPLE;
  const n = outcomes.length;
  if (n === 0) {
    return {
      n: 0,
      coverage80: 0,
      coverage95: 0,
      gap80: -COVERAGE80_TARGET,
      gap95: -COVERAGE95_TARGET,
      medianWidthRatio80: 0,
      medianAbsPctError: 0,
      status: 'calibrating',
    };
  }

  let in80 = 0;
  let in95 = 0;
  const widthRatios: number[] = [];
  const absPctErrors: number[] = [];
  for (const o of outcomes) {
    if (within(o.ci80, o.realized)) in80++;
    if (within(o.ci95, o.realized)) in95++;
    if (o.central > 0) {
      widthRatios.push((o.ci80[1] - o.ci80[0]) / o.central);
      absPctErrors.push(Math.abs(o.realized - o.central) / o.central);
    }
  }

  const coverage80 = in80 / n;
  const coverage95 = in95 / n;
  const gap80 = Number((coverage80 - COVERAGE80_TARGET).toFixed(4));
  const gap95 = Number((coverage95 - COVERAGE95_TARGET).toFixed(4));

  let status: CalibrationStatus;
  if (n < minSample) {
    status = 'calibrating';
  } else if (
    coverage80 < COVERAGE80_TARGET - COVERAGE80_TOL ||
    coverage95 < COVERAGE95_TARGET - COVERAGE95_TOL
  ) {
    status = 'overconfident';
  } else if (coverage80 > COVERAGE80_TARGET + COVERAGE80_TOL) {
    status = 'underconfident';
  } else {
    status = 'well_calibrated';
  }

  return {
    n,
    coverage80: Number(coverage80.toFixed(4)),
    coverage95: Number(coverage95.toFixed(4)),
    gap80,
    gap95,
    medianWidthRatio80: Number(medianOf(widthRatios).toFixed(4)),
    medianAbsPctError: Number(medianOf(absPctErrors).toFixed(4)),
    status,
  };
}

/** Regroupe la calibration par domaine (chaque module a sa propre douve). */
export function calibrateByDomain(
  outcomes: PriceOutcome[],
  options: { minSample?: number } = {},
): Partial<Record<VelumDomain, CalibrationResult>> {
  const buckets = new Map<VelumDomain, PriceOutcome[]>();
  for (const o of outcomes) {
    if (!o.domain) continue;
    const arr = buckets.get(o.domain) ?? [];
    arr.push(o);
    buckets.set(o.domain, arr);
  }
  const out: Partial<Record<VelumDomain, CalibrationResult>> = {};
  for (const [domain, arr] of buckets) out[domain] = calibrate(arr, options);
  return out;
}

/** Un cas de backtest : observations connues + prix réalisé de référence. */
export interface BacktestCase {
  observations: PriceObservation[];
  /** Prix de vente réel (vérité-terrain), en EUR. */
  realized: number;
  domain?: VelumDomain;
  /** Ancienneté (jours) de la vente réalisée retenue comme vérité-terrain. */
  realizedAgeDays?: number;
}

/**
 * Rejoue le moteur §7 sur des ventes publiques passées et mesure la
 * calibration — permet d'afficher un score dès J1 (QW #2) sans attendre le
 * volume de transactions maison. Les cas sans observation exploitable sont
 * ignorés (jamais de zéro trompeur injecté dans la métrique).
 */
export function backtest(
  cases: BacktestCase[],
  fx: FxRates,
  options: ValuateOptions & { minSample?: number } = {},
): { calibration: CalibrationResult; outcomes: PriceOutcome[]; skipped: number } {
  const outcomes: PriceOutcome[] = [];
  let skipped = 0;
  for (const c of cases) {
    let result: ValuationResult;
    try {
      result = valuate(c.observations, fx, options);
    } catch (err) {
      if (isVelumError(err) && err.code === 'NO_OBSERVATIONS') {
        skipped++;
        continue;
      }
      throw err;
    }
    outcomes.push({
      central: result.central,
      ci80: result.ci80,
      ci95: result.ci95,
      realized: c.realized,
      ...(c.domain ? { domain: c.domain } : {}),
    });
  }
  return { calibration: calibrate(outcomes, options), outcomes, skipped };
}

/** Types de sources acceptés comme VÉRITÉ-TERRAIN d'un backtest. */
export const DEFAULT_REALIZED_KINDS: readonly SourceKind[] = [
  'auction_realized',
  'marketplace_sold',
];

/** Nombre minimal d'observations restantes pour qu'un cas soit exploitable. */
export const MIN_LOO_REMAINING = 3;

export interface LeaveOneOutOptions {
  /** Types de sources retenus comme réalisé (défaut : ventes réelles). */
  realizedKinds?: readonly SourceKind[];
  /** Observations restantes minimales par cas (défaut 3). */
  minRemaining?: number;
  domain?: VelumDomain;
}

/**
 * Construit des cas de backtest point-in-time à partir d'observations de marché :
 * chaque vente RÉELLE devient tour à tour la vérité-terrain, prédite uniquement
 * depuis les observations disponibles à cette date. Une observation dont
 * `ageDays` est inférieur à celui de la vente retenue est plus récente : elle
 * appartient au futur relatif du cas et doit être exclue.
 *
 * Un taux de change manquant lève INVALID_INPUT (une configuration cassée
 * doit remonter, jamais s'effacer — même doctrine que `backtest`).
 */
export function leaveOneOutCases(
  observations: PriceObservation[],
  fx: FxRates,
  options: LeaveOneOutOptions = {},
): BacktestCase[] {
  const realizedKinds = options.realizedKinds ?? DEFAULT_REALIZED_KINDS;
  const minRemaining = options.minRemaining ?? MIN_LOO_REMAINING;
  const cases: BacktestCase[] = [];
  for (let i = 0; i < observations.length; i++) {
    const held = observations[i] as PriceObservation;
    if (!realizedKinds.includes(held.source.kind)) continue;
    const others = observations.filter(
      (observation, index) => index !== i && observation.ageDays >= held.ageDays,
    );
    if (others.length < minRemaining) continue;
    cases.push({
      observations: others,
      realized: Math.round(toEUR(held.price, held.currency, fx)),
      realizedAgeDays: held.ageDays,
      ...(options.domain ? { domain: options.domain } : {}),
    });
  }
  return cases;
}

/**
 * Apprentissage des poids de fiabilité par source depuis le réalisé.
 * Poids ∝ 1 / (1 + erreur relative médiane de la source), borné [0,1]. Une
 * source dont les prix collent au réalisé voit son poids monter ; une source
 * bruitée le voit baisser — sans jamais toucher au cœur du moteur (§7).
 */
export function learnSourceWeights(
  samples: { source: string; predicted: number; realized: number }[],
): Record<string, number> {
  const errsBySource = new Map<string, number[]>();
  for (const s of samples) {
    if (s.predicted <= 0) continue;
    const err = Math.abs(s.realized - s.predicted) / s.predicted;
    const arr = errsBySource.get(s.source) ?? [];
    arr.push(err);
    errsBySource.set(s.source, arr);
  }
  const weights: Record<string, number> = {};
  for (const [source, errs] of errsBySource) {
    const medErr = medianOf(errs);
    weights[source] = Number(Math.min(1, Math.max(0, 1 / (1 + medErr))).toFixed(3));
  }
  return weights;
}
