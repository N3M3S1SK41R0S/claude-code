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
  'PLAN_REQUIRED',
];

/** Code métier de l'erreur, ou null si erreur inconnue. */
export function velumErrorCode(error: unknown): VelumErrorCode | null {
  return isVelumError(error) ? error.code : null;
}

/**
 * Motif d'un refus MÉTIER rédigé pour l'utilisateur par nos règles serveur
 * (`raise exception … using errcode = 'P0001'`, ex. « Annonce déjà réservée
 * par un autre membre »). Les autres erreurs (contraintes, techniques) ne
 * sont jamais détaillées : seul le libellé i18n générique est montré.
 */
export function businessRefusalReason(error: unknown): string | null {
  if (!isVelumError(error) || error.code !== 'INVALID_INPUT') return null;
  const details = error.details as { sqlstate?: unknown } | undefined;
  if (details?.sqlstate !== 'P0001') return null;
  // Le dépôt préfixe le contexte (« Achat impossible : … ») : on garde le motif.
  const separator = error.message.lastIndexOf(' : ');
  const reason = (separator === -1 ? error.message : error.message.slice(separator + 3)).trim();
  return reason.length > 0 ? reason : null;
}

/** Message utilisateur i18n pour une erreur quelconque. */
export function errorMessage(error: unknown, t: TFunction): string {
  const code = velumErrorCode(error);
  if (code !== null && KNOWN_CODES.includes(code)) {
    const reason = businessRefusalReason(error);
    return reason === null ? t(`errors.${code}`) : `${t(`errors.${code}`)} — ${reason}`;
  }
  return t('errors.generic');
}
