/**
 * Bouton VELUM — cible tactile ≥ 44 pt (56 pt en mode senior), rôles et états
 * d'accessibilité systématiques, contrastes AA vérifiés par les tests.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { touchTargetSize } from '../a11y';
import { useSeniorMode } from '../senior';
import { velumButtonPalette, velumElevation, velumRadius, velumSpacing } from '../tokens';
import type { VelumButtonVariant } from '../tokens';
import { MAX_FONT_SIZE_MULTIPLIER } from './VText';

export interface VButtonProps {
  label: string;
  onPress: () => void;
  variant?: VelumButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}

export function VButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
}: VButtonProps) {
  const { senior, scale } = useSeniorMode();
  const palette = velumButtonPalette[variant];
  const inactive = disabled || loading;
  // Relief : halo doré pour l'action primaire, ombre douce pour les surfaces
  // pleines ; le fantôme reste plat. Jamais de relief sur un bouton inactif.
  const elevation =
    inactive || variant === 'ghost'
      ? null
      : variant === 'primary'
        ? velumElevation.gold
        : velumElevation.card;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={velumSpacing.xs}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: touchTargetSize(senior),
          minWidth: touchTargetSize(senior),
          paddingHorizontal: scale(velumSpacing.xl),
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        variant === 'ghost' && styles.ghostBorder,
        elevation,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} accessibilityLabel="Chargement en cours" />
      ) : (
        <Text
          allowFontScaling={true}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[styles.label, { color: palette.text, fontSize: scale(16), lineHeight: scale(22) }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: velumRadius.field,
    borderWidth: 0,
    paddingVertical: velumSpacing.md,
  },
  ghostBorder: {
    borderWidth: 1,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
