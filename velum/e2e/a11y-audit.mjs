/**
 * Audit d'accessibilité WCAG 2.2 AA (axe-core) sur les écrans rendus —
 * exigence forte du cahier des charges (persona senior + European
 * Accessibility Act). Complète les tests unitaires de contraste par une
 * analyse du DOM réellement rendu (labels, rôles, ordre des titres, focus,
 * contrastes calculés). Échoue sur toute violation d'impact serious/critical.
 *
 * Usage : node e2e/a11y-audit.mjs   (bundle : pnpm --filter velum-mobile build:web)
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { chromiumPath, seedSession, startServer, stubSupabase } from './harness.mjs';

const SCREENS = [
  { name: 'onboarding', path: '/onboarding', auth: false, expect: 'Passer', title: 'Bienvenue — VELUM' },
  { name: 'sign-in', path: '/sign-in', auth: false, expect: 'demo@velum.app', title: 'Connexion — VELUM' },
  { name: 'paywall', path: '/paywall', auth: false, expect: 'Platine', title: 'Formules — VELUM' },
  { name: 'privacy', path: '/privacy', auth: false, expect: 'Responsable de traitement', title: 'Confidentialité — VELUM' },
  { name: 'accueil', path: '/accueil', auth: true, expect: 'Accès rapide', title: 'Accueil — VELUM' },
  { name: 'capture', path: '/capture', auth: true, expect: 'Vin', title: 'Capturer — VELUM' },
  { name: 'collection', path: '/collection', auth: true, expect: 'Bandol Domaine Tempier 2016', title: 'Ma collection — VELUM' },
  { name: 'carnet', path: '/carnet', auth: true, expect: 'Bandol Domaine Tempier 2016', title: 'Mon carnet — VELUM' },
  { name: 'cellar-sommelier', path: '/cellar-sommelier', auth: true, expect: 'Trouver le vin dans ma cave', title: 'Sommelier de cave — VELUM' },
  { name: 'blind-tasting', path: '/blind-tasting', auth: true, expect: 'Vin n°1', title: 'Dégustation à l’aveugle — VELUM' },
  { name: 'event-sommelier', path: '/event-sommelier', auth: true, expect: 'Composer les accords', title: 'Sommelier d’événement — VELUM' },
  { name: 'community', path: '/community', auth: true, expect: 'Catalogue', title: 'Communauté — VELUM' },
  { name: 'market', path: '/market', auth: true, expect: 'À boire', title: 'Marché — VELUM' },
  { name: 'item', path: '/item/demo-wine', auth: true, expect: 'Valorisation', title: 'Fiche — VELUM' },
  { name: 'arbiter', path: '/arbiter/demo-wine', auth: true, expect: 'Pourquoi ce signal', title: 'Arbitre patrimonial — VELUM' },
  { name: 'item-coin', path: '/item/demo-coin', auth: true, expect: 'Valorisation', title: 'Fiche — VELUM' },
  { name: 'item-stamp', path: '/item/demo-stamp', auth: true, expect: 'Valorisation', title: 'Fiche — VELUM' },
  { name: 'item-art', path: '/item/demo-art', auth: true, expect: 'Valorisation', title: 'Fiche — VELUM' },
  { name: 'item-watch', path: '/item/demo-watch', auth: true, expect: 'Valorisation', title: 'Fiche — VELUM' },
  { name: 'profile', path: '/profile', auth: true, expect: 'Compte Démo VELUM', title: 'Profil — VELUM' },
];

// Tags WCAG 2.0/2.1/2.2 niveaux A et AA.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKING = new Set(['serious', 'critical']);

const { base, close } = await startServer();
const browser = await chromium.launch((() => {
  const p = chromiumPath();
  return p ? { executablePath: p } : {};
})());

// Deux contextes : PUBLIC (sans session — sinon le garde d'auth redirige
// sign-in vers l'app) et CONNECTÉ (session semée).
const publicContext = await browser.newContext();
const publicPage = await publicContext.newPage();
await stubSupabase(publicPage);

const authedContext = await browser.newContext();
const authedPage = await authedContext.newPage();
await stubSupabase(authedPage);
await seedSession(authedPage);

let blocking = 0;
const summary = [];

for (const screen of SCREENS) {
  const page = screen.auth ? authedPage : publicPage;
  await page.goto(`${base}${screen.path}`, { waitUntil: 'networkidle' });
  if (screen.name === 'onboarding') await page.waitForTimeout(1200);
  if (screen.expect) {
    await page.waitForSelector(`text=${screen.expect}`, { timeout: 20000 });
  }
  await page.waitForTimeout(600);

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));

  const actualTitle = await page.title();
  if (actualTitle !== screen.title) {
    violations.unshift({
      id: 'document-title-specific',
      impact: 'serious',
      nodes: 1,
      help: `Titre attendu « ${screen.title} », obtenu « ${actualTitle} »`,
    });
  }

  const serious = violations.filter((v) => BLOCKING.has(v.impact ?? ''));
  blocking += serious.length;
  summary.push({ screen: screen.name, total: violations.length, serious, violations });

  const mark = serious.length === 0 ? '✓' : '✗';
  console.log(`${mark} ${screen.name} — ${violations.length} règle(s), ${serious.length} bloquante(s)`);
  for (const v of violations) {
    const flag = BLOCKING.has(v.impact ?? '') ? '  ‼' : '  ·';
    console.log(`${flag} [${v.impact}] ${v.id} ×${v.nodes} — ${v.help}`);
  }
}

// Le profil est le dernier écran authentifié de la matrice : la langue doit
// changer le contenu ET le titre sans navigation supplémentaire.
await authedPage.getByRole('button', { name: 'EN', exact: true }).click();
await authedPage.waitForSelector('text=Language', { timeout: 20000 });
await authedPage.waitForFunction(() => document.title === 'Profile — VELUM');
console.log('✓ profile-en — contenu et document.title basculent sans navigation');

await browser.close();
close();

console.log('\n── Bilan a11y (WCAG 2.2 AA, axe-core) ──');
for (const s of summary) console.log(`  ${s.screen}: ${s.serious.length} bloquante(s) / ${s.total} règle(s)`);

if (blocking > 0) {
  console.error(`\nAudit a11y : ${blocking} violation(s) serious/critical`);
  process.exit(1);
}
console.log('\nAudit a11y : PASS (aucune violation serious/critical)');
