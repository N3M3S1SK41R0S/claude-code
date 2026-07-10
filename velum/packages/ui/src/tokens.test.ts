/** Tests des tokens — cohérence avec la source de vérité tailwind.js. */
import { describe, expect, it } from 'vitest';

import { velumColors as sourceColors } from '../tailwind.js';
import { velumColors, velumRadius, velumSpacing } from './tokens';

describe('tokens', () => {
  it('réexporte velumColors depuis tailwind.js (source de vérité, même référence)', () => {
    expect(velumColors).toBe(sourceColors);
    expect(velumColors.ink.DEFAULT).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(velumColors.bordeaux.deep).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(velumColors.gold.soft).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(velumColors.parchment.DEFAULT).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('expose l’échelle d’espacement 4/8/12/16/24/32', () => {
    expect(Object.values(velumSpacing)).toEqual([4, 8, 12, 16, 24, 32]);
  });

  it('expose les rayons (card 16, seal pilule)', () => {
    expect(velumRadius.card).toBe(16);
    expect(velumRadius.seal).toBeGreaterThanOrEqual(999);
  });
});
