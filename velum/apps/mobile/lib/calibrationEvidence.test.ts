import { describe, expect, it } from 'vitest';
import type { CalibrationRun } from '@velum/core';
import { calibrationView } from './calibrationEvidence';

function run(partial: Partial<CalibrationRun>): CalibrationRun {
  return {
    domain: 'wine',
    n: 120,
    coverage80: 0.81,
    coverage95: 0.94,
    status: 'well_calibrated',
    computedAt: '2026-07-15T06:00:00Z',
    ...partial,
  };
}

describe('calibrationView — jamais de métrique trompeuse', () => {
  it('aucun run publié (ou dépôt absent en démo) → en cours', () => {
    const v = calibrationView(null);
    expect(v.state).toBe('in_progress');
    expect(v.n).toBe(0);
  });

  it('échantillon insuffisant (n < 30) → en cours, même bien couvert', () => {
    const v = calibrationView(run({ n: 29, coverage80: 0.8 }));
    expect(v.state).toBe('in_progress');
    expect(v.n).toBe(29);
  });

  it("statut 'calibrating' → en cours, même avec n ≥ 30", () => {
    expect(calibrationView(run({ status: 'calibrating', n: 500 })).state).toBe('in_progress');
  });

  it('échantillon suffisant + statut tranché → couvertures affichables', () => {
    const v = calibrationView(run({}));
    expect(v.state).toBe('ready');
    if (v.state === 'ready') {
      expect(v.coverage80Pct).toBe(81);
      expect(v.coverage95Pct).toBe(94);
      expect(v.statusKey).toBe('calibration.status.well_calibrated');
      expect(v.badgeTone).toBe('success');
      expect(v.computedAt).toBe('2026-07-15T06:00:00Z');
    }
  });

  it('sur-confiance → ton danger ; sous-confiance → ton warning', () => {
    const over = calibrationView(run({ status: 'overconfident' }));
    const under = calibrationView(run({ status: 'underconfident' }));
    expect(over.state === 'ready' && over.badgeTone).toBe('danger');
    expect(under.state === 'ready' && under.badgeTone).toBe('warning');
  });

  it('seuil exact n = 30 → affichable (borne incluse)', () => {
    expect(calibrationView(run({ n: 30 })).state).toBe('ready');
  });
});
