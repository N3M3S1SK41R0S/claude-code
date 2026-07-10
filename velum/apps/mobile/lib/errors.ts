/**
 * Traduction des erreurs métier VelumError en messages i18n lisibles.
 * Utilisé par le wrapper de toasts (jamais d'écran bloquant, §3.3).
 */
import { isVelumError, type VelumErrorCode } from '@velum/core';
import type { TFunction } from 'i18next';

const KNOWN_CODES: readonly VelumErrorCode[] = [
  'NO_OBSERVATIONS',
  'RECOGNITION_FAILED',
  'ANALYSIS_FAILED',
  'SOURCE_UNAVAILABLE',
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'BUDGET_EXCEEDED',
];

/** Code métier de l'erreur, ou null si erreur inconnue. */
export function velumErrorCode(error: unknown): VelumErrorCode | null {
  return isVelumError(error) ? error.code : null;
}

/** Message utilisateur i18n pour une erreur quelconque. */
export function errorMessage(error: unknown, t: TFunction): string {
  const code = velumErrorCode(error);
  if (code !== null && KNOWN_CODES.includes(code)) return t(`errors.${code}`);
  return t('errors.generic');
}
