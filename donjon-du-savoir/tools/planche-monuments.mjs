// PLANCHE DE CONTRÔLE DES MONUMENTS ILLUSTRÉS : les aquarelles telles qu'elles
// apparaissent EN JEU (mêmes cadre, ombre et taille), côte à côte. C'est le
// seul moyen de juger ce qui compte vraiment : reconnaît-on le monument à la
// taille réelle d'affichage, sur le fond violet du panneau ?
// Lancer : node tools/planche-monuments.mjs [sortie.png]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "donjon-standalone.html");
function findChromium(){ for (const c of ["/opt/pw-browsers/chromium"]) { if (statSync(c).isFile()) return c; for (const s of ["chrome-linux/chrome","chrome"]) { const p=join(c,s); if (existsSync(p)) return p; } } }
const browser = await chromium.launch({ executablePath: findChromium(), args:["--no-proxy-server"] });
const ctx = await browser.newContext({ viewport:{width:1100,height:1400}, deviceScaleFactor:2 });
const page = await ctx.newPage();
await page.addInitScript(()=>{ window.__DONJON_TEST = true; });
await page.goto(pathToFileURL(file).href, { waitUntil:"load" });
await page.locator("#bank-info").textContent({ timeout: 10000 });
await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
await page.waitForTimeout(600);
const cles = await page.evaluate(() => window.__donjonVisuelsConnus().monument);
await page.evaluate((cles) => {
  const p = document.getElementById("panel") || document.querySelector(".panel");
  p.innerHTML = "";
  const grille = document.createElement("div");
  grille.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px";
  for (const c of cles) {
    const el = window.__donjonVisuel({ type: "monument", cle: c });
    el.style.margin = "0";
    const img = el.querySelector("img"); if (img) img.style.width = "100%";
    const box = document.createElement("div");
    const lab = document.createElement("div");
    lab.textContent = c; lab.style.cssText = "font-size:11px;text-align:center;opacity:.75";
    box.append(el, lab); grille.append(box);
  }
  p.append(grille);
}, cles);
await page.waitForTimeout(1200);
const sortie = process.argv[2] ?? "/home/user/claude-code/donjon-du-savoir/dist/planche-monuments.png";
await page.locator("#panel, .panel").first().screenshot({ path: sortie });
await browser.close();
console.log(`✓ ${cles.length} aquarelles → ${sortie}`);
