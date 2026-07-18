/**
 * Résout le score de fiabilité d’une valorisation persistée selon le
 * moteur courant. Les anciennes lignes peuvent contenir un score calculé
 * avant que `nSources` désigne les plateformes distinctes.
 */
import type { PriceObservation } from '@velum/core';
import { countDistinctSources, reliabilityScore } from './engine.ts';

export interface PersistedReliabilityInput {
  central: number;
  ci80: [number, number];
  reliability: number;
  observations: PriceObservation[];
}

export interface ReliabilityResolution {
  /** Score à afficher selon le moteur courant, ou score stocké en repli. */
  value: number;
  /** Score présent dans la ligne persistée, conservé pour l’audit. */
  stored: number;
  /** Nombre de plateformes distinctes réellement identifiables. */
  nSources: number;
  /** true lorsque les données conservées permettent un recalcul exact. */
  recomputed: boolean;
  /** true lorsque le moteur courant corrige le score stocké. */
  differsFromStored: boolean;
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function resolveReliabilityForResult(
  input: PersistedReliabilityInput,
): ReliabilityResolution {
  const stored = boundedScore(input.reliability);
  const nSources = countDistinctSources(input.observations);
  const [lo, hi] = input.ci80;
  const canRecompute =
    input.observations.length > 0 &&
    nSources > 0 &&
    Number.isFinite(input.central) &&
    input.central > 0 &&
    Number.isFinite(lo) &&
    Number.isFinite(hi) &&
    hi >= lo;

  if (!canRecompute) {
    return {
      value: stored,
      stored,
      nSources,
      recomputed: false,
      differsFromStored: false,
    };
  }

  const value = reliabilityScore(nSources, lo, hi, input.central);
  return {
    value,
    stored,
    nSources,
    recomputed: true,
    differsFromStored: value !== stored,
  };
}
