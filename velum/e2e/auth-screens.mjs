/**
 * Écrans AUTHENTIFIÉS de VELUM — rendu + captures, sans backend réel.
 *
 * Stratégie : les routes `(tabs)`, `/carnet`, `/item/:id`, `/cellar-sommelier`
 * ne sont pas gardées individuellement (seul `index.tsx` redirige) et
 * `AuthProvider` ne bloque pas ses enfants. On navigue donc directement vers
 * chaque écran en INTERCEPTANT le réseau Supabase (REST + Edge Functions)
 * avec des fixtures conformes (e2e/fixtures.mjs). Double emploi :
 *   - captures stores des écrans accessibles seulement connecté ;
 *   - smoke test de rendu d'écrans jusqu'ici uniquement typecheckés.
 *
 * Usage : node e2e/auth-screens.mjs   (bundle : pnpm --filter velum-mobile build:web)
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { ALERTS, ITEMS, NOTIFICATIONS, PAIRING, PROFILE, SESSION, VALUATIONS } from './fixtures.mjs';

const DIST = resolve('apps/mobile/dist');
const OUT = resolve('docs/screenshots');
const WIDTH = 1320;
const HEIGHT = 2868;
const SCALE = 3;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.json': 'application/json',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Bundle web introuvable — lancer pnpm --filter velum-mobile build:web');
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

// ── Serveur statique avec résolution des routes dynamiques expo-router ───────
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const clean = decodeURIComponent(url.pathname);
  let path = join(DIST, clean);
  if (clean.startsWith('/item/')) {
    path = join(DIST, 'item/[id].html'); // route dynamique expo-router
  } else if (clean === '/') {
    path = join(DIST, 'index.html');
  } else if (existsSync(join(path, 'index.html'))) {
    path = join(path, 'index.html'); // route en dossier : /collection → collection/index.html
  } else if (!existsSync(path) && existsSync(`${path}.html`)) {
    path = `${path}.html`; // route à plat : /carnet → carnet.html
  } else if (!existsSync(path)) {
    path = join(DIST, 'index.html'); // repli SPA
  }
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
const base = `http://127.0.0.1:${server.address().port}`;

// ── Stub PostgREST + Edge Functions ─────────────────────────────────────────
function eqParam(url, key) {
  const v = url.searchParams.get(key);
  return v?.startsWith('eq.') ? v.slice(3) : undefined;
}

async function handleSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
  const json = (data, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });

  if (path.endsWith('/rest/v1/profiles')) return json(single ? PROFILE : [PROFILE]);

  if (path.endsWith('/rest/v1/items')) {
    const id = eqParam(url, 'id');
    if (id) return json(ITEMS.find((i) => i.id === id) ?? null);
    const domain = eqParam(url, 'domain');
    const rows = domain ? ITEMS.filter((i) => i.domain === domain) : ITEMS;
    return json(single ? (rows[0] ?? null) : rows);
  }

  if (path.endsWith('/rest/v1/valuations')) {
    const itemId = eqParam(url, 'item_id');
    let rows = (itemId && VALUATIONS[itemId]) || []; // fixtures déjà triées valued_at desc
    // `.latest()` = .limit(1).maybeSingle() ; `.history()` = pas de limite.
    // Honorer `limit` évite que maybeSingle rejette « multiple rows returned ».
    const limit = Number(url.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) rows = rows.slice(0, limit);
    return json(rows);
  }

  if (path.endsWith('/rest/v1/alerts')) {
    const itemId = eqParam(url, 'item_id');
    return json(itemId ? ALERTS.filter((a) => a.item_id === itemId) : ALERTS);
  }

  if (path.endsWith('/rest/v1/notifications')) return json(NOTIFICATIONS);

  if (path.includes('/functions/v1/cellar-pairing')) return json(PAIRING);
  if (path.includes('/functions/v1/')) return json({ ok: true });

  if (path.includes('/auth/v1/')) return json({}, 200);

  return json(single ? null : []);
}

const executablePath =
  process.env.VELUM_CHROMIUM ??
  ['/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(
    (p) => existsSync(p),
  );
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  viewport: { width: WIDTH / SCALE, height: HEIGHT / SCALE },
  deviceScaleFactor: SCALE,
});
// Intercepte n'importe quel hôte Supabase (l'URL du build varie : `demo`
// en local, `ci-placeholder` en CI).
await page.route('**/*.supabase.co/**', handleSupabase);

// Session semée avant le boot : rend `useSession()` truthy sur web
// (AsyncStorage web ⇒ localStorage, clé supabase-js `sb-<ref>-auth-token`).
// On couvre les refs des deux builds possibles.
await page.addInitScript((session) => {
  for (const ref of ['demo', 'ci-placeholder']) {
    try {
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    } catch {
      /* localStorage indisponible : ignoré */
    }
  }
}, SESSION);

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

let failures = 0;
async function screen(name, path, expectText, prep) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  if (prep) await prep();
  try {
    await page.waitForSelector(`text=${expectText}`, { timeout: 20000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`✓ ${name}.png — « ${expectText} » rendu`);
  } catch {
    failures += 1;
    await page.screenshot({ path: join(OUT, `${name}-FAIL.png`) });
    console.error(`✗ ${name} — texte attendu absent : « ${expectText} »`);
  }
}

// 06. Collection — cave/cabinet/galerie/album + bandeau « à boire ».
await screen('06-collection', '/collection', 'Bandol Domaine Tempier 2016');
// 07. Carnet virtuel (Gold/Platine) — mise en scène par module.
await screen('07-carnet', '/carnet', 'Bandol Domaine Tempier 2016');
// 08. Fiche d'un objet — analyse ZAPPA + valorisation IC.
await screen('08-fiche-vin', '/item/demo-wine', 'Bandol Domaine Tempier 2016');
// 09. Sommelier de cave — saisir un plat puis lancer la recherche.
await screen('09-sommelier', '/cellar-sommelier', 'Bandol Domaine Tempier 2016', async () => {
  const input = page.locator('input, textarea').first();
  await input.fill('magret de canard aux figues');
  await page.getByText('Trouver le vin dans ma cave').click().catch(() => {});
  await page.waitForTimeout(1500);
});
// 10. Marché — notifications + alertes + communauté Platine.
await screen('10-marche', '/market', 'À boire');
// 11. Profil — mode senior, langue, consentement IA, suppression de compte.
await screen('11-profil', '/profile', 'Compte Démo VELUM');

const realErrors = pageErrors.filter((m) => !m.includes('ResizeObserver'));
if (realErrors.length > 0) {
  console.error('Erreurs JS :', realErrors.slice(0, 5).join(' | '));
  failures += realErrors.length;
}

await browser.close();
server.close();

if (failures > 0) {
  console.error(`\nÉcrans authentifiés : ${failures} échec(s)`);
  process.exit(1);
}
console.log(`\nÉcrans authentifiés : PASS — captures → ${OUT}`);
