/**
 * Appels aux Edge Functions VELUM via `supabase.functions.invoke` :
 *   - recognize                       → étage 1 du pipeline (§10.1)
 *   - analyze-wine|coin|art|stamp     → fiche d'analyse, routée par domaine
 *   - valuate                         → moteur de valorisation (§7)
 *   - delete-account                  → purge RGPD (utilisée par auth.deleteAccount)
 *
 * Les erreurs normalisées { error: { code, message } } (voir
 * supabase/functions/_shared/respond.ts) sont converties en VelumError.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VelumError,
  type AnalysisResult,
  type Candidate,
  type CaptureInput,
  type PairingResult,
  type RecognitionResult,
  type ValuationResult,
  type VelumDomain,
  type VelumErrorCode,
} from '@velum/core';

/** Codes métier connus — tout autre code serveur est replié sur SOURCE_UNAVAILABLE. */
const KNOWN_CODES: ReadonlySet<string> = new Set([
  'NO_OBSERVATIONS',
  'RECOGNITION_FAILED',
  'ANALYSIS_FAILED',
  'SOURCE_UNAVAILABLE',
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'BUDGET_EXCEEDED',
  'PLAN_REQUIRED',
]);

function normalizeCode(code: string): VelumErrorCode {
  return (KNOWN_CODES.has(code) ? code : 'SOURCE_UNAVAILABLE') as VelumErrorCode;
}

/** Extrait { error: { code, message } } d'un corps de réponse quelconque. */
function readErrorEnvelope(body: unknown): { code: string; message: string } | null {
  if (!body || typeof body !== 'object') return null;
  const envelope = (body as { error?: unknown }).error;
  if (!envelope || typeof envelope !== 'object') return null;
  const { code, message } = envelope as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { code, message };
}

/**
 * Convertit une erreur d'invocation en VelumError. Les FunctionsHttpError
 * portent la Response dans `context` — on y lit le corps normalisé.
 */
async function toVelumError(err: unknown): Promise<VelumError> {
  const context = (err as { context?: unknown } | null)?.context;
  if (context && typeof (context as { json?: unknown }).json === 'function') {
    try {
      const body: unknown = await (context as { json: () => Promise<unknown> }).json();
      const envelope = readErrorEnvelope(body);
      if (envelope) {
        return new VelumError(normalizeCode(envelope.code), envelope.message, {
          serverCode: envelope.code,
        });
      }
    } catch {
      // corps non JSON → repli générique ci-dessous
    }
  }
  const message = err instanceof Error ? err.message : 'Fonction Edge indisponible';
  return new VelumError('SOURCE_UNAVAILABLE', message);
}

/** Invoque une Edge Function et renvoie son corps, ou lève un VelumError. */
export async function invokeEdgeFunction<T>(
  supabase: SupabaseClient,
  fn: string,
  body?: Record<string, unknown>,
): Promise<T> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await supabase.functions.invoke(fn, body === undefined ? {} : { body }));
  } catch (thrown) {
    throw await toVelumError(thrown);
  }
  if (error) throw await toVelumError(error);
  // Défense : certains transports renvoient le corps d'erreur en `data`.
  const envelope = readErrorEnvelope(data);
  if (envelope) {
    throw new VelumError(normalizeCode(envelope.code), envelope.message, {
      serverCode: envelope.code,
    });
  }
  return data as T;
}

export interface EdgeApi {
  /** Identification (top-3 candidats) — Edge Function `recognize`. */
  recognize(domain: VelumDomain, input: CaptureInput): Promise<RecognitionResult>;
  /** Fiche d'analyse — routée vers `analyze-<domaine>`. */
  analyze(domain: VelumDomain, candidate: Candidate): Promise<AnalysisResult>;
  /** Valorisation §7 — Edge Function `valuate` (persiste si itemId fourni). */
  valuate(domain: VelumDomain, candidate: Candidate, itemId?: string): Promise<ValuationResult>;
  /**
   * Sommelier de cave (Gold+) — Edge Function `cellar-pairing` :
   * « quel vin de MA cave pour ce plat ? ». Lève VelumError PLAN_REQUIRED
   * si l'offre ne comprend pas le carnet virtuel.
   */
  cellarPairing(dish: string): Promise<PairingResult>;
}

export function createEdgeApi(supabase: SupabaseClient): EdgeApi {
  return {
    recognize(domain, input) {
      return invokeEdgeFunction<RecognitionResult>(supabase, 'recognize', { domain, input });
    },
    analyze(domain, candidate) {
      return invokeEdgeFunction<AnalysisResult>(supabase, `analyze-${domain}`, { candidate });
    },
    valuate(domain, candidate, itemId) {
      const body: Record<string, unknown> = { domain, candidate };
      if (itemId !== undefined) body['itemId'] = itemId;
      return invokeEdgeFunction<ValuationResult>(supabase, 'valuate', body);
    },
    cellarPairing(dish) {
      return invokeEdgeFunction<PairingResult>(supabase, 'cellar-pairing', { dish });
    },
  };
}
