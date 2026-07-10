import { describe, expect, it } from 'vitest';
import type { VelumItem, WineAnalysisPayload } from '@velum/core';
import { drinkNowForItems, toAnalyzedCellarWines } from './drinkNow';

function payload(from: number, to: number): WineAnalysisPayload {
  return {
    identification: { producer: 'Tempier' },
    tasting: {
      robe: 'grenat',
      nose: ['garrigue'],
      palate: { structure: 'ample', acidity: 'fraîche' },
      length: 'longue',
      agingPotentialYears: [5, 20],
      drinkWindow: { from, to },
    },
    ratings: { positioning: 'classique' },
    market: { assetClass: 'cave' },
    comparisons: { foodPairings: ['gigot d’agneau', 'daube provençale'] },
    uncertainties: ['—'],
  };
}

function item(partial: Partial<VelumItem>): VelumItem {
  return {
    id: 'i1',
    ownerId: 'u1',
    domain: 'wine',
    title: 'Bandol 2016',
    attributes: {},
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('toAnalyzedCellarWines', () => {
  it('ignore les items sans analyse et les autres domaines', () => {
    const items = [
      item({ id: 'a', attributes: { analysis: payload(2020, 2030), vintage: 2016 }, storageLocation: 'Casier B3' }),
      item({ id: 'b', attributes: {} }), // pas d'analyse
      item({ id: 'c', domain: 'coin', attributes: { analysis: payload(2020, 2030) } }),
    ];
    const wines = toAnalyzedCellarWines(items);
    expect(wines).toHaveLength(1);
    expect(wines[0]).toMatchObject({ itemId: 'a', vintage: 2016, storageLocation: 'Casier B3' });
  });
});

describe('drinkNowForItems', () => {
  it('remonte uniquement les vins à l’apogée, avec les plats ZAPPA', () => {
    const items = [
      item({ id: 'ready', attributes: { analysis: payload(2020, 2028) } }),
      item({ id: 'young', attributes: { analysis: payload(2030, 2040) } }),
    ];
    const suggestions = drinkNowForItems(items, 2026);
    expect(suggestions.map((s) => s.itemId)).toEqual(['ready']);
    expect(suggestions[0]?.suggestedDishes).toContain('gigot d’agneau');
  });
});
