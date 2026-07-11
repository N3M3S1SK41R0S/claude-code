/**
 * Screenshots stores (brouillons) — capturés depuis la PWA exportée aux
 * dimensions App Store iPhone 6,9" (1320×2868). Couvre les écrans accessibles
 * SANS compte : onboarding (vidéo du sceau), pitch + 4 modules, connexion,
 * formules, politique de confidentialité.
 * Les écrans authentifiés (collection, carnet, fiche, sommelier) se capturent
 * depuis un simulateur avec le compte démo — voir docs/STORE_LISTING.md §3.
 *
 * Usage : node e2e/store-screens.mjs   → docs/screenshots/*.png
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('apps/mobile/dist');
const OUT = resolve('docs/screenshots');
const WIDTH = 1320;
const HEIGHT = 2868;
const SCALE = 3; // rendu logique 440×956 (proche iPhone), upscalé ×3

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Bundle web introuvable — lancer pnpm --filter velum-mobile build:web');
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

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
    res.end('nf');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

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

async function shot(name) {
  await page.waitForTimeout(1200); // laisse les transitions/vidéo se poser
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png (${WIDTH}×${HEIGHT})`);
}

// 1. Onboarding — vidéo du sceau (identité de marque).
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Passer', { timeout: 20000 });
await shot('01-onboarding-sceau');

// 2. Pitch + choix des 4 modules.
await page.click('text=Passer');
await page.waitForSelector('text=Levez le voile sur la valeur de vos objets', { timeout: 20000 });
await shot('02-onboarding-modules');

// 3. Formules (paywall — mode dégradé web : paliers indicatifs).
await page.goto(`${base}/paywall`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Platine', { timeout: 20000 });
await shot('03-formules');

// 4. Connexion (email + Apple/Google).
await page.goto(`${base}/sign-in`, { waitUntil: 'networkidle' });
await shot('04-connexion');

// 5. Politique de confidentialité embarquée.
await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Responsable de traitement', { timeout: 20000 });
await shot('05-confidentialite');

await browser.close();
server.close();
console.log(`\nScreenshots → ${OUT}`);
