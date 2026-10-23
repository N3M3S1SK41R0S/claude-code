/**
 * Détail d'une annonce (routes.listing) : infos, souhaits d'échange,
 * pseudonyme et réputation du vendeur, rappel d'anonymat et de séquestre.
 * Actions en tête : Acheter (vente, sous séquestre) ; Proposer un échange
 * (échange) ; demander une expertise d'un commun accord sous 500 €, ou
 * explication si elle est obligatoire.
 *
 * L'annonce est retrouvée par id : d'abord dans le catalogue en cache, sinon
 * relue (catalogue complet, puis mes annonces).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { certificationRequirement } from '@velum/config';
import type { CatalogueListing, ListingStatus } from '@velum/core';
import { VBadge, VButton, VCard, VEmptyState, VSpinner, VText, velumSpacing } from '@velum/ui';

import { Screen } from '../../../components/Screen';
import { CommunityGate } from '../../../components/market/CommunityGate';
import { ExchangeProposalForm } from '../../../components/market/ExchangeProposalForm';
import { ListingBadges } from '../../../components/market/ListingCard';
import { AmountRows, AsyncBlock, Notice } from '../../../components/market/controls';
import {
  useInvalidateCommunity,
  useMarketErrorToast,
  useMyCertifications,
} from '../../../components/market/hooks';
import { getVelumClient } from '../../../lib/client';
import { formatDate } from '../../../lib/i18n';
import { formatPrice } from '../../../lib/marketForms';
import {
  catalogueViewOfMine,
  communityActivityHref,
  communityKeys,
  findCatalogueListing,
  stringParam,
} from '../../../lib/marketQuery';
import {
  CERTIFICATION_TONE,
  LISTING_STATUS_TONE,
  isForSale,
  isClosed,
  isOpenToExchange,
  marketLabelKeys,
} from '../../../lib/marketState';
import { routes } from '../../../lib/routes';
import { showToast } from '../../../stores/toastStore';

interface ListingLookup {
  listing: CatalogueListing;
  /** Statut connu seulement pour mes annonces (le catalogue ne liste que les actives). */
  myStatus: ListingStatus | null;
}

/** Retrouve une annonce par id : cache du catalogue, puis serveur. */
function useListing(id: string) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const queryClient = useQueryClient();
  const cachedPages = () =>
    queryClient.getQueriesData({ queryKey: communityKeys.catalogueRoot }).map(([, data]) => data);

  return useQuery<ListingLookup | null>({
    queryKey: communityKeys.listing(id),
    enabled: id.length > 0,
    queryFn: async () => {
      const cached = findCatalogueListing(cachedPages(), id);
      if (cached && !cached.isMine) return { listing: cached, myStatus: null };
      let catalogueError: unknown = null;
      try {
        const all = await client.marketplace.catalogue({ includeMine: true });
        const found = all.find((l) => l.id === id);
        if (found && !found.isMine) return { listing: found, myStatus: null };
      } catch (error) {
        // Catalogue indisponible : on tente encore mes annonces avant d'échouer.
        catalogueError = error;
      }
      // Mon annonce (éventuellement non publiée : expertise en attente, retirée…).
      const mine = (await client.marketplace.myListings()).find((l) => l.id === id);
      if (mine) return { listing: catalogueViewOfMine(mine, t('community.you')), myStatus: mine.status };
      // Jamais « introuvable » quand c'est en réalité le catalogue qui est en panne.
      if (catalogueError !== null) throw catalogueError;
      return null;
    },
  });
}

function SellerReputation({ alias }: { alias: string }) {
  const { t } = useTranslation();
  const client = getVelumClient();
  const reputation = useQuery({
    queryKey: communityKeys.reputation(alias),
    queryFn: () => client.marketplace.reputationByAlias(alias),
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

  const askCertification = useMutation({
    mutationFn: () =>
      client.marketplace.requestCertification({ reason: 'mutual_agreement', listingId: id, feePayer: 'split' }),
    onSuccess: () => {
      showToast(t('community.listing.certificationAsked'), 'success');
      invalidate();
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
  const requirement = certificationRequirement({ value: listing.askPrice });
  const myRequest = (certifications.data ?? []).find((c) => c.listingId === id && !isClosed.certification(c));
  const price = formatPrice(listing.askPrice, i18n.language, listing.currency);

  return (
    <Screen title={t('community.listing.title')} backFallback={routes.community(listing.domain)}>
      <View style={styles.container}>
        <VText variant="title">{listing.title ?? t('common.unknown')}</VText>
        <ListingBadges kind={listing.kind} certified={listing.certified} domain={listing.domain} />
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
          <Notice title={t('community.yourListing')}>
            {myStatus !== null && myStatus !== 'active'
              ? t('community.listing.mineStatus', { status: t(marketLabelKeys.listingStatus(myStatus)) })
              : t('community.listing.mineHint')}
          </Notice>
        ) : (
          <View style={styles.actions}>
            {forSale ? (
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
            {forExchange ? (
              panel === 'exchange' ? (
                <ExchangeProposalForm
                  listing={listing}
                  onCancel={() => setPanel(null)}
                  onProposed={(exchangeId) => router.replace(routes.exchange(exchangeId))}
                />
              ) : (
                <VButton
                  label={t('community.listing.proposeExchange')}
                  variant={forSale ? 'secondary' : 'primary'}
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
            <View style={styles.block}>
              <VText variant="caption" tone="dim">
                {t('community.listing.certificationOptional')}
              </VText>
              <VButton
                label={t('community.listing.askCertification')}
                variant="ghost"
                onPress={() => askCertification.mutate()}
                loading={askCertification.isPending}
              />
            </View>
          )
        ) : null}

        {myStatus !== null ? (
          <VBadge tone={LISTING_STATUS_TONE[myStatus]} label={t(marketLabelKeys.listingStatus(myStatus))} />
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
});
