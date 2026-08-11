// Targeted test: bots. Sets up a game with ONLY bots (2), starts it, and lets
// them play entirely by themselves — no human clicks. Verifies the game reaches
// victory purely via bot autoplay, with no soft-lock and no page errors.
// Run: node tools/smoke-bots.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
const root = join(new URL(".", import.meta.url).pathname, "..");
const PORT = 3301;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname); if (p.endsWith("/")) p += "index.html"; const f = normalize(join(root, p)); if (!f.startsWith(root)) throw 0; const b = await readFile(f); res.writeHead(200, { "Content-Type": MIME[extname(f)] ?? "application/octet-stream" }); res.end(b); } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
function findChromium() { for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) { if (!existsSync(c)) continue; if (statSync(c).isFile()) return c; for (const s of ["chrome-linux/chrome", "chrome"]) { const q = join(c, s); if (existsSync(q) && statSync(q).isFile()) return q; } } throw new Error("no chromium"); }
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
// Bots ultra-rapides pour le test ; __DONJON_TEST calme les rencontres aléatoires.
await page.addInitScript(() => { window.__DONJON_TEST = true; window.__DONJON_BOTFAST = true; });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  // Ajoute 2 bots, retire les 2 joueurs humains par défaut → partie 100 % bots.
  await page.getByRole("button", { name: "🤖 Ajouter un bot" }).click();
  await page.getByRole("button", { name: "🤖 Ajouter un bot" }).click();
  check("deux niveaux de bot présents", (await page.locator("select.bot-level").count()) === 2);
  // Retire les humains (les ✕ des deux premières lignes).
  for (let i = 0; i < 2; i++) { const x = page.getByRole("button", { name: /Retirer le joueur/ }).first(); if (await x.isVisible().catch(() => false)) await x.click(); }
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  // Toast d'ouverture / désignation : le pilote de bot clique tout seul.
  // On NE CLIQUE PLUS RIEN : les bots doivent jouer et finir seuls.
  let won = false;
  for (let t = 0; t < 240; t++) { // ~24 s max
    if (await page.locator("#screen-victory:not([hidden])").count()) { won = true; break; }
    await page.waitForTimeout(100);
  }
  check("les bots jouent et la partie se termine seule", won);
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`pas d'erreur inattendue (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.error(`\nBOTS SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nBOTS SMOKE OK");
