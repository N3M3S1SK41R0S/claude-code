/**
 * Cartes de « Mon activité » : mes annonces (statut, retrait — sauf annonce
 * réservée), mes échanges (résumé cliquable vers le détail) et mes
 * certifications (accord mutuel, annulation selon motif et contexte, statut,
 * frais). Actions limitées à celles que le serveur accepte pour moi.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CertificationRequest, ExchangeProposal, ListingRecord } from '@velum/core';
import { VBadge, VButton, VCard, VText, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { formatDate } from '../../lib/i18n';
import { formatPrice, formatRate } from '../../lib/marketForms';
import {
  CERTIFICATION_TONE,
  EXCHANGE_TONE,
  LISTING_STATUS_TONE,
  PRIMARY_EXCHANGE_ACTIONS,
  canWithdrawListing,
  certificationActions,
  exchangeActions,
  isForSale,
  marketLabelKeys,
} from '../../lib/marketState';
import { showToast } from '../../stores/toastStore';
import { ListingBadges } from './ListingCard';
import { Notice } from './controls';
import { useInvalidateCommunity, useMarketErrorToast } from './hooks';

// ── Mes annonces ─────────────────────────────────────────────────────────────

export function MyListingCard({
  listing,
  onOpen,
  engaged = false,
}: {
  listing: ListingRecord;
  onOpen: () => void;
  /** Réservée par une transaction en cours (lib/marketState `myListingEngaged`). */
  engaged?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const [confirming, setConfirming] = useState(false);

  const withdraw = useMutation({
    mutationFn: () => client.marketplace.withdrawListing(listing.id),
    onSuccess: () => {
      setConfirming(false);
      showToast(t('community.activity.withdrawn'), 'success');
      invalidate();
    },
    onError,
  });

  const title = listing.title ?? t('common.unknown');
  return (
    <VCard style={styles.card}>
      <View style={styles.rowBetween}>
        <VText variant="body" tone="gold" style={styles.flex} numberOfLines={2}>
          {title}
        </VText>
        <View style={styles.right}>
          <VText variant="heading" tabularNums>
            {formatPrice(listing.askPrice, i18n.language, listing.currency)}
          </VText>
          <VText variant="caption" tone="dim">
            {isForSale(listing.kind) ? t('community.price') : t('community.declaredValue')}
          </VText>
        </View>
      </View>
      <View style={styles.badges}>
        <VBadge tone={LISTING_STATUS_TONE[listing.status]} label={t(marketLabelKeys.listingStatus(listing.status))} />
      </View>
      <ListingBadges kind={listing.kind} certified={listing.certified} domain={listing.domain} />
      {listing.status === 'pending_certification' ? (
        <Notice tone="warning">{t('community.activity.pendingCertification')}</Notice>
      ) : null}
      {listing.status === 'draft' ? <Notice tone="warning">{t('community.activity.draftHint')}</Notice> : null}
      {engaged ? <Notice>{t('community.activity.engaged')}</Notice> : null}
      <VText variant="caption" tone="dim">
        {t('community.activity.listedOn', {
          date: formatDate(listing.createdAt),
          rate: formatRate(listing.commissionRate, i18n.language),
        })}
      </VText>
      {listing.status === 'active' ? (
        <VButton label={t('community.activity.viewListing')} variant="secondary" onPress={onOpen} />
      ) : null}
      {canWithdrawListing(listing.status, engaged) ? (
        confirming ? (
          <View style={styles.panel}>
            <VText variant="body">{t('community.activity.withdrawConfirm')}</VText>
            <VButton
              label={t('community.activity.withdrawYes')}
              variant="danger"
              onPress={() => withdraw.mutate()}
              loading={withdraw.isPending}
            />
            <VButton label={t('community.keep')} variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <VButton label={t('community.activity.withdraw')} variant="ghost" onPress={() => setConfirming(true)} />
        )
      ) : null}
    </VCard>
  );
}

// ── Mes échanges ─────────────────────────────────────────────────────────────

export function ExchangeSummaryCard({
  exchange,
  onOpen,
  hasOpenCertification = false,
}: {
  exchange: ExchangeProposal;
  onOpen: () => void;
  /** Expertise ouverte : l'expédition attend l'expert (pas « à traiter »). */
  hasOpenCertification?: boolean;
}) {
  const { t } = useTranslation();
  const toDo = exchangeActions(exchange, { hasOpenCertification, now: new Date().toISOString() }).some((a) =>
    PRIMARY_EXCHANGE_ACTIONS.has(a),
  );
  const mineTitle = (exchange.role === 'proposer' ? exchange.offeredTitle : exchange.listingTitle) ?? t('common.unknown');
  const theirTitle = (exchange.role === 'proposer' ? exchange.listingTitle : exchange.offeredTitle) ?? t('common.unknown');
  const roleLabel = exchange.role === 'proposer' ? t('community.exchange.sent') : t('community.exchange.received');
  const stateLabel = t(marketLabelKeys.exchange(exchange.state));
  const summary = t('community.exchange.summary', { mine: mineTitle, theirs: theirTitle });
  return (
    <VCard
      onPress={onOpen}
      tone={toDo ? 'gilded' : 'default'}
      style={styles.card}
      accessibilityLabel={`${roleLabel}, ${summary}, ${stateLabel}${toDo ? `, ${t('community.toDo')}` : ''}`}
      accessibilityHint={t('community.exchange.openHint')}
    >
      <VText variant="body" tone="gold">
        {summary}
      </VText>
      <View style={styles.badges}>
        <VBadge tone={exchange.role === 'recipient' ? 'gold' : 'neutral'} label={roleLabel} />
        <VBadge tone={EXCHANGE_TONE[exchange.state]} label={stateLabel} />
        {toDo ? <VBadge tone="warning" label={t('community.toDo')} /> : null}
      </View>
      <VText variant="caption" tone="dim">
        {t('community.exchange.withAlias', { alias: exchange.counterpartyAlias })} · {formatDate(exchange.updatedAt)}
      </VText>
    </VCard>
  );
}

// ── Mes certifications ───────────────────────────────────────────────────────

export function CertificationCard({ certification }: { certification: CertificationRequest }) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const actions = certificationActions(certification);

  const respond = useMutation({
    mutationFn: (agree: boolean) => client.marketplace.respondCertification(certification.id, agree),
    onSuccess: (_r, agree) => {
      showToast(t(agree ? 'community.certification.agreed' : 'community.certification.refused'), 'success');
      invalidate();
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: () => client.marketplace.cancelCertification(certification.id),
    onSuccess: () => {
      setConfirmCancel(false);
      showToast(t('community.certification.cancelled'), 'success');
      invalidate();
    },
    onError,
  });
  const busy = respond.isPending || cancel.isPending;

  return (
    <VCard style={styles.card} tone={actions.includes('agree') ? 'gilded' : 'default'}>
      <VText variant="body" tone="gold" numberOfLines={2}>
        {certification.itemTitle ?? t('common.unknown')}
      </VText>
      <View style={styles.badges}>
        <VBadge
          tone={CERTIFICATION_TONE[certification.status]}
          label={t(marketLabelKeys.certification(certification.status))}
        />
        <VBadge tone="neutral" label={t(marketLabelKeys.certificationReason(certification.reason))} />
      </View>
      <VText variant="caption" tone="dim">
        {t(marketLabelKeys.feePayer(certification.feePayer))}
        {certification.feeAmount !== null
          ? ` · ${t('community.certification.fee', { amount: formatPrice(certification.feeAmount, i18n.language) })}`
          : ` · ${t('community.certification.feePending')}`}
      </VText>
      <VText variant="caption" tone="dim">
        {certification.requestedByMe
          ? t('community.certification.byMe', { date: formatDate(certification.createdAt) })
          : t('community.certification.byOther', { date: formatDate(certification.createdAt) })}
      </VText>
      {certification.expertNote ? <Notice title={t('community.certification.expertNote')}>{certification.expertNote}</Notice> : null}

      {actions.includes('agree') ? (
        <>
          <VText variant="body">{t('community.certification.agreePrompt')}</VText>
          <VButton
            label={t('community.certification.agree')}
            onPress={() => respond.mutate(true)}
            disabled={busy}
            loading={respond.isPending && respond.variables === true}
          />
          <VButton
            label={t('community.certification.refuse')}
            variant="ghost"
            onPress={() => respond.mutate(false)}
            disabled={busy}
            loading={respond.isPending && respond.variables === false}
          />
        </>
      ) : null}
      {actions.includes('cancel') ? (
        confirmCancel ? (
          <View style={styles.panel}>
            <VText variant="body">
              {certification.reason === 'threshold' &&
              certification.listingId !== null &&
              certification.orderId === null &&
              certification.exchangeId === null
                ? t('community.certification.cancelThresholdConfirm')
                : t('community.certification.cancelConfirm')}
            </VText>
            <VButton
              label={t('community.certification.cancelYes')}
              variant="danger"
              onPress={() => cancel.mutate()}
              disabled={busy}
              loading={cancel.isPending}
            />
            <VButton label={t('community.keep')} variant="ghost" onPress={() => setConfirmCancel(false)} />
          </View>
        ) : (
          <VButton label={t('community.certification.cancel')} variant="ghost" onPress={() => setConfirmCancel(true)} />
        )
      ) : null}
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: velumSpacing.sm },
  right: { alignItems: 'flex-end' },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  panel: { gap: velumSpacing.sm },
});
