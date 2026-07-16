import { describe, expect, it } from 'vitest';
import type { ValuationRecord, VelumItem } from '@velum/core';

import { countFailedValuations, loadCarnetData } from './carnetData';

function item(id: string, domain: VelumItem['domain'] = 'wine'): VelumItem {
  return {
    id,
    ownerId: 'u1',
    domain,
    title: `Objet ${id}`,
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

describe('loadCarnetData', () => {
  it('conserve séparément une vraie absence de cote et une panne de lecture', async () => {
    const items = [item('valued'), item('never-valued'), item('unavailable')];
    const result = await loadCarnetData({
      async listItems() {
        return items;
      },
      async latestValuation(itemId) {
        if (itemId === 'valued') return valuation(itemId);
        if (itemId === 'never-valued') return null;
        throw new Error('PostgREST indisponible');
      },
    });

    expect(result.items).toEqual(items);
    expect(result.latestByItem['valued']).toEqual(valuation('valued'));
    expect(result.latestByItem['never-valued']).toBeNull();
    expect(result.latestByItem['unavailable']).toBeNull();
    expect(result.failedValuationItemIds).toEqual(['unavailable']);
  });

  it('propage une panne de lecture de la collection entière', async () => {
    await expect(
      loadCarnetData({
        async listItems() {
          throw new Error('items indisponibles');
        },
        async latestValuation() {
          return null;
        },
      }),
    ).rejects.toThrow('items indisponibles');
  });

  it('préserve l’ordre des échecs malgré des résolutions concurrentes', async () => {
    const result = await loadCarnetData({
      async listItems() {
        return [item('a'), item('b'), item('c')];
      },
      async latestValuation(itemId) {
        if (itemId === 'a') await Promise.resolve();
        throw new Error(itemId);
      },
    });

    expect(result.failedValuationItemIds).toEqual(['a', 'b', 'c']);
  });
});

describe('countFailedValuations', () => {
  it('compte uniquement les échecs du domaine affiché', () => {
    const wine = [item('wine-ok'), item('wine-failed')];
    const coin = [item('coin-failed', 'coin')];
    const failures = ['wine-failed', 'coin-failed'];

    expect(countFailedValuations(wine, failures)).toBe(1);
    expect(countFailedValuations(coin, failures)).toBe(1);
    expect(countFailedValuations([], failures)).toBe(0);
  });
});
