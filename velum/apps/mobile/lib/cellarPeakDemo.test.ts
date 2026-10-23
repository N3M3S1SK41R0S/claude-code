import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';

import { demoCellarPairing, demoWineAnalysis } from './cellarPeakDemo';
import { seedItems } from './demo/demoData';
import { cellarPeakForItems } from './drinkNow';
import { itemDrinkWindow } from './itemAttributes';

function wine(id: string, title: string, attributes: Record<string, unknown>, storageLocation: string | null = null): VelumItem {
  return {
    id,
    ownerId: 'demo',
    domain: 'wine',
    title,
    attributes,
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('cave démo', () => {
  it('fenêtre relative à l’année injectée, identification et accords surchargés', () => {
    const base = { identification: { producer: 'X', color: 'rouge' }, tasting: { robe: 'grenat' }, uncertainties: ['démo'] };
    const analysis = demoWineAnalysis(
      base,
      { window: [-6, 0], color: 'blanc', appellation: 'Sancerre', region: 'Loire', vintage: 2021, foodPairings: ['huîtres'] },
      2030,
    );
    expect(analysis).toMatchObject({
      identification: { producer: 'X', color: 'blanc', appellation: 'Sancerre', region: 'Loire', vintage: 2021 },
      tasting: { robe: 'grenat', drinkWindow: { from: 2024, to: 2030 } },
      comparisons: { foodPairings: ['huîtres'] },
      uncertainties: ['démo'],
    });
  });

  it('la cave démo montre tous les statuts, des positions et un vin sans fiche', () => {
    const items = seedItems();
    // Année de référence lue dans les données (le Bandol finit sa fenêtre
    // l'année de la graine) : aucune dépendance à l'horloge du test.
    const bandol = items.find((item) => item.title === 'Bandol Domaine Tempier 2016');
    if (!bandol) throw new Error('Bandol démo introuvable');
    const year = itemDrinkWindow(bandol)?.to ?? Number.NaN;
    expect(Number.isFinite(year)).toBe(true);
    const report = cellarPeakForItems(items, year);
    const statuses = new Set(report.entries.map((e) => e.status));
    expect([...statuses].sort()).toEqual(['closing', 'past', 'peak', 'soon']);
    expect(report.youngCount).toBeGreaterThanOrEqual(1);
    expect(report.unknownWindowItemIds).toHaveLength(1);
    expect(report.entries.some((e) => e.storageLocation === undefined)).toBe(true);
    expect(report.entries[0]?.status).toBe('past');
  });

  it('le sommelier démo cite l’emplacement, ou conseille un achat', () => {
    const cave = [
      wine(
        'bandol',
        'Bandol 2016',
        { color: 'rouge', analysis: demoWineAnalysis({}, { window: [-6, 0], color: 'rouge', appellation: 'Bandol', region: 'Provence', vintage: 2016, foodPairings: ['gigot d’agneau'] }, 2026) },
        'Rangée 2 · Colonne 4 · Place 1',
      ),
    ];
    const hit = demoCellarPairing('gigot d’agneau', cave, 2026);
    expect(hit.recommendations[0]?.itemId).toBe('bandol');
    expect(hit.recommendations[0]?.reasoning).toContain('Rangé : Rangée 2 · Col. 4 · Pl. 1.');
    const miss = demoCellarPairing('huîtres', cave, 2026);
    expect(miss.recommendations).toEqual([]);
    expect(miss.fallbackAdvice).toContain('Muscadet');
    expect(demoCellarPairing('kouign-amann', cave, 2026).fallbackAdvice).toContain('non reconnu');
  });
});
