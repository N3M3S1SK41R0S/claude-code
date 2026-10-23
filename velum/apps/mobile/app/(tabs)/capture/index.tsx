/**
 * Onglet Capturer : une tuile par module avec ses trois façons d'enregistrer —
 * Scan éclair (une photo, identification immédiate), Mode classeur (série ou
 * page de classeur entière, mis en avant pour timbres et pièces) et Saisie
 * complète (tous les clichés, fiche détaillée avant l'enregistrement).
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VText, velumSpacing } from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { CaptureDomainCard } from '../../../components/capture/CaptureDomainCard';
import { Screen } from '../../../components/Screen';
import { isBinderFirst } from '../../../lib/batchQueue';
import { getActiveDomains } from '../../../lib/features';
import { routes } from '../../../lib/routes';
import { captureUploads } from '../../../lib/uploadMedia';
import { useCaptureStore, type CaptureMode } from '../../../stores/captureStore';

export default function CaptureHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const setDomain = useCaptureStore((s) => s.setDomain);
  const setMode = useCaptureStore((s) => s.setMode);
  const domains = getActiveDomains();

  /** Nouveau brouillon : on oublie les photos de la capture précédente. */
  const startCapture = (domain: VelumDomain, mode: CaptureMode) => {
    captureUploads.clear();
    setMode(mode);
    setDomain(domain);
    router.push(routes.capture(domain, mode));
  };

  return (
    <Screen back={false}>
      <VText variant="title">{t('capture.title')}</VText>
      <VText variant="caption" tone="dim" style={styles.subtitle}>
        {t('capture.chooseHint')}
      </VText>
      <View style={styles.list}>
        {domains.map((domain) => (
          <CaptureDomainCard
            key={domain}
            domain={domain}
            title={t(`domains.${domain}.name`)}
            subtitle={t(`domains.${domain}.subtitle`)}
            binderFirst={isBinderFirst(domain)}
            onQuick={() => startCapture(domain, 'quick')}
            onFull={() => startCapture(domain, 'full')}
            onBatch={() => router.push(routes.captureBatch(domain))}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: velumSpacing.xs, marginBottom: velumSpacing.lg },
  list: { gap: velumSpacing.md },
});
