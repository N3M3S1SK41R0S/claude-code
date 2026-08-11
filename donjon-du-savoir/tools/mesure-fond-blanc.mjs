// Mesure du CARTON BLANC résiduel dans les figurines : part des pixels
// OPAQUES quasi blancs (le détourage extérieur peut être bon alors qu'un
// carton blanc arrondi reste collé derrière le personnage — défaut du
// capitaine Bigorno vu en capture).
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const dossier = join(root, "assets", "figurines");
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".webp"));
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage();
await page.setContent("<canvas id='c'></canvas>");
const lignes = [];
for (const f of fichiers) {
  const b64 = readFileSync(join(dossier, f)).toString("base64");
  const res = await page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = "data:image/webp;base64," + data; });
    const c = document.getElementById("c");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let opaques = 0, blancs = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 200) {
        opaques += 1;
        if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) blancs += 1;
      }
    }
    return { partOpaque: opaques / (d.length / 4), partBlanche: opaques ? blancs / opaques : 0 };
  }, b64);
  lignes.push({ f, ...res });
}
await browser.close();
lignes.sort((a, b) => b.partBlanche - a.partBlanche);
for (const l of lignes.slice(0, 12)) {
  console.log(`${l.f.padEnd(36)} opaque ${Math.round(l.partOpaque * 100)} %  dont blanc ${Math.round(l.partBlanche * 100)} %`);
}
