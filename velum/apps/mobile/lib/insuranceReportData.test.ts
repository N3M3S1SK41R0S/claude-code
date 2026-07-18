import { describe, expect, it } from 'vitest';
import { isVelumError, type ValuationRecord, type VelumItem } from '@velum/core';

import { insuranceReportEntries } from './insuranceReportData';

function item(id: string): VelumItem {
  return {
    id,
    ownerId: 'u1',
    domain: 'wine',
    title: id,
    attributes: {},
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function valuation(itemId: string): ValuationRecord {
  return {
    id: `v-${itemId}`,
    itemId,
    central: 100,
    ci80Low: 80,
    ci80High: 120,
    ci95Low: 60,
    ci95High: 140,
    reliability: 70,
    sources: [],
    valuedAt: '2026-07-01T00:00:00Z',
  };
}

describe('insuranceReportEntries', () => {
  it('conserve une vraie absence de cote comme entrée non valorisée', () => {
    const valued = item('valued');
    const neverValued = item('never-valued');

    expect(
      insuranceReportEntries({
        items: [valued, neverValued],
        latestByItem: {
          valued: valuation('valued'),
          'never-valued': null,
        },
        failedValuationItemIds: [],
      }),
    ).toEqual([
      { item: valued, valuation: valuation('valued') },
      { item: neverValued, valuation: null },
    ]);
  });

  it('refuse le rapport lorsqu’une lecture de cote a échoué', () => {
    expect.assertions(3);
    try {
      insuranceReportEntries({
        items: [item('unavailable')],
        latestByItem: { unavailable: null },
        failedValuationItemIds: ['unavailable'],
      });
    } catch (error) {
      expect(isVelumError(error)).toBe(true);
      if (!isVelumError(error)) return;
      expect(error.code).toBe('SOURCE_UNAVAILABLE');
      expect(error.details).toEqual({ itemIds: ['unavailable'] });
    }
  });

  it('refuse aussi une ligne de cote manquante sans l’interpréter comme null', () => {
    expect(() =>
      insuranceReportEntries({
        items: [item('missing')],
        latestByItem: {},
        failedValuationItemIds: [],
      }),
    ).toThrowError(/cotes.*indisponibles/i);
  });
});
