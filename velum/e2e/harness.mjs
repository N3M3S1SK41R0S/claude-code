/**
 * Harnais E2E partagé : serveur statique du bundle web exporté (avec
 * résolution des routes expo-router), stub réseau Supabase (REST + Edge)
 * sur fixtures, et injection d'une session. Utilisé par auth-screens.mjs
 * (captures) et a11y-audit.mjs (axe-core).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { ALERTS, ITEMS, LISTINGS, NOTIFICATIONS, ORDERS, PAIRING, PROFILE, SESSION, VALUATIONS } from './fixtures.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.json': 'application/json',
};

export const DIST = resolve('apps/mobile/dist');
export const OUT = resolve('docs/screenshots');
export const IPHONE_69 = { width: 1320, height: 2868, scale: 3 };

/** Démarre le serveur statique ; renvoie { base, close }. */
export async function startServer(dist = DIST) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const clean = decodeURIComponent(url.pathname);
    let path = join(dist, clean);
    if (clean.startsWith('/item/')) path = join(dist, 'item/[id].html');
    else if (clean === '/') path = join(dist, 'index.html');
    else if (existsSync(join(path, 'index.html'))) path = join(path, 'index.html');
    else if (!existsSync(path) && existsSync(`${path}.html`)) path = `${path}.html`;
    else if (!existsSync(path)) path = join(dist, 'index.html');
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('nf');
    }
  });
  await new Promise((r) => server.listen(0, r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

function eqParam(url, key) {
  const v = url.searchParams.get(key);
  return v?.startsWith('eq.') ? v.slice(3) : undefined;
}

/** Branche l'interception réseau Supabase (fixtures) sur une page Playwright. */
export async function stubSupabase(page) {
  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });
    if (path.endsWith('/rest/v1/profiles')) return json([PROFILE]);
    if (path.endsWith('/rest/v1/items')) {
      const id = eqParam(url, 'id');
      if (id) return json(ITEMS.find((i) => i.id === id) ?? null);
      const domain = eqParam(url, 'domain');
      return json(domain ? ITEMS.filter((i) => i.domain === domain) : ITEMS);
    }
    if (path.endsWith('/rest/v1/valuations')) {
      const itemId = eqParam(url, 'item_id');
      let rows = (itemId && VALUATIONS[itemId]) || [];
      const limit = Number(url.searchParams.get('limit'));
      if (Number.isFinite(limit) && limit > 0) rows = rows.slice(0, limit);
      return json(rows);
    }
    if (path.endsWith('/rest/v1/alerts')) {
      const itemId = eqParam(url, 'item_id');
      return json(itemId ? ALERTS.filter((a) => a.item_id === itemId) : ALERTS);
    }
    if (path.endsWith('/rest/v1/notifications')) return json(NOTIFICATIONS);
    if (path.endsWith('/rest/v1/listings')) {
      const status = eqParam(url, 'status');
      return json(status ? LISTINGS.filter((l) => l.status === status) : LISTINGS);
    }
    if (path.endsWith('/rest/v1/orders')) return json(ORDERS);
    if (path.includes('/functions/v1/cellar-pairing')) return json(PAIRING);
    if (path.includes('/functions/v1/')) return json({ ok: true });
    if (path.includes('/auth/v1/')) return json({});
    return json([]);
  });
}

/** Sème une session avant le boot (rend useSession truthy sur web). */
export async function seedSession(page) {
  await page.addInitScript((session) => {
    for (const ref of ['demo', 'ci-placeholder']) {
      try {
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      } catch {
        /* ignoré */
      }
    }
  }, SESSION);
}

/**
 * Sème les réglages persistés (zustand persist, clé `velum.settings.v1`) avant
 * le boot — notamment `senior: true` pour rendre l'app en mode senior.
 */
export async function seedSettings(page, settings) {
  await page.addInitScript(
    (state) => {
      try {
        window.localStorage.setItem('velum.settings.v1', JSON.stringify({ state, version: 0 }));
      } catch {
        /* ignoré */
      }
    },
    { locale: 'fr', onboardingDone: true, aiConsent: true, ...settings },
  );
}

/** Chemin du binaire Chromium préinstallé (ou VELUM_CHROMIUM). */
export function chromiumPath() {
  return (
    process.env.VELUM_CHROMIUM ??
    ['/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(
      (p) => existsSync(p),
    )
  );
}
