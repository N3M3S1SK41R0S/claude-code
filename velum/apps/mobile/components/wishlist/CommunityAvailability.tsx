/**
 * « Disponible dans la communauté ? » — vérification À LA DEMANDE (jamais
 * automatique : pas de requête catalogue à chaque ouverture d'envie) de
 * jusqu'à 3 annonces correspondantes dans la catégorie de l'envie.
 *
 * Chaque issue a son message : annonces trouvées, aucune annonce, offre
 * Platine requise (lien vers les offres), fonction pas encore disponible,
 * panne (Réessayer). Une panne n'est jamais présentée comme « aucune annonce ».
 * Plateformes coupées par le drapeau produit (marketplaceEnabled) : rien.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { CatalogueListing, WishlistEntry } from '@velum/core';
import { VBadge, VButton, VCard, VListRow, VSpinner, VText, velumSpacing } from '@velum/ui';

import { getVelumClient } from '../../lib/client';
import { marketplaceEnabled } from '../../lib/features';
import { formatMoney } from '../../lib/i18n';
import { usePlan } from '../../lib/plan';
import { routes } from '../../lib/routes';
import { classifyCommunityError, communitySearchText, type CommunityProblem } from '../../lib/wishlist';

/** Nombre maximal d'annonces proposées. */
const MAX_LISTINGS = 3;

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; listings: CatalogueListing[] }
  | { status: 'problem'; problem: CommunityProblem };

export function CommunityAvailability({ entry }: { entry: WishlistEntry }) {
  // Drapeau constant pour la session : aucune vérification proposée quand les plateformes sont coupées.
  return marketplaceEnabled() ? <CommunityCheck entry={entry} /> : null;
}

function CommunityCheck({ entry }: { entry: WishlistEntry }) {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlan();
  const [state, setState] = useState<CheckState>({ status: 'idle' });

  const check = async () => {
    // Offre confirmée sans la communauté : inutile d'interroger le serveur.
    if (plan.status === 'ready' && !plan.entitlements.community) {
      setState({ status: 'problem', problem: 'plan' });
      return;
    }
    setState({ status: 'checking' });
    try {
      const listings = await getVelumClient().marketplace.catalogue({
        domain: entry.domain,
        text: communitySearchText(entry),
        limit: MAX_LISTINGS,
      });
      setState({ status: 'done', listings: listings.slice(0, MAX_LISTINGS) });
    } catch (error) {
      setState({ status: 'problem', problem: classifyCommunityError(error) });
    }
  };

  const checking = state.status === 'checking';

  return (
    <View style={styles.container}>
      <VButton
        label={t('wishlist.actions.checkCommunity')}
        variant="ghost"
        onPress={() => void check()}
        loading={checking}
        disabled={checking}
        accessibilityHint={t('wishlist.actions.checkCommunityHint')}
      />

      {state.status === 'checking' ? (
        <View style={styles.inline} accessibilityLiveRegion="polite">
          <VSpinner />
          <VText variant="caption" tone="dim">
            {t('wishlist.community.checking')}
          </VText>
        </View>
      ) : null}

      {state.status === 'done' ? (
        <VCard style={styles.card}>
          <VText variant="body" tone={state.listings.length > 0 ? 'gold' : 'dim'} accessibilityLiveRegion="polite">
            {state.listings.length > 0
              ? t('wishlist.community.found', { count: state.listings.length })
              : t('wishlist.community.none')}
          </VText>
          {state.listings.map((listing) => (
            <VListRow
              key={listing.id}
              title={listing.title ?? t('common.unknown')}
              subtitle={t('wishlist.community.listing', {
                price: formatMoney(listing.askPrice, listing.currency),
                alias: listing.sellerAlias,
              })}
              right={listing.certified ? <VBadge label={t('wishlist.community.certified')} tone="success" /> : undefined}
              onPress={() => router.push(routes.listing(listing.id))}
            />
          ))}
        </VCard>
      ) : null}

      {state.status === 'problem' ? (
        <VCard style={styles.card}>
          <VText
            variant="body"
            tone={state.problem === 'plan' || state.problem === 'notYet' ? 'dim' : 'danger'}
            accessibilityLiveRegion="polite"
          >
            {t(`wishlist.community.${state.problem}`)}
          </VText>
          {state.problem === 'plan' ? (
            <VButton
              label={t('wishlist.community.seePlans')}
              variant="secondary"
              onPress={() => router.push(routes.paywall())}
            />
          ) : null}
          {state.problem === 'unavailable' || state.problem === 'generic' ? (
            <VButton label={t('common.retry')} variant="secondary" onPress={() => void check()} />
          ) : null}
        </VCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  card: { gap: velumSpacing.sm },
});
