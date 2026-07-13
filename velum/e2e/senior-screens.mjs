/**
 * Preuve visuelle du MODE SENIOR (persona « prioritaire » du cahier des
 * charges). Rend les écrans clés avec `senior: true` semé dans les réglages
 * persistés, et VÉRIFIE que l'agrandissement s'applique réellement : les
 * cibles tactiles passent à ≥ 56 pt et le texte grossit (×1.25). Échoue si le
 * mode senior ne change rien au rendu (régression de useSeniorMode().scale).
 *
 * Usage : node e2e/senior-screens.mjs   (bundle : pnpm --filter velum-mobile build:web)
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { OUT, IPHONE_69, chromiumPath, seedSession, seedSettings, startServer, stubSupabase } from './harness.mjs';

await mkdir(OUT, { recursive: true });
const { base, close } = await startServer();
const executablePath = chromiumPath();
const browser = await chromium.launch(executablePath ? { executablePath } : {});

/** Mesure la hauteur d'un bouton et la taille de police d'un titre sur /collection. */
async function measure(senior) {
  const context = await browser.newContext({
    viewport: { width: IPHONE_69.width / IPHONE_69.scale, height: IPHONE_69.height / IPHONE_69.scale },
    deviceScaleFactor: IPHONE_69.scale,
  });
  const page = await context.newPage();
  await stubSupabase(page);
  await seedSession(page);
  await seedSettings(page, { senior });

  await page.goto(`${base}/collection`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Ouvrir mon carnet', { timeout: 20000 });
  await page.waitForTimeout(900);

  const metrics = await page.evaluate(() => {
    const byText = (t) =>
      [...document.querySelectorAll('*')].find((el) => el.textContent?.trim() === t);
    const btn = byText('Ouvrir mon carnet');
    const title = byText('Ma collection');
    const btnBox = btn?.closest('[role="button"]')?.getBoundingClientRect() ?? btn?.getBoundingClientRect();
    return {
      buttonHeight: btnBox ? Math.round(btnBox.height) : 0,
      titleFontPx: title ? Math.round(parseFloat(getComputedStyle(title).fontSize)) : 0,
    };
  });

  if (senior) await page.screenshot({ path: join(OUT, '12-mode-senior.png') });
  await context.close();
  return metrics;
}

const normal = await measure(false);
const senior = await measure(true);
await browser.close();
close();

console.log('Rendu normal :', JSON.stringify(normal));
console.log('Rendu senior :', JSON.stringify(senior));

let failures = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
}

// Le bouton doit atteindre la cible tactile senior (≥ 56 pt) et grandir.
check('bouton ≥ 56 pt en mode senior', senior.buttonHeight >= 56);
check('bouton agrandi vs normal', senior.buttonHeight > normal.buttonHeight);
// Le titre doit grossir (~×1.25).
check('titre agrandi en mode senior', senior.titleFontPx > normal.titleFontPx);

if (failures > 0) {
  console.error(`\nMode senior : ${failures} vérification(s) en échec — l'agrandissement ne s'applique pas.`);
  process.exit(1);
}
console.log('\nMode senior : PASS — agrandissement effectif (capture → 12-mode-senior.png)');
