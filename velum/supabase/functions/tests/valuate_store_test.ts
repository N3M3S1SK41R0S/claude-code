/**
 * valuate : persistance des estimations — propriété vérifiée par le client
 * UTILISATEUR (RLS), écriture par le client SERVICE-ROLE (le client n'a plus
 * aucun droit d'écriture sur valuations : seuil de certification des
 * plateformes non falsifiable). Réseau intercepté via `globalThis.fetch`.
 *
 *   deno test --import-map=import_map.json -A tests/valuate_store_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1';
import type { ValuationResult } from '@velum/core';
import { createAdminClient, createUserClient } from '../_shared/auth.ts';
import { handler as valuate } from '../valuate/index.ts';
import { checkItemOwnership, storeValuation, valuationRow } from '../valuate/store.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

const realFetch = globalThis.fetch;
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@velum.app' };
const ITEM = '22222222-2222-4222-8222-222222222201';

interface RecordedCall {
  url: string;
  method: string;
  authorization: string | null;
  apikey: string | null;
  body: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
  });
}

function stubFetch(options: { items?: unknown[]; itemsStatus?: number; insertStatus?: number } = {}): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    calls.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get('Authorization'),
      apikey: request.headers.get('apikey'),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    if (request.url.includes('/auth/v1/user')) return jsonResponse(USER);
    if (request.url.includes('/rest/v1/items')) {
      if (options.itemsStatus && options.itemsStatus >= 400) {
        return jsonResponse({ message: 'items unavailable' }, options.itemsStatus);
      }
      return jsonResponse(options.items ?? []);
    }
    if (request.url.includes('/rest/v1/valuations')) {
      if (options.insertStatus && options.insertStatus >= 400) {
        return jsonResponse({ message: 'insert failed' }, options.insertStatus);
      }
      return new Response(null, { status: 201 });
    }
    return jsonResponse([]);
  }) as typeof fetch;
  return calls;
}

function restore(): void {
  globalThis.fetch = realFetch;
}

function userRequest(body: unknown = {}): Request {
  return new Request('https://x/valuate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    body: JSON.stringify(body),
  });
}

const RESULT: ValuationResult = {
  central: 51,
  ci80: [45, 58],
  ci95: [42, 63],
  nSources: 2,
  reliability: 81,
  currency: 'EUR',
  observations: [],
};

Deno.test('checkItemOwnership : lecture par le client UTILISATEUR (RLS)', async () => {
  const calls = stubFetch({ items: [{ id: ITEM }] });
  try {
    assertEquals(await checkItemOwnership(createUserClient(userRequest()), ITEM), 'owned');
    const read = calls.find((c) => c.url.includes('/rest/v1/items'));
    assertEquals(read?.authorization, 'Bearer user-token');
    assertEquals(read?.apikey, 'anon-key');
  } finally {
    restore();
  }
});

Deno.test('checkItemOwnership : objet d’autrui (invisible) ⇒ not_owned ; panne ⇒ unavailable', async () => {
  stubFetch({ items: [] });
  try {
    assertEquals(await checkItemOwnership(createUserClient(userRequest()), ITEM), 'not_owned');
  } finally {
    restore();
  }
  stubFetch({ itemsStatus: 500 });
  try {
    assertEquals(await checkItemOwnership(createUserClient(userRequest()), ITEM), 'unavailable');
  } finally {
    restore();
  }
});

Deno.test('storeValuation : écriture par le client SERVICE-ROLE', async () => {
  const calls = stubFetch();
  try {
    assertEquals(await storeValuation(createAdminClient(), ITEM, RESULT), true);
    const insert = calls.find((c) => c.url.includes('/rest/v1/valuations'));
    assertEquals(insert?.method, 'POST');
    assertEquals(insert?.apikey, 'service-key');
    assertEquals(insert?.authorization, 'Bearer service-key');
    assertEquals(JSON.parse(insert?.body ?? '{}'), valuationRow(ITEM, RESULT));
  } finally {
    restore();
  }
  stubFetch({ insertStatus: 500 });
  try {
    assertEquals(await storeValuation(createAdminClient(), ITEM, RESULT), false);
  } finally {
    restore();
  }
});

Deno.test('valuate : objet non possédé ⇒ 403, ni source interrogée ni estimation écrite', async () => {
  const calls = stubFetch({ items: [] });
  try {
    const res = await valuate(
      userRequest({
        domain: 'wine',
        candidate: { id: 'c1', domain: 'wine', label: 'Bandol 2016', confidence: 0.9, attributes: {} },
        itemId: ITEM,
      }),
    );
    assertEquals(res.status, 403);
    assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
    assertEquals(calls.some((c) => c.url.includes('/rest/v1/valuations')), false);
    assertEquals(
      calls.every((c) => c.url.includes('/auth/v1/user') || c.url.includes('/rest/v1/items')),
      true,
    );
  } finally {
    restore();
  }
});

Deno.test('valuate : vérification de propriété en panne ⇒ 503 (jamais un refus trompeur)', async () => {
  stubFetch({ itemsStatus: 500 });
  try {
    const res = await valuate(
      userRequest({
        domain: 'wine',
        candidate: { id: 'c1', domain: 'wine', label: 'Bandol 2016', confidence: 0.9, attributes: {} },
        itemId: ITEM,
      }),
    );
    assertEquals(res.status, 503);
    assertEquals((await res.json()).error.code, 'SOURCE_UNAVAILABLE');
  } finally {
    restore();
  }
});
