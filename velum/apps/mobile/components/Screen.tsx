/**
 * Conteneur d'écran VELUM : SafeArea + fond « cave » (ink) + padding standard.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { velumColors, velumSpacing } from '@velum/ui';

import { isDemoMode } from '../lib/env';

export interface ScreenProps {
  children: ReactNode;
  /** true → contenu défilant (par défaut). */
  scroll?: boolean;
  /** Supprime le padding horizontal (caméra plein écran…). */
  bare?: boolean;
}

/** Bandeau discret rappelant que les données sont fictives (mode démo). */
function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <View style={styles.demo} accessibilityRole="alert">
      <Text style={styles.demoText} allowFontScaling maxFontSizeMultiplier={2}>
        Mode démo — données fictives, aucun compte requis
      </Text>
    </View>
  );
}

export function Screen({ children, scroll = true, bare = false }: ScreenProps) {
  const inner = bare ? styles.bare : styles.padded;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DemoBanner />
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
  demo: {
    backgroundColor: velumColors.bordeaux.deep,
    paddingVertical: 6,
    paddingHorizontal: velumSpacing.md,
    alignItems: 'center',
  },
  demoText: { color: velumColors.parchment.DEFAULT, fontSize: 12, fontWeight: '600' },
});
