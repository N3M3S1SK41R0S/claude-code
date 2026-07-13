import { describe, expect, it } from 'vitest';
import type { VelumDomain, VelumItem } from '@velum/core';
import { detectSeriesGaps, seriesGapsForItems } from './seriesGaps';

function item(id: string, domain: VelumDomain, attributes: Record<string, unknown>): VelumItem {
  return {
    id,
    ownerId: 'u',
    domain,
    title: id,
    attributes,
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('detectSeriesGaps', () => {
  it('repère les rangs manquants entre le min et le max présents', () => {
    const gaps = detectSeriesGaps([
      { series: 'S', n: 1960 },
      { series: 'S', n: 1962 },
      { series: 'S', n: 1965 },
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.present).toEqual([1960, 1962, 1965]);
    expect(gaps[0]?.missing).toEqual([1961, 1963, 1964]);
    expect(gaps[0]?.from).toBe(1960);
    expect(gaps[0]?.to).toBe(1965);
  });

  it('ignore une série complète (aucun trou)', () => {
    expect(detectSeriesGaps([{ series: 'S', n: 1 }, { series: 'S', n: 2 }])).toEqual([]);
  });

  it('ignore une série d’un seul élément (pas de plage)', () => {
    expect(detectSeriesGaps([{ series: 'S', n: 1960 }])).toEqual([]);
  });

  it('trie les séries par nombre de manquants décroissant', () => {
    const gaps = detectSeriesGaps([
      { series: 'A', n: 1 },
      { series: 'A', n: 3 }, // 1 manquant
      { series: 'B', n: 10 },
      { series: 'B', n: 14 }, // 3 manquants
    ]);
    expect(gaps.map((g) => g.series)).toEqual(['B', 'A']);
  });

  it('écarte une plage aberrante (trop large)', () => {
    expect(detectSeriesGaps([{ series: 'S', n: 0 }, { series: 'S', n: 10_000 }])).toEqual([]);
  });
});

describe('seriesGapsForItems', () => {
  it('pièces : série = type, rang = année', () => {
    const coins = [
      item('c1', 'coin', { type: '5 Francs Semeuse', year: 1960 }),
      item('c2', 'coin', { type: '5 Francs Semeuse', year: 1963 }),
      item('c3', 'coin', { type: '20 Francs Or', year: 1907 }),
    ];
    const gaps = seriesGapsForItems(coins, 'coin');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.series).toBe('5 Francs Semeuse');
    expect(gaps[0]?.missing).toEqual([1961, 1962]);
  });

  it('timbres : série = pays + catalogue, rang = année (lecture via analysis)', () => {
    const stamps = [
      item('s1', 'stamp', { analysis: { identification: { country: 'France', catalog: 'yvert_tellier', year: 1900 } } }),
      item('s2', 'stamp', { country: 'France', catalog: 'yvert_tellier', year: 1903 }),
    ];
    const gaps = seriesGapsForItems(stamps, 'stamp');
    expect(gaps[0]?.series).toBe('France yvert_tellier');
    expect(gaps[0]?.missing).toEqual([1901, 1902]);
  });

  it('renvoie [] pour un domaine sans notion de série', () => {
    expect(seriesGapsForItems([item('w', 'wine', { vintage: 2015 })], 'wine')).toEqual([]);
  });
});
