/**
 * Carte VELUM — surface « ink raised » sertie d'un liseré chaud, détachée du
 * fond cave par une ombre douce (velumElevation.card). Pressable si `onPress`
 * est fourni (rôle bouton, cible tactile suffisante, retour tactile par
 * micro-échelle). Variante « gilded » : liseré doré pour les surfaces mises en
 * avant (bandeaux, offres).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { touchTargetSize } from '../a11y';
import { useSeniorMode } from '../senior';
import { velumColors, velumElevation, velumHairline, velumRadius, velumSpacing } from '../tokens';

export interface VCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Liseré : chaud (défaut) ou doré pour les surfaces serties. */
  tone?: 'default' | 'gilded';
  /** Libellé lu par les lecteurs d'écran quand la carte est pressable. */
  accessibilityLabel?: string;
  /** Complément lu après le libellé (conséquence de l'action). */
  accessibilityHint?: string;
}

export function VCard({ children, onPress, style, tone = 'default', accessibilityLabel, accessibilityHint }: VCardProps) {
  const { senior } = useSeniorMode();
  const toneStyle = tone === 'gilded' ? styles.gilded : null;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.card,
          toneStyle,
          { minHeight: touchTargetSize(senior) },
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: velumColors.ink.raised,
    borderColor: velumHairline.warm,
    borderWidth: 1,
    borderRadius: velumRadius.card,
    padding: velumSpacing.lg,
    ...velumElevation.card,
  },
  gilded: {
    borderColor: velumHairline.gilded,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
});
