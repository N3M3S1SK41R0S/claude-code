/**
 * Edge Function `recognize` — étage 1 du pipeline d'identification (§10.1).
 *
 * POST { domain: VelumDomain, input: CaptureInput }
 *   → auth (Bearer) → quota freemium (rpc consume_scan) → plugin.recognize()
 *   → RecognitionResult (top-3 candidats + needsAssistedEntry).
 */
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { isVelumDomain, plugins } from '../_shared/domains.ts';
import { guardAiCall } from '../_shared/guard.ts';
import { validateCaptureInput, validateJsonObject } from '../_shared/input.ts';
import { createVisionModel } from '../_shared/llm.ts';
import { hydrateMedia } from '../_shared/media.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';

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

  const bodyResult = validateJsonObject(rawBody);
  if (!bodyResult.ok) {
    return error('INVALID_INPUT', bodyResult.message, 400);
  }
  const body = bodyResult.value;

  if (!isVelumDomain(body['domain'])) {
    return error('INVALID_INPUT', 'Domaine inconnu (attendu : wine, coin, art ou stamp)', 400);
  }

  const inputResult = validateCaptureInput(body['input']);
  if (!inputResult.ok) {
    return error('INVALID_INPUT', inputResult.message, 400);
  }
  const input = inputResult.value;

  // Garde-fou anti-abus (plafond de dépense, par utilisateur, par IP) — AVANT le
  // quota produit : il protège la facture, pas le modèle économique.
  const blocked = await guardAiCall(auth, req);
  if (blocked) return blocked;

  // Quota freemium : 5 scans/semaine PAR module en plan 'free'
  // (premium/gold/platine : illimité — fonction security definer).
  const { data: allowed, error: rpcError } = await auth.supabase.rpc('consume_scan', {
    p_domain: body['domain'],
  });
  if (rpcError) {
    console.error('[recognize] consume_scan a échoué :', rpcError.message);
    return error('SOURCE_UNAVAILABLE', 'Vérification du quota impossible', 503);
  }
  if (allowed === false) {
    return error(
      'BUDGET_EXCEEDED',
      'Quota hebdomadaire de scans atteint pour ce module — passez à une offre supérieure',
      402,
    );
  }

  try {
    const plugin = plugins[body['domain']];
    // Les photos arrivent en `storagePath` (téléversées par le client) : on
    // retélécharge l'octet brut ici. Un `base64` déjà fourni est conservé tel quel.
    const hydrated = await hydrateMedia(auth, input);
    const result = await plugin.recognize(hydrated, {
      vision: createVisionModel({
        operation: 'recognize',
        domain: body['domain'],
        userId: auth.user.id,
      }),
    });
    return json(result);
  } catch (err) {
    return errorFromException(err);
  }
}

// Ne sert QUE lorsqu'exécuté comme module principal ; importable en test.
if (import.meta.main) Deno.serve(handler);
