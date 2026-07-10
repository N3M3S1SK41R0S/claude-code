/**
 * Variables d'environnement CLIENT (publiques — jamais de secret ici, §12.1).
 * Lues via @velum/config pour bénéficier du message d'erreur explicite.
 */
import { readClientEnv, type ClientEnv } from '@velum/config';

let cached: ClientEnv | null = null;

/** Lit et met en cache l'environnement client (EXPO_PUBLIC_*). */
export function getClientEnv(): ClientEnv {
  if (cached === null) {
    cached = readClientEnv(process.env as unknown as Record<string, string | undefined>);
  }
  return cached;
}
