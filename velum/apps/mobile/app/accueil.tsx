/**
 * Accueil VELUM : la page « maison » vers laquelle ramène le sceau présent sur
 * tous les écrans. Porte le sceau, la vidéo de lancement (en boucle, muette,
 * son réactivable) et les accès rapides aux grandes sections.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { VButton, VText, velumHairline, velumSpacing } from '@velum/ui';

import { Screen } from '../components/Screen';
import { usePlan } from '../lib/plan';

const introVideo = require('../assets/brand/velum-intro.mp4') as number;
const seal = require('../assets/brand/velum-seal.png');

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
        <Image source={seal} style={styles.seal} contentFit="contain" accessibilityLabel={t('brand.name')} />
        <VText variant="display" tone="gold" center>
          {t('brand.name')}
        </VText>
        <VText variant="body" tone="dim" center>
          {t('brand.tagline')}
        </VText>
      </View>

      <View style={styles.videoCard}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls
          accessibilityLabel={t('accueil.videoLabel')}
        />
      </View>

      <VText variant="heading" tone="gold" style={styles.sectionTitle}>
        {t('accueil.quickAccess')}
      </VText>
      <View style={styles.actions}>
        <VButton label={t('accueil.collection')} onPress={() => router.push('/(tabs)/collection')} />
        <VButton
          label={t('accueil.capture')}
          variant="secondary"
          onPress={() => router.push('/(tabs)/capture')}
        />
        <VButton
          label={t('accueil.market')}
          variant="secondary"
          onPress={() => router.push('/(tabs)/market')}
        />
        <VButton
          label={t('accueil.community')}
          variant={plan === 'platine' ? 'secondary' : 'ghost'}
          onPress={() => router.push(plan === 'platine' ? '/community' : '/paywall')}
          accessibilityHint={plan === 'platine' ? t('community.intro') : t('market.communityCta')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: velumSpacing.sm, marginTop: velumSpacing.md },
  seal: { width: 96, height: 96, marginBottom: velumSpacing.xs },
  videoCard: {
    marginTop: velumSpacing.xl,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
  },
  video: { flex: 1 },
  sectionTitle: { marginTop: velumSpacing.xl, marginBottom: velumSpacing.sm },
  actions: { gap: velumSpacing.md },
});
