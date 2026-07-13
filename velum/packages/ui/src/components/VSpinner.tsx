/**
 * Indicateur de chargement VELUM — or sur fond sombre, annoncé aux lecteurs
 * d'écran comme un chargement en cours.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { velumColors, velumSpacing } from '../tokens';

export function VSpinner() {
  return (
    <View
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement en cours"
      style={styles.container}
    >
      <ActivityIndicator size="large" color={velumColors.gold.DEFAULT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: velumSpacing.lg,
  },
});
