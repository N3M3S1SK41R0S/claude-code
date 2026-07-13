/**
 * Service worker VELUM — rend la PWA consultable hors-ligne.
 *
 * Stratégies, par type de requête :
 *  - navigations (HTML)     → réseau d'abord, cache en repli, puis coquille « / ».
 *    Le réseau d'abord garantit qu'un nouveau déploiement est vu immédiatement ;
 *    le repli évite l'écran blanc quand il n'y a pas de réseau.
 *  - assets `_expo/static/*` → cache d'abord (noms hachés ⇒ immuables).
 *  - autres GET same-origin  → cache d'abord, rafraîchi en tâche de fond.
 *
 * Ce qui n'est JAMAIS mis en cache :
 *  - tout ce qui n'est pas une requête GET ;
 *  - tout ce qui sort de l'origine (Supabase : auth, Edge Functions, Postgrest).
 *    Mettre en cache une réponse authentifiée exposerait les données d'un compte
 *    au suivant sur le même appareil.
 */

const VERSION = 'velum-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => undefined) // hors-ligne au premier chargement : on n'échoue pas l'install
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Réseau d'abord : on sert le réseau, on garde une copie, on retombe sur le cache. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) ?? (await caches.match(SHELL_URL));
    if (cached) return cached;
    return new Response('Hors-ligne', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Cache d'abord : sert le cache s'il existe, sinon réseau (et met en cache). */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Jamais de cache hors GET (POST /recognize, /auth/v1/token…).
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Jamais de cache hors origine : Supabase (auth + Edge Functions + données).
  // Une réponse authentifiée mise en cache fuiterait d'un compte à l'autre.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
