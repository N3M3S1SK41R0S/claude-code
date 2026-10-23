/**
 * « Rechercher partout » (/search) : UN champ, résultats groupés par espace —
 * Ma collection (recherche locale), Mes envies, Échanges & ventes (catalogue
 * serveur, offre Platine). Chaque section a son propre état : chargement,
 * panne (Réessayer), vide, résultats. Les échanges & ventes indisponibles
 * (offre, fonction pas encore câblée, panne) donnent une section repliée avec
 * message — jamais une erreur bloquante ni un faux « aucun résultat ».
 *
 * Logique pure : lib/globalSearch.ts. Lien : globalSearchHref(query?).
 */
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  VBadge,
  VButton,
  VCard,
  VListRow,
  VSpinner,
  VText,
  velumSpacing,
} from '@velum/ui';
import type { CatalogueListing, VelumItem, WishlistEntry } from '@velum/core';

import { Screen } from '../components/Screen';
import { SearchField } from '../components/search/SearchField';
import { loadCarnetData, type CarnetData } from '../lib/carnetData';
import { getVelumClient } from '../lib/client';
import { collectionHref, parseTextParam } from '../lib/collectionView';
import { errorMessage } from '../lib/errors';
import {
  WISHLIST_LIST_KEY,
  catalogueAccess,
  catalogueQueryFor,
  catalogueRetry,
  catalogueSearchKey,
  globalSearchOutcome,
  globalSearchTotal,
  localSectionState,
  marketSectionState,
  searchCollectionSection,
  searchWishlistSection,
  type SectionState,
} from '../lib/globalSearch';
import { formatEUR, formatMoney } from '../lib/i18n';
import { usePlan } from '../lib/plan';
import { routes } from '../lib/routes';

/** Délai avant d'interroger le catalogue serveur pendant la saisie. */
const CATALOGUE_DEBOUNCE_MS = 350;

/** Valeur stabilisée après `delay` ms sans changement (frappe continue). */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** En-tête de section : titre + nombre de résultats. */
function SectionHeader({ title, count }: { title: string; count: number | null }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionHeader}>
      <VText variant="heading" tone="gold" accessibilityRole="header" style={styles.flex}>
        {title}
      </VText>
      {count !== null ? (
        <VBadge label={t('search.resultsCount', { count })} tone={count > 0 ? 'gold' : 'neutral'} />
      ) : null}
    </View>
  );
}

/** Corps commun des états non « prêts » d'une section. */
function SectionStatus<T>({
  state,
  onRetry,
  renderReady,
}: {
  state: SectionState<T>;
  onRetry: () => void;
  renderReady: (results: T[], total: number, hasMore: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  if (state.status === 'loading') {
    return (
      <View style={styles.inline} accessibilityLabel={t('common.loading')}>
        <VSpinner />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <VCard style={styles.notice}>
        <VText variant="body" tone="dim">
          {errorMessage(state.error, t)}
        </VText>
        <VButton label={t('common.retry')} variant="secondary" onPress={onRetry} />
      </VCard>
    );
  }
  if (state.status === 'ready') {
    if (state.slice.total === 0) {
      return (
        <VText variant="body" tone="dim">
          {t('globalSearch.sectionEmpty')}
        </VText>
      );
    }
    return <>{renderReady(state.slice.results, state.slice.total, state.slice.hasMore)}</>;
  }
  return null;
}

export default function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const planState = usePlan();

  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(() => parseTextParam(params.q));
  // Recherche locale : valeur différée (saisie fluide sur de grosses collections).
  const query = useDeferredValue(text);
  // Catalogue serveur : requête stabilisée (pas un appel par frappe).
  const debouncedQuery = useDebouncedValue(text, CATALOGUE_DEBOUNCE_MS);

  const itemsQuery = useQuery<CarnetData>({
    // Même clé que l'onglet Collection : cache partagé (et persisté hors-ligne).
    queryKey: ['items', 'collection'],
    queryFn: () =>
      loadCarnetData({
        listItems: () => client.items.list(),
        latestValuation: (itemId) => client.valuations.latest(itemId),
      }),
  });

  const wishlistQuery = useQuery<WishlistEntry[]>({
    queryKey: WISHLIST_LIST_KEY,
    queryFn: () => client.wishlist.list(),
  });

  const access = catalogueAccess(
    planState.status === 'ready'
      ? { status: 'ready', community: planState.entitlements.community }
      : { status: planState.status },
  );
  const catalogueQuery = catalogueQueryFor(debouncedQuery);
  const marketQuery = useQuery<CatalogueListing[]>({
    queryKey: catalogueSearchKey(catalogueQuery ?? { text: '' }),
    queryFn: () => client.marketplace.catalogue(catalogueQuery ?? undefined),
    enabled: access === 'open' && catalogueQuery !== null,
    retry: catalogueRetry,
    staleTime: 30 * 1000,
  });

  const collectionState = useMemo(
    () =>
      localSectionState(
        query,
        { status: itemsQuery.status, data: itemsQuery.data, error: itemsQuery.error },
        (data: CarnetData, q: string) => searchCollectionSection(data.items, q),
      ),
    [query, itemsQuery.status, itemsQuery.data, itemsQuery.error],
  );
  const wishlistState = useMemo(
    () =>
      localSectionState(
        query,
        { status: wishlistQuery.status, data: wishlistQuery.data, error: wishlistQuery.error },
        (data: WishlistEntry[], q: string) => searchWishlistSection(data, q),
      ),
    [query, wishlistQuery.status, wishlistQuery.data, wishlistQuery.error],
  );
  const marketState: SectionState<CatalogueListing> = useMemo(() => {
    // Saisie en cours, pas encore envoyée au serveur : chargement honnête.
    if (catalogueQueryFor(text) !== null && debouncedQuery !== text && access === 'open') {
      return { status: 'loading' };
    }
    return marketSectionState({
      query: debouncedQuery,
      access,
      planError: planState.status === 'error' ? planState.error : undefined,
      catalogue: { status: marketQuery.status, data: marketQuery.data, error: marketQuery.error },
    });
  }, [
    text,
    debouncedQuery,
    access,
    planState.status,
    planState.error,
    marketQuery.status,
    marketQuery.data,
    marketQuery.error,
  ]);

  const sections = [collectionState, wishlistState, marketState];
  const outcome = globalSearchOutcome(query, sections);
  const total = globalSearchTotal(sections);
  const latestByItem = itemsQuery.data?.latestByItem ?? {};
  const failedValuationIds = new Set(itemsQuery.data?.failedValuationItemIds ?? []);
  const trimmed = query.trim();

  const itemSubtitle = (item: VelumItem): string => {
    const parts = [t(`domains.${item.domain}.name`)];
    const latest = latestByItem[item.id];
    if (failedValuationIds.has(item.id)) parts.push(t('errors.SOURCE_UNAVAILABLE'));
    else if (latest) parts.push(formatEUR(latest.central));
    if (item.storageLocation) parts.push(item.storageLocation);
    return parts.join(' · ');
  };

  const wishSubtitle = (entry: WishlistEntry): string => {
    const parts = [t(`domains.${entry.domain}.name`), t(`globalSearch.wishKind.${entry.kind}`)];
    if (entry.targetPrice !== null) {
      parts.push(t('globalSearch.targetPrice', { price: formatEUR(entry.targetPrice) }));
    }
    if (entry.acquired) parts.push(t('globalSearch.acquired'));
    return parts.join(' · ');
  };

  const listingSubtitle = (listing: CatalogueListing): string => {
    const parts: string[] = [];
    if (listing.domain) parts.push(t(`domains.${listing.domain}.name`));
    parts.push(t(`globalSearch.listingKind.${listing.kind}`));
    parts.push(formatMoney(listing.askPrice, listing.currency));
    return parts.join(' · ');
  };

  /** Section « Échanges & ventes » repliée : offre, fonction à venir, panne. */
  const marketCollapsed = (() => {
    if (marketState.status === 'idle' && trimmed.length > 0) {
      return (
        <VText variant="body" tone="dim">
          {t('globalSearch.marketTooShort')}
        </VText>
      );
    }
    if (marketState.status === 'locked') {
      return (
        <VCard style={styles.notice}>
          <VText variant="body" tone="dim">
            {t('globalSearch.marketLocked')}
          </VText>
          <VButton
            label={t('globalSearch.marketLockedCta')}
            variant="secondary"
            onPress={() => router.push(routes.paywall())}
          />
        </VCard>
      );
    }
    if (marketState.status === 'unavailable') {
      const retry =
        marketState.issue === 'planError'
          ? planState.retry
          : marketState.issue === 'failed'
            ? () => void marketQuery.refetch()
            : null;
      return (
        <VCard style={styles.notice}>
          <VText variant="body" tone="dim">
            {marketState.issue === 'notYetAvailable'
              ? t('globalSearch.marketNotYet')
              : `${t('globalSearch.marketFailed')} ${errorMessage(marketState.error, t)}`}
          </VText>
          {retry ? <VButton label={t('common.retry')} variant="secondary" onPress={retry} /> : null}
        </VCard>
      );
    }
    return null;
  })();

  return (
    <Screen title={t('globalSearch.title')}>
      <SearchField
        value={text}
        onChangeText={setText}
        label={t('globalSearch.inputLabel')}
        placeholder={t('globalSearch.placeholder')}
      />

      {/* Verdict global, annoncé aux lecteurs d'écran. */}
      <View style={styles.summary} accessibilityLiveRegion="polite">
        {outcome === 'idle' ? (
          <VText variant="body" tone="dim">
            {t('globalSearch.intro')}
          </VText>
        ) : outcome === 'results' ? (
          <VText variant="caption" tone="dim">
            {t('search.resultsCount', { count: total })}
          </VText>
        ) : outcome === 'noResult' ? (
          <VCard style={styles.notice}>
            <VText variant="heading">{t('search.noResult', { query: trimmed })}</VText>
            <VText variant="body" tone="dim">
              {t('globalSearch.noResultHint')}
            </VText>
          </VCard>
        ) : (
          <VText variant="caption" tone="dim">
            {t('globalSearch.searching')}
          </VText>
        )}
      </View>

      {outcome !== 'idle' && outcome !== 'noResult' ? (
        <>
          {/* MA COLLECTION */}
          <View style={styles.section}>
            <SectionHeader
              title={t('globalSearch.sections.collection')}
              count={collectionState.status === 'ready' ? collectionState.slice.total : null}
            />
            <SectionStatus
              state={collectionState}
              onRetry={() => void itemsQuery.refetch()}
              renderReady={(results, count, hasMore) => (
                <>
                  {results.map((item) => (
                    <VListRow
                      key={item.id}
                      title={item.title ?? t('common.unknown')}
                      subtitle={itemSubtitle(item)}
                      onPress={() => router.push(routes.item(item.id))}
                    />
                  ))}
                  {hasMore ? (
                    <VButton
                      label={t('globalSearch.seeAllCollection', { count })}
                      variant="ghost"
                      onPress={() => router.navigate(collectionHref(trimmed))}
                    />
                  ) : null}
                </>
              )}
            />
          </View>

          {/* MES ENVIES */}
          <View style={styles.section}>
            <SectionHeader
              title={t('globalSearch.sections.wishlist')}
              count={wishlistState.status === 'ready' ? wishlistState.slice.total : null}
            />
            <SectionStatus
              state={wishlistState}
              onRetry={() => void wishlistQuery.refetch()}
              renderReady={(results, count, hasMore) => (
                <>
                  {results.map((entry) => (
                    <VListRow
                      key={entry.id}
                      title={entry.title}
                      subtitle={wishSubtitle(entry)}
                      onPress={() => router.push(routes.wishlist(entry.domain))}
                    />
                  ))}
                  {hasMore ? (
                    <VButton
                      label={t('globalSearch.seeAllWishlist', { count })}
                      variant="ghost"
                      onPress={() => router.push(routes.wishlist())}
                    />
                  ) : null}
                </>
              )}
            />
          </View>

          {/* ÉCHANGES & VENTES */}
          <View style={styles.section}>
            <SectionHeader
              title={t('globalSearch.sections.market')}
              count={marketState.status === 'ready' ? marketState.slice.total : null}
            />
            {marketCollapsed ?? (
              <SectionStatus
                state={marketState}
                onRetry={() => void marketQuery.refetch()}
                renderReady={(results, count, hasMore) => (
                  <>
                    {results.map((listing) => (
                      <VListRow
                        key={listing.id}
                        title={listing.title ?? t('common.unknown')}
                        subtitle={listingSubtitle(listing)}
                        right={
                          listing.certified ? (
                            <VBadge label={t('globalSearch.certified')} tone="gold" />
                          ) : undefined
                        }
                        onPress={() => router.push(routes.listing(listing.id))}
                      />
                    ))}
                    <VButton
                      label={
                        hasMore
                          ? t('globalSearch.seeAllMarketCount', { count })
                          : t('globalSearch.seeAllMarket')
                      }
                      variant="ghost"
                      onPress={() => router.push(routes.community(null, undefined, trimmed))}
                    />
                  </>
                )}
              />
            )}
          </View>
        </>
      ) : null}

      {/* Aucun résultat : rappel des espaces non interrogés (offre, à venir). */}
      {outcome === 'noResult' && marketCollapsed ? (
        <View style={styles.section}>
          <SectionHeader title={t('globalSearch.sections.market')} count={null} />
          {marketCollapsed}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { marginTop: velumSpacing.md },
  section: { marginTop: velumSpacing.xl, gap: velumSpacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  notice: { gap: velumSpacing.sm },
  inline: { paddingVertical: velumSpacing.md, alignItems: 'flex-start' },
});
