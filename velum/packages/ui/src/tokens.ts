/**
 * Tokens de design VELUM typés — réexport de la SOURCE DE VÉRITÉ `tailwind.js`
 * (identité sceau de cire : fond sombre chaud, bordeaux profond, or),
 * complétée par l'échelle d'espacement, les rayons et les variantes de texte
 * garanties AA sur fond ink.
 */
import { velumColors, velumTailwindTheme } from '../tailwind.js';
import type { VelumColors, VelumTailwindTheme } from '../tailwind.js';

export { velumColors, velumTailwindTheme };
export type { VelumColors, VelumTailwindTheme };

/** Échelle d'espacement 4/8/12/16/24/32 (pt). */
export const velumSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type VelumSpacingKey = keyof typeof velumSpacing;

/** Rayons — miroir numérique de `velumTailwindTheme.borderRadius`. */
export const velumRadius = {
  /** Cartes et champs. */
  card: 16,
  /** Pastilles « sceau » (pilules). */
  seal: 999,
  /** Petits éléments (champs de saisie, badges rectangulaires). */
  field: 12,
  /** Cadres « galerie » (passe-partout autour d'un média encadré). */
  frame: 24,
} as const;

/**
 * Profondeur (ombres portées) — l'écrin « velours » gagne en relief : les
 * surfaces se détachent du fond cave par une ombre douce, la couleur primaire
 * (or) par un halo chaud. Compatible iOS (shadow*), Android (elevation) et
 * RN-web (boxShadow dérivé). Purement décoratif : n'affecte aucun contraste.
 */
export const velumElevation = {
  /** Cartes, panneaux : léger décollement. */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  /** Surfaces mises en avant (bandeaux, modales) : relief marqué. */
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 14,
  },
  /** Halo doré discret pour l'action primaire (or) — reflet de joaillerie. */
  gold: {
    shadowColor: velumColors.gold.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export type VelumElevationKey = keyof typeof velumElevation;

/** Liseré : chaud (défaut) ou doré (surfaces « serties » : bandeaux, offres). */
export const velumHairline = {
  warm: velumColors.ink.border,
  gilded: 'rgba(201, 162, 39, 0.38)',
  /** Filet doré atténué (anneaux intérieurs, ornements discrets). */
  gildedFaint: 'rgba(201, 162, 39, 0.18)',
} as const;

/**
 * Couleurs de texte garanties AA (≥ 4.5:1) sur les fonds sombres `ink.*`.
 * NOTE : `velumColors.danger` (#C0392B) ne fait que ≈ 3.6:1 sur ink — trop
 * faible pour du texte ; on utilise une variante éclaircie dérivée (#E07A6A,
 * ≈ 6.7:1). La palette source `tailwind.js` reste inchangée (les 3 ratios
 * exigés passent déjà) : `danger` y sert de couleur de fond/action.
 */
export const velumOnInk = {
  default: velumColors.parchment.DEFAULT,
  dim: velumColors.parchment.dim,
  gold: velumColors.gold.soft,
  danger: '#E07A6A',
  // Variante texte éclaircie : le vert brut (#4C9A6A) tombe à 4.38 sur le
  // fond teinté d'un badge (≈ #2A2623) ; #5AAE7A y tient 5.5:1 (WCAG AA).
  success: '#5AAE7A',
  warning: velumColors.warning,
  neutral: velumColors.parchment.dim,
} as const;

export type VelumOnInkTone = keyof typeof velumOnInk;

/**
 * Palette des boutons — chaque paire texte/fond est vérifiée AA par les tests
 * de `a11y.test.ts` (pour `ghost`, fond transparent → contraste mesuré sur ink).
 */
export const velumButtonPalette = {
  primary: {
    background: velumColors.gold.DEFAULT,
    text: velumColors.ink.DEFAULT,
    border: 'transparent',
  },
  secondary: {
    background: velumColors.bordeaux.DEFAULT,
    text: velumColors.parchment.DEFAULT,
    border: 'transparent',
  },
  ghost: {
    background: 'transparent',
    text: velumColors.gold.soft,
    border: velumColors.ink.border,
  },
  danger: {
    // parchemin sur danger ≈ 4.45:1 (insuffisant) → blanc pur (≈ 5.4:1).
    background: velumColors.danger,
    text: '#FFFFFF',
    border: 'transparent',
  },
} as const;

export type VelumButtonVariant = keyof typeof velumButtonPalette;

/** Suffixe alpha hex (≈ 15 %) pour les fonds teintés des badges. */
export const BADGE_TINT_ALPHA = '26';
