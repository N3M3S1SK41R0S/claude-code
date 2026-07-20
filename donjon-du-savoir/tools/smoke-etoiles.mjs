// Star mode (Mario-Party) end-to-end on the single-file build: pick Étoiles +
// short game, play every turn to the end, buy the star when offered, and check
// the star-mode victory screen. Run: node tools/smoke-etoiles.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// Test seam: gonfle l'or de départ pour couvrir l'achat d'étoile de façon
// déterministe (le flag n'existe jamais en jeu réel).
await page.addInitScript(() => { window.__DONJON_TEST = true; });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();

  // Pick star mode + a short game via the rounds input (5-200).
  await page.locator(".board-card", { hasText: "Étoiles" }).click();
  const roundsInput = page.locator(".rounds-input");
  check("rounds selector appears", await roundsInput.isVisible());
  await roundsInput.fill("6");
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();

  check("star marker on board", (await page.locator(".star-marker").count()) === 1);
  check("round chip shows", (await page.getByText(/Manche \d+\/6/).count()) >= 1);

  let boughtStar = false;
  let sawSceptre = false;
  let guard = 0;
  while (guard++ < 200) {
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
    // Star merchant?
    if (await page.getByText("Le Marchand d'Étoile").count()) {
      const buy = page.getByRole("button", { name: /Acheter l'étoile/ });
      if (await buy.isVisible().catch(() => false)) { await buy.click(); boughtStar = true; }
      else await page.getByRole("button", { name: /Garder mon or|Continuer/ }).first().click();
      continue;
    }
    // Boutique : acheter un Tuyau d'Or dès qu'on peut (déterministe : il mène à l'étoile).
    if (await page.getByText("La Boutique du Donjon").count()) {
      // Le Sceptre du Larcin (vol d'étoile) n'est proposé qu'en mode Étoiles.
      if (await page.locator(".panel .btn-choice", { hasText: "Sceptre du Larcin" }).count()) sawSceptre = true;
      const tuyau = page.locator(".panel .btn-choice", { hasText: "Tuyau d'Or" });
      if ((await tuyau.count()) && await tuyau.first().isEnabled().catch(() => false)) await tuyau.first().click();
      await page.getByRole("button", { name: "Quitter la boutique" }).click();
      continue;
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      // Si on a un Tuyau d'Or en besace, l'utiliser pour foncer sur l'étoile.
      const bag = page.getByRole("button", { name: /🎒 Ma besace/ });
      if (await bag.isVisible().catch(() => false)) {
        await bag.click();
        const tuyauItem = page.locator(".panel .btn-choice", { hasText: "Tuyau d'Or" });
        if (await tuyauItem.count()) { await tuyauItem.first().click(); continue; }
        await page.getByRole("button", { name: "↩︎ Refermer" }).click();
      }
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
      continue;
    }
    // Bet rows.
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

  check("game reached victory", (await page.locator("#screen-victory:not([hidden])").count()) === 1);
  check("victory shows stars", (await page.locator(".victory-meta", { hasText: "⭐" }).count()) >= 1);
  check("star was purchasable & bought at least once", boughtStar);
  check("sceptre du larcin offered in star-mode shop", sawSceptre);
  check("3 end-game bonus stars awarded", (await page.locator(".bonus-star-line").count()) === 3);
  check("no page errors", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`no unexpected error (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

if (failures.length) { console.error(`\nÉTOILES SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nÉTOILES SMOKE OK");
