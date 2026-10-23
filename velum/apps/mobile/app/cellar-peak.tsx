/**
 * « Mes vins à leur apogée » — à la demande, à tout moment : TOUS les vins de
 * la cave à boire, triés par urgence (fenêtre dépassée, dernière année, à
 * l'apogée, l'an prochain) puis par fin de fenêtre, avec leur POSITION dans la
 * cave, 2–3 plats suggérés et deux actions directes (accord pour ce soir,
 * fiche). Calcul local (aucun appel IA) ; rappel ponctuel programmable ici.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PeakStatus, VelumItem } from '@velum/core';
import {
  VBadge,
  VButton,
  VCard,
  VEmptyState,
  VListRow,
  VSpinner,
  VText,
  velumColors,
  velumSpacing,
} from '@velum/ui';

import { ChoiceChips } from '../components/cellar/ChoiceChips';
import { DrinkReminderSettings } from '../components/cellar/DrinkReminderSettings';
import { PeakWineCard } from '../components/cellar/PeakWineCard';
import { PositionEditor, type PositionEditorTarget } from '../components/cellar/PositionEditor';
import { Screen } from '../components/Screen';
import { SearchField } from '../components/search/SearchField';
import {
  availableColorGroups,
  displayWineLabel,
  effectiveColorFilter,
  filterPeakEntries,
  peakStatusTone,
  peakSummary,
  type ColorGroup,
} from '../lib/cellarPeak';
import { getVelumClient } from '../lib/client';
import { isOfflineWithoutData } from '../lib/collectionView';
import { cellarPeakForItems } from '../lib/drinkNow';
import { errorMessage } from '../lib/errors';
import { routes } from '../lib/routes';

type ColorChoice = ColorGroup | 'all';

const PEAK_STATUSES: readonly PeakStatus[] = ['past', 'closing', 'peak', 'soon'];

/** Nombre de vins sans fiche listés nommément (les autres sont comptés). */
const UNKNOWN_PREVIEW = 3;

export default function CellarPeak() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const [query, setQuery] = useState('');
  const [color, setColor] = useState<ColorChoice>('all');
  const [includeSoon, setIncludeSoon] = useState(true);
  const [showReminder, setShowReminder] = useState(false);
  const [editing, setEditing] = useState<PositionEditorTarget | null>(null);

  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    staleTime: 60 * 1000,
  });

  const wines: VelumItem[] = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const year = new Date().getFullYear();
  // `dataUpdatedAt` : recalcul après chaque lecture réussie, même si le partage
  // structurel de React Query conserve la référence (objet modifié en place).
  const updatedAt = itemsQuery.dataUpdatedAt;
  const report = useMemo(() => cellarPeakForItems(wines, year), [wines, year, updatedAt]);
  const summary = useMemo(() => peakSummary(report.entries), [report.entries]);
  const colorGroups = useMemo(() => availableColorGroups(report.entries), [report.entries]);
  // Couleur disparue de la cave (vin supprimé, déplacé) : filtre levé, les puces restent cohérentes.
  const activeColor = effectiveColorFilter(color === 'all' ? null : color, colorGroups);
  const visible = useMemo(
    () => filterPeakEntries(report.entries, { query, color: activeColor, includeSoon }),
    [report.entries, query, activeColor, includeSoon],
  );
  const titleById = useMemo(() => new Map(wines.map((w) => [w.id, w.title ?? t('common.unknown')])), [wines, t]);
  const drinkableCount = summary.past + summary.closing + summary.peak;

  if (itemsQuery.isLoading) {
    return (
      <Screen scroll={false} title={t('cellarPeak.title')} backFallback={routes.collection()}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  // Hors-ligne sans cache : jamais « cave vide ».
  if (isOfflineWithoutData(itemsQuery)) {
    return (
      <Screen scroll={false} title={t('cellarPeak.title')} backFallback={routes.collection()}>
        <View style={styles.center}>
          <VEmptyState title={t('cellarPeak.title')} message={t('cellarPeak.offlineUnloaded')} />
        </View>
      </Screen>
    );
  }

  // Une panne n'est jamais présentée comme une cave vide.
  if (itemsQuery.isError && itemsQuery.data === undefined) {
    return (
      <Screen scroll={false} title={t('cellarPeak.title')} backFallback={routes.collection()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('cellarPeak.title')}
            message={errorMessage(itemsQuery.error, t)}
            action={{ label: t('common.retry'), onPress: () => void itemsQuery.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  if (wines.length === 0) {
    return (
      <Screen scroll={false} title={t('cellarPeak.title')} backFallback={routes.collection()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('cellarPeak.emptyCellarTitle')}
            message={t('cellarPeak.emptyCellarMessage')}
            action={{ label: t('cellarPeak.scanWine'), onPress: () => router.push(routes.capture('wine') as Href) }}
          />
        </View>
      </Screen>
    );
  }

  const colorOptions = [
    { value: 'all' as const, label: t('cellarPeak.color.all') },
    ...colorGroups.map((group) => ({ value: group, label: t(`cellarPeak.color.${group}`) })),
  ];

  return (
    <Screen title={t('cellarPeak.title')} backFallback={routes.collection()}>
      {/* Le titre est porté par l'en-tête de l'écran : on va droit à l'essentiel. */}
      <VText variant="caption" tone="dim">
        {t('cellarPeak.intro')}
      </VText>

      {/* Actions principales en tête : rappel et sommelier. */}
      <View style={styles.topActions}>
        <VButton
          label={showReminder ? t('cellarPeak.hideReminder') : t('cellarPeak.remindMe')}
          variant={showReminder ? 'ghost' : 'primary'}
          onPress={() => setShowReminder((v) => !v)}
        />
        <VButton
          label={t('cellarPeak.sommelier')}
          variant="secondary"
          onPress={() => router.push(routes.cellarSommelier() as Href)}
        />
      </View>

      {showReminder ? <DrinkReminderSettings report={report} /> : null}

      <View style={styles.summary} accessibilityRole="summary">
        <VText variant="heading" tone="gold">
          {t('cellarPeak.summary', { count: drinkableCount })}
        </VText>
        <View style={styles.badges}>
          {PEAK_STATUSES.filter((status) => summary[status] > 0).map((status) => (
            <VBadge
              key={status}
              label={`${t(`cellarPeak.status.${status}`)} · ${summary[status]}`}
              tone={peakStatusTone(status)}
            />
          ))}
        </View>
      </View>

      <SearchField value={query} onChangeText={setQuery} label={t('cellarPeak.searchLabel')} />
      {colorOptions.length > 2 ? (
        <ChoiceChips<ColorChoice>
          label={t('cellarPeak.colorFilter')}
          value={activeColor ?? 'all'}
          onChange={setColor}
          options={colorOptions}
        />
      ) : null}
      {summary.soon > 0 ? (
        <View style={styles.toggleRow}>
          <VText variant="body" style={styles.flex}>
            {t('cellarPeak.includeSoon', { count: summary.soon })}
          </VText>
          <Switch
            value={includeSoon}
            onValueChange={setIncludeSoon}
            accessibilityLabel={t('cellarPeak.includeSoon', { count: summary.soon })}
            trackColor={{ true: velumColors.gold.faint, false: velumColors.ink.border }}
            thumbColor={includeSoon ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
          />
        </View>
      ) : null}

      {report.entries.length === 0 ? (
        <VText variant="body" tone="dim" style={styles.block}>
          {t('cellarPeak.noneAtPeak')}
        </VText>
      ) : visible.length === 0 ? (
        <VText variant="body" tone="dim" style={styles.block}>
          {t('cellarPeak.noneMatching')}
        </VText>
      ) : (
        visible.map((entry) => (
          <PeakWineCard
            key={entry.itemId}
            entry={entry}
            onPairTonight={(dish) => router.push(routes.cellarSommelier(dish) as Href)}
            onOpenItem={() => router.push(routes.item(entry.itemId) as Href)}
            onEditPosition={() =>
              setEditing({
                itemId: entry.itemId,
                label: displayWineLabel(entry.label, t),
                location: entry.storageLocation,
              })
            }
          />
        ))
      )}

      {report.unknownWindowItemIds.length > 0 ? (
        <VCard style={styles.block}>
          <VText variant="heading">{t('cellarPeak.unknownTitle', { count: report.unknownWindowItemIds.length })}</VText>
          <VText variant="caption" tone="dim">
            {t('cellarPeak.unknownMessage')}
          </VText>
          {report.unknownWindowItemIds.slice(0, UNKNOWN_PREVIEW).map((id) => (
            <VListRow
              key={id}
              title={titleById.get(id) ?? t('common.unknown')}
              subtitle={t('cellarPeak.openItem')}
              onPress={() => router.push(routes.item(id) as Href)}
            />
          ))}
        </VCard>
      ) : null}

      {report.youngCount > 0 ? (
        <VText variant="caption" tone="dim" style={styles.block}>
          {t('cellarPeak.youngNote', { count: report.youngCount })}
        </VText>
      ) : null}

      <PositionEditor target={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  topActions: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm, marginTop: velumSpacing.md },
  summary: { marginTop: velumSpacing.lg, marginBottom: velumSpacing.sm, gap: velumSpacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.md, minHeight: 44 },
  flex: { flex: 1 },
  block: { marginTop: velumSpacing.md, gap: velumSpacing.xs },
});
