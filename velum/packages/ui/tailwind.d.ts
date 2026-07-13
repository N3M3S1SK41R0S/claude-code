/**
 * Déclarations TypeScript des exports CJS de `tailwind.js` — SOURCE DE VÉRITÉ
 * des tokens couleur VELUM (sceau de cire : fond sombre chaud, bordeaux, or).
 * Consommé par tailwind.config.js (Node/CJS) ET réexporté typé par
 * `@velum/ui/src/tokens.ts` pour les composants React Native.
 */

/** Couleur hexadécimale `#RRGGBB`. */
export type VelumHex = `#${string}`;

/** Fond « cave » — brun-noir chaud. */
export interface VelumInkScale {
  DEFAULT: VelumHex;
  soft: VelumHex;
  raised: VelumHex;
  border: VelumHex;
}

/** Bordeaux — cire du sceau. */
export interface VelumBordeauxScale {
  DEFAULT: VelumHex;
  deep: VelumHex;
  bright: VelumHex;
}

/** Or — lettrage du sceau. */
export interface VelumGoldScale {
  DEFAULT: VelumHex;
  soft: VelumHex;
  faint: VelumHex;
}

/** Parchemin — textes et surfaces claires. */
export interface VelumParchmentScale {
  DEFAULT: VelumHex;
  dim: VelumHex;
  faint: VelumHex;
}

export interface VelumColors {
  ink: VelumInkScale;
  bordeaux: VelumBordeauxScale;
  gold: VelumGoldScale;
  parchment: VelumParchmentScale;
  success: VelumHex;
  warning: VelumHex;
  danger: VelumHex;
  info: VelumHex;
}

export interface VelumTailwindTheme {
  colors: VelumColors;
  fontFamily: {
    serif: string[];
    sans: string[];
  };
  borderRadius: {
    card: string;
    seal: string;
  };
}

export declare const velumColors: VelumColors;
export declare const velumTailwindTheme: VelumTailwindTheme;
