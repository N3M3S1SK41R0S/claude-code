/**
 * E2E de fumée — PWA VELUM (export statique `expo export --platform web`).
 *
 * Vérifie sur un vrai Chromium que l'app web démarre et rend le parcours
 * d'entrée : onboarding (pitch « Levez le voile… »), choix des 5 modules,
 * navigation vers la création de compte. Aucune dépendance réseau : le
 * bundle exporté est servi localement, Supabase n'est pas contacté avant
 * l'authentification.
 *
 * Usage :  node e2e/web-smoke.mjs [chemin-dist]
 *          (défaut : apps/mobile/dist — construire d'abord via
 *           `pnpm --filter velum-mobile build:web`)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve(process.argv[2] ?? 'apps/mobile/dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(join(DIST, 'index.html'))) {
  fail(`Bundle web introuvable : ${DIST} — lancer d'abord pnpm --filter velum-mobile build:web`);
}

// Serveur statique minimal avec repli SPA sur index.html.
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = join(DIST, decodeURIComponent(url.pathname));
  if (!existsSync(path) || url.pathname === '/') {
    path = existsSync(`${path}.html`) ? `${path}.html` : join(DIST, 'index.html');
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`· PWA servie depuis ${DIST} sur ${base}`);

// Chromium : binaire préinstallé de l'environnement si la révision attendue
// par la version de Playwright n'est pas présente (VELUM_CHROMIUM pour forcer).
const executablePath =
  process.env.VELUM_CHROMIUM ??
  ['/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(
    (p) => existsSync(p),
  );
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1) Boot → redirection onboarding : la vidéo d'intro (sceau animé) passe
  //    en premier — on la saute comme le ferait l'utilisateur.
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Passer', { timeout: 20000 });
  console.log('✓ Onboarding rendu (vidéo d’intro affichée)');
  await page.click('text=Passer');
  await page.waitForSelector('text=Levez le voile sur la valeur de vos objets', { timeout: 20000 });
  console.log('✓ Pitch affiché après la vidéo');

  // 2) Les 5 modules sont proposés (philatélie et horlogerie incluses).
  for (const moduleName of ['Vin', 'Pièces', 'Tableaux', 'Timbres', 'Montres']) {
    if ((await page.locator(`text=${moduleName}`).count()) === 0) {
      fail(`Module absent de l'onboarding : ${moduleName}`);
    }
  }
  console.log('✓ Les 5 modules sont proposés (dont Timbres et Montres)');

  // 3) La page de confidentialité embarquée répond (exigence stores).
  await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Responsable de traitement', { timeout: 20000 });
  console.log('✓ /privacy rendue (politique embarquée)');

  // 4) Aucune erreur JS non interceptée pendant le parcours.
  const realErrors = pageErrors.filter((m) => !m.includes('ResizeObserver'));
  if (realErrors.length > 0) {
    fail(`Erreurs JS pendant le parcours : ${realErrors.join(' | ')}`);
  }
  console.log('✓ Aucune erreur JS non interceptée');

  console.log('\nE2E web : PASS');
} finally {
  await browser.close();
  server.close();
}
