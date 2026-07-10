/**
 * Moteur de valorisation VELUM (§7) — commun aux 3 modules.
 *
 * Pipeline : normalisation devise → pondération récence × fiabilité source
 * → rejet d'outliers (MAD) → médiane pondérée → IC 80/95 % par bootstrap
 * → score de fiabilité.
 *
 * Améliorations vs implémentation de référence §7.3 :
 *  - RNG injectable et seedé (bootstrap déterministe → testable et rejouable) ;
 *  - garde sur l'échantillon vide (VelumError NO_OBSERVATIONS) ;
 *  - bornes sûres sur les quantiles bootstrap ;
 *  - repli médiane simple si la masse de poids est nulle.
 */
import {
  DEFAULT_SOURCE_WEIGHTS,
  VelumError,
  type FxRates,
  type PriceObservation,
  type ValuationResult,
} from '@velum/core';

export const HALF_LIFE_DAYS = 365; // récence : demi-vie 1 an (§7.3)
export const MAD_K = 3.5; // seuil de rejet des outliers (§7.2)
export const BOOTSTRAP_ITERATIONS = 1000;

export interface ValuateOptions {
  halfLifeDays?: number;
  madK?: number;
  bootstrapIterations?: number;
  /** RNG uniforme [0,1) — injectable pour des tests déterministes. */
  rng?: () => number;
}

/** PRNG mulberry32 — léger, déterministe, suffisant pour le bootstrap. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toEUR(price: number, currency: string, fx: FxRates): number {
  if (currency === 'EUR') return price;
  const rate = fx[currency];
  if (rate === undefined || rate <= 0) {
    throw new VelumError('INVALID_INPUT', `Taux de change manquant pour ${currency}`, { currency });
  }
  return price * rate;
}

export function recencyWeight(ageDays: number, halfLifeDays = HALF_LIFE_DAYS): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new VelumError('NO_OBSERVATIONS', 'Médiane d’un échantillon vide');
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function weightedMedian(pairs: { v: number; w: number }[]): number {
  if (pairs.length === 0) throw new VelumError('NO_OBSERVATIONS', 'Médiane pondérée d’un échantillon vide');
  const s = [...pairs].sort((a, b) => a.v - b.v);
  const total = s.reduce((acc, p) => acc + p.w, 0);
  if (total <= 0) return median(s.map((p) => p.v)); // masse nulle → médiane simple
  let cum = 0;
  for (const p of s) {
    cum += p.w;
    if (cum >= total / 2) return p.v;
  }
  return (s[s.length - 1] as { v: number }).v;
}

/** Poids effectif d'une observation = fiabilité source × récence. */
export function effectiveWeight(o: PriceObservation, halfLifeDays = HALF_LIFE_DAYS): number {
  const sourceWeight = o.sourceWeight ?? DEFAULT_SOURCE_WEIGHTS[o.source.kind];
  return sourceWeight * recencyWeight(o.ageDays, halfLifeDays);
}

/**
 * Rejet d'outliers par MAD : conserve les points où |x−med|/MAD ≤ k (§7.2-2).
 * MAD = 0 (majorité de prix identiques) → aucune information d'échelle :
 * on conserve tout, plutôt que de rejeter arbitrairement tout point divergent
 * comme le ferait le repli `|| 1e-9` de l'implémentation de référence.
 */
export function rejectOutliers(
  obs: PriceObservation[],
  fx: FxRates,
  k = MAD_K,
): PriceObservation[] {
  const prices = obs.map((o) => toEUR(o.price, o.currency, fx));
  const med = median(prices);
  const mad = median(prices.map((p) => Math.abs(p - med)));
  if (mad === 0) return obs;
  return obs.filter((_, i) => Math.abs((prices[i] as number) - med) / mad <= k);
}

/** Score de fiabilité 0..100 : nombre de sources + resserrement de l'IC (§7.2-5). */
export function reliabilityScore(n: number, lo: number, hi: number, central: number): number {
  const spread = central ? (hi - lo) / central : 1;
  const nScore = Math.min(1, n / 8);
  const spreadScore = Math.max(0, 1 - spread);
  return Math.round((0.5 * nScore + 0.5 * spreadScore) * 100);
}

/**
 * Point d'entrée du moteur (§7.3).
 * @throws VelumError('NO_OBSERVATIONS') si aucune observation exploitable —
 *         l'UI affiche alors « estimation indisponible », jamais un zéro trompeur.
 */
export function valuate(
  obs: PriceObservation[],
  fx: FxRates,
  options: ValuateOptions = {},
): ValuationResult {
  if (obs.length === 0) {
    throw new VelumError('NO_OBSERVATIONS', 'Aucune observation de prix disponible');
  }
  const halfLife = options.halfLifeDays ?? HALF_LIFE_DAYS;
  const k = options.madK ?? MAD_K;
  const iterations = options.bootstrapIterations ?? BOOTSTRAP_ITERATIONS;
  const rng = options.rng ?? mulberry32(0x5e1f);

  // 1) normalisation devise + rejet outliers (MAD)
  const kept = rejectOutliers(obs, fx, k);
  const pairs = kept.map((o) => ({
    v: toEUR(o.price, o.currency, fx),
    w: effectiveWeight(o, halfLife),
  }));

  // 2) médiane pondérée (source × récence)
  const central = weightedMedian(pairs);

  // 3) IC 80/95 % par bootstrap
  const boot: number[] = [];
  for (let b = 0; b < iterations; b++) {
    const sample = pairs.map(() => pairs[Math.floor(rng() * pairs.length)] as { v: number; w: number });
    boot.push(weightedMedian(sample));
  }
  boot.sort((a, b) => a - b);
  const q = (p: number): number =>
    boot[Math.min(boot.length - 1, Math.max(0, Math.floor(p * boot.length)))] as number;

  const ci80: [number, number] = [Math.round(q(0.1)), Math.round(q(0.9))];
  const ci95: [number, number] = [Math.round(q(0.025)), Math.round(q(0.975))];

  return {
    central: Math.round(central),
    ci80,
    ci95,
    nSources: kept.length,
    reliability: reliabilityScore(kept.length, q(0.1), q(0.9), central),
    currency: 'EUR',
    observations: kept,
  };
}
