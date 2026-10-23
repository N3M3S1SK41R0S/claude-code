/**
 * Commande sous séquestre (achat OU vente) : état, montant, pseudonyme de
 * l'autre partie, commission figée (vendeur), suivi, et SEULES les actions
 * légales pour mon rôle (payer, expédier avec suivi, confirmer la réception,
 * litige, annuler — lib/marketState, miroir du trigger serveur) ; demande
 * d'expertise d'un commun accord avant expédition. Fil de messages anonymisé
 * dépliable.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError, type EscrowState, type MarketOrder } from '@velum/core';
import { VBadge, VButton, VCard, VText, VTextInput, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { formatDate } from '../../lib/i18n';
import { formatPrice, formatRate, orderCommission } from '../../lib/marketForms';
import {
  ESCROW_TONE,
  PRIMARY_ORDER_ACTIONS,
  canRequestOrderCertification,
  hasOpenCertificationOn,
  marketLabelKeys,
  orderActionTarget,
  orderActions,
  type OrderAction,
} from '../../lib/marketState';
import { showToast } from '../../stores/toastStore';
import { MessageThread } from './MessageThread';
import { ShipPanel, type Shipment } from './ShipPanel';
import { Notice } from './controls';
import { useInvalidateCommunity, useMarketErrorToast, useMyCertifications } from './hooks';

type Panel = 'ship' | 'dispute' | 'cancel' | null;

interface AdvanceInput {
  action: OrderAction;
  /** Expédition : suivi et transporteur choisi, rien d'autre. */
  shipment?: Shipment;
}

const CLOSED: ReadonlySet<EscrowState> = new Set(['released', 'refunded', 'cancelled']);

export function OrderCard({ order }: { order: MarketOrder }) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState('');
  const [showThread, setShowThread] = useState(false);
  const certifications = useMyCertifications();

  const related = (certifications.data ?? []).filter((c) => c.orderId === order.id);
  // Expertise ouverte (même un accord attendu) : le serveur bloque l'expédition.
  const hasOpenCertification = hasOpenCertificationOn(related, { orderId: order.id });
  const actions = orderActions(order, { hasOpenCertification });
  const isSeller = order.role === 'seller';
  const shipBlocked = isSeller && order.escrowState === 'funds_held' && hasOpenCertification;
  // Expertise d'un commun accord : demandée SUR LA COMMANDE, avant expédition
  // (seul contexte accepté par le serveur hors vendeur). Mes demandes lues
  // d'abord, pour ne jamais proposer un doublon.
  const canAskCertification =
    certifications.data !== undefined &&
    !order.certificationRequired &&
    canRequestOrderCertification(order, related);

  const askCertification = useMutation({
    mutationFn: () =>
      client.marketplace.requestCertification({ reason: 'mutual_agreement', orderId: order.id, feePayer: 'split' }),
    onSuccess: () => {
      showToast(t('community.order.certificationAsked'), 'success');
      invalidate();
    },
    onError,
  });

  const advance = useMutation({
    mutationFn: async ({ action, shipment }: AdvanceInput) => {
      const target = orderActionTarget(order.escrowState, action);
      if (target === null) throw new VelumError('INVALID_INPUT', 'Action impossible dans cet état');
      if (action === 'ship') {
        if (shipment === undefined) throw new VelumError('INVALID_INPUT', 'Numéro de suivi requis');
        // Suivi + transporteur seulement : la livraison est attestée par
        // l'acheteur (ou le transporteur), jamais par le vendeur (guard_order_terms).
        return client.marketplace.advanceOrder(order.id, target, shipment);
      }
      return client.marketplace.advanceOrder(order.id, target);
    },
    onSuccess: (_updated, { action }) => {
      setPanel(null);
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

  const busy = advance.isPending || dispute.isPending || askCertification.isPending;
  const title = order.listingTitle ?? t('common.unknown');
  const roleLabel = isSeller ? t('community.asSeller') : t('community.asBuyer');
  // Au centime, comme l'écriture du registre à la libération (jamais 1,034999… €).
  const commission = orderCommission(order);

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
      {shipBlocked ? (
        <Notice tone="warning">{t('community.order.shipBlocked')}</Notice>
      ) : null}
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
              <ShipPanel
                key={action}
                onConfirm={(shipment) => advance.mutate({ action: 'ship', shipment })}
                onCancel={() => setPanel(null)}
                loading={advance.isPending}
                disabled={busy}
              />
            ) : (
              <VButton key={action} label={t('community.ship')} onPress={() => setPanel('ship')} />
            )
          ) : (
            <VButton
              key={action}
              label={t(action === 'pay' ? 'community.pay' : 'community.confirmReceipt')}
              onPress={() => advance.mutate({ action })}
              disabled={busy}
              loading={advance.isPending && advance.variables?.action === action}
              accessibilityHint={action === 'pay' ? t('community.escrowHint') : t('community.confirmReceiptHint')}
            />
          ),
        )}

      {canAskCertification ? (
        <>
          <VText variant="caption" tone="dim">
            {t('community.order.certificationOptional')}
          </VText>
          <VButton
            label={t('community.listing.askCertification')}
            variant="ghost"
            onPress={() => askCertification.mutate()}
            disabled={busy}
            loading={askCertification.isPending}
          />
        </>
      ) : null}

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
              onPress={() => advance.mutate({ action: 'cancel' })}
              disabled={busy}
              loading={advance.isPending && advance.variables?.action === 'cancel'}
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
