/**
 * Arbitre patrimonial (Gold+) — pari #3 : boire, garder ou vendre ?
 *
 * Croise la fenêtre d'apogée (vin) avec la trajectoire de valorisation §7 et
 * rend un signal TOUJOURS indicatif : verdict, tendance, confiance, raisons,
 * avertissements permanents. Le garde-fou anti-market-timing vit dans le
 * moteur (@velum/valuation) et dans l'Edge Function `arbiter` — jamais ici.
 *
 * Mode démo : le client n'expose pas l'Edge `arbitrate` → repli sur le moteur
 * pur avec les données réelles du carnet démo (aucune trajectoire inventée).
 */
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VBadge,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  velumSpacing,
} from '@velum/ui';
import { isVelumError, type ArbiterSignal, type VelumItem } from '@velum/core';

import { Screen } from '../../components/Screen';
import { KV, SheetSection } from '../../components/sheets/SheetSection';
import { getVelumClient } from '../../lib/client';
import { arbiterView, demoArbiterSignal } from '../../lib/arbiterView';
import { usePlan } from '../../lib/plan';
import { errorMessage } from '../../lib/errors';

/** Payload d'analyse stocké dans attributes.analysis (même règle que la fiche). */
function analysisPayload(item: VelumItem): Record<string, unknown> | null {
  const payload = item.attributes['analysis'];
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
}

export default function ArbiterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id ?? '';
  const client = getVelumClient();
  const { entitlements, isLoading: planLoading } = usePlan();

  const itemQuery = useQuery({
    queryKey: ['items', itemId],
    queryFn: () => client.items.get(itemId),
    enabled: itemId.length > 0,
  });

  const signalQuery = useQuery<ArbiterSignal>({
    queryKey: ['arbiter', itemId],
    queryFn: async () => {
      const arbitrate = client.edge.arbitrate?.bind(client.edge);
      if (arbitrate) return arbitrate(itemId);
      // Repli démo conservateur : moteur pur, données réelles du carnet.
      const [history, item] = await Promise.all([
        client.valuations.history(itemId),
        client.items.get(itemId),
      ]);
      return demoArbiterSignal(
        history,
        item ? analysisPayload(item) : null,
        new Date().getUTCFullYear(),
      );
    },
    enabled: itemId.length > 0 && entitlements.virtualBook,
    retry: false,
  });

  // Gating Gold/Platine : droit local OU refus serveur (PLAN_REQUIRED).
  const planBlocked =
    (!planLoading && !entitlements.virtualBook) ||
    (signalQuery.isError && isVelumError(signalQuery.error) && signalQuery.error.code === 'PLAN_REQUIRED');

  if (planBlocked) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('arbiter.title')}
            message={t('arbiter.planRequired')}
            action={{ label: t('cellar.seeOffers'), onPress: () => router.push('/paywall') }}
          />
        </View>
      </Screen>
    );
  }

  if (planLoading || signalQuery.isLoading || itemQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (signalQuery.isError) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('arbiter.title')}
            message={errorMessage(signalQuery.error, t)}
            action={{ label: t('common.retry'), onPress: () => void signalQuery.refetch() }}
          />
        </View>
      </Screen>
    );
  }

  const signal = signalQuery.data;
  if (!signal) return null;
  const view = arbiterView(signal);
  const item = itemQuery.data ?? null;

  return (
    <Screen>
      <VText variant="title">{t('arbiter.title')}</VText>
      {item?.title ? (
        <VText variant="body" tone="dim">
          {item.title}
        </VText>
      ) : null}

      <VCard>
        <View style={styles.verdictRow}>
          <VBadge label={t(view.verdictKey)} tone={view.verdictTone} />
          <ConfidenceBadge value={view.confidence} />
        </View>
        <KV label={t('arbiter.trendLabel')} value={t(view.trendKey)} />
        {view.sellWindow ? (
          <VText variant="body" tone="gold" accessibilityLabel={t('arbiter.sellWindow')}>
            {t('arbiter.sellWindow')}
          </VText>
        ) : null}
      </VCard>

      <SheetSection title={t('arbiter.reasonsTitle')}>
        {view.reasons.length > 0 ? (
          view.reasons.map((reason, i) => (
            <VText key={i} variant="body">
              •  {reason}
            </VText>
          ))
        ) : (
          <VText variant="body" tone="dim">
            {t('arbiter.noReasons')}
          </VText>
        )}
      </SheetSection>

      {/* Avertissements PERMANENTS — jamais un conseil d'investissement. */}
      <SheetSection title={t('item.disclaimersTitle')}>
        <VText variant="caption" tone="gold">
          {t('arbiter.disclaimerIndicative')}
        </VText>
        <VText variant="caption" tone="gold">
          {t('arbiter.disclaimerOwner')}
        </VText>
      </SheetSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: velumSpacing.xl },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
});
