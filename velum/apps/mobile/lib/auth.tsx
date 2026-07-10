/**
 * Fournisseur d'authentification : session Supabase (persistée dans le
 * StorageAdapter offline), connexion e-mail, Sign in with Apple (iOS) et
 * Google (expo-auth-session → id_token). Erreurs converties en toasts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import type { AuthSession } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { getVelumClient } from './client';
import { identifyPurchases, resetPurchasesIdentity } from './purchases';

// Ferme proprement la fenêtre d'authentification web au retour dans l'app.
WebBrowser.maybeCompleteAuthSession();

export interface AuthContextValue {
  session: AuthSession | null;
  /** true tant que la session initiale n'a pas été relue du stockage. */
  loading: boolean;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getVelumClient();
    let mounted = true;

    client.auth
      .getSession()
      .then((s) => {
        if (mounted) {
          setSession(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribe = client.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
      // Identité RevenueCat = uid Supabase → le webhook serveur peut
      // synchroniser profiles.plan (grille free/premium/gold/platine).
      if (s?.user?.id) void identifyPurchases(s.user.id);
      else void resetPurchasesIdentity();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await getVelumClient().auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, signOut }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  return useContext(AuthContext);
}

// ── Sign in with Apple (iOS uniquement) ──────────────────────────────────────

export function isAppleSignInSupported(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Flux natif Apple : nonce haché envoyé à Apple, nonce brut à Supabase.
 * Lève si l'utilisateur annule ou si l'appareil ne supporte pas Apple.
 */
export async function signInWithApple(): Promise<void> {
  const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) {
    throw new Error('Jeton Apple manquant');
  }
  await getVelumClient().auth.signInWithIdToken('apple', credential.identityToken, rawNonce);
}

// ── Google (expo-auth-session → id_token) ────────────────────────────────────

/**
 * Hook de connexion Google : renvoie [disponible, lancerLaConnexion].
 * L'id_token reçu est échangé contre une session Supabase.
 */
export function useGoogleSignIn(): { available: boolean; promptGoogle: () => Promise<void> } {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // Identifiants publics par plateforme (non secrets, §12.1).
    clientId: process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'],
    iosClientId: process.env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'],
    androidClientId: process.env['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params['id_token'];
      if (typeof idToken === 'string' && idToken.length > 0) {
        void getVelumClient().auth.signInWithIdToken('google', idToken);
      }
    }
  }, [response]);

  const promptGoogle = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  return { available: request !== null, promptGoogle };
}
