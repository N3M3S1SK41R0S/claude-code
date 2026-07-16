import { assertEquals } from 'jsr:@std/assert@1';

import { handler as recognize } from '../recognize/index.ts';

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

function post(domain: string): Request {
  return new Request('https://x/recognize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-token',
    },
    body: JSON.stringify({
      domain,
      input: {
        kind: 'file',
        fileRows: [{ label: `Objet importé ${domain}`, reference: 'REF-1' }],
      },
    }),
  });
}

Deno.test('recognize : les imports fichier des cinq domaines n’appellent ni quota ni IA', async () => {
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    if (url.includes('/auth/v1/user')) return Promise.resolve(jsonResponse(USER));
    // Ces réponses bloquantes rendent le test sensible à tout appel accidentel.
    if (url.includes('/rest/v1/rpc/guard_ai_call')) return Promise.resolve(jsonResponse('budget'));
    if (url.includes('/rest/v1/rpc/consume_scan')) return Promise.resolve(jsonResponse(false));
    if (
      url.includes('api.anthropic.com') ||
      url.includes('api.openai.com') ||
      url.includes('generativelanguage.googleapis.com')
    ) {
      return Promise.resolve(jsonResponse({ error: 'fournisseur interdit dans ce test' }, 503));
    }
    return Promise.resolve(jsonResponse({ error: 'appel réseau inattendu' }, 500));
  }) as typeof fetch;

  try {
    for (const domain of ['wine', 'coin', 'art', 'stamp', 'watch']) {
      const response = await recognize(post(domain));
      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.stage, 'assisted');
      assertEquals(body.candidates.length, 1);
      assertEquals(body.candidates[0].domain, domain);
      assertEquals(body.candidates[0].label, `Objet importé ${domain}`);
    }

    assertEquals(calls.filter((url) => url.includes('/auth/v1/user')).length, 5);
    assertEquals(calls.some((url) => url.includes('guard_ai_call')), false);
    assertEquals(calls.some((url) => url.includes('consume_scan')), false);
    assertEquals(calls.some((url) => url.includes('/storage/v1/object/')), false);
    assertEquals(
      calls.some(
        (url) =>
          url.includes('api.anthropic.com') ||
          url.includes('api.openai.com') ||
          url.includes('generativelanguage.googleapis.com'),
      ),
      false,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
