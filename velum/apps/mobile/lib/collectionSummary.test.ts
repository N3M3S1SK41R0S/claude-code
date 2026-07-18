import { describe, expect, it } from 'vitest';
import type { ValuationRecord, VelumItem } from '@velum/core';

import { collectionSummary } from './collectionSummary';

function item(id: string, acquiredPrice: number | null): VelumItem {
  return {
    id,
    ownerId: 'u1',
    domain: 'wine',
    title: id,
    attributes: {},
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function valuation(itemId: string, central: number): ValuationRecord {
  return {
    id: `v-${itemId}`,
    itemId,
    central,
    ci80Low: central * 0.8,
    ci80High: central * 1.2,
    ci95Low: central * 0.6,
    ci95High: central * 1.4,
    reliability: 70,
    sources: [],
    valuedAt: '2026-07-01T00:00:00Z',
  };
}

describe('collectionSummary', () => {
  it('additionne uniquement les objets valorisés et calcule la plus-value comparable', () => {
    const items = [item('a', 60), item('b', 150), item('never-valued', 20)];
    const result = collectionSummary(
      items,
      {
        a: valuation('a', 100),
        b: valuation('b', 200),
        'never-valued': null,
      },
      [],
    );

    expect(result).toEqual({ totalValue: 300, gainLoss: 90 });
  });

  it('n’invente pas de plus-value sans prix d’acquisition comparable', () => {
    expect(
      collectionSummary([item('a', null)], { a: valuation('a', 100) }, []),
    ).toEqual({ totalValue: 100, gainLoss: null });
  });

  it('masque tout total lorsqu’une seule cote est temporairement indisponible', () => {
    const result = collectionSummary(
      [item('a', 60), item('b', 150)],
      { a: valuation('a', 100), b: null },
      ['b'],
    );

    expect(result).toEqual({ totalValue: null, gainLoss: null });
  });
});
