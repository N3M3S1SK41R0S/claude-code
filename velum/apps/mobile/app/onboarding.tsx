/**
 * Onboarding : vidéo d'intro (logo animé 8 s, muette, passable), pitch,
 * choix des modules d'intérêt (4 cartes), proposition du mode senior,
 * CTA de création de compte.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { VButton, VText, useSeniorMode, velumSpacing } from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { ModuleCard } from '../components/ModuleCard';
import { Screen } from '../components/Screen';
import { getActiveDomains } from '../lib/features';
import { useSettingsStore } from '../stores/settingsStore';

const introVideo = require('../assets/brand/velum-intro.mp4') as number;

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setSenior } = useSeniorMode();
  const setSettingsSenior = useSettingsStore((s) => s.setSenior);
  const setOnboardingDone = useSettingsStore((s) => s.setOnboardingDone);

  const [videoDone, setVideoDone] = useState(false);
  const [selected, setSelected] = useState<VelumDomain[]>([]);

  const player = useVideoPlayer(introVideo, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  const domains = getActiveDomains();

  const toggleDomain = (domain: VelumDomain) => {
    setSelected((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  };

  const finish = (senior: boolean) => {
    setSenior(senior);
    setSettingsSenior(senior);
    setOnboardingDone(true);
    router.replace('/(auth)/sign-up');
  };

  if (!videoDone) {
    return (
      <Screen scroll={false} bare>
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            accessibilityLabel={t('brand.name')}
          />
          <View style={styles.skip}>
            <VButton
              label={t('onboarding.skipVideo')}
              variant="ghost"
              onPress={() => setVideoDone(true)}
              accessibilityHint={t('onboarding.pitch')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen brand={false}>
      <VText variant="display" tone="gold" center>
        {t('brand.name')}
      </VText>
      <VText variant="heading" center style={styles.pitch}>
        {t('onboarding.pitch')}
      </VText>
      <VText variant="body" tone="dim" center>
        {t('onboarding.pitchDetail')}
      </VText>

      <VText variant="heading" style={styles.sectionTitle}>
        {t('onboarding.chooseModules')}
      </VText>
      <View style={styles.grid}>
        {domains.map((domain) => (
          <ModuleCard
            key={domain}
            domain={domain}
            title={t(`domains.${domain}.name`)}
            subtitle={t(`domains.${domain}.subtitle`)}
            selected={selected.includes(domain)}
            onPress={() => toggleDomain(domain)}
          />
        ))}
      </View>

      <VText variant="heading" style={styles.sectionTitle}>
        {t('onboarding.seniorTitle')}
      </VText>
      <VText variant="body" tone="dim">
        {t('onboarding.seniorMessage')}
      </VText>
      <View style={styles.buttons}>
        <VButton label={t('onboarding.seniorEnable')} variant="secondary" onPress={() => finish(true)} />
        <VButton label={t('onboarding.createAccount')} onPress={() => finish(false)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  videoContainer: { flex: 1 },
  video: { flex: 1, minHeight: 480 },
  skip: {
    position: 'absolute',
    bottom: velumSpacing.xxl,
    right: velumSpacing.lg,
  },
  pitch: { marginTop: velumSpacing.lg, marginBottom: velumSpacing.sm },
  sectionTitle: { marginTop: velumSpacing.xl, marginBottom: velumSpacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.md,
    justifyContent: 'space-between',
  },
  buttons: { gap: velumSpacing.md, marginTop: velumSpacing.lg },
});
