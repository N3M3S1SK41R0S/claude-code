import { describe, expect, it } from 'vitest';
import type { FxRates, PriceObservation } from '@velum/core';
import { valuate } from './engine.ts';
import { explainFromResult, explainValuation, reliabilityFromExplanation } from './explain.ts';

const fx: FxRates = { USD: 0.9, GBP: 1.15 };

function obs(
  price: number,
  kind: PriceObservation['source']['kind'],
  ageDays = 0,
  currency = 'EUR',
): PriceObservation {
  return {
    price,
    currency,
    ageDays,
    sourceWeight: undefined as unknown as number,
    source: { name: kind, kind },
  };
}

describe('explainValuation', () => {
  it('central et IC coïncident exactement avec le moteur valuate()', () => {
    const data = [
      obs(100, 'auction_realized'),
      obs(110, 'official_quote'),
      obs(105, 'marketplace_sold'),
    ];
    const valuation = valuate(data, fx);
    const explanation = explainValuation(data, fx);
    expect(explanation.central).toBe(valuation.central);
    expect(explanation.ci80).toEqual(valuation.ci80);
    expect(explanation.ci95).toEqual(valuation.ci95);
    expect(explanation.reliability).toBe(valuation.reliability);
    expect(explanation.nKept).toBe(valuation.observations.length);
    expect(explanation.nSources).toBe(valuation.nSources);
  });

  it('marque les aberrants (règle MAD) comme écartés avec une raison', () => {
    const data = [
      obs(100, 'marketplace_sold'),
      obs(102, 'marketplace_sold'),
      obs(98, 'marketplace_sold'),
      obs(101, 'marketplace_sold'),
      obs(5000, 'listing'),
    ];
    const explanation = explainValuation(data, fx);
    expect(explanation.nKept).toBe(4);
    expect(explanation.nRejected).toBe(1);
    const outlier = explanation.breakdown.find((entry) => entry.priceEUR === 5000);
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
    const explanation = explainValuation(data, fx);

    expect(explanation.nKept).toBe(3);
    expect(explanation.nSources).toBe(2);
    expect(explanation.reliabilityFactors.countScore).toBe(0.25);
    expect(explanation.notes.join(' ')).toMatch(/3 observations.*2 sources distinctes/i);
  });

  it('décompose fiabilité × récence dans le poids effectif', () => {
    const data = [obs(100, 'auction_realized', 365), obs(100, 'listing', 0)];
    const explanation = explainValuation(data, fx);
    const auction = explanation.breakdown.find(
      (entry) => entry.observation.source.kind === 'auction_realized',
    );
    const listing = explanation.breakdown.find(
      (entry) => entry.observation.source.kind === 'listing',
    );
    expect(auction?.sourceWeight).toBe(1.0);
    expect(auction?.recencyWeight).toBeCloseTo(0.5, 2);
    expect(auction?.effectiveWeight).toBeCloseTo(0.5, 2);
    expect(listing?.effectiveWeight).toBeCloseTo(0.4, 2);
  });

  it('normalise les devises en EUR dans le détail', () => {
    const data = [obs(100, 'marketplace_sold', 0, 'USD'), obs(90, 'marketplace_sold')];
    const explanation = explainValuation(data, fx);
    const usd = explanation.breakdown.find((entry) => entry.observation.currency === 'USD');
    expect(usd?.priceEUR).toBe(90);
  });

  it('produit des notes lisibles et un score recomposable', () => {
    const data = [
      obs(200, 'auction_realized'),
      obs(210, 'official_quote'),
      obs(205, 'auction_realized'),
    ];
    const explanation = explainValuation(data, fx);
    expect(explanation.notes.length).toBeGreaterThanOrEqual(3);
    expect(explanation.notes.join(' ')).toMatch(/observation/i);
    expect(reliabilityFromExplanation(explanation)).toBe(explanation.reliability);
  });

  it('MAD = 0 (prix identiques) → tout conservé, pas de déviation', () => {
    const data = [
      obs(100, 'marketplace_sold'),
      obs(100, 'marketplace_sold'),
      obs(100, 'marketplace_sold'),
    ];
    const explanation = explainValuation(data, fx);
    expect(explanation.nRejected).toBe(0);
    expect(explanation.breakdown.every((entry) => entry.madDeviation === undefined)).toBe(true);
  });
});

describe('explainFromResult (client, sans FX)', () => {
  it('explique un ValuationResult déjà calculé sans re-valoriser', () => {
    const data = [
      obs(200, 'auction_realized'),
      obs(210, 'official_quote'),
      obs(205, 'auction_realized'),
    ];
    const result = valuate(data, fx);
    const explanation = explainFromResult(result);
    expect(explanation.central).toBe(result.central);
    expect(explanation.ci80).toEqual(result.ci80);
    expect(explanation.reliability).toBe(result.reliability);
    expect(explanation.nKept).toBe(result.observations.length);
    expect(explanation.nSources).toBe(result.nSources);
    expect(explanation.breakdown.every((entry) => entry.kept)).toBe(true);
    expect(reliabilityFromExplanation(explanation)).toBe(explanation.reliability);
    expect(explanation.notes.join(' ')).toMatch(/Fiabilité/);
  });

  it('renseigne priceEUR uniquement pour les observations en EUR', () => {
    const result = valuate(
      [obs(100, 'marketplace_sold', 0, 'USD'), obs(90, 'marketplace_sold')],
      fx,
    );
    const explanation = explainFromResult(result);
    const usd = explanation.breakdown.find((entry) => entry.observation.currency === 'USD');
    const eur = explanation.breakdown.find((entry) => entry.observation.currency === 'EUR');
    expect(usd?.priceEUR).toBeUndefined();
    expect(eur?.priceEUR).toBe(90);
  });

  it('recalcule explicitement un score historique selon le moteur courant', () => {
    const observations = [
      {
        ...obs(48, 'auction_realized'),
        source: { name: 'iDealwine', kind: 'auction_realized' as const },
      },
      {
        ...obs(50, 'auction_realized'),
        source: { name: 'iDealwine', kind: 'auction_realized' as const },
      },
      {
        ...obs(53, 'official_quote'),
        source: { name: 'Wine-Searcher', kind: 'official_quote' as const },
      },
      {
        ...obs(56, 'listing'),
        source: { name: 'Cavissima', kind: 'listing' as const },
      },
    ];
    const explanation = explainFromResult({
      central: 51,
      ci80: [45, 58],
      ci95: [42, 62],
      reliability: 81,
      observations,
    });

    expect(explanation.reliability).toBe(56);
    expect(explanation.storedReliability).toBe(81);
    expect(explanation.reliabilityRecomputed).toBe(true);
    expect(explanation.nKept).toBe(4);
    expect(explanation.nSources).toBe(3);
    expect(explanation.notes.join(' ')).toMatch(/score enregistré : 81\/100/i);
    expect(reliabilityFromExplanation(explanation)).toBe(56);
  });

  it('préserve un score historique sans sources et n’invente pas sa décomposition', () => {
    const explanation = explainFromResult({
      central: 51,
      ci80: [45, 58],
      ci95: [42, 62],
      reliability: 81,
      observations: [],
    });

    expect(explanation.reliability).toBe(81);
    expect(explanation.reliabilityRecomputed).toBe(false);
    expect(explanation.nSources).toBe(0);
    expect(explanation.notes.join(' ')).toMatch(/détail du calcul indisponible/i);
    expect(reliabilityFromExplanation(explanation)).toBe(81);
  });
});
