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
import { EMPTY_CELLAR_ADVICE, recommendForDish } from '@velum/domain-wine';
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { guardAiCall } from '../_shared/guard.ts';
import { createVisionModel } from '../_shared/llm.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { parseCellarRows, validatePairingBody } from './input.ts';

const ENTITLED_PLANS = new Set(['gold', 'platine']);

export async function handler(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  }

  const auth = await getUser(req);
  if (!auth) {
    return error('UNAUTHORIZED', 'Authentification requise', 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return error('INVALID_INPUT', 'Corps JSON invalide', 400);
  }
  const bodyResult = validatePairingBody(rawBody);
  if (!bodyResult.ok) {
    return error('INVALID_INPUT', bodyResult.message, 400);
  }
  const { dish } = bodyResult.value;

  // Le sommelier de cave fait partie du carnet virtuel : Gold et Platine.
  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('plan')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profileError) {
    return error('SOURCE_UNAVAILABLE', 'Vérification de l’offre impossible', 503);
  }
  const plan = profile && typeof profile.plan === 'string' ? profile.plan : null;
  if (!plan || !ENTITLED_PLANS.has(plan)) {
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

    let cellar: ReturnType<typeof parseCellarRows>;
    try {
      cellar = parseCellarRows(items ?? []);
    } catch (parseError) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          event: 'cellar.invalid_rows',
          message: parseError instanceof Error ? parseError.message : String(parseError),
        }),
      );
      return error('SOURCE_UNAVAILABLE', 'Données de cave invalides', 503);
    }

    // Cave vide : réponse déterministe. Aucun quota, aucune clé fournisseur et
    // aucun appel facturé ne sont nécessaires pour dire qu'il n'y a rien à choisir.
    if (cellar.length === 0) {
      return json({ recommendations: [], fallbackAdvice: EMPTY_CELLAR_ADVICE });
    }

    // Le garde-fou est consommé uniquement lorsqu'un appel IA aura réellement lieu.
    const blocked = await guardAiCall(auth, req);
    if (blocked) return blocked;

    const result = await recommendForDish(
      { dish, cellar },
      createVisionModel({ operation: 'cellar-pairing', domain: 'wine', userId: auth.user.id }),
    );
    return json(result);
  } catch (err) {
    return errorFromException(err);
  }
}

if (import.meta.main) Deno.serve(handler);
