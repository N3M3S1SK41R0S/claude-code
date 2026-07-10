/**
 * Implémentation serveur du contrat VisionModel (@velum/core) sur l'API
 * Anthropic Messages (POST https://api.anthropic.com/v1/messages).
 *
 * La clé API ne vit QUE côté serveur (secret LLM_VISION_API_KEY, §12.1) —
 * les plugins de domaine reçoivent cette implémentation par injection et
 * n'appellent jamais le réseau directement.
 */
import { VelumError, type VisionModel } from '@velum/core';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_TOKENS = 2048;

/** Retire un éventuel préfixe data-URL ("data:image/jpeg;base64,..."). */
function stripDataUrlPrefix(base64: string): string {
  const comma = base64.indexOf(',');
  if (base64.startsWith('data:') && comma !== -1) {
    return base64.slice(comma + 1);
  }
  return base64;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export class AnthropicVision implements VisionModel {
  async complete(req: {
    system: string;
    prompt: string;
    images?: { base64: string; mediaType: string }[];
    maxTokens?: number;
  }): Promise<string> {
    const apiKey = Deno.env.get('LLM_VISION_API_KEY');
    if (!apiKey) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        'Le service de vision est indisponible (clé API non configurée)',
      );
    }
    const model = Deno.env.get('LLM_VISION_MODEL') ?? DEFAULT_MODEL;

    // Blocs image (base64) AVANT le bloc texte — ordre recommandé par l'API.
    const content: unknown[] = (req.images ?? []).map((img) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: stripDataUrlPrefix(img.base64),
      },
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

    if (response.status === 429) {
      throw new VelumError('RATE_LIMITED', 'Limite de débit du service de vision atteinte');
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        `Le service de vision a répondu ${response.status}`,
        { status: response.status, body: body.slice(0, 500) },
      );
    }

    const payload = (await response.json()) as { content?: AnthropicContentBlock[] };
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    // Concaténation de tous les blocs texte de la réponse.
    return blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n');
  }
}
