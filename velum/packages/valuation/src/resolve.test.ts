import { describe, expect, it } from 'vitest';
import type { PriceObservation } from '@velum/core';
import { resolveReliabilityForResult } from './resolve.ts';

function observation(sourceName: string, price: number): PriceObservation {
  return {
    price,
    currency: 'EUR',
    ageDays: 10,
    sourceWeight: 1,
    source: { name: sourceName, kind: 'auction_realized' },
  };
}

const observations = [
  observation('iDealwine', 48),
  observation('iDealwine', 50),
  observation('Wine-Searcher', 53),
  observation('Cavissima', 56),
];

describe('resolveReliabilityForResult', () => {
  it('recalcule un score historique avec les plateformes distinctes', () => {
    const result = resolveReliabilityForResult({
      central: 51,
      ci80: [45, 58],
      reliability: 81,
      observations,
    });

    expect(result).toEqual({
      value: 56,
      stored: 81,
      nSources: 3,
      recomputed: true,
      differsFromStored: true,
    });
  });

  it('ne signale aucune divergence pour un score déjà courant', () => {
    const result = resolveReliabilityForResult({
      central: 51,
      ci80: [45, 58],
      reliability: 56,
      observations,
    });
    expect(result.differsFromStored).toBe(false);
    expect(result.value).toBe(56);
  });

  it('préserve le score stocké quand aucune source ne permet le recalcul', () => {
    expect(
      resolveReliabilityForResult({
        central: 51,
        ci80: [45, 58],
        reliability: 81,
        observations: [],
      }),
    ).toEqual({
      value: 81,
      stored: 81,
      nSources: 0,
      recomputed: false,
      differsFromStored: false,
    });
  });
});
