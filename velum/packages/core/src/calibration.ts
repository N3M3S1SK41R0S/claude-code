import type { VelumDomain } from './domain.ts';

/** État public et auditable de la calibration d’un domaine. */
export type CalibrationStatus =
  | 'calibrating'
  | 'well_calibrated'
  | 'overconfident'
  | 'underconfident';

/** Dernier run de calibration publié pour un domaine. */
export interface CalibrationRun {
  domain: VelumDomain;
  /** Nombre de prédictions confrontées à un prix réellement réalisé. */
  n: number;
  /** Fraction des réalisés couverts par l’intervalle annoncé à 80 %. */
  coverage80: number;
  /** Fraction des réalisés couverts par l’intervalle annoncé à 95 %. */
  coverage95: number;
  status: CalibrationStatus;
  computedAt: string;
}
