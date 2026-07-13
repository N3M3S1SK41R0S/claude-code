/**
 * Utilitaires d'accessibilité VELUM (WCAG 2.2 AA + mode senior, §11.2).
 * Fonctions pures — testées sans rendu React Native.
 */

/** Taille minimale d'une cible tactile (WCAG 2.5.8 / plateformes mobiles). */
export const MIN_TOUCH_TARGET = 44;

/** Taille de cible tactile majorée en mode senior. */
export const SENIOR_TOUCH_TARGET = 56;

/** Facteur de majoration typographique du mode senior. */
export const SENIOR_SCALE_FACTOR = 1.25;

/**
 * Convertit un canal sRGB 0..255 en valeur linéarisée (formule WCAG).
 */
function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Luminance relative WCAG d'une couleur hexadécimale (`#RGB` ou `#RRGGBB`).
 * Résultat dans [0, 1] : 0 = noir, 1 = blanc.
 */
export function hexToLuminance(hex: string): number {
  const raw = hex.replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Couleur hexadécimale invalide : « ${hex} »`);
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

/**
 * Ratio de contraste WCAG entre deux couleurs, dans [1, 21].
 * AA texte normal : ≥ 4.5 ; AA texte large : ≥ 3.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Taille de cible tactile requise : 44 pt, 56 pt en mode senior. */
export function touchTargetSize(senior: boolean): number {
  return senior ? SENIOR_TOUCH_TARGET : MIN_TOUCH_TARGET;
}

/**
 * Majoration d'une dimension en mode senior : ×1.25 arrondi (16 → 20),
 * identité sinon. Utilisée par `useSeniorMode().scale`.
 */
export function scaleForSenior(n: number, senior: boolean): number {
  return senior ? Math.round(n * SENIOR_SCALE_FACTOR) : n;
}
