import { describe, expect, it } from 'vitest';
import {
  VelumError,
  type CatalogueListing,
  type VelumItem,
  type WishlistEntry,
} from '@velum/core';

import {
  CATALOGUE_SEARCH_LIMIT,
  catalogueAccess,
  catalogueQueryFor,
  catalogueRetry,
  catalogueSearchKey,
  classifyCatalogueError,
  globalSearchHref,
  globalSearchOutcome,
  globalSearchTotal,
  isSearchableQuery,
  localSectionState,
  marketSectionState,
  rankCatalogue,
  searchCollectionSection,
  searchWishlistSection,
  sliceSection,
  type SectionState,
} from './globalSearch';

function item(id: string, title: string, overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id,
    ownerId: 'o',
    domain: 'wine',
    title,
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

function wish(id: string, title: string, overrides: Partial<WishlistEntry> = {}): WishlistEntry {
  return {
    id,
    ownerId: 'o',
    domain: 'wine',
    kind: 'wish',
    title,
    notes: null,
    attributes: {},
    source: 'manual',
    sourceItemId: null,
    targetPrice: null,
    priority: 'medium',
    acquired: false,
    acquiredAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function listing(id: string, title: string, overrides: Partial<CatalogueListing> = {}): CatalogueListing {
  return {
    id,
    kind: 'sale',
    domain: 'coin',
    title,
    description: null,
    askPrice: 100,
    currency: 'EUR',
    exchangeWishes: null,
    sellerAlias: 'Collectionneur 7F3A',
    certified: false,
    isMine: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('liens et requêtes', () => {
  it('globalSearchHref encode la requête et omet une requête vide', () => {
    expect(globalSearchHref()).toBe('/search');
    expect(globalSearchHref('   ')).toBe('/search');
    expect(globalSearchHref(' napoléon or ')).toBe('/search?q=napol%C3%A9on%20or');
  });

  it('isSearchableQuery ignore les espaces et la ponctuation seule', () => {
    expect(isSearchableQuery('')).toBe(false);
    expect(isSearchableQuery(' ! ')).toBe(false);
    expect(isSearchableQuery('or')).toBe(true);
  });

  it('catalogueQueryFor : au moins 2 caractères utiles, espaces normalisés', () => {
    expect(catalogueQueryFor('a')).toBeNull();
    expect(catalogueQueryFor('  ')).toBeNull();
    expect(catalogueQueryFor('!!')).toBeNull();
    expect(catalogueQueryFor('  20   francs ')).toEqual({
      text: '20 francs',
      limit: CATALOGUE_SEARCH_LIMIT,
    });
  });

  it('catalogueSearchKey reste sous le préfixe « community » (invalidation commune)', () => {
    expect(catalogueSearchKey({ text: 'or' })[0]).toBe('community');
  });
});

describe('sliceSection', () => {
  it('tronque et signale le surplus ; limite invalide → défaut', () => {
    expect(sliceSection([1, 2, 3], 2)).toEqual({ results: [1, 2], total: 3, hasMore: true });
    expect(sliceSection([1, 2], 2)).toEqual({ results: [1, 2], total: 2, hasMore: false });
    expect(sliceSection([1, 2, 3, 4, 5, 6], 0).results).toHaveLength(5);
  });
});

describe('sections locales', () => {
  const items = [
    item('w1', 'Bandol Domaine Tempier 2016', { storageLocation: 'Cave A3' }),
    item('c1', '20 Francs Napoléon III', { domain: 'coin' }),
  ];

  it('collection : recherche locale (titre, emplacement) ; requête vide → rien', () => {
    expect(searchCollectionSection(items, 'tempier').results.map((i) => i.id)).toEqual(['w1']);
    expect(searchCollectionSection(items, 'cave a3').results.map((i) => i.id)).toEqual(['w1']);
    expect(searchCollectionSection(items, 'napoleon').results.map((i) => i.id)).toEqual(['c1']);
    expect(searchCollectionSection(items, '  ').total).toBe(0);
  });

  it('envies : notes et attributs indexés, envies acquises en dernier', () => {
    const entries = [
      wish('e1', 'Tempier La Tourtine 2019', { acquired: true }),
      wish('e2', 'Bandol rouge', { notes: 'Comme le Tempier goûté chez Paul' }),
      wish('e3', 'Coq or', { domain: 'coin', attributes: { metal: 'or' } }),
    ];
    expect(searchWishlistSection(entries, 'tempier').results.map((e) => e.id)).toEqual([
      'e2',
      'e1',
    ]);
    expect(searchWishlistSection(entries, 'or').results.map((e) => e.id)).toEqual(['e3']);
  });

  it('localSectionState : chargement, panne, puis résultats (cache conservé)', () => {
    const search = (data: VelumItem[], q: string) => searchCollectionSection(data, q);
    expect(localSectionState('', { status: 'pending' }, search)).toEqual({ status: 'idle' });
    expect(localSectionState('tempier', { status: 'pending' }, search)).toEqual({
      status: 'loading',
    });
    const boom = new Error('réseau');
    expect(localSectionState('tempier', { status: 'error', error: boom }, search)).toEqual({
      status: 'error',
      error: boom,
    });
    // Donnée en cache + rafraîchissement en échec : on garde les résultats.
    const cached = localSectionState('tempier', { status: 'error', error: boom, data: items }, search);
    expect(cached.status === 'ready' && cached.slice.total).toBe(1);
  });
});

describe('catalogue', () => {
  it('classifyCatalogueError distingue offre, fonction non câblée et panne', () => {
    expect(classifyCatalogueError(new VelumError('PLAN_REQUIRED', 'Platine'))).toBe('plan');
    expect(
      classifyCatalogueError(
        new VelumError('SOURCE_UNAVAILABLE', 'Catalogue par catégorie : fonction pas encore disponible'),
      ),
    ).toBe('notYetAvailable');
    expect(classifyCatalogueError(new VelumError('SOURCE_UNAVAILABLE', 'timeout'))).toBe('failed');
    expect(classifyCatalogueError(new Error('x'))).toBe('failed');
  });

  it('catalogueRetry : une relance pour une panne, aucune sinon', () => {
    expect(catalogueRetry(0, new Error('réseau'))).toBe(true);
    expect(catalogueRetry(1, new Error('réseau'))).toBe(false);
    expect(catalogueRetry(0, new VelumError('PLAN_REQUIRED', 'x'))).toBe(false);
    expect(
      catalogueRetry(0, new VelumError('SOURCE_UNAVAILABLE', 'fonction pas encore disponible')),
    ).toBe(false);
  });

  it('catalogueAccess dérive l’accès du plan sans jamais confondre panne et offre', () => {
    expect(catalogueAccess({ status: 'loading' })).toBe('loading');
    expect(catalogueAccess({ status: 'error' })).toBe('error');
    expect(catalogueAccess({ status: 'ready', community: false })).toBe('locked');
    expect(catalogueAccess({ status: 'ready', community: true })).toBe('open');
  });

  it('rankCatalogue classe par pertinence sans retirer les annonces du serveur', () => {
    const ranked = rankCatalogue(
      [
        listing('l1', 'Lot de pièces', { description: 'dont un Napoléon' }),
        listing('l2', 'Napoléon III 20 Francs Or 1868'),
        listing('l3', 'Annonce sans rapport apparent'),
      ],
      'napoleon',
    );
    expect(ranked.map((l) => l.id)).toEqual(['l2', 'l1', 'l3']);
  });

  it('marketSectionState : idle, plan, verrou, indisponible, résultats', () => {
    const data = [listing('l1', 'Napoléon III 20 Francs Or 1868')];
    const ok = { status: 'success' as const, data };
    expect(marketSectionState({ query: 'n', access: 'open', catalogue: ok })).toEqual({
      status: 'idle',
    });
    expect(marketSectionState({ query: 'napo', access: 'loading', catalogue: ok }).status).toBe(
      'loading',
    );
    const planError = new Error('profil');
    expect(
      marketSectionState({ query: 'napo', access: 'error', planError, catalogue: ok }),
    ).toEqual({ status: 'unavailable', issue: 'planError', error: planError });
    expect(marketSectionState({ query: 'napo', access: 'locked', catalogue: ok })).toEqual({
      status: 'locked',
    });
    expect(
      marketSectionState({
        query: 'napo',
        access: 'open',
        catalogue: { status: 'error', error: new VelumError('PLAN_REQUIRED', 'x') },
      }),
    ).toEqual({ status: 'locked' });
    const notWired = new VelumError('SOURCE_UNAVAILABLE', 'Catalogue : fonction pas encore disponible');
    expect(
      marketSectionState({
        query: 'napo',
        access: 'open',
        catalogue: { status: 'error', error: notWired },
      }),
    ).toEqual({ status: 'unavailable', issue: 'notYetAvailable', error: notWired });
    expect(
      marketSectionState({ query: 'napo', access: 'open', catalogue: { status: 'pending' } }).status,
    ).toBe('loading');
    const ready = marketSectionState({ query: 'napo', access: 'open', catalogue: ok });
    expect(ready.status === 'ready' && ready.slice.results.map((l) => l.id)).toEqual(['l1']);
  });
});

describe('verdict global', () => {
  const ready = (total: number): SectionState<unknown> => ({
    status: 'ready',
    slice: { results: [], total, hasMore: false },
  });

  it('idle sans requête ; résultats dès qu’une section trouve', () => {
    expect(globalSearchOutcome('', [ready(3)])).toBe('idle');
    expect(globalSearchOutcome('x', [ready(0), { status: 'loading' }, ready(2)])).toBe('results');
  });

  it('« aucun résultat » seulement si toutes les sections interrogeables ont répondu', () => {
    expect(globalSearchOutcome('x', [ready(0), ready(0), { status: 'locked' }])).toBe('noResult');
    expect(globalSearchOutcome('x', [ready(0), ready(0), { status: 'idle' }])).toBe('noResult');
    expect(
      globalSearchOutcome('x', [
        ready(0),
        ready(0),
        { status: 'unavailable', issue: 'notYetAvailable', error: null },
      ]),
    ).toBe('noResult');
  });

  it('une panne ou un chargement empêche d’affirmer « aucun résultat »', () => {
    expect(globalSearchOutcome('x', [ready(0), { status: 'loading' }])).toBe('loading');
    expect(globalSearchOutcome('x', [ready(0), { status: 'error', error: null }])).toBe('partial');
    expect(
      globalSearchOutcome('x', [ready(0), { status: 'unavailable', issue: 'failed', error: null }]),
    ).toBe('partial');
    expect(
      globalSearchOutcome('x', [ready(0), { status: 'unavailable', issue: 'planError', error: null }]),
    ).toBe('partial');
  });

  it('une panne seule n’est jamais présentée comme une recherche en cours', () => {
    // Collection prête à 0, envies en panne : plus rien ne charge → résultats partiels.
    expect(globalSearchOutcome('xyz', [ready(0), { status: 'error', error: new Error('boum') }, { status: 'idle' }])).toBe(
      'partial',
    );
    // Tant qu'une section charge encore, la recherche est en cours (même avec une panne ailleurs).
    expect(globalSearchOutcome('xyz', [{ status: 'loading' }, { status: 'error', error: null }])).toBe('loading');
  });

  it('globalSearchTotal additionne les sections prêtes', () => {
    expect(globalSearchTotal([ready(2), { status: 'loading' }, ready(5)])).toBe(7);
  });
});
