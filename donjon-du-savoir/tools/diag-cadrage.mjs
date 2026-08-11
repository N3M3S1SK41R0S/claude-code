// DIAGNOSTIC du cadrage plein écran : reproduit une partie à plusieurs
// largeurs de fenêtre et MESURE — débordement horizontal, ratio réel des
// cases (ovales ?), minimap et bulle du Héraut dans le champ, conteneur des
// unités cqw. Captures écrites dans le dossier passé en argument.
// Run: node tools/diag-cadrage.mjs [dossier-de-sortie]
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

for (const [w, h] of [[1600, 1000], [1280, 800], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => { window.__DONJON_TEST = true; });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("radio", { name: /Étoiles/ }).click();
  await page.locator(".rounds-input").fill("10");
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();
  await page.waitForTimeout(400);

  const mesures = await page.evaluate(() => {
    const vue = { w: innerWidth, h: innerHeight };
    const doc = document.documentElement;
    const boite = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), droite: Math.round(r.right) };
    };
    const cases = [...document.querySelectorAll(".case")].slice(0, 8).map((c) => {
      const r = c.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    });
    // Le conteneur de requête le plus proche d'une case (pour les unités cqw).
    let conteneur = "AUCUN";
    for (let el = document.querySelector(".case")?.parentElement; el; el = el.parentElement) {
      const ct = getComputedStyle(el).containerType;
      if (ct && ct !== "normal") { conteneur = `${el.className.split(" ")[0]} (${ct})`; break; }
    }
    return {
      vue,
      debordementX: doc.scrollWidth - doc.clientWidth,
      boardMap: boite(".board-map"),
      cadre: boite(".board-scroll") ?? boite("#board"),
      minimap: boite(".minimap"),
      bulle: boite(".herald-bubble"),
      panneau: boite("#panel") ?? boite(".panel"),
      cases,
      conteneurCases: conteneur,
    };
  });
  console.log(`\n=== ${w}×${h} ===`);
  console.log(JSON.stringify(mesures, null, 1));
  await page.screenshot({ path: join(outDir, `cadrage-${w}.png`), fullPage: false });
  await page.close();
}
await browser.close();
