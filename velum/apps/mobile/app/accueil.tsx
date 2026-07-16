/**
 * Accueil VELUM : la page « maison » vers laquelle ramène le sceau présent sur
 * tous les écrans. Porte le sceau (serti dans son écrin), la vidéo de
 * lancement (cadre galerie, en boucle, muette, son réactivable) et les accès
 * rapides aux grandes sections, présentés en tuiles de catalogue.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import {
  VCard,
  VOrnament,
  VText,
  velumColors,
  velumElevation,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import { Screen } from '../components/Screen';
import { usePlan } from '../lib/plan';

const introVideo = require('../assets/brand/velum-intro.mp4') as number;
const seal = require('../assets/brand/velum-seal.png');

/** Tuile d'accès rapide — VCard pressable, typographie de catalogue. */
function QuickTile({
  label,
  hint,
  gilded,
  onPress,
}: {
  label: string;
  hint: string;
  gilded?: boolean;
  onPress: () => void;
}) {
  return (
    <VCard
      onPress={onPress}
      tone={gilded ? 'gilded' : 'default'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.tile}
    >
      <VText variant="heading" tone={gilded ? 'gold' : 'default'}>
        {label}
      </VText>
      <VText variant="caption" tone="dim">
        {hint}
      </VText>
    </VCard>
  );
}

export default function Accueil() {
  const { t } = useTranslation();
  const router = useRouter();
  const { plan } = usePlan();

  const player = useVideoPlayer(introVideo, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });

  return (
    // brand={false} : le sceau est déjà le héros de l'accueil.
    <Screen brand={false}>
      <View style={styles.header}>
        {/* Écrin du sceau : double anneau doré sur fond de cire. */}
        <View style={styles.sealMount}>
          <View style={styles.sealWax}>
            <Image source={seal} style={styles.seal} contentFit="contain" accessibilityLabel={t('brand.name')} />
          </View>
        </View>
        <VText variant="display" tone="gold" center>
          {t('brand.name')}
        </VText>
        <VText variant="body" tone="dim" center>
          {t('brand.tagline')}
        </VText>
      </View>

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

      <VText variant="heading" tone="gold" style={styles.sectionTitle}>
        {t('accueil.quickAccess')}
      </VText>
      <View style={styles.tiles}>
        <QuickTile
          label={t('accueil.collection')}
          hint={t('accueil.collectionHint')}
          onPress={() => router.push('/(tabs)/collection')}
        />
        <QuickTile
          label={t('accueil.capture')}
          hint={t('accueil.captureHint')}
          onPress={() => router.push('/(tabs)/capture')}
        />
        <QuickTile
          label={t('accueil.market')}
          hint={t('accueil.marketHint')}
          onPress={() => router.push('/(tabs)/market')}
        />
        <QuickTile
          label={t('accueil.community')}
          hint={plan === 'platine' ? t('accueil.communityHint') : t('market.communityCta')}
          gilded={plan === 'platine'}
          onPress={() => router.push(plan === 'platine' ? '/community' : '/paywall')}
        />
      </View>
    </Screen>
  );
}

const SEAL_SIZE = 96;

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: velumSpacing.sm, marginTop: velumSpacing.md },
  sealMount: {
    width: SEAL_SIZE + 36,
    height: SEAL_SIZE + 36,
    borderRadius: (SEAL_SIZE + 36) / 2,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: velumSpacing.xs,
  },
  sealWax: {
    width: SEAL_SIZE + 18,
    height: SEAL_SIZE + 18,
    borderRadius: (SEAL_SIZE + 18) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: velumHairline.gildedFaint,
    // Cire du sceau : bordeaux translucide (moment de marque, propre à l'accueil).
    backgroundColor: 'rgba(122, 34, 48, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: { width: SEAL_SIZE, height: SEAL_SIZE },
  ornament: { marginTop: velumSpacing.lg },
  videoFrame: {
    marginTop: velumSpacing.sm,
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
  sectionTitle: { marginTop: velumSpacing.xl, marginBottom: velumSpacing.sm },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.md,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: velumSpacing.xs,
    minHeight: 96,
  },
});
