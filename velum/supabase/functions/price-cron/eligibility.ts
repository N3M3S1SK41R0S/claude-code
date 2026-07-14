import { PLAN_LIMITS, type PlanId } from '@velum/config';

const PLAN_IDS: readonly PlanId[] = ['free', 'premium', 'gold', 'platine'];

export interface ScheduledPlanCapabilities {
  alerts: boolean;
  liveValuation: boolean;
}

export interface ScheduledItemState {
  activeAlertTypes: readonly string[];
  isStale: boolean;
}

export interface ScheduledItemDecision {
  /** Les alertes actives peuvent être évaluées pour ce plan. */
  evaluateAlerts: boolean;
  /** Une nouvelle observation de prix doit être calculée. */
  refreshValuation: boolean;
}

/** Valide un plan relu depuis Postgres ; aucune valeur inconnue n'est promue. */
export function parsePlanId(value: unknown): PlanId | null {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value)
    ? (value as PlanId)
    : null;
}

/** Sous-ensemble des droits réellement consommés par le cron de valorisation. */
export function scheduledPlanCapabilities(plan: PlanId): ScheduledPlanCapabilities {
  const entitlements = PLAN_LIMITS[plan];
  return {
    alerts: entitlements.alerts,
    liveValuation: entitlements.liveValuation,
  };
}

/**
 * Décide séparément l'évaluation des alertes et le recalcul de prix :
 * - aucune tâche planifiée pour Free ;
 * - Premium/Gold évaluent leurs alertes, sans valorisation périodique ;
 * - une alerte de prix exige une nouvelle valorisation ;
 * - Platine ajoute la valorisation continue des objets devenus obsolètes ;
 * - une alerte « à boire » peut être évaluée sans appeler une source de prix.
 */
export function scheduledItemDecision(
  plan: PlanId,
  state: ScheduledItemState,
): ScheduledItemDecision {
  const capabilities = scheduledPlanCapabilities(plan);
  const alertTypes = capabilities.alerts ? state.activeAlertTypes : [];
  const evaluateAlerts = alertTypes.length > 0;
  const hasPriceThreshold = alertTypes.includes('price_threshold');

  return {
    evaluateAlerts,
    refreshValuation:
      hasPriceThreshold || (capabilities.liveValuation && state.isStale),
  };
}

/** true quand au moins une branche du cron a un travail autorisé à effectuer. */
export function shouldProcessScheduledItem(
  plan: PlanId,
  state: ScheduledItemState,
): boolean {
  const decision = scheduledItemDecision(plan, state);
  return decision.evaluateAlerts || decision.refreshValuation;
}

/**
 * Interprète défensivement l'horodatage PostgREST. Une valeur absente ou
 * illisible est considérée obsolète plutôt que fraîche à tort.
 */
export function isValuationStale(
  lastValuedAt: unknown,
  staleBeforeIso: string,
): boolean {
  const boundary = Date.parse(staleBeforeIso);
  if (!Number.isFinite(boundary)) {
    throw new RangeError('La borne de fraîcheur doit être une date ISO valide');
  }
  if (typeof lastValuedAt !== 'string') return true;
  const valuedAt = Date.parse(lastValuedAt);
  return !Number.isFinite(valuedAt) || valuedAt <= boundary;
}
