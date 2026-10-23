import { describe, expect, it } from 'vitest';
import { VelumError, type CatalogueListing, type ListingRecord } from '@velum/core';

import {
  DEFAULT_CATALOGUE_FILTERS,
  MARKET_DOMAINS,
  activeFilterCount,
  buildCatalogueQuery,
  catalogueViewOfMine,
  communityActivityHref,
  communityKeys,
  findCatalogueListing,
  isVelumDomain,
  lookupListing,
  parseCommunityParams,
  priceRangeIssue,
  sellPickerHref,
  stringParam,
  type ListingLookupDeps,
} from './marketQuery';

describe('buildCatalogueQuery', () => {
  it('filtres par défaut : seul le tri est transmis', () => {
    expect(buildCatalogueQuery(DEFAULT_CATALOGUE_FILTERS)).toEqual({ sort: 'recent' });
  });

  it('transmet catégorie, mode, texte nettoyé, prix FR et certifiés', () => {
    expect(
      buildCatalogueQuery({
        domain: 'coin',
        mode: 'exchange',
        text: '  napoléon   or ',
        minPrice: '100',
        maxPrice: '1 250,50',
        certifiedOnly: true,
        sort: 'price_asc',
      }),
    ).toEqual({
      domain: 'coin',
      mode: 'exchange',
      text: 'napoléon or',
      minPrice: 100,
      maxPrice: 1250.5,
      certifiedOnly: true,
      sort: 'price_asc',
    });
  });

  it('ignore les montants invalides et remet une fourchette inversée dans l’ordre', () => {
    expect(
      buildCatalogueQuery({ ...DEFAULT_CATALOGUE_FILTERS, minPrice: 'abc', maxPrice: '300' }),
    ).toEqual({ sort: 'recent', maxPrice: 300 });
    expect(
      buildCatalogueQuery({ ...DEFAULT_CATALOGUE_FILTERS, minPrice: '900', maxPrice: '200' }),
    ).toEqual({ sort: 'recent', minPrice: 200, maxPrice: 900 });
    expect(buildCatalogueQuery({ ...DEFAULT_CATALOGUE_FILTERS, minPrice: '0' })).toEqual({ sort: 'recent' });
  });

  it('signale les saisies de prix problématiques', () => {
    expect(priceRangeIssue({ minPrice: '', maxPrice: '' })).toBeNull();
    expect(priceRangeIssue({ minPrice: 'x', maxPrice: '' })).toBe('invalid_min');
    expect(priceRangeIssue({ minPrice: '', maxPrice: '-3' })).toBe('invalid_max');
    expect(priceRangeIssue({ minPrice: '500', maxPrice: '100' })).toBe('min_above_max');
    expect(priceRangeIssue({ minPrice: '100', maxPrice: '500' })).toBeNull();
  });

  it('compte les filtres avancés actifs', () => {
    expect(activeFilterCount(DEFAULT_CATALOGUE_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_CATALOGUE_FILTERS, minPrice: '10', certifiedOnly: true, sort: 'price_desc' }),
    ).toBe(3);
  });
});

describe('paramètres de route du hub', () => {
  it('lit et valide domain / mode / text / tab', () => {
    expect(parseCommunityParams({ domain: 'stamp', mode: 'exchange', text: 'cérès', tab: 'activity' })).toEqual({
      domain: 'stamp',
      mode: 'exchange',
      text: 'cérès',
      tab: 'activity',
    });
    expect(parseCommunityParams({ domain: 'car', mode: 'rent', tab: 'x' })).toEqual({
      domain: null,
      mode: 'all',
      text: '',
      tab: 'catalogue',
    });
    expect(parseCommunityParams({ domain: ['wine', 'coin'] }).domain).toBe('wine');
  });

  it('valide un paramètre texte et les domaines', () => {
    expect(stringParam(undefined)).toBeNull();
    expect(stringParam('  ')).toBeNull();
    expect(stringParam(['id-1'])).toBe('id-1');
    expect(isVelumDomain('watch')).toBe(true);
    expect(isVelumDomain('toString')).toBe(false);
    expect(MARKET_DOMAINS).toEqual(['wine', 'coin', 'art', 'stamp', 'watch']);
  });

  it('construit les liens internes du chantier', () => {
    expect(communityActivityHref()).toBe('/community?tab=activity');
    expect(sellPickerHref()).toBe('/community/sell');
    expect(sellPickerHref('coin')).toBe('/community/sell?domain=coin');
  });
});

describe('cache des annonces', () => {
  const listing = {
    id: 'l-2',
    kind: 'sale',
    domain: 'stamp',
    title: 'Bloc CITEX',
    description: null,
    askPrice: 780,
    currency: 'EUR',
    exchangeWishes: null,
    sellerAlias: 'Collectionneuse B21C',
    certified: true,
    isMine: false,
    createdAt: '2026-07-03T00:00:00Z',
  };

  it('retrouve une annonce par id dans des pages hétérogènes', () => {
    expect(findCatalogueListing([undefined, [{ id: 'l-2' }], [listing]], 'l-2')).toEqual(listing);
    expect(findCatalogueListing([[listing]], 'absente')).toBeNull();
    expect(findCatalogueListing([null, 'x'], 'l-2')).toBeNull();
  });

  it('clés React Query sous la racine community', () => {
    expect(communityKeys.catalogue({ domain: 'coin' })).toEqual(['community', 'catalogue', { domain: 'coin' }]);
    expect(communityKeys.messages('order', 'o1')).toEqual(['community', 'messages', 'order', 'o1']);
  });

  it('présente ma propre annonce comme une entrée du catalogue', () => {
    const rec: ListingRecord = {
      id: 'mine-1',
      itemId: 'it-1',
      sellerId: 'me',
      askPrice: 40,
      currency: 'EUR',
      status: 'active',
      title: 'Semeuse',
      domain: 'coin',
      kind: 'exchange',
      description: 'desc',
      exchangeWishes: 'Cérès',
      commissionRate: 0.05,
      certificationRequired: false,
      certified: false,
      createdAt: '2026-10-01T00:00:00Z',
    };
    const view = catalogueViewOfMine(rec, 'Vous');
    expect(view.isMine).toBe(true);
    expect(view.sellerAlias).toBe('Vous');
    expect(view).not.toHaveProperty('sellerId');
    expect(view).not.toHaveProperty('itemId');
  });
});

describe('lookupListing — annonce par identifiant', () => {
  const other: CatalogueListing = {
    id: 'l-9',
    kind: 'sale_or_exchange',
    domain: 'coin',
    title: 'Napoléon III',
    description: null,
    askPrice: 320,
    currency: 'EUR',
    exchangeWishes: null,
    sellerAlias: 'Collectionneur 7F3A',
    certified: false,
    isMine: false,
    createdAt: '2026-07-08T00:00:00Z',
  };
  const mine: ListingRecord = {
    id: 'mine-1',
    itemId: 'it-1',
    sellerId: 'me',
    askPrice: 40,
    currency: 'EUR',
    status: 'pending_certification',
    title: 'Semeuse',
    domain: 'coin',
    kind: 'exchange',
    description: null,
    exchangeWishes: null,
    commissionRate: 0.05,
    certificationRequired: true,
    certified: false,
    createdAt: '2026-10-01T00:00:00Z',
  };
  const deps = (patch: Partial<ListingLookupDeps> = {}): ListingLookupDeps => ({
    cachedPages: [],
    catalogue: async () => [],
    myListings: async () => [mine],
    myAlias: 'Vous',
    ...patch,
  });
  const outage = new VelumError('SOURCE_UNAVAILABLE', 'panne');
  const failing = async (): Promise<CatalogueListing | null> => {
    throw outage;
  };

  it('retrouve une annonce HORS catalogue (réservée, vendue, échangée) par lecture directe', async () => {
    // Échange accepté : l'annonce est engagée, donc absente du catalogue.
    const calls: string[] = [];
    const found = await lookupListing(
      'l-9',
      deps({
        getListing: async (id) => (id === 'l-9' ? other : null),
        catalogue: async () => {
          calls.push('catalogue');
          return [];
        },
      }),
    );
    expect(found).toEqual({ listing: other, myStatus: null });
    expect(calls).toEqual([]); // le catalogue (50 plus récentes, actives) n'est plus la source
  });

  it('ma propre annonce : statut relu dans mes annonces', async () => {
    const found = await lookupListing('mine-1', deps({ getListing: async () => ({ ...other, id: 'mine-1', isMine: true }) }));
    expect(found?.myStatus).toBe('pending_certification');
    expect(found?.listing.isMine).toBe(true);
  });

  it('introuvable seulement si la lecture directe ET mes annonces n’en savent rien', async () => {
    expect(await lookupListing('absente', deps({ getListing: async () => null }))).toBeNull();
  });

  it('sans lecture directe (client historique) : repli sur le catalogue au plafond serveur', async () => {
    const queries: unknown[] = [];
    const found = await lookupListing(
      'l-9',
      deps({
        catalogue: async (q) => {
          queries.push(q);
          return [other];
        },
      }),
    );
    expect(found?.listing.id).toBe('l-9');
    expect(queries).toEqual([{ includeMine: true, limit: 100 }]);
  });

  it('lecture directe en panne : repli, puis l’ERREUR plutôt que « introuvable »', async () => {
    const viaFallback = await lookupListing('l-9', deps({ getListing: failing, catalogue: async () => [other] }));
    expect(viaFallback?.listing.id).toBe('l-9');
    await expect(lookupListing('l-9', deps({ getListing: failing }))).rejects.toBe(outage);
  });

  it('une annonce d’autrui déjà en cache est servie sans appel réseau', async () => {
    const found = await lookupListing('l-9', deps({ cachedPages: [[other]], getListing: failing }));
    expect(found?.listing).toEqual(other);
  });
});
