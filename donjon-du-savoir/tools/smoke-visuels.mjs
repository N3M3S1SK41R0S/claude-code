// SMOKE des questions à SUPPORT VISUEL : le dessin s'affiche vraiment en
// partie, il n'écrase pas l'énoncé, et le dosage tiré tourne bien autour d'une
// question sur quatre — c'est le tirage qui règle la proportion, pas la
// taille du vivier. Run: node tools/smoke-visuels.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
const outDir = process.argv[2] || join(root, "dist");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let fails = 0;
const check = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };

try {
  await page.addInitScript(() => { window.__DONJON_TEST = true; });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 10000 });

  // ① Le dosage : sur un grand nombre de tirages, environ un quart de visuel.
  const mesure = await page.evaluate(() => {
    const pion = { niveau: 2, bracket: "adulte", profil: null };
    let visuelles = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const q = window.__donjonTire ? window.__donjonTire(pion) : null;
      if (q?.visuel) visuelles += 1;
    }
    return { visuelles, total };
  }).catch(() => null);
  if (mesure) {
    const part = mesure.visuelles / mesure.total;
    check(`dosage tiré ≈ 1 sur 4 (${(part * 100).toFixed(0)} %)`, part > 0.15 && part < 0.36);
  } else {
    console.log("  (sonde de tirage absente : dosage non mesuré ici)");
  }

  // ② Les trois familles de visuels se dessinent réellement.
  const rendu = await page.evaluate(() => {
    const sortes = { drapeau: { type: "drapeau", cle: "france" }, ombre: { type: "ombre", cle: "tour-eiffel" }, rebus: { type: "rebus", emojis: "🦁👑" } };
    const res = {};
    for (const [nom, v] of Object.entries(sortes)) {
      const el = window.__donjonVisuel?.(v);
      res[nom] = el ? (el.querySelector("svg") ? "svg" : el.textContent || "vide") : "ABSENT";
    }
    res.inconnu = window.__donjonVisuel?.({ type: "photo", cle: "x" }) === null ? "ignoré proprement" : "PROBLÈME";
    return res;
  });
  check(`drapeau dessiné (${rendu.drapeau})`, rendu.drapeau === "svg");
  check(`ombre chinoise dessinée (${rendu.ombre})`, rendu.ombre === "svg");
  check(`charade en émojis affichée (${rendu.rebus})`, rendu.rebus === "🦁👑");
  check(`un visuel inconnu n'casse rien (${rendu.inconnu})`, rendu.inconnu === "ignoré proprement");

  // ③ En partie réelle : une question visuelle s'affiche AVEC son énoncé.
  // À partir d'ici, TOUTES les questions tirées sont visuelles : on vérifie
  // l'affichage en partie sans dépendre du hasard.
  await page.evaluate(() => { window.__DONJON_TOUT_VISUEL = true; });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  let vue = false;
  let questionsVues = 0;
  const enoncesVus = new Set();
  for (let tour = 0; tour < 90 && !vue; tour++) {
    const nb = await page.locator(".question-texte").count();
    if (nb) { const t = await page.locator(".question-texte").first().textContent(); if (t && !enoncesVus.has(t)) { enoncesVus.add(t); questionsVues += 1; } }
    if (await page.locator(".visuel").count()) {
      vue = true;
      const enonce = await page.locator(".question-texte").first().textContent();
      check(`question visuelle en partie (« ${(enonce ?? "").slice(0, 42)}… »)`, Boolean(enonce));
      await page.waitForTimeout(700); // laisser le fondu d'apparition se terminer
      await page.locator("#panel, .panel").first().screenshot({ path: join(outDir, "visuel-en-partie.png") }).catch(() => {});
      break;
    }
    if (await page.getByText("Le Marchand d'Étoile").count()) {
      await page.getByRole("button", { name: /Garder mon or|Continuer|Acheter/ }).first().click().catch(() => {});
      continue;
    }
    if (await page.getByText("La Boutique du Donjon").count()) {
      await page.getByRole("button", { name: "Quitter la boutique" }).click().catch(() => {});
      continue;
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
      continue;
    }
    const groups = page.locator(".bet-buttons");
    let voted = false;
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click().catch(() => {}); voted = true; break; }
    }
    if (voted) continue;
    if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) { await page.locator(".choices .btn-choice:not([disabled])").first().click().catch(() => {}); continue; }
    if ((await page.locator(".num-input").count()) > 0) { await page.locator(".num-input").first().fill("50").catch(() => {}); }
    const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder|a écrit|Passer|Suivant|Terminer|J'ai|On a|Personne/ }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click().catch(() => {});
      continue;
    }
    const gros = page.locator(".btn-big:not([disabled]), .panel .btn-choice:not([disabled])").first();
    if (await gros.isVisible().catch(() => false)) { await gros.click().catch(() => {}); continue; }
    await page.waitForTimeout(150);
  }
  check(`une question visuelle est apparue en partie (${questionsVues} questions traversées)`, vue);
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  " + errors.slice(0, 3).join("\n  "));
} catch (e) {
  check(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
}
console.log(fails ? "VISUELS SMOKE: ÉCHEC" : "VISUELS SMOKE OK");
process.exit(fails ? 1 : 0);
