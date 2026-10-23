/**
 * Edge Function `recognize` — étage 1 du pipeline d'identification (§10.1).
 *
 * POST { domain: VelumDomain, input: CaptureInput, mode?: 'single' | 'sheet' }
 *   → auth (Bearer)
 *   → validation complète (domaine, entrée, mode) AVANT tout quota
 *   → photo/texte : garde-fou IA + quota freemium + plugin.recognize()
 *     (scan éclair : identification + classement + fourchette indicative)
 *   → mode 'sheet' : UNE photo de planche → plugin.recognizeSheet()
 *   → fichier : mapping déterministe du plugin, sans fournisseur ni quota de scan
 *   → RecognitionResult | SheetRecognitionResult.
 *
 * Quota en mode planche — décision : UNE photo = UN scan, quel que soit le
 * nombre d'objets détectés (jusqu'à 24). C'est tout l'intérêt du mode
 * classeur pour ranger une collection ; le coût réel (sortie plus longue)
 * reste borné par SHEET_RECOGNITION_MAX_TOKENS et par le garde-fou de
 * dépense `guard_ai_call`, appliqué avant le quota comme pour tout appel IA.
 */
import {
  RECOGNITION_MAX_TOKENS,
  SHEET_RECOGNITION_MAX_TOKENS,
  type RecognizeDeps,
} from '@velum/core';
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { isVelumDomain, plugins } from '../_shared/domains.ts';
import { guardAiCall } from '../_shared/guard.ts';
import {
  validateCaptureInput,
  validateJsonObject,
  validateRecognitionMode,
  validateSheetInput,
} from '../_shared/input.ts';
import { createVisionModel, withMaxTokensCap } from '../_shared/llm.ts';
import { hydrateMedia } from '../_shared/media.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';

/**
 * Les plugins mappent les imports fichier localement. Ce backend sentinelle
 * rend toute régression visible sans initialiser une clé ni contacter un fournisseur.
 */
const FILE_IMPORT_DEPS: RecognizeDeps = {
  vision: {
    async complete(): Promise<string> {
      throw new Error("Invariant violé : un import de fichier ne doit pas appeler l'IA");
    },
  },
};

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
    return error('INVALID_INPUT', 'Domaine inconnu (attendu : wine, coin, art, stamp ou watch)', 400);
  }
  const domain = body['domain'];

  const inputResult = validateCaptureInput(body['input']);
  if (!inputResult.ok) {
    return error('INVALID_INPUT', inputResult.message, 400);
  }
  const input = inputResult.value;
  const plugin = plugins[domain];

  const modeResult = validateRecognitionMode(body['mode']);
  if (!modeResult.ok) {
    return error('INVALID_INPUT', modeResult.message, 400);
  }
  const mode = modeResult.value;

  // Mode planche : refus explicite AVANT le quota (domaine sans planche,
  // entrée qui n'est pas une photo unique) — une requête invalide ne coûte rien.
  if (mode === 'sheet') {
    if (typeof plugin.recognizeSheet !== 'function') {
      return error(
        'INVALID_INPUT',
        `Le mode planche n'est pas disponible pour le module « ${domain} » (timbres et pièces uniquement)`,
        400,
      );
    }
    const sheetResult = validateSheetInput(input);
    if (!sheetResult.ok) {
      return error('INVALID_INPUT', sheetResult.message, 400);
    }
  }

  // Un import CSV/JSON est un mapping local des lignes en candidats assistés.
  // Il ne consomme ni plafond de dépense, ni quota de scan, ni clé fournisseur.
  if (mode === 'single' && input.kind === 'file') {
    try {
      return json(await plugin.recognize(input, FILE_IMPORT_DEPS));
    } catch (err) {
      return errorFromException(err);
    }
  }

  // Garde-fou anti-abus (plafond de dépense, par utilisateur, par IP) — AVANT le
  // quota produit : il protège la facture, pas le modèle économique.
  const blocked = await guardAiCall(auth, req);
  if (blocked) return blocked;

  // Quota freemium : 5 scans/semaine PAR module en plan 'free'
  // (premium/gold/platine : illimité — fonction security definer).
  // Consommé UNE fois par requête : une photo de planche = un scan.
  const { data: allowed, error: rpcError } = await auth.supabase.rpc('consume_scan', {
    p_domain: domain,
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
    // Les photos arrivent en `storagePath` (téléversées par le client) : on
    // retélécharge l'octet brut ici. Un `base64` déjà fourni est conservé tel quel.
    const hydrated = await hydrateMedia(auth, input);
    const vision = createVisionModel({
      operation: mode === 'sheet' ? 'recognize-sheet' : 'recognize',
      domain,
      userId: auth.user.id,
    });

    if (mode === 'sheet' && plugin.recognizeSheet) {
      const result = await plugin.recognizeSheet(hydrated, {
        vision: withMaxTokensCap(vision, SHEET_RECOGNITION_MAX_TOKENS),
      });
      return json(result);
    }

    // Scan éclair : sortie compacte imposée quel que soit le plugin.
    const result = await plugin.recognize(hydrated, {
      vision: withMaxTokensCap(vision, RECOGNITION_MAX_TOKENS),
    });
    return json(result);
  } catch (err) {
    return errorFromException(err);
  }
}

// Ne sert QUE lorsqu'exécuté comme module principal ; importable en test.
if (import.meta.main) Deno.serve(handler);
