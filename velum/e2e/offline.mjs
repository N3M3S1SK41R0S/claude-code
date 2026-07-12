/**
 * Preuve du HORS-LIGNE (§6.1.5, §14 : « collection consultable hors-ligne »).
 *
 * 1. En ligne : charge /collection (le cache React Query est peuplé PUIS
 *    persisté dans le StorageAdapter offline).
 * 2. Démarrage à FROID, réseau Supabase COUPÉ (toutes les requêtes avortées) :
 *    la collection doit s'afficher depuis le cache persisté, sans écran
 *    bloquant (« jamais d'écran d'erreur bloquant sur perte réseau »).
 *
 * Usage : node e2e/offline.mjs   (bundle : pnpm --filter velum-mobile build:web)
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { OUT, chromiumPath, seedSession, seedSettings, startServer, stubSupabase } from './harness.mjs';

await mkdir(OUT, { recursive: true });
const { base, close } = await startServer();
const executablePath = chromiumPath();
const browser = await chromium.launch(executablePath ? { executablePath } : {});

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
};

// ── 1. En ligne : peupler + persister le cache ───────────────────────────────
const online = await browser.newContext();
const pageOn = await online.newPage();
await stubSupabase(pageOn);
await seedSession(pageOn);
await seedSettings(pageOn, {});
await pageOn.goto(`${base}/collection`, { waitUntil: 'networkidle' });
await pageOn.waitForSelector('text=Bandol Domaine Tempier 2016', { timeout: 20000 });
await pageOn.waitForTimeout(2000); // laisse le persisteur écrire (throttle 1 s)

// État de stockage (localStorage : session + réglages + cache React Query persisté).
const storageState = await online.storageState();
const persisted = storageState.origins
  .flatMap((o) => o.localStorage)
  .some((e) => e.name === 'velum.query-cache.v1');
check('le cache React Query est bien persisté (velum.query-cache.v1)', persisted);
await online.close();

// ── 2. Démarrage à froid, réseau coupé ───────────────────────────────────────
const offline = await browser.newContext({ storageState });
const pageOff = await offline.newPage();

let supabaseHits = 0;
await pageOff.route('**/*.supabase.co/**', (route) => {
  supabaseHits += 1;
  return route.abort(); // réseau indisponible
});
const errors = [];
pageOff.on('pageerror', (e) => errors.push(e.message));

await pageOff.goto(`${base}/collection`, { waitUntil: 'domcontentloaded' });
// La collection doit apparaître DEPUIS LE CACHE, sans réseau.
const shown = await pageOff
  .waitForSelector('text=Bandol Domaine Tempier 2016', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
await pageOff.waitForTimeout(600);
await pageOff.screenshot({ path: join(OUT, '13-offline.png') });

check('collection affichée hors-ligne depuis le cache persisté', shown);
// Pas d'écran bloquant : le titre reste rendu, pas de fallback d'ErrorBoundary.
const hasTitle = (await pageOff.locator('text=Ma collection').count()) > 0;
check('aucun écran bloquant (titre « Ma collection » présent)', hasTitle);
const realErrors = errors.filter((m) => !m.includes('ResizeObserver'));
check('aucune erreur JS non interceptée', realErrors.length === 0);
console.log(`  (requêtes Supabase avortées pendant le rendu hors-ligne : ${supabaseHits})`);

await browser.close();
close();

if (failures > 0) {
  console.error(`\nHors-ligne : ${failures} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nHors-ligne : PASS — collection lue depuis le cache, aucun écran bloquant');
