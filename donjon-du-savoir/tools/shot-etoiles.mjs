// Capture a Mode Étoiles board screenshot from the single-file build.
// Run: node tools/shot-etoiles.mjs [outPath]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
const out = process.argv[2] || join(root, "dist", "shot-etoiles.png");

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
await page.addInitScript(() => { window.__DONJON_TEST = true; });
try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.locator(".board-card", { hasText: "Étoiles" }).click();
  await page.getByText("Normale · 10").click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();
  // Roll once so the HUD shows a live round chip and a moved pion.
  await page.getByRole("button", { name: "🎲 Lancer le dé" }).click();
  await page.getByRole("button", { name: /Avancer de \d/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  console.log("screenshot →", out);
} finally {
  await browser.close();
}
