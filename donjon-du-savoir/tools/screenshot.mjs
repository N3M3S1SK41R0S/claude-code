// Captures a screenshot of a running 4-player game (board view).
// Run: node tools/screenshot.mjs [output.png]
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? join(root, "..", "board-preview.png");
const PORT = 3213;

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(PORT, r));

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) {
      const p = join(c, sub);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
// 4 players for a lively board.
await page.getByRole("button", { name: "＋ Ajouter un joueur" }).click();
await page.getByRole("button", { name: "＋ Ajouter un joueur" }).click();
// Optional: pick a specific dungeon (env SELECT_BOARD = visible board name).
if (process.env.SELECT_BOARD) {
  await page.locator(".board-card", { hasText: process.env.SELECT_BOARD }).click();
}
await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
await page.waitForSelector(".case");
// A couple of turns so tokens spread out.
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: "🎲 Lancer le dé" }).click();
  await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
  for (let s = 0; s < 10; s++) {
    if (await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false)) break;
    const choice = page.locator(".choices .btn-choice:not([disabled])").first();
    if (await choice.isVisible().catch(() => false)) { await choice.click(); continue; }
    const groups = page.locator(".bet-buttons");
    let voted = false;
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); voted = true; break; }
    }
    if (voted) continue;
    const next = page.getByRole("button", { name: /Continuer|Révéler|Valider|Subir/ }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("100");
      await next.click();
      continue;
    }
    await page.waitForTimeout(150);
  }
}
await page.waitForTimeout(400);
await page.locator(".board-scroll").screenshot({ path: out });
console.log(`✓ ${out}`);
await browser.close();
server.close();
