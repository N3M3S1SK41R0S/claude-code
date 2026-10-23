/**
 * Hub « Échanges & ventes » (Platine) — spec COMMUNITY_MARKETPLACE.md.
 *  - Catalogue : une plateforme par catégorie, vente / échange, recherche et
 *    filtres ; annonces anonymisées (pseudonymes).
 *  - Mon activité : annonces, achats & ventes sous séquestre, échanges,
 *    certifications — ce qui attend mon action en tête.
 * URL : routes.community(domain?, mode?, text?) ; `tab=activity` ouvre
 * directement « Mon activité ». Les transitions sont validées côté serveur.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { VelumDomain } from '@velum/core';
import { VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../components/Screen';
import { CatalogueView } from '../../components/market/CatalogueView';
import { CommunityGate } from '../../components/market/CommunityGate';
import { Segmented } from '../../components/market/controls';
import { useMyCertifications, useMyExchanges, useMyOrders } from '../../components/market/hooks';
import { MyActivity } from '../../components/market/MyActivity';
import { parseCommunityParams, type CatalogueMode, type CommunityTab } from '../../lib/marketQuery';
import { pendingActionCount } from '../../lib/marketState';
import { routes } from '../../lib/routes';

function CommunityHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = parseCommunityParams(useLocalSearchParams());
  const [tab, setTab] = useState<CommunityTab>(params.tab);

  // Pastille « Mon activité » : éléments qui attendent mon action (pannes ignorées ici,
  // elles sont signalées dans l'onglet lui-même).
  const orders = useMyOrders();
  const exchanges = useMyExchanges();
  const certifications = useMyCertifications();
  const toDo = pendingActionCount({
    orders: orders.data,
    exchanges: exchanges.data,
    certifications: certifications.data,
  });

  const changeTab = (next: CommunityTab) => {
    setTab(next);
    router.setParams({ tab: next === 'activity' ? 'activity' : undefined });
  };

  const syncParams = useCallback(
    (p: { domain: VelumDomain | null; mode: CatalogueMode; text: string }) => {
      router.setParams({
        domain: p.domain ?? undefined,
        mode: p.mode === 'all' ? undefined : p.mode,
        text: p.text.trim().length > 0 ? p.text.trim() : undefined,
      });
    },
    [router],
  );

  return (
    <Screen title={t('community.title')} backFallback={routes.market()}>
      <View style={styles.head}>
        <VText variant="caption" tone="dim">
          {t('community.intro')}
        </VText>
        <Segmented<CommunityTab>
          value={tab}
          onChange={changeTab}
          accessibilityLabel={t('community.tabsLabel')}
          options={[
            { value: 'catalogue', label: t('community.catalogue') },
            { value: 'activity', label: t('community.activity.title'), badge: toDo },
          ]}
        />
      </View>
      {tab === 'catalogue' ? (
        <CatalogueView
          initialDomain={params.domain}
          initialMode={params.mode}
          initialText={params.text}
          onParamsChange={syncParams}
        />
      ) : (
        <MyActivity />
      )}
    </Screen>
  );
}

export default function Community() {
  const { t } = useTranslation();
  return (
    <CommunityGate title={t('community.title')} backFallback={routes.market()}>
      <CommunityHub />
    </CommunityGate>
  );
}

const styles = StyleSheet.create({
  head: { gap: velumSpacing.md, marginBottom: velumSpacing.md },
});
