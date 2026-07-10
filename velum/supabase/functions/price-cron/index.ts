/**
 * Edge Function `price-cron` — re-valorisation quotidienne planifiée.
 *
 * Déclenchée par pg_cron (migration 0002) via net.http_post avec l'en-tête
 * `x-cron-secret`. Parcourt les items par lots de 50 (client service-role),
 * re-valorise ceux qui ont au moins une alerte active OU dont la dernière
 * valorisation date de 7 jours ou plus, insère les nouvelles valorisations,
 * puis évalue les alertes :
 *   - price_threshold : config { direction: 'above'|'below', threshold: number }
 *   - drink_window    : fenêtre de consommation optimale (vin, module 2 ZAPPA)
 * → insertion de notifications in-app.
 */
import {
  isVelumError,
  type Candidate,
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

/** Reconstruit un Candidate depuis la ligne items (pour plugin.valuate). */
function candidateFromItem(item: ItemRow): Candidate {
  return {
    id: item.id,
    domain: item.domain,
    label: item.title ?? '',
    confidence: item.confidence ?? 0.5,
    attributes: item.attributes ?? {},
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Sécurité : secret partagé avec pg_cron (vault) — pas d'auth utilisateur.
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return error('UNAUTHORIZED', 'Secret cron invalide', 401);
  }

  const admin = createAdminClient();
  const fx = await getFxRates();
  const now = Date.now();
  const staleBefore = new Date(now - STALE_AFTER_DAYS * 86_400_000).toISOString();
  const currentYear = new Date(now).getUTCFullYear();

  let processed = 0;
  let revalued = 0;
  let notified = 0;
  let failures = 0;

  // Parcours par lots de 50, ordonné par id pour une pagination stable.
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data: items, error: itemsError } = await admin
      .from('items')
      .select('id, owner_id, domain, title, attributes, confidence, condition')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (itemsError) {
      console.error('[price-cron] lecture des items impossible :', itemsError.message);
      return error('SOURCE_UNAVAILABLE', 'Lecture des items impossible', 503);
    }
    if (!items || items.length === 0) break;

    for (const item of items as ItemRow[]) {
      processed += 1;

      // Alertes actives de l'item.
      const { data: alerts } = await admin
        .from('alerts')
        .select('id, type, config')
        .eq('item_id', item.id)
        .eq('active', true);
      const activeAlerts = (alerts ?? []) as AlertRow[];

      // Dernière valorisation (fraîcheur).
      const { data: lastValuations } = await admin
        .from('valuations')
        .select('valued_at')
        .eq('item_id', item.id)
        .order('valued_at', { ascending: false })
        .limit(1);
      const lastValuedAt = lastValuations?.[0]?.valued_at as string | undefined;
      const isStale = !lastValuedAt || lastValuedAt <= staleBefore;

      // Éligible : au moins une alerte active OU valorisation vieille de ≥ 7 j.
      if (activeAlerts.length === 0 && !isStale) continue;

      // ── Re-valorisation ────────────────────────────────────────────────
      let result: ValuationResult | null = null;
      const sources = buildSources(item.domain, serverTransport);
      if (sources.length > 0) {
        try {
          result = await plugins[item.domain].valuate(candidateFromItem(item), {
            sources,
            fx,
            valuate: (obs, fxRates) => runValuation(obs, fxRates),
          });
        } catch (err) {
          if (isVelumError(err) && err.code === 'NO_OBSERVATIONS') {
            // Pas de prix disponible : on passe sans bruit.
          } else {
            failures += 1;
            console.error(`[price-cron] valorisation de ${item.id} échouée :`, err);
          }
        }
      }

      if (result) {
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
          console.error(`[price-cron] insertion valuation ${item.id} :`, insertError.message);
        } else {
          revalued += 1;
        }
      }

      // ── Évaluation des alertes ─────────────────────────────────────────
      const notifications: { owner_id: string; title: string; body: string }[] = [];

      for (const alert of activeAlerts) {
        if (alert.type === 'price_threshold' && result) {
          const direction = alert.config['direction'];
          const threshold = alert.config['threshold'];
          if (typeof threshold !== 'number' || !Number.isFinite(threshold)) continue;
          const crossed =
            (direction === 'above' && result.central >= threshold) ||
            (direction === 'below' && result.central <= threshold);
          if (crossed) {
            const label = item.title ?? 'Votre objet';
            notifications.push({
              owner_id: item.owner_id,
              title: 'Alerte de prix',
              body:
                direction === 'above'
                  ? `${label} est estimé à ${result.central} € — au-dessus de votre seuil de ${threshold} €.`
                  : `${label} est estimé à ${result.central} € — en dessous de votre seuil de ${threshold} €.`,
            });
          }
        }

        if (alert.type === 'drink_window' && item.domain === 'wine') {
          // Dernière fiche d'analyse ZAPPA : fenêtre de consommation optimale.
          const { data: analyses } = await admin
            .from('analyses')
            .select('payload')
            .eq('item_id', item.id)
            .order('created_at', { ascending: false })
            .limit(1);
          // Repli : l'app mobile persiste aussi l'analyse dans
          // items.attributes.analysis (aucune ligne `analyses` dans ce cas).
          const payload = (analyses?.[0]?.payload ??
            (item.attributes as { analysis?: unknown })['analysis']) as
            | WineAnalysisPayload
            | undefined;
          if (payload && isInDrinkWindow(payload, currentYear)) {
            // Alerte transversale (sens 2) : apogée + accords mets-vins ZAPPA
            // (« ce vin est prêt — servez-le par exemple avec… »).
            const pairings = (payload.comparisons?.foodPairings ?? [])
              .filter((d): d is string => typeof d === 'string')
              .slice(0, 2);
            const label = item.title ?? 'Une de vos bouteilles';
            const closing = payload.tasting?.drinkWindow?.to;
            notifications.push({
              owner_id: item.owner_id,
              title: 'À boire — apogée atteinte',
              body:
                `${label} est dans sa fenêtre de consommation optimale` +
                (typeof closing === 'number' ? ` (jusqu'en ${closing})` : '') +
                '.' +
                (pairings.length > 0 ? ` Accord suggéré : ${pairings.join(' ou ')}.` : ''),
            });
          }
        }
      }

      if (notifications.length > 0) {
        const { error: notifError } = await admin.from('notifications').insert(notifications);
        if (notifError) {
          failures += 1;
          console.error(`[price-cron] insertion notifications ${item.id} :`, notifError.message);
        } else {
          notified += notifications.length;
          await sendExpoPush(admin, notifications);
        }
      }
    }

    if (items.length < BATCH_SIZE) break;
  }

  return json({ processed, revalued, notified, failures });
});

/**
 * Envoi push Expo (best-effort, jamais bloquant pour le cron) :
 * POST https://exp.host/--/api/v2/push/send avec le jeton enregistré par
 * l'app dans profiles.expo_push_token. Les profils sans jeton sont ignorés
 * (la notification in-app reste visible dans l'onglet Marché).
 */
async function sendExpoPush(
  admin: ReturnType<typeof createAdminClient>,
  notifications: { owner_id: string; title: string; body: string }[],
): Promise<void> {
  try {
    const ownerIds = [...new Set(notifications.map((n) => n.owner_id))];
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, expo_push_token')
      .in('id', ownerIds)
      .not('expo_push_token', 'is', null);
    const tokenByOwner = new Map<string, string>(
      (profiles ?? []).map((p) => [p.id as string, p.expo_push_token as string]),
    );

    const messages = notifications
      .filter((n) => tokenByOwner.has(n.owner_id))
      .map((n) => ({
        to: tokenByOwner.get(n.owner_id),
        title: n.title,
        body: n.body,
        sound: 'default',
      }));
    if (messages.length === 0) return;

    // L'API Expo accepte des lots de 100 messages maximum.
    for (let i = 0; i < messages.length; i += 100) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      if (!response.ok) {
        console.error('[price-cron] push Expo :', response.status, await response.text());
      }
    }
  } catch (err) {
    console.error('[price-cron] push Expo (non bloquant) :', err);
  }
}
