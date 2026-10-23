/**
 * Barre d'actions rapides en tête de fiche : les actions principales visibles
 * sans défiler (Corriger, Estimer, Alerte, PDF, Arbitre). Pastilles compactes
 * avec icône + libellé visible, cibles ≥ 44 pt (56 en mode senior), rôle
 * button, état occupé / désactivé / déplié annoncé aux lecteurs d'écran.
 */
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface QuickActionProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityHint?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Action qui déplie un panneau (alerte…) : état annoncé `expanded`. */
  expanded?: boolean;
  /** Mise en avant (action recommandée dans l'état courant). */
  highlighted?: boolean;
}

export function QuickAction({
  label,
  icon,
  onPress,
  accessibilityHint,
  loading = false,
  disabled = false,
  expanded,
  highlighted = false,
}: QuickActionProps) {
  const { senior, scale } = useSeniorMode();
  const inactive = disabled || loading;
  const color = highlighted ? velumColors.ink.DEFAULT : velumColors.gold.soft;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading, ...(expanded !== undefined ? { expanded } : null) }}
      // react-native-web ne lit que les attributs aria-* (accessibilityState : natif).
      aria-busy={loading}
      aria-disabled={inactive}
      aria-expanded={expanded}
      hitSlop={velumSpacing.xs / 2}
      style={({ pressed }) => [
        styles.action,
        { minHeight: touchTargetSize(senior), paddingHorizontal: scale(velumSpacing.md) },
        highlighted ? styles.highlighted : null,
        expanded ? styles.expanded : null,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={scale(18)} color={color} />
      )}
      <Text
        style={[styles.label, { color, fontSize: scale(14) }]}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Conteneur des actions rapides (retour à la ligne automatique). */
export function QuickActionsBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.bar} accessibilityLabel={label} accessibilityRole="toolbar">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.sm,
    marginTop: velumSpacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.xs,
    borderRadius: velumRadius.field,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    backgroundColor: velumColors.ink.raised,
  },
  highlighted: {
    backgroundColor: velumColors.gold.DEFAULT,
    borderColor: velumColors.gold.DEFAULT,
  },
  expanded: {
    borderColor: velumColors.gold.DEFAULT,
  },
  label: { fontWeight: '600', letterSpacing: 0.2 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
