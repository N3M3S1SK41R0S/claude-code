/**
 * Feature flags produit : lus depuis `app.config.ts` (extra.features) via
 * expo-constants, avec repli sur DEFAULT_FEATURES de @velum/config.
 */
import Constants from 'expo-constants';
import { DEFAULT_FEATURES, activeDomains, type VelumFeatures } from '@velum/config';
import type { VelumDomain } from '@velum/core';

import { isDemoMode } from './env';

export function getFeatures(): VelumFeatures {
  const extra = Constants.expoConfig?.extra as { features?: Partial<VelumFeatures> } | undefined;
  return { ...DEFAULT_FEATURES, ...(extra?.features ?? {}) };
}

/** Domaines actifs selon les flags (les 4 modules par défaut). */
export function getActiveDomains(): VelumDomain[] {
  return activeDomains(getFeatures());
}

/**
 * Échanges & ventes ouverts : drapeau produit `enableMarketplace` (rails de
 * paiement / KYC), toujours vrai en démo (aucune transaction réelle). Source
 * UNIQUE pour tous les accès : onglet Marché, accès rapides (Collection,
 * accueil), Profil « Mes espaces », recherche globale.
 */
export function marketplaceEnabled(): boolean {
  return getFeatures().enableMarketplace || isDemoMode();
}
