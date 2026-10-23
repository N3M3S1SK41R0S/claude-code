/**
 * Accès aux plateformes d'échange et de vente (offre Platine) : drapeau
 * produit coupé (marketplaceEnabled) → « bientôt disponible », sans lecture
 * du profil ; sinon distingue chargement, panne (avec Réessayer) et plan
 * insuffisant — une panne du profil n'est jamais présentée comme un faux
 * paywall. Le contenu (et ses lectures) n'est monté qu'une fois l'accès confirmé.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VEmptyState, VSpinner } from '@velum/ui';

import { Screen } from '../Screen';
import { errorMessage } from '../../lib/errors';
import { marketplaceEnabled } from '../../lib/features';
import { usePlan } from '../../lib/plan';
import { routes } from '../../lib/routes';

export interface CommunityGateProps {
  /** Titre de l'en-tête pendant le contrôle d'accès. */
  title: string;
  /** Destination du « Retour » si l'historique est vide. */
  backFallback?: string;
  children: ReactNode;
}

export function CommunityGate(props: CommunityGateProps) {
  // Drapeau constant pour la session : le choix de branche ne change pas d'un rendu à l'autre.
  return marketplaceEnabled() ? <PlanGate {...props} /> : <ComingSoon {...props} />;
}

/** Plateformes coupées par le drapeau produit (rails de paiement / KYC) : rien n'est lu. */
function ComingSoon({ title, backFallback }: CommunityGateProps) {
  const { t } = useTranslation();
  return (
    <Screen scroll={false} title={title} backFallback={backFallback}>
      <View style={styles.center}>
        <VEmptyState title={t('community.title')} message={t('community.comingSoon')} />
      </View>
    </Screen>
  );
}

function PlanGate({ title, backFallback, children }: CommunityGateProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const planState = usePlan();

  if (planState.status === 'loading') {
    return (
      <Screen scroll={false} title={title} backFallback={backFallback}>
        <View style={styles.center} accessibilityLabel={t('common.loading')}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (planState.status === 'error') {
    return (
      <Screen scroll={false} title={title} backFallback={backFallback}>
        <View style={styles.center}>
          <VEmptyState
            title={t('community.title')}
            message={errorMessage(planState.error, t)}
            action={{ label: t('common.retry'), onPress: planState.retry }}
          />
        </View>
      </Screen>
    );
  }

  if (!planState.entitlements.community) {
    return (
      <Screen scroll={false} title={title} backFallback={backFallback}>
        <View style={styles.center}>
          <VEmptyState
            title={t('community.title')}
            message={t('community.planRequired')}
            action={{ label: t('market.communityCta'), onPress: () => router.push(routes.paywall()) }}
          />
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
});
