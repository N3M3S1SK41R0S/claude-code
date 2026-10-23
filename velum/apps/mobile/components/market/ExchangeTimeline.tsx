/**
 * Frise d'un échange (lib/marketState.exchangeTimeline) : étapes faites,
 * en cours, à venir ou sautées, puis l'issue hors chemin (refus, retrait,
 * annulation, litige…). Chaque étape est lue avec son statut.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ExchangeProposal } from '@velum/core';
import { VBadge, VText, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import {
  EXCHANGE_TONE,
  exchangeTimeline,
  marketLabelKeys,
  type TimelineStepStatus,
} from '../../lib/marketState';

const ICON: Record<TimelineStepStatus, keyof typeof Ionicons.glyphMap> = {
  done: 'checkmark-circle',
  current: 'ellipse',
  upcoming: 'ellipse-outline',
  skipped: 'remove-circle-outline',
};

const COLOR: Record<TimelineStepStatus, string> = {
  done: velumColors.success,
  current: velumColors.gold.DEFAULT,
  upcoming: velumColors.parchment.faint,
  skipped: velumColors.parchment.faint,
};

export function ExchangeTimeline({ exchange }: { exchange: ExchangeProposal }) {
  const { t } = useTranslation();
  const { scale } = useSeniorMode();
  const { steps, outcome } = exchangeTimeline(exchange);
  return (
    <View style={styles.container} accessibilityLabel={t('community.exchange.timeline')}>
      {steps.map((step, index) => (
        <View
          key={step.state}
          style={styles.step}
          accessible
          accessibilityLabel={`${index + 1}. ${t(`community.timeline.${step.state}`)} — ${t(
            `community.timeline.status.${step.status}`,
          )}`}
        >
          <Ionicons name={ICON[step.status]} size={scale(20)} color={COLOR[step.status]} />
          <VText
            variant="body"
            tone={step.status === 'current' ? 'gold' : step.status === 'done' ? 'default' : 'dim'}
            style={step.status === 'skipped' ? styles.skipped : undefined}
          >
            {t(`community.timeline.${step.state}`)}
          </VText>
        </View>
      ))}
      {outcome !== null ? (
        <View style={styles.outcome}>
          <VBadge tone={EXCHANGE_TONE[outcome]} label={t(marketLabelKeys.exchange(outcome))} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm, minHeight: 32 },
  skipped: { textDecorationLine: 'line-through' },
  outcome: { flexDirection: 'row', marginTop: velumSpacing.xs },
});
