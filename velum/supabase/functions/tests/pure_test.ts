/**
 * Tests unitaires des helpers purs des Edge Functions (aucun réseau) :
 * contrat d'erreur { error: { code, message } }, mapping VelumError → statut,
 * routage domaine, construction des sources selon les clés, CORS, webhook.
 *
 *   deno test --import-map=import_map.json --allow-env supabase/functions/tests/pure_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { VelumError } from '@velum/core';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { handleOptions } from '../_shared/cors.ts';
import { buildSources, isVelumDomain, plugins } from '../_shared/domains.ts';
import { planFromEntitlements } from '../revenuecat-webhook/index.ts';

const noopTransport = { getJson: () => Promise.resolve({}) };

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
  // iDealwine / Vivino / Cavissima sont publiques → au moins 3, sans Wine-Searcher.
  assertEquals(wine.length >= 3, true);
  assertEquals(
    wine.some((s) => s.name.toLowerCase().includes('searcher')),
    false,
  );
});

Deno.test('buildSources : une clé configurée ajoute sa source', () => {
  Deno.env.set('WINE_SEARCHER_API_KEY', 'test-key');
  const withKey = buildSources('wine', noopTransport);
  assertEquals(
    withKey.some((s) => s.name.toLowerCase().includes('searcher')),
    true,
  );
  Deno.env.delete('WINE_SEARCHER_API_KEY');
});

Deno.test('planFromEntitlements : plus haut palier gagnant, défaut free', () => {
  assertEquals(planFromEntitlements([]), 'free');
  assertEquals(planFromEntitlements(['premium_monthly']), 'premium');
  assertEquals(planFromEntitlements(['gold_yearly']), 'gold');
  assertEquals(planFromEntitlements(['premium', 'platine']), 'platine');
  assertEquals(planFromEntitlements(['platinum']), 'platine');
});
