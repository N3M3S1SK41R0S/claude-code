/**
 * Garde-fou anti-abus, à appeler AVANT tout appel au modèle de vision.
 *
 * Le quota produit (`consume_scan`, 5 scans/semaine/module) protège le modèle
 * économique ; il ne protège PAS la facture :
 *   - il n'était appliqué qu'à `recognize` — `analyze` et `cellar-pairing`
 *     étaient gratuits et illimités, alors qu'ils coûtent plus cher ;
 *   - il est adossé au compte, et créer un compte est libre et instantané.
 *
 * `guard_ai_call` (SQL) ajoute trois plafonds : dépense quotidienne globale,
 * appels par utilisateur, appels par IP. Les comptes payants n'y sont pas soumis.
 */
import type { AuthContext } from './auth.ts';
import { error } from './respond.ts';

/** IP de l'appelant telle que vue derrière le proxy Supabase. */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || 'inconnue';
}

/**
 * Retourne une `Response` d'erreur si l'appel doit être REFUSÉ, sinon `null`.
 *
 * En cas de panne du garde-fou lui-même, on LAISSE PASSER : un plafond cassé ne
 * doit pas rendre VELUM inutilisable. La dépense reste bornée par le plafond
 * global au prochain appel réussi.
 */
export async function guardAiCall(auth: AuthContext, req: Request): Promise<Response | null> {
  const { data, error: rpcError } = await auth.supabase.rpc('guard_ai_call', {
    p_ip: clientIp(req),
  });

  if (rpcError) {
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        event: 'guard.unavailable',
        message: rpcError.message,
      }),
    );
    return null; // fail-open : on ne bloque pas l'app parce que le garde-fou tousse
  }

  switch (data) {
    case 'ok':
      return null;

    case 'budget':
      console.log(
        JSON.stringify({ at: new Date().toISOString(), event: 'guard.budget_cap_reached' }),
      );
      return error(
        'SOURCE_UNAVAILABLE',
        "Le service d'analyse est temporairement suspendu (plafond de dépense quotidien atteint). Réessayez demain.",
        503,
      );

    case 'user':
      return error(
        'RATE_LIMITED',
        "Vous avez atteint la limite d'analyses pour aujourd'hui. Réessayez demain.",
        429,
      );

    case 'ip':
      console.log(
        JSON.stringify({ at: new Date().toISOString(), event: 'guard.ip_cap_reached' }),
      );
      return error(
        'RATE_LIMITED',
        "Trop d'analyses depuis ce réseau aujourd'hui. Réessayez demain.",
        429,
      );

    case 'unauthorized':
      return error('UNAUTHORIZED', 'Authentification requise', 401);

    default:
      return null;
  }
}
