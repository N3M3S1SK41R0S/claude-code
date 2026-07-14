/**
 * Vision MULTI-FOURNISSEUR + CASCADE DE REPLI : `createVisionModel()` route vers
 * le bon endpoint, construit la requête au format attendu, parse la réponse, et
 * bascule sur le fournisseur suivant quand le primaire échoue.
 * `fetch` est stubbé — aucun réseau réel.
 *
 *   deno test --import-map=import_map.json --allow-env supabase/functions/tests/vision_test.ts
 */
import { assert, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';
import { createVisionModel } from '../_shared/llm.ts';

const realFetch = globalThis.fetch;

// deno-lint-ignore no-explicit-any
type Json = any;
interface Captured {
  url: string;
  body: Json;
}

/** Réponse simulée pour un appel : succès (corps JSON) ou statut d'erreur. */
interface Reply {
  body: unknown;
  status?: number;
}

/** Stub `fetch` : capture URL + corps, et répond selon `replies` (dans l'ordre). */
function stub(replies: Reply[]): Captured[] {
  const calls: Captured[] = [];
  let i = 0;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const reply = replies[Math.min(i, replies.length - 1)] as Reply;
    i++;
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
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

const OK_ANTHROPIC = { body: { content: [{ type: 'text', text: 'rouge' }] } };
const OK_OPENAI = { body: { choices: [{ message: { content: 'analyse OpenAI' } }] } };
const OK_GOOGLE = { body: { candidates: [{ content: { parts: [{ text: 'analyse Gemini' }] } }] } };

/** Purge toutes les variables de configuration entre les tests. */
function resetEnv(): void {
  for (const k of [
    'LLM_VISION_PROVIDER',
    'LLM_VISION_PROVIDERS',
    'LLM_VISION_API_KEY',
    'LLM_VISION_MODEL',
    'LLM_VISION_KEY_ANTHROPIC',
    'LLM_VISION_KEY_OPENAI',
    'LLM_VISION_KEY_GOOGLE',
    'LLM_VISION_MODEL_ANTHROPIC',
    'LLM_VISION_MODEL_OPENAI',
    'LLM_VISION_MODEL_GOOGLE',
  ]) {
    Deno.env.delete(k);
  }
}

function restore(): void {
  globalThis.fetch = realFetch;
  resetEnv();
}

Deno.test('anthropic (défaut) : endpoint Claude + parsing des blocs texte', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_API_KEY', 'vision-key');
  const calls = stub([{ body: { content: [{ type: 'text', text: 'rouge' }, { type: 'text', text: 'Bandol' }] } }]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'rouge\nBandol');
    assert(calls[0].url.includes('api.anthropic.com'));
    assertEquals(calls[0].body.messages[0].content[0].source.data, 'QUJD'); // préfixe data-url retiré
    assertEquals(calls[0].body.system, 'Tu es un expert.');
  } finally {
    restore();
  }
});

Deno.test('openai : chat/completions, image_url data-url, parsing du message', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDER', 'openai');
  Deno.env.set('LLM_VISION_API_KEY', 'vision-key');
  const calls = stub([OK_OPENAI]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse OpenAI');
    assert(calls[0].url.includes('api.openai.com'));
    assertEquals(calls[0].body.messages[0].role, 'system');
    assert(calls[0].body.messages[1].content[0].image_url.url.startsWith('data:image/jpeg;base64,QUJD'));
  } finally {
    restore();
  }
});

Deno.test('google : gemini generateContent, inlineData, parsing des parts', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDER', 'google');
  Deno.env.set('LLM_VISION_API_KEY', 'vision-key');
  const calls = stub([OK_GOOGLE]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse Gemini');
    assert(calls[0].url.includes('generativelanguage.googleapis.com'));
    assert(calls[0].url.includes(':generateContent'));
    assertEquals(calls[0].body.contents[0].parts[0].inlineData.data, 'QUJD');
    assertEquals(calls[0].body.systemInstruction.parts[0].text, 'Tu es un expert.');
  } finally {
    restore();
  }
});

Deno.test('openai : les GPT-5 reçoivent max_completion_tokens, pas max_tokens', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDER', 'openai');
  Deno.env.set('LLM_VISION_API_KEY', 'k');
  const calls = stub([OK_OPENAI]);
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
    restore();
  }
});

Deno.test('google : réflexion réservée EN PLUS du budget, thinkingLevel réservé à Gemini 3', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDER', 'google');
  Deno.env.set('LLM_VISION_API_KEY', 'k');
  const calls = stub([OK_GOOGLE]);
  try {
    await createVisionModel().complete({ ...REQ, maxTokens: 1024 });
    assert(calls[0].url.includes('gemini-3.5-flash')); // gemini-2.0-flash renvoie 404
    assertEquals(calls[0].body.generationConfig.maxOutputTokens, 1024 + 2048);
    assertEquals(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');

    // Gemini 2.5 rejette thinkingLevel avec un 400 → jamais envoyé.
    Deno.env.set('LLM_VISION_MODEL', 'gemini-2.5-flash');
    await createVisionModel().complete({ ...REQ, maxTokens: 1024 });
    assertEquals(calls[1].body.generationConfig.maxOutputTokens, 1024 + 2048);
    assertEquals(calls[1].body.generationConfig.thinkingConfig, undefined);
  } finally {
    restore();
  }
});

// ── Cascade de repli ────────────────────────────────────────────────────────

Deno.test('cascade : le primaire tombe (503) → le repli prend le relais', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDERS', 'google,openai');
  Deno.env.set('LLM_VISION_KEY_GOOGLE', 'kg');
  Deno.env.set('LLM_VISION_KEY_OPENAI', 'ko');
  const calls = stub([{ body: { error: 'down' }, status: 503 }, OK_OPENAI]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse OpenAI'); // servi par le repli
    assertEquals(calls.length, 2);
    assert(calls[0].url.includes('googleapis.com'));
    assert(calls[1].url.includes('api.openai.com'));
  } finally {
    restore();
  }
});

Deno.test('cascade : une RÉPONSE VIDE compte comme un échec (troncature Gemini)', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDERS', 'google,openai');
  Deno.env.set('LLM_VISION_KEY_GOOGLE', 'kg');
  Deno.env.set('LLM_VISION_KEY_OPENAI', 'ko');
  // Gemini répond 200 mais SANS texte : c'est la signature d'un MAX_TOKENS.
  // Sans ce garde-fou, on renverrait « rien identifié » au lieu de basculer.
  const calls = stub([{ body: { candidates: [{ content: { parts: [] } }] } }, OK_OPENAI]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse OpenAI');
    assertEquals(calls.length, 2);
  } finally {
    restore();
  }
});

Deno.test('cascade : un 429 sur le primaire bascule aussi (quota épuisé)', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDERS', 'openai,anthropic');
  Deno.env.set('LLM_VISION_KEY_OPENAI', 'ko');
  Deno.env.set('LLM_VISION_KEY_ANTHROPIC', 'ka');
  const calls = stub([{ body: { error: 'quota' }, status: 429 }, OK_ANTHROPIC]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'rouge');
    assertEquals(calls.length, 2);
    assert(calls[1].url.includes('api.anthropic.com'));
  } finally {
    restore();
  }
});

Deno.test('cascade : tous les fournisseurs échouent → la panne REMONTE (pas de silence)', async () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDERS', 'google,openai');
  Deno.env.set('LLM_VISION_KEY_GOOGLE', 'kg');
  Deno.env.set('LLM_VISION_KEY_OPENAI', 'ko');
  stub([{ body: { error: 'down' }, status: 503 }]);
  try {
    await assertRejects(() => createVisionModel().complete(REQ), Error);
  } finally {
    restore();
  }
});

Deno.test('cascade : un fournisseur sans clé est écarté, pas fatal', async () => {
  resetEnv();
  // openai est listé en repli mais n'a pas de clé dédiée → simplement ignoré.
  Deno.env.set('LLM_VISION_PROVIDERS', 'google,openai');
  Deno.env.set('LLM_VISION_KEY_GOOGLE', 'kg');
  const calls = stub([OK_GOOGLE]);
  try {
    const out = await createVisionModel().complete(REQ);
    assertEquals(out, 'analyse Gemini');
    assertEquals(calls.length, 1);
  } finally {
    restore();
  }
});

Deno.test('aucune clé configurée : échec propre', () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDERS', 'google');
  try {
    assertThrows(() => createVisionModel(), Error, 'aucune clé API configurée');
  } finally {
    restore();
  }
});

Deno.test('fournisseur inconnu : échec de configuration propre', () => {
  resetEnv();
  Deno.env.set('LLM_VISION_PROVIDER', 'mistral');
  Deno.env.set('LLM_VISION_API_KEY', 'k');
  try {
    assertThrows(() => createVisionModel(), Error, 'Fournisseur de vision inconnu');
  } finally {
    restore();
  }
});
