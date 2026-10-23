/**
 * Accueil VELUM : la page « maison » vers laquelle ramène le sceau présent sur
 * tous les écrans. Les actions principales sont EN HAUT, sans défilement :
 * « Rechercher partout », puis les accès rapides organisés autour des espaces
 * (capturer — scan éclair / mode classeur, ma collection, mes envies,
 * échanges & ventes, vins à l'apogée, marché & alertes). Le sceau (serti dans
 * son écrin) et la vidéo de lancement (cadre galerie, en boucle, muette, son
 * réactivable) gardent leur place de marque, plus bas.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import {
  VOrnament,
  VText,
  velumColors,
  velumElevation,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import { Screen } from '../components/Screen';
import { QuickAccessGrid, type QuickAccessTile } from '../components/home/QuickAccessGrid';
import { SearchLauncher } from '../components/home/SearchLauncher';
import { homeQuickAccess, type HomeQuickAccessId } from '../lib/collectionViewQuickAccess';
import { getActiveDomains, marketplaceEnabled } from '../lib/features';
import { globalSearchHref } from '../lib/globalSearch';
import { usePlan } from '../lib/plan';

const introVideo = require('../assets/brand/velum-intro.mp4') as number;
const seal = require('../assets/brand/velum-seal.png');

/** Clés i18n des tuiles : libellé + légende visible (servant aussi d'aide). */
const TILE_KEYS: Record<HomeQuickAccessId, { label: string; caption: string }> = {
  capture: { label: 'accueil.quick.capture', caption: 'accueil.quick.captureHint' },
  batch: { label: 'accueil.quick.batch', caption: 'accueil.quick.batchHint' },
  collection: { label: 'accueil.collection', caption: 'accueil.collectionHint' },
  wishlist: { label: 'accueil.quick.wishlist', caption: 'accueil.quick.wishlistHint' },
  community: { label: 'accueil.quick.community', caption: 'accueil.quick.communityHint' },
  cellarPeak: { label: 'accueil.quick.cellarPeak', caption: 'accueil.quick.cellarPeakHint' },
  market: { label: 'accueil.market', caption: 'accueil.marketHint' },
};

export default function Accueil() {
  const { t } = useTranslation();
  const router = useRouter();
  const planState = usePlan();
  const domains = useMemo(() => getActiveDomains(), []);

  const player = useVideoPlayer(introVideo, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });

  // Échanges & ventes (Platine) : la légende reflète l'accès sans jamais
  // présenter une panne du profil comme un paywall ; l'écran communauté gère
  // lui-même l'accès (chargement / panne + Réessayer / offre).
  const communityCaption =
    planState.status === 'loading'
      ? t('common.loading')
      : planState.status === 'error'
        ? t('accueil.quick.communityUnknown')
        : planState.entitlements.community
          ? t('accueil.quick.communityHint')
          : t('accueil.quick.communityLocked');

  const tiles: QuickAccessTile[] = homeQuickAccess(domains, { marketplace: marketplaceEnabled() }).map((entry) => {
    const keys = TILE_KEYS[entry.id];
    const caption = entry.id === 'community' ? communityCaption : t(keys.caption);
    return {
      key: entry.id,
      label: t(keys.label),
      caption,
      icon: entry.icon,
      gilded: entry.gilded,
      onPress: () => router.push(entry.href),
    };
  });

  return (
    // brand={false} : le sceau est déjà le héros de l'accueil.
    <Screen brand={false} back={false}>
      <View style={styles.header}>
        {/* Écrin du sceau : double anneau doré sur fond de cire. */}
        <View style={styles.sealMount}>
          <View style={styles.sealWax}>
            <Image source={seal} style={styles.seal} contentFit="contain" accessibilityLabel={t('brand.name')} />
          </View>
        </View>
        <View style={styles.brandText}>
          <VText variant="display" tone="gold" accessibilityRole="header">
            {t('brand.name')}
          </VText>
          <VText variant="caption" tone="dim">
            {t('brand.tagline')}
          </VText>
        </View>
      </View>

      <SearchLauncher
        hint={t('accueil.searchHint')}
        placeholder={t('accueil.searchPlaceholder')}
        onPress={() => router.push(globalSearchHref())}
      />

      <VText variant="heading" tone="gold" accessibilityRole="header" style={styles.sectionTitle}>
        {t('accueil.quickAccess')}
      </VText>
      <QuickAccessGrid tiles={tiles} />

      <VOrnament style={styles.ornament} />

      {/* Cadre galerie : passe-partout sombre serti d'un filet doré. */}
      <View style={styles.videoFrame}>
        <View style={styles.videoCard}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls
            accessibilityLabel={t('accueil.videoLabel')}
          />
        </View>
      </View>
    </Screen>
  );
}

const SEAL_SIZE = 64;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.md,
    marginTop: velumSpacing.sm,
    marginBottom: velumSpacing.lg,
  },
  brandText: { flex: 1, gap: 2 },
  sealMount: {
    width: SEAL_SIZE + 24,
    height: SEAL_SIZE + 24,
    borderRadius: (SEAL_SIZE + 24) / 2,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealWax: {
    width: SEAL_SIZE + 12,
    height: SEAL_SIZE + 12,
    borderRadius: (SEAL_SIZE + 12) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: velumHairline.gildedFaint,
    // Cire du sceau : bordeaux translucide (moment de marque, propre à l'accueil).
    backgroundColor: 'rgba(122, 34, 48, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: { width: SEAL_SIZE, height: SEAL_SIZE },
  sectionTitle: { marginTop: velumSpacing.lg, marginBottom: velumSpacing.sm },
  ornament: { marginTop: velumSpacing.xl },
  videoFrame: {
    marginTop: velumSpacing.md,
    borderRadius: velumRadius.frame,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    backgroundColor: velumColors.ink.soft,
    padding: velumSpacing.sm,
    ...velumElevation.raised,
  },
  videoCard: {
    borderRadius: velumRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: velumHairline.warm,
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
  },
  video: { flex: 1 },
});
