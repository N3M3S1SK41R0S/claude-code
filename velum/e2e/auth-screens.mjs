/**
 * Écrans AUTHENTIFIÉS de VELUM — rendu + captures, sans backend réel.
 *
 * Les routes `(tabs)`, `/carnet`, `/item/:id`, `/cellar-sommelier` ne sont pas
 * gardées individuellement (seul `index.tsx` redirige) et `AuthProvider` ne
 * bloque pas ses enfants. On y navigue donc directement en interceptant le
 * réseau Supabase (harness.mjs) avec des fixtures et une session semée.
 * Double emploi : captures stores + smoke test de rendu de ces écrans.
 *
 * Usage : node e2e/auth-screens.mjs   (bundle : pnpm --filter velum-mobile build:web)
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { OUT, IPHONE_69, chromiumPath, seedSession, startServer, stubSupabase } from './harness.mjs';

await mkdir(OUT, { recursive: true });
const { base, close } = await startServer();
const executablePath = chromiumPath();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width: IPHONE_69.width / IPHONE_69.scale, height: IPHONE_69.height / IPHONE_69.scale },
  deviceScaleFactor: IPHONE_69.scale,
});
const page = await context.newPage();
await stubSupabase(page);
await seedSession(page);

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

// 05b. Accueil — sceau, vidéo de lancement, accès rapides (retour depuis chaque écran).
await screen('18-accueil', '/accueil', 'Accès rapide');
// 06. Collection — cave/cabinet/galerie/album + bandeau « à boire ».
await screen('06-collection', '/collection', 'Bandol Domaine Tempier 2016');
// 07. Carnet virtuel (Gold/Platine) — mise en scène par module.
await screen('07-carnet', '/carnet', 'Bandol Domaine Tempier 2016');
// 08. Fiche d'un objet — analyse ZAPPA + valorisation IC + histoire & dernières ventes.
await screen('08-fiche-vin', '/item/demo-wine', 'Bandol Domaine Tempier 2016');
// 19. Fiche pièce — grade, tirage, dernières ventes numismatiques (CGB, Numista…).
await screen('19-fiche-piece', '/item/demo-coin', '5 Francs Semeuse');
// 20. Fiche timbre — dentelure, cote Yvert, ventes Delcampe/eBay.
await screen('20-fiche-timbre', '/item/demo-stamp', 'Semeuse lignée');
// 21. Fiche tableau — attribution prudente, comparables Drouot/Artprice.
await screen('21-fiche-tableau', '/item/demo-art', 'Paysage aux oliviers');
// 22. Arbitre patrimonial (Gold+) — verdict boire/garder/vendre + raisons.
await screen('22-arbitre', '/arbiter/demo-wine', 'Pourquoi ce signal');
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
// 15. Dégustation à l'aveugle — cartes anonymes tirées de la cave.
await screen('15-degustation-aveugle', '/blind-tasting', 'Vin n°1');
// 16. Sommelier d'événement — accords par plat depuis la cave.
await screen('16-sommelier-evenement', '/event-sommelier', 'Composer les accords');
// 17. Communauté — catalogue d'annonces sous séquestre.
await screen('17-communaute', '/community', 'Napoléon III');

const realErrors = pageErrors.filter((m) => !m.includes('ResizeObserver'));
if (realErrors.length > 0) {
  console.error('Erreurs JS :', realErrors.slice(0, 5).join(' | '));
  failures += realErrors.length;
}

await browser.close();
close();

if (failures > 0) {
  console.error(`\nÉcrans authentifiés : ${failures} échec(s)`);
  process.exit(1);
}
console.log(`\nÉcrans authentifiés : PASS — captures → ${OUT}`);
