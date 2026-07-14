/**
 * Edge Function `arbiter` — arbitre boire/garder/vendre (offre Gold+, pari #3).
 *
 * POST { itemId: string, currentYear?: number }
 *   → auth (Bearer) → vérification du plan (gold | platine)
 *   → lecture de l'objet (fenêtre d'apogée depuis la dernière analyse ZAPPA)
 *     + de sa trajectoire de valorisation (valuation_snapshots, RLS active)
 *   → moteur `arbitrate` (@velum/valuation) avec son garde-fou anti-market-timing
 *   → ArbiterSignal (jamais un ordre de bourse : indicatif, disclaimers en aval).
 */
import type { VelumDomain, WineAnalysisPayload } from '@velum/core';
import { arbitrate, type TrajectoryPoint } from '@velum/valuation';
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';

const ENTITLED_PLANS = new Set(['gold', 'platine']);

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  }

  const auth = await getUser(req);
  if (!auth) {
    return error('UNAUTHORIZED', 'Authentification requise', 401);
  }

  let body: { itemId?: unknown; currentYear?: unknown };
  try {
    body = await req.json();
  } catch {
    return error('INVALID_INPUT', 'Corps JSON invalide', 400);
  }
  const itemId = typeof body.itemId === 'string' ? body.itemId : '';
  if (itemId.length === 0) {
    return error('INVALID_INPUT', "Champ 'itemId' requis", 400);
  }
  const currentYear =
    typeof body.currentYear === 'number' && Number.isFinite(body.currentYear)
      ? body.currentYear
      : new Date().getUTCFullYear();

  // L'arbitre fait partie du carnet virtuel : Gold et Platine.
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('plan')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile || !ENTITLED_PLANS.has(profile.plan as string)) {
    return error('PLAN_REQUIRED', 'L’arbitre de cave fait partie du carnet virtuel — offre Gold ou Platine.', 403);
  }

  try {
    // Objet possédé (RLS : uniquement le sien) + dernière analyse (fenêtre d'apogée).
    const { data: item, error: itemError } = await auth.supabase
      .from('items')
      .select('id, domain, attributes')
      .eq('id', itemId)
      .maybeSingle();
    if (itemError) return error('SOURCE_UNAVAILABLE', 'Lecture de l’objet impossible', 503);
    if (!item) return error('UNAUTHORIZED', 'Objet introuvable ou non possédé', 403);

    const domain = item.domain as VelumDomain;

    // Fenêtre d'usage : uniquement pour le vin (apogée ZAPPA).
    let usageWindow: { from: number; to: number } | undefined;
    if (domain === 'wine') {
      const { data: analysis } = await auth.supabase
        .from('analyses')
        .select('payload')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const payload = analysis?.payload as WineAnalysisPayload | undefined;
      const dw = payload?.tasting?.drinkWindow;
      if (dw && typeof dw.from === 'number' && typeof dw.to === 'number') {
        usageWindow = { from: dw.from, to: dw.to };
      }
    }

    // Trajectoire de valeur : instantanés datés, du plus ancien au plus récent.
    const { data: snaps, error: snapError } = await auth.supabase
      .from('valuation_snapshots')
      .select('central, ci80_low, ci80_high, captured_at')
      .eq('item_id', itemId)
      .order('captured_at', { ascending: true })
      .limit(50);
    if (snapError) return error('SOURCE_UNAVAILABLE', 'Lecture de la trajectoire impossible', 503);

    const trajectory: TrajectoryPoint[] = (snaps ?? []).map((s) => ({
      at: s.captured_at as string,
      central: Number(s.central),
      ci80: [Number(s.ci80_low), Number(s.ci80_high)],
    }));

    const signal = arbitrate({
      currentYear,
      ...(usageWindow ? { usageWindow } : {}),
      trajectory,
    });

    return json(signal);
  } catch (err) {
    return errorFromException(err);
  }
});
