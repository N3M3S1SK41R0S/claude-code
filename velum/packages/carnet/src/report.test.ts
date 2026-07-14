import { describe, expect, it } from 'vitest';
import { buildInsuranceReport, type ReportItem } from './report';

function item(partial: Partial<ReportItem> & Pick<ReportItem, 'itemId' | 'domain' | 'central' | 'ci80'>): ReportItem {
  return { title: partial.itemId, reliability: 70, ...partial };
}

describe('buildInsuranceReport', () => {
  const items: ReportItem[] = [
    item({ itemId: 'w1', domain: 'wine', central: 300, ci80: [250, 350], acquiredPrice: 200 }),
    item({ itemId: 'c1', domain: 'coin', central: 500, ci80: [450, 560], reliability: 40 }),
    item({ itemId: 'w2', domain: 'wine', central: 100, ci80: [90, 110], acquiredPrice: 120 }),
  ];

  it('agrège total, IC comonotone et ventilation domaine', () => {
    const r = buildInsuranceReport(items, '2026-07-14T10:00:00Z');
    expect(r.totalCentral).toBe(900);
    expect(r.totalCi80).toEqual([790, 1020]);
    expect(r.byDomain.wine?.total).toBe(400);
    expect(r.byDomain.wine?.nItems).toBe(2);
    expect(r.byDomain.coin?.total).toBe(500);
    expect(r.nItems).toBe(3);
  });

  it('plus-value latente vs acquisition (uniquement objets tracés)', () => {
    const r = buildInsuranceReport(items, '2026-07-14T10:00:00Z');
    // acquis : 200 + 120 = 320 ; central correspondant : 300 + 100 = 400 → +80
    expect(r.totalAcquired).toBe(320);
    expect(r.totalUnrealizedGain).toBe(80);
  });

  it('fiabilité minimale = maillon le plus faible', () => {
    expect(buildInsuranceReport(items, 't').minReliability).toBe(40);
  });

  it('disclaimers obligatoires (jamais une expertise légale)', () => {
    const r = buildInsuranceReport(items, 't');
    expect(r.disclaimers.length).toBeGreaterThanOrEqual(3);
    expect(r.disclaimers.join(' ')).toMatch(/pas.*expertise légale/i);
  });

  it('lot vide → zéros non trompeurs, pas de plus-value inventée', () => {
    const r = buildInsuranceReport([], '2026-07-14T10:00:00Z');
    expect(r.totalCentral).toBe(0);
    expect(r.totalAcquired).toBeUndefined();
    expect(r.minReliability).toBe(0);
  });
});
