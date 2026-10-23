import { describe, expect, it } from 'vitest';
import type { CellarWineEntry } from '@velum/core';
import {
  cellarAtPeak,
  countByPeakStatus,
  formatCellarLocationShort,
  isPeakStatus,
  mostUrgentPeakWine,
  parseCellarSlotText,
  peakStatus,
  validDrinkWindow,
} from './peak.ts';

const YEAR = 2026;

function wine(partial: Partial<CellarWineEntry> & { itemId: string }): CellarWineEntry {
  return { label: `Vin ${partial.itemId}`, ...partial };
}

describe('peakStatus — urgence selon la fenêtre d’apogée', () => {
  it('distingue dépassé, dernière année, apogée, l’an prochain et en garde', () => {
    expect(peakStatus({ from: 2015, to: 2025 }, YEAR)).toBe('past');
    expect(peakStatus({ from: 2020, to: 2026 }, YEAR)).toBe('closing');
    expect(peakStatus({ from: 2026, to: 2026 }, YEAR)).toBe('closing');
    expect(peakStatus({ from: 2022, to: 2030 }, YEAR)).toBe('peak');
    expect(peakStatus({ from: 2026, to: 2030 }, YEAR)).toBe('peak');
    expect(peakStatus({ from: 2027, to: 2035 }, YEAR)).toBe('soon');
    expect(peakStatus({ from: 2028, to: 2035 }, YEAR)).toBe('young');
  });

  it('ne devine jamais : fenêtre absente, inversée ou non numérique → unknown', () => {
    expect(peakStatus(undefined, YEAR)).toBe('unknown');
    expect(peakStatus(null, YEAR)).toBe('unknown');
    expect(peakStatus({ from: 2030, to: 2020 }, YEAR)).toBe('unknown');
    expect(peakStatus({ from: '2020', to: 2030 }, YEAR)).toBe('unknown');
    expect(peakStatus({ from: Number.NaN, to: 2030 }, YEAR)).toBe('unknown');
    expect(peakStatus({ from: 2020, to: 2030 }, Number.NaN)).toBe('unknown');
    expect(validDrinkWindow({ from: 2020, to: Infinity })).toBeNull();
  });

  it('isPeakStatus exclut young et unknown', () => {
    expect(isPeakStatus('soon')).toBe(true);
    expect(isPeakStatus('young')).toBe(false);
    expect(isPeakStatus('unknown')).toBe(false);
  });
});

describe('cellarAtPeak — « Mes vins à leur apogée » à la demande', () => {
  const cellar: CellarWineEntry[] = [
    wine({ itemId: 'peak-late', label: 'Hermitage 2015', drinkWindow: { from: 2022, to: 2035 } }),
    wine({
      itemId: 'closing',
      label: 'Bandol Tempier 2015',
      vintage: 2015,
      color: 'rouge',
      storageLocation: '  Rangée 2 · Colonne 4 · Place 1 ',
      quantity: 3,
      drinkWindow: { from: 2020, to: 2026 },
      foodPairings: ['gigot d’agneau', ' ', 'daube provençale', 'gigot d’agneau', 'fromages affinés', 'pigeon'],
    }),
    wine({ itemId: 'past', label: 'Sancerre 2018', drinkWindow: { from: 2019, to: 2024 }, quantity: 0 }),
    wine({ itemId: 'soon', label: 'Pauillac 2019', drinkWindow: { from: 2027, to: 2045 } }),
    wine({ itemId: 'young', label: 'Barolo 2021', drinkWindow: { from: 2031, to: 2050 } }),
    wine({ itemId: 'unknown', label: 'Vin sans fiche' }),
    wine({ itemId: 'peak-early', label: 'Chinon 2020', drinkWindow: { from: 2023, to: 2028 } }),
  ];

  it('trie par urgence puis fin de fenêtre, et compte à part garde / fenêtre inconnue', () => {
    const report = cellarAtPeak(cellar, YEAR);
    expect(report.year).toBe(YEAR);
    expect(report.entries.map((e) => [e.itemId, e.status])).toEqual([
      ['past', 'past'],
      ['closing', 'closing'],
      ['peak-early', 'peak'],
      ['peak-late', 'peak'],
      ['soon', 'soon'],
    ]);
    expect(report.youngCount).toBe(1);
    expect(report.unknownWindowItemIds).toEqual(['unknown']);
  });

  it('porte la position (trimée), la quantité positive et 3 plats dédupliqués', () => {
    const closing = cellarAtPeak(cellar, YEAR).entries.find((e) => e.itemId === 'closing');
    expect(closing).toMatchObject({
      label: 'Bandol Tempier 2015',
      vintage: 2015,
      color: 'rouge',
      storageLocation: 'Rangée 2 · Colonne 4 · Place 1',
      quantity: 3,
      windowFrom: 2020,
      windowTo: 2026,
      suggestedDishes: ['gigot d’agneau', 'daube provençale', 'fromages affinés'],
    });
    const past = cellarAtPeak(cellar, YEAR).entries.find((e) => e.itemId === 'past');
    expect(past?.quantity).toBeUndefined();
    expect(past?.storageLocation).toBeUndefined();
    expect(past?.suggestedDishes).toEqual([]);
  });

  it('filtre « l’an prochain » sur demande et borne les plats', () => {
    const report = cellarAtPeak(cellar, YEAR, { includeSoon: false, maxDishes: 2 });
    expect(report.entries.some((e) => e.status === 'soon')).toBe(false);
    expect(report.entries.find((e) => e.itemId === 'closing')?.suggestedDishes).toHaveLength(2);
  });

  it('cave vide → rapport vide, sans erreur', () => {
    expect(cellarAtPeak([], YEAR)).toEqual({
      year: YEAR,
      entries: [],
      youngCount: 0,
      unknownWindowItemIds: [],
    });
  });

  it('mostUrgentPeakWine ignore « l’an prochain » et countByPeakStatus résume', () => {
    const { entries } = cellarAtPeak(cellar, YEAR);
    expect(mostUrgentPeakWine(entries)?.itemId).toBe('past');
    expect(mostUrgentPeakWine(entries.filter((e) => e.status === 'soon'))).toBeNull();
    expect(mostUrgentPeakWine([])).toBeNull();
    expect(countByPeakStatus(entries)).toEqual({ past: 1, closing: 1, peak: 2, soon: 1 });
  });
});

describe('emplacement compact (notifications)', () => {
  it('parse le format canonique dans n’importe quel ordre', () => {
    expect(parseCellarSlotText('Rangée 2 · Colonne 4 · Place 1')).toEqual({ row: 2, column: 4, place: 1 });
    expect(parseCellarSlotText('place 3 · RANGEE 1')).toEqual({ row: 1, place: 3 });
    expect(parseCellarSlotText('Cave — casier B3')).toBeNull();
    expect(parseCellarSlotText('Rangée 1 · Rangée 2')).toBeNull();
    expect(parseCellarSlotText('')).toBeNull();
    expect(parseCellarSlotText(null)).toBeNull();
  });

  it('abrège la position structurée et tronque le texte libre', () => {
    expect(formatCellarLocationShort('Rangée 2 · Colonne 4 · Place 1')).toBe('Rangée 2 · Col. 4 · Pl. 1');
    expect(formatCellarLocationShort('Rangée 2 · Colonne 4')).toBe('Rangée 2 · Col. 4');
    expect(formatCellarLocationShort('  Cave —   casier B3 ')).toBe('Cave — casier B3');
    const long = formatCellarLocationShort('x'.repeat(80));
    expect(long?.length).toBe(40);
    expect(long?.endsWith('…')).toBe(true);
    expect(formatCellarLocationShort('   ')).toBeUndefined();
    expect(formatCellarLocationShort(undefined)).toBeUndefined();
  });
});
