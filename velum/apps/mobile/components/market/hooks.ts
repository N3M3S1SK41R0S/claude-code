/**
 * Hooks partagés des écrans « Échanges & ventes » : lectures React Query du
 * dépôt MarketplaceRepo (clés centralisées dans lib/marketQuery) et retour
 * d'erreur uniforme des actions.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { VelumError } from '@velum/core';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { commissionBasisState, type CommissionBasis, type CommissionBasisStatus } from '../../lib/marketCommission';
import { communityKeys } from '../../lib/marketQuery';
import { isNotYetAvailable, marketRetry } from '../../lib/marketState';
import { showToast } from '../../stores/toastStore';

export { marketRetry };

/** Invalide toutes les lectures de la communauté (après une action). */
export function useInvalidateCommunity(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: communityKeys.all });
  }, [queryClient]);
}

/** Toast d'erreur d'action : message honnête si la fonction serveur n'est pas encore câblée. */
export function useMarketErrorToast(): (error: unknown) => void {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown) => {
      showToast(
        isNotYetAvailable(error) ? t('community.notYetAvailable') : errorMessage(error, t),
        'danger',
      );
    },
    [t],
  );
}

export function useMyOrders() {
  const client = getVelumClient();
  return useQuery({
    queryKey: communityKeys.orders,
    queryFn: () => client.marketplace.myOrders(),
    retry: marketRetry,
  });
}

export function useMyListings() {
  const client = getVelumClient();
  return useQuery({
    queryKey: communityKeys.myListings,
    queryFn: () => client.marketplace.myListings(),
    retry: marketRetry,
  });
}

export function useMyExchanges() {
  const client = getVelumClient();
  return useQuery({
    queryKey: communityKeys.exchanges,
    queryFn: () => client.marketplace.myExchanges(),
    retry: marketRetry,
  });
}

export function useMyCertifications() {
  const client = getVelumClient();
  return useQuery({
    queryKey: communityKeys.certifications,
    queryFn: () => client.marketplace.myCertifications(),
    retry: marketRetry,
  });
}

/**
 * Synthèse de MON commissionnement (serveur : `my_commission_summary`) — taux
 * actuel, ventes retenues pour le palier, totaux du registre. Méthode absente
 * du dépôt injecté : « bientôt disponible » (jamais un faux taux).
 */
export function useCommissionSummary() {
  const client = getVelumClient();
  return useQuery({
    queryKey: communityKeys.commission,
    queryFn: () => {
      const repo = client.marketplace;
      if (repo.commissionSummary === undefined) {
        throw new VelumError('SOURCE_UNAVAILABLE', 'Synthèse des commissions pas encore disponible');
      }
      return repo.commissionSummary();
    },
    retry: marketRetry,
  });
}

/**
 * Base de commission des aperçus : taux ACTUEL du serveur, ou le taux
 * MAXIMAL tant qu'il n'est pas connu (chargement, hors-ligne, panne) — avec
 * l'état pour la mention explicite (lib/marketCommission).
 */
export function useCommissionBasis(): { basis: CommissionBasis; status: CommissionBasisStatus } {
  const summary = useCommissionSummary();
  return commissionBasisState({
    data: summary.data,
    isError: summary.isError,
    isPending: summary.isPending,
    fetchStatus: summary.fetchStatus,
  });
}
