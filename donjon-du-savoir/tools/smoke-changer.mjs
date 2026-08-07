// SMOKE du dépannage « on n'a pas compris » : le bouton est proposé sur la
// question, il la remplace vraiment par une AUTRE, et il ne s'offre qu'une
// fois (sinon on pourrait fouiller la banque jusqu'à la question la plus
// facile). Vérifié sur le plateau ET en Partie Éclair.
// Run: node tools/smoke-changer.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let fails = 0;
const check = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };
// On compare l'énoncé ET les propositions : deux Sons Mystères d'affilée
// portent le MÊME énoncé (« Écoutez bien… quel est ce son ? »), seul le
// bruitage et les propositions changent. Comparer le seul texte ferait
// conclure à tort que la question n'a pas été remplacée.
const enonce = async () => (await page.locator(".question-texte, .karaoke, .eclair-texte").first().textContent().catch(() => "")) ?? "";
const empreinte = async () => {
  const t = await enonce();
  const choix = await page.locator(".choices .btn-choice, .eclair-choix").allTextContents().catch(() => []);
  return `${t}||${choix.join("|")}`;
};

try {
  await page.addInitScript(() => { window.__DONJON_TEST = true; });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 10000 });

  // ---------- sur le plateau ----------
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  let trouve = false;
  // 400 tours de patience : le dépannage n'est proposé que sur les écrans où la
  // question est VISIBLE (pas sur le pari de confiance ni le choix CASH/CARRÉ/
  // DUO, où l'on mise avant de la lire). Une traversée malchanceuse peut donc
  // enchaîner plusieurs de ces écrans-là avant de croiser une vraie question.
  let parties = 1;
  for (let i = 0; i < 400 && !trouve; i++) {
    if (await page.locator(".changer-question").count()) { trouve = true; break; }
    // La traversée clique vite : un pion peut atteindre le Trésor avant qu'on
    // ait croisé une question éligible. On repart alors pour une partie plutôt
    // que de rester planté sur l'écran de victoire — c'est un comportement du
    // jeu qu'on observe, pas une partie précise qu'on rejoue.
    if (await page.locator("#screen-victory:not([hidden])").count()) {
      parties += 1;
      await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
      await page.locator("#bank-info").textContent({ timeout: 10000 });
      await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
      await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 }).catch(() => {});
      continue;
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 6000 }).catch(() => {});
      continue;
    }
    const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder/ }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) { await next.click().catch(() => {}); continue; }
    // Le `:visible` et la restriction au panneau sont indispensables : sans eux,
    // `.first()` désigne un bouton caché d'un autre écran, la traversée n'appuie
    // plus sur rien et le test échoue au hasard plutôt que sur un vrai défaut.
    const gros = page.locator("#panel .btn-big:not([disabled]):visible, #panel .btn-choice:not([disabled]):visible, #panel button:not([disabled]):visible").first();
    if (await gros.isVisible().catch(() => false)) { await gros.click().catch(() => {}); continue; }
    await page.waitForTimeout(120);
  }
  if (!trouve) {
    const ecran = (await page.locator("#panel, .panel").first().innerText().catch(() => "")) ?? "";
    console.log(`  (bloqué sur : ${ecran.split("\n").slice(0, 4).join(" | ").slice(0, 160)})`);
  }
  check(`le dépannage est proposé sur une question du plateau${parties > 1 ? ` (${parties} parties jouées)` : ""}`, trouve);
  if (trouve) {
    const avant = await empreinte();
    const avantTexte = await enonce();
    await page.locator(".changer-question").first().click();
    await page.waitForTimeout(500);
    const apres = await empreinte();
    const apresTexte = await enonce();
    check(`la question a bien été remplacée (« ${avantTexte.slice(0, 28)}… » → « ${apresTexte.slice(0, 28)}… »)`, Boolean(apresTexte) && apres !== avant);
    check("le dépannage ne se represente pas sur la nouvelle question", (await page.locator(".changer-question").count()) <= 1);
  }

  // ---------- en Partie Éclair ----------
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 10000 });
  await page.getByRole("button", { name: /Partie Éclair/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "⚡ C'est parti !" }).click();
  await page.waitForTimeout(600);
  const dispoEclair = (await page.locator(".changer-question").count()) > 0;
  check("le dépannage est proposé en Partie Éclair", dispoEclair);
  if (dispoEclair) {
    const avant = await empreinte();
    const avantTexte = await enonce();
    await page.locator(".changer-question").first().click();
    await page.waitForTimeout(500);
    const apres = await empreinte();
    const apresTexte = await enonce();
    check(`la question éclair a été remplacée (« ${avantTexte.slice(0, 24)}… » → « ${apresTexte.slice(0, 24)}… »)`, Boolean(apresTexte) && apres !== avant);
  }
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  " + errors.slice(0, 3).join("\n  "));
} catch (e) {
  check(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
}
console.log(fails ? "CHANGER SMOKE: ÉCHEC" : "CHANGER SMOKE OK");
process.exit(fails ? 1 : 0);
