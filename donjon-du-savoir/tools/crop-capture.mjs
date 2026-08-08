// Loupe de vérification : découpe une région d'une capture PNG (dist/…) pour
// inspecter un défaut visuel de près. Usage :
//   node tools/crop-capture.mjs dist/monde-x.png x y w h [zoom]
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [, , fichier, x, y, w, h, zoom = "2"] = process.argv;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b64 = readFileSync(join(root, fichier)).toString("base64");
const Z = Number(zoom);
function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: Number(w) * Z, height: Number(h) * Z } });
await page.setContent(`<body style="margin:0"><canvas id="c" width="${Number(w) * Z}" height="${Number(h) * Z}"></canvas>
<script>
  const img = new Image();
  img.onload = () => {
    const c = document.getElementById("c").getContext("2d");
    c.imageSmoothingEnabled = false;
    c.drawImage(img, ${x}, ${y}, ${w}, ${h}, 0, 0, ${Number(w) * Z}, ${Number(h) * Z});
    document.title = "prêt";
  };
  img.src = "data:image/png;base64,${b64}";
</script></body>`);
await page.waitForFunction(() => document.title === "prêt");
await page.screenshot({ path: join(root, "dist", "loupe.png") });
await browser.close();
console.log("dist/loupe.png écrit");
