/**
 * Garde-fous de typage à l'exécution — partagés entre le plugin (réponses LLM)
 * et les adaptateurs de sources (réponses HTTP externes). Aucune de ces
 * fonctions ne lève : l'inconnu est dégradé, jamais transformé en certitude.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Borne une confiance dans [0,1] — jamais de fausse certitude (§3.3). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
