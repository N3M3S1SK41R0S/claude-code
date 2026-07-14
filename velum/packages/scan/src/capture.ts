/**
 * Capture guidée multi-angle temps réel — Pari #5.
 *
 * La caméra native (Expo) mesure des indicateurs de trame (netteté, reflet,
 * cadrage) ; la DÉCISION d'accepter/refuser une photo et le guidage sont ici,
 * en logique PURE et testable. L'app refuse la mauvaise photo au lieu
 * d'estimer sur une image insuffisante — socle de qualité de tout le pipeline
 * aval (grading, variétés, anti-faux).
 *
 * Aucune dépendance native : `assessFrame` prend des métriques déjà mesurées.
 */
import type { MediaRole, VelumDomain } from '@velum/core';

/** Métriques normalisées d'une trame caméra (0..1). */
export interface FrameMetrics {
  /** Netteté 0..1 (1 = parfaitement net). */
  sharpness: number;
  /** Reflet / halo spéculaire 0..1 (0 = aucun reflet). */
  glare: number;
  /** Part du cadre occupée par l'objet 0..1. */
  coverage: number;
}

export type CaptureIssue = 'blurry' | 'glare' | 'too_far' | 'too_close';

export interface CaptureDecision {
  accept: boolean;
  issues: CaptureIssue[];
  /** Guidage temps réel affichable (français). */
  guidance: string[];
  /** Qualité globale 0..1 (informe la barre de qualité). */
  quality: number;
}

export interface CaptureThresholds {
  minSharpness: number;
  maxGlare: number;
  minCoverage: number;
  maxCoverage: number;
}

export const DEFAULT_CAPTURE_THRESHOLDS: CaptureThresholds = {
  minSharpness: 0.6,
  maxGlare: 0.35,
  minCoverage: 0.35,
  maxCoverage: 0.92,
};

const GUIDANCE: Record<CaptureIssue, string> = {
  blurry: 'Image floue — stabilisez l’appareil et laissez la mise au point se faire.',
  glare: 'Reflet détecté — inclinez légèrement l’objet ou éloignez la source de lumière.',
  too_far: 'Objet trop petit dans le cadre — rapprochez-vous.',
  too_close: 'Objet trop près / rogné — reculez légèrement pour tout cadrer.',
};

const OK_GUIDANCE = 'Cadrage net — vous pouvez capturer.';

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Évalue une trame et décide accepter/refuser + guidage. */
export function assessFrame(
  m: FrameMetrics,
  thresholds: CaptureThresholds = DEFAULT_CAPTURE_THRESHOLDS,
): CaptureDecision {
  const issues: CaptureIssue[] = [];
  if (m.sharpness < thresholds.minSharpness) issues.push('blurry');
  if (m.glare > thresholds.maxGlare) issues.push('glare');
  if (m.coverage < thresholds.minCoverage) issues.push('too_far');
  else if (m.coverage > thresholds.maxCoverage) issues.push('too_close');

  // Cadrage idéal : couverage centrée entre min et max.
  const mid = (thresholds.minCoverage + thresholds.maxCoverage) / 2;
  const framing = 1 - Math.min(1, Math.abs(m.coverage - mid) / mid);
  const quality = Number(
    (clamp01(m.sharpness) * 0.5 + (1 - clamp01(m.glare)) * 0.3 + clamp01(framing) * 0.2).toFixed(3),
  );

  const accept = issues.length === 0;
  return {
    accept,
    issues,
    guidance: accept ? [OK_GUIDANCE] : issues.map((i) => GUIDANCE[i]),
    quality,
  };
}

/**
 * Séquence de clichés typés par rôle attendue par domaine (§6.1.2) — c'est
 * ce qui manque à Google Lens (une seule photo). Le grading fin et l'anti-faux
 * dépendent de la présence de ces angles.
 */
export const REQUIRED_ROLES: Record<VelumDomain, MediaRole[]> = {
  wine: ['label', 'capsule'],
  coin: ['obverse', 'reverse', 'edge'],
  art: ['front', 'back', 'signature'],
  stamp: ['front', 'back'],
};

const ROLE_GUIDANCE: Partial<Record<MediaRole, string>> = {
  label: 'Photographiez l’étiquette bien à plat.',
  capsule: 'Photographiez la capsule (millésime, domaine).',
  obverse: 'Photographiez l’avers (face).',
  reverse: 'Photographiez le revers (pile).',
  edge: 'Photographiez la tranche (lisse, cannelée ou inscrite).',
  front: 'Photographiez l’objet de face, entier.',
  back: 'Photographiez le dos (verso, gomme, cachets).',
  signature: 'Cadrez la signature ou la marque.',
  frame: 'Photographiez le cadre.',
  detail: 'Cadrez le détail utile (dentelure, défaut…).',
};

export interface SequenceProgress {
  captured: MediaRole[];
  missing: MediaRole[];
  complete: boolean;
  /** Prochain rôle à capturer (le premier manquant). */
  nextRole?: MediaRole;
  /** Consigne pour le prochain cliché. */
  guidance?: string;
}

/** Progression de la séquence multi-angle pour un domaine donné. */
export function sequenceProgress(domain: VelumDomain, captured: MediaRole[]): SequenceProgress {
  const required = REQUIRED_ROLES[domain];
  const capturedSet = new Set(captured);
  const missing = required.filter((r) => !capturedSet.has(r));
  const nextRole = missing[0];
  return {
    captured: required.filter((r) => capturedSet.has(r)),
    missing,
    complete: missing.length === 0,
    ...(nextRole ? { nextRole, guidance: ROLE_GUIDANCE[nextRole] ?? `Photographiez : ${nextRole}.` } : {}),
  };
}
