/**
 * Commande sous séquestre (achat OU vente) : état, montant, pseudonyme de
 * l'autre partie, commission figée (vendeur), suivi, et SEULES les actions
 * légales pour mon rôle (payer, expédier avec suivi, confirmer la réception,
 * litige, annuler — lib/marketState, miroir du trigger serveur). Fil de
 * messages anonymisé dépliable.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError, type EscrowState, type MarketOrder } from '@velum/core';
import { VBadge, VButton, VCard, VText, VTextInput, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { formatDate } from '../../lib/i18n';
import { formatPrice, formatRate } from '../../lib/marketForms';
import {
  ESCROW_TONE,
  PRIMARY_ORDER_ACTIONS,
  marketLabelKeys,
  orderActionTarget,
  orderActions,
  type OrderAction,
} from '../../lib/marketState';
import { showToast } from '../../stores/toastStore';
import { MessageThread } from './MessageThread';
import { useInvalidateCommunity, useMarketErrorToast } from './hooks';

type Panel = 'ship' | 'dispute' | 'cancel' | null;

const CLOSED: ReadonlySet<EscrowState> = new Set(['released', 'refunded', 'cancelled']);

export function OrderCard({ order }: { order: MarketOrder }) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [reason, setReason] = useState('');
  const [showThread, setShowThread] = useState(false);

  const actions = orderActions(order);
  const isSeller = order.role === 'seller';

  const advance = useMutation({
    mutationFn: async (action: OrderAction) => {
      const target = orderActionTarget(order.escrowState, action);
      if (target === null) throw new VelumError('INVALID_INPUT', 'Action impossible dans cet état');
      if (action === 'ship') {
        // Sans intégration transporteur, la remise est datée à l'expédition :
        // le délai d'auto-libération (ESCROW_RELEASE_DAYS) part de là.
        return client.marketplace.advanceOrder(order.id, target, {
          trackingNumber: tracking.trim(),
          ...(carrier.trim().length > 0 ? { carrier: carrier.trim() } : {}),
          deliveredAt: new Date().toISOString(),
        });
      }
      return client.marketplace.advanceOrder(order.id, target);
    },
    onSuccess: (_updated, action) => {
      setPanel(null);
      setTracking('');
      setCarrier('');
      showToast(t(`community.order.done.${action}`), 'success');
      invalidate();
    },
    onError,
  });

  const dispute = useMutation({
    mutationFn: () => client.marketplace.openDispute(order.id, reason.trim()),
    onSuccess: () => {
      setPanel(null);
      setReason('');
      showToast(t('community.disputeOpened'), 'info');
      invalidate();
    },
    onError,
  });

  const busy = advance.isPending || dispute.isPending;
  const title = order.listingTitle ?? t('common.unknown');
  const roleLabel = isSeller ? t('community.asSeller') : t('community.asBuyer');
  const commission = order.amount * order.commissionRate;

  return (
    <VCard style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <VText variant="body" tone="gold" numberOfLines={2}>
            {title}
          </VText>
          <VText variant="caption" tone="dim">
            {t('community.order.with', { role: roleLabel, alias: order.counterpartyAlias })} · {formatDate(order.createdAt)}
          </VText>
        </View>
        <VText variant="heading" tabularNums>
          {formatPrice(order.amount, i18n.language, order.currency)}
        </VText>
      </View>
      <View style={styles.badges}>
        <VBadge tone={ESCROW_TONE[order.escrowState]} label={t(marketLabelKeys.escrow(order.escrowState))} />
        {order.certificationRequired ? <VBadge tone="gold" label={t('community.order.certified')} /> : null}
      </View>

      <VText variant="caption" tone="dim">
        {t(`community.order.hint.${order.escrowState}.${order.role}`)}
      </VText>
      {isSeller ? (
        <VText variant="caption" tone="dim">
          {t('community.order.commission', {
            rate: formatRate(order.commissionRate, i18n.language),
            amount: formatPrice(commission, i18n.language),
          })}
        </VText>
      ) : null}
      {order.trackingNumber ? (
        <VText variant="caption" tone="dim" selectable>
          {order.carrier
            ? t('community.trackingWithCarrier', { carrier: order.carrier, number: order.trackingNumber })
            : t('community.tracking', { number: order.trackingNumber })}
        </VText>
      ) : null}

      {/* Actions principales d'abord. */}
      {actions
        .filter((a) => PRIMARY_ORDER_ACTIONS.has(a))
        .map((action) =>
          action === 'ship' ? (
            panel === 'ship' ? (
              <View key={action} style={styles.panel}>
                <VTextInput
                  label={t('community.trackingLabel')}
                  value={tracking}
                  onChangeText={setTracking}
                  placeholder="XY123456789FR"
                  autoCapitalize="characters"
                />
                <VTextInput
                  label={t('community.carrierLabel')}
                  value={carrier}
                  onChangeText={setCarrier}
                  placeholder={t('community.carrierPlaceholder')}
                />
                <VButton
                  label={t('community.confirmShip')}
                  onPress={() => advance.mutate('ship')}
                  disabled={tracking.trim().length === 0 || busy}
                  loading={advance.isPending}
                />
                <VButton label={t('common.cancel')} variant="ghost" onPress={() => setPanel(null)} />
              </View>
            ) : (
              <VButton key={action} label={t('community.ship')} onPress={() => setPanel('ship')} />
            )
          ) : (
            <VButton
              key={action}
              label={t(action === 'pay' ? 'community.pay' : 'community.confirmReceipt')}
              onPress={() => advance.mutate(action)}
              disabled={busy}
              loading={advance.isPending && advance.variables === action}
              accessibilityHint={action === 'pay' ? t('community.escrowHint') : t('community.confirmReceiptHint')}
            />
          ),
        )}

      {actions.includes('dispute') ? (
        panel === 'dispute' ? (
          <View style={styles.panel}>
            <VTextInput
              label={t('community.disputeReason')}
              value={reason}
              onChangeText={setReason}
              placeholder={t('community.disputePlaceholder')}
              autoCapitalize="sentences"
            />
            <VButton
              label={t('community.openDispute')}
              variant="danger"
              onPress={() => dispute.mutate()}
              disabled={reason.trim().length === 0 || busy}
              loading={dispute.isPending}
            />
            <VButton label={t('common.cancel')} variant="ghost" onPress={() => setPanel(null)} />
          </View>
        ) : (
          <VButton label={t('community.reportProblem')} variant="ghost" onPress={() => setPanel('dispute')} />
        )
      ) : null}

      {actions.includes('cancel') ? (
        panel === 'cancel' ? (
          <View style={styles.panel}>
            <VText variant="body">{t('community.order.cancelConfirm')}</VText>
            <VButton
              label={t('community.order.cancelYes')}
              variant="danger"
              onPress={() => advance.mutate('cancel')}
              disabled={busy}
              loading={advance.isPending && advance.variables === 'cancel'}
            />
            <VButton label={t('community.keep')} variant="ghost" onPress={() => setPanel(null)} />
          </View>
        ) : (
          <VButton label={t('community.order.cancel')} variant="ghost" onPress={() => setPanel('cancel')} />
        )
      ) : null}

      <VButton
        label={showThread ? t('community.thread.hide') : t('community.thread.show')}
        variant="ghost"
        onPress={() => setShowThread((v) => !v)}
      />
      {showThread ? (
        <MessageThread kind="order" threadId={order.id} readOnly={CLOSED.has(order.escrowState)} />
      ) : null}
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: velumSpacing.sm },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  panel: { gap: velumSpacing.sm },
});
