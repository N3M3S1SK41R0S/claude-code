import { assertEquals } from 'jsr:@std/assert@1';
import { EMPTY_CELLAR_ADVICE } from '@velum/domain-wine';
import { handler } from '../cellar-pairing/index.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

const realFetch = globalThis.fetch;
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@velum.app' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function post(body: unknown): Request {
  return new Request('https://x/cellar-pairing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-token',
    },
    body: JSON.stringify(body),
  });
}

function stubFetch(options: {
  plan?: string;
  profileStatus?: number;
  items?: unknown[];
} = {}): string[] {
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    if (url.includes('/auth/v1/user')) return Promise.resolve(jsonResponse(USER));
    if (url.includes('/rest/v1/profiles')) {
      if (options.profileStatus && options.profileStatus >= 400) {
        return Promise.resolve(jsonResponse({ message: 'database unavailable' }, options.profileStatus));
      }
      return Promise.resolve(jsonResponse([{ plan: options.plan ?? 'gold' }]));
    }
    if (url.includes('/rest/v1/items')) {
      return Promise.resolve(jsonResponse(options.items ?? []));
    }
    if (url.includes('/rest/v1/rpc/guard_ai_call')) {
      return Promise.resolve(jsonResponse('ok'));
    }
    if (url.includes('api.anthropic.com')) {
      return Promise.resolve(
        jsonResponse({ content: [{ type: 'text', text: '{"recommendations":[]}' }] }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  }) as typeof fetch;
  return calls;
}

Deno.test('cellar-pairing refuse un corps JSON primitif en 400', async () => {
  stubFetch();
  try {
    const response = await handler(post(null));
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, 'INVALID_INPUT');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('cellar-pairing ne consomme ni garde-fou ni fournisseur pour une cave vide', async () => {
  const calls = stubFetch({ items: [] });
  try {
    const response = await handler(post({ dish: 'risotto aux cèpes' }));
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      recommendations: [],
      fallbackAdvice: EMPTY_CELLAR_ADVICE,
    });
    assertEquals(calls.some((url) => url.includes('guard_ai_call')), false);
    assertEquals(calls.some((url) => url.includes('api.anthropic.com')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('cellar-pairing refuse le plan non éligible avant le quota IA', async () => {
  const calls = stubFetch({ plan: 'free' });
  try {
    const response = await handler(post({ dish: 'poulet rôti' }));
    assertEquals(response.status, 403);
    assertEquals((await response.json()).error.code, 'PLAN_REQUIRED');
    assertEquals(calls.some((url) => url.includes('guard_ai_call')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('cellar-pairing rend visible une panne de lecture du plan', async () => {
  stubFetch({ profileStatus: 503 });
  try {
    const response = await handler(post({ dish: 'sole meunière' }));
    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, 'SOURCE_UNAVAILABLE');
  } finally {
    globalThis.fetch = realFetch;
  }
});
