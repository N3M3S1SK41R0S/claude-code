import { describe, expect, it } from 'vitest';
import type { ValuationRecord, VelumItem } from '@velum/core';

import {
  artAttributionQualifier,
  artEstimatedPeriod,
  attributeNumber,
  attributeString,
  bookTotals,
  coinGradeLabel,
  domainBookLabelKey,
  formatCellarSlot,
  groupByLocation,
  parseCellarSlot,
  stampConditionStatus,
} from './carnet';

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

function valuation(partial: Partial<ValuationRecord>): ValuationRecord {
  return {
    id: 'v1',
    itemId: 'i1',
    central: 100,
    ci80Low: 80,
    ci80High: 120,
    ci95Low: 60,
    ci95High: 140,
    reliability: 70,
    sources: [],
    valuedAt: '2026-07-01T00:00:00Z',
    ...partial,
  };
}

describe('groupByLocation', () => {
  it('trie les emplacements nommés alphabétiquement, null en dernier', () => {
    const items = [
      item({ id: 'a', storageLocation: 'Casier B3' }),
      item({ id: 'b', storageLocation: null }),
      item({ id: 'c', storageLocation: 'Armoire du salon' }),
      item({ id: 'd', storageLocation: 'Casier B3' }),
    ];
    const groups = groupByLocation(items);
    expect(groups.map((g) => g.location)).toEqual(['Armoire du salon', 'Casier B3', null]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['a', 'd']);
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['b']);
  });

  it('tri insensible à la casse et aux accents (locale fr)', () => {
    const items = [
      item({ id: 'a', storageLocation: 'étagère haute' }),
      item({ id: 'b', storageLocation: 'Cave voûtée' }),
    ];
    expect(groupByLocation(items).map((g) => g.location)).toEqual([
      'Cave voûtée',
      'étagère haute',
    ]);
  });

  it('traite les emplacements vides ou blancs comme « sans emplacement »', () => {
    const items = [
      item({ id: 'a', storageLocation: '   ' }),
      item({ id: 'b', storageLocation: '' }),
    ];
    const groups = groupByLocation(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.location).toBeNull();
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it("n'ajoute pas de groupe null quand tout est rangé, ni de groupe vide", () => {
    const items = [item({ id: 'a', storageLocation: 'Casier A1' })];
    expect(groupByLocation(items)).toEqual([{ location: 'Casier A1', items }]);
    expect(groupByLocation([])).toEqual([]);
  });
});

describe('bookTotals', () => {
  it('compte, somme les valorisations centrales et garde la plus récente', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    const latestByItem: Record<string, ValuationRecord | null> = {
      a: valuation({ itemId: 'a', central: 150, valuedAt: '2026-06-01T00:00:00Z' }),
      b: valuation({ itemId: 'b', central: 50, valuedAt: '2026-07-05T12:00:00Z' }),
      c: null,
    };
    expect(bookTotals(items, latestByItem)).toEqual({
      count: 3,
      totalEUR: 200,
      valuedCount: 2,
      lastValuedAt: '2026-07-05T12:00:00Z',
    });
  });

  it('tolère les items absents du dictionnaire de valorisations', () => {
    const items = [item({ id: 'orphan' })];
    expect(bookTotals(items, {})).toEqual({
      count: 1,
      totalEUR: 0,
      valuedCount: 0,
      lastValuedAt: null,
    });
  });

  it('carnet vide → zéros et null', () => {
    expect(bookTotals([], {})).toEqual({
      count: 0,
      totalEUR: 0,
      valuedCount: 0,
      lastValuedAt: null,
    });
  });
});

describe('domainBookLabelKey', () => {
  it('mappe chaque domaine sur sa mise en scène', () => {
    expect(domainBookLabelKey('wine')).toBe('carnet.cave');
    expect(domainBookLabelKey('coin')).toBe('carnet.medaillier');
    expect(domainBookLabelKey('art')).toBe('carnet.galerie');
    expect(domainBookLabelKey('stamp')).toBe('carnet.album');
  });
});

describe('formatCellarSlot', () => {
  it('formate rangée, colonne et place au format canonique', () => {
    expect(formatCellarSlot({ row: 3, column: 4, place: 2 })).toBe(
      'Rangée 3 · Colonne 4 · Place 2',
    );
  });

  it("n'inclut que les champs fournis", () => {
    expect(formatCellarSlot({ row: 1 })).toBe('Rangée 1');
    expect(formatCellarSlot({ column: 2 })).toBe('Colonne 2');
    expect(formatCellarSlot({ place: 5 })).toBe('Place 5');
    expect(formatCellarSlot({ row: 7, place: 1 })).toBe('Rangée 7 · Place 1');
  });

  it('null si aucun champ (ou uniquement des valeurs non finies)', () => {
    expect(formatCellarSlot({})).toBeNull();
    expect(formatCellarSlot({ row: Number.NaN })).toBeNull();
  });
});

describe('parseCellarSlot', () => {
  it('re-parse le format canonique (aller-retour)', () => {
    const slot = { row: 3, column: 4, place: 2 };
    expect(parseCellarSlot(formatCellarSlot(slot))).toEqual(slot);
    expect(parseCellarSlot('Rangée 3 · Colonne 4 · Place 2')).toEqual(slot);
  });

  it('tolère la casse, les espaces et un ordre différent', () => {
    expect(parseCellarSlot('  rangée 3 ·  COLONNE 4 ')).toEqual({ row: 3, column: 4 });
    expect(parseCellarSlot('rangee 12')).toEqual({ row: 12 }); // sans accent
    expect(parseCellarSlot('Place 2 · Rangée 1')).toEqual({ place: 2, row: 1 });
  });

  it('null si absent, vide ou non conforme (texte libre)', () => {
    expect(parseCellarSlot(null)).toBeNull();
    expect(parseCellarSlot('')).toBeNull();
    expect(parseCellarSlot('   ')).toBeNull();
    expect(parseCellarSlot('Casier B3')).toBeNull();
    expect(parseCellarSlot('Rangée trois')).toBeNull();
    expect(parseCellarSlot('Cave — casier B3')).toBeNull();
    expect(parseCellarSlot('Rangée 1 · Étage 2')).toBeNull();
    expect(parseCellarSlot('Rangée 1 · Rangée 2')).toBeNull(); // doublon
  });
});

describe('extraction sûre des attributs', () => {
  it('attributeString / attributeNumber valident le type', () => {
    const i = item({ attributes: { vintage: 2016, type: ' 5 Francs Semeuse ', bad: {} } });
    expect(attributeNumber(i, 'vintage')).toBe(2016);
    expect(attributeNumber(i, 'type')).toBeNull();
    expect(attributeString(i, 'type')).toBe('5 Francs Semeuse');
    expect(attributeString(i, 'vintage')).toBeNull();
    expect(attributeString(i, 'bad')).toBeNull();
    expect(attributeString(i, 'absent')).toBeNull();
  });

  it('coinGradeLabel : attributes.grade prioritaire, sinon analysis.grade.value', () => {
    expect(coinGradeLabel(item({ attributes: { grade: 'TTB' } }))).toBe('TTB');
    expect(
      coinGradeLabel(
        item({ attributes: { analysis: { grade: { scale: 'fr', value: 'SUP' } } } }),
      ),
    ).toBe('SUP');
    expect(coinGradeLabel(item({ attributes: {} }))).toBeNull();
  });

  it("artEstimatedPeriod et artAttributionQualifier lisent l'analyse en repli", () => {
    const analysed = item({
      attributes: {
        analysis: {
          identification: { estimatedPeriod: 'fin XIXe', attributionQualifier: 'ecole_de' },
        },
      },
    });
    expect(artEstimatedPeriod(analysed)).toBe('fin XIXe');
    expect(artAttributionQualifier(analysed)).toBe('ecole_de');
    // Qualificatif inconnu → null (jamais de clé i18n cassée).
    expect(
      artAttributionQualifier(item({ attributes: { attributionQualifier: 'invente' } })),
    ).toBeNull();
  });

  it('stampConditionStatus ne retourne que des états connus', () => {
    expect(
      stampConditionStatus(
        item({ attributes: { analysis: { condition: { status: 'oblitere' } } } }),
      ),
    ).toBe('oblitere');
    expect(stampConditionStatus(item({ attributes: { status: 'sur_lettre' } }))).toBe(
      'sur_lettre',
    );
    expect(stampConditionStatus(item({ attributes: { status: 'nawak' } }))).toBeNull();
    expect(stampConditionStatus(item({ attributes: {} }))).toBeNull();
  });
});
