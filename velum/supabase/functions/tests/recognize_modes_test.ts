/**
 * `recognize` : scan éclair (budget de sortie compact imposé) et mode planche
 * (validation, quota consommé UNE fois par photo, refus avant tout quota).
 * Réseau intercepté par un stub de `globalThis.fetch`.
 *
 *   deno test --allow-all tests/recognize_modes_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { RECOGNITION_MAX_TOKENS, SHEET_RECOGNITION_MAX_TOKENS } from '@velum/core';
import { MAX_IMAGE_BYTES } from '../_shared/input.ts';
import { handler as recognize } from '../recognize/index.ts';

Deno.env.set('SUPABASE_URL', 'https://demo.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
Deno.env.set('LLM_VISION_API_KEY', 'llm-key');

const realFetch = globalThis.fetch;
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@velum.app' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Trace {
  quotaCalls: number;
  guardCalls: number;
  downloads: number;
  visionBodies: Record<string, unknown>[];
}

function stub(
  opts: {
    vision?: string;
    quota?: boolean;
    guard?: string;
    /** Taille du fichier renvoyé par Storage (octets) ; 0 → photo introuvable (404). */
    storageBytes?: number;
  } = {},
): Trace {
  const trace: Trace = { quotaCalls: 0, guardCalls: 0, downloads: 0, visionBodies: [] };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/auth/v1/user')) return jsonResponse(USER);
    if (url.includes('/rest/v1/rpc/guard_ai_call')) {
      trace.guardCalls += 1;
      return jsonResponse(opts.guard ?? 'ok');
    }
    if (url.includes('/rest/v1/rpc/consume_scan')) {
      trace.quotaCalls += 1;
      return jsonResponse(opts.quota ?? true);
    }
    if (url.includes('/rest/v1/vision_calls')) return jsonResponse([]);
    if (url.includes('/storage/v1/object/')) {
      trace.downloads += 1;
      if (opts.storageBytes === 0) return jsonResponse({ error: 'not_found', message: 'Object not found' }, 404);
      if (opts.storageBytes !== undefined) {
        return new Response(new Uint8Array(opts.storageBytes), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    if (url.includes('api.anthropic.com')) {
      trace.visionBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return jsonResponse({ content: [{ type: 'text', text: opts.vision ?? '{"candidates":[]}' }] });
    }
    return jsonResponse({ error: 'appel réseau inattendu' }, 500);
  }) as typeof fetch;
  return trace;
}

function post(body: unknown): Request {
  return new Request('https://x/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
    body: JSON.stringify(body),
  });
}

const SHEET_PHOTO = {
  kind: 'photo',
  media: [{ role: 'detail', storagePath: `${USER.id}/planche.jpg` }],
};

const SHEET_ANSWER = JSON.stringify({
  detections: [
    {
      position: 'rangée 1, case 1',
      candidates: [{ label: 'Semeuse 10c rouge', confidence: 0.8, attributes: { catalogNumber: 'yt 138' } }],
    },
    {
      position: 'rangée 1, case 2',
      candidates: [{ label: 'Marianne de Gandon 15f', confidence: 0.7, attributes: {}, estimate: { low: 1, high: 2 } }],
    },
  ],
});

Deno.test('recognize : mode inconnu → 400 sans quota', async () => {
  const trace = stub();
  try {
    const res = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'album' }));
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error.code, 'INVALID_INPUT');
    assertEquals(trace.quotaCalls, 0);
    assertEquals(trace.guardCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : planche sur un domaine sans recognizeSheet → 400 sans quota', async () => {
  const trace = stub();
  try {
    const res = await recognize(
      post({ domain: 'wine', input: { kind: 'photo', media: [{ role: 'label', storagePath: `${USER.id}/a.jpg` }] }, mode: 'sheet' }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.code, 'INVALID_INPUT');
    assertEquals(String(body.error.message).includes('planche'), true);
    assertEquals(trace.quotaCalls, 0);
    assertEquals(trace.visionBodies.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : planche sans photo unique → 400 sans quota', async () => {
  const trace = stub();
  try {
    for (const input of [
      { kind: 'text', text: 'classeur de timbres' },
      { kind: 'photo', media: [] },
      {
        kind: 'photo',
        media: [
          { role: 'front', storagePath: `${USER.id}/a.jpg` },
          { role: 'back', storagePath: `${USER.id}/b.jpg` },
        ],
      },
      { kind: 'photo', media: [{ role: 'front', storagePath: '  ' }] },
    ]) {
      const res = await recognize(post({ domain: 'stamp', input, mode: 'sheet' }));
      assertEquals(res.status, 400);
      await res.body?.cancel();
    }
    assertEquals(trace.quotaCalls, 0);
    assertEquals(trace.guardCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : planche de timbres → détections, UN seul scan consommé, budget planche', async () => {
  const trace = stub({ vision: SHEET_ANSWER });
  try {
    const res = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'sheet' }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.detections.length, 2);
    assertEquals(body.truncated, false);
    assertEquals(body.detections[0].candidates[0].attributes.catalogNumber, 'YT 138');
    assertEquals(body.detections[1].candidates[0].quickEstimate, { low: 1, high: 2, currency: 'EUR' });
    // Décision documentée : une photo de planche = un scan, quel que soit le nombre d'objets.
    assertEquals(trace.quotaCalls, 1);
    assertEquals(trace.guardCalls, 1);
    assertEquals(trace.visionBodies.length, 1);
    assertEquals(trace.visionBodies[0]?.['max_tokens'], SHEET_RECOGNITION_MAX_TOKENS);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : planche de pièces acceptée (plateau en base64)', async () => {
  stub({ vision: '{"detections":[{"position":"case 1","candidates":[]}]}' });
  try {
    const res = await recognize(
      post({
        domain: 'coin',
        input: { kind: 'photo', media: [{ role: 'detail', storagePath: '', base64: 'data:image/jpeg;base64,AA==' }] },
        mode: 'sheet',
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.detections[0].needsAssistedEntry, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : planche — quota atteint → 402, garde-fou budget → 503 avant le quota', async () => {
  let trace = stub({ quota: false });
  try {
    const res = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'sheet' }));
    assertEquals(res.status, 402);
    await res.body?.cancel();
    assertEquals(trace.visionBodies.length, 0);

    trace = stub({ guard: 'budget' });
    const blocked = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'sheet' }));
    assertEquals(blocked.status, 503);
    await blocked.body?.cancel();
    assertEquals(trace.quotaCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : scan éclair — budget compact imposé, fourchette et classement renvoyés', async () => {
  const trace = stub({
    vision: JSON.stringify({
      candidates: [
        {
          label: 'Bandol Domaine Tempier 2016',
          confidence: 0.9,
          attributes: { vintage: 2016 },
          estimate: { low: 35, high: 55 },
          classification: ['Vin', 'Provence', 'Bandol'],
        },
      ],
    }),
  });
  try {
    const res = await recognize(post({ domain: 'wine', input: { kind: 'text', text: 'Bandol Tempier 2016' } }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.candidates[0].quickEstimate, { low: 35, high: 55, currency: 'EUR' });
    assertEquals(body.candidates[0].classification, ['Vin', 'Provence', 'Bandol']);
    assertEquals(trace.visionBodies[0]?.['max_tokens'], RECOGNITION_MAX_TOKENS);
    assertEquals(trace.quotaCalls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : photo de cadran de montre acceptée (rôle dial)', async () => {
  stub({ vision: '{"candidates":[{"label":"Omega Speedmaster","confidence":0.7,"attributes":{"brand":"Omega"}}]}' });
  try {
    const res = await recognize(
      post({
        domain: 'watch',
        input: { kind: 'photo', media: [{ role: 'dial', storagePath: `${USER.id}/cadran.jpg` }] },
      }),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).candidates[0].label, 'Omega Speedmaster');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : 40 photos ou texte démesuré → 400 avant garde-fou, quota et modèle', async () => {
  const trace = stub();
  try {
    const media = Array.from({ length: 40 }, (_, i) => ({ role: 'front', storagePath: `${USER.id}/p${i}.jpg` }));
    for (const input of [{ kind: 'photo', media }, { kind: 'text', text: 'x'.repeat(200_000) }]) {
      const res = await recognize(post({ domain: 'stamp', input }));
      assertEquals(res.status, 400);
      assertEquals((await res.json()).error.code, 'INVALID_INPUT');
    }
    assertEquals(trace.guardCalls, 0);
    assertEquals(trace.quotaCalls, 0);
    assertEquals(trace.downloads, 0);
    assertEquals(trace.visionBodies.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : photo d’un autre compte → 401 avant garde-fou et quota (aucun scan perdu)', async () => {
  const trace = stub();
  try {
    for (const mode of ['sheet', undefined]) {
      const res = await recognize(
        post({
          domain: 'stamp',
          input: { kind: 'photo', media: [{ role: 'detail', storagePath: 'autre-uid/x.jpg' }] },
          ...(mode ? { mode } : {}),
        }),
      );
      assertEquals(res.status, 401);
      assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
    }
    assertEquals(trace.guardCalls, 0);
    assertEquals(trace.quotaCalls, 0);
    assertEquals(trace.downloads, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('recognize : photo introuvable ou trop lourde dans Storage → 400 SANS consommer de scan', async () => {
  try {
    for (const storageBytes of [0, MAX_IMAGE_BYTES + 1]) {
      const trace = stub({ storageBytes });
      const res = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'sheet' }));
      assertEquals(res.status, 400);
      assertEquals((await res.json()).error.code, 'INVALID_INPUT');
      assertEquals(trace.downloads, 1);
      assertEquals(trace.quotaCalls, 0);
      assertEquals(trace.visionBodies.length, 0);
    }
    // Juste sous la limite : accepté, un scan consommé.
    const trace = stub({ storageBytes: MAX_IMAGE_BYTES, vision: SHEET_ANSWER });
    const ok = await recognize(post({ domain: 'stamp', input: SHEET_PHOTO, mode: 'sheet' }));
    assertEquals(ok.status, 200);
    await ok.body?.cancel();
    assertEquals(trace.quotaCalls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
