/**
 * Texte VELUM — Dynamic Type toujours actif (allowFontScaling), plafonné à
 * ×2.5, tailles majorées ×1.25 en mode senior, contrastes AA sur fond ink.
 */
import { Platform, StyleSheet, Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { useSeniorMode } from '../senior';
import { velumOnInk } from '../tokens';

export type VTextVariant = 'title' | 'heading' | 'body' | 'caption';
export type VTextTone = 'default' | 'dim' | 'gold' | 'danger';

export interface VTextProps extends TextProps {
  variant?: VTextVariant;
  tone?: VTextTone;
  center?: boolean;
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
}

const VARIANTS: Record<VTextVariant, VariantSpec> = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', serif: true },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', serif: false },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', serif: false },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', serif: false },
};

const TONES: Record<VTextTone, string> = {
  default: velumOnInk.default,
  dim: velumOnInk.dim,
  gold: velumOnInk.gold,
  danger: velumOnInk.danger,
};

export function VText({ variant = 'body', tone = 'default', center = false, style, children, ...rest }: VTextProps) {
  const { scale } = useSeniorMode();
  const spec = VARIANTS[variant];

  const computed: TextStyle = {
    fontSize: scale(spec.fontSize),
    lineHeight: scale(spec.lineHeight),
    fontWeight: spec.fontWeight,
    color: TONES[tone],
    ...(spec.serif ? { fontFamily: SERIF_FAMILY } : null),
    ...(center ? { textAlign: 'center' as const } : null),
  };

  return (
    <Text
      {...rest}
      style={[styles.base, computed, style]}
      allowFontScaling={true}
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    // Défauts communs — la variante fournit taille/graisse/couleur.
    letterSpacing: 0.2,
  },
});
