/**
 * Singleton du client VELUM : Supabase + Edge Functions + repos + file
 * de mutations hors-ligne. Construit paresseusement au premier accès.
 */
import { createVelumClient, type VelumClient } from '@velum/api-client';
import { createDemoClient } from './demo/demoClient';
import { getClientEnv, isDemoMode } from './env';
import { offlineStorage } from './offlineStorage';

let client: VelumClient | null = null;

export function getVelumClient(): VelumClient {
  if (client === null) {
    if (isDemoMode()) {
      client = createDemoClient();
    } else {
      const env = getClientEnv();
      client = createVelumClient({
        supabaseUrl: env.supabaseUrl,
        supabaseAnonKey: env.supabaseAnonKey,
        storage: offlineStorage,
      });
    }
  }
  return client;
}
