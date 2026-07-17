/**
 * Tests unitaires des helpers purs des Edge Functions (aucun réseau) :
 * contrat d'erreur, mapping HTTP, routage domaine, sources selon clés/agréments,
 * CORS et webhook RevenueCat.
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { VelumError } from '@velum/core';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { handleOptions } from '../_shared/cors.ts';
import { buildSources, isVelumDomain, plugins } from '../_shared/domains.ts';
import { planFromEntitlements } from '../revenuecat-webhook/index.ts';

const noopTransport = { getJson: () => Promise.resolve({}) };

const WATCH_ENV = [
  'WATCHCHARTS_API_KEY',
  'WATCHCHARTS_APP_LICENSED',
  'HERITAGE_API_KEY',
  'HERITAGE_WATCH_API_ENABLED',
  'EBAY_API_KEY',
  'EBAY_MARKETPLACE_INSIGHTS_ENABLED',
  'CATAWIKI_API_KEY',
  'CATAWIKI_WATCH_API_ENABLED',
  'CHRONO24_API_KEY',
  'CHRONO24_WATCH_API_ENABLED',
] as const;

function clearWatchEnv(): void {
  for (const name of WATCH_ENV) Deno.env.delete(name);
}

Deno.test('json() encode le corps + en-têtes CORS', async () => {
  const res = json({ ok: true }, 201);
  assertEquals(res.status, 201);
  assertEquals(res.headers.get('Content-Type'), 'application/json');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await res.json(), { ok: true });
});

Deno.test('error() respecte le contrat { error: { code, message } }', async () => {
  const res = error('INVALID_INPUT', 'Domaine inconnu', 400);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: { code: 'INVALID_INPUT', message: 'Domaine inconnu' } });
});

Deno.test('errorFromException mappe chaque VelumError sur son statut HTTP', async () => {
  const cases: [string, number][] = [
    ['NO_OBSERVATIONS', 404],
    ['BUDGET_EXCEEDED', 402],
    ['PLAN_REQUIRED', 403],
    ['SOURCE_UNAVAILABLE', 503],
    ['UNAUTHORIZED', 401],
    ['ANALYSIS_FAILED', 502],
  ];
  for (const [code, status] of cases) {
    const res = errorFromException(new VelumError(code as never, 'x'));
    assertEquals(res.status, status, `code ${code}`);
    assertEquals((await res.json()).error.code, code);
  }
});

Deno.test('errorFromException : erreur inconnue → 500 INTERNAL', async () => {
  const res = errorFromException(new Error('boom'));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.code, 'INTERNAL');
});

Deno.test('handleOptions répond 204 au préflight, null sinon', () => {
  const pre = handleOptions(new Request('http://x', { method: 'OPTIONS' }));
  assertEquals(pre?.status, 204);
  assertEquals(handleOptions(new Request('http://x', { method: 'POST' })), null);
});

Deno.test('isVelumDomain : accepte les 5 domaines, rejette le reste', () => {
  for (const d of ['wine', 'coin', 'art', 'stamp', 'watch']) assertEquals(isVelumDomain(d), true);
  for (const d of ['', 'timbre', 'montre', 42, null, undefined]) assertEquals(isVelumDomain(d), false);
});

Deno.test('plugins : les 5 domaines sont routés vers le bon moteur', () => {
  assertEquals(plugins.wine.domain, 'wine');
  assertEquals(plugins.coin.domain, 'coin');
  assertEquals(plugins.art.domain, 'art');
  assertEquals(plugins.stamp.domain, 'stamp');
  assertEquals(plugins.watch.domain, 'watch');
});

Deno.test('buildSources : sans clés, seules les sources publiques sont présentes', () => {
  for (const k of ['WINE_SEARCHER_API_KEY', 'NUMISTA_API_KEY', 'EBAY_API_KEY']) Deno.env.delete(k);
  const wine = buildSources('wine', noopTransport);
  assertEquals(wine.length >= 3, true);
  assertEquals(wine.some((s) => s.name.toLowerCase().includes('searcher')), false);
});

Deno.test('buildSources : une clé configurée ajoute sa source publique contractuelle', () => {
  Deno.env.set('WINE_SEARCHER_API_KEY', 'test-key');
  const withKey = buildSources('wine', noopTransport);
  assertEquals(withKey.some((s) => s.name.toLowerCase().includes('searcher')), true);
  Deno.env.delete('WINE_SEARCHER_API_KEY');
});

Deno.test('buildSources watch : une clé seule ne prouve jamais un droit partenaire', () => {
  clearWatchEnv();
  Deno.env.set('WATCHCHARTS_API_KEY', 'watchcharts');
  Deno.env.set('HERITAGE_API_KEY', 'heritage');
  Deno.env.set('EBAY_API_KEY', 'ebay');
  Deno.env.set('CATAWIKI_API_KEY', 'catawiki');
  Deno.env.set('CHRONO24_API_KEY', 'chrono24');
  assertEquals(buildSources('watch', noopTransport).length, 0);
  clearWatchEnv();
});

Deno.test('buildSources watch : chaque source exige clé + agrément explicite', () => {
  clearWatchEnv();
  const cases = [
    ['WATCHCHARTS_API_KEY', 'WATCHCHARTS_APP_LICENSED', 'WatchCharts'],
    ['HERITAGE_API_KEY', 'HERITAGE_WATCH_API_ENABLED', 'Heritage Auctions'],
    ['EBAY_API_KEY', 'EBAY_MARKETPLACE_INSIGHTS_ENABLED', 'eBay sold'],
    ['CATAWIKI_API_KEY', 'CATAWIKI_WATCH_API_ENABLED', 'Catawiki'],
    ['CHRONO24_API_KEY', 'CHRONO24_WATCH_API_ENABLED', 'Chrono24'],
  ] as const;

  for (const [keyName, flagName, sourceName] of cases) {
    clearWatchEnv();
    Deno.env.set(keyName, 'test-key');
    Deno.env.set(flagName, 'true');
    assertEquals(buildSources('watch', noopTransport).map((source) => source.name), [sourceName]);
  }
  clearWatchEnv();
});

Deno.test('planFromEntitlements : plus haut palier gagnant, défaut free', () => {
  assertEquals(planFromEntitlements([]), 'free');
  assertEquals(planFromEntitlements(['premium_monthly']), 'premium');
  assertEquals(planFromEntitlements(['gold_yearly']), 'gold');
  assertEquals(planFromEntitlements(['premium', 'platine']), 'platine');
  assertEquals(planFromEntitlements(['platinum']), 'platine');
});
