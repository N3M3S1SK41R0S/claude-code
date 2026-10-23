/**
 * Détail d'une annonce (routes.listing) : infos, souhaits d'échange,
 * pseudonyme et réputation du vendeur, rappel d'anonymat et de séquestre.
 * Actions en tête : Acheter (vente, sous séquestre) ; Proposer un échange
 * (échange). Expertise : obligatoire au-delà de 500 € ; en deçà, d'un commun
 * accord, demandée sur la commande ou l'échange (jamais sur l'annonce
 * d'autrui, contexte réservé au vendeur).
 *
 * L'annonce est retrouvée par id (lib/marketQuery `lookupListing`) : cache du
 * catalogue, puis lecture directe — une annonce réservée, vendue ou échangée
 * reste consultable par les parties de la transaction —, enfin mes annonces.
 * Acheter / proposer ne sont offerts que si le serveur les accepterait au vu
 * de MES transactions sur l'annonce (lib/marketState `listingAvailability`).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { certificationRequirement } from '@velum/config';
import { VBadge, VButton, VCard, VEmptyState, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { CommunityGate } from '../../../components/market/CommunityGate';
import { ExchangeProposalForm } from '../../../components/market/ExchangeProposalForm';
import { ListingBadges } from '../../../components/market/ListingCard';
import { AmountRows, AsyncBlock, Notice } from '../../../components/market/controls';
import {
  marketRetry,
  useInvalidateCommunity,
  useMarketErrorToast,
  useMyCertifications,
  useMyExchanges,
  useMyOrders,
} from '../../../components/market/hooks';
import { getVelumClient } from '../../../lib/client';
import { formatDate } from '../../../lib/i18n';
import { formatPrice } from '../../../lib/marketForms';
import {
  communityActivityHref,
  communityKeys,
  lookupListing,
  stringParam,
  type ListingLookup,
} from '../../../lib/marketQuery';
import {
  CERTIFICATION_TONE,
  LISTING_STATUS_TONE,
  isClosed,
  isForSale,
  isOpenToExchange,
  listingAvailability,
  marketLabelKeys,
} from '../../../lib/marketState';
import { routes } from '../../../lib/routes';
import { showToast } from '../../../stores/toastStore';

/** Retrouve une annonce par id : cache du catalogue, lecture directe, mes annonces. */
function useListing(id: string) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const market = client.marketplace;
  // Contrat optionnel : absent d'un client historique (repli sur le catalogue).
  const getListing = market.getListing?.bind(market);

  return useQuery<ListingLookup | null>({
    queryKey: communityKeys.listing(id),
    enabled: id.length > 0,
    retry: marketRetry,
    queryFn: () =>
      lookupListing(id, {
        cachedPages: queryClient.getQueriesData({ queryKey: communityKeys.catalogueRoot }).map(([, data]) => data),
        ...(getListing ? { getListing } : {}),
        catalogue: (query) => market.catalogue(query),
        myListings: () => market.myListings(),
        myAlias: t('community.you'),
      }),
  });
}

function SellerReputation({ alias }: { alias: string }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const reputation = useQuery({
    queryKey: communityKeys.reputation(alias),
    queryFn: () => client.marketplace.reputationByAlias(alias),
    retry: marketRetry,
  });
  return (
    <AsyncBlock source={reputation}>
      {(rep) => (
        <VText variant="caption" tone="dim">
          {[
            t('community.listing.sales', { count: rep.completedSales }),
            rep.completedSales > 0
              ? t('community.listing.disputeRate', { rate: Math.round(rep.disputeRate * 100) })
              : t('community.listing.newMember'),
            rep.memberSince ? t('community.listing.memberSince', { date: formatDate(rep.memberSince) }) : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' · ')}
        </VText>
      )}
    </AsyncBlock>
  );
}

function ListingDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const invalidate = useInvalidateCommunity();
  const onError = useMarketErrorToast();
  const lookup = useListing(id);
  const certifications = useMyCertifications();
  const orders = useMyOrders();
  const exchanges = useMyExchanges();
  const [panel, setPanel] = useState<'buy' | 'exchange' | null>(null);

  const buy = useMutation({
    mutationFn: () => client.marketplace.buy(id),
    onSuccess: () => {
      setPanel(null);
      showToast(t('community.bought'), 'success');
      invalidate();
      router.replace(communityActivityHref());
    },
    onError,
  });

  if (lookup.isError) {
    return (
      <Screen scroll={false} title={t('community.listing.title')} backFallback={routes.community()}>
        <View style={styles.center}>
          <AsyncBlock source={lookup}>{() => null}</AsyncBlock>
        </View>
      </Screen>
    );
  }
  if (lookup.data === undefined && lookup.fetchStatus === 'paused') {
    // Hors-ligne, rien en cache : jamais présenté comme « introuvable ».
    return (
      <Screen scroll={false} title={t('community.listing.title')} backFallback={routes.community()}>
        <View style={styles.center}>
          <VEmptyState title={t('community.offlineTitle')} message={t('community.offline')} />
        </View>
      </Screen>
    );
  }
  if (lookup.isPending) {
    return (
      <Screen scroll={false} title={t('community.listing.title')} backFallback={routes.community()}>
        <View style={styles.center} accessibilityLabel={t('common.loading')}>
          <VSpinner />
        </View>
      </Screen>
    );
  }
  if (lookup.data === null || lookup.data === undefined) {
    return (
      <Screen scroll={false} title={t('community.listing.title')} backFallback={routes.community()}>
        <View style={styles.center}>
          <VEmptyState
            title={t('community.listing.notFound')}
            message={t('community.listing.notFoundHint')}
            action={{ label: t('community.backToCatalogue'), onPress: () => router.replace(routes.community()) }}
          />
        </View>
      </Screen>
    );
  }

  const { listing, myStatus } = lookup.data;
  const forSale = isForSale(listing.kind);
  const forExchange = isOpenToExchange(listing.kind);
  const availability = listingAvailability(listing, orders.data ?? [], exchanges.data ?? []);
  const myTransaction = availability.mine;
  const requirement = certificationRequirement({ value: listing.askPrice });
  const myRequest = (certifications.data ?? []).find((c) => c.listingId === id && !isClosed.certification(c));
  const price = formatPrice(listing.askPrice, i18n.language, listing.currency);

  return (
    <Screen title={t('community.listing.title')} backFallback={routes.community(listing.domain)}>
      <View style={styles.container}>
        <VText variant="title">{listing.title ?? t('common.unknown')}</VText>
        <ListingBadges kind={listing.kind} certified={listing.certified} domain={listing.domain} />
        {myStatus !== null ? (
          <View style={styles.badgeRow}>
            <VBadge tone={LISTING_STATUS_TONE[myStatus]} label={t(marketLabelKeys.listingStatus(myStatus))} />
          </View>
        ) : null}
        <View>
          <VText variant="display" tone="gold" tabularNums>
            {price}
          </VText>
          <VText variant="caption" tone="dim">
            {forSale ? t('community.listing.priceHint') : t('community.listing.declaredHint')}
          </VText>
        </View>

        {/* Actions principales en tête. */}
        {listing.isMine ? (
          <View style={styles.actions}>
            <Notice title={t('community.yourListing')}>
              {myStatus !== null && myStatus !== 'active'
                ? t('community.listing.mineStatus', { status: t(marketLabelKeys.listingStatus(myStatus)) })
                : t('community.listing.mineHint')}
            </Notice>
            <VButton
              label={t('community.activity.title')}
              variant="secondary"
              onPress={() => router.push(communityActivityHref())}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            {/* Ma transaction sur l'annonce : lien direct, et plus d'action refusée par le serveur. */}
            {myTransaction !== null ? (
              <>
                <Notice title={t('community.listing.involvedTitle')}>
                  {myTransaction.kind === 'order'
                    ? t('community.listing.involvedOrder')
                    : t('community.listing.involvedExchange')}
                </Notice>
                <VButton
                  label={
                    myTransaction.kind === 'order' ? t('community.listing.openOrder') : t('community.listing.openExchange')
                  }
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      myTransaction.kind === 'order' ? communityActivityHref() : routes.exchange(myTransaction.id),
                    )
                  }
                />
              </>
            ) : null}
            {availability.canBuy ? (
              panel === 'buy' ? (
                <VCard tone="gilded" style={styles.panel}>
                  <VText variant="heading" tone="gold" accessibilityRole="header">
                    {t('community.listing.buyTitle')}
                  </VText>
                  <AmountRows rows={[{ label: t('community.listing.youPay'), value: price, emphasis: true }]} />
                  <VText variant="caption" tone="dim">
                    {t('community.listing.buyEscrow')}
                  </VText>
                  <VButton
                    label={t('community.listing.confirmBuy')}
                    onPress={() => buy.mutate()}
                    loading={buy.isPending}
                    accessibilityHint={t('community.escrowHint')}
                  />
                  <VButton label={t('common.cancel')} variant="ghost" onPress={() => setPanel(null)} />
                </VCard>
              ) : (
                <VButton label={t('community.buy')} onPress={() => setPanel('buy')} accessibilityHint={t('community.escrowHint')} />
              )
            ) : null}
            {availability.canPropose ? (
              panel === 'exchange' ? (
                <ExchangeProposalForm
                  listing={listing}
                  onCancel={() => setPanel(null)}
                  onProposed={(exchangeId) => router.replace(routes.exchange(exchangeId))}
                />
              ) : (
                <VButton
                  label={t('community.listing.proposeExchange')}
                  variant={availability.canBuy ? 'secondary' : 'primary'}
                  onPress={() => setPanel('exchange')}
                />
              )
            ) : null}
          </View>
        )}

        {listing.description ? (
          <View style={styles.block}>
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {t('community.listing.description')}
            </VText>
            <VText variant="body">{listing.description}</VText>
          </View>
        ) : null}
        {forExchange && listing.exchangeWishes ? (
          <View style={styles.block}>
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {t('community.listing.wishes')}
            </VText>
            <VText variant="body">{listing.exchangeWishes}</VText>
          </View>
        ) : null}

        <View style={styles.block}>
          <VText variant="heading" tone="gold" accessibilityRole="header">
            {t('community.listing.seller')}
          </VText>
          <VText variant="body">{listing.isMine ? t('community.you') : listing.sellerAlias}</VText>
          <SellerReputation alias={listing.sellerAlias} />
          <VText variant="caption" tone="dim">
            {t('community.listing.publishedOn', { date: formatDate(listing.createdAt) })}
          </VText>
        </View>

        {/* Certification par un expert. */}
        {listing.certified ? (
          <Notice tone="success" title={t('community.authenticated')}>
            {t('community.listing.certifiedHint')}
          </Notice>
        ) : requirement.required ? (
          <Notice tone="warning" title={t('community.certification.requiredTitle')}>
            {t('community.listing.certificationRequired')}
          </Notice>
        ) : !listing.isMine ? (
          myRequest ? (
            <View style={styles.block}>
              <VText variant="body">{t('community.listing.certificationPending')}</VText>
              <VBadge tone={CERTIFICATION_TONE[myRequest.status]} label={t(marketLabelKeys.certification(myRequest.status))} />
            </View>
          ) : (
            // Le serveur n'accepte l'accord mutuel que sur une commande ou un
            // échange (le contexte annonce est réservé au vendeur) : on l'explique.
            <VText variant="caption" tone="dim">
              {t('community.listing.certificationOptional')}
            </VText>
          )
        ) : null}

        <Notice title={t('community.anonymityTitle')}>{t('community.listing.anonymity')}</Notice>
      </View>
    </Screen>
  );
}

export default function ListingScreen() {
  const { t } = useTranslation();
  const id = stringParam(useLocalSearchParams<{ id: string }>().id) ?? '';
  return (
    <CommunityGate title={t('community.listing.title')} backFallback={routes.community()}>
      {id.length > 0 ? (
        <ListingDetail id={id} />
      ) : (
        <Screen scroll={false} title={t('community.listing.title')} backFallback={routes.community()}>
          <VEmptyState title={t('community.listing.notFound')} message={t('community.listing.notFoundHint')} />
        </Screen>
      )}
    </CommunityGate>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  container: { gap: velumSpacing.lg },
  actions: { gap: velumSpacing.sm },
  panel: { gap: velumSpacing.sm },
  block: { gap: velumSpacing.xs },
  badgeRow: { flexDirection: 'row' },
});
