/**
 * Tests d'accessibilité — PREUVE que la palette VELUM respecte WCAG 2.2 AA
 * (contraste ≥ 4.5:1 pour le texte normal) sur les fonds sombres.
 */
import { describe, expect, it } from 'vitest';

import {
  MIN_TOUCH_TARGET,
  SENIOR_TOUCH_TARGET,
  contrastRatio,
  hexToLuminance,
  scaleForSenior,
  touchTargetSize,
} from './a11y';
import { velumButtonPalette, velumColors, velumOnInk } from './tokens';

const AA_NORMAL_TEXT = 4.5;

describe('hexToLuminance', () => {
  it('donne 0 pour le noir et 1 pour le blanc', () => {
    expect(hexToLuminance('#000000')).toBe(0);
    expect(hexToLuminance('#FFFFFF')).toBe(1);
  });

  it('accepte la forme courte #RGB', () => {
    expect(hexToLuminance('#FFF')).toBe(1);
    expect(hexToLuminance('#000')).toBe(0);
  });

  it('rejette une couleur invalide', () => {
    expect(() => hexToLuminance('pas-une-couleur')).toThrow(/invalide/);
    expect(() => hexToLuminance('#12345')).toThrow(/invalide/);
  });
});

describe('contrastRatio (formule WCAG)', () => {
  it('vaut 21 entre noir et blanc, 1 entre couleurs identiques', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#7A2230', '#7A2230')).toBeCloseTo(1, 5);
  });

  it('est symétrique', () => {
    expect(contrastRatio('#F2E7D5', '#14090B')).toBeCloseTo(contrastRatio('#14090B', '#F2E7D5'), 10);
  });
});

describe('conformité AA de la palette VELUM (exigences explicites)', () => {
  it('parchemin sur ink ≥ 4.5 (texte principal)', () => {
    expect(contrastRatio(velumColors.parchment.DEFAULT, velumColors.ink.DEFAULT)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it('or soft sur ink ≥ 4.5 (accents dorés)', () => {
    expect(contrastRatio(velumColors.gold.soft, velumColors.ink.DEFAULT)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('parchemin sur bordeaux profond ≥ 4.5 (bandeaux bordeaux)', () => {
    expect(contrastRatio(velumColors.parchment.DEFAULT, velumColors.bordeaux.deep)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});

describe('conformité AA des tonalités de texte (velumOnInk)', () => {
  const tones = Object.entries(velumOnInk);

  it.each(tones)('tonalité « %s » ≥ 4.5 sur ink.DEFAULT', (_tone, color) => {
    expect(contrastRatio(color, velumColors.ink.DEFAULT)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(tones)('tonalité « %s » ≥ 4.5 sur ink.raised (cartes)', (_tone, color) => {
    expect(contrastRatio(color, velumColors.ink.raised)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  // Fond composé d'un badge teinté (couleur à ~15 % sur une carte) : la teinte
  // la plus claire mesurée (axe-core) est ≈ #2A2623 ; les tonalités de texte
  // doivent y rester lisibles (régression du badge « Populaire »).
  it.each(tones)('tonalité « %s » ≥ 4.5 sur le fond teinté d’un badge (#2A2623)', (_tone, color) => {
    expect(contrastRatio(color, '#2A2623')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('le danger brut (#C0392B) est bien insuffisant en texte — d’où la variante éclaircie', () => {
    expect(contrastRatio(velumColors.danger, velumColors.ink.DEFAULT)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(velumOnInk.danger, velumColors.ink.DEFAULT)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe('conformité AA des boutons (velumButtonPalette)', () => {
  it.each(Object.entries(velumButtonPalette))('variante « %s » : texte/fond ≥ 4.5', (_variant, palette) => {
    // Fond transparent (ghost) → le contraste effectif se mesure sur ink.
    const background = palette.background === 'transparent' ? velumColors.ink.DEFAULT : palette.background;
    expect(contrastRatio(palette.text, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe('cibles tactiles', () => {
  it('44 pt minimum, 56 pt en mode senior', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
    expect(SENIOR_TOUCH_TARGET).toBe(56);
    expect(touchTargetSize(false)).toBe(MIN_TOUCH_TARGET);
    expect(touchTargetSize(true)).toBe(SENIOR_TOUCH_TARGET);
  });
});

describe('scaleForSenior (logique de useSeniorMode().scale)', () => {
  it('majore ×1.25 arrondi en mode senior : 16 → 20', () => {
    expect(scaleForSenior(16, true)).toBe(20);
  });

  it('est l’identité hors mode senior', () => {
    expect(scaleForSenior(16, false)).toBe(16);
    expect(scaleForSenior(13, false)).toBe(13);
  });

  it('arrondit au plus proche : 13 → 16, 28 → 35', () => {
    expect(scaleForSenior(13, true)).toBe(16); // 16.25 → 16
    expect(scaleForSenior(28, true)).toBe(35);
    expect(scaleForSenior(44, true)).toBe(55);
  });
});
