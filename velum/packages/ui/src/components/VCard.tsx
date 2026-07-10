/**
 * Carte VELUM — surface « ink raised » avec liseré chaud. Pressable si
 * `onPress` est fourni (avec rôle bouton et cible tactile suffisante).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { touchTargetSize } from '../a11y';
import { useSeniorMode } from '../senior';
import { velumColors, velumRadius, velumSpacing } from '../tokens';

export interface VCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function VCard({ children, onPress, style }: VCardProps) {
  const { senior } = useSeniorMode();

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          { minHeight: touchTargetSize(senior) },
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: velumColors.ink.raised,
    borderColor: velumColors.ink.border,
    borderWidth: 1,
    borderRadius: velumRadius.card,
    padding: velumSpacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
});
