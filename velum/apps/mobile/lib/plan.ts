/**
 * Plan d'abonnement effectif (grille juillet 2026 : free/premium/gold/platine).
 * Source de vérité : profiles.plan (synchronisé côté serveur avec RevenueCat) ;
 * les droits sont dérivés de PLAN_LIMITS (@velum/config) — source unique.
 */
import { useQuery } from '@tanstack/react-query';
import type { PlanEntitlements, PlanId } from '@velum/config';
import { VelumError } from '@velum/core';

import { getVelumClient } from './client';
import { planFromProfile } from './planResolution';

export { hasEntitlement, planRank } from './planRules';
export { planFromProfile, type ReadyPlan } from './planResolution';

interface PlanStateBase {
  /** Relance explicitement la lecture du profil après une panne. */
  retry(): void;
}

export type PlanState =
  | (PlanStateBase & {
      status: 'loading';
      profileId: null;
      plan: null;
      entitlements: null;
      isLoading: true;
      isError: false;
      error: null;
    })
  | (PlanStateBase & {
      status: 'error';
      profileId: null;
      plan: null;
      entitlements: null;
      isLoading: false;
      isError: true;
      error: unknown;
    })
  | (PlanStateBase & {
      status: 'ready';
      profileId: string;
      plan: PlanId;
      entitlements: PlanEntitlements;
      isLoading: false;
      isError: false;
      error: null;
    });

/**
 * Plan de l'utilisateur connecté. Les écrans doivent distinguer explicitement
 * chargement, panne et plan confirmé afin de ne jamais transformer une panne
 * réseau/PostgREST en faux compte Free ou en faux paywall.
 */
export function usePlan(): PlanState {
  const client = getVelumClient();
  const query = useQuery({
    queryKey: ['profile', 'plan'],
    queryFn: async () => planFromProfile(await client.profile.get()),
    staleTime: 5 * 60 * 1000,
  });
  const retry = () => {
    void query.refetch();
  };

  if (query.isLoading) {
    return {
      status: 'loading',
      profileId: null,
      plan: null,
      entitlements: null,
      isLoading: true,
      isError: false,
      error: null,
      retry,
    };
  }

  if (query.isError) {
    return {
      status: 'error',
      profileId: null,
      plan: null,
      entitlements: null,
      isLoading: false,
      isError: true,
      error: query.error,
      retry,
    };
  }

  // Défense contre un état React Query impossible/incomplet : ne jamais déduire Free.
  if (query.data === undefined) {
    return {
      status: 'error',
      profileId: null,
      plan: null,
      entitlements: null,
      isLoading: false,
      isError: true,
      error: new VelumError('SOURCE_UNAVAILABLE', "Le profil d'abonnement n'a pas été chargé."),
      retry,
    };
  }

  return {
    status: 'ready',
    profileId: query.data.profileId,
    plan: query.data.plan,
    entitlements: query.data.entitlements,
    isLoading: false,
    isError: false,
    error: null,
    retry,
  };
}
