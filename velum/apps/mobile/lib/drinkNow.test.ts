import { describe, expect, it } from 'vitest';
import type { VelumItem, WineAnalysisPayload } from '@velum/core';
import {
  cellarPeakForItems,
  drinkNowBannerEntries,
  drinkNowForItems,
  localPairingForItems,
  toAnalyzedCellarWines,
  toCellarWineEntries,
} from './drinkNow';

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

describe('drinkNowBannerEntries — bandeau « à boire » de la Collection', () => {
  const cellar = [
    item({ id: 'peak', title: 'Chinon 2020', attributes: { analysis: payload(2022, 2030) } }),
    item({ id: 'past', title: 'Sancerre 2018', attributes: { analysis: payload(2015, 2024) } }),
    item({ id: 'closing', title: 'Bandol 2015', attributes: { analysis: payload(2020, 2026) } }),
    item({ id: 'soon', title: 'Pauillac 2019', attributes: { analysis: payload(2027, 2040) } }),
    item({ id: 'young', title: 'Barolo 2021', attributes: { analysis: payload(2031, 2045) } }),
  ];

  it('même règle que « Mes vins à leur apogée » : fenêtre dépassée comprise, urgents d’abord, jamais « l’an prochain »', () => {
    const banner = drinkNowBannerEntries(cellar, 2026);
    expect(banner.map((e) => [e.itemId, e.status])).toEqual([
      ['past', 'past'],
      ['closing', 'closing'],
      ['peak', 'peak'],
    ]);
    const screen = cellarPeakForItems(cellar, 2026).entries.filter((e) => e.status !== 'soon');
    expect(banner.map((e) => e.itemId)).toEqual(screen.map((e) => e.itemId));
  });

  it('une cave où tous les vins sont dépassés affiche quand même le bandeau', () => {
    const banner = drinkNowBannerEntries([cellar[1] as VelumItem], 2026);
    expect(banner.map((e) => e.itemId)).toEqual(['past']);
    expect(banner[0]?.suggestedDishes).toContain('gigot d’agneau');
  });
});

describe('toCellarWineEntries — inventaire de cave local', () => {
  it('lit attributs directs puis fiche ZAPPA, sans deviner les champs invalides', () => {
    const analysis = {
      ...payload(2020, 2026),
      identification: {
        producer: 'Tempier',
        appellation: 'Bandol',
        color: 'rouge',
        region: 'Provence',
        vintage: 2015,
        grapes: [{ name: 'mourvèdre', percent: 75 }, { name: 'grenache' }],
      },
    };
    const entries = toCellarWineEntries([
      item({
        id: 'a',
        title: '  ',
        storageLocation: ' Rangée 2 · Colonne 4 ',
        attributes: { analysis, quantity: 3, color: 'rosé' },
      }),
      item({ id: 'b', title: 'Sans fiche', attributes: { quantity: -1, grapes: ['syrah', 'syrah'] } }),
      item({ id: 'c', domain: 'coin', attributes: { analysis } }),
    ]);
    expect(entries).toEqual([
      {
        itemId: 'a',
        label: 'Tempier 2015',
        vintage: 2015,
        color: 'rosé',
        region: 'Provence',
        appellation: 'Bandol',
        grapes: ['mourvèdre', 'grenache'],
        storageLocation: 'Rangée 2 · Colonne 4',
        quantity: 3,
        drinkWindow: { from: 2020, to: 2026 },
        foodPairings: ['gigot d’agneau', 'daube provençale'],
      },
      { itemId: 'b', label: 'Sans fiche', grapes: ['syrah'] },
    ]);
  });

  it('sans titre ni producteur, cuvée ou millésime : libellé vide, traduit à l’affichage (jamais de français en dur)', () => {
    const analysis = { ...payload(2020, 2030), identification: {} };
    const [entry] = toCellarWineEntries([item({ title: null, attributes: { analysis } })]);
    expect(entry?.label).toBe('');
  });

  it('ignore une fenêtre inversée (jamais d’apogée à tort)', () => {
    const [entry] = toCellarWineEntries([item({ attributes: { analysis: payload(2030, 2020) } })]);
    expect(entry?.drinkWindow).toBeUndefined();
  });
});

describe('cellarPeakForItems — à la demande, avec position', () => {
  it('liste par urgence et compte les vins sans fiche complète', () => {
    const report = cellarPeakForItems(
      [
        item({ id: 'peak', title: 'Chinon 2020', attributes: { analysis: payload(2022, 2030) } }),
        item({
          id: 'closing',
          title: 'Bandol 2015',
          storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
          attributes: { analysis: payload(2020, 2026) },
        }),
        item({ id: 'nofiche', title: 'Vin mystère', attributes: {} }),
        item({ id: 'young', title: 'Barolo 2021', attributes: { analysis: payload(2031, 2045) } }),
      ],
      2026,
    );
    expect(report.entries.map((e) => [e.itemId, e.status])).toEqual([
      ['closing', 'closing'],
      ['peak', 'peak'],
    ]);
    expect(report.entries[0]?.storageLocation).toBe('Rangée 2 · Colonne 4 · Place 1');
    expect(report.unknownWindowItemIds).toEqual(['nofiche']);
    expect(report.youngCount).toBe(1);
  });
});

describe('localPairingForItems — plat → vins de ma cave sans IA', () => {
  it('propose le vin dont la fiche cite le plat, avec sa position', () => {
    const result = localPairingForItems(
      'gigot d’agneau',
      [
        item({
          id: 'bandol',
          title: 'Bandol Domaine Tempier 2015',
          storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
          attributes: { color: 'rouge', analysis: payload(2020, 2026) },
        }),
      ],
      2026,
    );
    expect(result.suggestions[0]).toMatchObject({
      itemId: 'bandol',
      storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
      matchedPairing: 'gigot d’agneau',
      peakStatus: 'closing',
    });
  });
});
