import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import type { Transport } from './sources/transport.ts';
import { HeritageSource } from './sources/heritage.ts';
import { WatchChartsSource } from './sources/watchCharts.ts';
import { EbaySoldSource } from './sources/ebaySold.ts';
import { CatawikiSource } from './sources/catawiki.ts';
import { Chrono24Source } from './sources/chrono24.ts';

const NOW = (): Date => new Date('2026-07-10T00:00:00Z');
type GetJsonInit = { headers?: Record<string, string>; query?: Record<string, string> };

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

class SequenceTransport implements Transport {
  readonly calls: { url: string; init?: GetJsonInit }[] = [];
  private readonly responses: unknown[];

  constructor(responses: unknown[]) {
    this.responses = [...responses];
  }

  async getJson(url: string, init?: GetJsonInit): Promise<unknown> {
    this.calls.push({ url, init });
    if (this.responses.length === 0) throw new Error('fixture épuisée');
    return this.responses.shift();
  }
}

class ConcurrentWatchChartsTransport implements Transport {
  active = 0;
  maximum = 0;
  calls = 0;

  async getJson(url: string): Promise<unknown> {
    this.active += 1;
    this.maximum = Math.max(this.maximum, this.active);
    this.calls += 1;
    await Promise.resolve();
    this.active -= 1;
    if (url.endsWith('/search/watch')) {
      return { success: true, results: [{ uuid: `watch-${this.calls}` }] };
    }
    return {
      brand: 'Rolex',
      collection: 'Submariner',
      model: '124060',
      market_price: 11500,
      updated: '2026-07-01',
    };
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
      { lotTitle: 'adjudication non datée', realizedPrice: 9000, currency: 'USD' },
    ],
  };

  it('interroge le département timepieces et mappe les adjudications', async () => {
    const transport = new FakeTransport(fixture);
    const source = new HeritageSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.ha.com/v1/search/realized');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'Rolex Submariner 124060',
      department: 'timepieces',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ 'X-Api-Key': 'secret' });
    expect(observations).toEqual([
      {
        price: 11200,
        currency: 'USD',
        ageDays: 89,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.auction_realized,
        source: {
          name: 'Heritage Auctions',
          kind: 'auction_realized',
          url: 'https://api.ha.com/v1/search/realized',
        },
        matchedLabel: 'Rolex Submariner 124060, 2022, full set',
      },
    ]);
  });

  it('réponse vide ou en échec → []', async () => {
    expect(
      await new HeritageSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new HeritageSource({ transport: new FakeTransport({ results: [] }), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new HeritageSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY),
    ).toEqual([]);
  });
});

describe('WatchChartsSource', () => {
  const searchFixture = {
    success: true,
    results: [{ uuid: 'watch-uuid', model: '124060', confidence: 3, variants: [] }],
  };
  const infoFixture = {
    brand: 'Rolex',
    collection: 'Submariner',
    model: '124060',
    market_price: 11500,
    updated: '2026-07-01',
  };

  it('résout l’UUID puis lit la cote avec x-api-key et respecte le débit', async () => {
    const transport = new SequenceTransport([searchFixture, infoFixture]);
    const waits: number[] = [];
    const source = new WatchChartsSource({
      transport,
      apiKey: 'secret',
      now: NOW,
      wait: async (milliseconds) => {
        waits.push(milliseconds);
      },
    });
    const observations = await source.fetch(QUERY);

    expect(transport.calls).toHaveLength(2);
    expect(transport.calls[0]).toEqual({
      url: 'https://api.watchcharts.com/v3/search/watch',
      init: {
        headers: { 'x-api-key': 'secret' },
        query: { brand_name: 'Rolex', reference: '124060', exact_match: 'true' },
      },
    });
    expect(transport.calls[1]).toEqual({
      url: 'https://api.watchcharts.com/v3/watch/info',
      init: {
        headers: { 'x-api-key': 'secret' },
        query: { uuid: 'watch-uuid', currency: 'EUR' },
      },
    });
    expect(waits).toEqual([1100, 1100]);
    expect(observations).toEqual([
      {
        price: 11500,
        currency: 'EUR',
        ageDays: 9,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
        source: {
          name: 'WatchCharts',
          kind: 'official_quote',
          url: 'https://api.watchcharts.com/v3/watch/info',
        },
        matchedLabel: 'Rolex Submariner 124060',
      },
    ]);
  });

  it('sérialise deux instances partageant la même clé', async () => {
    const transport = new ConcurrentWatchChartsTransport();
    const options = {
      transport,
      apiKey: 'shared-concurrency-key',
      now: NOW,
      wait: async () => undefined,
    };
    const first = new WatchChartsSource(options);
    const second = new WatchChartsSource(options);

    const [firstResult, secondResult] = await Promise.all([
      first.fetch(QUERY),
      second.fetch(QUERY),
    ]);

    expect(firstResult).toHaveLength(1);
    expect(secondResult).toHaveLength(1);
    expect(transport.calls).toBe(4);
    expect(transport.maximum).toBe(1);
  });

  it('date absente → cote du jour', async () => {
    const source = new WatchChartsSource({
      transport: new SequenceTransport([
        searchFixture,
        { brand: 'Omega', collection: 'Speedmaster', model: '3570.50', market_price: 5000 },
      ]),
      apiKey: 'secret-date',
      now: NOW,
      wait: async () => undefined,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('sans marque, référence ou clé, ne consomme aucun crédit', async () => {
    const transport = new SequenceTransport([searchFixture, infoFixture]);
    const noKey = new WatchChartsSource({ transport, now: NOW, wait: async () => undefined });
    expect(await noKey.fetch(QUERY)).toEqual([]);
    expect(
      await new WatchChartsSource({
        transport,
        apiKey: 'secret-missing-identity',
        now: NOW,
        wait: async () => undefined,
      }).fetch({
        domain: 'watch',
        label: 'Omega Speedmaster',
        attributes: {},
      }),
    ).toEqual([]);
    expect(transport.calls).toHaveLength(0);
  });

  it('applique aussi le cooldown après réponse vide, info invalide ou panne', async () => {
    const emptyWaits: number[] = [];
    const emptySource = new WatchChartsSource({
      transport: new SequenceTransport([{ success: true, results: [] }]),
      apiKey: 'secret-empty',
      now: NOW,
      wait: async (milliseconds) => {
        emptyWaits.push(milliseconds);
      },
    });
    expect(await emptySource.fetch(QUERY)).toEqual([]);
    expect(emptyWaits).toEqual([1100]);

    const invalidInfoWaits: number[] = [];
    const invalidInfoSource = new WatchChartsSource({
      transport: new SequenceTransport([searchFixture, {}]),
      apiKey: 'secret-invalid-info',
      now: NOW,
      wait: async (milliseconds) => {
        invalidInfoWaits.push(milliseconds);
      },
    });
    expect(await invalidInfoSource.fetch(QUERY)).toEqual([]);
    expect(invalidInfoWaits).toEqual([1100, 1100]);

    const failureWaits: number[] = [];
    const failureSource = new WatchChartsSource({
      transport: new FakeTransport(null, true),
      apiKey: 'secret-failure',
      now: NOW,
      wait: async (milliseconds) => {
        failureWaits.push(milliseconds);
      },
    });
    expect(await failureSource.fetch(QUERY)).toEqual([]);
    expect(failureWaits).toEqual([1100]);
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
      { title: 'vente non datée', lastSoldPrice: { value: '99', currency: 'EUR' } },
    ],
  };

  it('mappe les ventes réalisées avec la catégorie Wristwatches', async () => {
    const transport = new FakeTransport(fixture);
    const source = new EbaySoldSource({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      category_ids: '31387',
      limit: '20',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });
    expect(observations).toEqual([
      {
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
      },
    ]);
  });

  it('réponse vide ou en échec → []', async () => {
    expect(
      await new EbaySoldSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new EbaySoldSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY),
    ).toEqual([]);
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

  it('mappe les lots adjugés', async () => {
    const transport = new FakeTransport(fixture);
    const source = new CatawikiSource({ transport, now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.catawiki.com/v1/lots/sold');
    expect(transport.calls[0]?.init?.query).toEqual({ q: QUERY.label, category: 'watches' });
    expect(observations[0]?.price).toBe(2450);
    expect(observations[0]?.ageDays).toBe(41);
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.marketplace_sold);
    expect(observations[0]?.matchedLabel).toBe('Cartier - Tank Must - WSTA0041 - Unisexe - 2021');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(
      await new CatawikiSource({ transport: new FakeTransport({ lots: [] }), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new CatawikiSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY),
    ).toEqual([]);
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
      { title: 'annonce sans prix' },
    ],
  };

  it('mappe les annonces en cours avec le poids listing', async () => {
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
    expect(observations).toEqual([
      {
        price: 11900,
        currency: 'EUR',
        ageDays: 9,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.listing,
        source: {
          name: 'Chrono24',
          kind: 'listing',
          url: 'https://api.chrono24.com/v1/listings/search',
        },
        matchedLabel: 'Rolex Submariner 124060 — 2022 — full set',
      },
    ]);
  });

  it('date de publication absente → annonce du jour', async () => {
    const source = new Chrono24Source({
      transport: new FakeTransport({ listings: [{ price: { amount: 800, currency: 'EUR' } }] }),
      now: NOW,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('réponse vide ou en échec → []', async () => {
    expect(
      await new Chrono24Source({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new Chrono24Source({ transport: new FakeTransport({ listings: [] }), now: NOW }).fetch(QUERY),
    ).toEqual([]);
    expect(
      await new Chrono24Source({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY),
    ).toEqual([]);
  });
});
