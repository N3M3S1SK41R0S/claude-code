/**
 * Onglet Capturer : grille des 4 modules avec leurs sous-titres de cadrage.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VText, velumSpacing } from '@velum/ui';

import { ModuleCard } from '../../../components/ModuleCard';
import { Screen } from '../../../components/Screen';
import { getActiveDomains } from '../../../lib/features';
import { useCaptureStore } from '../../../stores/captureStore';

export default function CaptureHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const setDomain = useCaptureStore((s) => s.setDomain);
  const domains = getActiveDomains();

  return (
    <Screen>
      <VText variant="title" style={styles.title}>
        {t('capture.title')}
      </VText>
      <View style={styles.grid}>
        {domains.map((domain) => (
          <ModuleCard
            key={domain}
            domain={domain}
            title={t(`domains.${domain}.name`)}
            subtitle={t(`domains.${domain}.subtitle`)}
            onPress={() => {
              setDomain(domain);
              router.push(`/capture/${domain}`);
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: velumSpacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.md,
    justifyContent: 'space-between',
  },
});
