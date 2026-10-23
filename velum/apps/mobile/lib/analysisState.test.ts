import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';
import {
  analysisStatusOf,
  hasFullAnalysis,
  identityAttributes,
  isAnalysisOutdated,
  itemToCandidate,
} from './analysisState';

function item(attributes: Record<string, unknown>, overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id: 'i1',
    ownerId: 'o',
    domain: 'stamp',
    title: 'Cérès 1849',
    attributes,
    confidence: 0.8,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('analysisState', () => {
  it('distingue fiche complète, à charger et en échec', () => {
    expect(analysisStatusOf(item({ analysis: { a: 1 } }))).toBe('complete');
    expect(analysisStatusOf(item({ analysisStatus: 'pending' }))).toBe('pending');
    expect(analysisStatusOf(item({}))).toBe('pending');
    expect(analysisStatusOf(item({ analysisStatus: 'failed' }))).toBe('failed');
    expect(hasFullAnalysis(item({ analysis: null }))).toBe(false);
  });

  it('itemToCandidate ne transmet que l’identité', () => {
    const c = itemToCandidate(
      item({ country: 'France', catalogNumber: 'YT 3', analysis: {}, disclaimers: ['x'], corrections: [] }),
    );
    expect(c).toEqual({
      id: 'i1',
      domain: 'stamp',
      label: 'Cérès 1849',
      confidence: 0.8,
      attributes: { country: 'France', catalogNumber: 'YT 3' },
    });
    expect(identityAttributes({ quickEstimate: {}, year: 1849 })).toEqual({ year: 1849 });
  });

  it('signale une fiche périmée après correction de l’identité', () => {
    const corrected = [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' }];
    expect(
      isAnalysisOutdated(item({ analysis: {}, analyzedAt: '2026-05-01T00:00:00Z', corrections: corrected })),
    ).toBe(true);
    expect(
      isAnalysisOutdated(item({ analysis: {}, analyzedAt: '2026-05-03T00:00:00Z', corrections: corrected })),
    ).toBe(false);
    expect(isAnalysisOutdated(item({ analysis: {}, corrections: corrected }))).toBe(true);
    expect(isAnalysisOutdated(item({ corrections: corrected }))).toBe(false);
  });
});
