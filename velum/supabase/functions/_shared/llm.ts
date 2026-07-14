/**
 * Implémentation serveur du contrat VisionModel (@velum/core), MULTI-FOURNISSEUR
 * avec CASCADE DE REPLI et LOGS STRUCTURÉS.
 *
 * Chaîne de fournisseurs : `LLM_VISION_PROVIDERS` (liste, du primaire au dernier
 * repli). Si un fournisseur échoue — panne, quota, clé morte, modèle supprimé,
 * réponse tronquée — le suivant est tenté. Sans repli configuré, le comportement
 * est identique à avant.
 *
 *   LLM_VISION_PROVIDERS=google,openai
 *   LLM_VISION_KEY_GOOGLE=...      LLM_VISION_MODEL_GOOGLE=gemini-3.5-flash
 *   LLM_VISION_KEY_OPENAI=...      LLM_VISION_MODEL_OPENAI=gpt-5.5
 *
 * Rétro-compatibilité : `LLM_VISION_PROVIDER` (singulier) + `LLM_VISION_API_KEY`
 * + `LLM_VISION_MODEL` restent acceptés pour le fournisseur primaire.
 *
 * Les clés ne vivent QUE côté serveur (§12.1) : les plugins de domaine reçoivent
 * l'implémentation par injection et n'appellent jamais le réseau directement.
 */
import { VelumError, isVelumError, type VisionModel } from '@velum/core';
import { recordVisionCall, type TokenUsage, type VisionContext } from './usage.ts';

const DEFAULT_MAX_TOKENS = 2048;

export interface VisionRequest {
  system: string;
  prompt: string;
  images?: { base64: string; mediaType: string }[];
  maxTokens?: number;
}

export type VisionProvider = 'anthropic' | 'openai' | 'google';

interface ProviderConfig {
  provider: VisionProvider;
  apiKey: string;
  model: string;
}

/** Ce qu'un fournisseur renvoie réellement : le texte ET ce qu'il a consommé. */
interface VisionOutcome {
  text: string;
  usage?: TokenUsage;
}

/** Fournisseur interne : expose la consommation, que `VisionModel` ne porte pas. */
interface VisionBackend {
  run(req: VisionRequest): Promise<VisionOutcome>;
}

// ── Observabilité ────────────────────────────────────────────────────────────

/**
 * Log JSON sur une ligne — lisible tel quel dans les logs Edge Functions de
 * Supabase, et requêtable. Ne contient JAMAIS de clé ni de contenu d'image.
 */
function logEvent(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...entry }));
}

/** Code VelumError d'une erreur quelconque (pour les logs et la décision de repli). */
function codeOf(err: unknown): string {
  return isVelumError(err) ? err.code : 'UNEXPECTED';
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

/** Retire un éventuel préfixe data-URL ("data:image/jpeg;base64,..."). */
function stripDataUrlPrefix(base64: string): string {
  const comma = base64.indexOf(',');
  if (base64.startsWith('data:') && comma !== -1) {
    return base64.slice(comma + 1);
  }
  return base64;
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

export class AnthropicVision implements VisionBackend {
  constructor(private readonly cfg: ProviderConfig) {}

  async run(req: VisionRequest): Promise<VisionOutcome> {
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
        'x-api-key': this.cfg.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: req.system,
        messages: [{ role: 'user', content }],
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as {
      content?: AnthropicContentBlock[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    const text = blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n');

    return {
      text,
      usage: { input: payload.usage?.input_tokens, output: payload.usage?.output_tokens },
    };
  }
}

// ── OpenAI (Chat Completions, vision) ────────────────────────────────────────

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Les modèles GPT-5 et o-series rejettent `max_tokens` (400) et exigent
 * `max_completion_tokens` ; gpt-4o et antérieurs n'acceptent que `max_tokens`.
 */
function openAiTokenLimitField(model: string): 'max_completion_tokens' | 'max_tokens' {
  return /^(gpt-5|o[134])/.test(model) ? 'max_completion_tokens' : 'max_tokens';
}

export class OpenAIVision implements VisionBackend {
  constructor(private readonly cfg: ProviderConfig) {}

  async run(req: VisionRequest): Promise<VisionOutcome> {
    const userContent: unknown[] = (req.images ?? []).map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${stripDataUrlPrefix(img.base64)}` },
    }));
    userContent.push({ type: 'text', text: req.prompt });

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        [openAiTokenLimitField(this.cfg.model)]: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: userContent },
        ],
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: payload.choices?.[0]?.message?.content ?? '',
      usage: { input: payload.usage?.prompt_tokens, output: payload.usage?.completion_tokens },
    };
  }
}

// ── Google (Gemini generateContent, vision) ──────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
}

/**
 * Gemini décompte les tokens de RAISONNEMENT du même budget `maxOutputTokens`.
 * Sur gemini-3.5-flash, une identification d'étiquette consomme ~900 tokens de
 * réflexion : avec un budget de 1024 demandé par l'appelant, la réponse était
 * tronquée (`finishReason: MAX_TOKENS`, texte vide) environ une fois sur quatre.
 * On réserve donc la réflexion EN PLUS du budget demandé, pour que `maxTokens`
 * reste ce qu'il prétend être : la place disponible pour la réponse.
 */
const GEMINI_THINKING_RESERVE = 2048;

/** `thinkingLevel` n'existe que sur Gemini 3 — un Gemini 2.5 le rejette (400). */
function geminiSupportsThinkingLevel(model: string): boolean {
  return /^gemini-3/.test(model);
}

export class GoogleVision implements VisionBackend {
  constructor(private readonly cfg: ProviderConfig) {}

  async run(req: VisionRequest): Promise<VisionOutcome> {
    const parts: unknown[] = (req.images ?? []).map((img) => ({
      inlineData: { mimeType: img.mediaType, data: stripDataUrlPrefix(img.base64) },
    }));
    parts.push({ text: req.prompt });

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: (req.maxTokens ?? DEFAULT_MAX_TOKENS) + GEMINI_THINKING_RESERVE,
    };
    if (geminiSupportsThinkingLevel(this.cfg.model)) {
      // Divise la réflexion par ~6 (≈900 → ≈150 tokens) sans perte de qualité
      // mesurable sur l'identification, et réduit d'autant le coût.
      generationConfig['thinkingConfig'] = { thinkingLevel: 'low' };
    }

    const url = `${GEMINI_BASE}/${this.cfg.model}:generateContent?key=${encodeURIComponent(this.cfg.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
    });
    await ensureOk(response);

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };
    const out = payload.candidates?.[0]?.content?.parts ?? [];
    const text = out
      .filter((p) => typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('\n');

    // Google facture la RÉFLEXION comme de la sortie : on l'additionne, sinon on
    // sous-estimerait le coût d'un facteur ~6 sur une identification d'étiquette.
    const meta = payload.usageMetadata;
    const output =
      meta === undefined
        ? undefined
        : (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);

    return { text, usage: { input: meta?.promptTokenCount, output } };
  }
}

// ── Cascade de repli ─────────────────────────────────────────────────────────

const DEFAULT_MODEL: Record<VisionProvider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.5',
  google: 'gemini-3.5-flash',
};

function instantiate(cfg: ProviderConfig): VisionBackend {
  switch (cfg.provider) {
    case 'anthropic':
      return new AnthropicVision(cfg);
    case 'openai':
      return new OpenAIVision(cfg);
    case 'google':
      return new GoogleVision(cfg);
  }
}

/**
 * Essaie les fournisseurs dans l'ordre. Chaque tentative est journalisée
 * (fournisseur, modèle, durée, issue) — c'est la seule fenêtre qu'on ait sur ce
 * qui se passe en production.
 *
 * Une réponse VIDE est traitée comme un échec, pas comme un « le modèle n'a rien
 * vu » : c'est la signature d'une troncature (budget de tokens épuisé) ou d'un
 * refus silencieux. Sans ça, le bug Gemini serait passé pour un résultat normal.
 */
export class CascadingVision implements VisionModel {
  constructor(
    private readonly chain: ProviderConfig[],
    private readonly context: VisionContext,
  ) {}

  async complete(req: VisionRequest): Promise<string> {
    let lastError: unknown = new VelumError(
      'SOURCE_UNAVAILABLE',
      'Aucun fournisseur de vision configuré',
    );

    for (let i = 0; i < this.chain.length; i++) {
      const cfg = this.chain[i] as ProviderConfig;
      const startedAt = Date.now();
      let usage: TokenUsage | undefined;
      try {
        const outcome = await instantiate(cfg).run(req);
        usage = outcome.usage;
        if (outcome.text.trim() === '') {
          throw new VelumError(
            'SOURCE_UNAVAILABLE',
            'Réponse vide du modèle (troncature ou refus)',
          );
        }
        const durationMs = Date.now() - startedAt;
        logEvent({
          event: 'vision.success',
          provider: cfg.provider,
          model: cfg.model,
          attempt: i + 1,
          usedFallback: i > 0,
          ms: durationMs,
          chars: outcome.text.length,
          tokensIn: usage?.input ?? null,
          tokensOut: usage?.output ?? null,
        });
        recordVisionCall({
          ...this.context,
          provider: cfg.provider,
          model: cfg.model,
          attempt: i + 1,
          usedFallback: i > 0,
          ok: true,
          durationMs,
          ...(usage ? { usage } : {}),
        });
        return outcome.text;
      } catch (err) {
        lastError = err;
        const durationMs = Date.now() - startedAt;
        logEvent({
          event: 'vision.failure',
          provider: cfg.provider,
          model: cfg.model,
          attempt: i + 1,
          ms: durationMs,
          code: codeOf(err),
          message: messageOf(err).slice(0, 300),
          willRetryWith: this.chain[i + 1]?.provider ?? null,
        });
        // Un échec est enregistré AUSSI : une réponse tronquée a été facturée
        // par le fournisseur, même si elle ne nous sert à rien.
        recordVisionCall({
          ...this.context,
          provider: cfg.provider,
          model: cfg.model,
          attempt: i + 1,
          usedFallback: i > 0,
          ok: false,
          errorCode: codeOf(err),
          durationMs,
          ...(usage ? { usage } : {}),
        });
      }
    }

    logEvent({
      event: 'vision.exhausted',
      providers: this.chain.map((c) => c.provider),
      code: codeOf(lastError),
    });
    throw lastError;
  }
}

// ── Fabrique ────────────────────────────────────────────────────────────────

const ALIASES: Record<string, VisionProvider> = {
  anthropic: 'anthropic',
  claude: 'anthropic',
  openai: 'openai',
  gpt: 'openai',
  google: 'google',
  gemini: 'google',
};

function parseProvider(raw: string): VisionProvider {
  const key = raw.trim().toLowerCase();
  const provider = ALIASES[key];
  if (!provider) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      `Fournisseur de vision inconnu : « ${key} » (attendu : anthropic | openai | google)`,
    );
  }
  return provider;
}

/** Clé d'un fournisseur : dédiée, sinon la clé commune (fournisseur primaire). */
function keyFor(provider: VisionProvider, isPrimary: boolean): string | undefined {
  const dedicated = Deno.env.get(`LLM_VISION_KEY_${provider.toUpperCase()}`);
  if (dedicated) return dedicated;
  return isPrimary ? Deno.env.get('LLM_VISION_API_KEY') ?? undefined : undefined;
}

/** Modèle d'un fournisseur : dédié, sinon commun (primaire), sinon défaut. */
function modelFor(provider: VisionProvider, isPrimary: boolean): string {
  const dedicated = Deno.env.get(`LLM_VISION_MODEL_${provider.toUpperCase()}`);
  if (dedicated) return dedicated;
  const shared = isPrimary ? Deno.env.get('LLM_VISION_MODEL') : undefined;
  return shared ?? DEFAULT_MODEL[provider];
}

/**
 * Construit la chaîne de vision depuis l'environnement.
 * Un fournisseur sans clé est ÉCARTÉ (et journalisé) plutôt que de faire échouer
 * toute la chaîne : mieux vaut un repli fonctionnel qu'une panne totale.
 */
export function createVisionModel(context: VisionContext = { operation: 'unknown' }): VisionModel {
  const list = Deno.env.get('LLM_VISION_PROVIDERS') ?? Deno.env.get('LLM_VISION_PROVIDER') ?? 'anthropic';
  const requested = list
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (requested.length === 0) requested.push('anthropic');

  const chain: ProviderConfig[] = [];
  requested.forEach((raw, index) => {
    const provider = parseProvider(raw);
    const apiKey = keyFor(provider, index === 0);
    if (!apiKey) {
      logEvent({ event: 'vision.provider_skipped', provider, reason: 'clé absente' });
      return;
    }
    chain.push({ provider, apiKey, model: modelFor(provider, index === 0) });
  });

  if (chain.length === 0) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      'Le service de vision est indisponible (aucune clé API configurée)',
    );
  }

  return new CascadingVision(chain, context);
}
