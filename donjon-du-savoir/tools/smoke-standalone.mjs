// Drives the single-file build straight from disk (file://) to prove it plays
// without any server, service worker or external fetch. Run after
// build-standalone.mjs: node tools/smoke-standalone.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");

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
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (name, ok) => { console.log(`${ok ? "✓" : "✗"} ${name}`); if (!ok) failures.push(name); };

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  check("page loads", (await page.title()).includes("Donjon du Savoir"));
  check("bank embedded", /\d+ questions vérifiées/.test(await page.locator("#bank-info").textContent({ timeout: 8000 })));

  // Full mini-game across a few turns, resolving whatever comes.
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  check("board rendered", (await page.locator(".case").count()) >= 28);

  let sawQuestion = false, sawAnecdote = false;
  for (let turn = 0; turn < 16; turn++) {
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (!(await roll.isVisible().catch(() => false))) {
      if (await page.locator("#screen-victory:not([hidden])").count()) break;
    }
    await roll.waitFor({ timeout: 8000 });
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 });
    for (let step = 0; step < 25; step++) {
      if (await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false)) break;
      const abandon = page.getByRole("button", { name: /J'abandonne/ });
      if (await abandon.isVisible().catch(() => false)) { await abandon.click(); continue; }
      const groups = page.locator(".bet-buttons");
      let voted = false;
      for (let g = 0; g < (await groups.count()); g++) {
        const grp = groups.nth(g);
        if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); voted = true; break; }
      }
      if (voted) continue;
      if ((await page.locator(".choices .btn-choice").count()) > 0) {
        sawQuestion = true;
        await page.locator(".choices .btn-choice:not([disabled])").first().click();
        continue;
      }
      if ((await page.locator(".anecdote-card").count()) > 0) sawAnecdote = true;
      const next = page.getByRole("button", { name: /Continuer|Révéler|Valider|Subir|Quitter/ }).first();
      if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
        if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("100");
        await next.click();
        continue;
      }
      if (await page.locator("#screen-victory:not([hidden])").count()) break;
      await page.waitForTimeout(120);
    }
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
    if (sawQuestion && sawAnecdote) break; // seen what we need — stop before the race can end
  }
  check("question flow exercised", sawQuestion);
  check("anecdote displayed", sawAnecdote);

  // Rules screen reachable and populated (fresh reload → clean home screen).
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.getByRole("button", { name: "📖 Les règles" }).click();
  check("rules screen", (await page.locator(".rules-cast-item").count()) === 6);

  // Custom-question screen: add one, confirm it registers.
  await page.getByRole("button", { name: "← Retour" }).click();
  await page.getByRole("button", { name: "✍️ Vos questions maison" }).click();
  await page.locator('input[aria-label="Texte de la question"]').fill("Combien font 2 + 2 ?");
  await page.locator('input[aria-label="Choix 1"]').fill("4");
  await page.locator('input[aria-label="Choix 2"]').fill("5");
  await page.locator('input[aria-label="Choix 3"]').fill("3");
  await page.locator('input[aria-label="Choix 4"]').fill("22");
  await page.getByRole("button", { name: "＋ Ajouter à la banque" }).click();
  check("custom question added", (await page.locator(".custom-item").count()) === 1);

  check("no page errors", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`no unexpected error (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

if (failures.length) { console.error(`\nSTANDALONE SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nSTANDALONE SMOKE OK");
