/**
 * Implémentation serveur du contrat VisionModel (@velum/core), MULTI-FOURNISSEUR.
 * Le fournisseur est choisi par le secret `LLM_VISION_PROVIDER` (défaut :
 * `anthropic`) ; la clé (`LLM_VISION_API_KEY`) et le modèle (`LLM_VISION_MODEL`,
 * facultatif) sont communs. La clé ne vit QUE côté serveur (§12.1) — les plugins
 * de domaine reçoivent l'implémentation par injection et n'appellent jamais le
 * réseau directement.
 *
 *   LLM_VISION_PROVIDER=anthropic  → Claude Messages   (défaut claude-sonnet-5)
 *   LLM_VISION_PROVIDER=openai     → Chat Completions   (défaut gpt-4o)
 *   LLM_VISION_PROVIDER=google     → Gemini generateContent (défaut gemini-2.0-flash)
 */
import { VelumError, type VisionModel } from '@velum/core';

const DEFAULT_MAX_TOKENS = 2048;

export interface VisionRequest {
  system: string;
  prompt: string;
  images?: { base64: string; mediaType: string }[];
  maxTokens?: number;
}

/** Retire un éventuel préfixe data-URL ("data:image/jpeg;base64,..."). */
function stripDataUrlPrefix(base64: string): string {
  const comma = base64.indexOf(',');
  if (base64.startsWith('data:') && comma !== -1) {
    return base64.slice(comma + 1);
  }
  return base64;
}

/** Clé API commune — absente ⇒ service indisponible (jamais de throw brut). */
function requireApiKey(): string {
  const apiKey = Deno.env.get('LLM_VISION_API_KEY');
  if (!apiKey) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      'Le service de vision est indisponible (clé API non configurée)',
    );
  }
  return apiKey;
}

/** Modèle depuis l'env, sinon défaut propre au fournisseur. */
function modelFor(fallback: string): string {
  return Deno.env.get('LLM_VISION_MODEL') ?? fallback;
}

/** Mappe les statuts d'erreur HTTP sur des VelumError (429 → RATE_LIMITED). */
async function ensureOk(response: Response): Promise<void> {
  if (response.status === 429) {
    throw new VelumError('RATE_LIMITED', 'Limite de débit du service de vision atteinte');
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new VelumError('SOURCE_UNAVAILABLE', `Le service de vision a répondu ${response.status}`, {
      status: response.status,
      body: body.slice(0, 500),
    });
  }
}

// ── Anthropic (Claude Messages) ──────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export class AnthropicVision implements VisionModel {
  async complete(req: VisionRequest): Promise<string> {
    const apiKey = requireApiKey();
    const model = modelFor('claude-sonnet-5');

    // Blocs image (base64) AVANT le bloc texte — ordre recommandé par l'API.
    const content: unknown[] = (req.images ?? []).map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: stripDataUrlPrefix(img.base64) },
    }));
    content.push({ type: 'text', text: req.prompt });

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: req.system,
        messages: [{ role: 'user', content }],
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as { content?: AnthropicContentBlock[] };
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    return blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n');
  }
}

// ── OpenAI (Chat Completions, vision) ────────────────────────────────────────

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIVision implements VisionModel {
  async complete(req: VisionRequest): Promise<string> {
    const apiKey = requireApiKey();
    const model = modelFor('gpt-4o');

    const userContent: unknown[] = (req.images ?? []).map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${stripDataUrlPrefix(img.base64)}` },
    }));
    userContent.push({ type: 'text', text: req.prompt });

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: userContent },
        ],
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return payload.choices?.[0]?.message?.content ?? '';
  }
}

// ── Google (Gemini generateContent, vision) ──────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
}

export class GoogleVision implements VisionModel {
  async complete(req: VisionRequest): Promise<string> {
    const apiKey = requireApiKey();
    const model = modelFor('gemini-2.0-flash');

    const parts: unknown[] = (req.images ?? []).map((img) => ({
      inlineData: { mimeType: img.mediaType, data: stripDataUrlPrefix(img.base64) },
    }));
    parts.push({ text: req.prompt });

    const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS },
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const out = payload.candidates?.[0]?.content?.parts ?? [];
    return out
      .filter((p) => typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('\n');
  }
}

// ── Fabrique ────────────────────────────────────────────────────────────────

export type VisionProvider = 'anthropic' | 'openai' | 'google';

/**
 * Implémentation VisionModel selon `LLM_VISION_PROVIDER` (défaut `anthropic`).
 * Un fournisseur inconnu échoue proprement (garde-fou de configuration).
 */
export function createVisionModel(): VisionModel {
  const provider = (Deno.env.get('LLM_VISION_PROVIDER') ?? 'anthropic').trim().toLowerCase();
  switch (provider) {
    case '':
    case 'anthropic':
    case 'claude':
      return new AnthropicVision();
    case 'openai':
    case 'gpt':
      return new OpenAIVision();
    case 'google':
    case 'gemini':
      return new GoogleVision();
    default:
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        `Fournisseur de vision inconnu : « ${provider} » (attendu : anthropic | openai | google)`,
      );
  }
}
