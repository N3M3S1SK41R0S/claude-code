/**
 * Tests d'intégration des handlers HTTP recognize & valuate — le réseau
 * (Supabase Auth/RPC, Anthropic, sources de prix, FX) est intercepté via un
 * stub de `globalThis.fetch`. Exercice réel de la garde d'auth, de la
 * validation, du quota et du mapping d'erreurs (contrat du client).
 *
 *   deno test --import-map=import_map.json -A supabase/functions/tests/handlers_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { handler as recognize } from '../recognize/index.ts';
import { handler as valuate } from '../valuate/index.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
Deno.env.set('LLM_VISION_API_KEY', 'llm-key');

const realFetch = globalThis.fetch;
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Installe un stub fetch routé par URL.
 * @param opts.user       utilisateur renvoyé par /auth/v1/user (null → 401)
 * @param opts.quota      valeur de rpc consume_scan (true/false)
 * @param opts.vision     texte renvoyé par Anthropic (JSON attendu par le plugin)
 * @param opts.sources    observations renvoyées par les sources de prix ([] par défaut)
 */
function stubFetch(opts: {
  user?: Record<string, unknown> | null;
  quota?: boolean;
  vision?: string;
  sources?: unknown;
}) {
  globalThis.fetch = ((input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/auth/v1/user')) {
      return Promise.resolve(
        opts.user ? jsonResponse(opts.user) : jsonResponse({ error: 'invalid' }, 401),
      );
    }
    if (url.includes('/rest/v1/rpc/consume_scan')) {
      return Promise.resolve(jsonResponse(opts.quota ?? true));
    }
    if (url.includes('api.anthropic.com')) {
      return Promise.resolve(
        jsonResponse({ content: [{ type: 'text', text: opts.vision ?? '{"candidates":[]}' }] }),
      );
    }
    if (url.includes('frankfurter')) {
      return Promise.resolve(jsonResponse({ rates: { USD: 1.1 } }));
    }
    // Sources de prix : par défaut aucune observation.
    return Promise.resolve(jsonResponse(opts.sources ?? []));
  }) as typeof fetch;
}

function restore() {
  globalThis.fetch = realFetch;
}

const DEMO_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@velum.app' };

function post(url: string, body: unknown, auth = true): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer demo-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ── recognize ────────────────────────────────────────────────────────────────

Deno.test('recognize : GET → 405', async () => {
  stubFetch({ user: DEMO_USER });
  const res = await recognize(new Request('https://x/recognize', { method: 'GET' }));
  assertEquals(res.status, 405);
  restore();
});

Deno.test('recognize : sans jeton → 401 UNAUTHORIZED', async () => {
  stubFetch({ user: null });
  const res = await recognize(post('https://x/recognize', { domain: 'wine', input: {} }, false));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
  restore();
});

Deno.test('recognize : domaine inconnu → 400 INVALID_INPUT', async () => {
  stubFetch({ user: DEMO_USER });
  const res = await recognize(post('https://x/recognize', { domain: 'timbre', input: {} }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error.code, 'INVALID_INPUT');
  restore();
});

Deno.test('recognize : quota atteint → 402 BUDGET_EXCEEDED', async () => {
  stubFetch({ user: DEMO_USER, quota: false });
  const res = await recognize(
    post('https://x/recognize', { domain: 'wine', input: { kind: 'text', text: 'Bandol 2016' } }),
  );
  assertEquals(res.status, 402);
  assertEquals((await res.json()).error.code, 'BUDGET_EXCEEDED');
  restore();
});

Deno.test('recognize : happy path → 200 + candidats du plugin', async () => {
  stubFetch({
    user: DEMO_USER,
    quota: true,
    vision: '{"candidates":[{"label":"Bandol Domaine Tempier 2016","confidence":0.9,"attributes":{"vintage":2016}}]}',
  });
  const res = await recognize(
    post('https://x/recognize', { domain: 'wine', input: { kind: 'text', text: 'Bandol Tempier 2016' } }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Array.isArray(body.candidates), true);
  assertEquals(body.candidates[0].label, 'Bandol Domaine Tempier 2016');
  restore();
});

// ── valuate ──────────────────────────────────────────────────────────────────

Deno.test('valuate : sans jeton → 401', async () => {
  stubFetch({ user: null });
  const res = await valuate(post('https://x/valuate', { domain: 'wine', candidate: {} }, false));
  assertEquals(res.status, 401);
  restore();
});

Deno.test('valuate : aucune observation exploitable → 404 NO_OBSERVATIONS', async () => {
  // Sources publiques présentes mais renvoyant des données vides → le moteur
  // §7 lève NO_OBSERVATIONS, mappé en 404 (l'UI affiche « estimation
  // indisponible », jamais un zéro trompeur).
  stubFetch({ user: DEMO_USER, sources: [] });
  const res = await valuate(
    post('https://x/valuate', {
      domain: 'wine',
      candidate: { id: 'c1', domain: 'wine', label: 'Bandol 2016', confidence: 0.9, attributes: {} },
    }),
  );
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error.code, 'NO_OBSERVATIONS');
  restore();
});
