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
  VEmptyState,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import { VListRow, VCard } from '@velum/ui';
import type { ValuationRecord, VelumDomain, VelumItem } from '@velum/core';

import { Screen } from '../../../components/Screen';
import { getVelumClient } from '../../../lib/client';
import { formatEUR } from '../../../lib/i18n';
import { getActiveDomains } from '../../../lib/features';
import { drinkNowForItems } from '../../../lib/drinkNow';
import { showToast } from '../../../stores/toastStore';
import { VButton } from '@velum/ui';

interface CollectionData {
  items: VelumItem[];
  latestByItem: Record<string, ValuationRecord | null>;
}

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

  const query = useQuery<CollectionData>({
    queryKey: ['items', 'collection'],
    queryFn: async () => {
      const items = await client.items.list();
      const latestByItem: Record<string, ValuationRecord | null> = {};
      await Promise.all(
        items.map(async (item) => {
          try {
            latestByItem[item.id] = await client.valuations.latest(item.id);
          } catch {
            latestByItem[item.id] = null;
          }
        }),
      );
      return { items, latestByItem };
    },
  });

  const items = query.data?.items ?? [];
  const latestByItem = query.data?.latestByItem ?? {};

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return items;
    return items.filter(
      (item) =>
        (item.title ?? '').toLowerCase().includes(needle) ||
        JSON.stringify(item.attributes).toLowerCase().includes(needle),
    );
  }, [items, search]);

  const { totalValue, gainLoss } = useMemo(() => {
    let total = 0;
    let acquired = 0;
    let hasAcquired = false;
    for (const item of items) {
      const latest = latestByItem[item.id];
      if (latest) total += latest.central;
      if (item.acquiredPrice !== null && latestByItem[item.id]) {
        acquired += item.acquiredPrice;
        hasAcquired = true;
      }
    }
    return { totalValue: total, gainLoss: hasAcquired ? total - acquired : null };
  }, [items, latestByItem]);

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

  return (
    <Screen>
      <VText variant="title">{t('collection.title')}</VText>

      <VCard style={styles.summary}>
        <VText variant="caption" tone="dim">
          {t('collection.totalValue')}
        </VText>
        <VText variant="title" tone="gold">
          {formatEUR(totalValue)}
        </VText>
        {gainLoss !== null ? (
          <VText variant="body" tone={gainLoss >= 0 ? 'default' : 'danger'}>
            {`${t('collection.gainLoss')} : ${gainLoss >= 0 ? '+' : ''}${formatEUR(gainLoss)}`}
          </VText>
        ) : null}
        <VText variant="caption" tone="dim">
          {t('collection.itemsCount', { count: items.length })}
        </VText>
      </VCard>

      {hasWine ? (
        <VButton
          label={t('cellar.sommelierEntry')}
          variant="secondary"
          onPress={() => router.push('/cellar-sommelier')}
          accessibilityHint={t('cellar.dishLabel')}
        />
      ) : null}

      {drinkNow.length > 0 ? (
        <VCard style={styles.drinkNow}>
          <VText variant="heading" tone="gold">
            {t('cellar.drinkNowTitle', { count: drinkNow.length })}
          </VText>
          {drinkNow.map((s) => (
            <VListRow
              key={s.itemId}
              title={s.label}
              subtitle={
                t('cellar.drinkNowWindow', { from: s.windowFrom, to: s.windowTo }) +
                (s.suggestedDishes.length > 0
                  ? ` · ${t('cellar.drinkNowDishes', { dishes: s.suggestedDishes.join(', ') })}`
                  : '')
              }
              onPress={() => router.push(`/item/${s.itemId}`)}
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
              return (
                <VListRow
                  key={item.id}
                  title={item.title ?? t('common.unknown')}
                  subtitle={latest ? formatEUR(latest.central) : t('item.noValuation')}
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
  drinkNow: { marginVertical: velumSpacing.md, gap: velumSpacing.xs },
  group: { marginTop: velumSpacing.lg, gap: velumSpacing.xs },
});
