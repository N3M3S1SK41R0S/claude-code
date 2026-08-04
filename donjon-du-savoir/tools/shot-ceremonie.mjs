// Vérifie la CÉRÉMONIE des étoiles bonus de bout en bout via la sonde
// window.__donjonCeremonie : roue → tambour → révélation (stats face aux
// adversaires) → « Passer » → tableau final. Captures + zéro erreur de page.
// Run: node tools/shot-ceremonie.mjs [dossier-de-sortie]
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
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? "✓" : "✗"} ${name}`); if (!ok) fails++; };
try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  // Profil vierge : le tutoriel de premier lancement recouvre tout — on le ferme.
  const passeTuto = page.getByRole("button", { name: "Passer le tutoriel" });
  if (await passeTuto.isVisible().catch(() => false)) await passeTuto.click();
  await page.evaluate(() => window.__donjonCeremonie());
  await page.locator(".ceremonie-roue").waitFor({ timeout: 4000 });
  check("roue de tirage affichée", true);
  await page.screenshot({ path: join(outDir, "ceremonie-roue.png") });
  await page.locator(".ceremonie-tambour").first().waitFor({ timeout: 8000 });
  check("roulement de tambour affiché", true);
  await page.locator(".ceremonie-laureat").waitFor({ timeout: 8000 });
  check("lauréat révélé", true);
  const statLignes = await page.locator(".ceremonie-stat-ligne").count();
  check(`stats des adversaires affichées (${statLignes})`, statLignes === 3);
  const gagnant = await page.locator(".ceremonie-stat-gagnant").textContent();
  check(`lauréat surligné (${gagnant?.trim()})`, /Cléo/.test(gagnant ?? ""));
  await page.screenshot({ path: join(outDir, "ceremonie-revelation.png") });
  await page.getByRole("button", { name: "⏩ Passer la cérémonie" }).click();
  await page.locator(".victory-list").waitFor({ timeout: 4000 });
  check("tableau final après « Passer »", true);
  check(`3 lignes d'étoiles bonus au tableau (${await page.locator(".bonus-star-line").count()})`, (await page.locator(".bonus-star-line").count()) === 3);
  await page.screenshot({ path: join(outDir, "ceremonie-final.png") });
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
} finally {
  await browser.close();
}
process.exit(fails ? 1 : 0);
