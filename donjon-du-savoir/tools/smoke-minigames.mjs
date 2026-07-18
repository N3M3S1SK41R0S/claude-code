// Deterministic E2E for the word mini-games and the table bonus question,
// forced via test seams (__DONJON_MINIGAME / __DONJON_BONUS) so each panel is
// reached reliably. Runs on the single-file build. Run: node tools/smoke-minigames.mjs
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
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

// Advance the game by one micro-step (roll, vote, answer, continue) — used to
// churn turns until a forced panel appears. Skips the target's own buttons.
async function microStep(page) {
  const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
  if (await roll.isVisible().catch(() => false)) {
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
    return;
  }
  const groups = page.locator(".bet-buttons");
  for (let g = 0; g < (await groups.count()); g++) {
    const grp = groups.nth(g);
    if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); return; }
  }
  if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) {
    await page.locator(".choices .btn-choice:not([disabled])").first().click();
    return;
  }
  const next = page.getByRole("button", { name: /Continuer|Révéler|Valider|Subir|Quitter|Garder/ }).first();
  if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
    if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("50");
    await next.click();
    return;
  }
  await page.waitForTimeout(60);
}

async function newGame(flags) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((f) => { Object.assign(window, f); }, flags);
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();
  return { page, errs };
}

try {
  // ---- Anagramme ----
  {
    const { page, errs } = await newGame({ __DONJON_TEST: true, __DONJON_MINIGAME: "anagram" });
    let seen = false;
    for (let i = 0; i < 160 && !seen; i++) {
      if ((await page.locator(".anagram-letters").count()) > 0) { seen = true; break; }
      await microStep(page);
    }
    check("anagram panel reached", seen);
    if (seen) {
      const letters = (await page.locator(".anagram-letters").textContent()) ?? "";
      check("anagram shows scrambled letters", letters.trim().length >= 4);
      await page.getByRole("button", { name: "Révéler la réponse" }).click();
      await page.getByRole("button", { name: "👍 Trouvé !" }).click();
      check("anagram resolves to anecdote", (await page.locator(".anecdote-card").count()) > 0);
    }
    check("anagram: no page errors", errs.length === 0);
    await page.close();
  }

  // ---- Pendu ----
  {
    const { page, errs } = await newGame({ __DONJON_TEST: true, __DONJON_MINIGAME: "hangman" });
    let seen = false;
    for (let i = 0; i < 160 && !seen; i++) {
      if ((await page.locator(".hangman-word").count()) > 0) { seen = true; break; }
      await microStep(page);
    }
    check("hangman panel reached", seen);
    if (seen) {
      check("hangman shows 26 letter buttons", (await page.locator(".hangman-alpha .btn-choice").count()) === 26);
      await page.locator(".hangman-alpha .btn-choice", { hasText: "E" }).first().click(); // one real guess
      await page.getByRole("button", { name: /J'abandonne/ }).click();
      await page.getByRole("button", { name: "Continuer" }).click();
      check("hangman resolves to anecdote", (await page.locator(".anecdote-card").count()) > 0);
    }
    check("hangman: no page errors", errs.length === 0);
    await page.close();
  }

  // ---- Question bonus de la tablée ----
  {
    const { page, errs } = await newGame({ __DONJON_TEST: true, __DONJON_BONUS: true });
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      if ((await page.getByText("Question bonus de la tablée").count()) > 0) { seen = true; break; }
      await microStep(page);
    }
    check("team bonus panel reached", seen);
    if (seen) {
      await page.getByRole("button", { name: "Révéler la réponse" }).click();
      check("bonus reveals an answer", (await page.locator(".reveal-answer").count()) > 0);
      // Award to the first player, then the next turn must resume.
      await page.locator(".choices .btn-choice").first().click();
      check("bonus hands back to a turn", await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false));
    }
    check("bonus: no page errors", errs.length === 0);
    await page.close();
  }
} catch (err) {
  check(`no unexpected error (${String(err.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
}

if (failures.length) { console.error(`\nMINIGAMES SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nMINIGAMES SMOKE OK");
