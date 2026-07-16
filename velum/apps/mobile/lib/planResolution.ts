import { PLAN_LIMITS, type PlanEntitlements, type PlanId } from '@velum/config';
import { VelumError, type Profile } from '@velum/core';

/** Droits dérivés d'un profil effectivement relu côté serveur. */
export interface ReadyPlan {
  profileId: string;
  plan: PlanId;
  entitlements: PlanEntitlements;
}

/**
 * Convertit un profil confirmé en droits produit. Un profil absent n'est jamais
 * assimilé au plan Free : il s'agit d'une donnée serveur manquante.
 *
 * Ce module reste volontairement pur et sans import React/React Native afin que
 * l'invariant puisse être testé par Vitest sans charger le runtime mobile.
 */
export function planFromProfile(profile: Profile | null): ReadyPlan {
  if (profile === null) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      "Le profil d'abonnement est indisponible — impossible de vérifier vos droits.",
    );
  }

  const plan: PlanId = profile.plan;
  return {
    profileId: profile.id,
    plan,
    entitlements: PLAN_LIMITS[plan],
  };
}
