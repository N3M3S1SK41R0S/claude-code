// SONDE DE CADRAGE : monte un monde en 3D et compare la caméra réelle à la
// cible « vue d'ensemble », l'aspect du canvas, et la projection à l'écran
// des cases extrêmes du plateau — pour objectiver un plateau coupé au bord.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3231;
const MONDE = process.argv[2] || "Le Grand Donjon";
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const corps = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(corps);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.addInitScript(() => {
  window.__DONJON_KEEP3D = true;
  try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: true, voixProposee: true })); } catch { /* privé */ }
});
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
await page.locator(".board-card", { hasText: MONDE }).click();
await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
await page.waitForSelector(".board3d-canvas", { timeout: 30000 });
await page.waitForTimeout(9000);
const sonde = await page.evaluate(() => (window.__DONJON_DBG3D ? window.__DONJON_DBG3D() : null));
const cadre = await page.evaluate(() => {
  const c = document.querySelector(".board3d-canvas");
  const r = c.getBoundingClientRect();
  return { cssW: r.width, cssH: r.height, attrW: c.width, attrH: c.height, left: r.left, top: r.top };
});
console.log("canvas :", JSON.stringify(cadre));
console.log("sonde  :", JSON.stringify(sonde));
await browser.close();
server.close();
