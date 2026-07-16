/*
 * Le Grand Mogul — offline-first service worker (hand-rolled, no dependency).
 * SOURCE TEMPLATE: public/sw.js is generated from this file at build time
 * (scripts/stamp-sw.mjs), stamping __BUILD_ID__ so every deploy re-installs
 * the worker and refreshes the precache.
 */

const VERSION = "mogul-__BUILD_ID__";
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

/**
 * Precache the app shell, then best-effort cache every /_next/static asset
 * referenced by the precached HTML — without this, a page never visited
 * online would render dead offline (HTML without its hydration chunks).
 */
async function precacheAll() {
  const pages = await caches.open(PAGES_CACHE);
  await pages.addAll(PRECACHE);
  try {
    const statics = await caches.open(STATIC_CACHE);
    const assets = new Set();
    for (const path of ["/", "/play", "/scores"]) {
      const res = await pages.match(path);
      if (!res) continue;
      const html = await res.text();
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s>]+/g)) {
        assets.add(m[0].replace(/&amp;/g, "&"));
      }
    }
    await Promise.all(
      [...assets].map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) await statics.put(url, res);
        } catch {
          /* best effort: runtime caching will pick it up online */
        }
      }),
    );
  } catch {
    /* asset discovery must never fail the install */
  }
}

self.addEventListener("install", (event) => {
  // No skipWaiting: the new worker waits until every tab from the previous
  // build is closed, so activating (which deletes the old build's caches)
  // can never yank the chunks out from under a running match.
  event.waitUntil(precacheAll());
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
          const shell = await caches.match(url.pathname);
          if (shell) return shell;
          // Unknown offline URL: the dedicated offline page, never a page
          // served under the wrong address.
          return caches.match("/offline.html");
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
