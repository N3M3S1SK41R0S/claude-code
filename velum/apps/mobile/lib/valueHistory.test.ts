import { describe, expect, it } from 'vitest';
import type { ValuationRecord } from '@velum/core';
import { toChartPoints } from './valueHistory';

function record(id: string, central: number, valuedAt: string): ValuationRecord {
  return {
    id,
    itemId: 'itm-1',
    central,
    ci80Low: central * 0.9,
    ci80High: central * 1.1,
    ci95Low: central * 0.8,
    ci95High: central * 1.2,
    reliability: 70,
    sources: [],
    valuedAt,
  };
}

describe('toChartPoints', () => {
  it('renvoie [] pour un historique vide', () => {
    expect(toChartPoints([])).toEqual([]);
  });

  it('trie chronologiquement (le repo renvoie du plus récent au plus ancien)', () => {
    const points = toChartPoints([
      record('c', 300, '2026-03-01T00:00:00Z'),
      record('a', 100, '2026-01-01T00:00:00Z'),
      record('b', 200, '2026-02-01T00:00:00Z'),
    ]);
    expect(points.map((p) => p.central)).toEqual([100, 200, 300]);
    expect(points[0]?.valuedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('normalise x et y dans [0,1] avec extrémités exactes', () => {
    const points = toChartPoints([
      record('a', 100, '2026-01-01T00:00:00Z'),
      record('b', 300, '2026-01-11T00:00:00Z'),
      record('c', 200, '2026-01-21T00:00:00Z'),
    ]);
    expect(points[0]).toMatchObject({ x: 0, y: 0 });
    expect(points[1]).toMatchObject({ x: 0.5, y: 1 });
    expect(points[2]).toMatchObject({ x: 1, y: 0.5 });
  });

  it('place un point unique à y=0.5', () => {
    const points = toChartPoints([record('a', 500, '2026-01-01T00:00:00Z')]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ x: 0, y: 0.5, central: 500 });
  });

  it('aplatit une série constante sur la ligne médiane', () => {
    const points = toChartPoints([
      record('a', 250, '2026-01-01T00:00:00Z'),
      record('b', 250, '2026-02-01T00:00:00Z'),
    ]);
    expect(points.every((p) => p.y === 0.5)).toBe(true);
    expect(points[0]?.x).toBe(0);
    expect(points[1]?.x).toBe(1);
  });

  it('répartit x uniformément quand tous les horodatages sont identiques', () => {
    const points = toChartPoints([
      record('a', 100, '2026-01-01T00:00:00Z'),
      record('b', 200, '2026-01-01T00:00:00Z'),
      record('c', 300, '2026-01-01T00:00:00Z'),
    ]);
    expect(points.map((p) => p.x)).toEqual([0, 0.5, 1]);
  });
});
