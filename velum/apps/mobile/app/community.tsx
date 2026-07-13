/**
 * Communauté marchande à séquestre (Platine) — spec COMMUNITY_MARKETPLACE.md.
 *  - Catalogue : annonces actives d'autres collectionneurs (achat → séquestre).
 *  - Mes transactions : commandes (acheteur/vendeur) avec leur état de séquestre
 *    et l'action contextuelle (payer, expédier, confirmer, litige).
 * Les transitions sont VALIDÉES côté serveur (trigger 0006) : l'UI ne fait que
 * proposer les actions légales. Le paiement réel (Stripe Connect) se branche
 * derrière « Payer » / « Confirmer » — ici séquestre applicatif.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  VBadge,
  VButton,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import type { EscrowState, MarketOrder } from '@velum/core';

import { Screen } from '../components/Screen';
import { getVelumClient } from '../lib/client';
import { errorMessage } from '../lib/errors';
import { usePlan } from '../lib/plan';
import { formatEUR } from '../lib/i18n';
import { showToast } from '../stores/toastStore';

/** Tonalité du badge d'état de séquestre. */
const STATE_TONE: Record<EscrowState, 'gold' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  pending_payment: 'warning',
  funds_held: 'gold',
  shipped: 'gold',
  released: 'success',
  refunded: 'neutral',
  disputed: 'danger',
  cancelled: 'neutral',
};

export default function Community() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const { entitlements, isLoading: planLoading } = usePlan();

  const [shipFor, setShipFor] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => client.profile.get() });
  const uid = meQuery.data?.id ?? null;

  const catalogueQuery = useQuery({
    queryKey: ['community', 'catalogue'],
    queryFn: () => client.marketplace.browseActive(),
    enabled: entitlements.community,
  });
  const ordersQuery = useQuery({
    queryKey: ['community', 'orders'],
    queryFn: () => client.marketplace.myOrders(),
    enabled: entitlements.community,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['community'] });
  };
  const onError = (error: unknown) => showToast(errorMessage(error, t), 'danger');

  const buy = useMutation({
    mutationFn: (listingId: string) => client.marketplace.buy(listingId),
    onSuccess: () => {
      showToast(t('community.bought'), 'success');
      invalidate();
    },
    onError,
  });
  const advance = useMutation({
    mutationFn: (v: { id: string; state: EscrowState; trackingNumber?: string }) =>
      client.marketplace.advanceOrder(v.id, v.state, v.trackingNumber ? { trackingNumber: v.trackingNumber, deliveredAt: new Date().toISOString() } : undefined),
    onSuccess: () => {
      setShipFor(null);
      setTracking('');
      invalidate();
    },
    onError,
  });
  const dispute = useMutation({
    mutationFn: (v: { id: string; reason: string }) => client.marketplace.openDispute(v.id, v.reason),
    onSuccess: () => {
      setDisputeFor(null);
      setReason('');
      showToast(t('community.disputeOpened'), 'info');
      invalidate();
    },
    onError,
  });

  if (planLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (!entitlements.community) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('community.title')}
            message={t('community.planRequired')}
            action={{ label: t('cellar.seeOffers'), onPress: () => router.push('/paywall') }}
          />
        </View>
      </Screen>
    );
  }

  const catalogue = (catalogueQuery.data ?? []).filter((l) => l.sellerId !== uid);
  const orders = ordersQuery.data ?? [];

  const roleOf = (o: MarketOrder): 'buyer' | 'seller' => (o.buyerId === uid ? 'buyer' : 'seller');

  return (
    <Screen>
      <VText variant="title">{t('community.title')}</VText>
      <VText variant="body" tone="dim">
        {t('community.intro')}
      </VText>

      {/* Catalogue */}
      <VText variant="heading" tone="gold" style={styles.h}>
        {t('community.catalogue')}
      </VText>
      {catalogueQuery.isLoading ? (
        <VSpinner />
      ) : catalogue.length === 0 ? (
        <VText variant="body" tone="dim">
          {t('community.catalogueEmpty')}
        </VText>
      ) : (
        catalogue.map((l) => (
          <VCard key={l.id} tone="gilded" style={styles.card}>
            <View style={styles.rowBetween}>
              <VText variant="heading" tone="gold" style={styles.flex}>
                {l.title ?? t('common.unknown')}
              </VText>
              <VText variant="heading" tabularNums>
                {formatEUR(l.askPrice)}
              </VText>
            </View>
            <View style={styles.badges}>
              {l.domain ? <VBadge tone="neutral" label={t(`domains.${l.domain}.name`)} /> : null}
              <VBadge tone="success" label={t('community.authenticated')} />
            </View>
            <VButton
              label={t('community.buy')}
              onPress={() => buy.mutate(l.id)}
              loading={buy.isPending}
              accessibilityHint={t('community.escrowHint')}
            />
          </VCard>
        ))
      )}

      {/* Mes transactions */}
      <VText variant="heading" tone="gold" style={styles.h}>
        {t('community.myOrders')}
      </VText>
      {orders.length === 0 ? (
        <VText variant="body" tone="dim">
          {t('community.ordersEmpty')}
        </VText>
      ) : (
        orders.map((o) => {
          const role = roleOf(o);
          return (
            <VCard key={o.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <VText variant="body" style={styles.flex}>
                  {t(role === 'buyer' ? 'community.asBuyer' : 'community.asSeller')}
                </VText>
                <VText variant="body" tabularNums>
                  {formatEUR(o.amount)}
                </VText>
              </View>
              <VBadge tone={STATE_TONE[o.escrowState]} label={t(`community.state.${o.escrowState}`)} />

              {/* Action contextuelle selon l'état et le rôle. */}
              {o.escrowState === 'pending_payment' && role === 'buyer' ? (
                <VButton
                  label={t('community.pay')}
                  onPress={() => advance.mutate({ id: o.id, state: 'funds_held' })}
                  loading={advance.isPending}
                />
              ) : null}

              {o.escrowState === 'funds_held' && role === 'seller' ? (
                shipFor === o.id ? (
                  <>
                    <VTextInput
                      label={t('community.trackingLabel')}
                      value={tracking}
                      onChangeText={setTracking}
                      placeholder="XY123456789FR"
                    />
                    <VButton
                      label={t('community.confirmShip')}
                      onPress={() =>
                        advance.mutate({ id: o.id, state: 'shipped', trackingNumber: tracking.trim() })
                      }
                      disabled={tracking.trim().length === 0}
                      loading={advance.isPending}
                    />
                  </>
                ) : (
                  <VButton label={t('community.ship')} onPress={() => setShipFor(o.id)} />
                )
              ) : null}

              {o.escrowState === 'shipped' && role === 'buyer' ? (
                <VButton
                  label={t('community.confirmReceipt')}
                  onPress={() => advance.mutate({ id: o.id, state: 'released' })}
                  loading={advance.isPending}
                />
              ) : null}

              {(o.escrowState === 'funds_held' || o.escrowState === 'shipped') && role === 'buyer' ? (
                disputeFor === o.id ? (
                  <>
                    <VTextInput
                      label={t('community.disputeReason')}
                      value={reason}
                      onChangeText={setReason}
                      placeholder={t('community.disputePlaceholder')}
                    />
                    <VButton
                      label={t('community.openDispute')}
                      variant="danger"
                      onPress={() => dispute.mutate({ id: o.id, reason: reason.trim() })}
                      disabled={reason.trim().length === 0}
                      loading={dispute.isPending}
                    />
                  </>
                ) : (
                  <VButton label={t('community.reportProblem')} variant="ghost" onPress={() => setDisputeFor(o.id)} />
                )
              ) : null}

              {o.trackingNumber ? (
                <VText variant="caption" tone="dim">
                  {t('community.tracking', { number: o.trackingNumber })}
                </VText>
              ) : null}
            </VCard>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  h: { marginTop: velumSpacing.xl },
  card: { gap: velumSpacing.sm, marginTop: velumSpacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: velumSpacing.sm },
  badges: { flexDirection: 'row', gap: velumSpacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
});
