import { describe, expect, it } from 'vitest';
import type { ListingRecord } from '@velum/core';

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
  parseCommunityParams,
  priceRangeIssue,
  sellPickerHref,
  stringParam,
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
