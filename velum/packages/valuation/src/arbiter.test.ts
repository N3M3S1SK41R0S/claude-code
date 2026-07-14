import { describe, expect, it } from 'vitest';
import { arbitrate, valueTrend, type TrajectoryPoint } from './arbiter.ts';

function pt(at: string, central: number, lo: number, hi: number): TrajectoryPoint {
  return { at, central, ci80: [lo, hi] };
}

const rising: TrajectoryPoint[] = [pt('t0', 100, 90, 110), pt('t1', 130, 120, 140), pt('t2', 160, 150, 170)];
const falling: TrajectoryPoint[] = [pt('t0', 160, 150, 170), pt('t1', 130, 120, 140), pt('t2', 100, 90, 110)];
const flatOverlap: TrajectoryPoint[] = [pt('t0', 100, 80, 120), pt('t1', 105, 85, 125), pt('t2', 102, 82, 122)];

describe('valueTrend', () => {
  it('hausse si IC 80 % disjoints (dernier > premier)', () => {
    expect(valueTrend(rising)).toBe('rising');
  });
  it('baisse si IC 80 % disjoints (dernier < premier)', () => {
    expect(valueTrend(falling)).toBe('falling');
  });
  it("plat si les IC se chevauchent malgré ≥ 3 points", () => {
    expect(valueTrend(flatOverlap)).toBe('flat');
  });
  it('unknown sous 3 points (jamais de lecture directionnelle hâtive)', () => {
    expect(valueTrend([pt('t0', 100, 90, 110), pt('t1', 200, 190, 210)])).toBe('unknown');
  });
});

describe('arbitrate — actif non périssable (pièce/timbre/art)', () => {
  it('tendance haussière établie → garder', () => {
    const s = arbitrate({ currentYear: 2026, trajectory: rising });
    expect(s.verdict).toBe('hold');
    expect(s.sellWindow).toBe(false);
  });
  it('tendance baissière établie → vendre', () => {
    const s = arbitrate({ currentYear: 2026, trajectory: falling });
    expect(s.verdict).toBe('sell');
  });
  it('tendance non séparée de plat → observer, aucun signal', () => {
    const s = arbitrate({ currentYear: 2026, trajectory: flatOverlap });
    expect(s.verdict).toBe('watch');
    expect(s.sellWindow).toBe(false);
  });
  it('historique insuffisant → observer (jamais de faux signal)', () => {
    const s = arbitrate({ currentYear: 2026, trajectory: [pt('t0', 100, 90, 110)] });
    expect(s.verdict).toBe('watch');
    expect(s.trend).toBe('unknown');
  });
});

describe('arbitrate — vin (fenêtre d’apogée × trajectoire)', () => {
  it('avant apogée → garder', () => {
    const s = arbitrate({ currentYear: 2026, usageWindow: { from: 2030, to: 2040 }, trajectory: rising });
    expect(s.verdict).toBe('hold');
    expect(s.sellWindow).toBe(false);
  });

  it('GARDE-FOU : apogée proche MAIS tendance plate → boire, PAS de fenêtre de sortie', () => {
    const s = arbitrate({ currentYear: 2026, usageWindow: { from: 2020, to: 2028 }, trajectory: flatOverlap });
    expect(s.sellWindow).toBe(false);
    expect(s.verdict).toBe('drink');
    expect(s.reasons.join(' ')).toMatch(/anti-faux-signal/i);
  });

  it('fenêtre de sortie SEULEMENT si apogée proche ET tendance séparée', () => {
    const s = arbitrate({ currentYear: 2026, usageWindow: { from: 2020, to: 2028 }, trajectory: rising });
    expect(s.sellWindow).toBe(true);
    expect(s.verdict).toBe('sell');
    expect(s.trend).toBe('rising');
  });

  it('apogée lointaine + tendance haussière → à boire (pas encore de sortie)', () => {
    const s = arbitrate({
      currentYear: 2026,
      usageWindow: { from: 2024, to: 2040 },
      trajectory: rising,
      horizonYears: 3,
    });
    expect(s.sellWindow).toBe(false);
    expect(s.verdict).toBe('drink');
  });

  it('apogée dépassée → à boire sans tarder', () => {
    const s = arbitrate({ currentYear: 2026, usageWindow: { from: 2010, to: 2020 }, trajectory: rising });
    expect(s.verdict).toBe('drink');
    expect(s.reasons.join(' ')).toMatch(/dépassée/i);
  });

  it('confiance croît avec le nombre de points et la marge de séparation', () => {
    const weak = arbitrate({ currentYear: 2026, usageWindow: { from: 2020, to: 2028 }, trajectory: rising });
    const strongTraj = [...rising, pt('t3', 200, 190, 210), pt('t4', 240, 230, 250), pt('t5', 280, 270, 290)];
    const strong = arbitrate({ currentYear: 2026, usageWindow: { from: 2020, to: 2028 }, trajectory: strongTraj });
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });
});
