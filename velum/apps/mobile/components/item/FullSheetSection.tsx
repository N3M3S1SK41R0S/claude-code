/**
 * Fiche complète (analyse experte) À LA DEMANDE :
 *  - absente (scan éclair) ou en échec → carte « Fiche complète non chargée »
 *    avec « Charger la fiche complète » (edge.analyze), progression explicite,
 *    erreur + Réessayer ;
 *  - périmée (identité corrigée après sa génération) → bandeau « Régénérer » ;
 *  - présente → sections du domaine, REPLIÉES par défaut (sauf incertitudes)
 *    pour limiter le défilement.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VButton, VCard, VSpinner, VText, velumSpacing } from '@velum/ui';
import type {
  ArtAnalysisPayload,
  CoinAnalysisPayload,
  StampAnalysisPayload,
  VelumItem,
  WatchAnalysisPayload,
  WineAnalysisPayload,
} from '@velum/core';

import { ArtSheet } from '../sheets/ArtSheet';
import { CoinSheet } from '../sheets/CoinSheet';
import { SheetSectionDefaults } from '../sheets/SheetSection';
import { StampSheet } from '../sheets/StampSheet';
import { WatchSheet } from '../sheets/WatchSheet';
import { WineSheet } from '../sheets/WineSheet';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/i18n';
import { analysisMeta, analysisPayloadOf, fullSheetState } from '../../lib/itemSheet';
import type { ItemSheetActions } from './useItemSheetActions';

/** Sections du domaine (payload JSONB relu défensivement par chaque sheet). */
function DomainSheet({ item, payload }: { item: VelumItem; payload: Record<string, unknown> }) {
  switch (item.domain) {
    case 'wine':
      return <WineSheet payload={payload as Partial<WineAnalysisPayload>} />;
    case 'coin':
      return <CoinSheet payload={payload as Partial<CoinAnalysisPayload>} />;
    case 'art':
      return <ArtSheet payload={payload as Partial<ArtAnalysisPayload>} />;
    case 'stamp':
      return <StampSheet payload={payload as Partial<StampAnalysisPayload>} />;
    case 'watch':
      return <WatchSheet payload={payload as Partial<WatchAnalysisPayload>} />;
    default:
      return null;
  }
}

/** Progression / erreur de la génération (partagée par « Charger » et « Régénérer »). */
function GenerationStatus({ actions }: { actions: ItemSheetActions }) {
  const { t } = useTranslation();
  const { analyze } = actions;
  if (analyze.isPending) {
    return (
      <View style={styles.progress} accessibilityLiveRegion="polite">
        <VSpinner />
        <VText variant="body" center>
          {t('item.fullSheet.loading')}
        </VText>
      </View>
    );
  }
  if (analyze.isError) {
    return (
      <VText variant="body" tone="danger" accessibilityLiveRegion="polite">
        {`${t('item.fullSheet.error')} ${errorMessage(analyze.error, t)}`}
      </VText>
    );
  }
  return null;
}

export function FullSheetSection({ item, actions }: { item: VelumItem; actions: ItemSheetActions }) {
  const { t } = useTranslation();
  const { analyze } = actions;
  const state = fullSheetState(item);
  const payload = analysisPayloadOf(item.attributes);

  if (state === 'missing' || state === 'failed' || payload === null) {
    const failed = state === 'failed' || analyze.isError;
    return (
      <View style={styles.section}>
        <VCard tone="gilded">
          <View style={styles.cardBody}>
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {state === 'failed' ? t('item.fullSheet.failedTitle') : t('item.fullSheet.missingTitle')}
            </VText>
            <VText variant="body" tone="dim">
              {state === 'failed' ? t('item.fullSheet.failedBody') : t('item.fullSheet.missingBody')}
            </VText>
            <GenerationStatus actions={actions} />
            {analyze.isPending ? null : (
              <VButton
                label={failed ? t('common.retry') : t('item.fullSheet.load')}
                onPress={() => analyze.mutate()}
                accessibilityHint={t('item.fullSheet.loadHint')}
              />
            )}
          </View>
        </VCard>
      </View>
    );
  }

  const meta = analysisMeta(item.attributes);
  const metaLabel =
    meta.analyzedAt !== null
      ? meta.engine !== null
        ? t('item.fullSheet.metaEngine', { date: formatDate(meta.analyzedAt), engine: meta.engine })
        : t('item.fullSheet.meta', { date: formatDate(meta.analyzedAt) })
      : null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <VText variant="title" tone="gold" accessibilityRole="header">
          {t('item.fullSheet.title')}
        </VText>
        {metaLabel !== null ? (
          <VText variant="caption" tone="dim">
            {metaLabel}
          </VText>
        ) : null}
        <VText variant="caption" tone="dim">
          {t('item.fullSheet.collapsedHint')}
        </VText>
      </View>

      {state === 'outdated' ? (
        <VCard tone="gilded">
          <View style={styles.cardBody} accessibilityLiveRegion="polite">
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {t('item.fullSheet.outdatedTitle')}
            </VText>
            <VText variant="body" tone="dim">
              {t('item.fullSheet.outdatedBody')}
            </VText>
            <GenerationStatus actions={actions} />
            {analyze.isPending ? null : (
              <VButton
                label={analyze.isError ? t('common.retry') : t('item.fullSheet.regenerate')}
                variant="secondary"
                onPress={() => analyze.mutate()}
              />
            )}
          </View>
        </VCard>
      ) : null}

      <SheetSectionDefaults collapsible defaultOpen={false}>
        <DomainSheet item={item} payload={payload} />
      </SheetSectionDefaults>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.lg, gap: velumSpacing.sm },
  header: { gap: velumSpacing.xs },
  cardBody: { gap: velumSpacing.sm },
  progress: { alignItems: 'center', gap: velumSpacing.xs },
});
