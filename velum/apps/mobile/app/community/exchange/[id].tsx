/**
 * Détail d'un échange (routes.exchange) : ce que je cède / reçois, soulte,
 * commission FIGÉE à l'acceptation (myCommission), frise d'états, statut de
 * certification, suivis d'expédition, et SEULES les actions légales pour mon
 * rôle × l'état (lib/marketState) : accepter / refuser, retirer, annuler,
 * expédier avec n° de suivi, confirmer la réception, litige. Fil anonymisé.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ExchangeProposal } from '@velum/core';
import { VBadge, VButton, VCard, VEmptyState, VSpinner, VText, VTextInput, velumSpacing } from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { CertificationCard } from '../../../components/market/ActivityCards';
import { CommunityGate } from '../../../components/market/CommunityGate';
import { ExchangeTimeline } from '../../../components/market/ExchangeTimeline';
import { MessageThread } from '../../../components/market/MessageThread';
import { ShipPanel, type Shipment } from '../../../components/market/ShipPanel';
import { AmountRows, AsyncBlock, Notice, type AmountRow } from '../../../components/market/controls';
import {
  useCommissionBasis,
  useInvalidateCommunity,
  useMarketErrorToast,
  useMyCertifications,
  useMyExchanges,
} from '../../../components/market/hooks';
import { getVelumClient } from '../../../lib/client';
import { formatDate } from '../../../lib/i18n';
import { commissionBasisNoticeKey, exchangeCommissionAt } from '../../../lib/marketCommission';
import { formatPrice, formatRate } from '../../../lib/marketForms';
import { communityActivityHref, stringParam } from '../../../lib/marketQuery';
import {
  EXCHANGE_TONE,
  canRequestExchangeCertification,
  exchangeActions,
  hasOpenCertificationOn,
  isClosed,
  isExchangeExpired,
  marketLabelKeys,
  myCashPayment,
  myCededValue,
  myReceived,
  myTracking,
  theirReceived,
  theirTracking,
  type ExchangeAction,
} from '../../../lib/marketState';
import { routes } from '../../../lib/routes';
import { showToast } from '../../../stores/toastStore';

type Panel = 'ship' | 'dispute' | 'decline' | 'withdraw' | 'cancel' | null;

function ExchangeActions({
  exchange,
  hasOpenCertification,
}: {
  exchange: ExchangeProposal;
  /** Expertise ouverte : le serveur bloque l'expédition (has_open_certification). */
  hasOpenCertification: boolean;
}) {
  const { t, i18n } = useTranslation();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  // Taux ACTUEL du serveur (figé à l'acceptation), taux maximal en repli.
  const commission = useCommissionBasis();
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState('');
  const now = new Date().toISOString();
  // Proposition échue (même avant le passage du cron) : « Accepter » masqué.
  const actions = exchangeActions(exchange, { hasOpenCertification, now });
  const expired = isExchangeExpired(exchange, now);
  const shipBlocked = exchange.state === 'shipping' && hasOpenCertification && myTracking(exchange) === null;
  const deadline =
    exchange.state === 'proposed' && typeof exchange.expiresAt === 'string' ? (
      <VText variant="caption" tone={expired ? 'danger' : 'dim'} accessibilityLiveRegion="polite">
        {expired
          ? t('community.exchange.expiredOn', { date: formatDate(exchange.expiresAt) })
          : t('community.exchange.expiresOn', { date: formatDate(exchange.expiresAt) })}
      </VText>
    ) : null;

  const run = useMutation({
    mutationFn: (action: Exclude<ExchangeAction, 'ship'>) => {
      const m = client.marketplace;
      switch (action) {
        case 'accept':
          return m.respondExchange(exchange.id, true);
        case 'decline':
          return m.respondExchange(exchange.id, false);
        case 'withdraw':
          return m.withdrawExchange(exchange.id);
        case 'cancel':
          return m.cancelExchange(exchange.id);
        case 'confirm_receipt':
          return m.confirmExchangeReceipt(exchange.id);
        case 'dispute':
          return m.disputeExchange(exchange.id, reason.trim());
      }
    },
    onSuccess: (_r, action) => {
      setPanel(null);
      setReason('');
      showToast(t(`community.exchange.done.${action}`), 'success');
      invalidate();
    },
    onError,
  });

  // Expédition : suivi + transporteur choisi dans une liste, rien d'autre.
  const ship = useMutation({
    mutationFn: (shipment: Shipment) =>
      client.marketplace.shipExchange(exchange.id, shipment.trackingNumber, shipment.carrier),
    onSuccess: () => {
      setPanel(null);
      showToast(t('community.exchange.done.ship'), 'success');
      invalidate();
    },
    onError,
  });

  if (actions.length === 0) {
    return (
      <View style={styles.actions}>
        <VText variant="caption" tone="dim">
          {shipBlocked ? t('community.exchange.shipBlocked') : t(`community.exchange.waiting.${exchange.state}`)}
        </VText>
        {deadline}
      </View>
    );
  }

  const busy = run.isPending || ship.isPending;
  const loadingFor = (a: ExchangeAction) => run.isPending && run.variables === a;
  const confirmPanel = (action: 'decline' | 'withdraw' | 'cancel') => (
    <View style={styles.panel} key={action}>
      <VText variant="body">{t(`community.exchange.confirm.${action}`)}</VText>
      <VButton
        label={t(`community.exchange.action.${action}`)}
        variant="danger"
        onPress={() => run.mutate(action)}
        disabled={busy}
        loading={loadingFor(action)}
      />
      <VButton label={t('community.keep')} variant="ghost" onPress={() => setPanel(null)} />
    </View>
  );
  const preview = exchangeCommissionAt(myCededValue(exchange), commission.basis);
  const rateNoticeKey = commissionBasisNoticeKey(commission.status);

  return (
    <View style={styles.actions}>
      {shipBlocked ? (
        <Notice tone="warning">{t('community.exchange.shipBlocked')}</Notice>
      ) : null}
      {deadline}
      {actions.includes('accept') ? (
        <>
          <VText variant="caption" tone="dim">
            {t('community.exchange.acceptHint', {
              amount: formatPrice(preview.commission, i18n.language),
              rate: formatRate(preview.commissionRate, i18n.language),
            })}
          </VText>
          {rateNoticeKey !== null ? (
            <VText variant="caption" tone="dim" accessibilityLiveRegion="polite">
              {t(rateNoticeKey, { rate: formatRate(commission.basis.rate, i18n.language) })}
            </VText>
          ) : null}
          <VButton
            label={t('community.exchange.action.accept')}
            onPress={() => run.mutate('accept')}
            disabled={busy}
            loading={loadingFor('accept')}
          />
        </>
      ) : null}

      {actions.includes('ship') ? (
        panel === 'ship' ? (
          <ShipPanel
            onConfirm={(shipment) => ship.mutate(shipment)}
            onCancel={() => setPanel(null)}
            loading={ship.isPending}
            disabled={busy}
          />
        ) : (
          <VButton label={t('community.exchange.action.ship')} onPress={() => setPanel('ship')} />
        )
      ) : null}

      {actions.includes('confirm_receipt') ? (
        <VButton
          label={t('community.exchange.action.confirm_receipt')}
          onPress={() => run.mutate('confirm_receipt')}
          disabled={busy}
          loading={loadingFor('confirm_receipt')}
          accessibilityHint={t('community.exchange.confirmReceiptHint')}
        />
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
              onPress={() => run.mutate('dispute')}
              disabled={reason.trim().length === 0 || busy}
              loading={loadingFor('dispute')}
            />
            <VButton label={t('common.cancel')} variant="ghost" onPress={() => setPanel(null)} />
          </View>
        ) : (
          <VButton label={t('community.reportProblem')} variant="ghost" onPress={() => setPanel('dispute')} />
        )
      ) : null}

      {(['decline', 'withdraw', 'cancel'] as const)
        .filter((a) => actions.includes(a))
        .map((a) =>
          panel === a ? (
            confirmPanel(a)
          ) : (
            <VButton key={a} label={t(`community.exchange.action.${a}`)} variant="ghost" onPress={() => setPanel(a)} />
          ),
        )}
    </View>
  );
}

function ExchangeDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const exchanges = useMyExchanges();
  const certifications = useMyCertifications();
  const locale = i18n.language;

  const askCertification = useMutation({
    mutationFn: () =>
      client.marketplace.requestCertification({ reason: 'mutual_agreement', exchangeId: id, feePayer: 'split' }),
    onSuccess: () => {
      showToast(t('community.exchange.certificationAsked'), 'success');
      invalidate();
    },
    onError,
  });

  if (exchanges.data === undefined && exchanges.fetchStatus === 'paused') {
    // Hors-ligne, rien en cache : jamais présenté comme « introuvable ».
    return (
      <Screen scroll={false} title={t('community.exchange.title')} backFallback={communityActivityHref()}>
        <View style={styles.center}>
          <VEmptyState title={t('community.offlineTitle')} message={t('community.offline')} />
        </View>
      </Screen>
    );
  }
  if (exchanges.isError || exchanges.isPending) {
    return (
      <Screen scroll={false} title={t('community.exchange.title')} backFallback={communityActivityHref()}>
        <View style={styles.center} accessibilityLabel={exchanges.isPending ? t('common.loading') : undefined}>
          {exchanges.isPending ? <VSpinner /> : <AsyncBlock source={exchanges}>{() => null}</AsyncBlock>}
        </View>
      </Screen>
    );
  }

  const exchange = exchanges.data.find((e) => e.id === id);
  if (!exchange) {
    return (
      <Screen scroll={false} title={t('community.exchange.title')} backFallback={communityActivityHref()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('community.exchange.notFound')}
            action={{ label: t('community.activity.title'), onPress: () => router.replace(communityActivityHref()) }}
          />
        </View>
      </Screen>
    );
  }

  const iAmProposer = exchange.role === 'proposer';
  const mineTitle = (iAmProposer ? exchange.offeredTitle : exchange.listingTitle) ?? t('common.unknown');
  const theirTitle = (iAmProposer ? exchange.listingTitle : exchange.offeredTitle) ?? t('common.unknown');
  const mineValue = iAmProposer ? exchange.offeredValue : exchange.listingValue;
  const theirValue = iAmProposer ? exchange.listingValue : exchange.offeredValue;
  const cash = myCashPayment(exchange);
  const related = (certifications.data ?? []).filter((c) => c.exchangeId === id);
  const hasOpenCertification = hasOpenCertificationOn(related, { exchangeId: id });
  // Miroir de request_certification : échange accepté, avant tout envoi, sur
  // l'objet que je reçois (mes demandes lues d'abord : jamais de doublon) —
  // jamais, pour l'auteur, sur une annonce déjà authentifiée.
  const canAskCertification =
    certifications.data !== undefined && canRequestExchangeCertification(exchange, related);

  const rows: AmountRow[] = [
    { label: t('community.exchange.youGive', { title: mineTitle }), value: formatPrice(mineValue, locale, exchange.currency) },
    { label: t('community.exchange.youGet', { title: theirTitle }), value: formatPrice(theirValue, locale, exchange.currency) },
    {
      label:
        cash > 0
          ? t('community.exchange.cashYouPay')
          : cash < 0
            ? t('community.exchange.cashYouGet')
            : t('community.exchange.cashNone'),
      value: formatPrice(Math.abs(cash), locale),
    },
  ];
  if (exchange.myCommission !== null) {
    rows.push({
      label: t('community.exchange.myCommission'),
      value: formatPrice(exchange.myCommission, locale),
      detail: t('community.exchange.myCommissionFrozen'),
      emphasis: true,
    });
  }

  return (
    <Screen title={t('community.exchange.title')} backFallback={communityActivityHref()}>
      <View style={styles.container}>
        <VText variant="title">{t('community.exchange.withAlias', { alias: exchange.counterpartyAlias })}</VText>
        <View style={styles.badges}>
          <VBadge tone={EXCHANGE_TONE[exchange.state]} label={t(marketLabelKeys.exchange(exchange.state))} />
          <VBadge
            tone={iAmProposer ? 'neutral' : 'gold'}
            label={iAmProposer ? t('community.exchange.sent') : t('community.exchange.received')}
          />
          {exchange.certificationRequired ? <VBadge tone="warning" label={t('community.exchange.certificationBadge')} /> : null}
        </View>

        {/* Actions en tête. */}
        <ExchangeActions exchange={exchange} hasOpenCertification={hasOpenCertification} />

        <VCard style={styles.card}>
          <AmountRows rows={rows} />
          {exchange.myCommission === null && !isClosed.exchange(exchange) ? (
            <VText variant="caption" tone="dim">
              {t('community.exchange.commissionLater')}
            </VText>
          ) : null}
        </VCard>

        {exchange.message ? (
          <Notice title={t('community.exchange.message')}>{exchange.message}</Notice>
        ) : null}

        <View style={styles.block}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('community.exchange.timeline')}
          </VText>
          <ExchangeTimeline exchange={exchange} />
          <VText variant="caption" tone="dim">
            {t('community.exchange.myShipment')} :{' '}
            {myTracking(exchange) ?? t('community.exchange.notShipped')}
            {myReceived(exchange) ? ` · ${t('community.exchange.iReceived')}` : ''}
          </VText>
          <VText variant="caption" tone="dim">
            {t('community.exchange.theirShipment')} :{' '}
            {theirTracking(exchange) ?? t('community.exchange.notShipped')}
            {theirReceived(exchange) ? ` · ${t('community.exchange.theyReceived')}` : ''}
          </VText>
          <VText variant="caption" tone="dim">
            {t('community.exchange.updatedOn', { date: formatDate(exchange.updatedAt) })}
          </VText>
        </View>

        <View style={styles.block}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('community.exchange.certification')}
          </VText>
          {exchange.certificationRequired ? (
            <Notice tone="warning" title={t('community.certification.requiredTitle')}>
              {t('community.exchange.certificationRequired')}
            </Notice>
          ) : null}
          {certifications.isError ? (
            <AsyncBlock source={certifications}>{() => null}</AsyncBlock>
          ) : (
            related.map((c) => <CertificationCard key={c.id} certification={c} />)
          )}
          {canAskCertification ? (
            <>
              <VText variant="caption" tone="dim">
                {t('community.exchange.certificationOptional')}
              </VText>
              <VButton
                label={t('community.listing.askCertification')}
                variant="ghost"
                onPress={() => askCertification.mutate()}
                loading={askCertification.isPending}
              />
            </>
          ) : null}
          {exchange.listingCertified === true ? (
            <VText variant="caption" tone="dim">
              {t('community.exchange.listingCertified')}
            </VText>
          ) : null}
          {!exchange.certificationRequired &&
          exchange.listingCertified !== true &&
          related.length === 0 &&
          !canAskCertification ? (
            <VText variant="caption" tone="dim">
              {t('community.exchange.noCertification')}
            </VText>
          ) : null}
        </View>

        <MessageThread kind="exchange" threadId={exchange.id} readOnly={isClosed.exchange(exchange)} />

        <VButton
          label={t('community.exchange.viewListing')}
          variant="ghost"
          onPress={() => router.push(routes.listing(exchange.listingId))}
        />
        <Notice title={t('community.anonymityTitle')}>{t('community.exchange.anonymity')}</Notice>
      </View>
    </Screen>
  );
}

export default function ExchangeScreen() {
  const { t } = useTranslation();
  const id = stringParam(useLocalSearchParams<{ id: string }>().id) ?? '';
  return (
    <CommunityGate title={t('community.exchange.title')} backFallback={communityActivityHref()}>
      {id.length > 0 ? (
        <ExchangeDetail id={id} />
      ) : (
        <Screen scroll={false} title={t('community.exchange.title')} backFallback={communityActivityHref()}>
          <VEmptyState title={t('community.exchange.notFound')} />
        </Screen>
      )}
    </CommunityGate>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  container: { gap: velumSpacing.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  actions: { gap: velumSpacing.sm },
  panel: { gap: velumSpacing.sm },
  card: { gap: velumSpacing.sm },
  block: { gap: velumSpacing.sm },
});
