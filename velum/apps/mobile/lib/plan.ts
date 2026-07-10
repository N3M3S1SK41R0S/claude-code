/**
 * Plan d'abonnement effectif (grille juillet 2026 : free/premium/gold/platine).
 * Source de vérité : profiles.plan (synchronisé côté serveur avec RevenueCat) ;
 * les droits sont dérivés de PLAN_LIMITS (@velum/config) — source unique.
 */
import { useQuery } from '@tanstack/react-query';
import { PLAN_LIMITS, type PlanEntitlements, type PlanId } from '@velum/config';

import { getVelumClient } from './client';

export { hasEntitlement, planRank } from './planRules';

export interface PlanState {
  plan: PlanId;
  entitlements: PlanEntitlements;
  isLoading: boolean;
}

/** Plan de l'utilisateur connecté (repli prudent : 'free'). */
export function usePlan(): PlanState {
  const client = getVelumClient();
  const query = useQuery({
    queryKey: ['profile', 'plan'],
    queryFn: () => client.profile.get(),
    staleTime: 5 * 60 * 1000,
  });
  const plan: PlanId = query.data?.plan ?? 'free';
  return { plan, entitlements: PLAN_LIMITS[plan], isLoading: query.isLoading };
}
