/**
 * Fabrique du handler commun aux 4 fonctions analyze-* (wine, coin, art,
 * stamp). Chaque fonction ne diffère que par le plugin injecté.
 *
 * POST { candidate: Candidate, itemId?: string }
 *   → auth → plugin.analyze() → insert analyses si itemId (client user, RLS)
 *   → AnalysisResult.
 */
import type { Candidate } from '@velum/core';
import { getUser } from './auth.ts';
import { handleOptions } from './cors.ts';
import type { AnyDomainPlugin } from './domains.ts';
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

    let body: { candidate?: unknown; itemId?: unknown };
    try {
      body = await req.json();
    } catch {
      return error('INVALID_INPUT', 'Corps JSON invalide', 400);
    }

    if (!body.candidate || typeof body.candidate !== 'object') {
      return error('INVALID_INPUT', "Champ 'candidate' manquant", 400);
    }
    const candidate = body.candidate as Candidate;
    if (candidate.domain !== plugin.domain) {
      return error(
        'INVALID_INPUT',
        `Le candidat appartient au domaine '${candidate.domain}', cette fonction traite '${plugin.domain}'`,
        400,
      );
    }
    const itemId = typeof body.itemId === 'string' ? body.itemId : undefined;

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
