/**
 * Présentation PURE de la preuve de calibration (pari #1) — décide ce que
 * l'interface a le droit d'afficher sans jamais montrer une métrique
 * trompeuse :
 *  - aucun run publié, échantillon < MIN_CALIBRATION_SAMPLE ou statut
 *    'calibrating' → « Calibration en cours », SANS couvertures ;
 *  - sinon → couvertures IC80/IC95 et statut, datés.
 */
import type { CalibrationRun } from '@velum/core';
import { MIN_CALIBRATION_SAMPLE } from '@velum/valuation';
import type { VBadgeTone } from '@velum/ui';

export type CalibrationView =
  | { state: 'in_progress'; n: number }
  | {
      state: 'ready';
      n: number;
      /** Pourcentages entiers, prêts à afficher. */
      coverage80Pct: number;
      coverage95Pct: number;
      /** Clé i18n du statut (calibration.status.*). */
      statusKey: string;
      badgeTone: VBadgeTone;
      computedAt: string;
    };

const STATUS_TONE: Record<string, VBadgeTone> = {
  well_calibrated: 'success',
  overconfident: 'danger',
  underconfident: 'warning',
};

/**
 * Vue de calibration à partir du dernier run publié (ou null : rien publié,
 * ou dépôt absent — mode démo). Règle d'honnêteté : les couvertures ne sont
 * affichables qu'avec un échantillon suffisant ET un statut tranché.
 */
export function calibrationView(run: CalibrationRun | null): CalibrationView {
  if (run === null || run.status === 'calibrating' || run.n < MIN_CALIBRATION_SAMPLE) {
    return { state: 'in_progress', n: run?.n ?? 0 };
  }
  return {
    state: 'ready',
    n: run.n,
    coverage80Pct: Math.round(run.coverage80 * 100),
    coverage95Pct: Math.round(run.coverage95 * 100),
    statusKey: `calibration.status.${run.status}`,
    badgeTone: STATUS_TONE[run.status] ?? 'neutral',
    computedAt: run.computedAt,
  };
}
