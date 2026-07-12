/**
 * Pile d'authentification — fond ink, sans en-tête.
 * Garde de session : dès qu'une session existe (e-mail, Apple, ou Google —
 * dont le retour OAuth s'achève dans un hook sans navigation explicite),
 * on quitte les écrans d'auth vers l'app.
 */
import { Redirect, Stack } from 'expo-router';
import { velumColors } from '@velum/ui';

import { useSession } from '../../lib/auth';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (!loading && session) return <Redirect href="/(tabs)/capture" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: velumColors.ink.DEFAULT },
      }}
    />
  );
}
