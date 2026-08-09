// CAPTURES DE L'INTERFACE : chaque écran-clé du jeu est photographié dans
// dist/ecran-*.png pour la revue visuelle (accueil, réglages, question,
// aide, Partie Éclair). Complément de verif-mondes-3d (qui couvre les
// plateaux) — ici on audite les écrans 2D.
// Run: node tools/capture-interface.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || join(root, "dist");
const PORT = 3232;
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
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => {
  window.__DONJON_KEEP3D = true;
  try {
    localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: true, voixProposee: true }));
    localStorage.setItem("donjon-cam", "ensemble");
  } catch { /* privé */ }
});
const shot = async (nom) => { await page.screenshot({ path: join(outDir, `ecran-${nom}.png`) }); console.log(`✓ ecran-${nom}.png`); };

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.locator("#bank-info").filter({ hasText: /questions vérifiées/ }).waitFor({ timeout: 15000 }).catch(() => {});
await shot("accueil");

// Réglages de partie (choix du monde, joueurs…)
await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
await page.waitForTimeout(400);
await shot("reglages");

// En partie : toast puis tour de jeu (dé) puis une question avec choix.
await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
await page.waitForTimeout(2500);
await shot("tour-de-jeu");
for (let i = 0; i < 30; i++) {
  const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
  if (await roll.isVisible().catch(() => false)) {
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click().catch(() => {});
  }
  await page.waitForTimeout(700);
  if ((await page.locator(".choices .btn-choice").count()) > 0) break;
  const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter/ }).first();
  if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
}
await page.waitForTimeout(600);
await shot("question");

// L'aide en partie.
const aide = page.getByRole("button", { name: /Aide/ }).first();
if (await aide.isVisible().catch(() => false)) {
  await aide.click();
  await page.waitForTimeout(500);
  await shot("aide");
  await page.keyboard.press("Escape").catch(() => {});
}

// Partie Éclair : accueil du mode + une question.
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.getByRole("button", { name: "⚡ Partie Éclair — sans plateau" }).click();
await page.waitForTimeout(500);
await shot("eclair-reglages");
const go = page.getByRole("button", { name: /C'est parti|Lancer|Démarrer|GO/ }).first();
if (await go.isVisible().catch(() => false)) {
  await go.click();
  await page.waitForTimeout(1800);
  await shot("eclair-question");
} else {
  console.log("⚠️ bouton de lancement Éclair introuvable");
}

// Mode Étoiles : la carte « Étoiles » des réglages, puis le plateau avec
// l'étoile dorée tournante (vue d'ensemble).
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
const carteEtoiles = page.locator(".board-card", { hasText: "Étoiles" }).first();
if (await carteEtoiles.isVisible().catch(() => false)) {
  await carteEtoiles.click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  await page.waitForTimeout(9000); // SwiftShader : laisser la scène se peindre
  await shot("etoiles-plateau");
} else {
  console.log("⚠️ carte Étoiles introuvable");
}

console.log(errors.length ? `⚠️ ${errors.length} erreur(s) de page — ${errors[0].slice(0, 120)}` : "✓ aucune erreur de page");
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
