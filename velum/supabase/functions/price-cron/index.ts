/**
 * Edge Function `price-cron` — revalorisation et alertes planifiées.
 *
 * Le service-role parcourt les objets, mais les capacités produit restent
 * déterminées par `PLAN_LIMITS` :
 *   - Free : aucun travail planifié ;
 *   - Premium / Gold : alertes uniquement ;
 *   - Platine : alertes + valorisation continue des cotes anciennes.
 *
 * Le déclenchement d'une alerte passe par `record_alert_evaluation` : PostgreSQL
 * verrouille l'alerte, insère la notification et met à jour son état dans une
 * transaction unique. Une condition qui reste vraie ne spamme donc plus chaque jour.
 */
import {
  isVelumError,
  type Candidate,
  type FxRates,
  type ValuationResult,
  type VelumDomain,
  type WineAnalysisPayload,
} from '@velum/core';
import { valuate as runValuation } from '@velum/valuation';
import { isInDrinkWindow } from '@velum/domain-wine';
import { createAdminClient } from '../_shared/auth.ts';
import { buildSources, plugins } from '../_shared/domains.ts';
import { getFxRates } from '../_shared/fx.ts';
import { error, json } from '../_shared/respond.ts';
import { serverTransport } from '../_shared/transport.ts';
import {
  isValuationStale,
  parsePlanId,
  scheduledItemDecision,
  scheduledPlanCapabilities,
} from './eligibility.ts';

const BATCH_SIZE = 50;
const STALE_AFTER_DAYS = 7;

interface ItemRow {
  id: string;
  owner_id: string;
  domain: VelumDomain;
  title: string | null;
  attributes: Record<string, unknown>;
  confidence: number | null;
  condition: string | null;
}

interface AlertRow {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface NotificationInsert {
  owner_id: string;
  title: string;
  body: string;
}

interface AlertEvaluationOutcome {
  inserted: boolean;
  error: string | null;
}

function logFailure(event: string, fields: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      event,
      ...fields,
    }),
  );
}

/** Reconstruit un Candidate depuis une ligne `items`. */
function candidateFromItem(item: ItemRow): Candidate {
  return {
    id: item.id,
    domain: item.domain,
    label: item.title ?? '',
    confidence: item.confidence ?? 0.5,
    attributes: item.attributes ?? {},
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Demande à PostgreSQL d'enregistrer l'évaluation. `data` contient l'UUID de la
 * notification uniquement lors d'un nouveau passage faux → vrai.
 */
async function recordAlertEvaluation(
  admin: ReturnType<typeof createAdminClient>,
  alertId: string,
  conditionMet: boolean,
  notification: NotificationInsert,
): Promise<AlertEvaluationOutcome> {
  const { data, error: rpcError } = await admin.rpc('record_alert_evaluation', {
    p_alert_id: alertId,
    p_condition_met: conditionMet,
    p_title: notification.title,
    p_body: notification.body,
  });

  if (rpcError) {
    return { inserted: false, error: rpcError.message };
  }
  return {
    inserted: typeof data === 'string' && data.length > 0,
    error: null,
  };
}

export async function handler(req: Request): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return error('UNAUTHORIZED', 'Secret cron invalide', 401);
  }

  const admin = createAdminClient();
  const now = Date.now();
  const staleBefore = new Date(now - STALE_AFTER_DAYS * 86_400_000).toISOString();
  const currentYear = new Date(now).getUTCFullYear();
  let fxPromise: Promise<FxRates> | null = null;
  const loadFx = (): Promise<FxRates> => {
    fxPromise ??= getFxRates();
    return fxPromise;
  };

  let processed = 0;
  let eligible = 0;
  let revalued = 0;
  let notified = 0;
  let failures = 0;

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data: rawItems, error: itemsError } = await admin
      .from('items')
      .select('id, owner_id, domain, title, attributes, confidence, condition')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (itemsError) {
      logFailure('price_cron.items_read_failed', { message: itemsError.message });
      return error('SOURCE_UNAVAILABLE', 'Lecture des items impossible', 503);
    }

    const items = (rawItems ?? []) as ItemRow[];
    if (items.length === 0) break;

    const ownerIds = uniqueStrings(items.map((item) => item.owner_id));
    const { data: rawProfiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, plan')
      .in('id', ownerIds);

    if (profilesError) {
      logFailure('price_cron.profiles_read_failed', { message: profilesError.message });
      return error('SOURCE_UNAVAILABLE', 'Lecture des droits produit impossible', 503);
    }

    const planByOwner = new Map<string, ReturnType<typeof parsePlanId>>();
    for (const row of rawProfiles ?? []) {
      const id = typeof row.id === 'string' ? row.id : null;
      if (id !== null) planByOwner.set(id, parsePlanId(row.plan));
    }

    for (const item of items) {
      processed += 1;

      const plan = planByOwner.get(item.owner_id) ?? null;
      if (plan === null) {
        logFailure('price_cron.plan_missing_or_invalid', {
          itemId: item.id,
          ownerId: item.owner_id,
        });
        failures += 1;
        continue;
      }

      const capabilities = scheduledPlanCapabilities(plan);
      if (!capabilities.alerts && !capabilities.liveValuation) continue;

      let activeAlerts: AlertRow[] = [];
      if (capabilities.alerts) {
        const { data: rawAlerts, error: alertsError } = await admin
          .from('alerts')
          .select('id, type, config')
          .eq('item_id', item.id)
          .eq('active', true);

        if (alertsError) {
          failures += 1;
          logFailure('price_cron.alerts_read_failed', {
            itemId: item.id,
            message: alertsError.message,
          });
          continue;
        }
        activeAlerts = (rawAlerts ?? []) as AlertRow[];
      }

      let isStale = false;
      if (capabilities.liveValuation) {
        const { data: lastValuations, error: valuationReadError } = await admin
          .from('valuations')
          .select('valued_at')
          .eq('item_id', item.id)
          .order('valued_at', { ascending: false })
          .limit(1);

        if (valuationReadError) {
          failures += 1;
          logFailure('price_cron.last_valuation_read_failed', {
            itemId: item.id,
            message: valuationReadError.message,
          });
          continue;
        }
        isStale = isValuationStale(lastValuations?.[0]?.valued_at, staleBefore);
      }

      const decision = scheduledItemDecision(plan, {
        activeAlertTypes: activeAlerts.map((alert) => alert.type),
        isStale,
      });
      if (!decision.evaluateAlerts && !decision.refreshValuation) continue;
      eligible += 1;

      let result: ValuationResult | null = null;
      if (decision.refreshValuation) {
        const sources = buildSources(item.domain, serverTransport);
        if (sources.length > 0) {
          try {
            result = await plugins[item.domain].valuate(candidateFromItem(item), {
              sources,
              fx: await loadFx(),
              valuate: (observations, rates) => runValuation(observations, rates),
            });
          } catch (cause) {
            if (!(isVelumError(cause) && cause.code === 'NO_OBSERVATIONS')) {
              failures += 1;
              logFailure('price_cron.valuation_failed', {
                itemId: item.id,
                message: cause instanceof Error ? cause.message : String(cause),
              });
            }
          }
        }
      }

      if (result !== null) {
        const { error: insertError } = await admin.from('valuations').insert({
          item_id: item.id,
          central: result.central,
          ci80_low: result.ci80[0],
          ci80_high: result.ci80[1],
          ci95_low: result.ci95[0],
          ci95_high: result.ci95[1],
          reliability: result.reliability,
          sources: result.observations,
        });
        if (insertError) {
          failures += 1;
          logFailure('price_cron.valuation_insert_failed', {
            itemId: item.id,
            message: insertError.message,
          });
        } else {
          revalued += 1;
        }
      }

      if (!decision.evaluateAlerts) continue;

      let winePayload: WineAnalysisPayload | undefined;
      let winePayloadAvailable = true;
      if (item.domain === 'wine' && activeAlerts.some((alert) => alert.type === 'drink_window')) {
        const { data: analyses, error: analysesError } = await admin
          .from('analyses')
          .select('payload')
          .eq('item_id', item.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (analysesError) {
          failures += 1;
          winePayloadAvailable = false;
          logFailure('price_cron.analysis_read_failed', {
            itemId: item.id,
            message: analysesError.message,
          });
        } else {
          winePayload = (analyses?.[0]?.payload ?? item.attributes['analysis']) as
            | WineAnalysisPayload
            | undefined;
        }
      }

      const pushNotifications: NotificationInsert[] = [];
      for (const alert of activeAlerts) {
        let conditionMet: boolean | null = null;
        let notification: NotificationInsert | null = null;

        if (alert.type === 'price_threshold' && result !== null) {
          const direction = alert.config['direction'];
          const threshold = alert.config['threshold'];
          if (
            (direction !== 'above' && direction !== 'below') ||
            typeof threshold !== 'number' ||
            !Number.isFinite(threshold)
          ) {
            failures += 1;
            logFailure('price_cron.alert_config_invalid', {
              alertId: alert.id,
              itemId: item.id,
              type: alert.type,
            });
            continue;
          }

          conditionMet =
            (direction === 'above' && result.central >= threshold) ||
            (direction === 'below' && result.central <= threshold);
          const label = item.title ?? 'Votre objet';
          notification = {
            owner_id: item.owner_id,
            title: 'Alerte de prix',
            body:
              direction === 'above'
                ? `${label} est estimé à ${result.central} € — au-dessus de votre seuil de ${threshold} €.`
                : `${label} est estimé à ${result.central} € — en dessous de votre seuil de ${threshold} €.`,
          };
        }

        if (
          alert.type === 'drink_window' &&
          item.domain === 'wine' &&
          winePayloadAvailable &&
          winePayload !== undefined
        ) {
          conditionMet = isInDrinkWindow(winePayload, currentYear);
          const pairings = (winePayload.comparisons?.foodPairings ?? [])
            .filter((dish): dish is string => typeof dish === 'string')
            .slice(0, 2);
          const label = item.title ?? 'Une de vos bouteilles';
          const closing = winePayload.tasting?.drinkWindow?.to;
          notification = {
            owner_id: item.owner_id,
            title: 'À boire — apogée atteinte',
            body:
              `${label} est dans sa fenêtre de consommation optimale` +
              (typeof closing === 'number' ? ` (jusqu'en ${closing})` : '') +
              '.' +
              (pairings.length > 0 ? ` Accord suggéré : ${pairings.join(' ou ')}.` : ''),
          };
        }

        if (conditionMet === null || notification === null) continue;

        const evaluation = await recordAlertEvaluation(
          admin,
          alert.id,
          conditionMet,
          notification,
        );
        if (evaluation.error !== null) {
          failures += 1;
          logFailure('price_cron.alert_evaluation_failed', {
            alertId: alert.id,
            itemId: item.id,
            message: evaluation.error,
          });
          continue;
        }
        if (evaluation.inserted) {
          notified += 1;
          pushNotifications.push(notification);
        }
      }

      if (pushNotifications.length > 0) {
        await sendExpoPush(admin, pushNotifications);
      }
    }

    if (items.length < BATCH_SIZE) break;
  }

  return json({ processed, eligible, revalued, notified, failures });
}

/** Envoi push Expo best-effort ; la notification in-app reste la source durable. */
async function sendExpoPush(
  admin: ReturnType<typeof createAdminClient>,
  notifications: NotificationInsert[],
): Promise<void> {
  try {
    const ownerIds = uniqueStrings(notifications.map((notification) => notification.owner_id));
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, expo_push_token')
      .in('id', ownerIds)
      .not('expo_push_token', 'is', null);

    if (profilesError) {
      logFailure('price_cron.push_profiles_read_failed', { message: profilesError.message });
      return;
    }

    const tokenByOwner = new Map<string, string>(
      (profiles ?? [])
        .filter(
          (profile): profile is { id: string; expo_push_token: string } =>
            typeof profile.id === 'string' && typeof profile.expo_push_token === 'string',
        )
        .map((profile) => [profile.id, profile.expo_push_token]),
    );

    const messages = notifications
      .filter((notification) => tokenByOwner.has(notification.owner_id))
      .map((notification) => ({
        to: tokenByOwner.get(notification.owner_id),
        title: notification.title,
        body: notification.body,
        sound: 'default',
      }));

    for (let index = 0; index < messages.length; index += 100) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(index, index + 100)),
      });
      if (!response.ok) {
        logFailure('price_cron.push_send_failed', {
          status: response.status,
          body: (await response.text()).slice(0, 500),
        });
      }
    }
  } catch (cause) {
    logFailure('price_cron.push_unavailable', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

if (import.meta.main) Deno.serve(handler);
