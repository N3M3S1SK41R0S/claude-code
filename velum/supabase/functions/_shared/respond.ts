/**
 * Réponses JSON normalisées des Edge Functions VELUM.
 * Format d'erreur stable côté client : { error: { code, message } } —
 * `code` est un VelumErrorCode utilisable pour l'i18n des messages.
 */
import { isVelumError } from '@velum/core';
import { corsHeaders } from './cors.ts';

/** Réponse JSON avec en-têtes CORS. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Réponse d'erreur au format { error: { code, message } }. */
export function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

/** Statut HTTP correspondant à un VelumErrorCode. */
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  BUDGET_EXCEEDED: 402,
  PLAN_REQUIRED: 403,
  NO_OBSERVATIONS: 404,
  RATE_LIMITED: 429,
  RECOGNITION_FAILED: 502,
  ANALYSIS_FAILED: 502,
  SOURCE_UNAVAILABLE: 503,
};

/** Convertit une erreur attrapée en réponse HTTP normalisée. */
export function errorFromException(err: unknown): Response {
  if (isVelumError(err)) {
    return error(err.code, err.message, STATUS_BY_CODE[err.code] ?? 500);
  }
  console.error('[velum] erreur inattendue :', err);
  return error('INTERNAL', 'Erreur interne du serveur', 500);
}
