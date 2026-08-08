// Contrôle du DÉTOURAGE des figurines : une image de PNJ dont les bords sont
// OPAQUES ET CLAIRS n'a pas été détourée (fond blanc du studio resté collé) —
// elle s'affiche en rectangle blanc sur le plateau (défaut vu en capture :
// le capitaine Bigorno). On échantillonne le cadre extérieur de chaque WebP.
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
let mauvais = 0;
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
    // Cadre extérieur : combien de pixels du bord sont opaques ET clairs ?
    let bord = 0, opaquesClairs = 0;
    const teste = (x, y) => {
      const i = (y * img.width + x) * 4;
      bord += 1;
      if (d[i + 3] > 200 && d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) opaquesClairs += 1;
    };
    for (let x = 0; x < img.width; x += 2) { teste(x, 0); teste(x, img.height - 1); }
    for (let y = 0; y < img.height; y += 2) { teste(0, y); teste(img.width - 1, y); }
    return { largeur: img.width, hauteur: img.height, part: opaquesClairs / bord };
  }, b64);
  const ko = res.part > 0.5;
  if (ko) { mauvais += 1; console.log(`✗ ${f} — ${Math.round(res.part * 100)} % du bord opaque et blanc (fond non détouré)`); }
}
await browser.close();
console.log(mauvais ? `${mauvais} figurine(s) à détourer.` : "Toutes les figurines sont détourées (bords transparents).");
process.exit(mauvais ? 1 : 0);
