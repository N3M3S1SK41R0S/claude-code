/**
 * Conteneur d'écran VELUM : SafeArea + fond « cave » (ink) + padding standard.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { velumColors, velumSpacing } from '@velum/ui';

export interface ScreenProps {
  children: ReactNode;
  /** true → contenu défilant (par défaut). */
  scroll?: boolean;
  /** Supprime le padding horizontal (caméra plein écran…). */
  bare?: boolean;
}

export function Screen({ children, scroll = true, bare = false }: ScreenProps) {
  const inner = bare ? styles.bare : styles.padded;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[inner, styles.grow]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: velumColors.ink.DEFAULT },
  flex: { flex: 1 },
  grow: { flexGrow: 1, paddingBottom: velumSpacing.xxl },
  padded: { paddingHorizontal: velumSpacing.lg, paddingTop: velumSpacing.md },
  bare: { padding: 0 },
});
