/**
 * Fabrique du handler commun aux 4 fonctions analyze-* (wine, coin, art,
 * stamp). Chaque fonction ne diffère que par le plugin injecté.
 *
 * POST { candidate: Candidate, itemId?: string }
 *   → auth → plugin.analyze() → insert analyses si itemId (client user, RLS)
 *   → AnalysisResult.
 */
import { getUser } from './auth.ts';
import { handleOptions } from './cors.ts';
import type { AnyDomainPlugin } from './domains.ts';
import { guardAiCall } from './guard.ts';
import { validateCandidate, validateJsonObject } from './input.ts';
import { createVisionModel } from './llm.ts';
import { error, errorFromException, json } from './respond.ts';

export function makeAnalyzeHandler(plugin: AnyDomainPlugin): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
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

    const candidateResult = validateCandidate(body['candidate'], plugin.domain);
    if (!candidateResult.ok) {
      return error('INVALID_INPUT', candidateResult.message, 400);
    }
    const candidate = candidateResult.value;

    if (body['itemId'] !== undefined && typeof body['itemId'] !== 'string') {
      return error('INVALID_INPUT', "Champ 'itemId' invalide : chaîne attendue", 400);
    }
    const itemId = typeof body['itemId'] === 'string' ? body['itemId'] : undefined;

    // `analyze` n'était soumis à AUCUN quota — alors qu'il demande 4096 tokens de
    // sortie, donc coûte plus cher qu'une reconnaissance. Un seul compte gratuit
    // pouvait l'appeler en boucle, indéfiniment, aux frais du propriétaire.
    const blocked = await guardAiCall(auth, req);
    if (blocked) return blocked;

    try {
      const result = await plugin.analyze(candidate, {
        vision: createVisionModel({
          operation: 'analyze',
          domain: plugin.domain,
          userId: auth.user.id,
        }),
      });

      // Persistance optionnelle — via le client utilisateur : la RLS garantit
      // que l'item appartient bien à l'appelant.
      if (itemId) {
        const { error: insertError } = await auth.supabase.from('analyses').insert({
          item_id: itemId,
          engine: result.engine,
          payload: result.payload,
        });
        if (insertError) {
          return error(
            'UNAUTHORIZED',
            "Enregistrement de l'analyse refusé (objet introuvable ou non possédé)",
            403,
          );
        }
      }

      return json(result);
    } catch (err) {
      return errorFromException(err);
    }
  };
}
