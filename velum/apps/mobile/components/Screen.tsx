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

/**
 * Halo d'ambiance « cave à la bougie » : deux lueurs douces (bordeaux + or)
 * derrière le contenu, qui donnent de la profondeur au velours sombre.
 * Purement décoratif (pointerEvents none), jamais sur les écrans plein cadre.
 */
function CaveAura() {
  return (
    <View pointerEvents="none" style={styles.aura}>
      <View style={styles.auraBordeaux} />
      <View style={styles.auraGold} />
    </View>
  );
}

export function Screen({ children, scroll = true, bare = false }: ScreenProps) {
  const inner = bare ? styles.bare : styles.padded;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {bare ? null : <CaveAura />}
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
  safe: { flex: 1, backgroundColor: velumColors.ink.DEFAULT, overflow: 'hidden' },
  aura: { ...StyleSheet.absoluteFillObject },
  auraBordeaux: {
    position: 'absolute',
    top: -240,
    alignSelf: 'center',
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: velumColors.bordeaux.bright,
    opacity: 0.1,
  },
  auraGold: {
    position: 'absolute',
    top: -140,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: velumColors.gold.DEFAULT,
    opacity: 0.05,
  },
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
