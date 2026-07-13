/**
 * Logique pure du badge de confiance (§3.3 : la confiance est TOUJOURS
 * affichée, jamais de fausse certitude). Extraite du composant pour être
 * testée sans rendu React Native.
 */

export type ConfidenceTone = 'success' | 'warning' | 'danger';

/** Palier de couleur : ≥ 0.7 → success, ≥ 0.4 → warning, sinon danger. */
export function confidenceTone(value: number): ConfidenceTone {
  if (value >= 0.7) return 'success';
  if (value >= 0.4) return 'warning';
  return 'danger';
}

/** Formate une confiance 0..1 (bornée) en « NN % ». */
export function formatConfidence(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  return `${Math.round(clamped * 100)} %`;
}
