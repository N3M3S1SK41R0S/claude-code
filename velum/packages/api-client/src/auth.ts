/**
 * Façade d'authentification Supabase : e-mail/mot de passe, identité native
 * Apple/Google (Sign in with Apple / Google One Tap), session, suppression
 * de compte (purge RGPD via l'Edge Function `delete-account`).
 */
import type { AuthSession, SupabaseClient } from '@supabase/supabase-js';
import { VelumError } from '@velum/core';
import { invokeEdgeFunction } from './edge';

/** Callback de changement d'état d'authentification. */
export type AuthChangeCallback = (event: string, session: AuthSession | null) => void;

export interface AuthApi {
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  /** Retourne null si la confirmation e-mail est requise avant la première session. */
  signUpWithEmail(email: string, password: string): Promise<AuthSession | null>;
  signInWithIdToken(
    provider: 'apple' | 'google',
    token: string,
    nonce?: string,
  ): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Purge RGPD complète (Storage + cascade SQL), puis déconnexion locale. */
  deleteAccount(): Promise<void>;
  /** Retourne la fonction de désabonnement. */
  onAuthStateChange(cb: AuthChangeCallback): () => void;
  getSession(): Promise<AuthSession | null>;
}

export function createAuthApi(supabase: SupabaseClient): AuthApi {
  return {
    async signInWithEmail(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new VelumError('UNAUTHORIZED', error?.message ?? 'Connexion impossible');
      }
      return data.session;
    },

    async signUpWithEmail(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new VelumError('UNAUTHORIZED', error.message);
      return data.session;
    },

    async signInWithIdToken(provider, token, nonce) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider,
        token,
        ...(nonce !== undefined ? { nonce } : {}),
      });
      if (error || !data.session) {
        throw new VelumError('UNAUTHORIZED', error?.message ?? 'Connexion impossible');
      }
      return data.session;
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async deleteAccount() {
      await invokeEdgeFunction<null>(supabase, 'delete-account');
      // Le compte n'existe plus : on nettoie la session locale (erreur ignorée).
      await supabase.auth.signOut().catch(() => undefined);
    },

    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange(cb);
      return () => data.subscription.unsubscribe();
    },

    async getSession() {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  };
}
