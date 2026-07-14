/**
 * Explicabilité de la valorisation (§7 — « Pourquoi cette fourchette ? »).
 *
 * Pari #1 de la note de différenciation : rendre la rigueur du moteur §7
 * VISIBLE et défendable. Pour une estimation donnée, on expose ce que le
 * moteur a réellement fait — sources retenues vs écartées (avec la raison),
 * poids fiabilité × récence de chaque observation, dispersion, et la
 * décomposition du score de fiabilité.
 *
 * Fonction PURE, sans réseau : l'UI peut afficher `notes` telles quelles.
 * Aucune fausse certitude — on décrit l'incertitude, on ne la masque pas.
 */
import { DEFAULT_SOURCE_WEIGHTS, type FxRates, type PriceObservation } from '@velum/core';
import {
  HALF_LIFE_DAYS,
  MAD_K,
  median,
  recencyWeight,
  reliabilityScore,
  toEUR,
  valuate,
  type ValuateOptions,
} from './engine';

/** Décomposition d'une observation dans la décision du moteur. */
export interface ObservationBreakdown {
  observation: PriceObservation;
  /** Prix normalisé en EUR. */
  priceEUR: number;
  /** Fiabilité de la source (0..1). */
  sourceWeight: number;
  /** Poids de récence (demi-vie 365 j). */
  recencyWeight: number;
  /** Poids effectif = fiabilité × récence — ce qui pèse dans la médiane. */
  effectiveWeight: number;
  /** Conservée par le moteur, ou écartée comme aberrante ? */
  kept: boolean;
  /** Écart à la médiane en unités de MAD (|x − méd| / MAD), si calculable. */
  madDeviation?: number;
  /** Raison de l'exclusion (quand kept = false). */
  rejectionReason?: 'outlier_mad';
}

export interface ValuationExplanation {
  central: number;
  ci80: [number, number];
  ci95: [number, number];
  reliability: number;
  /** Largeur de l'IC 80 % relative à la valeur centrale (dispersion, 0..1+). */
  ci80WidthRatio: number;
  nKept: number;
  nRejected: number;
  breakdown: ObservationBreakdown[];
  /** Décomposition du score de fiabilité (chaque terme 0..1). */
  reliabilityFactors: { countScore: number; tightnessScore: number };
  /** Lignes explicatives prêtes à afficher (français). */
  notes: string[];
}

const SOURCE_KIND_LABEL: Record<string, string> = {
  auction_realized: 'ventes réalisées',
  official_quote: 'cotes officielles',
  marketplace_sold: 'ventes marketplace',
  listing: 'annonces en cours',
};

/**
 * Produit l'explication d'une valorisation à partir des mêmes observations
 * que `valuate()`. Réutilise le moteur §7 pour la valeur/les IC afin que
 * l'explication et l'estimation ne puissent jamais diverger.
 */
export function explainValuation(
  obs: PriceObservation[],
  fx: FxRates,
  options: ValuateOptions = {},
): ValuationExplanation {
  const result = valuate(obs, fx, options);
  const halfLife = options.halfLifeDays ?? HALF_LIFE_DAYS;
  const k = options.madK ?? MAD_K;

  const prices = obs.map((o) => toEUR(o.price, o.currency, fx));
  const med = median(prices);
  const mad = median(prices.map((p) => Math.abs(p - med)));

  // L'ensemble conservé par le moteur (mêmes ids d'observation).
  const keptSet = new Set(result.observations);

  const breakdown: ObservationBreakdown[] = obs.map((o, i) => {
    const priceEUR = prices[i] as number;
    const sw = o.sourceWeight ?? DEFAULT_SOURCE_WEIGHTS[o.source.kind];
    const rw = recencyWeight(o.ageDays, halfLife);
    const kept = keptSet.has(o);
    const madDeviation = mad > 0 ? Math.abs(priceEUR - med) / mad : undefined;
    return {
      observation: o,
      priceEUR: Math.round(priceEUR),
      sourceWeight: sw,
      recencyWeight: Number(rw.toFixed(3)),
      effectiveWeight: Number((sw * rw).toFixed(3)),
      kept,
      ...(madDeviation !== undefined ? { madDeviation: Number(madDeviation.toFixed(2)) } : {}),
      ...(kept ? {} : { rejectionReason: 'outlier_mad' as const }),
    };
  });

  const nKept = result.nSources;
  const nRejected = obs.length - nKept;
  const ci80WidthRatio = result.central
    ? Number(((result.ci80[1] - result.ci80[0]) / result.central).toFixed(3))
    : 1;
  const countScore = Math.min(1, nKept / 8);
  const tightnessScore = Math.max(0, 1 - ci80WidthRatio);

  const notes: string[] = [];
  notes.push(
    `Estimation fondée sur ${nKept} observation${nKept > 1 ? 's' : ''} conservée${nKept > 1 ? 's' : ''}` +
      (nRejected > 0 ? ` (${nRejected} écartée${nRejected > 1 ? 's' : ''} comme aberrante${nRejected > 1 ? 's' : ''}, règle MAD k=${k}).` : '.'),
  );

  // Répartition par type de source (les ventes réalisées pèsent le plus).
  const kinds = new Map<string, number>();
  for (const b of breakdown) {
    if (!b.kept) continue;
    kinds.set(b.observation.source.kind, (kinds.get(b.observation.source.kind) ?? 0) + 1);
  }
  if (kinds.size > 0) {
    const parts = [...kinds.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => `${n} ${SOURCE_KIND_LABEL[kind] ?? kind}`);
    notes.push(`Mélange de sources : ${parts.join(', ')}.`);
  }

  notes.push(
    ci80WidthRatio <= 0.25
      ? `Fourchette resserrée (± ${Math.round((ci80WidthRatio / 2) * 100)} % autour de la valeur centrale) : marché lisible.`
      : ci80WidthRatio <= 0.6
        ? `Fourchette modérée (± ${Math.round((ci80WidthRatio / 2) * 100)} %) : quelques divergences entre sources.`
        : `Fourchette large (± ${Math.round((ci80WidthRatio / 2) * 100)} %) : peu de données concordantes — prudence.`,
  );
  notes.push(
    `Fiabilité ${result.reliability}/100 = moitié couverture (${Math.round(countScore * 100)} %) + moitié resserrement (${Math.round(tightnessScore * 100)} %).`,
  );

  return {
    central: result.central,
    ci80: result.ci80,
    ci95: result.ci95,
    reliability: result.reliability,
    ci80WidthRatio,
    nKept,
    nRejected,
    breakdown,
    reliabilityFactors: {
      countScore: Number(countScore.toFixed(3)),
      tightnessScore: Number(tightnessScore.toFixed(3)),
    },
    notes,
  };
}

/** Cohérence : le score de fiabilité recalculé depuis l'explication == moteur. */
export function reliabilityFromExplanation(e: ValuationExplanation): number {
  return reliabilityScore(e.nKept, e.ci80[0], e.ci80[1], e.central);
}
