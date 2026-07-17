import { describe, expect, it } from 'vitest';
import type { FxRates, PriceObservation } from '@velum/core';
import {
  backtest,
  calibrate,
  calibrateByDomain,
  leaveOneOutCases,
  learnSourceWeights,
  type PriceOutcome,
} from './calibration.ts';

const fx: FxRates = {};

function outcome(
  central: number,
  halfWidth: number,
  realized: number,
  domain?: PriceOutcome['domain'],
): PriceOutcome {
  return {
    central,
    ci80: [central - halfWidth, central + halfWidth],
    ci95: [central - halfWidth * 1.6, central + halfWidth * 1.6],
    realized,
    ...(domain ? { domain } : {}),
  };
}

describe('calibrate', () => {
  it('mesure la couverture IC 80 / 95', () => {
    const outcomes = [
      outcome(100, 20, 105),
      outcome(100, 20, 130),
      outcome(100, 20, 90),
      outcome(100, 20, 200),
    ];
    const c = calibrate(outcomes, { minSample: 1 });
    expect(c.n).toBe(4);
    expect(c.coverage80).toBeCloseTo(2 / 4, 5);
    expect(c.coverage95).toBeCloseTo(3 / 4, 5);
  });

  it("status 'calibrating' tant que l'échantillon est sous le seuil", () => {
    const outcomes = Array.from({ length: 5 }, () => outcome(100, 10, 100));
    expect(calibrate(outcomes, { minSample: 30 }).status).toBe('calibrating');
  });

  it("détecte l'excès de confiance (IC trop étroits)", () => {
    const outcomes = Array.from({ length: 40 }, (_, i) =>
      outcome(100, 2, i % 2 === 0 ? 150 : 60),
    );
    const c = calibrate(outcomes, { minSample: 30 });
    expect(c.coverage80).toBeLessThan(0.72);
    expect(c.status).toBe('overconfident');
  });

  it('détecte le défaut de confiance (IC trop larges)', () => {
    const outcomes = Array.from({ length: 40 }, () => outcome(100, 90, 100));
    const c = calibrate(outcomes, { minSample: 30 });
    expect(c.coverage80).toBe(1);
    expect(c.status).toBe('underconfident');
  });

  it('bien calibré autour des cibles 80 % ET 95 %', () => {
    const outcomes = Array.from({ length: 40 }, (_, i) =>
      outcome(100, 20, i < 32 ? 100 : i < 38 ? 125 : 200),
    );
    const c = calibrate(outcomes, { minSample: 30 });
    expect(c.coverage80).toBeCloseTo(0.8, 5);
    expect(c.coverage95).toBeCloseTo(0.95, 5);
    expect(c.status).toBe('well_calibrated');
  });

  it('MdAPE : erreur relative absolue médiane du central', () => {
    const outcomes = [outcome(100, 10, 110), outcome(100, 10, 90), outcome(100, 10, 100)];
    const c = calibrate(outcomes, { minSample: 1 });
    expect(c.medianAbsPctError).toBeCloseTo(0.1, 5);
  });

  it('échantillon vide → calibrating, pas de division par zéro', () => {
    const c = calibrate([]);
    expect(c.n).toBe(0);
    expect(c.status).toBe('calibrating');
  });
});

describe('calibrateByDomain', () => {
  it('regroupe par domaine', () => {
    const outcomes = [
      outcome(100, 20, 100, 'wine'),
      outcome(100, 20, 100, 'wine'),
      outcome(100, 20, 500, 'coin'),
    ];
    const byDomain = calibrateByDomain(outcomes, { minSample: 1 });
    expect(byDomain.wine?.coverage80).toBe(1);
    expect(byDomain.coin?.coverage80).toBe(0);
  });
});

describe('backtest', () => {
  function obs(price: number): PriceObservation {
    return {
      price,
      currency: 'EUR',
      ageDays: 0,
      sourceWeight: 0.7,
      source: { name: 'eBay sold', kind: 'marketplace_sold' },
    };
  }

  it('rejoue le moteur §7 sur des ventes publiques et mesure la calibration', () => {
    const cases = [
      {
        observations: [obs(100), obs(102), obs(98), obs(101)],
        realized: 100,
        domain: 'coin' as const,
      },
      {
        observations: [obs(200), obs(205), obs(195), obs(202)],
        realized: 201,
        domain: 'coin' as const,
      },
    ];
    const { calibration, outcomes, skipped } = backtest(cases, fx, { minSample: 1 });
    expect(skipped).toBe(0);
    expect(outcomes).toHaveLength(2);
    expect(calibration.n).toBe(2);
    expect(calibration.coverage95).toBe(1);
  });

  it('ignore les cas sans observation (jamais de zéro trompeur)', () => {
    const { outcomes, skipped } = backtest(
      [{ observations: [], realized: 100 }],
      fx,
      { minSample: 1 },
    );
    expect(outcomes).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('propage les erreurs de configuration au lieu de les compter comme ignorées', () => {
    const usdObservation: PriceObservation = { ...obs(100), currency: 'USD' };
    expect(() =>
      backtest([{ observations: [usdObservation], realized: 100 }], fx, { minSample: 1 }),
    ).toThrowError('Taux de change manquant pour USD');
  });
});

describe('learnSourceWeights', () => {
  it('poids plus élevé pour la source qui colle au réalisé', () => {
    const w = learnSourceWeights([
      { source: 'auction', predicted: 100, realized: 100 },
      { source: 'auction', predicted: 200, realized: 200 },
      { source: 'listing', predicted: 100, realized: 200 },
      { source: 'listing', predicted: 100, realized: 200 },
    ]);
    expect(w['auction']).toBeGreaterThan(w['listing'] as number);
    expect(w['auction']).toBe(1);
  });

  it('ignore les prédictions ≤ 0', () => {
    const w = learnSourceWeights([{ source: 'x', predicted: 0, realized: 100 }]);
    expect(w['x']).toBeUndefined();
  });
});

describe('leaveOneOutCases — cold-start point-in-time', () => {
  function o(
    price: number,
    kind: PriceObservation['source']['kind'],
    ageDays = 10,
    currency = 'EUR',
  ): PriceObservation {
    return { price, currency, ageDays, sourceWeight: 0.9, source: { name: kind, kind } };
  }
  const fx: FxRates = { USD: 0.9 };

  it('chaque vente réelle exploitable devient vérité-terrain sans données futures', () => {
    const obs = [
      o(100, 'auction_realized', 30),
      o(105, 'marketplace_sold', 12),
      o(98, 'official_quote', 45),
      o(110, 'listing', 40),
      o(101, 'official_quote', 35),
    ];
    const cases = leaveOneOutCases(obs, fx, { domain: 'coin' });

    expect(cases).toHaveLength(2);
    expect(cases[0]?.realized).toBe(100);
    expect(cases[0]?.realizedAgeDays).toBe(30);
    expect(cases[0]?.observations.map((entry) => entry.ageDays)).toEqual([45, 40, 35]);
    expect(cases[0]?.domain).toBe('coin');
    expect(
      cases[0]?.observations.some(
        (entry) => entry.price === 100 && entry.source.kind === 'auction_realized',
      ),
    ).toBe(false);

    expect(cases[1]?.realized).toBe(105);
    expect(cases[1]?.observations).toHaveLength(4);
  });

  it('exclut explicitement toute observation plus récente que la vente retenue', () => {
    const cases = leaveOneOutCases(
      [
        o(100, 'auction_realized', 30),
        o(999, 'official_quote', 5),
        o(98, 'official_quote', 31),
        o(101, 'official_quote', 45),
        o(99, 'listing', 60),
      ],
      fx,
    );

    expect(cases).toHaveLength(1);
    expect(cases[0]?.observations.map((entry) => entry.ageDays)).toEqual([31, 45, 60]);
    expect(cases[0]?.observations.some((entry) => entry.price === 999)).toBe(false);
  });

  it('convertit le réalisé en EUR ; taux manquant → erreur visible', () => {
    const obs = [
      o(100, 'auction_realized', 0, 'USD'),
      o(90, 'official_quote'),
      o(92, 'official_quote'),
      o(91, 'official_quote'),
    ];
    expect(leaveOneOutCases(obs, fx)[0]?.realized).toBe(90);
    expect(() =>
      leaveOneOutCases(
        [
          o(100, 'auction_realized', 0, 'GBP'),
          o(90, 'official_quote'),
          o(92, 'official_quote'),
          o(91, 'official_quote'),
        ],
        fx,
      ),
    ).toThrow(/change/i);
  });

  it('écarte les cas sous le minimum de comparables disponibles à cette date', () => {
    const obs = [o(100, 'auction_realized'), o(105, 'marketplace_sold')];
    expect(leaveOneOutCases(obs, fx)).toHaveLength(0);
    expect(leaveOneOutCases(obs, fx, { minRemaining: 1 })).toHaveLength(2);
  });

  it('alimente backtest() de bout en bout', () => {
    const obs = [
      o(100, 'auction_realized'),
      o(102, 'marketplace_sold'),
      o(98, 'official_quote'),
      o(101, 'official_quote'),
      o(99, 'marketplace_sold'),
    ];
    const { calibration, outcomes } = backtest(
      leaveOneOutCases(obs, fx, { domain: 'wine' }),
      fx,
      { minSample: 1 },
    );
    expect(outcomes.length).toBe(3);
    expect(calibration.n).toBe(3);
  });
});
