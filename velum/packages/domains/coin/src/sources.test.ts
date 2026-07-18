import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import type { Transport } from './sources/transport.ts';
import { ageDaysFromIso } from './sources/transport.ts';
import { NumistaSource } from './sources/numista.ts';
import { PcgsSource } from './sources/pcgs.ts';
import { NgcSource } from './sources/ngc.ts';
import { EbaySoldSource } from './sources/ebaySold.ts';
import { CatawikiSource } from './sources/catawiki.ts';
import { HeritageSource } from './sources/heritage.ts';
import { CgbSource } from './sources/cgb.ts';

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
  domain: 'coin',
  label: 'France 5 Francs Semeuse 1960',
  attributes: { type: '5 Francs Semeuse', year: 1960 },
  condition: 'TTB',
  limit: 20,
};

describe('ageDaysFromIso', () => {
  it('convertit une date ISO en jours entiers via l’horloge injectée', () => {
    expect(ageDaysFromIso('2026-07-10T00:00:00Z', NOW)).toBe(0);
    expect(ageDaysFromIso('2026-06-30T00:00:00Z', NOW)).toBe(10);
    expect(ageDaysFromIso('2026-06-15T10:30:00.000Z', NOW)).toBe(24);
    expect(ageDaysFromIso('2027-01-01T00:00:00Z', NOW)).toBeNull(); // futur lointain → rejeté
  });

  it('retourne null pour une date absente ou illisible', () => {
    expect(ageDaysFromIso(undefined, NOW)).toBeNull();
    expect(ageDaysFromIso('pas une date', NOW)).toBeNull();
    expect(ageDaysFromIso('', NOW)).toBeNull();
  });
});

describe('NumistaSource', () => {
  const fixture = {
    types: [
      {
        id: 2506,
        title: '5 francs Semeuse (argent)',
        prices: [
          { grade: 'TTB', value: 14.5, currency: 'EUR', date: '2026-06-01' },
          { grade: 'SUP', value: 25, currency: 'EUR', date: '2026-06-01' }, // filtré (condition TTB)
        ],
      },
    ],
  };

  it('construit la requête type+année avec clé API et mappe la cote du grade demandé', async () => {
    const transport = new FakeTransport(fixture);
    const source = new NumistaSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.numista.com/api/v3/types');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'France 5 Francs Semeuse 1960',
      category: 'coin',
      year: '1960',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ 'Numista-API-Key': 'secret' });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      price: 14.5,
      currency: 'EUR',
      ageDays: 39, // 2026-06-01 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
      source: { name: 'Numista', kind: 'official_quote', url: 'https://api.numista.com/api/v3/types' },
      matchedLabel: '5 francs Semeuse (argent) (TTB)',
    });
  });

  it('réponse vide ou invalide → []', async () => {
    expect(await new NumistaSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new NumistaSource({ transport: new FakeTransport({ types: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new NumistaSource({ transport: new FakeTransport('oops'), now: NOW }).fetch(QUERY)).toEqual([]);
  });

  it('transport en échec → [] (jamais de throw)', async () => {
    const source = new NumistaSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

describe('PcgsSource', () => {
  const fixture = {
    CoinTitle: '1904-O Morgan Dollar',
    Grade: 'MS65',
    PriceGuideValue: 450,
    Currency: 'USD',
    LastUpdated: '2026-06-20T00:00:00Z',
  };

  it('mappe la cote par grade (objet unique) avec ageDays correct', async () => {
    const transport = new FakeTransport(fixture);
    const source = new PcgsSource({ transport, apiKey: 'k', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.init?.query).toEqual({ q: QUERY.label, grade: 'TTB' });
    expect(transport.calls[0]?.init?.headers).toEqual({ authorization: 'bearer k' });
    expect(observations).toEqual([
      {
        price: 450,
        currency: 'USD',
        ageDays: 20,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
        source: {
          name: 'PCGS Price Guide',
          kind: 'official_quote',
          url: 'https://api.pcgs.com/publicapi/priceguide/GetPriceByGrade',
        },
        matchedLabel: '1904-O Morgan Dollar (MS65)',
      },
    ]);
  });

  it('date de mise à jour absente → cote du jour (ageDays 0)', async () => {
    const source = new PcgsSource({
      transport: new FakeTransport({ PriceGuideValue: 100, Currency: 'USD' }),
      now: NOW,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('réponse sans cote ou en échec → []', async () => {
    expect(await new PcgsSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new PcgsSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('NgcSource', () => {
  const fixture = {
    results: [
      { description: 'France 5F 1960 Semeuse', grade: 'MS64', price: 320, currency: 'USD', asOf: '2026-06-01' },
    ],
  };

  it('mappe les cotes NGC', async () => {
    const source = new NgcSource({ transport: new FakeTransport(fixture), now: NOW });
    const observations = await source.fetch(QUERY);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(320);
    expect(observations[0]?.currency).toBe('USD');
    expect(observations[0]?.ageDays).toBe(39);
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.official_quote);
    expect(observations[0]?.source.kind).toBe('official_quote');
    expect(observations[0]?.matchedLabel).toBe('France 5F 1960 Semeuse (MS64)');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new NgcSource({ transport: new FakeTransport({ results: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new NgcSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('EbaySoldSource', () => {
  const fixture = {
    itemSales: [
      {
        title: '5 francs Semeuse 1960 argent TTB',
        lastSoldDate: '2026-06-15T10:30:00.000Z',
        lastSoldPrice: { value: '12.50', currency: 'EUR' },
      },
      { title: 'vente non datée', lastSoldPrice: { value: '99', currency: 'EUR' } }, // ignorée
    ],
  };

  it('mappe les ventes réalisées (prix en chaîne, date → ageDays)', async () => {
    const transport = new FakeTransport(fixture);
    const source = new EbaySoldSource({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      category_ids: '11116',
      limit: '20',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });

    expect(observations).toHaveLength(1); // la vente sans date est écartée
    expect(observations[0]).toEqual({
      price: 12.5,
      currency: 'EUR',
      ageDays: 24,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.marketplace_sold,
      source: {
        name: 'eBay sold',
        kind: 'marketplace_sold',
        url: 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search',
      },
      matchedLabel: '5 francs Semeuse 1960 argent TTB',
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
        title: 'France - 5 Francs Semeuse 1960 - Argent',
        sold_at: '2026-05-30',
        sold_price: { amount: 55, currency: 'EUR' },
      },
    ],
  };

  it('mappe les lots adjugés', async () => {
    const source = new CatawikiSource({ transport: new FakeTransport(fixture), now: NOW });
    const observations = await source.fetch(QUERY);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(55);
    expect(observations[0]?.ageDays).toBe(41); // 2026-05-30 → 2026-07-10
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.marketplace_sold);
    expect(observations[0]?.source.kind).toBe('marketplace_sold');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new CatawikiSource({ transport: new FakeTransport({ lots: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new CatawikiSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('HeritageSource', () => {
  const fixture = {
    results: [
      {
        lotTitle: 'France. 5 Francs 1960 Semeuse, MS65 NGC',
        saleDate: '2026-04-12',
        realizedPrice: 1200,
        currency: 'USD',
      },
    ],
  };

  it('mappe les prix réalisés en vente (poids 1.0)', async () => {
    const source = new HeritageSource({ transport: new FakeTransport(fixture), now: NOW });
    const observations = await source.fetch(QUERY);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(1200);
    expect(observations[0]?.currency).toBe('USD');
    expect(observations[0]?.ageDays).toBe(89); // 2026-04-12 → 2026-07-10
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.auction_realized);
    expect(observations[0]?.source.kind).toBe('auction_realized');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new HeritageSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new HeritageSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('CgbSource', () => {
  const fixture = {
    items: [
      { name: '5 francs Semeuse 1960 - TTB', price: 95, currency: 'EUR', listed_at: '2026-07-01' },
    ],
  };

  it('mappe les annonces en cours (kind listing, poids 0.4)', async () => {
    const source = new CgbSource({ transport: new FakeTransport(fixture), now: NOW });
    const observations = await source.fetch(QUERY);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(95);
    expect(observations[0]?.ageDays).toBe(9); // 2026-07-01 → 2026-07-10
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.listing);
    expect(observations[0]?.source.kind).toBe('listing');
    expect(observations[0]?.matchedLabel).toBe('5 francs Semeuse 1960 - TTB');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new CgbSource({ transport: new FakeTransport({ items: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new CgbSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});
