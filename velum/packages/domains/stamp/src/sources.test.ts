import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_WEIGHTS, type PriceQuery } from '@velum/core';
import type { Transport } from './sources/transport.ts';
import { ageDaysFromIso } from './sources/transport.ts';
import { ColnectSource } from './sources/colnect.ts';
import { YvertCoteSource } from './sources/yvertCote.ts';
import { DelcampeSource } from './sources/delcampe.ts';
import { EbaySoldSource } from './sources/ebaySold.ts';
import { CatawikiSource } from './sources/catawiki.ts';

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
  domain: 'stamp',
  label: 'France Semeuse lignée 15c 1903 YT 130',
  attributes: { country: 'France', title: 'Semeuse lignée', year: 1903, catalogNumber: 'YT 130' },
  condition: 'neuf_sans_charniere',
  limit: 20,
};

describe('ageDaysFromIso', () => {
  it('convertit une date ISO en jours entiers via l’horloge injectée', () => {
    expect(ageDaysFromIso('2026-07-10T00:00:00Z', NOW)).toBe(0);
    expect(ageDaysFromIso('2026-06-30T00:00:00Z', NOW)).toBe(10);
    expect(ageDaysFromIso('2026-06-15T10:30:00.000Z', NOW)).toBe(24);
    expect(ageDaysFromIso('2027-01-01T00:00:00Z', NOW)).toBe(0); // futur → borné à 0
  });

  it('retourne null pour une date absente ou illisible', () => {
    expect(ageDaysFromIso(undefined, NOW)).toBeNull();
    expect(ageDaysFromIso('pas une date', NOW)).toBeNull();
    expect(ageDaysFromIso('', NOW)).toBeNull();
  });
});

describe('ColnectSource', () => {
  const fixture = {
    items: [
      {
        name: 'Semeuse lignée 15c vert-gris',
        catalog_value: 8.5,
        currency: 'EUR',
        updated_at: '2026-06-01',
      },
      { name: 'sans cote' }, // ignoré : pas de valeur exploitable
    ],
  };

  it('construit la requête label+année+pays avec clé API et mappe les cotes', async () => {
    const transport = new FakeTransport(fixture);
    const source = new ColnectSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.colnect.net/fr/api/stamps/list');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: 'France Semeuse lignée 15c 1903 YT 130',
      year: '1903',
      country: 'France',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ 'X-Colnect-Api-Key': 'secret' });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      price: 8.5,
      currency: 'EUR',
      ageDays: 39, // 2026-06-01 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
      source: {
        name: 'Colnect',
        kind: 'official_quote',
        url: 'https://api.colnect.net/fr/api/stamps/list',
      },
      matchedLabel: 'Semeuse lignée 15c vert-gris',
    });
  });

  it('réponse vide ou invalide → []', async () => {
    expect(await new ColnectSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new ColnectSource({ transport: new FakeTransport({ items: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new ColnectSource({ transport: new FakeTransport('oops'), now: NOW }).fetch(QUERY)).toEqual([]);
  });

  it('transport en échec → [] (jamais de throw)', async () => {
    const source = new ColnectSource({ transport: new FakeTransport(null, true), now: NOW });
    expect(await source.fetch(QUERY)).toEqual([]);
  });
});

describe('YvertCoteSource', () => {
  const fixture = {
    cotes: [
      {
        designation: 'Semeuse lignée 15c vert-gris',
        etat: 'neuf_sans_charniere',
        valeur: 12,
        devise: 'EUR',
        maj: '2026-05-01',
      },
      {
        designation: 'Semeuse lignée 15c vert-gris',
        etat: 'oblitere',
        valeur: 2,
        devise: 'EUR',
        maj: '2026-05-01',
      }, // filtré (condition neuf_sans_charniere)
    ],
  };

  it("construit la requête label+numéro+état et ne retient que la cote de l'état demandé", async () => {
    const transport = new FakeTransport(fixture);
    const source = new YvertCoteSource({ transport, apiKey: 'secret', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.yvert.com/v1/cotes');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      numero: 'YT 130',
      etat: 'neuf_sans_charniere',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer secret' });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual({
      price: 12,
      currency: 'EUR',
      ageDays: 70, // 2026-05-01 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.official_quote,
      source: { name: 'Yvert & Tellier', kind: 'official_quote', url: 'https://api.yvert.com/v1/cotes' },
      matchedLabel: 'Semeuse lignée 15c vert-gris (neuf_sans_charniere)',
    });
  });

  it('date de mise à jour absente → cote du jour (ageDays 0)', async () => {
    const source = new YvertCoteSource({
      transport: new FakeTransport({ cotes: [{ valeur: 5, devise: 'EUR' }] }),
      now: NOW,
    });
    expect((await source.fetch(QUERY))[0]?.ageDays).toBe(0);
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new YvertCoteSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new YvertCoteSource({ transport: new FakeTransport({ cotes: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new YvertCoteSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('DelcampeSource', () => {
  const fixture = {
    sales: [
      {
        title: 'France YT 130 Semeuse lignée 15c neuf sans charnière',
        closed_at: '2026-06-20T14:00:00Z',
        price: { amount: '5.50', currency: 'EUR' },
      },
      { title: 'vente non datée', price: { amount: '99', currency: 'EUR' } }, // ignorée
    ],
  };

  it('mappe les ventes réalisées (prix en chaîne, date → ageDays)', async () => {
    const transport = new FakeTransport(fixture);
    const source = new DelcampeSource({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.delcampe.net/v1/sales/closed');
    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      category: 'stamps',
      limit: '20',
    });
    expect(transport.calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });

    expect(observations).toHaveLength(1); // la vente sans date est écartée
    expect(observations[0]).toEqual({
      price: 5.5,
      currency: 'EUR',
      ageDays: 19, // 2026-06-20 → 2026-07-10
      sourceWeight: DEFAULT_SOURCE_WEIGHTS.marketplace_sold,
      source: {
        name: 'Delcampe',
        kind: 'marketplace_sold',
        url: 'https://api.delcampe.net/v1/sales/closed',
      },
      matchedLabel: 'France YT 130 Semeuse lignée 15c neuf sans charnière',
    });
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new DelcampeSource({ transport: new FakeTransport({}), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new DelcampeSource({ transport: new FakeTransport({ sales: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new DelcampeSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});

describe('EbaySoldSource', () => {
  const fixture = {
    itemSales: [
      {
        title: 'France YT 130 Semeuse lignée 15c MNH',
        lastSoldDate: '2026-06-15T10:30:00.000Z',
        lastSoldPrice: { value: '12.50', currency: 'EUR' },
      },
      { title: 'vente non datée', lastSoldPrice: { value: '99', currency: 'EUR' } }, // ignorée
    ],
  };

  it('mappe les ventes réalisées avec la catégorie eBay « Stamps »', async () => {
    const transport = new FakeTransport(fixture);
    const source = new EbaySoldSource({ transport, apiKey: 'token', now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.init?.query).toEqual({
      q: QUERY.label,
      category_ids: '260',
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
      matchedLabel: 'France YT 130 Semeuse lignée 15c MNH',
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
        title: 'France - Semeuse lignée 15c 1903 - YT 130',
        sold_at: '2026-05-30',
        sold_price: { amount: 55, currency: 'EUR' },
      },
    ],
  };

  it('mappe les lots adjugés', async () => {
    const transport = new FakeTransport(fixture);
    const source = new CatawikiSource({ transport, now: NOW });
    const observations = await source.fetch(QUERY);

    expect(transport.calls[0]?.url).toBe('https://api.catawiki.com/v1/lots/sold');
    expect(transport.calls[0]?.init?.query).toEqual({ q: QUERY.label, category: 'stamps' });

    expect(observations).toHaveLength(1);
    expect(observations[0]?.price).toBe(55);
    expect(observations[0]?.ageDays).toBe(41); // 2026-05-30 → 2026-07-10
    expect(observations[0]?.sourceWeight).toBe(DEFAULT_SOURCE_WEIGHTS.marketplace_sold);
    expect(observations[0]?.source.kind).toBe('marketplace_sold');
    expect(observations[0]?.matchedLabel).toBe('France - Semeuse lignée 15c 1903 - YT 130');
  });

  it('réponse vide ou en échec → []', async () => {
    expect(await new CatawikiSource({ transport: new FakeTransport({ lots: [] }), now: NOW }).fetch(QUERY)).toEqual([]);
    expect(await new CatawikiSource({ transport: new FakeTransport(null, true), now: NOW }).fetch(QUERY)).toEqual([]);
  });
});
