/**
 * Hooks partagés des écrans « Échanges & ventes » : lectures React Query du
 * dépôt MarketplaceRepo (clés centralisées dans lib/marketQuery) et retour
 * d'erreur uniforme des actions.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import { communityKeys } from '../../lib/marketQuery';
import { completedSalesCount, isNotYetAvailable, marketRetry } from '../../lib/marketState';
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
 * Nombre de MES ventes conclues (base du taux dégressif). `known` = false tant
 * que les commandes ne sont pas lues (ou en panne) : l'aperçu affiche alors le
 * taux de départ (le plus élevé), jamais un taux trop favorable.
 */
export function useCompletedSales(): { completedSales: number; known: boolean; isLoading: boolean } {
  const orders = useMyOrders();
  return {
    completedSales: orders.data ? completedSalesCount(orders.data) : 0,
    known: orders.data !== undefined,
    isLoading: orders.isLoading,
  };
}
