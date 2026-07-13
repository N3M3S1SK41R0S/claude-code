import { describe, expect, it } from 'vitest';
import type { WineAnalysisPayload } from '@velum/core';
import {
  CELLAR_SOMMELIER_PROMPT,
  drinkNowSuggestions,
  isInDrinkWindow,
  parsePairingResponse,
  recommendForDish,
} from './cellar.ts';

function makePayload(from: number, to: number): WineAnalysisPayload {
  return {
    identification: { producer: 'Clos Rougeard', vintage: 2014 },
    tasting: {
      robe: 'grenat profond',
      nose: ['fruits noirs'],
      palate: { structure: 'ample', acidity: 'fraîche' },
      length: 'longue',
      agingPotentialYears: [10, 25],
      drinkWindow: { from, to },
    },
    ratings: { positioning: 'collector' },
    market: { assetClass: 'collection' },
    comparisons: { foodPairings: ['pigeon rôti'] },
    uncertainties: ['Niveau de la bouteille inconnu.'],
  };
}

describe('isInDrinkWindow (§6.2.3 — alerte « à boire »)', () => {
  it('true à l’intérieur de la fenêtre, bornes incluses', () => {
    const payload = makePayload(2024, 2035);
    expect(isInDrinkWindow(payload, 2024)).toBe(true);
    expect(isInDrinkWindow(payload, 2026)).toBe(true);
    expect(isInDrinkWindow(payload, 2035)).toBe(true);
  });

  it('false hors de la fenêtre', () => {
    const payload = makePayload(2024, 2035);
    expect(isInDrinkWindow(payload, 2023)).toBe(false);
    expect(isInDrinkWindow(payload, 2036)).toBe(false);
  });

  it('false (jamais d’alerte à tort) si la fenêtre est absente ou malformée', () => {
    const broken = makePayload(2024, 2035) as unknown as Record<string, unknown>;
    broken['tasting'] = undefined;
    expect(isInDrinkWindow(broken as unknown as WineAnalysisPayload, 2026)).toBe(false);

    const malformed = makePayload(2024, 2035);
    (malformed.tasting.drinkWindow as unknown as Record<string, unknown>)['from'] = 'demain';
    expect(isInDrinkWindow(malformed, 2026)).toBe(false);
  });
});

describe('sommelier de cave — sens 1 : plat → vin de MA cave', () => {
  const cellar = [
    { itemId: 'a1', label: 'Bandol Domaine Tempier 2018', color: 'rouge' },
    { itemId: 'b2', label: 'Sancerre Vacheron 2022', color: 'blanc' },
  ];

  it('parse une réponse valide, triée par score décroissant', () => {
    const raw = JSON.stringify({
      recommendations: [
        { itemId: 'b2', label: 'Sancerre Vacheron 2022', score: 0.6, reasoning: 'vivacité' },
        { itemId: 'a1', label: 'Bandol Domaine Tempier 2018', score: 0.92, reasoning: 'mourvèdre puissant', serveAt: '17 °C, carafé 1 h' },
      ],
    });
    const result = parsePairingResponse(raw, cellar);
    expect(result.recommendations.map((r) => r.itemId)).toEqual(['a1', 'b2']);
    expect(result.recommendations[0]?.serveAt).toContain('carafé');
  });

  it('anti-hallucination : un vin hors cave est écarté, le score est borné', () => {
    const raw = JSON.stringify({
      recommendations: [
        { itemId: 'zz-hallucination', label: 'Pétrus 1990', score: 1.0, reasoning: '…' },
        { itemId: 'a1', score: 7, reasoning: 'score aberrant borné' },
      ],
    });
    const result = parsePairingResponse(raw, cellar);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({ itemId: 'a1', score: 1 });
    // le label manquant est repris de la cave, jamais inventé
    expect(result.recommendations[0]?.label).toBe('Bandol Domaine Tempier 2018');
  });

  it('réponse illisible → aucune recommandation (pas de crash)', () => {
    expect(parsePairingResponse('désolé, je ne peux pas', cellar)).toEqual({
      recommendations: [],
      fallbackAdvice: undefined,
    });
  });

  it('recommendForDish appelle le LLM avec le prompt sommelier et l’inventaire', async () => {
    let seen: { system: string; prompt: string } | null = null;
    const vision = {
      complete: async (req: { system: string; prompt: string }) => {
        seen = req;
        return '```json\n{"recommendations":[{"itemId":"a1","score":0.9,"reasoning":"ok"}]}\n```';
      },
    };
    const result = await recommendForDish({ dish: 'magret de canard aux figues', cellar }, vision);
    expect(seen!.system).toBe(CELLAR_SOMMELIER_PROMPT);
    expect(seen!.prompt).toContain('magret de canard');
    expect(seen!.prompt).toContain('a1');
    expect(result.recommendations[0]?.itemId).toBe('a1');
  });

  it('cave vide → fallback sans appel LLM', async () => {
    const vision = {
      complete: async () => {
        throw new Error('ne doit pas être appelé');
      },
    };
    const result = await recommendForDish({ dish: 'risotto', cellar: [] }, vision);
    expect(result.recommendations).toEqual([]);
    expect(result.fallbackAdvice).toContain('cave est vide');
  });
});

describe('sens 2 : apogée → « à boire » avec plats suggérés', () => {
  it('remonte les vins dans leur fenêtre, urgents d’abord, avec accords ZAPPA', () => {
    const wines = [
      { itemId: 'w1', label: 'Vin A', vintage: 2010, payload: makePayload(2015, 2027) },
      { itemId: 'w2', label: 'Vin B', vintage: 2005, payload: makePayload(2020, 2026) },
      { itemId: 'w3', label: 'Trop jeune', vintage: 2022, payload: makePayload(2030, 2040) },
    ];
    const suggestions = drinkNowSuggestions(wines, 2026);
    expect(suggestions.map((s) => s.itemId)).toEqual(['w2', 'w1']); // w2 se referme en premier
    expect(suggestions[0]?.suggestedDishes.length).toBeGreaterThan(0);
    expect(suggestions[0]?.windowTo).toBe(2026);
  });
});
