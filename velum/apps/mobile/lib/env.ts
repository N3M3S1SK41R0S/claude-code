/**
 * Variables d'environnement CLIENT (publiques — jamais de secret ici, §12.1).
 * Lues via @velum/config pour bénéficier du message d'erreur explicite.
 *
 * IMPORTANT : Expo n'inline `EXPO_PUBLIC_*` que sur les accès STATIQUES
 * (`process.env.EXPO_PUBLIC_X`). Un accès dynamique (`process.env[clé]` ou
 * l'objet `process.env` passé tel quel) est vide au runtime — d'où la
 * construction explicite de l'objet ci-dessous.
 */
import { readClientEnv, type ClientEnv } from '@velum/config';

/**
 * Mode DÉMO (EXPO_PUBLIC_DEMO=1) : l'app tourne sans backend ni clé, sur un
 * client en mémoire (lib/demo). Accès statique requis pour l'inlining Expo.
 */
export function isDemoMode(): boolean {
  return process.env.EXPO_PUBLIC_DEMO === '1';
}

let cached: ClientEnv | null = null;

/** Lit et met en cache l'environnement client (EXPO_PUBLIC_*). */
export function getClientEnv(): ClientEnv {
  if (isDemoMode()) {
    // Placeholders : aucun appel réseau n'est fait en démo.
    return { supabaseUrl: 'https://demo.local', supabaseAnonKey: 'demo' };
  }
  if (cached === null) {
    cached = readClientEnv({
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  }
  return cached;
}
