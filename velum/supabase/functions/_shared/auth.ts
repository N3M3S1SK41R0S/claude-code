/**
 * Clients Supabase côté Edge Function.
 *
 * - `createUserClient(req)` : client "utilisateur" construit avec la clé anon
 *   + le jeton Bearer de la requête ; la RLS s'applique à toutes les requêtes.
 * - `createAdminClient()`   : client service-role (bypasse la RLS) — réservé
 *   aux traitements serveur (price-cron, purge RGPD). Jamais exposé au client.
 * - `getUser(req)`          : authentification OBLIGATOIRE ; retourne null si
 *   le jeton est absent/invalide → la fonction répond 401.
 */
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

/** Client lié à l'utilisateur appelant (RLS active). */
export function createUserClient(req: Request): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client service-role (bypasse la RLS) — usage serveur uniquement. */
export function createAdminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthContext {
  user: User;
  /** Client utilisateur : toute lecture/écriture passe par la RLS. */
  supabase: SupabaseClient;
}

/**
 * Vérifie le jeton `Authorization: Bearer <jwt>` de la requête.
 * Retourne null si absent ou invalide — l'appelant DOIT alors répondre 401.
 */
export async function getUser(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabase = createUserClient(req);
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { user: data.user, supabase };
}
