/**
 * Retour à la page précédente — UN comportement pour toute l'app (en-tête
 * de `Screen`, boutons « Retour » des écrans, actions post-suppression).
 * Logique pure dans backNavigation.ts.
 */
import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

import { DEFAULT_BACK_FALLBACK, goBackOrFallback } from './backNavigation';

export { DEFAULT_BACK_FALLBACK, goBackOrFallback } from './backNavigation';

/** Hook : fonction « retour » sûre, avec repli explicite si fourni. */
export function useGoBack(fallback: string = DEFAULT_BACK_FALLBACK): () => void {
  const router = useRouter();
  return useCallback(() => {
    goBackOrFallback(
      {
        canGoBack: () => router.canGoBack(),
        back: () => router.back(),
        replace: (href) => router.replace(href as Href),
      },
      fallback,
    );
  }, [router, fallback]);
}
