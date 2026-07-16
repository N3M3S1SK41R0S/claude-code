import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import type { Transport } from './sources/transport.ts';
import { HeritageSource } from './sources/heritage.ts';
import { WatchChartsSource } from './sources/watchCharts.ts';
import { EbaySoldSource } from './sources/ebaySold.ts';
import { CatawikiSource } from './sources/catawiki.ts';
import { Chrono24Source } from './sources/chrono24.ts';

/** Horloge fixe pour des ageDays déterministes. */
const NOW = (): Date => new Date('2026-07-10T00:00:00Z');

type GetJsonInit = { headers?: Record<string, string>; query?: Record<string, string> };

/** Fake transport : rejoue une fixture et enregistre les appels. */
class FakeTransport implements Transport {
  readonly calls: { url: string; init?: GetJsonInit }[] = [];

  constructor(
    private readonly response: unknown,
    private readonly fail = false,
  ) {}

  async getJson(url: string, init?: GetJsonInit): Promise<unknown> {
    this.calls.push({ url, init });
    if (this.fail) throw new Error('réseau indisponible');
    return this.response;
  }
}

const QUERY: PriceQuery = {
  domain: 'watch',
  label: 'Rolex Submariner 124060',
  attributes: { brand: 'Rolex', model: 'Submariner', reference: '124060', year: 2022 },
  limit: 20,
};

describe('HeritageSource', () => {
  const fixture = {
    results: [
      {
        lotTitle: 'Rolex Submariner 124060, 2022, full set',
        saleDate: '2026-04-12',
        realizedPrice: 11200,
        currency: 'USD',
      },
      { lotTitle: 'adjudication non datée', realizedPrice: 9000, currency: 'USD' }, // ignorée
    ],
  };

  it('interroge le département timepieces avec la clé API et mappe les adjudications', async () => {
    const transport = new FakeTransport(fixture);
    const source = new HeritageSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.ha.com/v1/search/realized');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'Rolex Submariner 124060',
      department: 'timepieces',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ 'X-Api-Key': 'secret' });

    expect(observations).toHaveLength(1); // l’adjudication sans date est écartée
    expect(observations[0]).toEqual({
      price: 11200,
      currency: 'USD',
      ageDays: 89, // 2026-04-12 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.auction_realized,
      source: {
        name: 'Heritage Auctions',
        kind: 'auction_realized',
        url: 'https://api.ha.com/v1/search/realized',
      },
      matchedLabel: 'Rolex Submariner 124060, 2022, full set',
    });
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new HeritageSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new HeritageSource({ transport: new FakeTransport({ results: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new HeritageSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('WatchChartsSource', () => {
  const fixture = {
    quotes: [
      {
        name: 'Rolex Submariner 124060',
        market_price: 11500,
        currency: 'EUR',
        updated_at: '2026-07-01',
      },
      { name: 'sans cote' }, // ignoré : pas de prix exploitable
    ],
  };

  it('construit la requête label+référence et mappe les cotes de marché', async () => {
    const transport = new FakeTransport(fixture);
    const source = new WatchChartsSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.watchcharts.com/v3/watch/price');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'Rolex Submariner 124060',
      reference: '124060',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer secret' });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      price: 11500,
      currency: 'EUR',
      ageDays: 9, // 2026-07-01 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
      source: {
        name: 'WatchCharts',
        kind: 'official_quote',
        url: 'https://api.watchcharts.com/v3/watch/price',
      },
      matchedLabel: 'Rolex Submariner 124060',
    });
  });

  it('date de mise à jour absente → cote du jour (ageDays 0)', async () => {
    const source = new WatchChartsSource({
      transport: new FakeTransport({ quotes: [{ market_price: 5000, currency: 'EUR' }] }),
      now: NOW,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('sans référence dans les attributs, la requête reste label seul', async () => {
    const transport = new FakeTransport({ quotes: [] });
    const source = new WatchChartsSource({ transport, now: NOW });
    await source.fetch({ domain: 'watch', label: 'Omega Speedmaster', attributes: {} });
    expect(transport.calls[0]?.init?.query).toEqual({ q: 'Omega Speedmaster' });
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new WatchChartsSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new WatchChartsSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('EbaySoldSource', () => {
  const fixture = {
    itemSales: [
      {
        title: 'Omega Speedmaster Professional 3570.50 full set',
        lastSoldDate: '2026-06-15T10:30:00.000Z',
        lastSoldPrice: { value: '4250.00', currency: 'EUR' },
      },
      { title: 'vente non datée', lastSoldPrice: { value: '99', currency: 'EUR' } }, // ignorée
    ],
  };

  it('mappe les ventes réalisées avec la catégorie eBay « Wristwatches »', async () => {
    const transport = new FakeTransport(fixture);
    const source = new EbaySoldSource({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      category_ids: '31387',
      limit: '20',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });

    expect(observations).toHaveLength(1); // la vente sans date est écartée
    expect(observations[0]).toEqual({
      price: 4250,
      currency: 'EUR',
      ageDays: 24,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.marketplace_sold,
      source: {
        name: 'eBay sold',
        kind: 'marketplace_sold',
        url: 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search',
      },
      matchedLabel: 'Omega Speedmaster Professional 3570.50 full set',
    });
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new EbaySoldSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new EbaySoldSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('CatawikiSource', () => {
  const fixture = {
    lots: [
      {
        title: 'Cartier - Tank Must - WSTA0041 - Unisexe - 2021',
        sold_at: '2026-05-30',
        sold_price: { amount: 2450, currency: 'EUR' },
      },
    ],
  };

  it('mappe les lots adjugés (catégorie watches)', async () => {
    const transport = new FakeTransport(fixture);
    const source = new CatawikiSource({ transport, now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.catawiki.com/v1/lots/sold');
    expect(transport.calls[0]?.init?.query).toEqual({ q: QUERY.label, category: 'watches' });

    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(2450);
    expect(observations[0]?.ageDays).toBe(41); // 2026-05-30 → 2026-07-10
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.marketplace_sold);
    expect(observations[0]?.source.kind).toBe('marketplace_sold');
    expect(observations[0]?.matchedLabel).toBe('Cartier - Tank Must - WSTA0041 - Unisexe - 2021');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new CatawikiSource({ transport: new FakeTransport({ lots: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new CatawikiSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('Chrono24Source', () => {
  const fixture = {
    listings: [
      {
        title: 'Rolex Submariner 124060 — 2022 — full set',
        listed_at: '2026-07-01',
        price: { amount: 11900, currency: 'EUR' },
      },
      { title: 'annonce sans prix' }, // ignorée
    ],
  };

  it('mappe les annonces en cours avec le poids « listing » (jamais dominant)', async () => {
    const transport = new FakeTransport(fixture);
    const source = new Chrono24Source({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.chrono24.com/v1/listings/search');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      reference: '124060',
      limit: '20',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      price: 11900,
      currency: 'EUR',
      ageDays: 9, // 2026-07-01 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.listing,
      source: {
        name: 'Chrono24',
        kind: 'listing',
        url: 'https://api.chrono24.com/v1/listings/search',
      },
      matchedLabel: 'Rolex Submariner 124060 — 2022 — full set',
    });
  });

  it('date de publication absente → annonce du jour (ageDays 0)', async () => {
    const source = new Chrono24Source({
      transport: new FakeTransport({ listings: [{ price: { amount: 800, currency: 'EUR' } }] }),
      now: NOW,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new Chrono24Source({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new Chrono24Source({ transport: new FakeTransport({ listings: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new Chrono24Source({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});
