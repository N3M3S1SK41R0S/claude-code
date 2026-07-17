/**
 * Ornement typographique VELUM — filet doré à losange central, façon
 * catalogue de vente : sépare les moments d'un écran (héros → contenu)
 * sans le poids d'un titre. Purement décoratif : ignoré des lecteurs
 * d'écran, jamais porteur d'information.
 */
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { velumColors, velumHairline, velumSpacing } from '../tokens';

export interface VOrnamentProps {
  style?: StyleProp<ViewStyle>;
}

export function VOrnament({ style }: VOrnamentProps) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <View style={styles.rule} />
      <View style={styles.diamond} />
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.sm,
    marginVertical: velumSpacing.md,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: velumHairline.gilded,
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: velumColors.gold.faint,
    transform: [{ rotate: '45deg' }],
  },
});
