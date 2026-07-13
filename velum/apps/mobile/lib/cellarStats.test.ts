import { describe, expect, it } from 'vitest';
import type { ValuationRecord, VelumItem } from '@velum/core';
import { cellarStats } from './cellarStats';

function wine(
  id: string,
  attrs: Record<string, unknown>,
  title = `Vin ${id}`,
): VelumItem {
  return {
    id,
    ownerId: 'u',
    domain: 'wine',
    title,
    attributes: attrs,
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

function val(id: string, central: number): ValuationRecord {
  return {
    id: `v-${id}`,
    itemId: id,
    central,
    ci80Low: central * 0.9,
    ci80High: central * 1.1,
    ci95Low: central * 0.8,
    ci95High: central * 1.2,
    reliability: 70,
    sources: [],
    valuedAt: '2026-01-01T00:00:00Z',
  };
}

describe('cellarStats', () => {
  const items = [
    wine('a', { region: 'Bordeaux', color: 'rouge', vintage: 2015 }),
    wine('b', { region: 'Bordeaux', color: 'rouge', vintage: 2016 }),
    wine('c', { region: 'Bourgogne', color: 'blanc', vintage: 2020 }),
    // Lecture via analysis.identification quand l'attribut direct manque.
    wine('d', {
      analysis: {
        identification: { region: 'Bourgogne', color: 'blanc', vintage: 2020 },
        tasting: { drinkWindow: { from: 2022, to: 2026 } },
      },
    }),
  ];
  const latest = { a: val('a', 100), b: val('b', 200), c: val('c', 300), d: null };

  it('additionne valeur totale et compte les objets valorisés', () => {
    const s = cellarStats(items, latest, 2026);
    expect(s.count).toBe(4);
    expect(s.valuedCount).toBe(3);
    expect(s.totalEUR).toBe(600);
  });

  it('répartit par région, triée par effectif décroissant, avec valeur agrégée', () => {
    const s = cellarStats(items, latest, 2026);
    expect(s.byRegion.map((b) => b.key)).toEqual(['Bordeaux', 'Bourgogne']);
    const bordeaux = s.byRegion.find((b) => b.key === 'Bordeaux');
    expect(bordeaux?.count).toBe(2);
    expect(bordeaux?.valueEUR).toBe(300); // 100 + 200
  });

  it('répartit par couleur et par millésime (millésime trié croissant)', () => {
    const s = cellarStats(items, latest, 2026);
    expect(s.byColor.find((b) => b.key === 'rouge')?.count).toBe(2);
    expect(s.byColor.find((b) => b.key === 'blanc')?.count).toBe(2);
    expect(s.byVintage.map((b) => b.key)).toEqual(['2015', '2016', '2020']);
    expect(s.byVintage.find((b) => b.key === '2020')?.count).toBe(2);
  });

  it('repère les bouteilles à boire dans les 12 mois (fin d’apogée proche)', () => {
    const s = cellarStats(items, latest, 2026);
    expect(s.drinkSoon.map((d) => d.itemId)).toEqual(['d']); // fenêtre 2022–2026, fin en 2026
  });

  it('n’inclut pas un vin encore loin de la fin de son apogée', () => {
    const early = [wine('x', { analysis: { tasting: { drinkWindow: { from: 2020, to: 2035 } } } })];
    const s = cellarStats(early, { x: null }, 2026);
    expect(s.drinkSoon).toHaveLength(0);
  });

  it('gère une cave vide', () => {
    const s = cellarStats([], {}, 2026);
    expect(s).toEqual({
      count: 0,
      valuedCount: 0,
      totalEUR: 0,
      byRegion: [],
      byColor: [],
      byVintage: [],
      drinkSoon: [],
    });
  });
});
