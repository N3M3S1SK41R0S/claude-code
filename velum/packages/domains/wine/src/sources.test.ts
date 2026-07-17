import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import { CavissimaSource } from './sources/cavissima.ts';
import { IdealwineSource } from './sources/idealwine.ts';
import { VivinoSource } from './sources/vivino.ts';
import { WineSearcherSource } from './sources/wineSearcher.ts';
import type { Transport } from './transport.ts';

// ── FakeTransport ────────────────────────────────────────────────────────────

interface TransportCall {
  url: string;
  init?: { headers?: Record<string, string>; query?: Record<string, string> };
}

class FakeTransport implements Transport {
  readonly calls: TransportCall[] = [];

  constructor(
    private readonly payload: unknown,
    private readonly shouldThrow = false,
  ) {}

  async getJson(url: string, init?: TransportCall['init']): Promise<unknown> {
    this.calls.push({ url, init });
    if (this.shouldThrow) throw new Error('réseau indisponible');
    return this.payload;
  }
}

/** Horloge fixe pour des ageDays déterministes. */
const NOW = (): Date => new Date('2026-07-10T00:00:00Z');

const QUERY: PriceQuery = {
  domain: 'wine',
  label: 'clos rougeard bourg 2014',
  attributes: { vintage: 2014 },
  condition: 'bon état',
  limit: 5,
};

// ── Wine-Searcher (official_quote) ───────────────────────────────────────────

describe('WineSearcherSource', () => {
  it('mappe la réponse documentée vers PriceObservation[] avec ageDays exact', async () => {
    const transport = new FakeTransport({
      results: [
        {
          name: 'Clos Rougeard Le Bourg 2014',
          price: 310.5,
          currency: 'EUR',
          updated: '2026-06-10T00:00:00Z', // 30 jours avant NOW
          url: 'https://www.wine-searcher.com/find/clos-rougeard-le-bourg-2014',
        },
        { name: 'entrée sans prix' }, // invalide → ignorée
      ],
    });
    const source = new WineSearcherSource({ transport, apiKey: 'ws-key', now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toEqual([
      {
        price: 310.5,
        currency: 'EUR',
        ageDays: 30,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
        source: {
          name: 'Wine-Searcher',
          kind: 'official_quote',
          url: 'https://www.wine-searcher.com/find/clos-rougeard-le-bourg-2014',
        },
        matchedLabel: 'Clos Rougeard Le Bourg 2014',
      },
    ]);

    const call = transport.calls[0];
    expect(call?.url).toBe('https://api.wine-searcher.com/v1/prices');
    expect(call?.init?.query).toEqual({ query: 'clos rougeard bourg 2014', vintage: '2014', limit: '5' });
    expect(call?.init?.headers).toEqual({ 'x-api-key': 'ws-key' });
  });

  it('réponse vide ou de forme inattendue → []', async () => {
    const empty = new WineSearcherSource({ transport: new FakeTransport({ results: [] }), now: NOW });
    expect(await empty.fetch(QUERY)).toEqual([]);

    const malformed = new WineSearcherSource({ transport: new FakeTransport('pas du JSON attendu'), now: NOW });
    expect(await malformed.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → [] (jamais de throw)', async () => {
    const source = new WineSearcherSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── iDealwine (auction_realized) ─────────────────────────────────────────────

describe('IdealwineSource', () => {
  it('mappe les adjudications avec le poids maximal (ventes réalisées)', async () => {
    const transport = new FakeTransport({
      adjudications: [
        {
          label: 'Clos Rougeard Le Bourg 2014',
          hammerPrice: 310,
          currency: 'EUR',
          saleDate: '2026-07-05', // 5 jours avant NOW
          lotUrl: 'https://www.idealwine.com/fr/acheter-du-vin/lot-123.jsp',
        },
      ],
    });
    const source = new IdealwineSource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 310,
      currency: 'EUR',
      ageDays: 5,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.auction_realized,
      source: {
        name: 'iDealwine',
        kind: 'auction_realized',
        url: 'https://www.idealwine.com/fr/acheter-du-vin/lot-123.jsp',
      },
      matchedLabel: 'Clos Rougeard Le Bourg 2014',
    });
    expect(transport.calls[0]?.init?.query).toEqual({ q: 'clos rougeard bourg 2014', limit: '5' });
  });

  it('réponse vide → []', async () => {
    const source = new IdealwineSource({ transport: new FakeTransport({ adjudications: [] }), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Vivino (listing) ─────────────────────────────────────────────────────────

describe('VivinoSource', () => {
  it('mappe les annonces en cours avec le poids listing', async () => {
    const transport = new FakeTransport({
      listings: [
        {
          wine: 'Clos Rougeard Le Bourg 2014',
          amount: 355.9,
          currency: 'USD',
          listedAt: '2026-07-09T00:00:00Z', // 1 jour avant NOW
          url: 'https://www.vivino.com/FR/fr/w/123456',
        },
      ],
    });
    const source = new VivinoSource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 355.9,
      currency: 'USD',
      ageDays: 1,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.listing,
      source: { name: 'Vivino', kind: 'listing', url: 'https://www.vivino.com/FR/fr/w/123456' },
      matchedLabel: 'Clos Rougeard Le Bourg 2014',
    });
  });

  it('réponse de forme inattendue → []', async () => {
    const source = new VivinoSource({ transport: new FakeTransport({ autreChamp: true }), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Cavissima (listing, EUR exclusivement) ───────────────────────────────────

describe('CavissimaSource', () => {
  it('mappe le catalogue (toujours EUR) et ignore les prix invalides', async () => {
    const transport = new FakeTransport({
      items: [
        {
          title: 'Clos Rougeard Le Bourg 2014',
          priceEur: 340,
          publishedAt: '2026-06-20', // 20 jours avant NOW
          url: 'https://www.cavissima.com/vin/clos-rougeard-le-bourg-2014',
        },
        { title: 'prix négatif', priceEur: -5, publishedAt: '2026-06-20' }, // ignoré
      ],
    });
    const source = new CavissimaSource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 340,
      currency: 'EUR',
      ageDays: 20,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.listing,
      source: {
        name: 'Cavissima',
        kind: 'listing',
        url: 'https://www.cavissima.com/vin/clos-rougeard-le-bourg-2014',
      },
      matchedLabel: 'Clos Rougeard Le Bourg 2014',
    });
  });

  it('date absente ou illisible → observation ignorée', async () => {
    const transport = new FakeTransport({
      items: [
        { title: 'sans date', priceEur: 100 },
        { title: 'date illisible', priceEur: 120, publishedAt: 'date-invalide' },
      ],
    });
    const source = new CavissimaSource({ transport, now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → []', async () => {
    const source = new CavissimaSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});
