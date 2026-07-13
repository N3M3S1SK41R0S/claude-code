/**
 * Vision MULTI-FOURNISSEUR : createVisionModel() route vers le bon endpoint
 * selon LLM_VISION_PROVIDER, construit la requête au format attendu et parse la
 * réponse. `fetch` est stubbé — aucun réseau réel.
 *
 *   deno test --import-map=import_map.json --allow-env supabase/functions/tests/vision_test.ts
 */
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { createVisionModel } from '../_shared/llm.ts';

Deno.env.set('LLM_VISION_API_KEY', 'vision-key');
const realFetch = globalThis.fetch;

// deno-lint-ignore no-explicit-any
type Json = any;
interface Captured {
  url: string;
  body: Json;
}

/** Stub `fetch` : capture URL + corps JSON, renvoie `responseBody`. */
function stub(responseBody: unknown, status = 200): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof fetch;
  return calls;
}

const REQ = {
  system: 'Tu es un expert.',
  prompt: 'Décris cet objet.',
  images: [{ base64: 'data:image/jpeg;base64,QUJD', mediaType: 'image/jpeg' }],
};

Deno.test('anthropic (défaut) : endpoint Claude + parsing des blocs texte', async () => {
  Deno.env.delete('LLM_VISION_PROVIDER');
  const calls = stub({ content: [{ type: 'text', text: 'rouge' }, { type: 'text', text: 'Bandol' }] });
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'rouge\nBandol');
    assert(calls[0].url.includes('api.anthropic.com'));
    // Préfixe data-url retiré + system transmis.
    assertEquals(calls[0].body.messages[0].content[0].source.data, 'QUJD');
    assertEquals(calls[0].body.system, 'Tu es un expert.');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('openai : chat/completions, image_url data-url, parsing du message', async () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'openai');
  const calls = stub({ choices: [{ message: { content: 'analyse OpenAI' } }] });
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse OpenAI');
    assert(calls[0].url.includes('api.openai.com'));
    assertEquals(calls[0].body.messages[0].role, 'system');
    assert(calls[0].body.messages[1].content[0].image_url.url.startsWith('data:image/jpeg;base64,QUJD'));
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});

Deno.test('google : gemini generateContent, inlineData, parsing des parts', async () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'google');
  const calls = stub({ candidates: [{ content: { parts: [{ text: 'analyse Gemini' }] } }] });
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse Gemini');
    assert(calls[0].url.includes('generativelanguage.googleapis.com'));
    assert(calls[0].url.includes(':generateContent'));
    assertEquals(calls[0].body.contents[0].parts[0].inlineData.data, 'QUJD');
    assertEquals(calls[0].body.systemInstruction.parts[0].text, 'Tu es un expert.');
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});

Deno.test('openai : les GPT-5 reçoivent max_completion_tokens, pas max_tokens', async () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'openai');
  const calls = stub({ choices: [{ message: { content: 'ok' } }] });
  try {
    // Défaut (gpt-5.5) : l'API rejette max_tokens avec un 400.
    await createVisionModel().complete(REQ);
    assertEquals(calls[0].body.model, 'gpt-5.5');
    assertEquals(calls[0].body.max_tokens, undefined);
    assert(typeof calls[0].body.max_completion_tokens === 'number');

    // Modèle historique : c'est l'inverse — seul max_tokens est accepté.
    Deno.env.set('LLM_VISION_MODEL', 'gpt-4o');
    await createVisionModel().complete(REQ);
    assertEquals(calls[1].body.max_completion_tokens, undefined);
    assert(typeof calls[1].body.max_tokens === 'number');
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete('LLM_VISION_MODEL');
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});

Deno.test('google : le modèle par défaut est un modèle vivant (gemini-2.0-flash → 404)', async () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'google');
  const calls = stub({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
  try {
    await createVisionModel().complete(REQ);
    assert(calls[0].url.includes('gemini-3.5-flash'));
    assert(!calls[0].url.includes('gemini-2.0-flash'));
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});

Deno.test('google : la réflexion Gemini est réservée EN PLUS du budget de réponse', async () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'google');
  const calls = stub({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
  try {
    // Gemini 3 : réserve de réflexion + thinkingLevel bas (sinon MAX_TOKENS ~1 fois sur 4).
    await createVisionModel().complete({ ...REQ, maxTokens: 1024 });
    assertEquals(calls[0].body.generationConfig.maxOutputTokens, 1024 + 2048);
    assertEquals(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');

    // Gemini 2.5 : thinkingLevel rejeté par l'API (400) → jamais envoyé.
    Deno.env.set('LLM_VISION_MODEL', 'gemini-2.5-flash');
    await createVisionModel().complete({ ...REQ, maxTokens: 1024 });
    assertEquals(calls[1].body.generationConfig.maxOutputTokens, 1024 + 2048);
    assertEquals(calls[1].body.generationConfig.thinkingConfig, undefined);
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete('LLM_VISION_MODEL');
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});

Deno.test('fournisseur inconnu : échec de configuration propre', () => {
  Deno.env.set('LLM_VISION_PROVIDER', 'mistral');
  try {
    assertThrows(() => createVisionModel(), Error, 'Fournisseur de vision inconnu');
  } finally {
    Deno.env.delete('LLM_VISION_PROVIDER');
  }
});
