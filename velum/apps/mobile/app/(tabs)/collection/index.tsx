/**
 * Onglet Collection : recherche en tête (titre, attributs, notes,
 * emplacement), filtre par catégorie, tri (récent / valeur ↓ / nom A→Z),
 * valeur du portefeuille + plus/moins-value latente, grille d'accès rapide
 * (carnet, envies, apogée, sommelier, échanges & ventes, mode classeur…),
 * bandeau « à boire » compact, cache offline (React Query) et rejeu de la
 * file de mutations au retour du réseau.
 *
 * États distincts : chargement / panne (Réessayer) / collection vide /
 * « aucun résultat » pour une recherche ou un filtre. Logique pure :
 * lib/collectionView.ts et lib/collectionViewQuickAccess.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VButton,
  VCard,
  VEmptyState,
  VListRow,
  VSpinner,
  VText,
  velumSpacing,
} from '@velum/ui';
import type { VelumDomain, VelumItem } from '@velum/core';

import { Screen } from '../../../components/Screen';
import { ChoiceChips } from '../../../components/home/ChoiceChips';
import { QuickAccessGrid, type QuickAccessTile } from '../../../components/home/QuickAccessGrid';
import { SearchIconButton } from '../../../components/home/SearchLauncher';
import { DomainFilterChips } from '../../../components/search/DomainFilterChips';
import { SearchField } from '../../../components/search/SearchField';
import { loadCarnetData, type CarnetData } from '../../../lib/carnetData';
import { getVelumClient } from '../../../lib/client';
import { collectionSummary } from '../../../lib/collectionSummary';
import {
  COLLECTION_SORTS,
  DEFAULT_COLLECTION_SORT,
  buildCollectionView,
  drinkNowPreview,
  isOfflineWithoutData,
  parseDomainParam,
  parseTextParam,
  showsResultCount,
  type CollectionSort,
} from '../../../lib/collectionView';
import {
  collectionQuickAccess,
  type CollectionQuickAccessId,
} from '../../../lib/collectionViewQuickAccess';
import { displayWineLabel, positionLabel } from '../../../lib/cellarPeak';
import { drinkNowBannerEntries } from '../../../lib/drinkNow';
import { errorMessage } from '../../../lib/errors';
import { getActiveDomains, marketplaceEnabled } from '../../../lib/features';
import { rejectedMutationsNotice } from '../../../lib/itemSheetFlows';
import { globalSearchHref } from '../../../lib/globalSearch';
import { formatEUR } from '../../../lib/i18n';
import { routes } from '../../../lib/routes';
import { showToast } from '../../../stores/toastStore';

/** Clés i18n des accès rapides (le carnet garde « Ouvrir mon carnet »). */
const QUICK_LABEL_KEYS: Record<CollectionQuickAccessId, { label: string; hint: string }> = {
  carnet: { label: 'carnet.open', hint: 'collection.quick.carnetHint' },
  wishlist: { label: 'collection.quick.wishlist', hint: 'collection.quick.wishlistHint' },
  cellarPeak: { label: 'collection.quick.cellarPeak', hint: 'collection.quick.cellarPeakHint' },
  sommelier: { label: 'collection.quick.sommelier', hint: 'collection.quick.sommelierHint' },
  community: { label: 'collection.quick.community', hint: 'collection.quick.communityHint' },
  batch: { label: 'collection.quick.batch', hint: 'collection.quick.batchHint' },
  eventSommelier: {
    label: 'collection.quick.eventSommelier',
    hint: 'collection.quick.eventSommelierHint',
  },
  blindTasting: { label: 'collection.quick.blindTasting', hint: 'collection.quick.blindTastingHint' },
};

export default function Collection() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const domains = useMemo(() => getActiveDomains(), []);

  // Pré-remplissage depuis un lien (« Voir tout » de la recherche globale).
  const params = useLocalSearchParams<{ q?: string; domain?: string }>();
  const paramQuery = parseTextParam(params.q);
  const paramDomain = parseDomainParam(params.domain, domains);
  const [search, setSearch] = useState(paramQuery);
  const [domain, setDomain] = useState<VelumDomain | null>(paramDomain);
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_COLLECTION_SORT);
  useEffect(() => {
    if (paramQuery.length > 0) setSearch(paramQuery);
  }, [paramQuery]);
  useEffect(() => {
    if (paramDomain !== null) setDomain(paramDomain);
  }, [paramDomain]);

  // Rejeu de la file de mutations hors-ligne à l'ouverture de l'onglet.
  useEffect(() => {
    void (async () => {
      try {
        if ((await client.queue.size()) > 0) {
          const report = await client.queue.replay();
          // Refusées par le serveur et retirées de la file : jamais en silence.
          const rejected = rejectedMutationsNotice(report);
          if (rejected !== null) {
            showToast(
              rejected.reason === null
                ? t('collection.rejectedNotice', { count: rejected.count })
                : t('collection.rejectedNoticeReason', { count: rejected.count, reason: rejected.reason }),
              'danger',
            );
          }
          if (report.failed > 0) {
            showToast(t('collection.offlineNotice', { count: report.failed }), 'info');
          }
        }
      } catch {
        // silencieux : on retentera au prochain passage
      }
    })();
  }, [client, t]);

  const query = useQuery<CarnetData>({
    queryKey: ['items', 'collection'],
    queryFn: () =>
      loadCarnetData({
        listItems: () => client.items.list(),
        latestValuation: (itemId) => client.valuations.latest(itemId),
      }),
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const latestByItem = useMemo(() => query.data?.latestByItem ?? {}, [query.data]);
  const failedValuationItemIds = useMemo(
    () => query.data?.failedValuationItemIds ?? [],
    [query.data],
  );
  const failedValuationIds = useMemo(
    () => new Set(failedValuationItemIds),
    [failedValuationItemIds],
  );

  const view = useMemo(
    () =>
      buildCollectionView({
        items,
        latestByItem,
        failedValuationItemIds,
        query: search,
        domain,
        sort,
        domainOrder: domains,
      }),
    [items, latestByItem, failedValuationItemIds, search, domain, sort, domains],
  );

  const { totalValue, gainLoss } = useMemo(
    () => collectionSummary(items, latestByItem, failedValuationItemIds),
    [failedValuationItemIds, items, latestByItem],
  );

  // Intelligence de cave — sens 2 : vins à boire (calcul local), même règle
  // et même ordre que « Mes vins à leur apogée » (fenêtre dépassée comprise).
  const hasWine = useMemo(() => items.some((i) => i.domain === 'wine'), [items]);
  const drinkNow = useMemo(
    () => drinkNowPreview(drinkNowBannerEntries(items, new Date().getFullYear())),
    [items],
  );

  const quickTiles: QuickAccessTile[] = useMemo(
    () =>
      collectionQuickAccess({ hasWine, activeDomains: domains, marketplace: marketplaceEnabled() }).map((entry) => ({
        key: entry.id,
        label: t(QUICK_LABEL_KEYS[entry.id].label),
        hint: t(QUICK_LABEL_KEYS[entry.id].hint),
        icon: entry.icon,
        gilded: entry.gilded,
        onPress: () => router.push(entry.href),
      })),
    [domains, hasWine, router, t],
  );

  const sortOptions = useMemo(
    () =>
      COLLECTION_SORTS.map((value) => ({
        value,
        label: t(`collection.sort.${value}`),
        accessibilityLabel: t(`collection.sortA11y.${value}`),
      })),
    [t],
  );

  const openGlobalSearch = () => router.push(globalSearchHref(search));
  const clearFilters = () => {
    setSearch('');
    setDomain(null);
  };

  if (query.isLoading) {
    return (
      <Screen scroll={false} back={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  // Hors-ligne sans cache : jamais « collection vide » (la lecture reprendra au retour du réseau).
  if (isOfflineWithoutData(query)) {
    return (
      <Screen scroll={false} back={false}>
        <View style={styles.center}>
          <VEmptyState title={t('collection.title')} message={t('collection.offlineUnloaded')} />
        </View>
      </Screen>
    );
  }

  // Un échec de chargement initial ne doit jamais être présenté comme une
  // collection vide. En revanche, une donnée restaurée du cache reste lisible
  // si son rafraîchissement réseau échoue (contrat hors-ligne).
  if (query.isError && query.data === undefined) {
    return (
      <Screen scroll={false} back={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('collection.title')}
            message={errorMessage(query.error, t)}
            action={{ label: t('common.retry'), onPress: () => void query.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  if (view.kind === 'empty') {
    return (
      <Screen back={false}>
        <View style={styles.titleRow}>
          <VText variant="title" accessibilityRole="header" style={styles.flex}>
            {t('collection.title')}
          </VText>
          <SearchIconButton
            label={t('collection.searchGlobal')}
            hint={t('collection.searchGlobalHint')}
            onPress={openGlobalSearch}
          />
        </View>
        <VEmptyState
          title={t('collection.emptyTitle')}
          message={t('collection.emptyMessage')}
          action={{ label: t('collection.emptyCta'), onPress: () => router.push(routes.captureTab()) }}
        />
        {/* Même vide, les espaces restent accessibles (envies, échanges…). */}
        <QuickAccessGrid tiles={quickTiles} />
      </Screen>
    );
  }

  const searching = view.kind === 'results' || (view.kind === 'noResult' && view.reason === 'query');
  const valuationsUnavailable = failedValuationItemIds.length > 0;

  /** Sous-titre d'une ligne : catégorie (en recherche), valeur, emplacement. */
  const rowSubtitle = (item: VelumItem, withDomain: boolean): string => {
    const parts: string[] = [];
    if (withDomain) parts.push(t(`domains.${item.domain}.name`));
    const latest = latestByItem[item.id];
    parts.push(
      failedValuationIds.has(item.id)
        ? t('errors.SOURCE_UNAVAILABLE')
        : latest
          ? formatEUR(latest.central)
          : t('item.noValuation'),
    );
    if (item.storageLocation) parts.push(item.storageLocation);
    return parts.join(' · ');
  };

  const renderRow = (item: VelumItem, withDomain: boolean) => (
    <VListRow
      key={item.id}
      title={item.title ?? t('common.unknown')}
      subtitle={rowSubtitle(item, withDomain)}
      right={item.confidence !== null ? <ConfidenceBadge value={item.confidence} /> : undefined}
      onPress={() => router.push(routes.item(item.id))}
    />
  );

  return (
    <Screen back={false}>
      {/* En-tête : titre + loupe « Rechercher partout ». */}
      <View style={styles.titleRow}>
        <VText variant="title" accessibilityRole="header" style={styles.flex}>
          {t('collection.title')}
        </VText>
        <SearchIconButton
          label={t('collection.searchGlobal')}
          hint={t('collection.searchGlobalHint')}
          onPress={openGlobalSearch}
        />
      </View>

      {/* Recherche en tête : le champ ne bouge pas pendant la saisie. */}
      <SearchField
        value={search}
        onChangeText={setSearch}
        label={t('collection.searchLabel')}
        placeholder={t('collection.searchPlaceholder')}
      />

      {!searching ? (
        <>
          <VCard style={styles.summary}>
            <VText variant="caption" tone="dim">
              {t('collection.totalValue')}
            </VText>
            <VText
              variant="title"
              tone="gold"
              tabularNums
              accessibilityLabel={
                totalValue === null ? t('errors.SOURCE_UNAVAILABLE') : formatEUR(totalValue)
              }
            >
              {totalValue === null ? '—' : formatEUR(totalValue)}
            </VText>
            {valuationsUnavailable ? (
              <View style={styles.valuationWarning}>
                <VText variant="caption" tone="danger">
                  {t('errors.SOURCE_UNAVAILABLE')}
                </VText>
                <VButton
                  label={t('common.retry')}
                  variant="ghost"
                  onPress={() => void query.refetch()}
                />
              </View>
            ) : gainLoss !== null ? (
              <VText variant="body" tone={gainLoss >= 0 ? 'default' : 'danger'} tabularNums>
                {`${t('collection.gainLoss')} : ${gainLoss >= 0 ? '+' : ''}${formatEUR(gainLoss)}`}
              </VText>
            ) : null}
            <VText variant="caption" tone="dim">
              {t('collection.itemsCount', { count: items.length })}
            </VText>
          </VCard>

          <VText variant="heading" tone="gold" accessibilityRole="header" style={styles.sectionTitle}>
            {t('collection.quickAccess')}
          </VText>
          <QuickAccessGrid tiles={quickTiles} />

          {/* Bandeau « à boire » compact : 3 premiers + « Voir tout ». */}
          {drinkNow.total > 0 ? (
            <VCard style={styles.drinkNow}>
              <VText variant="heading" tone="gold" accessibilityRole="header">
                {t('cellar.drinkNowTitle', { count: drinkNow.total })}
              </VText>
              {drinkNow.shown.map((entry) => {
                const position = positionLabel(entry.storageLocation, t, { short: true });
                return (
                  <VListRow
                    key={entry.itemId}
                    title={displayWineLabel(entry.label, t)}
                    subtitle={[
                      t(`cellarPeak.status.${entry.status}`),
                      t('cellar.drinkNowWindow', { from: entry.windowFrom, to: entry.windowTo }),
                      position,
                      entry.suggestedDishes.length > 0
                        ? t('cellar.drinkNowDishes', { dishes: entry.suggestedDishes.slice(0, 2).join(', ') })
                        : null,
                    ]
                      .filter((part): part is string => part !== null)
                      .join(' · ')}
                    onPress={() => router.push(routes.item(entry.itemId))}
                  />
                );
              })}
              <VButton
                label={
                  drinkNow.hidden > 0
                    ? t('collection.drinkNowSeeAllCount', { count: drinkNow.total })
                    : t('collection.drinkNowSeeAll')
                }
                variant="secondary"
                onPress={() => router.push(routes.cellarPeak())}
                accessibilityHint={t('collection.drinkNowSeeAllHint')}
              />
            </VCard>
          ) : null}
        </>
      ) : null}

      {/* Filtres : catégorie + tri, puis compteur de résultats. */}
      <View style={styles.filters}>
        <DomainFilterChips value={domain} onChange={setDomain} domains={domains} />
        <ChoiceChips
          value={sort}
          options={sortOptions}
          onChange={setSort}
          accessibilityLabel={t('collection.sortLabel')}
        />
        {showsResultCount(view) && (view.kind === 'results' || view.kind === 'grouped') ? (
          <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
            {t('search.resultsCount', { count: view.count })}
          </VText>
        ) : null}
      </View>

      {view.kind === 'noResult' ? (
        <VCard style={styles.noResult}>
          <VText variant="heading" accessibilityLiveRegion="polite">
            {view.reason === 'query'
              ? t('search.noResult', { query: view.query })
              : t('collection.noItemsInDomain', {
                  domain: view.domain ? t(`domains.${view.domain}.name`) : '',
                })}
          </VText>
          {view.reason === 'query' ? (
            <>
              <VText variant="body" tone="dim">
                {t('collection.noResultHint')}
              </VText>
              <VButton
                label={t('collection.searchEverywhere')}
                onPress={openGlobalSearch}
                accessibilityHint={t('collection.searchGlobalHint')}
              />
            </>
          ) : view.domain ? (
            <VButton
              label={t('collection.captureInDomain', { domain: t(`domains.${view.domain}.name`) })}
              onPress={() => router.push(view.domain ? routes.capture(view.domain) : routes.captureTab())}
            />
          ) : null}
          <VButton label={t('collection.clearFilters')} variant="ghost" onPress={clearFilters} />
        </VCard>
      ) : null}

      {view.kind === 'results' ? (
        <View style={styles.group}>{view.items.map((item) => renderRow(item, true))}</View>
      ) : null}

      {view.kind === 'grouped'
        ? view.groups.map((group) => (
            <View key={group.domain} style={styles.group}>
              <VText variant="heading" tone="gold" accessibilityRole="header">
                {`${t(`domains.${group.domain}.group`)} — ${t(`domains.${group.domain}.name`)}`}
              </VText>
              {group.items.map((item) => renderRow(item, false))}
            </View>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  flex: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.sm,
    marginBottom: velumSpacing.sm,
  },
  summary: { marginVertical: velumSpacing.md, gap: velumSpacing.xs / 2 },
  valuationWarning: { gap: velumSpacing.xs },
  sectionTitle: { marginBottom: velumSpacing.sm },
  drinkNow: { marginTop: velumSpacing.md, gap: velumSpacing.xs },
  filters: { marginTop: velumSpacing.md, gap: velumSpacing.xs },
  noResult: { marginTop: velumSpacing.md, gap: velumSpacing.sm },
  group: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
});
