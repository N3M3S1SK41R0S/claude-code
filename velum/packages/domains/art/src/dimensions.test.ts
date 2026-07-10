import { describe, expect, it } from 'vitest';
import { parseDimensions } from './dimensions';

describe('parseDimensions', () => {
  it('parse le format standard "65 x 54 cm" (hauteur × largeur)', () => {
    expect(parseDimensions('65 x 54 cm')).toEqual({ height: 65, width: 54 });
  });

  it('tolère le signe ×, la virgule décimale et l’unité répétée', () => {
    expect(parseDimensions('65,5 × 54 cm')).toEqual({ height: 65.5, width: 54 });
    expect(parseDimensions('92.1 cm x 73.2 cm')).toEqual({ height: 92.1, width: 73.2 });
  });

  it('tolère l’absence d’espaces et d’unité', () => {
    expect(parseDimensions('100X81')).toEqual({ height: 100, width: 81 });
    expect(parseDimensions('24*19cm')).toEqual({ height: 24, width: 19 });
  });

  it('extrait les dimensions au milieu d’un texte descriptif', () => {
    expect(parseDimensions('Huile sur toile, 46 x 38 cm, encadrée')).toEqual({ height: 46, width: 38 });
  });

  it('chaîne illisible ou dimension nulle → null', () => {
    expect(parseDimensions('grand format')).toBeNull();
    expect(parseDimensions('')).toBeNull();
    expect(parseDimensions('0 x 54 cm')).toBeNull();
  });
});
