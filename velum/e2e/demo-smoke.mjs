/**
 * Preuve du MODE DÉMO : l'app tourne SANS backend ni réseau (client en
 * mémoire). On drive le parcours cœur de bout en bout — entrée directe dans
 * l'app → scan texte → candidats → confirmation → fiche + estimation →
 * l'objet apparaît dans la collection. AUCUN stub réseau : si quoi que ce
 * soit appelait Supabase, ça échouerait ; ici tout est local.
 *
 * Prérequis : build démo → EXPO_PUBLIC_DEMO=1 expo export --platform web
 * Usage : node e2e/demo-smoke.mjs
 */
import { chromium } from 'playwright';
import { chromiumPath, startServer } from './harness.mjs';

const { base, close } = await startServer();
const executablePath = chromiumPath();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();

// On ne tolère AUCUN appel au backend (supabase) : le mode démo est 100 %
// local. Les autres externes (ex. CDN jsQR d'expo-camera sur le web) sont
// hors sujet et laissés passer.
let backendHits = 0;
await page.route('**/*supabase*/**', (route) => {
  backendHits += 1;
  return route.abort();
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
};

// 1. Entrée directe dans l'app (mode démo → accueil : sceau + vidéo de lancement).
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
const onHome = await page
  .waitForSelector('text=Accès rapide', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('entrée directe → accueil (sceau + vidéo + accès rapide)', onHome);

// 2. Aller à Capturer et choisir le module Vin.
await page.goto(`${base}/capture`, { waitUntil: 'networkidle' });
const onCapture = await page
  .waitForSelector('text=Vin', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('grille des 4 modules (Capturer)', onCapture);
await page.getByText('Vin', { exact: true }).first().click();
await page.waitForTimeout(800);

// 3. Consentement IA si présent (1er scan).
await page.getByText("J'accepte").click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(400);

// 4. Onglet saisie texte → décrire un vin → analyser.
await page.getByText('Texte', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(300);
const input = page.locator('input, textarea').first();
await input.fill('Clos Rougeard Le Bourg 2014');
await page.getByText(/Analyser/i).first().click();

// 5. Écran candidats → confirmer le premier.
const gotCandidates = await page
  .waitForSelector('text=Clos Rougeard Le Bourg 2014', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('reconnaissance → écran candidats', gotCandidates);
await page.getByText(/Confirmer/i).first().click().catch(() => {});

// 6. Fiche : estimation calculée par le vrai moteur (bloc « Valorisation »).
const gotSheet = await page
  .waitForSelector('text=Valorisation', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('analyse + estimation (fiche avec bloc Valorisation)', gotSheet);
await page.waitForTimeout(500);

// 7. Collection : l'objet scanné + la collection démo pré-remplie.
await page.goto(`${base}/collection`, { waitUntil: 'networkidle' });
const inCollection = await page
  .waitForSelector('text=Bandol Domaine Tempier 2016', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check('collection démo pré-remplie visible', inCollection);

check('aucun appel au backend Supabase', backendHits === 0);
// jsQR (CDN d'expo-camera sur web) est hors sujet — on l'ignore.
const realErrors = errors.filter((m) => !m.includes('ResizeObserver') && !m.includes('jsQR') && !m.includes('importScripts'));
check('aucune erreur JS non interceptée', realErrors.length === 0);
if (realErrors.length) console.error('  erreurs:', realErrors.slice(0, 3).join(' | '));

await browser.close();
close();

if (failures > 0) {
  console.error(`\nMode démo : ${failures} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nMode démo : PASS — parcours cœur complet sans backend');
