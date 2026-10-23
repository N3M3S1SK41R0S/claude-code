/**
 * Edge Function `valuate` — valorisation d'un candidat (moteur §7).
 *
 * POST { domain: VelumDomain, candidate: Candidate, itemId?: string }
 *   → auth → (si itemId) propriété de l'objet vérifiée par le client
 *   utilisateur (RLS) → sources du domaine dont la clé existe →
 *   plugin.valuate() → (si itemId) insert valuations par le client
 *   SERVICE-ROLE (le client n'écrit jamais d'estimation : elles fondent le
 *   seuil de certification des plateformes) → ValuationResult.
 *
 * Erreurs : 403 UNAUTHORIZED si l'objet n'appartient pas à l'appelant,
 *           503 SOURCE_UNAVAILABLE si aucune source configurée ou si la
 *           lecture / l'écriture en base échoue,
 *           404 NO_OBSERVATIONS si aucune observation exploitable.
 */
import { isVelumError } from '@velum/core';
import { valuate as runValuation } from '@velum/valuation';
import { createAdminClient, getUser } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { buildSources, plugins } from '../_shared/domains.ts';
import { getFxRates } from '../_shared/fx.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { serverTransport } from '../_shared/transport.ts';
import { validateValuationRequest } from './input.ts';
import { checkItemOwnership, storeValuation } from './store.ts';

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

  // Persistance demandée : l'objet doit appartenir à l'appelant (client
  // utilisateur, RLS) — vérifié AVANT d'interroger les sources de prix.
  if (itemId) {
    const ownership = await checkItemOwnership(auth.supabase, itemId);
    if (ownership === 'unavailable') {
      return error('SOURCE_UNAVAILABLE', 'Vérification de l’objet impossible', 503);
    }
    if (ownership === 'not_owned') {
      return error(
        'UNAUTHORIZED',
        'Enregistrement de la valorisation refusé (objet introuvable ou non possédé)',
        403,
      );
    }
  }

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

    // Persistance optionnelle — écriture SERVEUR (service-role), la
    // propriété ayant été vérifiée ci-dessus par le client utilisateur.
    if (itemId) {
      const stored = await storeValuation(createAdminClient(), itemId, result);
      if (!stored) {
        return error('SOURCE_UNAVAILABLE', 'Enregistrement de la valorisation impossible', 503);
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
