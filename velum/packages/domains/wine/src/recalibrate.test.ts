import { describe, expect, it } from 'vitest';
import { recalibrateDrinkWindow, type OpeningEvent } from './recalibrate.ts';

const prior = { from: 2025, to: 2040 };

describe('recalibrateDrinkWindow', () => {
  it('sans ouverture → a priori conservé, confiance basse', () => {
    const r = recalibrateDrinkWindow(prior, []);
    expect(r.window).toEqual(prior);
    expect(r.adjusted).toBe(false);
    expect(r.confidence).toBeCloseTo(0.3, 5);
  });

  it('« trop jeune » repousse la borne basse', () => {
    const openings: OpeningEvent[] = [{ year: 2027, verdict: 'too_young' }];
    const r = recalibrateDrinkWindow(prior, openings);
    expect(r.window.from).toBe(2028);
    expect(r.adjusted).toBe(true);
  });

  it('« passé » avance la borne haute', () => {
    const r = recalibrateDrinkWindow(prior, [{ year: 2035, verdict: 'past_peak' }]);
    expect(r.window.to).toBe(2034);
  });

  it('« à l’apogée » élargit la fenêtre pour inclure l’année', () => {
    const r = recalibrateDrinkWindow({ from: 2030, to: 2035 }, [{ year: 2028, verdict: 'at_peak' }]);
    expect(r.window.from).toBeLessThanOrEqual(2028);
  });

  it('la confiance croît avec le nombre d’ouvertures', () => {
    const one = recalibrateDrinkWindow(prior, [{ year: 2026, verdict: 'at_peak' }]);
    const many = recalibrateDrinkWindow(prior, [
      { year: 2026, verdict: 'at_peak' },
      { year: 2027, verdict: 'at_peak' },
      { year: 2028, verdict: 'at_peak' },
    ]);
    expect(many.confidence).toBeGreaterThan(one.confidence);
  });

  it('contradiction (trop jeune APRÈS passé) → a priori conservé, conflict', () => {
    const r = recalibrateDrinkWindow(prior, [
      { year: 2030, verdict: 'past_peak' },
      { year: 2032, verdict: 'too_young' },
    ]);
    expect(r.conflict).toBe(true);
    expect(r.window).toEqual(prior);
    expect(r.adjusted).toBe(false);
  });

  it('resserrement impossible (from > to) → repli a priori, conflict', () => {
    const r = recalibrateDrinkWindow({ from: 2025, to: 2030 }, [
      { year: 2029, verdict: 'too_young' }, // from → 2030
      { year: 2028, verdict: 'past_peak' }, // to → 2027  ⇒ 2030 > 2027
    ]);
    expect(r.conflict).toBe(true);
    expect(r.window).toEqual({ from: 2025, to: 2030 });
  });

  it('resserrement cohérent des deux côtés', () => {
    const r = recalibrateDrinkWindow({ from: 2020, to: 2040 }, [
      { year: 2024, verdict: 'too_young' },
      { year: 2030, verdict: 'at_peak' },
      { year: 2038, verdict: 'past_peak' },
    ]);
    expect(r.window).toEqual({ from: 2025, to: 2037 });
    expect(r.conflict).toBe(false);
    expect(r.adjusted).toBe(true);
  });
});
