import { describe, expect, it } from 'vitest';
import type { ValuationResult } from '@velum/core';
import { aggregatePortfolio, portfolioMovement, toSnapshot, type ItemValuation } from './portfolio';

function val(central: number, lo: number, hi: number, reliability = 70): ValuationResult {
  return {
    central,
    ci80: [lo, hi],
    ci95: [Math.round(lo * 0.9), Math.round(hi * 1.1)],
    nSources: 5,
    reliability,
    currency: 'EUR',
    observations: [],
  };
}

describe('aggregatePortfolio', () => {
  it('somme les valeurs et ventile par domaine', () => {
    const items: ItemValuation[] = [
      { itemId: 'a', domain: 'wine', valuation: val(100, 80, 120) },
      { itemId: 'b', domain: 'wine', valuation: val(200, 180, 220) },
      { itemId: 'c', domain: 'coin', valuation: val(50, 40, 60) },
    ];
    const p = aggregatePortfolio(items);
    expect(p.total).toBe(350);
    expect(p.nItems).toBe(3);
    expect(p.byDomain.wine?.total).toBe(300);
    expect(p.byDomain.wine?.nItems).toBe(2);
    expect(p.byDomain.coin?.total).toBe(50);
  });

  it('multiplie par la quantité', () => {
    const p = aggregatePortfolio([{ itemId: 'a', domain: 'wine', valuation: val(100, 80, 120), quantity: 6 }]);
    expect(p.total).toBe(600);
    expect(p.ci80).toEqual([480, 720]);
  });

  it('agrège les IC de façon comonotone (borne large, honnête)', () => {
    const items: ItemValuation[] = [
      { itemId: 'a', domain: 'wine', valuation: val(100, 80, 120) },
      { itemId: 'b', domain: 'coin', valuation: val(100, 90, 110) },
    ];
    const p = aggregatePortfolio(items);
    expect(p.ci80).toEqual([170, 230]); // 80+90, 120+110
  });

  it('la fiabilité min reflète l’actif le plus incertain', () => {
    const items: ItemValuation[] = [
      { itemId: 'a', domain: 'wine', valuation: val(100, 80, 120, 90) },
      { itemId: 'b', domain: 'coin', valuation: val(100, 50, 150, 30) },
    ];
    const p = aggregatePortfolio(items);
    expect(p.minReliability).toBe(30);
    expect(p.weightedReliability).toBe(60); // (90*100 + 30*100)/200
  });

  it('portefeuille vide → zéros non trompeurs', () => {
    const p = aggregatePortfolio([]);
    expect(p.total).toBe(0);
    expect(p.minReliability).toBe(0);
    expect(p.weightedReliability).toBe(0);
  });
});

describe('portfolioMovement', () => {
  it('hausse au-delà du seuil', () => {
    const m = portfolioMovement(toSnapshot(aggregatePortfolio([{ itemId: 'a', domain: 'wine', valuation: val(1000, 900, 1100) }]), '2026-01-01'), { at: '2026-04-01', total: 1100, ci80: [1000, 1200] });
    expect(m.direction).toBe('up');
    expect(m.absolute).toBe(100);
    expect(m.pct).toBeCloseTo(0.1, 5);
  });

  it('plat sous le seuil de 1 %', () => {
    const m = portfolioMovement({ at: 't0', total: 1000, ci80: [900, 1100] }, { at: 't1', total: 1005, ci80: [905, 1105] });
    expect(m.direction).toBe('flat');
  });

  it('baisse', () => {
    const m = portfolioMovement({ at: 't0', total: 1000, ci80: [900, 1100] }, { at: 't1', total: 800, ci80: [700, 900] });
    expect(m.direction).toBe('down');
    expect(m.absolute).toBe(-200);
  });

  it('base zéro → pas de division par zéro', () => {
    const m = portfolioMovement({ at: 't0', total: 0, ci80: [0, 0] }, { at: 't1', total: 100, ci80: [90, 110] });
    expect(m.pct).toBe(0);
    expect(m.direction).toBe('flat');
  });
});
