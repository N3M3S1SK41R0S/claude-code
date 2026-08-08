// Gomme le CARTON BLANC résiduel d'une figurine : les pixels opaques quasi
// blancs CONNECTÉS au vide extérieur sont rendus transparents (remplissage
// de proche en proche). Les blancs INTÉRIEURS du personnage (jabot, yeux…)
// ne touchent jamais le vide : ils survivent.
//   node tools/detoure-carton.mjs assets/figurines/pnj-capitaine-bigorno.webp
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cible = process.argv[2];
if (!cible) { console.error("Usage : node tools/detoure-carton.mjs <fichier.webp>"); process.exit(2); }
function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage();
await page.setContent("<canvas id='c'></canvas>");
const b64 = readFileSync(join(root, cible)).toString("base64");
const sortie = await page.evaluate(async (data) => {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = "data:image/webp;base64," + data; });
  const W = img.width, H = img.height;
  const c = document.getElementById("c");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, W, H);
  const d = im.data;
  const estBlanc = (i) => d[i + 3] > 60 && d[i] > 222 && d[i + 1] > 222 && d[i + 2] > 222;
  const estVide = (i) => d[i + 3] <= 60;
  // Graines : pixels blancs voisins du vide. Puis propagation dans le blanc.
  const file = [];
  const vu = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      if (!estBlanc(i)) continue;
      const bord = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const voisinVide = bord
        || estVide(((y - 1) * W + x) * 4) || estVide(((y + 1) * W + x) * 4)
        || estVide((y * W + x - 1) * 4) || estVide((y * W + x + 1) * 4);
      if (voisinVide && !vu[p]) { vu[p] = 1; file.push(p); }
    }
  }
  let gommes = 0;
  while (file.length) {
    const p = file.pop();
    const x = p % W, y = (p / W) | 0;
    d[p * 4 + 3] = 0;
    gommes += 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (!vu[np] && estBlanc(np * 4)) { vu[np] = 1; file.push(np); }
    }
  }
  g.putImageData(im, 0, 0);
  return { url: c.toDataURL("image/webp", 0.92), gommes, total: W * H };
}, b64);
await browser.close();
writeFileSync(join(root, cible), Buffer.from(sortie.url.split(",")[1], "base64"));
console.log(`${cible} : ${sortie.gommes} pixel(s) de carton gommés (${Math.round((sortie.gommes / sortie.total) * 100)} % de l'image).`);
