/**
 * Aiguillage d'entrée : onboarding → connexion → onglets.
 */
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { VSpinner } from '@velum/ui';

import { useSession } from '../lib/auth';
import { isDemoMode } from '../lib/env';
import { useSettingsStore } from '../stores/settingsStore';

export default function Index() {
  const { session, loading } = useSession();
  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const hydrated = useSettingsStore((s) => s.hydrated);

  // Mode démo : on entre directement dans l'app (déjà « connecté »).
  if (isDemoMode()) return <Redirect href="/(tabs)/capture" />;

  if (!hydrated || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <VSpinner />
      </View>
    );
  }
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/capture" />;
}
