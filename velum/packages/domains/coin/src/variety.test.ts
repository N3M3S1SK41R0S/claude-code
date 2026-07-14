import { describe, expect, it } from 'vitest';
import { assessVarieties, classifyVarietyHint, type KnownVariety } from './variety.ts';

const known: KnownVariety[] = [
  {
    id: 'lincoln-1955-ddo',
    kind: 'doubled_die',
    label: '1955 Doubled Die Obverse',
    valueMultiplier: [20, 60],
    cues: ['doubling on date', 'doubling on liberty', 'doubled inscriptions'],
  },
  {
    id: 'rpm-generic',
    kind: 'repunched_mint_mark',
    label: 'Repunched Mint Mark',
    valueMultiplier: [2, 5],
    cues: ['secondary mint mark', 'repunched D'],
  },
];

describe('classifyVarietyHint', () => {
  it('reconnaît les synonymes de doubled die', () => {
    expect(classifyVarietyHint('strong DDO visible')).toBe('doubled_die');
    expect(classifyVarietyHint('doublage de la date')).toBe('doubled_die');
  });
  it('reconnaît RPM et erreurs de flan', () => {
    expect(classifyVarietyHint('RPM')).toBe('repunched_mint_mark');
    expect(classifyVarietyHint('flan décentré')).toBe('mint_error');
  });
  it('indice non reconnu → null', () => {
    expect(classifyVarietyHint('belle patine')).toBeNull();
  });
});

describe('assessVarieties', () => {
  it('apparie une variété majeure à forte valeur', () => {
    const a = assessVarieties({
      hints: ['doubling on date', 'doubling on liberty', 'DDO'],
      known,
    });
    expect(a.matches[0]?.variety.id).toBe('lincoln-1955-ddo');
    expect(a.topMultiplier).toEqual([20, 60]);
    expect(a.matches[0]?.confidence).toBeGreaterThan(0.6);
  });

  it('sous le seuil de confiance → aucun match, pièce courante', () => {
    const a = assessVarieties({ hints: ['doubling on date'], known, minConfidence: 0.8 });
    expect(a.matches).toHaveLength(0);
    expect(a.topMultiplier).toBeUndefined();
    expect(a.notes.join(' ')).toMatch(/courante/i);
  });

  it('trie par espérance de valeur (confiance × multiplicateur)', () => {
    const a = assessVarieties({
      hints: ['doubling on date', 'doubling on liberty', 'doubled inscriptions', 'secondary mint mark', 'repunched D'],
      known,
    });
    // Le DDO (×60) doit primer sur le RPM (×5) même si les deux matchent à 100 %.
    expect(a.matches[0]?.variety.id).toBe('lincoln-1955-ddo');
  });

  it('toujours une réserve d’attribution', () => {
    expect(assessVarieties({ hints: [], known }).caveat).toMatch(/confirmer par un spécialiste/i);
  });
});
