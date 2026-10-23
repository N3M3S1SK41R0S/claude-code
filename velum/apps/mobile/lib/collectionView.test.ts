import { describe, expect, it } from 'vitest';
import type { DrinkNowSuggestion, ValuationRecord, VelumItem } from '@velum/core';

import {
  buildCollectionView,
  carnetMatchesElsewhere,
  carnetSearch,
  collectionHref,
  drinkNowPreview,
  isOfflineWithoutData,
  groupByDomain,
  itemValue,
  parseCollectionSort,
  parseDomainParam,
  parseTextParam,
  showsResultCount,
  sortItems,
} from './collectionView';

function item(overrides: Partial<VelumItem> & { id: string }): VelumItem {
  return {
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

function valuation(itemId: string, central: number): ValuationRecord {
  return {
    id: `v-${itemId}`,
    itemId,
    central,
    ci80Low: central * 0.9,
    ci80High: central * 1.1,
    ci95Low: central * 0.8,
    ci95High: central * 1.2,
    reliability: 0.7,
    sources: [],
    valuedAt: '2026-01-01T00:00:00Z',
  };
}

const tempier = item({
  id: 'w1',
  title: 'Bandol Domaine Tempier 2016',
  attributes: { producer: 'Domaine Tempier', vintage: 2016 },
  storageLocation: 'Cave A — rangée 3',
  createdAt: '2026-03-01T00:00:00Z',
});
const leflaive = item({
  id: 'w2',
  title: 'Puligny-Montrachet Leflaive 2020',
  createdAt: '2026-05-01T00:00:00Z',
});
const semeuse = item({
  id: 'c1',
  domain: 'coin',
  title: '5 Francs Semeuse argent 1960',
  notes: 'Héritage de mon grand-père',
  createdAt: '2026-04-01T00:00:00Z',
});
const stamp = item({
  id: 's1',
  domain: 'stamp',
  title: 'Semeuse lignée 15c vert — YT 130',
  createdAt: '2026-02-01T00:00:00Z',
});
const untitled = item({ id: 'x1', domain: 'art', title: null, createdAt: 'pas une date' });

const ITEMS = [tempier, leflaive, semeuse, stamp, untitled];
const ORDER = ['wine', 'coin', 'art', 'stamp', 'watch'] as const;
const LATEST: Record<string, ValuationRecord | null> = {
  w1: valuation('w1', 120),
  w2: valuation('w2', 450),
  c1: valuation('c1', 18),
  s1: null,
};

describe('paramètres de route', () => {
  it('tri inconnu → récent ; domaine inconnu ou inactif → null ; texte borné', () => {
    expect(parseCollectionSort('value_desc')).toBe('value_desc');
    expect(parseCollectionSort('prix')).toBe('recent');
    expect(parseCollectionSort(undefined)).toBe('recent');
    expect(parseDomainParam('coin', ORDER)).toBe('coin');
    expect(parseDomainParam(['stamp', 'coin'], ORDER)).toBe('stamp');
    expect(parseDomainParam('watch', ['wine', 'coin'])).toBeNull();
    expect(parseDomainParam('voiture', ORDER)).toBeNull();
    expect(parseTextParam(['margaux', 'x'])).toBe('margaux');
    expect(parseTextParam(42)).toBe('');
    expect(parseTextParam('a'.repeat(500))).toHaveLength(200);
  });
});

describe('itemValue', () => {
  it('ne transforme jamais une cote en panne en valeur', () => {
    expect(itemValue(tempier, LATEST)).toBe(120);
    expect(itemValue(stamp, LATEST)).toBeNull();
    expect(itemValue(untitled, LATEST)).toBeNull();
    expect(itemValue(tempier, LATEST, new Set(['w1']))).toBeNull();
  });
});

describe('sortItems', () => {
  it('récent : création la plus récente d’abord, dates invalides en dernier', () => {
    expect(sortItems(ITEMS, 'recent', LATEST).map((i) => i.id)).toEqual([
      'w2',
      'c1',
      'w1',
      's1',
      'x1',
    ]);
  });

  it('valeur ↓ : sans valeur (ou cote en panne) en dernier, départage par nom', () => {
    expect(sortItems(ITEMS, 'value_desc', LATEST).map((i) => i.id)).toEqual([
      'w2',
      'w1',
      'c1',
      's1',
      'x1',
    ]);
    // La panne de cote de w2 le fait passer avec les non valorisés.
    expect(sortItems(ITEMS, 'value_desc', LATEST, new Set(['w2'])).map((i) => i.id)).toEqual([
      'w1',
      'c1',
      'w2',
      's1',
      'x1',
    ]);
  });

  it('nom A→Z : sans accents ni casse, sans titre en dernier', () => {
    const ecole = item({ id: 'a2', title: 'École provençale' });
    const abbaye = item({ id: 'a3', title: 'abbaye de Lérins' });
    expect(sortItems([untitled, ecole, tempier, abbaye], 'name_asc', {}).map((i) => i.id)).toEqual(
      ['a3', 'w1', 'a2', 'x1'],
    );
  });

  it('est stable et ne modifie pas l’entrée', () => {
    const a = item({ id: 'a', title: 'Même nom' });
    const b = item({ id: 'b', title: 'même NOM' });
    const input = [a, b];
    expect(sortItems(input, 'name_asc', {}).map((i) => i.id)).toEqual(['a', 'b']);
    expect(sortItems([b, a], 'name_asc', {}).map((i) => i.id)).toEqual(['b', 'a']);
    expect(input.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('groupByDomain', () => {
  it('suit l’ordre des domaines actifs puis ajoute les domaines inattendus', () => {
    const groups = groupByDomain(ITEMS, ['coin', 'wine']);
    expect(groups.map((g) => g.domain)).toEqual(['coin', 'wine', 'stamp', 'art']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['w1', 'w2']);
  });
});

describe('buildCollectionView', () => {
  const base = { items: ITEMS, latestByItem: LATEST, domainOrder: ORDER, sort: 'recent' as const };

  it('collection vide ≠ aucun résultat', () => {
    expect(buildCollectionView({ ...base, items: [], query: '', domain: null })).toEqual({
      kind: 'empty',
    });
    expect(buildCollectionView({ ...base, query: 'introuvable', domain: null })).toEqual({
      kind: 'noResult',
      reason: 'query',
      query: 'introuvable',
      domain: null,
    });
    expect(buildCollectionView({ ...base, query: '  ', domain: 'watch' })).toEqual({
      kind: 'noResult',
      reason: 'domain',
      query: '',
      domain: 'watch',
    });
  });

  it('hors recherche : groupes par domaine triés, compteur seulement si filtré', () => {
    const all = buildCollectionView({ ...base, query: '', domain: null });
    expect(all.kind).toBe('grouped');
    if (all.kind !== 'grouped') return;
    expect(all.groups.map((g) => g.domain)).toEqual(['wine', 'coin', 'art', 'stamp']);
    expect(all.groups[0]?.items.map((i) => i.id)).toEqual(['w2', 'w1']);
    expect(all.count).toBe(5);
    expect(showsResultCount(all)).toBe(false);

    const wines = buildCollectionView({ ...base, query: '', domain: 'wine', sort: 'value_desc' });
    expect(wines.kind === 'grouped' && wines.groups.map((g) => g.domain)).toEqual(['wine']);
    expect(wines.kind === 'grouped' && wines.count).toBe(2);
    expect(showsResultCount(wines)).toBe(true);
  });

  it('recherche : liste à plat via titre, attributs, notes et emplacement', () => {
    const byLocation = buildCollectionView({ ...base, query: 'rangée 3', domain: null });
    expect(byLocation.kind === 'results' && byLocation.items.map((i) => i.id)).toEqual(['w1']);

    const byNotes = buildCollectionView({ ...base, query: 'grand-pere', domain: null });
    expect(byNotes.kind === 'results' && byNotes.items.map((i) => i.id)).toEqual(['c1']);

    const semeuses = buildCollectionView({ ...base, query: 'semeuse', domain: null, sort: 'name_asc' });
    expect(semeuses.kind === 'results' && semeuses.items.map((i) => i.id)).toEqual(['c1', 's1']);
    expect(showsResultCount(semeuses)).toBe(true);

    const scoped = buildCollectionView({ ...base, query: 'semeuse', domain: 'stamp' });
    expect(scoped.kind === 'results' && scoped.count).toBe(1);
  });
});

describe('drinkNowPreview', () => {
  const signal = (id: string): DrinkNowSuggestion => ({
    itemId: id,
    label: id,
    windowFrom: 2024,
    windowTo: 2030,
    suggestedDishes: [],
  });

  it('affiche les 3 premiers et compte le reste', () => {
    const preview = drinkNowPreview(['a', 'b', 'c', 'd', 'e'].map(signal));
    expect(preview.shown.map((s) => s.itemId)).toEqual(['a', 'b', 'c']);
    expect(preview.hidden).toBe(2);
    expect(preview.total).toBe(5);
    expect(drinkNowPreview([signal('a')]).hidden).toBe(0);
    expect(drinkNowPreview(['a', 'b'].map(signal), 0).shown).toHaveLength(2);
  });
});

describe('isOfflineWithoutData — lecture en pause hors-ligne', () => {
  it('pause sans donnée (ni cache) : état hors-ligne, jamais « vide »', () => {
    expect(isOfflineWithoutData({ fetchStatus: 'paused', data: undefined })).toBe(true);
  });

  it('cache disponible, chargement en cours ou lecture terminée : pas d’état hors-ligne', () => {
    expect(isOfflineWithoutData({ fetchStatus: 'paused', data: [] })).toBe(false);
    expect(isOfflineWithoutData({ fetchStatus: 'fetching', data: undefined })).toBe(false);
    expect(isOfflineWithoutData({ fetchStatus: 'idle', data: undefined })).toBe(false);
  });
});

describe('collectionHref', () => {
  it('pré-remplit recherche et catégorie, sans paramètre vide', () => {
    expect(collectionHref()).toBe('/(tabs)/collection');
    expect(collectionHref('  ', null)).toBe('/(tabs)/collection');
    expect(collectionHref('côte rôtie', 'wine')).toBe(
      '/(tabs)/collection?q=c%C3%B4te%20r%C3%B4tie&domain=wine',
    );
  });
});

describe('carnetSearch', () => {
  it('inactive sans requête', () => {
    const search = carnetSearch(ITEMS, '   ', 'wine', ORDER);
    expect(search.active).toBe(false);
    expect(search.items).toEqual([]);
    expect(carnetMatchesElsewhere(search)).toBe(0);
  });

  it('cherche dans un carnet et signale les correspondances ailleurs', () => {
    const search = carnetSearch(ITEMS, 'semeuse', 'wine', ORDER);
    expect(search.active).toBe(true);
    expect(search.items).toEqual([]);
    expect(search.countsByDomain).toEqual({ coin: 1, stamp: 1 });
    expect(search.total).toBe(2);
    expect(carnetMatchesElsewhere(search)).toBe(2);

    const inStamps = carnetSearch(ITEMS, 'semeuse', 'stamp', ORDER);
    expect(inStamps.items.map((i) => i.id)).toEqual(['s1']);
    expect(carnetMatchesElsewhere(inStamps)).toBe(1);
  });

  it('portée « tous les carnets » : groupes dans l’ordre des domaines', () => {
    const search = carnetSearch(ITEMS, 'semeuse', null, ORDER);
    expect(search.groups.map((g) => g.domain)).toEqual(['coin', 'stamp']);
    expect(carnetMatchesElsewhere(search)).toBe(0);
  });
});
