/**
 * Layout racine : providers (React Query, Auth, SeniorMode branché sur les
 * réglages persistés + profile.a11yMode), i18n, thème sombre « cave » (ink),
 * StatusBar claire, toasts et ErrorBoundary globaux.
 */
import '../global.css';
import '../lib/i18n';

import { useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SeniorModeProvider, velumColors } from '@velum/ui';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastHost } from '../components/Toast';
import { AuthProvider, useSession } from '../lib/auth';
import { getVelumClient } from '../lib/client';
import { queryClient } from '../lib/queryClient';
import { useSettingsStore } from '../stores/settingsStore';

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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SeniorBridge>
            <ErrorBoundary>
              <StatusBar style="light" backgroundColor={velumColors.ink.DEFAULT} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: velumColors.ink.DEFAULT },
                }}
              >
                <Stack.Screen name="index" />
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
