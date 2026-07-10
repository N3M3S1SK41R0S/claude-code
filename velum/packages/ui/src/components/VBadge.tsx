/**
 * Pastille VELUM — étiquette colorée (domaine, état, source de prix…),
 * fond teinté + texte AA sur fond ink.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useSeniorMode } from '../senior';
import { BADGE_TINT_ALPHA, velumColors, velumOnInk, velumRadius, velumSpacing } from '../tokens';
import { MAX_FONT_SIZE_MULTIPLIER } from './VText';

export type VBadgeTone = 'gold' | 'success' | 'warning' | 'danger' | 'neutral';

export interface VBadgeProps {
  label: string;
  tone?: VBadgeTone;
}

/** Couleur du texte par tonalité — AA sur ink (cf. velumOnInk). */
const TONE_TEXT: Record<VBadgeTone, string> = {
  gold: velumOnInk.gold,
  success: velumOnInk.success,
  warning: velumOnInk.warning,
  danger: velumOnInk.danger,
  neutral: velumOnInk.neutral,
};

/** Fond teinté (≈ 15 % d'alpha) par tonalité. */
const TONE_TINT: Record<VBadgeTone, string> = {
  gold: `${velumColors.gold.DEFAULT}${BADGE_TINT_ALPHA}`,
  success: `${velumColors.success}${BADGE_TINT_ALPHA}`,
  warning: `${velumColors.warning}${BADGE_TINT_ALPHA}`,
  danger: `${velumColors.danger}${BADGE_TINT_ALPHA}`,
  neutral: `${velumColors.parchment.faint}${BADGE_TINT_ALPHA}`,
};

export function VBadge({ label, tone = 'neutral' }: VBadgeProps) {
  const { scale } = useSeniorMode();

  return (
    <View
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: TONE_TINT[tone] }]}
    >
      <Text
        allowFontScaling={true}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.label, { color: TONE_TEXT[tone], fontSize: scale(13), lineHeight: scale(18) }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: velumRadius.seal,
    paddingHorizontal: velumSpacing.md,
    paddingVertical: velumSpacing.xs,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
