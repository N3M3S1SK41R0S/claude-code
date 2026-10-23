/**
 * Conteneur d'écran VELUM : SafeArea + fond « cave » (ink) + padding standard.
 * En-tête unifié sur TOUS les écrans : bouton « ‹ Retour » à gauche (retour à
 * la page précédente, avec repli sûr si l'historique est vide), titre
 * optionnel, et sceau VELUM à droite (retour accueil).
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MAX_FONT_SIZE_MULTIPLIER, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import { isDemoMode } from '../lib/env';
import { DEFAULT_BACK_FALLBACK, useGoBack } from '../lib/navigation';

const SEAL = require('../assets/brand/velum-seal.png');

export interface ScreenProps {
  children: ReactNode;
  /** true → contenu défilant (par défaut). */
  scroll?: boolean;
  /** Supprime le padding horizontal (caméra plein écran…). */
  bare?: boolean;
  /** Affiche le sceau « retour accueil » en tête (défaut : true). */
  brand?: boolean;
  /**
   * Bouton « ‹ Retour » en tête (défaut : true). À désactiver sur les racines
   * d'onglets et les écrans d'entrée (accueil, connexion).
   */
  back?: boolean;
  /** Destination si l'historique est vide (lien direct, notification). */
  backFallback?: string;
  /** Action de retour personnalisée (ex. confirmer l'abandon d'un brouillon). */
  onBack?: () => void;
  /** Titre court affiché dans l'en-tête, à côté du bouton retour. */
  title?: string;
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

/** Bouton « ‹ Retour » : cible ≥ 44 pt (56 en mode senior), libellé visible. */
function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      accessibilityHint={t('nav.backHint')}
      hitSlop={10}
      style={({ pressed }) => [
        styles.back,
        { minHeight: senior ? 56 : 44, minWidth: senior ? 56 : 44 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="chevron-back" size={scale(22)} color={velumColors.gold.soft} />
      <Text
        style={[styles.backLabel, { fontSize: scale(15) }]}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      >
        {t('common.back')}
      </Text>
    </Pressable>
  );
}

/**
 * En-tête d'écran : retour (gauche), titre optionnel, sceau VELUM (droite) qui
 * ramène à l'accueil (la page qui porte la vidéo de lancement).
 */
function ScreenHeader({
  brand,
  back,
  onBack,
  title,
}: {
  brand: boolean;
  back: boolean;
  onBack: () => void;
  title?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { scale } = useSeniorMode();
  if (!brand && !back && !title) return null;
  return (
    <View style={styles.brandBar}>
      {back ? <BackButton onPress={onBack} /> : null}
      <View style={styles.headerTitle}>
        {title ? (
          <Text
            style={[styles.headerTitleText, { fontSize: scale(17) }]}
            numberOfLines={1}
            accessibilityRole="header"
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {brand ? (
        <Pressable
          onPress={() => router.navigate('/accueil')}
          accessibilityRole="button"
          accessibilityLabel={t('brand.home')}
          hitSlop={10}
        >
          <Image source={SEAL} style={styles.seal} contentFit="contain" accessibilityLabel={t('brand.name')} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  bare = false,
  brand = true,
  back = true,
  backFallback = DEFAULT_BACK_FALLBACK,
  onBack,
  title,
}: ScreenProps) {
  const inner = bare ? styles.bare : styles.padded;
  const goBack = useGoBack(backFallback);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {bare ? null : <CaveAura />}
      <DemoBanner />
      {!bare ? (
        <ScreenHeader brand={brand} back={back} onBack={onBack ?? goBack} title={title} />
      ) : null}
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
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.sm,
    paddingHorizontal: velumSpacing.lg,
    paddingTop: velumSpacing.sm,
    paddingBottom: velumSpacing.xs,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: velumSpacing.sm,
    borderRadius: 10,
  },
  backLabel: { color: velumColors.gold.soft, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  headerTitle: { flex: 1 },
  headerTitleText: { color: velumColors.parchment.DEFAULT, fontWeight: '700' },
  seal: { width: 40, height: 40 },
  demo: {
    backgroundColor: velumColors.bordeaux.deep,
    paddingVertical: 6,
    paddingHorizontal: velumSpacing.md,
    alignItems: 'center',
  },
  demoText: { color: velumColors.parchment.DEFAULT, fontSize: 12, fontWeight: '600' },
});
