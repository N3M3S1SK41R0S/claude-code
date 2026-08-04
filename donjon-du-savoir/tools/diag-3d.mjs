// DIAGNOSTIC 3D (SwiftShader) : démarre une partie en 3D forcée, MESURE le
// cadrage plein écran (canvas, minimap, bulle, débordement) à plusieurs
// largeurs, et capture la scène (caméra héros) pour vérifier perspective,
// collisions et fond. Run: node tools/diag-3d.mjs [dossier-de-sortie]
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || join(root, "dist");
const PORT = 3227;
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

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--no-proxy-server", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const [w, h, shot] of [[1600, 950, true], [2560, 1080, false], [1280, 800, false]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    window.__DONJON_KEEP3D = true; // jamais de repli pendant le diagnostic
    try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: true, voixProposee: true })); } catch { /* privé */ }
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  const canvas = await page.waitForSelector(".board3d-canvas", { timeout: 30000 }).catch(() => null);
  if (!canvas) { console.log(`${w}px : PAS de canvas 3D`); await page.close(); continue; }
  await page.waitForTimeout(1200);
  const mesures = await page.evaluate(() => {
    const doc = document.documentElement;
    const boite = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), droite: Math.round(r.right), bas: Math.round(r.bottom) };
    };
    return {
      vue: innerWidth,
      debordementX: doc.scrollWidth - doc.clientWidth,
      canvas: boite(".board3d-canvas"),
      minimap: boite(".minimap"),
      bulle: boite(".herald-bubble"),
      panneau: boite("#panel") ?? boite(".panel"),
      entete: boite("header") ?? boite(".topbar"),
    };
  });
  console.log(`\n=== ${w}×${h} ===\n` + JSON.stringify(mesures));
  if (shot) {
    await page.waitForTimeout(22000); // SwiftShader peint lentement
    await page.screenshot({ path: join(outDir, `diag3d-${w}.png`) });
    console.log(`capture → diag3d-${w}.png`);
  }
  await page.close();
}
await browser.close();
server.close();
