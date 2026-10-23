/**
 * Bloc VALORISATION de la fiche : valeur centrale, IC80/IC95, fiabilité,
 * explication et preuve de calibration ; dernières ventes et courbe de valeur
 * repliables ; avertissements TOUJOURS visibles.
 *
 * États distingués : chargement, panne (Réessayer — jamais présentée comme
 * « pas d'estimation »), absence d'estimation (bouton « Estimer maintenant »,
 * fourchette indicative du scan éclair signalée comme NON vérifiée), estimation
 * antérieure à une correction (proposer de la relancer).
 */
import { StyleSheet, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VButton, VSpinner, VText, velumSpacing } from '@velum/ui';
import type { ValuationRecord, VelumItem } from '@velum/core';
import { resolveReliabilityForResult } from '@velum/valuation';

import { KV, SheetSection } from '../sheets/SheetSection';
import { CalibrationEvidence } from '../CalibrationEvidence';
import { ValuationExplanation } from '../ValuationExplanation';
import { ValueChart } from '../ValueChart';
import { RecentSalesSection } from './HeritageSection';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatEUR } from '../../lib/i18n';
import { isValuationStale, itemDisclaimers, quickEstimateOf } from '../../lib/itemSheet';
import type { ItemSheetActions } from './useItemSheetActions';

/** Progression / erreur d'une estimation à la demande. */
function EstimationStatus({ actions }: { actions: ItemSheetActions }) {
  const { t } = useTranslation();
  const { valuate } = actions;
  if (valuate.isPending) {
    return (
      <VText variant="caption" tone="gold" accessibilityLiveRegion="polite">
        {t('item.valuation.estimating')}
      </VText>
    );
  }
  if (valuate.isError) {
    return (
      <View style={styles.errorBlock} accessibilityLiveRegion="polite">
        <VText variant="caption" tone="danger">
          {errorMessage(valuate.error, t)}
        </VText>
        <VButton label={t('common.retry')} variant="ghost" onPress={() => valuate.mutate()} />
      </View>
    );
  }
  return null;
}

export interface ValuationSectionProps {
  item: VelumItem;
  latestQuery: UseQueryResult<ValuationRecord | null>;
  historyQuery: UseQueryResult<ValuationRecord[]>;
  actions: ItemSheetActions;
}

export function ValuationSection({ item, latestQuery, historyQuery, actions }: ValuationSectionProps) {
  const { t } = useTranslation();
  const { valuate } = actions;
  const valuation = latestQuery.data ?? null;
  const reliability = valuation
    ? resolveReliabilityForResult({
        central: valuation.central,
        ci80: [valuation.ci80Low, valuation.ci80High],
        reliability: valuation.reliability,
        observations: valuation.sources,
      })
    : null;
  // Estimation antérieure à la dernière correction (sauf relance réussie depuis).
  const outdated = isValuationStale(item, valuation, valuate.isSuccess ? valuate.submittedAt : null);
  const quickEstimate = quickEstimateOf(item.attributes);
  const disclaimers = itemDisclaimers(item.attributes);
  const history = historyQuery.data ?? [];

  let body;
  if (latestQuery.isLoading) {
    body = <VSpinner />;
  } else if (latestQuery.isError && valuation === null) {
    body = (
      <View style={styles.errorBlock}>
        <VText variant="body" tone="danger">
          {t('item.valuation.loadError')}
        </VText>
        <VButton label={t('common.retry')} variant="secondary" onPress={() => void latestQuery.refetch()} />
      </View>
    );
  } else if (valuation && reliability) {
    body = (
      <>
        <VText variant="title" tone="gold" tabularNums accessibilityLabel={formatEUR(valuation.central)}>
          {formatEUR(valuation.central)}
        </VText>
        <VText variant="caption" tone="dim">
          {t('item.valuation.valuedOn', { date: formatDate(valuation.valuedAt) })}
        </VText>
        {outdated ? (
          <View style={styles.errorBlock} accessibilityLiveRegion="polite">
            <VText variant="body" tone="gold">
              {t('item.valuation.outdated')}
            </VText>
            {valuate.isPending ? null : (
              <VButton label={t('item.followUp.revalue')} variant="secondary" onPress={() => valuate.mutate()} />
            )}
          </View>
        ) : null}
        <KV
          label={t('item.ci80')}
          tabular
          value={`${formatEUR(valuation.ci80Low)} – ${formatEUR(valuation.ci80High)}`}
        />
        <KV
          label={t('item.ci95')}
          tabular
          value={`${formatEUR(valuation.ci95Low)} – ${formatEUR(valuation.ci95High)}`}
        />
        <KV
          label={t('item.reliability')}
          tabular
          value={`${reliability.value} / 100 · ${t('item.nSources', { count: reliability.nSources })}`}
        />
        <EstimationStatus actions={actions} />
        {valuation.sources.length > 0 ? (
          <ValuationExplanation valuation={valuation} label={t('item.whyThisRange')} />
        ) : null}
        {/* Pari #1 — preuve de calibration du domaine (jamais trompeuse). */}
        <CalibrationEvidence domain={item.domain} />
      </>
    );
  } else {
    body = (
      <>
        {quickEstimate ? (
          <View style={styles.quick}>
            <VText variant="body" tabularNums>
              {t('item.valuation.quickEstimateLabel', {
                range: `${formatEUR(quickEstimate.low)} – ${formatEUR(quickEstimate.high)}`,
              })}
            </VText>
            <VText variant="caption" tone="gold">
              {t('item.valuation.quickEstimateHint')}
            </VText>
          </View>
        ) : null}
        <VText variant="body" tone="dim">
          {t('item.noValuation')}
        </VText>
        <EstimationStatus actions={actions} />
        {valuate.isError ? null : (
          <VButton
            label={t('item.revalue')}
            onPress={() => valuate.mutate()}
            loading={valuate.isPending}
            accessibilityHint={t('item.quick.estimateHint')}
          />
        )}
      </>
    );
  }

  return (
    <>
      <SheetSection title={t('item.valuationTitle')}>{body}</SheetSection>

      {/* Dernières ventes comparables — observations réelles retenues (§7). */}
      {valuation ? <RecentSalesSection observations={valuation.sources} /> : null}

      {/* Avertissements TOUJOURS visibles (jamais repliés). */}
      <SheetSection title={t('item.disclaimersTitle')}>
        {(disclaimers.length > 0 ? disclaimers : [t('item.defaultDisclaimer')]).map((d, i) => (
          <VText key={`${i}-${d}`} variant="caption" tone="gold">
            {d}
          </VText>
        ))}
      </SheetSection>

      {/* Courbe de valeur (repliée : utile surtout après plusieurs estimations). */}
      <SheetSection title={t('item.chartTitle')} collapsible defaultOpen={false}>
        {historyQuery.isLoading ? (
          <VSpinner />
        ) : historyQuery.isError ? (
          <View style={styles.errorBlock}>
            <VText variant="body" tone="danger">
              {t('item.valuation.historyError')}
            </VText>
            <VButton label={t('common.retry')} variant="secondary" onPress={() => void historyQuery.refetch()} />
          </View>
        ) : (
          <ValueChart records={history} emptyLabel={t('item.chartNeedsMore')} />
        )}
      </SheetSection>
    </>
  );
}

const styles = StyleSheet.create({
  errorBlock: { gap: velumSpacing.xs },
  quick: { gap: 2 },
});
