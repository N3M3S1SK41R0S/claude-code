/**
 * Edge Function `valuate` — valorisation d'un candidat (moteur §7).
 *
 * POST { domain: VelumDomain, candidate: Candidate, itemId?: string }
 *   → auth → sources du domaine dont la clé existe → plugin.valuate()
 *   → insert valuations si itemId (client user, RLS) → ValuationResult.
 *
 * Erreurs : 503 SOURCE_UNAVAILABLE si aucune source configurée,
 *           404 NO_OBSERVATIONS si aucune observation exploitable.
 */
import { isVelumError } from '@velum/core';
import { valuate as runValuation } from '@velum/valuation';
import { getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { buildSources, plugins } from '../_shared/domains.ts';
import { getFxRates } from '../_shared/fx.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { serverTransport } from '../_shared/transport.ts';
import { validateValuationRequest } from './input.ts';

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

  const requestResult = validateValuationRequest(rawBody);
  if (!requestResult.ok) {
    return error('INVALID_INPUT', requestResult.message, 400);
  }
  const { domain, candidate, itemId } = requestResult.value;

  // Sources du domaine dont la clé API est configurée (ou API publique).
  const sources = buildSources(domain, serverTransport);
  if (sources.length === 0) {
    return error(
      'SOURCE_UNAVAILABLE',
      `Aucune source de prix configurée pour le domaine '${domain}'`,
      503,
    );
  }

  try {
    const plugin = plugins[domain];
    const result = await plugin.valuate(candidate, {
      sources,
      fx: await getFxRates(),
      valuate: (obs, fx) => runValuation(obs, fx),
    });

    // Persistance optionnelle — via le client utilisateur : la RLS garantit
    // que l'item appartient bien à l'appelant.
    if (itemId) {
      const { error: insertError } = await auth.supabase.from('valuations').insert({
        item_id: itemId,
        central: result.central,
        ci80_low: result.ci80[0],
        ci80_high: result.ci80[1],
        ci95_low: result.ci95[0],
        ci95_high: result.ci95[1],
        reliability: result.reliability,
        sources: result.observations,
      });
      if (insertError) {
        return error(
          'UNAUTHORIZED',
          'Enregistrement de la valorisation refusé (objet introuvable ou non possédé)',
          403,
        );
      }
    }

    return json(result);
  } catch (err) {
    if (isVelumError(err) && err.code === 'NO_OBSERVATIONS') {
      return error('NO_OBSERVATIONS', 'Aucune observation de prix disponible pour cet objet', 404);
    }
    return errorFromException(err);
  }
}

// Ne sert QUE lorsqu'exécuté comme module principal ; importable en test.
if (import.meta.main) Deno.serve(handler);
