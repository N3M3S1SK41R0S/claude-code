/* Le Donjon du Savoir — offline-first service worker.
   Static file list (no build step): bump VERSION on every content change. */

const VERSION = "donjon-v19";
const CACHE = `${VERSION}-shell`;

const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/board.js",
  "./js/custom.js",
  "./js/items.js",
  "./js/minigames.js",
  "./js/data.js",
  "./js/game.js",
  "./js/herald.js",
  "./js/portraits.js",
  "./js/powers.js",
  "./js/state.js",
  "./js/tts.js",
  "./js/ui.js",
  "./data/questions.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Cache-first with background refresh: instant offline, quiet updates. */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const refresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      // Keep the worker alive until the background refresh has been written,
      // otherwise the update may never land when serving from cache.
      event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
      // The index fallback is for NAVIGATIONS only — a missing sub-resource
      // must fail, not silently receive HTML instead of JS/CSS/JSON.
      return (
        cached ||
        refresh.then((res) => res || (request.mode === "navigate" ? cache.match("./index.html") : Response.error()))
      );
    }),
  );
});
