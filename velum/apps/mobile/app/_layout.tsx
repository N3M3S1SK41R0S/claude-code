/**
 * Layout racine : providers (React Query, Auth, SeniorMode branché sur les
 * réglages persistés + profile.a11yMode), i18n, thème sombre « cave » (ink),
 * StatusBar claire, toasts et ErrorBoundary globaux.
 */
import '../global.css';
import '../lib/i18n';

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SeniorModeProvider, velumColors } from '@velum/ui';

import { documentTitleFor } from '../lib/documentTitle';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastHost } from '../components/Toast';
import { AuthProvider, useSession } from '../lib/auth';
import { getVelumClient } from '../lib/client';
import { clearPersistedCache, persistOptions, queryClient } from '../lib/queryClient';
import { useSettingsStore } from '../stores/settingsStore';

/** Pose `document.title` selon la route (web uniquement) — WCAG 2.4.2. */
function WebDocumentTitle() {
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = documentTitleFor(pathname);
    }
  }, [pathname]);
  return null;
}

/** Purge le cache persisté à la déconnexion (vie privée, appareil partagé). */
function CacheGuard() {
  const { session } = useSession();
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (session) wasSignedIn.current = true;
    else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      void clearPersistedCache();
    }
  }, [session]);
  return null;
}

function SeniorBridge({ children }: { children: React.ReactNode }) {
  const senior = useSettingsStore((s) => s.senior);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const setSenior = useSettingsStore((s) => s.setSenior);
  const { session } = useSession();

  const persistSenior = useCallback(
    (v: boolean) => {
      setSenior(v);
      // Synchronise profile.a11yMode côté serveur (best effort, jamais bloquant).
      if (session) {
        getVelumClient()
          .profile.update({ a11yMode: v })
          .catch(() => undefined);
      }
    },
    [setSenior, session],
  );

  return (
    // key : re-monte le provider une fois les réglages rehydratés.
    <SeniorModeProvider key={hydrated ? 'hydrated' : 'boot'} initialSenior={senior} onChange={persistSenior}>
      {children}
    </SeniorModeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <CacheGuard />
          <SeniorBridge>
            <ErrorBoundary>
              <StatusBar style="light" backgroundColor={velumColors.ink.DEFAULT} />
              <WebDocumentTitle />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: velumColors.ink.DEFAULT },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="accueil" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="capture/[domain]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="capture/candidates" />
                <Stack.Screen name="item/[id]" />
                <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
              </Stack>
              <ToastHost />
            </ErrorBoundary>
          </SeniorBridge>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
