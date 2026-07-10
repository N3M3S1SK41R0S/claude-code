/**
 * Règles de plan PURES (aucune dépendance React Native) — testables en vitest.
 * Grille juillet 2026 : free / premium / gold / platine (@velum/config).
 */
import { PLAN_LIMITS, type PlanEntitlements, type PlanId } from '@velum/config';

const PLAN_ORDER: readonly PlanId[] = ['free', 'premium', 'gold', 'platine'];

/** Rang du palier (free=0 … platine=3). */
export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** true si le palier possède le droit demandé (source unique : PLAN_LIMITS). */
export function hasEntitlement(plan: PlanId, key: keyof PlanEntitlements): boolean {
  return Boolean(PLAN_LIMITS[plan][key]);
}
