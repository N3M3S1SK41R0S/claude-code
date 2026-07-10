/**
 * Point d'entrée du client VELUM : construit le client Supabase (session
 * persistée dans le StorageAdapter fourni) et assemble les façades typées.
 * L'anon key est publique par conception — aucun secret côté client (§12.1).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAuthApi, type AuthApi } from './auth';
import { createEdgeApi, type EdgeApi } from './edge';
import { MutationQueue } from './queue';
import {
  createAlertsRepo,
  createItemsRepo,
  createProfileApi,
  createValuationsRepo,
  type AlertsRepo,
  type ItemsRepo,
  type ProfileApi,
  type ValuationsRepo,
} from './repos';
import { createMemoryStorage, type StorageAdapter } from './storage';

export interface VelumClientOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * Stockage clé/valeur pour la session auth et la file de mutations
   * (AsyncStorage sur mobile). À défaut : stockage mémoire (non persistant).
   */
  storage?: StorageAdapter;
}

export interface VelumClient {
  /** Client Supabase brut — échappatoire pour les besoins non couverts. */
  supabase: SupabaseClient;
  auth: AuthApi;
  edge: EdgeApi;
  items: ItemsRepo;
  valuations: ValuationsRepo;
  alerts: AlertsRepo;
  profile: ProfileApi;
  /** File de mutations hors-ligne (rejeu FIFO, last-write-wins). */
  queue: MutationQueue;
}

export function createVelumClient(opts: VelumClientOptions): VelumClient {
  const storage = opts.storage ?? createMemoryStorage();
  const supabase = createClient(opts.supabaseUrl, opts.supabaseAnonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // Pas de détection d'URL OAuth : les connexions natives passent par signInWithIdToken.
      detectSessionInUrl: false,
    },
  });

  return {
    supabase,
    auth: createAuthApi(supabase),
    edge: createEdgeApi(supabase),
    items: createItemsRepo(supabase),
    valuations: createValuationsRepo(supabase),
    alerts: createAlertsRepo(supabase),
    profile: createProfileApi(supabase),
    queue: new MutationQueue(supabase, storage),
  };
}
