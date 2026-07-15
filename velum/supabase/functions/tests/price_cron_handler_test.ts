import { assertEquals } from 'jsr:@std/assert@1';

import { handler } from '../price-cron/index.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
Deno.env.set('CRON_SECRET', 'cron-secret');

const realFetch = globalThis.fetch;

interface RecordedCall {
  url: string;
  method: string;
  body: string;
}

interface StubOptions {
  items?: unknown[];
  profiles?: unknown[];
  profilesStatus?: number;
  alerts?: unknown[];
  valuations?: unknown[];
  analyses?: unknown[];
  alertEvaluationResult?: string | null;
  alertEvaluationStatus?: number;
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

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    const method = request.method;
    const body = method === 'GET' || method === 'HEAD' ? '' : await request.clone().text();
    calls.push({ url, method, body });

    if (url.includes('/rest/v1/rpc/record_alert_evaluation')) {
      if (options.alertEvaluationStatus && options.alertEvaluationStatus >= 400) {
        return jsonResponse({ message: 'alert evaluation unavailable' }, options.alertEvaluationStatus);
      }
      return jsonResponse(options.alertEvaluationResult ?? null);
    }
    if (url.includes('/rest/v1/items')) {
      return jsonResponse(options.items ?? []);
    }
    if (url.includes('/rest/v1/profiles')) {
      if (url.includes('expo_push_token')) return jsonResponse([]);
      if (options.profilesStatus && options.profilesStatus >= 400) {
        return jsonResponse({ message: 'profiles unavailable' }, options.profilesStatus);
      }
      return jsonResponse(options.profiles ?? []);
    }
    if (url.includes('/rest/v1/alerts')) {
      return jsonResponse(options.alerts ?? []);
    }
    if (url.includes('/rest/v1/valuations')) {
      return jsonResponse(options.valuations ?? []);
    }
    if (url.includes('/rest/v1/analyses')) {
      return jsonResponse(options.analyses ?? []);
    }
    if (url.includes('api.frankfurter.app')) {
      return jsonResponse({ rates: { USD: 1.1 } });
    }
    if (url.includes('exp.host')) {
      return jsonResponse({ data: [] });
    }

    return jsonResponse([]);
  }) as typeof fetch;

  return calls;
}

function cronRequest(secret = 'cron-secret'): Request {
  return new Request('https://velum.test/price-cron', {
    method: 'POST',
    headers: { 'x-cron-secret': secret },
  });
}

function item(ownerId: string, attributes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    owner_id: ownerId,
    domain: 'wine',
    title: 'Bandol Domaine Test 2020',
    attributes,
    confidence: 0.9,
    condition: null,
  };
}

Deno.test('price-cron refuse un secret invalide avant tout accès réseau', async () => {
  const calls = stubFetch();
  try {
    const response = await handler(cronRequest('incorrect'));
    assertEquals(response.status, 401);
    assertEquals(calls.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('price-cron ignore totalement un objet Free', async () => {
  const ownerId = '22222222-2222-4222-8222-222222222222';
  const calls = stubFetch({
    items: [item(ownerId)],
    profiles: [{ id: ownerId, plan: 'free' }],
    alerts: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        type: 'price_threshold',
        config: { threshold: 1 },
      },
    ],
  });

  try {
    const response = await handler(cronRequest());
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      processed: 1,
      eligible: 0,
      revalued: 0,
      notified: 0,
      failures: 0,
    });

    assertEquals(calls.some((call) => call.url.includes('/rest/v1/alerts')), false);
    assertEquals(calls.some((call) => call.url.includes('/rest/v1/valuations')), false);
    assertEquals(calls.some((call) => call.url.includes('/rest/v1/analyses')), false);
    assertEquals(calls.some((call) => call.url.includes('record_alert_evaluation')), false);
    assertEquals(calls.some((call) => call.url.includes('frankfurter')), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("price-cron notifie un nouveau passage en apogée sans revalorisation ni FX", async () => {
  const ownerId = '33333333-3333-4333-8333-333333333333';
  const alertId = '66666666-6666-4666-8666-666666666666';
  const year = new Date().getUTCFullYear();
  const calls = stubFetch({
    items: [
      item(ownerId, {
        analysis: {
          tasting: { drinkWindow: { from: year - 1, to: year + 1 } },
          comparisons: { foodPairings: ['daube provençale'] },
        },
      }),
    ],
    profiles: [{ id: ownerId, plan: 'premium' }],
    alerts: [{ id: alertId, type: 'drink_window', config: {} }],
    analyses: [],
    alertEvaluationResult: '77777777-7777-4777-8777-777777777777',
  });

  try {
    const response = await handler(cronRequest());
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      processed: 1,
      eligible: 1,
      revalued: 0,
      notified: 1,
      failures: 0,
    });

    assertEquals(calls.some((call) => call.url.includes('/rest/v1/valuations')), false);
    assertEquals(calls.some((call) => call.url.includes('frankfurter')), false);
    assertEquals(
      calls.some(
        (call) =>
          call.url.includes('/rest/v1/rpc/record_alert_evaluation') &&
          call.method === 'POST' &&
          call.body.includes(alertId) &&
          call.body.includes('"p_condition_met":true') &&
          call.body.includes('À boire'),
      ),
      true,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("price-cron enregistre une condition d'apogée fausse pour réarmer", async () => {
  const ownerId = '88888888-8888-4888-8888-888888888888';
  const alertId = '99999999-9999-4999-8999-999999999999';
  const year = new Date().getUTCFullYear();
  const calls = stubFetch({
    items: [
      item(ownerId, {
        analysis: {
          tasting: { drinkWindow: { from: year + 5, to: year + 10 } },
          comparisons: { foodPairings: [] },
        },
      }),
    ],
    profiles: [{ id: ownerId, plan: 'gold' }],
    alerts: [{ id: alertId, type: 'drink_window', config: {} }],
    analyses: [],
    alertEvaluationResult: null,
  });

  try {
    const response = await handler(cronRequest());
    assertEquals(response.status, 200);
    assertEquals((await response.json()).notified, 0);
    assertEquals(
      calls.some(
        (call) =>
          call.url.includes('/rest/v1/rpc/record_alert_evaluation') &&
          call.body.includes('"p_condition_met":false'),
      ),
      true,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('price-cron compte une panne du RPC d’alerte sans créer de faux succès', async () => {
  const ownerId = '12121212-1212-4212-8212-121212121212';
  const year = new Date().getUTCFullYear();
  stubFetch({
    items: [
      item(ownerId, {
        analysis: {
          tasting: { drinkWindow: { from: year - 1, to: year + 1 } },
          comparisons: { foodPairings: [] },
        },
      }),
    ],
    profiles: [{ id: ownerId, plan: 'premium' }],
    alerts: [
      {
        id: '13131313-1313-4313-8313-131313131313',
        type: 'drink_window',
        config: {},
      },
    ],
    analyses: [],
    alertEvaluationStatus: 503,
  });

  try {
    const response = await handler(cronRequest());
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      processed: 1,
      eligible: 1,
      revalued: 0,
      notified: 0,
      failures: 1,
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('price-cron rend une panne de lecture des droits visible en 503', async () => {
  const ownerId = '44444444-4444-4444-8444-444444444444';
  stubFetch({
    items: [item(ownerId)],
    profilesStatus: 503,
  });

  try {
    const response = await handler(cronRequest());
    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, 'SOURCE_UNAVAILABLE');
  } finally {
    globalThis.fetch = realFetch;
  }
});
