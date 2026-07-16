/**
 * Preuve de calibration (pari #1) — bloc de la section Valorisation.
 *
 * Affiche à quelle fréquence les intervalles annoncés ont réellement contenu
 * le prix de vente (couvertures IC80/IC95), UNIQUEMENT quand l'échantillon le
 * permet ; sinon « Calibration en cours » — jamais de métrique trompeuse
 * (la règle vit dans lib/calibrationEvidence, testée).
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { VBadge, VText, velumSpacing } from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { getVelumClient } from '../lib/client';
import { calibrationView } from '../lib/calibrationEvidence';
import { formatDate } from '../lib/i18n';

export function CalibrationEvidence({ domain }: { domain: VelumDomain }) {
  const { t } = useTranslation();
  const client = getVelumClient();

  const query = useQuery({
    queryKey: ['calibration', domain],
    // Dépôt absent (client démo / injecté) → null : même état que « rien publié ».
    queryFn: () => client.calibration?.latest(domain) ?? null,
    staleTime: 10 * 60 * 1000,
  });

  // Panne de lecture : bloc supplémentaire → on s'efface, on n'invente rien.
  if (query.isError) return null;

  const view = calibrationView(query.data ?? null);

  if (view.state === 'in_progress') {
    return (
      <View style={styles.container}>
        <VBadge label={t('calibration.inProgress')} tone="neutral" />
        <VText variant="caption" tone="dim">
          {t('calibration.inProgressHint', { count: view.n })}
        </VText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <VBadge label={t(view.statusKey)} tone={view.badgeTone} />
        <VText variant="caption" tone="dim" tabularNums>
          {t('calibration.sample', { count: view.n })}
        </VText>
      </View>
      <VText variant="caption" tone="dim" tabularNums>
        {t('calibration.coverage', { p80: view.coverage80Pct, p95: view.coverage95Pct })}
      </VText>
      <VText variant="caption" tone="dim">
        {t('calibration.computedAt', { date: formatDate(view.computedAt) })}
      </VText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.xs, marginTop: velumSpacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
});
