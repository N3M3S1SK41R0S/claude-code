import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';
import {
  flattenSearchable,
  normalizeText,
  scoreDocument,
  searchEntries,
  searchItems,
  tokenize,
} from './search';

function item(overrides: Partial<VelumItem>): VelumItem {
  return {
    id: 'i',
    ownerId: 'o',
    domain: 'wine',
    title: null,
    attributes: {},
    confidence: null,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('normalizeText / tokenize', () => {
  it('ignore casse, accents et apostrophes typographiques', () => {
    expect(normalizeText('Château d’Yquem — Élégant')).toBe("chateau d'yquem elegant");
    expect(tokenize('  Côte   RÔTIE ')).toEqual(['cote', 'rotie']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('flattenSearchable', () => {
  it('indexe chaînes et nombres, ignore la fiche d’analyse volumineuse', () => {
    const flat = flattenSearchable({
      producer: 'Tempier',
      vintage: 2019,
      grapes: [{ name: 'Mourvèdre' }],
      analysis: { tasting: 'notes très longues' },
      disclaimers: ['x'],
    });
    expect(flat).toContain('Tempier');
    expect(flat).toContain('2019');
    expect(flat).toContain('Mourvèdre');
    expect(flat.join(' ')).not.toContain('notes très longues');
  });
});

describe('scoreDocument', () => {
  it('exige tous les mots (ET) et favorise le titre', () => {
    const doc = { title: 'Château Margaux 2015', fields: [{ appellation: 'Margaux' }] };
    expect(scoreDocument(doc, ['margaux', '2015'])).toBeGreaterThan(0);
    expect(scoreDocument(doc, ['margaux', '2016'])).toBe(0);
    const inTitle = scoreDocument(doc, ['margaux']);
    const onlyField = scoreDocument({ title: 'Grand vin', fields: [{ appellation: 'Margaux' }] }, ['margaux']);
    expect(inTitle).toBeGreaterThan(onlyField);
  });
});

describe('searchEntries / searchItems', () => {
  const items = [
    item({ id: 'a', title: 'Bandol Tempier 2019', attributes: { producer: 'Domaine Tempier' } }),
    item({ id: 'b', title: 'Château Margaux 2015', storageLocation: 'Casier B3' }),
    item({ id: 'c', domain: 'coin', title: '20 Francs Napoléon III', attributes: { metal: 'or' } }),
  ];

  it('requête vide → tout, ordre d’origine', () => {
    expect(searchItems(items, '').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('trouve par champ secondaire (emplacement) et par attribut', () => {
    expect(searchItems(items, 'casier b3').map((i) => i.id)).toEqual(['b']);
    expect(searchItems(items, 'or').map((i) => i.id)).toEqual(['c']);
  });

  it('un mot très court ne correspond qu’en début de mot (« or » ≠ « Bordeaux »)', () => {
    const wines = [item({ id: 'x', title: 'Bordeaux supérieur' }), item({ id: 'y', title: 'Louis d’or' })];
    expect(searchItems(wines, 'or').map((i) => i.id)).toEqual(['y']);
  });

  it('filtre par domaine', () => {
    expect(searchItems(items, '', 'coin').map((i) => i.id)).toEqual(['c']);
    expect(searchItems(items, 'tempier', 'coin')).toEqual([]);
  });

  it('classe le titre avant les autres champs, tri stable à égalité', () => {
    const docs = [
      { title: 'Autre', tag: 'margaux' },
      { title: 'Margaux', tag: '' },
    ];
    const found = searchEntries(docs, 'margaux', (d) => ({ title: d.title, fields: [d.tag] }));
    expect(found.map((d) => d.title)).toEqual(['Margaux', 'Autre']);
  });
});
