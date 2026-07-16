/* Le Grand Mogul — offline-first service worker (hand-rolled, no dependency). */

const VERSION = "mogul-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

const PRECACHE = [
  "/",
  "/play",
  "/scores",
  "/offline.html",
  "/manifest.webmanifest",
  "/data/bank.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Immutable build assets: cache-first. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

/** Question bank + other data: stale-while-revalidate. */
function isData(url) {
  return url.pathname.startsWith("/data/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls are always live — the client has its own offline fallback.
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (isData(url)) {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || network.then((res) => res || new Response("{}", { status: 503 }));
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match(new URL(url.pathname, self.location.origin).pathname);
          if (shell) return shell;
          const home = await caches.match("/");
          return home || caches.match("/offline.html");
        }),
    );
    return;
  }

  // Everything else (route chunks fetched at runtime, fonts…): network,
  // falling back to whatever a previous visit put in the caches.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error())),
  );
});
