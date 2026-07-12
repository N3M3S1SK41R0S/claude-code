import { describe, expect, it } from 'vitest';
import type { WineAnalysisPayload } from '@velum/core';
import {
  BLIND_TASTING_STEPS,
  buildBlindTastingSession,
  type BlindTastingWine,
} from './blindTasting';

function wine(itemId: string, label: string, vintage?: number): BlindTastingWine {
  return vintage !== undefined ? { itemId, label, vintage } : { itemId, label };
}

const CAVE: BlindTastingWine[] = [
  wine('a', 'Bandol Tempier', 2018),
  wine('b', 'Sancerre Vacheron', 2022),
  wine('c', 'Châteauneuf Rayas', 2019),
  wine('d', 'Chablis Raveneau', 2020),
];

describe('buildBlindTastingSession', () => {
  it('numérote les cartes 1..n et associe chaque réponse à une bouteille distincte', () => {
    const session = buildBlindTastingSession(CAVE, { seed: 42 });
    expect(session.cards).toHaveLength(4);
    expect(session.answers).toHaveLength(4);
    expect(session.cards.map((c) => c.number)).toEqual([1, 2, 3, 4]);
    expect(session.answers.map((a) => a.number)).toEqual([1, 2, 3, 4]);
    // Bijection : chaque bouteille de la cave apparaît exactement une fois.
    expect(new Set(session.answers.map((a) => a.itemId))).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('est DÉTERMINISTE : même graine → même ordre de service', () => {
    const a = buildBlindTastingSession(CAVE, { seed: 7 });
    const b = buildBlindTastingSession(CAVE, { seed: 7 });
    expect(a.answers.map((x) => x.itemId)).toEqual(b.answers.map((x) => x.itemId));
  });

  it('varie avec la graine (deux graines donnent des ordres différents)', () => {
    const a = buildBlindTastingSession(CAVE, { seed: 1 });
    const b = buildBlindTastingSession(CAVE, { seed: 999 });
    // Au moins une des positions diffère (extrêmement probable sur 4 bouteilles).
    expect(a.answers.map((x) => x.itemId)).not.toEqual(b.answers.map((x) => x.itemId));
  });

  it('borne le nombre de bouteilles tirées à la taille de la cave', () => {
    expect(buildBlindTastingSession(CAVE, { count: 2, seed: 3 }).cards).toHaveLength(2);
    expect(buildBlindTastingSession(CAVE, { count: 99, seed: 3 }).cards).toHaveLength(4);
    expect(buildBlindTastingSession(CAVE, { count: 0, seed: 3 }).cards).toHaveLength(0);
    expect(buildBlindTastingSession(CAVE, { count: -5, seed: 3 }).cards).toHaveLength(0);
  });

  it('chaque carte porte le déroulé guidé complet (observations + devinettes)', () => {
    const session = buildBlindTastingSession(CAVE, { count: 1, seed: 3 });
    expect(session.cards[0]?.steps).toEqual([...BLIND_TASTING_STEPS]);
    expect(session.cards[0]?.steps.some((s) => s.kind === 'guess')).toBe(true);
  });

  it('extrait des indices depuis le payload (origine, appellation, cépages, accords) sans révéler le nom', () => {
    const payload: WineAnalysisPayload = {
      identification: {
        region: 'Provence',
        country: 'France',
        appellation: 'Bandol',
        grapes: [{ name: 'mourvèdre', percent: 80 }, { name: 'grenache' }],
      },
      tasting: {
        robe: 'grenat',
        nose: [],
        palate: { structure: 'ample', acidity: 'fraîche' },
        length: 'longue',
        agingPotentialYears: [5, 15],
        drinkWindow: { from: 2024, to: 2035 },
      },
      ratings: { positioning: 'classique' },
      market: { assetClass: 'cave' },
      comparisons: { foodPairings: ['gigot', 'daube'] },
      uncertainties: [],
    };
    const session = buildBlindTastingSession([{ itemId: 'x', label: 'SECRET', payload }], {
      seed: 1,
    });
    const hints = session.answers[0]?.hints ?? [];
    expect(hints).toContain('Provence, France');
    expect(hints).toContain('Bandol');
    expect(hints).toContain('mourvèdre / grenache');
    expect(hints).toContain('gigot');
    // Jamais le nom de la bouteille dans les indices.
    expect(hints.join(' ')).not.toContain('SECRET');
  });

  it('gère une bouteille sans analyse (aucun indice, pas de crash)', () => {
    const session = buildBlindTastingSession([wine('n', 'Vin mystère')], { seed: 1 });
    expect(session.answers[0]?.hints).toEqual([]);
    expect(session.answers[0]?.label).toBe('Vin mystère');
  });
});
