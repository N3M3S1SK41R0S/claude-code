/* Le Donjon du Savoir — offline-first service worker.
   Static file list (no build step): bump VERSION on every content change. */

const VERSION = "donjon-v29";
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
  "./js/wordgames.js",
  "./js/data.js",
  "./js/game.js",
  "./js/herald.js",
  "./js/portraits.js",
  "./js/powers.js",
  "./js/state.js",
  "./js/tts.js",
  "./js/sfx.js",
  "./js/ui.js",
  "./data/questions.json",
  "./data/wordgames.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/portrait-cageot.png",
  "./assets/portrait-etincelle.png",
  "./assets/portrait-gobelin.png",
  "./assets/portrait-nebulia.png",
  "./assets/portrait-boumbastien.png",
  "./assets/portrait-duchesse.png",
  "./assets/case-question.png",
  "./assets/case-chance.png",
  "./assets/case-evenement.png",
  "./assets/case-malus.png",
  "./assets/case-pieces.png",
  "./assets/case-joker.png",
  "./assets/case-gambit.png",
  "./assets/case-trounoir.png",
  "./assets/case-boutique.png",
  "./assets/case-insolite.png",
  "./assets/case-expression.png",
  "./assets/case-tresor.png",
  "./assets/heraut.png",
  "./assets/heraut-medaillon.png",
  "./assets/decor-chateau.png",
  "./assets/decor-arbre.png",
  "./assets/decor-bougie.png",
  "./assets/decor-champignon.png",
  "./assets/decor-chauvesouris.png",
  "./assets/decor-toile.png",
  "./assets/decor-cristal.png",
  "./assets/decor-statue.png",
  "./assets/decor-volcan.png",
  "./assets/decor-os.png",
  "./assets/decor-etoile.png",
  "./assets/decor-flamme.png",
  "./assets/hero-accueil.webp",
  "./assets/fond-donjon.webp",
  "./assets/fond-crypte.webp",
  "./assets/fond-tour.webp",
  "./assets/fond-catacombes.webp",
  "./assets/fond-labyrinthe.webp",
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
