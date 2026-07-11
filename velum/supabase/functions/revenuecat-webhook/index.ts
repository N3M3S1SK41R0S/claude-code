/**
 * Edge Function `revenuecat-webhook` — synchronisation serveur du plan.
 *
 * RevenueCat envoie un événement à chaque changement d'abonnement
 * (INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION, EXPIRATION…).
 * On en dérive profiles.plan (free/premium/gold/platine) : le quota
 * consume_scan et les droits carnet/communauté ne se fient JAMAIS au client.
 *
 * Sécurité : RevenueCat est configuré pour joindre un en-tête
 * `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` — toute requête sans
 * ce secret est rejetée. app_user_id = uid Supabase (Purchases.logIn(uid)
 * côté app).
 */
import { createAdminClient } from '../_shared/auth.ts';
import { error, json } from '../_shared/respond.ts';

/** Palier VELUM déduit d'une liste d'entitlements RevenueCat actifs. */
export function planFromEntitlements(entitlements: string[]): 'free' | 'premium' | 'gold' | 'platine' {
  const lower = entitlements.map((e) => e.toLowerCase());
  if (lower.some((e) => e.includes('platine') || e.includes('platinum'))) return 'platine';
  if (lower.some((e) => e.includes('gold'))) return 'gold';
  if (lower.some((e) => e.includes('premium'))) return 'premium';
  return 'free';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  }

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return error('UNAUTHORIZED', 'Signature du webhook invalide', 401);
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return error('INVALID_INPUT', 'Corps JSON invalide', 400);
  }
  const event = body.event ?? {};
  const type = typeof event['type'] === 'string' ? (event['type'] as string) : '';
  if (type === 'TEST') return json({ ok: true, ignored: 'TEST' });

  // app_user_id : uid Supabase (les alias $RCAnonymousID sont ignorés —
  // le plan sera réconcilié après Purchases.logIn).
  const appUserId = typeof event['app_user_id'] === 'string' ? (event['app_user_id'] as string) : '';
  if (!UUID_RE.test(appUserId)) {
    return json({ ok: true, ignored: 'app_user_id non lié à un compte VELUM' });
  }

  // EXPIRATION sans entitlement restant → retour au plan gratuit.
  const rawEntitlements = Array.isArray(event['entitlement_ids'])
    ? (event['entitlement_ids'] as unknown[]).filter((e): e is string => typeof e === 'string')
    : [];
  const plan =
    type === 'EXPIRATION' || type === 'CANCELLATION'
      ? 'free'
      : planFromEntitlements(rawEntitlements);

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from('profiles')
    .update({ plan })
    .eq('id', appUserId);
  if (updateError) {
    console.error('[revenuecat-webhook] mise à jour du plan :', updateError.message);
    return error('SOURCE_UNAVAILABLE', 'Mise à jour du plan impossible', 503);
  }

  return json({ ok: true, plan });
}

// Ne sert QUE lorsqu'exécuté comme module principal ; importable en test.
if (import.meta.main) Deno.serve(handler);
