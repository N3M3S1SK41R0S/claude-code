/**
 * Présentation PURE du signal d'arbitre (pari #3) et repli démo conservateur.
 *
 * - `arbiterView` : mappe un ArbiterSignal (serveur ou moteur pur) vers des
 *   clés i18n et des tons de badge — aucune logique métier ici, elle vit dans
 *   @velum/valuation (garde-fou anti-market-timing inclus).
 * - `demoArbiterSignal` : en mode démo (client sans Edge `arbitrate`), rejoue
 *   le MOTEUR PUR sur les données réellement présentes — l'historique de
 *   valorisations du carnet démo et la fenêtre d'apogée de l'analyse. AUCUNE
 *   trajectoire n'est inventée : moins de 3 points → tendance 'unknown' et
 *   verdict prudent, exactement comme en production.
 */
import type { ArbiterSignal, ValuationRecord, WineAnalysisPayload } from '@velum/core';
import { arbitrate, type TrajectoryPoint } from '@velum/valuation';
import type { VBadgeTone } from '@velum/ui';

export interface ArbiterViewModel {
  /** Clé i18n du verdict (arbiter.verdict.*). */
  verdictKey: string;
  verdictTone: VBadgeTone;
  /** Clé i18n de la tendance (arbiter.trend.*). */
  trendKey: string;
  /** Confiance 0..1 (affichée via ConfidenceBadge). */
  confidence: number;
  reasons: string[];
  /** Fenêtre de sortie active (apogée proche ET tendance établie). */
  sellWindow: boolean;
}

const VERDICT_TONE: Record<ArbiterSignal['verdict'], VBadgeTone> = {
  drink: 'gold',
  hold: 'success',
  sell: 'warning',
  watch: 'neutral',
};

export function arbiterView(signal: ArbiterSignal): ArbiterViewModel {
  return {
    verdictKey: `arbiter.verdict.${signal.verdict}`,
    verdictTone: VERDICT_TONE[signal.verdict],
    trendKey: `arbiter.trend.${signal.trend}`,
    confidence: signal.confidence,
    reasons: signal.reasons,
    sellWindow: signal.sellWindow,
  };
}

/** Historique §7 (du carnet) → trajectoire datée pour le moteur, triée. */
export function toTrajectory(history: ValuationRecord[]): TrajectoryPoint[] {
  return [...history]
    .filter((r) => Number.isFinite(Date.parse(r.valuedAt)))
    .sort((a, b) => Date.parse(a.valuedAt) - Date.parse(b.valuedAt))
    .map((r) => ({
      at: r.valuedAt,
      central: r.central,
      ci80: [r.ci80Low, r.ci80High] as [number, number],
    }));
}

/** Fenêtre d'apogée depuis un payload d'analyse (vin uniquement), sinon undefined. */
export function usageWindowOf(payload: unknown): { from: number; to: number } | undefined {
  const dw = (payload as Partial<WineAnalysisPayload> | null)?.tasting?.drinkWindow;
  if (!dw || typeof dw.from !== 'number' || typeof dw.to !== 'number') return undefined;
  if (!Number.isFinite(dw.from) || !Number.isFinite(dw.to)) return undefined;
  return { from: dw.from, to: dw.to };
}

/**
 * Repli démo : moteur pur sur les données réelles du carnet démo.
 * @param currentYear injecté (testabilité) ; l'écran passe l'année courante.
 */
export function demoArbiterSignal(
  history: ValuationRecord[],
  analysisPayload: unknown,
  currentYear: number,
): ArbiterSignal {
  const usageWindow = usageWindowOf(analysisPayload);
  return arbitrate({
    currentYear,
    ...(usageWindow ? { usageWindow } : {}),
    trajectory: toTrajectory(history),
  });
}
