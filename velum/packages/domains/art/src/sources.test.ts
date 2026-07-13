import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import { ArtpriceSource } from './sources/artprice.ts';
import { ArtsySource } from './sources/artsy.ts';
import { DrouotSource } from './sources/drouot.ts';
import { HeritageArtSource } from './sources/heritage.ts';
import { MagnusSource } from './sources/magnus.ts';
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
  domain: 'art',
  label: 'Eugène Boudin Plage de Trouville huile sur panneau',
  attributes: { artist: 'Eugène Boudin', dimensionsCm: { height: 24, width: 33 } },
  condition: 'bon état',
  limit: 5,
};

// ── Artprice (official_quote) ────────────────────────────────────────────────

describe('ArtpriceSource', () => {
  it('mappe la réponse documentée vers PriceObservation[] avec ageDays exact', async () => {
    const transport = new FakeTransport({
      quotes: [
        {
          work: 'Eugène Boudin — Plage de Trouville',
          price: 12500,
          currency: 'EUR',
          quotedAt: '2026-06-10T00:00:00Z', // 30 jours avant NOW
          url: 'https://www.artprice.com/artist/boudin/quote-123',
        },
        { work: 'entrée sans prix' }, // invalide → ignorée
      ],
    });
    const source = new ArtpriceSource({ transport, apiKey: 'ap-key', now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toEqual([
      {
        price: 12500,
        currency: 'EUR',
        ageDays: 30,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
        source: {
          name: 'Artprice',
          kind: 'official_quote',
          url: 'https://www.artprice.com/artist/boudin/quote-123',
        },
        matchedLabel: 'Eugène Boudin — Plage de Trouville',
      },
    ]);

    const call = transport.calls[0];
    expect(call?.url).toBe('https://api.artprice.com/v1/quotes');
    expect(call?.init?.query).toEqual({
      q: 'Eugène Boudin Plage de Trouville huile sur panneau',
      limit: '5',
    });
    expect(call?.init?.headers).toEqual({ 'x-api-key': 'ap-key' });
  });

  it('réponse vide ou de forme inattendue → []', async () => {
    const empty = new ArtpriceSource({ transport: new FakeTransport({ quotes: [] }), now: NOW });
    expect(await empty.fetch(QUERY)).toEqual([]);

    const malformed = new ArtpriceSource({ transport: new FakeTransport('pas du JSON attendu'), now: NOW });
    expect(await malformed.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → [] (jamais de throw)', async () => {
    const source = new ArtpriceSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Artsy (listing) ──────────────────────────────────────────────────────────

describe('ArtsySource', () => {
  it('mappe les annonces en cours avec le poids listing', async () => {
    const transport = new FakeTransport({
      listings: [
        {
          artwork: 'Eugène Boudin — Plage de Trouville',
          askPrice: 15800.5,
          currency: 'USD',
          listedAt: '2026-07-09T00:00:00Z', // 1 jour avant NOW
          permalink: 'https://www.artsy.net/artwork/boudin-plage',
        },
      ],
    });
    const source = new ArtsySource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 15800.5,
      currency: 'USD',
      ageDays: 1,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.listing,
      source: { name: 'Artsy', kind: 'listing', url: 'https://www.artsy.net/artwork/boudin-plage' },
      matchedLabel: 'Eugène Boudin — Plage de Trouville',
    });
  });

  it('réponse de forme inattendue → []', async () => {
    const source = new ArtsySource({ transport: new FakeTransport({ autreChamp: true }), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → []', async () => {
    const source = new ArtsySource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Drouot (auction_realized, EUR exclusivement) ─────────────────────────────

describe('DrouotSource', () => {
  it('mappe les adjudications (toujours EUR) avec le poids maximal', async () => {
    const transport = new FakeTransport({
      resultats: [
        {
          lot: 'Eugène Boudin — Plage de Trouville, huile sur panneau',
          adjudicationEur: 42000,
          dateVente: '2026-07-05', // 5 jours avant NOW
          url: 'https://www.drouot.com/l/12345-boudin-plage',
        },
        { lot: 'prix négatif', adjudicationEur: -5, dateVente: '2026-07-05' }, // ignoré
      ],
    });
    const source = new DrouotSource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 42000,
      currency: 'EUR',
      ageDays: 5,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.auction_realized,
      source: {
        name: 'Drouot',
        kind: 'auction_realized',
        url: 'https://www.drouot.com/l/12345-boudin-plage',
      },
      matchedLabel: 'Eugène Boudin — Plage de Trouville, huile sur panneau',
    });
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'Eugène Boudin Plage de Trouville huile sur panneau',
      limit: '5',
    });
  });

  it('réponse vide → []', async () => {
    const source = new DrouotSource({ transport: new FakeTransport({ resultats: [] }), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → []', async () => {
    const source = new DrouotSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Heritage Auctions (auction_realized) ─────────────────────────────────────

describe('HeritageArtSource', () => {
  it('mappe les lots adjugés avec ageDays exact', async () => {
    const transport = new FakeTransport({
      lots: [
        {
          title: 'Eugene Boudin — Beach at Trouville',
          hammerPrice: 52000,
          currency: 'USD',
          soldOn: '2026-06-20T00:00:00Z', // 20 jours avant NOW
          lotUrl: 'https://fineart.ha.com/itm/boudin/a/8123-67001.s',
        },
      ],
    });
    const source = new HeritageArtSource({ transport, apiKey: 'ha-key', now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 52000,
      currency: 'USD',
      ageDays: 20,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.auction_realized,
      source: {
        name: 'Heritage Auctions',
        kind: 'auction_realized',
        url: 'https://fineart.ha.com/itm/boudin/a/8123-67001.s',
      },
      matchedLabel: 'Eugene Boudin — Beach at Trouville',
    });
    expect(transport.calls[0]?.init?.query).toEqual({
      query: 'Eugène Boudin Plage de Trouville huile sur panneau',
      category: 'fine-art',
      limit: '5',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ 'x-api-key': 'ha-key' });
  });

  it('réponse vide → []', async () => {
    const source = new HeritageArtSource({ transport: new FakeTransport({ lots: [] }), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → []', async () => {
    const source = new HeritageArtSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

// ── Magnus (marketplace_sold) ────────────────────────────────────────────────

describe('MagnusSource', () => {
  it('mappe les ventes conclues avec le poids marketplace_sold', async () => {
    const transport = new FakeTransport({
      sales: [
        {
          artwork: 'Eugène Boudin — Plage de Trouville',
          soldPrice: 39500,
          currency: 'EUR',
          soldAt: '2026-06-01', // 39 jours avant NOW
          url: 'https://www.magnus.art/artwork/boudin-plage',
        },
      ],
    });
    const source = new MagnusSource({ transport, now: NOW });

    const observations = await source.fetch(QUERY);

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      price: 39500,
      currency: 'EUR',
      ageDays: 39,
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.marketplace_sold,
      source: {
        name: 'Magnus',
        kind: 'marketplace_sold',
        url: 'https://www.magnus.art/artwork/boudin-plage',
      },
      matchedLabel: 'Eugène Boudin — Plage de Trouville',
    });
  });

  it('date absente → ageDays 0 (observation traitée comme fraîche)', async () => {
    const transport = new FakeTransport({ sales: [{ artwork: 'sans date', soldPrice: 100 }] });
    const source = new MagnusSource({ transport, now: NOW });
    const observations = await source.fetch(QUERY);
    expect(observations[0]?.ageDays).toBe(0);
  });

  it('réponse de forme inattendue → []', async () => {
    const source = new MagnusSource({ transport: new FakeTransport(42), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });

  it('transport en panne → []', async () => {
    const source = new MagnusSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});
