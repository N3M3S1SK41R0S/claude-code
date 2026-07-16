import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { createArbiterHandler, handler } from '../arbiter/index.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

const realFetch = globalThis.fetch;
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@velum.app' };

interface StubOptions {
  plan?: string;
  profileStatus?: number;
  item?: Record<string, unknown> | null;
  itemStatus?: number;
  analyses?: unknown[];
  analysesStatus?: number;
  valuations?: unknown[];
  valuationsStatus?: number;
}

interface RecordedCall {
  url: string;
  method: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': '0-0/1',
    },
  });
}

function stubFetch(options: StubOptions = {}): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    calls.push({ url, method: request.method });

    if (url.includes('/auth/v1/user')) return Promise.resolve(jsonResponse(USER));
    if (url.includes('/rest/v1/profiles')) {
      if (options.profileStatus && options.profileStatus >= 400) {
        return Promise.resolve(jsonResponse({ message: 'profiles unavailable' }, options.profileStatus));
      }
      return Promise.resolve(jsonResponse([{ plan: options.plan ?? 'gold' }]));
    }
    if (url.includes('/rest/v1/items')) {
      if (options.itemStatus && options.itemStatus >= 400) {
        return Promise.resolve(jsonResponse({ message: 'items unavailable' }, options.itemStatus));
      }
      return Promise.resolve(jsonResponse(options.item === null ? [] : [options.item ?? coinItem()]));
    }
    if (url.includes('/rest/v1/analyses')) {
      if (options.analysesStatus && options.analysesStatus >= 400) {
        return Promise.resolve(jsonResponse({ message: 'analyses unavailable' }, options.analysesStatus));
      }
      return Promise.resolve(jsonResponse(options.analyses ?? []));
    }
    if (url.includes('/rest/v1/valuations')) {
      if (options.valuationsStatus && options.valuationsStatus >= 400) {
        return Promise.resolve(jsonResponse({ message: 'valuations unavailable' }, options.valuationsStatus));
      }
      return Promise.resolve(jsonResponse(options.valuations ?? []));
    }
    return Promise.resolve(jsonResponse([]));
  }) as typeof fetch;
  return calls;
}

function post(body: unknown): Request {
  return new Request('https://velum.test/arbiter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-token',
    },
    body: JSON.stringify(body),
  });
}

function coinItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    domain: 'coin',
    attributes: {},
    ...overrides,
  };
}

function wineItem(window: unknown): Record<string, unknown> {
  return coinItem({
    domain: 'wine',
    attributes: {
      analysis: {
        tasting: { drinkWindow: window },
      },
    },
  });
}

Deno.test('arbiter refuse un corps JSON primitif en 400', async () => {
  stubFetch();
  try {
    const response = await handler(post(null));
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, 'INVALID_INPUT');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter valide currentYear avant toute lecture produit', async () => {
  const calls = stubFetch();
  try {
    const response = await handler(
      post({ itemId: '22222222-2222-4222-8222-222222222222', currentYear: 2026.5 }),
    );
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, 'INVALID_INPUT');
    assertEquals(calls.some((call) => call.url.includes('/rest/v1/profiles')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter rend une panne de lecture du plan visible en 503', async () => {
  stubFetch({ profileStatus: 503 });
  try {
    const response = await handler(
      post({ itemId: '22222222-2222-4222-8222-222222222222', currentYear: 2026 }),
    );
    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, 'SOURCE_UNAVAILABLE');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter refuse un plan non éligible avant de lire l’objet', async () => {
  const calls = stubFetch({ plan: 'premium' });
  try {
    const response = await handler(
      post({ itemId: '22222222-2222-4222-8222-222222222222', currentYear: 2026 }),
    );
    assertEquals(response.status, 403);
    assertEquals((await response.json()).error.code, 'PLAN_REQUIRED');
    assertEquals(calls.some((call) => call.url.includes('/rest/v1/items')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter utilise le JSONB de repli et ignore les points de trajectoire invalides', async () => {
  stubFetch({
    item: wineItem({ from: 2024, to: 2027 }),
    analyses: [],
    valuations: [
      { valued_at: '2026-01-01T00:00:00Z', central: '150', ci80_low: '140', ci80_high: '160' },
      { valued_at: 'invalide', central: 999, ci80_low: 998, ci80_high: 1000 },
      { valued_at: '2024-01-01T00:00:00Z', central: 100, ci80_low: 90, ci80_high: 110 },
      { valued_at: '2025-01-01T00:00:00Z', central: 120, ci80_low: 115, ci80_high: 125 },
      { valued_at: '2025-06-01T00:00:00Z', central: 80, ci80_low: 90, ci80_high: 70 },
    ],
  });
  try {
    const response = await handler(
      post({ itemId: '22222222-2222-4222-8222-222222222222', currentYear: 2026 }),
    );
    assertEquals(response.status, 200);
    const signal = await response.json();
    assertEquals(signal.verdict, 'sell');
    assertEquals(signal.trend, 'rising');
    assertEquals(signal.sellWindow, true);
    assertEquals(signal.confidence, 0.8);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter ne publie aucun signal vin sans fenêtre d’apogée fiable', async () => {
  const calls = stubFetch({
    item: wineItem({ from: 2035, to: 2024 }),
    analyses: [],
    valuations: [
      { valued_at: '2024-01-01T00:00:00Z', central: 100, ci80_low: 90, ci80_high: 110 },
    ],
  });
  try {
    const response = await handler(
      post({ itemId: '22222222-2222-4222-8222-222222222222', currentYear: 2026 }),
    );
    assertEquals(response.status, 200);
    const signal = await response.json();
    assertEquals(signal.verdict, 'watch');
    assertEquals(signal.confidence, 0);
    assertEquals(signal.sellWindow, false);
    assertStringIncludes(signal.reasons[0], 'Fenêtre d’apogée indisponible');
    assertEquals(calls.some((call) => call.url.includes('/rest/v1/valuations')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('arbiter injecte l’année courante et refuse un domaine Postgres inconnu', async () => {
  const injectedHandler = createArbiterHandler({ currentYear: () => 2030 });
  // 'vinyle' n'existe pas dans velum_domain — 'watch' est un domaine valide depuis le 5e module.
  stubFetch({ item: coinItem({ domain: 'vinyle' }) });
  try {
    const response = await injectedHandler(
      post({ itemId: '22222222-2222-4222-8222-222222222222' }),
    );
    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, 'SOURCE_UNAVAILABLE');
  } finally {
    globalThis.fetch = realFetch;
  }
});
