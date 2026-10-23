/**
 * Décision pure du « retour à la page précédente » (sans dépendance native,
 * testable sous Vitest) — utilisée par le hook `useGoBack` (navigation.ts).
 *
 * `router.back()` seul échoue silencieusement quand il n'y a pas d'historique
 * (lien direct web, notification, rechargement) : l'utilisateur reste bloqué.
 * On retombe alors sur une destination sûre (par défaut l'onglet Collection).
 */

/** Destination de repli quand l'historique de navigation est vide. */
export const DEFAULT_BACK_FALLBACK = '/(tabs)/collection';

export interface BackNavigator {
  canGoBack(): boolean;
  back(): void;
  replace(href: string): void;
}

/**
 * Revient en arrière si possible, sinon remplace l'écran courant par la
 * destination de repli (pas d'empilement infini).
 */
export function goBackOrFallback(
  navigator: BackNavigator,
  fallback: string = DEFAULT_BACK_FALLBACK,
): 'back' | 'fallback' {
  if (navigator.canGoBack()) {
    navigator.back();
    return 'back';
  }
  navigator.replace(fallback);
  return 'fallback';
}
