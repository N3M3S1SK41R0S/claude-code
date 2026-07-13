/**
 * Badge de confiance VELUM (§3.3) — affiche « NN % » avec un code couleur :
 * ≥ 0.7 success, ≥ 0.4 warning, sinon danger. La confiance est TOUJOURS
 * montrée, jamais de fausse certitude.
 */
import { StyleSheet, Text, View } from 'react-native';

import { confidenceTone, formatConfidence } from '../confidence';
import { useSeniorMode } from '../senior';
import { BADGE_TINT_ALPHA, velumColors, velumOnInk, velumRadius, velumSpacing } from '../tokens';
import type { ConfidenceTone } from '../confidence';
import { MAX_FONT_SIZE_MULTIPLIER } from './VText';

export interface ConfidenceBadgeProps {
  /** Confiance 0..1. */
  value: number;
}

/** Couleur du texte par palier — AA sur fond ink (danger éclairci, cf. tokens). */
const TONE_TEXT: Record<ConfidenceTone, string> = {
  success: velumOnInk.success,
  warning: velumOnInk.warning,
  danger: velumOnInk.danger,
};

/** Fond teinté (≈ 15 % d'alpha) du palier. */
const TONE_TINT: Record<ConfidenceTone, string> = {
  success: `${velumColors.success}${BADGE_TINT_ALPHA}`,
  warning: `${velumColors.warning}${BADGE_TINT_ALPHA}`,
  danger: `${velumColors.danger}${BADGE_TINT_ALPHA}`,
};

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const { scale } = useSeniorMode();
  const tone = confidenceTone(value);
  const percentLabel = formatConfidence(value);

  return (
    <View
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Confiance ${percentLabel}`}
      style={[styles.badge, { backgroundColor: TONE_TINT[tone] }]}
    >
      <Text
        allowFontScaling={true}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.label, { color: TONE_TEXT[tone], fontSize: scale(13), lineHeight: scale(18) }]}
      >
        {percentLabel}
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
    fontVariant: ['tabular-nums'],
  },
});
