import { describe, expect, it } from 'vitest';
import type { FxRates, PriceObservation, SourceKind } from '@velum/core';
import { isVelumError } from '@velum/core';
import {
  effectiveWeight,
  median,
  mulberry32,
  recencyWeight,
  rejectOutliers,
  reliabilityScore,
  toEUR,
  valuate,
  weightedMedian,
} from './engine';

const FX: FxRates = { USD: 0.9, GBP: 1.15 };

function obs(
  price: number,
  {
    currency = 'EUR',
    ageDays = 0,
    weight = 1,
    kind = 'auction_realized' as SourceKind,
  } = {},
): PriceObservation {
  return {
    price,
    currency,
    ageDays,
    sourceWeight: weight,
    source: { name: 'test-source', kind },
  };
}

describe('toEUR', () => {
  it('convertit selon le taux du jour', () => {
    expect(toEUR(100, 'USD', FX)).toBeCloseTo(90);
    expect(toEUR(100, 'EUR', FX)).toBe(100);
  });

  it('refuse une devise sans taux (pas de conversion silencieuse à 1:1)', () => {
    expect(() => toEUR(100, 'JPY', FX)).toThrowError(/JPY/);
  });
});

describe('median / weightedMedian', () => {
  it('médiane impaire et paire', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('la médiane pondérée penche du côté des poids forts', () => {
    const wm = weightedMedian([
      { v: 100, w: 0.1 },
      { v: 200, w: 0.1 },
      { v: 500, w: 5 },
    ]);
    expect(wm).toBe(500);
  });

  it('masse de poids nulle → repli sur la médiane simple', () => {
    expect(weightedMedian([{ v: 10, w: 0 }, { v: 20, w: 0 }, { v: 30, w: 0 }])).toBe(20);
  });

  it('échantillon vide → VelumError', () => {
    expect(() => median([])).toThrow();
    expect(() => weightedMedian([])).toThrow();
  });
});

describe('recencyWeight', () => {
  it("décroissance exponentielle avec demi-vie d'un an", () => {
    expect(recencyWeight(0)).toBe(1);
    expect(recencyWeight(365)).toBeCloseTo(0.5);
    expect(recencyWeight(730)).toBeCloseTo(0.25);
  });

  it('un âge négatif est traité comme aujourd’hui', () => {
    expect(recencyWeight(-10)).toBe(1);
  });
});

describe('effectiveWeight', () => {
  it('poids effectif = fiabilité source × récence', () => {
    expect(effectiveWeight(obs(100, { weight: 0.7, ageDays: 365 }))).toBeCloseTo(0.35);
  });
});

describe('rejectOutliers (MAD)', () => {
  it('écarte les valeurs aberrantes, conserve le cœur', () => {
    const sample = [98, 100, 102, 101, 99, 5000].map((p) => obs(p));
    const kept = rejectOutliers(sample, FX);
    expect(kept).toHaveLength(5);
    expect(kept.map((o) => o.price)).not.toContain(5000);
  });

  it('des prix identiques ne sont jamais rejetés (MAD = 0)', () => {
    const sample = [100, 100, 100].map((p) => obs(p));
    expect(rejectOutliers(sample, FX)).toHaveLength(3);
  });

  it('compare dans une devise commune avant de rejeter', () => {
    // 111 USD ≈ 100 EUR : ne doit PAS être vu comme un outlier
    const sample = [obs(100), obs(101), obs(99), obs(111, { currency: 'USD' })];
    expect(rejectOutliers(sample, FX)).toHaveLength(4);
  });
});

describe('valuate — moteur complet §7', () => {
  it('résultat déterministe à seed fixée', () => {
    const sample = [95, 100, 105, 110, 90, 4000].map((p) => obs(p, { ageDays: 30 }));
    const a = valuate(sample, FX, { rng: mulberry32(42) });
    const b = valuate(sample, FX, { rng: mulberry32(42) });
    expect(a).toEqual(b);
  });

  it('rejette l’outlier et centre sur le cœur du marché', () => {
    const sample = [95, 100, 105, 110, 90, 4000].map((p) => obs(p));
    const r = valuate(sample, FX);
    expect(r.nSources).toBe(5);
    expect(r.central).toBeGreaterThanOrEqual(90);
    expect(r.central).toBeLessThanOrEqual(110);
  });

  it('IC cohérents : ci95 englobe ci80 qui encadre la centrale', () => {
    const sample = [80, 90, 95, 100, 105, 110, 120, 130].map((p, i) => obs(p, { ageDays: i * 30 }));
    const r = valuate(sample, FX);
    expect(r.ci95[0]).toBeLessThanOrEqual(r.ci80[0]);
    expect(r.ci80[0]).toBeLessThanOrEqual(r.central);
    expect(r.central).toBeLessThanOrEqual(r.ci80[1]);
    expect(r.ci80[1]).toBeLessThanOrEqual(r.ci95[1]);
  });

  it('une vente réalisée récente pèse plus qu’une vieille annonce', () => {
    const sample = [
      obs(200, { ageDays: 5, weight: 1.0 }), // vente réalisée récente
      obs(200, { ageDays: 10, weight: 1.0 }),
      obs(80, { ageDays: 1500, weight: 0.4 }), // vieilles annonces
      obs(80, { ageDays: 1500, weight: 0.4 }),
      obs(80, { ageDays: 1600, weight: 0.4 }),
    ];
    const r = valuate(sample, FX, { madK: 100 }); // pas de rejet, on teste la pondération
    expect(r.central).toBe(200);
  });

  it('normalise les devises vers EUR', () => {
    const r = valuate([obs(100, { currency: 'USD' })], FX);
    expect(r.central).toBe(90);
    expect(r.currency).toBe('EUR');
  });

  it('échantillon vide → VelumError NO_OBSERVATIONS (jamais un zéro trompeur)', () => {
    try {
      valuate([], FX);
      expect.unreachable('valuate aurait dû lever');
    } catch (e) {
      expect(isVelumError(e)).toBe(true);
      if (isVelumError(e)) expect(e.code).toBe('NO_OBSERVATIONS');
    }
  });

  it('observation unique : centrale = prix, IC dégénéré, fiabilité faible', () => {
    const r = valuate([obs(150)], FX);
    expect(r.central).toBe(150);
    expect(r.ci95).toEqual([150, 150]);
    expect(r.reliability).toBeLessThanOrEqual(60);
  });

  it('la fiabilité croît avec le nombre de sources et la faible dispersion', () => {
    const tight = valuate(
      Array.from({ length: 8 }, (_, i) => obs(100 + (i % 3))),
      FX,
    );
    const sparse = valuate([obs(50), obs(150)], FX);
    expect(tight.reliability).toBeGreaterThan(sparse.reliability);
    expect(tight.reliability).toBeGreaterThanOrEqual(80);
  });
});

describe('reliabilityScore', () => {
  it('0 quand dispersion totale et peu de sources, 100 quand 8+ sources sans dispersion', () => {
    expect(reliabilityScore(8, 100, 100, 100)).toBe(100);
    expect(reliabilityScore(1, 0, 200, 100)).toBeLessThanOrEqual(10);
  });

  it('centrale nulle → dispersion neutralisée à 1 (pas de division par zéro)', () => {
    expect(Number.isFinite(reliabilityScore(4, 0, 0, 0))).toBe(true);
  });
});
