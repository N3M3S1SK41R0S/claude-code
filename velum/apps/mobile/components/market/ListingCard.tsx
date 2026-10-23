/**
 * Carte d'annonce du catalogue : titre, prix (vente) ou valeur déclarée
 * (échange seul), nature, badge « Authentifié VELUM » UNIQUEMENT si certifiée,
 * pseudonyme du vendeur — jamais d'identité. Toute la carte ouvre l'annonce.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CatalogueListing, ListingKind } from '@velum/core';
import { VBadge, VCard, VText, velumSpacing } from '@velum/ui';

import { formatPrice } from '../../lib/marketForms';
import { LISTING_KIND_TONE, isForSale, marketLabelKeys } from '../../lib/marketState';

/** Badges de nature + authentification (+ catégorie si demandé). */
export function ListingBadges({
  kind,
  certified,
  domain,
}: {
  kind: ListingKind;
  certified: boolean;
  domain?: CatalogueListing['domain'];
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.badges}>
      <VBadge tone={LISTING_KIND_TONE[kind]} label={t(marketLabelKeys.listingKind(kind))} />
      {certified ? <VBadge tone="success" label={t('community.authenticated')} /> : null}
      {domain ? <VBadge tone="neutral" label={t(`domains.${domain}.name`)} /> : null}
    </View>
  );
}

export interface ListingCardProps {
  listing: CatalogueListing;
  onPress: () => void;
  /** Affiche la catégorie (catalogue « Toutes »). */
  showDomain?: boolean;
}

export function ListingCard({ listing, onPress, showDomain = false }: ListingCardProps) {
  const { t, i18n } = useTranslation();
  const title = listing.title ?? t('common.unknown');
  const price = formatPrice(listing.askPrice, i18n.language, listing.currency);
  const priceLabel = isForSale(listing.kind) ? t('community.price') : t('community.declaredValue');
  const kindLabel = t(marketLabelKeys.listingKind(listing.kind));
  const a11y = [
    title,
    kindLabel,
    `${priceLabel} ${price}`,
    listing.certified ? t('community.authenticated') : null,
    t('community.byAlias', { alias: listing.sellerAlias }),
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  return (
    <VCard
      tone={listing.certified ? 'gilded' : 'default'}
      onPress={onPress}
      accessibilityLabel={a11y}
      accessibilityHint={t('community.openListingHint')}
      style={styles.card}
    >
      <View style={styles.top}>
        <VText variant="heading" tone="gold" style={styles.flex} numberOfLines={2}>
          {title}
        </VText>
        <View style={styles.price}>
          <VText variant="heading" tabularNums>
            {price}
          </VText>
          <VText variant="caption" tone="dim">
            {priceLabel}
          </VText>
        </View>
      </View>
      <ListingBadges
        kind={listing.kind}
        certified={listing.certified}
        domain={showDomain ? listing.domain : undefined}
      />
      {listing.exchangeWishes && listing.kind !== 'sale' ? (
        <VText variant="caption" tone="dim" numberOfLines={2}>
          {t('community.wishesShort', { wishes: listing.exchangeWishes })}
        </VText>
      ) : null}
      <VText variant="caption" tone="dim">
        {listing.isMine ? t('community.yourListing') : t('community.byAlias', { alias: listing.sellerAlias })}
      </VText>
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: velumSpacing.sm },
  price: { alignItems: 'flex-end' },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
});
