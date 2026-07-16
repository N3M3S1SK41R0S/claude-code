import type { VelumDomain } from './domain.ts';

/**
 * États publics et auditables de la calibration d'un domaine — source unique
 * du contrat : le type ET la liste runtime en dérivent (un nouvel état ajouté
 * ici est automatiquement accepté par les validateurs clients).
 */
export const CALIBRATION_STATUSES = [
  'calibrating',
  'well_calibrated',
  'overconfident',
  'underconfident',
] as const;

/** État public et auditable de la calibration d’un domaine. */
export type CalibrationStatus = (typeof CALIBRATION_STATUSES)[number];

/** Garde de type runtime pour un statut de calibration persisté. */
export function isCalibrationStatus(value: unknown): value is CalibrationStatus {
  return typeof value === 'string' && (CALIBRATION_STATUSES as readonly string[]).includes(value);
}

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
