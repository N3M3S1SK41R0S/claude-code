/**
 * Texte VELUM — Dynamic Type toujours actif (allowFontScaling), plafonné à
 * ×2.5, tailles majorées ×1.25 en mode senior, contrastes AA sur fond ink.
 */
import { Platform, StyleSheet, Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { useSeniorMode } from '../senior';
import { velumOnInk } from '../tokens';

export type VTextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption';
export type VTextTone = 'default' | 'dim' | 'gold' | 'danger';

export interface VTextProps extends TextProps {
  variant?: VTextVariant;
  tone?: VTextTone;
  center?: boolean;
  /**
   * Chiffres à chasse fixe (tabular-nums) : les nombres qui changent (valeurs,
   * prix, pourcentages, millésimes, compteurs) ne « sautent » plus et
   * s'alignent en colonne. À activer sur tout affichage numérique variable.
   */
  tabularNums?: boolean;
}

/** Plafond Dynamic Type : lisible sans casser les mises en page. */
export const MAX_FONT_SIZE_MULTIPLIER = 2.5;

/** Serif système (pas de font custom) : Georgia, `serif` générique sur Android. */
const SERIF_FAMILY = Platform.select({ android: 'serif', default: 'Georgia' });

interface VariantSpec {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  serif: boolean;
  /** Interlettrage propre à la variante : serrer les titres sertis (serif),
   *  ouvrir légèrement les libellés courts pour la lisibilité gravée. */
  letterSpacing: number;
}

const VARIANTS: Record<VTextVariant, VariantSpec> = {
  // Moment héroïque (onboarding, offres) : sérif ample, lettres resserrées.
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', serif: true, letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', serif: true, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', serif: false, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', serif: false, letterSpacing: 0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', serif: false, letterSpacing: 0.3 },
};

const TONES: Record<VTextTone, string> = {
  default: velumOnInk.default,
  dim: velumOnInk.dim,
  gold: velumOnInk.gold,
  danger: velumOnInk.danger,
};

export function VText({
  variant = 'body',
  tone = 'default',
  center = false,
  tabularNums = false,
  style,
  children,
  ...rest
}: VTextProps) {
  const { scale } = useSeniorMode();
  const spec = VARIANTS[variant];

  const computed: TextStyle = {
    fontSize: scale(spec.fontSize),
    lineHeight: scale(spec.lineHeight),
    fontWeight: spec.fontWeight,
    letterSpacing: spec.letterSpacing,
    color: TONES[tone],
    ...(spec.serif ? { fontFamily: SERIF_FAMILY } : null),
    ...(center ? { textAlign: 'center' as const } : null),
    ...(tabularNums ? { fontVariant: ['tabular-nums' as const] } : null),
  };

  return (
    <Text
      {...rest}
      style={[computed, style]}
      allowFontScaling={true}
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
    >
      {children}
    </Text>
  );
}
