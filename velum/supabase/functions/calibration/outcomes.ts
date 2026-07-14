import type { VelumDomain } from '@velum/core';
import type { PriceOutcome } from '@velum/valuation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNumber(
  row: Record<string, unknown>,
  key: string,
  index: number,
): number {
  const value = finiteNumber(row[key]);
  if (value === null) {
    throw new TypeError(`Ligne calibration_outcomes ${index} invalide : ${key} numérique attendu`);
  }
  return value;
}

/**
 * Convertit les lignes PostgREST en vérité terrain du moteur de calibration.
 * Toute donnée non finie ou tout intervalle incohérent bloque la publication :
 * une métrique calculée sur des `NaN` serait plus trompeuse qu'une erreur visible.
 */
export function parseCalibrationOutcomes(
  rows: unknown,
  domain: VelumDomain,
): PriceOutcome[] {
  if (!Array.isArray(rows)) {
    throw new TypeError('Résultat calibration_outcomes invalide : tableau attendu');
  }

  return rows.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new TypeError(`Ligne calibration_outcomes ${index} invalide : objet attendu`);
    }

    const central = requiredNumber(raw, 'central', index);
    const ci80Low = requiredNumber(raw, 'ci80_low', index);
    const ci80High = requiredNumber(raw, 'ci80_high', index);
    const ci95Low = requiredNumber(raw, 'ci95_low', index);
    const ci95High = requiredNumber(raw, 'ci95_high', index);
    const realized = requiredNumber(raw, 'realized', index);

    if (central <= 0 || realized <= 0) {
      throw new RangeError(
        `Ligne calibration_outcomes ${index} invalide : central et realized doivent être positifs`,
      );
    }
    if (ci80Low > ci80High || ci95Low > ci95High) {
      throw new RangeError(
        `Ligne calibration_outcomes ${index} invalide : bornes d'intervalle inversées`,
      );
    }
    if (ci95Low > ci80Low || ci95High < ci80High) {
      throw new RangeError(
        `Ligne calibration_outcomes ${index} invalide : l'IC 95 doit contenir l'IC 80`,
      );
    }

    return {
      central,
      ci80: [ci80Low, ci80High],
      ci95: [ci95Low, ci95High],
      realized,
      domain,
    };
  });
}
