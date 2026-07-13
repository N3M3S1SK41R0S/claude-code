/**
 * Transformation PURE de l'historique de valorisations en points de courbe
 * normalisés 0..1 (x = temps, y = valeur centrale). Testée par vitest.
 */
import type { ValuationRecord } from '@velum/core';

export interface ChartPoint {
  /** Position temporelle normalisée 0..1 (0 = plus ancien, 1 = plus récent). */
  x: number;
  /** Valeur normalisée 0..1 (0 = minimum, 1 = maximum de la série). */
  y: number;
  /** Valeur centrale EUR d'origine. */
  central: number;
  /** Horodatage ISO de la valorisation. */
  valuedAt: string;
}

/**
 * Normalise l'historique en points 0..1, triés chronologiquement.
 * Série vide → [] ; point unique ou série plate → y = 0.5 (ligne médiane).
 */
export function toChartPoints(records: ValuationRecord[]): ChartPoint[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort(
    (a, b) => Date.parse(a.valuedAt) - Date.parse(b.valuedAt),
  );

  const times = sorted.map((r) => Date.parse(r.valuedAt));
  const values = sorted.map((r) => r.central);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const tSpan = tMax - tMin;
  const vSpan = vMax - vMin;

  return sorted.map((record, i) => {
    const time = times[i] ?? tMin;
    const value = values[i] ?? vMin;
    return {
      x: tSpan === 0 ? (sorted.length === 1 ? 0 : i / (sorted.length - 1)) : (time - tMin) / tSpan,
      y: vSpan === 0 ? 0.5 : (value - vMin) / vSpan,
      central: record.central,
      valuedAt: record.valuedAt,
    };
  });
}
