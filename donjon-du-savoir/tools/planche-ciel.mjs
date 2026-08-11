// PLANCHE DE CONTRÔLE DU CIEL : les constellations côte à côte, en grand. On
// doit reconnaître la casserole de la Grande Ourse et le sablier d'Orion —
// sinon la projection est fausse et la question serait injouable.
// Lancer : node tools/planche-ciel.mjs [sortie.png]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { cielSvg, CIELS } = await import(pathToFileURL(join(root, "js", "constellations.js")).href);

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const cases = CIELS.map((cle) => `<figure style="color:#f4ecd8">${cielSvg(cle)}<figcaption>${cle}</figcaption></figure>`).join("");
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(`<body style="margin:0;background:#0d0a18;font-family:sans-serif">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px">${cases}</div>
<style>figure{margin:0;background:#161029;border-radius:10px;padding:6px}svg{width:100%;display:block}figcaption{color:#c9bfd8;font-size:13px;text-align:center}</style></body>`);
const sortie = process.argv[2] ?? join(root, "dist", "planche-ciel.png");
await page.screenshot({ path: sortie, fullPage: true });
await browser.close();
console.log(`✓ ${CIELS.length} constellations → ${sortie}`);
