// Capture the Pendu (hangman) mini-game panel mid-play. Run: node tools/shot-minigame.mjs [out]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
const out = process.argv[2] || join(root, "dist", "shot-minigame.png");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { Object.assign(window, { __DONJON_TEST: true, __DONJON_MINIGAME: "hangman" }); });
try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();
  // Churn until the hangman panel shows.
  for (let i = 0; i < 160; i++) {
    if ((await page.locator(".hangman-word").count()) > 0) break;
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) { await roll.click(); await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {}); continue; }
    const groups = page.locator(".bet-buttons");
    let voted = false;
    for (let g = 0; g < (await groups.count()); g++) { const grp = groups.nth(g); if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); voted = true; break; } }
    if (voted) continue;
    if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) { await page.locator(".choices .btn-choice:not([disabled])").first().click(); continue; }
    const next = page.getByRole("button", { name: /Continuer|Révéler|Valider|Subir|Quitter|Garder/ }).first();
    if (await next.isVisible().catch(() => false)) { if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("50"); await next.click(); continue; }
    await page.waitForTimeout(60);
  }
  // Reveal a few common letters so the masked word + hits/misses are visible.
  for (const L of ["E", "A", "S", "R", "T", "N", "O"]) {
    const btn = page.locator(".hangman-alpha .btn-choice", { hasText: new RegExp(`^${L}$`) }).first();
    if (await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) await btn.click();
    if ((await page.locator(".hangman-word").count()) === 0) break; // solved
  }
  await page.waitForTimeout(300);
  if ((await page.locator(".hangman-word").count()) > 0) await page.screenshot({ path: out });
  else await page.screenshot({ path: out }); // solved: capture the success/anecdote state instead
  console.log("mini-game screenshot →", out);
} finally {
  await browser.close();
}
