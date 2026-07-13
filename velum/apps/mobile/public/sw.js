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

const VERSION = 'velum-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/';

/**
 * Pré-chargement à l'installation — indispensable.
 *
 * Au tout premier chargement, le service worker n'a pas encore le contrôle de la
 * page : le bundle JS est téléchargé SANS passer par lui, donc jamais mis en
 * cache. Hors-ligne, on servait alors la coquille HTML sans son JavaScript →
 * écran blanc (mesuré). On lit donc la coquille à l'install pour en extraire les
 * URLs d'assets (noms hachés, donc impossible à coder en dur) et on les cache.
 */
async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  const response = await fetch(new Request(SHELL_URL, { cache: 'reload' }));
  if (!response.ok) return;
  await cache.put(SHELL_URL, response.clone());

  const html = await response.text();
  const urls = new Set();
  const pattern = /(?:src|href)="(\/[^"]+\.(?:js|css|png|ico|webmanifest))"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) urls.add(match[1]);

  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(
    [...urls].map((url) =>
      assets.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
    ),
  );
}

self.addEventListener('install', (event) => {
  // `catch` : hors-ligne au premier chargement, on n'échoue pas l'installation.
  event.waitUntil(
    precache()
      .catch(() => undefined)
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
