/**
 * « Mes envies » — liste d'envies et d'idées PAR CATÉGORIE.
 *
 * En haut : « Ajouter une envie », puis catégorie (une liste par catégorie +
 * Toutes, paramètre de route `domain`), statistiques, recherche, segments
 * Envies / Idées / Obtenues et tri. Chargement, hors-ligne sans cache, panne
 * (Réessayer) et liste vide sont des états distincts : ni une panne ni une
 * requête en pause hors-ligne ne sont présentées comme une liste vide.
 * Toute la logique (filtres, tri, recherche, stats) est dans lib/wishlist.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { VelumDomain, WishlistEntry } from '@velum/core';
import { VButton, VCard, VEmptyState, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { DomainFilterChips } from '../../components/search/DomainFilterChips';
import { SearchField } from '../../components/search/SearchField';
import { ChoiceChips } from '../../components/wishlist/ChoiceChips';
import { WishlistRow } from '../../components/wishlist/WishlistRow';
import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { getActiveDomains } from '../../lib/features';
import { queryScreenState } from '../../lib/itemSheetFlows';
import {
  WISHLIST_QUERY_KEY,
  WISHLIST_SEGMENTS,
  WISHLIST_SORTS,
  filterWishlist,
  formatTargetPrice,
  groupByDomain,
  parseDomainParam,
  searchHints,
  segmentCounts,
  wishlistRoutes,
  wishlistStats,
  type WishlistSegment,
  type WishlistSort,
} from '../../lib/wishlist';

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const params = useLocalSearchParams<{ domain?: string }>();
  const domains = useMemo(() => getActiveDomains(), []);

  const [domain, setDomain] = useState<VelumDomain | null>(() => parseDomainParam(params.domain, domains));
  const [segment, setSegment] = useState<WishlistSegment>('wish');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<WishlistSort>('priority');

  // Lien profond / navigation vers une autre catégorie alors que l'écran est monté.
  useEffect(() => {
    setDomain(parseDomainParam(params.domain, domains));
  }, [params.domain, domains]);

  const listQuery = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => client.wishlist.list(),
  });
  const all = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const filter = { domain, segment, query, sort };
  const visible = useMemo(
    () => filterWishlist(all, { domain, segment, query, sort }),
    [all, domain, segment, query, sort],
  );
  const counts = useMemo(() => segmentCounts(all, domain), [all, domain]);
  const stats = useMemo(() => wishlistStats(all, domain), [all, domain]);
  const hints = visible.length === 0 ? searchHints(all, filter) : null;

  const changeDomain = (next: VelumDomain | null) => {
    setDomain(next);
    // URL synchronisée (web, retour arrière, partage de lien).
    router.setParams({ domain: next ?? undefined });
  };

  const openEntry = (entry: WishlistEntry) => router.push(wishlistRoutes.entry(entry.id));
  const addEntry = () => router.push(wishlistRoutes.create(domain));

  const view = queryScreenState(listQuery);
  if (view === 'loading') {
    return (
      <Screen scroll={false} title={t('wishlist.title')}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  // En pause hors-ligne, jamais chargée sur cet appareil : pas « liste vide ».
  if (view === 'offline') {
    return (
      <Screen scroll={false} title={t('wishlist.title')}>
        <View style={styles.center}>
          <VEmptyState title={t('wishlist.offline.title')} message={t('wishlist.offline.message')} />
        </View>
      </Screen>
    );
  }

  // Panne sans données affichables (ou cache vide non confirmé) : jamais « liste vide ».
  if (listQuery.isError && all.length === 0) {
    return (
      <Screen scroll={false} title={t('wishlist.title')}>
        <View style={styles.center}>
          <VEmptyState
            title={t('wishlist.loadError')}
            message={errorMessage(listQuery.error, t)}
            action={{ label: t('common.retry'), onPress: () => void listQuery.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  if (all.length === 0) {
    return (
      <Screen scroll={false} title={t('wishlist.title')}>
        <View style={styles.center}>
          <VEmptyState
            title={t('wishlist.empty.title')}
            message={t('wishlist.empty.message')}
            action={{ label: t('wishlist.empty.cta'), onPress: addEntry }}
          />
        </View>
      </Screen>
    );
  }

  const segmentLabel = (s: WishlistSegment) => t(`wishlist.segments.${s}`);
  const grouped = domain === null && query.trim().length === 0;

  return (
    <Screen title={t('wishlist.title')}>
      <View style={styles.top}>
        <VButton label={t('wishlist.add')} onPress={addEntry} accessibilityHint={t('wishlist.addHint')} />

        {listQuery.isError ? (
          <VCard style={styles.warning}>
            <VText variant="caption" tone="danger">
              {t('wishlist.staleWarning')}
            </VText>
            <VButton label={t('common.retry')} variant="ghost" onPress={() => void listQuery.refetch()} />
          </VCard>
        ) : null}

        <DomainFilterChips value={domain} onChange={changeDomain} domains={domains} />

        <View>
          <VText variant="caption" tone="dim" tabularNums>
            {t('wishlist.stats.summary', {
              wishes: stats.wishes,
              ideas: stats.ideas,
              acquired: stats.acquired,
            })}
          </VText>
          {stats.targetBudget > 0 ? (
            <VText variant="caption" tone="dim" tabularNums>
              {t('wishlist.stats.budget', { amount: formatTargetPrice(stats.targetBudget, i18n.language) })}
            </VText>
          ) : null}
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          label={t('wishlist.search.label')}
          placeholder={t('wishlist.search.placeholder')}
        />

        <ChoiceChips<WishlistSegment>
          label={t('wishlist.segments.label')}
          value={segment}
          onChange={setSegment}
          options={WISHLIST_SEGMENTS.map((s) => ({
            value: s,
            label: t('wishlist.segments.withCount', { label: segmentLabel(s), count: counts[s] }),
          }))}
        />

        <View style={styles.sortRow}>
          <VText variant="caption" tone="dim">
            {t('wishlist.sort.label')}
          </VText>
          <ChoiceChips<WishlistSort>
            label={t('wishlist.sort.label')}
            value={sort}
            onChange={setSort}
            options={WISHLIST_SORTS.map((s) => ({ value: s, label: t(`wishlist.sort.${s}`) }))}
          />
        </View>
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyBlock}>
          <VText variant="body" tone="dim" center>
            {query.trim().length > 0
              ? t('search.noResult', { query: query.trim() })
              : t('wishlist.empty.segment', { segment: segmentLabel(segment) })}
          </VText>
          {hints?.otherSegments.map((hint) => (
            <VButton
              key={hint.segment}
              label={t('wishlist.search.otherSegment', { count: hint.count, segment: segmentLabel(hint.segment) })}
              variant="ghost"
              onPress={() => setSegment(hint.segment)}
            />
          ))}
          {hints && domain !== null && hints.everywhere > 0 ? (
            <VButton
              label={t('wishlist.search.everywhere', { count: hints.everywhere })}
              variant="ghost"
              onPress={() => changeDomain(null)}
            />
          ) : null}
        </View>
      ) : grouped ? (
        groupByDomain(visible, domains).map((group) => (
          <View key={group.domain} style={styles.group}>
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {`${t(`domains.${group.domain}.group`)} — ${t(`domains.${group.domain}.name`)}`}
            </VText>
            {group.entries.map((entry) => (
              <WishlistRow key={entry.id} entry={entry} onPress={() => openEntry(entry)} />
            ))}
          </View>
        ))
      ) : (
        <View style={styles.group}>
          <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
            {t('search.resultsCount', { count: visible.length })}
          </VText>
          {visible.map((entry) => (
            <WishlistRow
              key={entry.id}
              entry={entry}
              showDomain={domain === null}
              onPress={() => openEntry(entry)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  top: { gap: velumSpacing.sm },
  warning: { gap: velumSpacing.xs },
  sortRow: { gap: 2 },
  emptyBlock: { marginTop: velumSpacing.lg, gap: velumSpacing.sm },
  group: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
});
