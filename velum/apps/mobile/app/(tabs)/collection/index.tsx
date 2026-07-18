/**
 * Onglet Collection : liste groupée par domaine (cave / cabinet / galerie /
 * album), valeur totale du portefeuille + plus/moins-value latente vs prix
 * d'acquisition, recherche simple, cache offline (React Query) et rejeu de
 * la file de mutations au retour du réseau.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import type { VelumDomain, VelumItem } from '@velum/core';

import { Screen } from '../../../components/Screen';
import { loadCarnetData, type CarnetData } from '../../../lib/carnetData';
import { getVelumClient } from '../../../lib/client';
import { collectionSummary } from '../../../lib/collectionSummary';
import { drinkNowForItems } from '../../../lib/drinkNow';
import { errorMessage } from '../../../lib/errors';
import { getActiveDomains } from '../../../lib/features';
import { formatEUR } from '../../../lib/i18n';
import { showToast } from '../../../stores/toastStore';

export default function Collection() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const client = getVelumClient();

  // Rejeu de la file de mutations hors-ligne à l'ouverture de l'onglet.
  useEffect(() => {
    void (async () => {
      try {
        if ((await client.queue.size()) > 0) {
          const report = await client.queue.replay();
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

  const items = query.data?.items ?? [];
  const latestByItem = query.data?.latestByItem ?? {};
  const failedValuationItemIds = query.data?.failedValuationItemIds ?? [];
  const failedValuationIds = useMemo(
    () => new Set(failedValuationItemIds),
    [failedValuationItemIds],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return items;
    return items.filter(
      (item) =>
        (item.title ?? '').toLowerCase().includes(needle) ||
        JSON.stringify(item.attributes).toLowerCase().includes(needle),
    );
  }, [items, search]);

  const { totalValue, gainLoss } = useMemo(
    () => collectionSummary(items, latestByItem, failedValuationItemIds),
    [failedValuationItemIds, items, latestByItem],
  );

  // Intelligence de cave — sens 2 : vins à leur apogée (calcul local).
  const hasWine = useMemo(() => items.some((i) => i.domain === 'wine'), [items]);
  const drinkNow = useMemo(() => drinkNowForItems(items, new Date().getFullYear()), [items]);

  const domains = getActiveDomains();
  const grouped = useMemo(() => {
    const map = new Map<VelumDomain, VelumItem[]>();
    for (const domain of domains) map.set(domain, []);
    for (const item of filtered) {
      const bucket = map.get(item.domain);
      if (bucket) bucket.push(item);
      else map.set(item.domain, [item]);
    }
    return map;
  }, [filtered, domains]);

  if (query.isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  // Un échec de chargement initial ne doit jamais être présenté comme une
  // collection vide. En revanche, une donnée restaurée du cache reste lisible
  // si son rafraîchissement réseau échoue (contrat hors-ligne).
  if (query.isError && query.data === undefined) {
    return (
      <Screen scroll={false}>
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

  if (items.length === 0) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('collection.emptyTitle')}
            message={t('collection.emptyMessage')}
            action={{ label: t('collection.emptyCta'), onPress: () => router.push('/(tabs)/capture') }}
          />
        </View>
      </Screen>
    );
  }

  const valuationsUnavailable = failedValuationItemIds.length > 0;

  return (
    <Screen>
      <VText variant="title">{t('collection.title')}</VText>

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

      <View style={styles.bookActions}>
        {/* Carnet virtuel (Gold) — visible dès qu'il y a au moins un objet. */}
        <VButton
          label={t('carnet.open')}
          variant="primary"
          onPress={() => router.push('/carnet')}
          accessibilityHint={t('carnet.title')}
        />
        {hasWine ? (
          <VButton
            label={t('cellar.sommelierEntry')}
            variant="secondary"
            onPress={() => router.push('/cellar-sommelier')}
            accessibilityHint={t('cellar.dishLabel')}
          />
        ) : null}
        {hasWine ? (
          <VButton
            label={t('event.entry')}
            variant="secondary"
            onPress={() => router.push('/event-sommelier')}
            accessibilityHint={t('event.intro')}
          />
        ) : null}
        {hasWine ? (
          <VButton
            label={t('blind.entry')}
            variant="secondary"
            onPress={() => router.push('/blind-tasting')}
            accessibilityHint={t('blind.intro')}
          />
        ) : null}
      </View>

      {drinkNow.length > 0 ? (
        <VCard style={styles.drinkNow}>
          <VText variant="heading" tone="gold">
            {t('cellar.drinkNowTitle', { count: drinkNow.length })}
          </VText>
          {drinkNow.map((signal) => (
            <VListRow
              key={signal.itemId}
              title={signal.label}
              subtitle={
                t('cellar.drinkNowWindow', {
                  from: signal.windowFrom,
                  to: signal.windowTo,
                }) +
                (signal.suggestedDishes.length > 0
                  ? ` · ${t('cellar.drinkNowDishes', {
                      dishes: signal.suggestedDishes.join(', '),
                    })}`
                  : '')
              }
              onPress={() => router.push(`/item/${signal.itemId}`)}
            />
          ))}
        </VCard>
      ) : null}

      <VTextInput
        label={t('common.search')}
        value={search}
        onChangeText={setSearch}
        placeholder={t('collection.searchPlaceholder')}
        autoCapitalize="none"
      />

      {[...grouped.entries()].map(([domain, domainItems]) =>
        domainItems.length > 0 ? (
          <View key={domain} style={styles.group}>
            <VText variant="heading" tone="gold">
              {`${t(`domains.${domain}.group`)} — ${t(`domains.${domain}.name`)}`}
            </VText>
            {domainItems.map((item) => {
              const latest = latestByItem[item.id];
              const valuationFailed = failedValuationIds.has(item.id);
              return (
                <VListRow
                  key={item.id}
                  title={item.title ?? t('common.unknown')}
                  subtitle={
                    valuationFailed
                      ? t('errors.SOURCE_UNAVAILABLE')
                      : latest
                        ? formatEUR(latest.central)
                        : t('item.noValuation')
                  }
                  right={item.confidence !== null ? <ConfidenceBadge value={item.confidence} /> : undefined}
                  onPress={() => router.push(`/item/${item.id}`)}
                />
              );
            })}
          </View>
        ) : null,
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  summary: { marginVertical: velumSpacing.md },
  valuationWarning: { gap: velumSpacing.xs },
  bookActions: { gap: velumSpacing.sm, marginBottom: velumSpacing.md },
  drinkNow: { marginVertical: velumSpacing.md, gap: velumSpacing.xs },
  group: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
});
