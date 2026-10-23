/**
 * Liens profonds des notifications (rappel local « à boire », push serveur
 * `drink_window`) — partie PURE et testée. Une notification ne peut ouvrir
 * qu'un écran INTERNE de la liste blanche : jamais une URL externe ni un
 * chemin arbitraire injecté dans un payload push.
 */

/** Écrans exacts autorisés. */
const EXACT_ROUTES: ReadonlySet<string> = new Set([
  '/cellar-peak',
  '/cellar-sommelier',
  '/event-sommelier',
  '/carnet',
  '/wishlist',
  '/community',
]);

/** Préfixes autorisés (écran + identifiant). */
const PREFIX_ROUTES: readonly string[] = ['/item/', '/community/'];

const MAX_ROUTE_LENGTH = 300;

/** true si `route` est un chemin interne autorisé (requête permise). */
export function isAllowedNotificationRoute(route: string): boolean {
  if (route.length === 0 || route.length > MAX_ROUTE_LENGTH) return false;
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\')) return false;
  if (/[\s<>"']/.test(route)) return false;
  const path = route.split(/[?#]/, 1)[0] ?? '';
  if (path.includes('..')) return false;
  if (EXACT_ROUTES.has(path)) return true;
  return PREFIX_ROUTES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

/**
 * Route à ouvrir pour les données d'une notification (`data.url`), ou null.
 * Défensif : `data` provient d'un payload externe (push) ou du stockage natif.
 */
export function routeFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const url = (data as Record<string, unknown>)['url'];
  if (typeof url !== 'string') return null;
  const route = url.trim();
  return isAllowedNotificationRoute(route) ? route : null;
}
