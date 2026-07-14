import { describe, expect, it } from 'vitest';
import type { StampCondition } from '@velum/core';
import { gradeStamp } from './grading.ts';

function cond(partial: Partial<StampCondition>): StampCondition {
  return {
    status: 'neuf_sans_charniere',
    gum: 'intacte',
    centering: 'bon',
    faults: [],
    confidence: 0.8,
    caveat: '',
    ...partial,
  };
}

describe('gradeStamp', () => {
  it('neuf sans charnière, gomme intacte, bon centrage → multiplicateur ~1', () => {
    const g = gradeStamp(cond({}));
    expect(g.valueMultiplier).toBe(1);
  });

  it('charnière ampute fortement la valeur', () => {
    const g = gradeStamp(cond({ status: 'neuf_avec_charniere' }));
    expect(g.valueMultiplier).toBeCloseTo(0.5, 2);
  });

  it('centrage parfait prime, très décalé décote', () => {
    expect(gradeStamp(cond({ centering: 'parfait' })).valueMultiplier).toBeGreaterThan(1);
    expect(gradeStamp(cond({ centering: 'tres_decale' })).valueMultiplier).toBeLessThan(1);
  });

  it('défaut grave (aminci) décote fortement', () => {
    const g = gradeStamp(cond({ faults: ['aminci'] }));
    expect(g.valueMultiplier).toBeLessThan(0.5);
    expect(g.notes.join(' ')).toMatch(/grave/i);
  });

  it('calcule la valeur estimée depuis la cote catalogue', () => {
    const g = gradeStamp(cond({ status: 'neuf_avec_charniere' }), { catalogQuote: 1000 });
    expect(g.estimatedValue).toBe(500);
  });

  it('détecte le risque de regommage (neuf** sans gomme)', () => {
    const g = gradeStamp(cond({ status: 'neuf_sans_charniere', gum: 'sans_gomme' }));
    expect(g.regummingRisk).toBe(true);
    expect(g.notes.join(' ')).toMatch(/regommage/i);
  });

  it('oblitéré : la gomme est ignorée', () => {
    const g = gradeStamp(cond({ status: 'oblitere', gum: 'sans_gomme' }));
    expect(g.factors.gum).toBe(1);
  });

  it('confiance réduite par les défauts et le statut inconnu', () => {
    const clean = gradeStamp(cond({}));
    const faulty = gradeStamp(cond({ faults: ['pli', 'rousseurs'], status: 'inconnu' }));
    expect(faulty.confidence).toBeLessThan(clean.confidence);
  });

  it('toujours une réserve (jamais une expertise ferme)', () => {
    expect(gradeStamp(cond({})).caveat).toMatch(/jamais une expertise/i);
  });
});
