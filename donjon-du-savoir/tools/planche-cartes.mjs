// PLANCHE DE CONTRÔLE DES CARTES : une image unique avec les 28 pays côte à
// côte. Indispensable après chaque passage de tools/forge-cartes.mjs — une
// carte mal cadrée ou tronquée saute aux yeux ici, jamais dans le code.
// Lancer : node tools/planche-cartes.mjs sortie.png
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { CARTES } = await import(pathToFileURL(join(root, "js", "cartes.js")).href);

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const cases = Object.entries(CARTES).map(([cle, d]) => `
  <figure><svg viewBox="0 0 100 100"><path d="${d}" fill="#f2e9d8" fill-rule="evenodd"/></svg><figcaption>${cle}</figcaption></figure>`).join("");
const html = `<body style="margin:0;background:#1a1520;font-family:sans-serif">
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:8px">${cases}</div>
<style>figure{margin:0;background:#2a2333;border-radius:8px;padding:4px}svg{width:100%;display:block}figcaption{color:#c9bfd8;font-size:11px;text-align:center}</style></body>`;
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html);
const sortie = process.argv[2] ?? join(root, "dist", "planche-cartes.png");
await page.screenshot({ path: sortie, fullPage: true });
await browser.close();
console.log(`✓ ${Object.keys(CARTES).length} cartes → ${sortie}`);
