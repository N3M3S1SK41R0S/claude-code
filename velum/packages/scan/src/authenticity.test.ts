import { describe, expect, it } from 'vitest';
import { assessAuthenticity, type PhysicalReference } from './authenticity.ts';

// Napoléon 20 F or : 6,45 g, 21 mm, non magnétique, tranche inscrite.
const ref: PhysicalReference = {
  weightGrams: { expected: 6.45, tolerance: 0.05 },
  diameterMm: { expected: 21, tolerance: 0.2 },
  magnetic: false,
  edge: 'inscrite',
};

describe('assessAuthenticity', () => {
  it('mesures conformes → risque nul, pas de mismatch dur', () => {
    const f = assessAuthenticity(
      { weightGrams: 6.44, diameterMm: 21.0, magnetic: false, edge: 'inscrite' },
      ref,
    );
    expect(f.risk).toBe('none');
    expect(f.hardMismatch).toBe(false);
    expect(f.disclaimer).toMatch(/jamais un verdict/i);
  });

  it('magnétique alors que l’authentique ne l’est pas → risque élevé, signal fort', () => {
    const f = assessAuthenticity({ weightGrams: 6.45, magnetic: true }, ref);
    expect(f.hardMismatch).toBe(true);
    expect(f.risk).toBe('elevated');
    const magnet = f.signals.find((s) => s.attribute === 'Magnétisme');
    expect(magnet?.ok).toBe(false);
    expect(magnet?.detail).toMatch(/acier|contrefaçon/i);
  });

  it('deux incohérences déterministes → risque haut', () => {
    const f = assessAuthenticity({ weightGrams: 5.0, diameterMm: 24, magnetic: false }, ref);
    expect(f.risk).toBe('high');
  });

  it('jamais un verdict : toujours un disclaimer', () => {
    const f = assessAuthenticity({ weightGrams: 6.45 }, ref);
    expect(f.disclaimer.length).toBeGreaterThan(0);
    expect(f.signals.every((s) => 'ok' in s)).toBe(true);
  });

  it('registre communautaire : match de faux connu → risque haut', () => {
    const f = assessAuthenticity({ weightGrams: 6.45, diameterMm: 21, magnetic: false }, ref, {
      knownFakeMatch: { score: 0.92, note: 'Coin de faux référencé (Numista)' },
    });
    expect(f.risk).toBe('high');
    expect(f.knownFakeMatch?.score).toBe(0.92);
  });

  it('match faible sous le seuil → ignoré', () => {
    const f = assessAuthenticity({ weightGrams: 6.45, diameterMm: 21, magnetic: false }, ref, {
      knownFakeMatch: { score: 0.5, note: 'x' },
    });
    expect(f.knownFakeMatch).toBeUndefined();
    expect(f.risk).toBe('none');
  });

  it('expertise recommandée au-delà du seuil de valeur (500 €)', () => {
    const f = assessAuthenticity({ weightGrams: 6.45, diameterMm: 21, magnetic: false }, ref, {
      valueEUR: 900,
    });
    expect(f.expertiseRecommended).toBe(true);
    expect(f.risk).toBe('none'); // valeur ≠ risque : on recommande sans accuser
  });

  it('mesures absentes → aucun signal, risque nul, honnête', () => {
    const f = assessAuthenticity({}, ref);
    expect(f.signals).toEqual([]);
    expect(f.risk).toBe('none');
    expect(f.hardMismatch).toBe(false);
  });
});
