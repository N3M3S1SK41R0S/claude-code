// Test ciblé : bots EN MODE ÉQUIPES. Configure une partie « par équipes » avec
// uniquement deux équipes de bots (les équipes humaines par défaut sont retirées)
// et vérifie que la partie se joue et se termine seule — sans blocage ni erreur.
// Couvre le fait que le pilote de bot fonctionne sur un pion-équipe (membres null,
// porte-parole absent, format de question forcé en choix).
// Run: node tools/smoke-team-bots.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
const root = join(new URL(".", import.meta.url).pathname, "..");
const PORT = 3302;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname); if (p.endsWith("/")) p += "index.html"; const f = normalize(join(root, p)); if (!f.startsWith(root)) throw 0; const b = await readFile(f); res.writeHead(200, { "Content-Type": MIME[extname(f)] ?? "application/octet-stream" }); res.end(b); } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
function findChromium() { for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) { if (!existsSync(c)) continue; if (statSync(c).isFile()) return c; for (const s of ["chrome-linux/chrome", "chrome"]) { const q = join(c, s); if (existsSync(q) && statSync(q).isFile()) return q; } } throw new Error("no chromium"); }
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.addInitScript(() => { window.__DONJON_TEST = true; window.__DONJON_BOTFAST = true; });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("radio", { name: "🤝 Par équipes" }).click();
  // Ajoute 2 équipes de bots (on a alors 2 humaines + 2 bots).
  await page.getByRole("button", { name: "🤖 Ajouter une équipe de bots" }).click();
  await page.getByRole("button", { name: "🤖 Ajouter une équipe de bots" }).click();
  check("deux équipes de bots avec niveau", (await page.locator("select.bot-level").count()) === 2);
  // Retire les 2 équipes humaines (aria-label EXACT « Retirer l'équipe »).
  for (let i = 0; i < 2; i++) { const x = page.getByRole("button", { name: "Retirer l'équipe", exact: true }).first(); if (await x.isVisible().catch(() => false)) await x.click(); }
  check("il ne reste que des équipes de bots", (await page.locator("select.bot-level").count()) === 2 && (await page.locator(".setup-row-membre").count()) === 0);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  // Les équipes de bots doivent jouer et finir seules — aucun clic humain.
  let won = false;
  for (let t = 0; t < 300; t++) {
    if (await page.locator("#screen-victory:not([hidden])").count()) { won = true; break; }
    await page.waitForTimeout(100);
  }
  check("les équipes de bots jouent et la partie se termine seule", won);
  // Le tableau de stats doit lister les deux équipes.
  if (won) {
    const rows = await page.locator(".stats-table tbody tr").count();
    check("le tableau de stats liste les deux équipes", rows === 2);
  }
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`pas d'erreur inattendue (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.error(`\nTEAM-BOTS SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nTEAM-BOTS SMOKE OK");
