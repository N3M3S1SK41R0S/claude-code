/**
 * Pile d'authentification — fond ink, sans en-tête.
 */
import { Stack } from 'expo-router';
import { velumColors } from '@velum/ui';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: velumColors.ink.DEFAULT },
      }}
    />
  );
}
