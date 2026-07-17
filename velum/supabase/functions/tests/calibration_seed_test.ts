/**
 * Tests du seed de backtest (calibration/seed.ts) — sans réseau : le
 * collecteur d'observations est un fake injecté.
 */
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import type { FxRates, PriceObservation, PriceQuery, VelumDomain } from '@velum/core';
import { buildSeedRows } from '../calibration/seed.ts';

function obs(
  price: number,
  kind: PriceObservation['source']['kind'],
  ageDays = 10,
  currency = 'EUR',
): PriceObservation {
  return { price, currency, ageDays, sourceWeight: 0.9, source: { name: kind, kind } };
}

const FX: FxRates = { USD: 0.9 };
const NOW = () => new Date('2026-07-16T12:00:00Z');

const ONE_WINE_BENCHMARK = {
  wine: [{ domain: 'wine', label: 'Test', attributes: {}, limit: 10 } as PriceQuery],
  coin: [],
  art: [],
  stamp: [],
  watch: [],
} as Record<VelumDomain, PriceQuery[]>;

Deno.test('seed : chaque vente réelle exploitable devient une ligne point-in-time', async () => {
  const report = await buildSeedRows(ONE_WINE_BENCHMARK, {
    fetchObservations: () =>
      Promise.resolve([
        obs(100, 'auction_realized', 30),
        obs(102, 'marketplace_sold', 5),
        obs(98, 'official_quote', 45),
        obs(101, 'official_quote', 40),
        obs(99, 'listing', 35),
      ]),
    fx: FX,
    now: NOW,
  });

  assertEquals(report.rows.length, 2);
  assertEquals(report.perDomain['wine'], { cases: 2, kept: 2, skipped: 0 });
  const first = report.rows[0];
  assertEquals(first.domain, 'wine');
  assertEquals(first.origin, 'public_backtest');
  assertEquals(first.realized, 100);
  assertEquals(first.realized_at, '2026-06-16T12:00:00.000Z');
  if (!(first.ci80_low <= first.central && first.central <= first.ci80_high)) {
    throw new Error('IC80 incohérent');
  }
});

Deno.test('seed : domaine sans observation → aucune ligne, aucun échec', async () => {
  const report = await buildSeedRows(ONE_WINE_BENCHMARK, {
    fetchObservations: () => Promise.resolve([]),
    fx: FX,
    now: NOW,
  });
  assertEquals(report.rows.length, 0);
  assertEquals(report.perDomain['wine'], { cases: 0, kept: 0, skipped: 0 });
});

Deno.test('seed : taux de change manquant → erreur VISIBLE (jamais avalée)', async () => {
  await assertRejects(
    () =>
      buildSeedRows(ONE_WINE_BENCHMARK, {
        fetchObservations: () =>
          Promise.resolve([
            obs(100, 'auction_realized', 0, 'GBP'),
            obs(90, 'official_quote'),
            obs(92, 'official_quote'),
            obs(91, 'official_quote'),
          ]),
        fx: FX,
        now: NOW,
      }),
    Error,
    'change',
  );
});

Deno.test('seed : les annonces/cotes ne deviennent jamais la vérité-terrain', async () => {
  const report = await buildSeedRows(ONE_WINE_BENCHMARK, {
    fetchObservations: () =>
      Promise.resolve([
        obs(100, 'listing'),
        obs(102, 'official_quote'),
        obs(98, 'official_quote'),
        obs(101, 'listing'),
      ]),
    fx: FX,
    now: NOW,
  });
  assertEquals(report.rows.length, 0);
});
