// Play a short Étoiles game to the end and screenshot the victory screen,
// which now shows the 3 end-game bonus stars. Run: node tools/shot-victory.mjs [out]
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
const out = process.argv[2] || join(root, "dist", "shot-victory.png");

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
  await page.getByText("Courte · 6 manches").click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();

  let guard = 0;
  while (guard++ < 240) {
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
    if (await page.getByText("Le Marchand d'Étoile").count()) {
      const buy = page.getByRole("button", { name: /Acheter l'étoile/ });
      if (await buy.isVisible().catch(() => false)) await buy.click();
      else await page.getByRole("button", { name: /Garder mon or|Continuer/ }).first().click();
      continue;
    }
    if (await page.getByText("La Boutique du Donjon").count()) {
      await page.getByRole("button", { name: "Quitter la boutique" }).click();
      continue;
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
      continue;
    }
    const groups = page.locator(".bet-buttons");
    let voted = false;
    for (let g = 0; g < (await groups.count()); g++) { const grp = groups.nth(g); if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); voted = true; break; } }
    if (voted) continue;
    if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) { await page.locator(".choices .btn-choice:not([disabled])").first().click(); continue; }
    const next = page.getByRole("button", { name: /Continuer|Révéler|Valider|Subir|Quitter|Garder/ }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("50");
      await next.click();
      continue;
    }
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, fullPage: true });
  console.log("victory screenshot →", out, "bonus lines:", await page.locator(".bonus-star-line").count());
} finally {
  await browser.close();
}
