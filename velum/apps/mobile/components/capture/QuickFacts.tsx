/**
 * Résultat du scan éclair sous un candidat : classement (fil d'Ariane) et
 * fourchette INDICATIVE — toujours présentée comme telle, jamais comme une
 * cote : la valorisation de marché se calcule après l'enregistrement.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VText, velumSpacing } from '@velum/ui';
import type { QuickEstimate } from '@velum/core';

import { classificationText, formatEstimateRange } from '../../lib/batchCapture';

export interface QuickFactsProps {
  classification?: readonly string[];
  quickEstimate?: QuickEstimate;
  /** Affiche la mise en garde sous la fourchette (écran Candidats). */
  withHint?: boolean;
}

export function QuickFacts({ classification, quickEstimate, withHint = false }: QuickFactsProps) {
  const { t, i18n } = useTranslation();
  const path = classificationText(classification);
  if (path === '' && quickEstimate === undefined) return null;
  return (
    <View style={styles.block}>
      {path !== '' ? (
        <VText variant="caption" tone="dim">
          {t('candidates.classificationLabel', { path })}
        </VText>
      ) : null}
      {quickEstimate !== undefined ? (
        <VText variant="body" tone="gold" tabularNums>
          {t('candidates.estimateLabel', { range: formatEstimateRange(quickEstimate, i18n.language) })}
        </VText>
      ) : null}
      {quickEstimate !== undefined && withHint ? (
        <VText variant="caption" tone="dim">
          {t('candidates.estimateHint')}
        </VText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2, marginTop: velumSpacing.xs },
});
