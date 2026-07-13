/**
 * Feature flags produit : lus depuis `app.config.ts` (extra.features) via
 * expo-constants, avec repli sur DEFAULT_FEATURES de @velum/config.
 */
import Constants from 'expo-constants';
import { DEFAULT_FEATURES, activeDomains, type VelumFeatures } from '@velum/config';
import type { VelumDomain } from '@velum/core';

export function getFeatures(): VelumFeatures {
  const extra = Constants.expoConfig?.extra as { features?: Partial<VelumFeatures> } | undefined;
  return { ...DEFAULT_FEATURES, ...(extra?.features ?? {}) };
}

/** Domaines actifs selon les flags (les 4 modules par défaut). */
export function getActiveDomains(): VelumDomain[] {
  return activeDomains(getFeatures());
}
