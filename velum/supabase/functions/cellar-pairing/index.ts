/**
 * Edge Function `cellar-pairing` — sommelier de cave (offre Gold+).
 *
 * Sens 1 de l'intelligence transversale mets ⇄ vins : « ce soir je cuisine
 * tel plat → quel vin DÉJÀ DANS MA CAVE s'accorde le mieux ? »
 *
 * POST { dish: string }
 *   → auth (Bearer) → vérification du plan (gold | platine)
 *   → lecture de la cave de l'utilisateur (items domain='wine' + dernière
 *     analyse ZAPPA, RLS active) → sommelier IA contraint à l'inventaire
 *   → PairingResult (recommandations anti-hallucination : uniquement des
 *     itemId réellement en cave).
 */
import type { CellarWineEntry, WineAnalysisPayload, WineAttributes } from '@velum/core';
import { recommendForDish } from '@velum/domain-wine';
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { createVisionModel } from '../_shared/llm.ts';
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

  let body: { dish?: unknown };
  try {
    body = await req.json();
  } catch {
    return error('INVALID_INPUT', 'Corps JSON invalide', 400);
  }
  const dish = typeof body.dish === 'string' ? body.dish.trim() : '';
  if (dish.length === 0 || dish.length > 500) {
    return error('INVALID_INPUT', "Champ 'dish' requis (description du plat, ≤ 500 caractères)", 400);
  }

  // Le sommelier de cave fait partie du carnet virtuel : Gold et Platine.
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('plan')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile || !ENTITLED_PLANS.has(profile.plan as string)) {
    return error(
      'PLAN_REQUIRED',
      'Le sommelier de cave fait partie du carnet virtuel — offre Gold ou Platine.',
      403,
    );
  }

  try {
    // Cave de l'utilisateur (RLS : uniquement SES vins).
    const { data: items, error: itemsError } = await auth.supabase
      .from('items')
      .select('id, title, attributes, storage_location')
      .eq('domain', 'wine')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (itemsError) {
      return error('SOURCE_UNAVAILABLE', 'Lecture de la cave impossible', 503);
    }

    const cellar: CellarWineEntry[] = (items ?? []).map((row) => {
      const attrs = (row.attributes ?? {}) as WineAttributes & {
        analysis?: WineAnalysisPayload;
        quantity?: number;
      };
      const analysis = attrs.analysis;
      return {
        itemId: row.id as string,
        label:
          (row.title as string | null) ??
          [attrs.producer, attrs.cuvee, attrs.vintage].filter(Boolean).join(' ') ??
          'Vin sans étiquette',
        vintage: typeof attrs.vintage === 'number' ? attrs.vintage : undefined,
        region: typeof attrs.region === 'string' ? attrs.region : undefined,
        color: typeof attrs.color === 'string' ? attrs.color : undefined,
        storageLocation: (row.storage_location as string | null) ?? undefined,
        drinkWindow: analysis?.tasting?.drinkWindow,
        foodPairings: analysis?.comparisons?.foodPairings,
        quantity: typeof attrs.quantity === 'number' ? attrs.quantity : undefined,
      };
    });

    const result = await recommendForDish(
      { dish, cellar },
      createVisionModel({ operation: 'cellar-pairing', domain: 'wine', userId: auth.user.id }),
    );
    return json(result);
  } catch (err) {
    return errorFromException(err);
  }
});
