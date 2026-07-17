import { describe, expect, it } from 'vitest';
import type { FxRates, PriceObservation } from '@velum/core';
import { valuate } from './engine.ts';
import { explainFromResult, explainValuation, reliabilityFromExplanation } from './explain.ts';

const fx: FxRates = { USD: 0.9, GBP: 1.15 };

function obs(price: number, kind: PriceObservation['source']['kind'], ageDays = 0, currency = 'EUR'): PriceObservation {
  return { price, currency, ageDays, sourceWeight: undefined as unknown as number, source: { name: kind, kind } };
}

describe('explainValuation', () => {
  it('central et IC coïncident exactement avec le moteur valuate()', () => {
    const data = [obs(100, 'auction_realized'), obs(110, 'official_quote'), obs(105, 'marketplace_sold')];
    const v = valuate(data, fx);
    const e = explainValuation(data, fx);
    expect(e.central).toBe(v.central);
    expect(e.ci80).toEqual(v.ci80);
    expect(e.ci95).toEqual(v.ci95);
    expect(e.reliability).toBe(v.reliability);
    expect(e.nKept).toBe(v.observations.length);
    expect(e.nSources).toBe(v.nSources);
  });

  it('marque les aberrants (règle MAD) comme écartés avec une raison', () => {
    const data = [
      obs(100, 'marketplace_sold'),
      obs(102, 'marketplace_sold'),
      obs(98, 'marketplace_sold'),
      obs(101, 'marketplace_sold'),
      obs(5000, 'listing'), // aberrant net
    ];
    const e = explainValuation(data, fx);
    expect(e.nKept).toBe(4);
    expect(e.nRejected).toBe(1);
    const outlier = e.breakdown.find((b) => b.priceEUR === 5000);
    expect(outlier?.kept).toBe(false);
    expect(outlier?.rejectionReason).toBe('outlier_mad');
    expect(outlier?.madDeviation).toBeGreaterThan(3.5);
  });

  it('sépare le nombre d’observations du nombre de plateformes distinctes', () => {
    const data = [
      obs(100, 'marketplace_sold'),
      obs(102, 'marketplace_sold'),
      obs(101, 'auction_realized'),
    ];
    const e = explainValuation(data, fx);

    expect(e.nKept).toBe(3);
    expect(e.nSources).toBe(2);
    expect(e.reliabilityFactors.countScore).toBe(0.25);
    expect(e.notes.join(' ')).toMatch(/3 observations.*2 sources distinctes/i);
  });

  it('décompose fiabilité × récence dans le poids effectif', () => {
    const data = [obs(100, 'auction_realized', 365), obs(100, 'listing', 0)];
    const e = explainValuation(data, fx);
    const auction = e.breakdown.find((b) => b.observation.source.kind === 'auction_realized');
    const listing = e.breakdown.find((b) => b.observation.source.kind === 'listing');
    // auction_realized: 1.0 × 0.5 (1 an) = 0.5 ; listing: 0.4 × 1 = 0.4
    expect(auction?.sourceWeight).toBe(1.0);
    expect(auction?.recencyWeight).toBeCloseTo(0.5, 2);
    expect(auction?.effectiveWeight).toBeCloseTo(0.5, 2);
    expect(listing?.effectiveWeight).toBeCloseTo(0.4, 2);
  });

  it('normalise les devises en EUR dans le détail', () => {
    const data = [obs(100, 'marketplace_sold', 0, 'USD'), obs(90, 'marketplace_sold')];
    const e = explainValuation(data, fx);
    const usd = e.breakdown.find((b) => b.observation.currency === 'USD');
    expect(usd?.priceEUR).toBe(90); // 100 USD × 0.9
  });

  it('produit des notes lisibles et un score recomposable', () => {
    const data = [obs(200, 'auction_realized'), obs(210, 'official_quote'), obs(205, 'auction_realized')];
    const e = explainValuation(data, fx);
    expect(e.notes.length).toBeGreaterThanOrEqual(3);
    expect(e.notes.join(' ')).toMatch(/observation/i);
    // Le score recomposé depuis l'explication == moteur.
    expect(reliabilityFromExplanation(e)).toBe(e.reliability);
  });

  it('MAD = 0 (prix identiques) → tout conservé, pas de déviation', () => {
    const data = [obs(100, 'marketplace_sold'), obs(100, 'marketplace_sold'), obs(100, 'marketplace_sold')];
    const e = explainValuation(data, fx);
    expect(e.nRejected).toBe(0);
    expect(e.breakdown.every((b) => b.madDeviation === undefined)).toBe(true);
  });
});

describe('explainFromResult (client, sans FX)', () => {
  it('explique un ValuationResult déjà calculé sans re-valoriser', () => {
    const data = [obs(200, 'auction_realized'), obs(210, 'official_quote'), obs(205, 'auction_realized')];
    const result = valuate(data, fx);
    const e = explainFromResult(result);
    expect(e.central).toBe(result.central);
    expect(e.ci80).toEqual(result.ci80);
    expect(e.reliability).toBe(result.reliability);
    expect(e.nKept).toBe(result.observations.length);
    expect(e.nSources).toBe(result.nSources);
    // Toutes les observations d'un résultat sont conservées.
    expect(e.breakdown.every((b) => b.kept)).toBe(true);
    expect(reliabilityFromExplanation(e)).toBe(e.reliability);
    expect(e.notes.join(' ')).toMatch(/Fiabilité/);
  });

  it('renseigne priceEUR uniquement pour les observations en EUR', () => {
    const result = valuate([obs(100, 'marketplace_sold', 0, 'USD'), obs(90, 'marketplace_sold')], fx);
    const e = explainFromResult(result);
    const usd = e.breakdown.find((b) => b.observation.currency === 'USD');
    const eur = e.breakdown.find((b) => b.observation.currency === 'EUR');
    expect(usd?.priceEUR).toBeUndefined(); // pas de FX côté client
    expect(eur?.priceEUR).toBe(90);
  });
});
