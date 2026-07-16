import { describe, expect, it } from 'vitest';
import type { ArbiterSignal, ValuationRecord } from '@velum/core';
import { arbiterView, demoArbiterSignal, toTrajectory, usageWindowOf } from './arbiterView';

function record(valuedAt: string, central: number, lo: number, hi: number): ValuationRecord {
  return {
    id: `v-${valuedAt}`,
    itemId: 'demo-wine',
    central,
    ci80Low: lo,
    ci80High: hi,
    ci95Low: Math.round(lo * 0.9),
    ci95High: Math.round(hi * 1.1),
    reliability: 70,
    sources: [],
    valuedAt,
  };
}

describe('arbiterView — mappage pur signal → interface', () => {
  const signal: ArbiterSignal = {
    verdict: 'sell',
    confidence: 0.72,
    trend: 'rising',
    sellWindow: true,
    reasons: ['Apogée se referme', 'Tendance haussière établie'],
  };

  it('mappe verdict, tendance et tons sans altérer le signal', () => {
    const v = arbiterView(signal);
    expect(v.verdictKey).toBe('arbiter.verdict.sell');
    expect(v.verdictTone).toBe('warning');
    expect(v.trendKey).toBe('arbiter.trend.rising');
    expect(v.confidence).toBe(0.72);
    expect(v.reasons).toHaveLength(2);
    expect(v.sellWindow).toBe(true);
  });

  it('tons par verdict : drink=gold, hold=success, watch=neutral', () => {
    expect(arbiterView({ ...signal, verdict: 'drink' }).verdictTone).toBe('gold');
    expect(arbiterView({ ...signal, verdict: 'hold' }).verdictTone).toBe('success');
    expect(arbiterView({ ...signal, verdict: 'watch' }).verdictTone).toBe('neutral');
  });
});

describe('toTrajectory — historique carnet → moteur', () => {
  it('trie chronologiquement et mappe les IC80', () => {
    const t = toTrajectory([
      record('2026-06-01T00:00:00Z', 130, 120, 140),
      record('2026-01-01T00:00:00Z', 100, 90, 110),
    ]);
    expect(t[0]?.central).toBe(100);
    expect(t[1]?.ci80).toEqual([120, 140]);
  });

  it('écarte les dates non parsables (jamais de point inventé)', () => {
    expect(toTrajectory([record('pas-une-date', 100, 90, 110)])).toHaveLength(0);
  });
});

describe('usageWindowOf — apogée uniquement si prouvée', () => {
  it('extrait une fenêtre valide', () => {
    expect(usageWindowOf({ tasting: { drinkWindow: { from: 2023, to: 2032 } } })).toEqual({ from: 2023, to: 2032 });
  });
  it('payload absent, non-vin ou fenêtre malformée → undefined', () => {
    expect(usageWindowOf(null)).toBeUndefined();
    expect(usageWindowOf({})).toBeUndefined();
    expect(usageWindowOf({ tasting: { drinkWindow: { from: '2023', to: 2032 } } })).toBeUndefined();
  });
});

describe('demoArbiterSignal — repli conservateur, rien d’inventé', () => {
  it('moins de 3 valorisations → tendance unknown, verdict prudent', () => {
    const s = demoArbiterSignal([record('2026-01-01T00:00:00Z', 100, 90, 110)], null, 2026);
    expect(s.trend).toBe('unknown');
    expect(s.verdict).toBe('watch');
    expect(s.sellWindow).toBe(false);
  });

  it('vin à l’apogée, trajectoire plate → boire, jamais de fenêtre de sortie', () => {
    const history = [
      record('2026-01-01T00:00:00Z', 100, 80, 120),
      record('2026-03-01T00:00:00Z', 105, 85, 125),
      record('2026-06-01T00:00:00Z', 102, 82, 122),
    ];
    const s = demoArbiterSignal(history, { tasting: { drinkWindow: { from: 2023, to: 2032 } } }, 2026);
    expect(s.verdict).toBe('drink');
    expect(s.sellWindow).toBe(false);
  });

  it('garde-fou intact : apogée proche + hausse établie → fenêtre de sortie', () => {
    const history = [
      record('2026-01-01T00:00:00Z', 100, 90, 110),
      record('2026-03-01T00:00:00Z', 130, 120, 140),
      record('2026-06-01T00:00:00Z', 160, 150, 170),
    ];
    const s = demoArbiterSignal(history, { tasting: { drinkWindow: { from: 2020, to: 2028 } } }, 2026, 'wine');
    expect(s.verdict).toBe('sell');
    expect(s.sellWindow).toBe(true);
  });

  // Sémantique vin du serveur (Edge arbiter) préservée dans le repli — revue Codex P2.
  it('VIN sans fenêtre prouvée → refus conservateur, même avec hausse établie', () => {
    const rising = [
      record('2026-01-01T00:00:00Z', 100, 90, 110),
      record('2026-03-01T00:00:00Z', 130, 120, 140),
      record('2026-06-01T00:00:00Z', 160, 150, 170),
    ];
    for (const payload of [null, {}, { tasting: { drinkWindow: { from: '2023', to: 2032 } } }]) {
      const s = demoArbiterSignal(rising, payload, 2026, 'wine');
      expect(s.verdict).toBe('watch');
      expect(s.confidence).toBe(0);
      expect(s.trend).toBe('unknown');
      expect(s.sellWindow).toBe(false);
      expect(s.reasons.join(' ')).toMatch(/apogée indisponible/i);
    }
  });

  it('actif NON périssable (pièce) sans fenêtre : branche normale conservée', () => {
    const rising = [
      record('2026-01-01T00:00:00Z', 100, 90, 110),
      record('2026-03-01T00:00:00Z', 130, 120, 140),
      record('2026-06-01T00:00:00Z', 160, 150, 170),
    ];
    const s = demoArbiterSignal(rising, null, 2026, 'coin');
    expect(s.verdict).toBe('hold');
    expect(s.trend).toBe('rising');
  });
});
