// BALAYAGE DES 10 MONDES en 3D (SwiftShader) : chaque plateau est monté,
// la scène doit se construire SANS erreur de page ni repli 2D. Une capture
// par monde est écrite dans le dossier passé en argument (vérif visuelle).
// Run: node tools/verif-mondes-3d.mjs [dossier-de-sortie]
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || join(root, "dist");
const PORT = 3229;
const MONDES = [
  "La Crypte d'Initiation", "Le Grand Donjon", "La Tour du Vertige",
  "Les Catacombes du Chaos", "Le Labyrinthe Doré", "La Cuisine Géante",
  "La Plage des Pirates", "Le Grenier Hanté", "La Fête Foraine", "La Banquise Rigolote",
];
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
let fails = 0;
for (const monde of MONDES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__DONJON_KEEP3D = true;
    try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: true, voixProposee: true })); } catch { /* privé */ }
  });
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
    await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
    await page.locator(".board-card", { hasText: monde }).click();
    await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
    const canvas = await page.waitForSelector(".board3d-canvas", { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(9000); // SwiftShader : la scène se peint lentement
    const nom = monde.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase().slice(0, 14);
    await page.screenshot({ path: join(outDir, `monde-${nom}.png`) });
    const ok = Boolean(canvas) && errors.length === 0;
    console.log(`${ok ? "✓" : "✗"} ${monde}${canvas ? "" : " (PAS de canvas 3D)"}${errors.length ? ` — ${errors[0].slice(0, 90)}` : ""}`);
    if (!ok) fails++;
  } catch (e) {
    console.log(`✗ ${monde} — ${String(e.message).split("\n")[0]}`);
    fails++;
  }
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `MONDES 3D : ${fails} ÉCHEC(S)` : "MONDES 3D : 10/10 OK");
process.exit(fails ? 1 : 0);
