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

export interface GuardRpcError {
  message: string;
}

export interface GuardRpcResult {
  data: unknown;
  error: GuardRpcError | null;
}

export type GuardRpc = (ip: string) => Promise<GuardRpcResult>;

export interface GuardCheckDeps {
  rpc: GuardRpc;
  now?: () => string;
  log?: (entry: Record<string, unknown>) => void;
}

/** IP de l'appelant telle que vue derrière le proxy Supabase. */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || 'inconnue';
}

function logGuardEvent(
  deps: GuardCheckDeps,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const entry = {
    at: (deps.now ?? (() => new Date().toISOString()))(),
    event,
    ...fields,
  };
  const logger = deps.log ?? ((value: Record<string, unknown>) => console.error(JSON.stringify(value)));
  logger(entry);
}

function unavailableResponse(): Response {
  return error(
    'SOURCE_UNAVAILABLE',
    "Le contrôle des plafonds d'analyse est temporairement indisponible. Réessayez plus tard.",
    503,
  );
}

function responseForDecision(
  decision: unknown,
  deps: GuardCheckDeps,
): Response | null {
  switch (decision) {
    case 'ok':
      return null;

    case 'budget':
      logGuardEvent(deps, 'guard.budget_cap_reached');
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
      logGuardEvent(deps, 'guard.ip_cap_reached');
      return error(
        'RATE_LIMITED',
        "Trop d'analyses depuis ce réseau aujourd'hui. Réessayez demain.",
        429,
      );

    case 'unauthorized':
      return error('UNAUTHORIZED', 'Authentification requise', 401);

    default:
      logGuardEvent(deps, 'guard.invalid_result', {
        decision: String(decision).slice(0, 100),
      });
      return unavailableResponse();
  }
}

/**
 * Exécute le contrôle avec un RPC injecté. Toute panne ou réponse inconnue est
 * fail-closed : appeler le modèle sans plafond annulerait la garantie budgétaire.
 */
export async function runGuardCheck(
  req: Request,
  deps: GuardCheckDeps,
): Promise<Response | null> {
  let result: GuardRpcResult;
  try {
    result = await deps.rpc(clientIp(req));
  } catch (cause) {
    logGuardEvent(deps, 'guard.unavailable', {
      message: (cause instanceof Error ? cause.message : String(cause)).slice(0, 300),
    });
    return unavailableResponse();
  }

  if (result.error) {
    logGuardEvent(deps, 'guard.unavailable', {
      message: result.error.message.slice(0, 300),
    });
    return unavailableResponse();
  }

  return responseForDecision(result.data, deps);
}

/** Retourne une réponse d'erreur si l'appel doit être refusé, sinon `null`. */
export async function guardAiCall(auth: AuthContext, req: Request): Promise<Response | null> {
  return runGuardCheck(req, {
    rpc: async (ip) => {
      const { data, error: rpcError } = await auth.supabase.rpc('guard_ai_call', {
        p_ip: ip,
      });
      return {
        data,
        error: rpcError ? { message: rpcError.message } : null,
      };
    },
  });
}
