// End-to-end smoke test: serves the folder, plays the start of a 2-player
// game (setup → dice → case resolution) and checks the offline shell.
// Run: node tools/smoke.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3212;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

function findChromium() {
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean);
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome", "chromium"]) {
      const p = join(c, sub);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures.push(name);
};

try {
  // Simule un joueur qui revient : tutoriel déjà vu (sinon l'overlay du 1er
  // lancement bloquerait les clics). N'altère pas le déroulé du jeu.
  await page.addInitScript(() => { try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true })); } catch { /* mode privé */ } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  check("home loads", (await page.title()).includes("Donjon du Savoir"));
  // Boot is async (loadBank → loadWordgames → renderHome); wait for the count
  // to appear rather than reading #bank-info at the "load" event.
  const bankLoaded = await page.locator("#bank-info").filter({ hasText: /\d+ questions vérifiées/ })
    .waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check("bank loaded", bankLoaded);

  const swOk = await page
    .evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((r) => setTimeout(() => r(false), 8000)),
    ]))
    .catch(() => false);
  check("service worker registered", swOk);

  // Setup: 2 default players, straight into the dungeon.
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  check("board rendered", (await page.locator(".case").count()) === 42);
  check("2 pions on board", (await page.locator(".pion").count()) === 2);

  // Play a few turns: roll, advance, resolve whatever comes, continue.
  let sawQuestion = false;
  let sawAnecdote = false;
  for (let turn = 0; turn < 14; turn++) {
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    await roll.waitFor({ timeout: 8000 });
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click();

    // Resolve until the next turn's roll button appears.
    for (let step = 0; step < 25; step++) {
      if (await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false)) break;

      // Mini-jeu Pendu : abandonner tout de suite (le bot ne devine pas de mots).
      const abandon = page.getByRole("button", { name: /J'abandonne/ });
      if (await abandon.isVisible().catch(() => false)) { await abandon.click(); continue; }

      // Bet rows (événement collectif, gambit): one vote per player group.
      const groups = page.locator(".bet-buttons");
      const groupCount = await groups.count();
      let voted = false;
      for (let g = 0; g < groupCount; g++) {
        const grp = groups.nth(g);
        if ((await grp.locator(".bet-selected").count()) > 0) continue;
        await grp.locator("button").first().click();
        voted = true;
        break;
      }
      if (voted) continue;

      if ((await page.locator(".choices .btn-choice").count()) > 0) {
        sawQuestion = true;
        await page.locator(".choices .btn-choice:not([disabled])").first().click();
        continue;
      }
      if ((await page.locator(".anecdote-card").count()) > 0) sawAnecdote = true;
      const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|a écrit/ }).first();
      if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
        if ((await next.textContent()) === "Valider mon nombre") {
          await page.locator(".num-input").fill("42");
        }
        await next.click();
        continue;
      }
      // Victory screen ends the loop early.
      if (await page.locator("#screen-victory:not([hidden])").count()) break;
      await page.waitForTimeout(150);
    }
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
    // Stop as soon as a QCM and its anecdote have been exercised: playing
    // further only risks finishing the race, which would leave no in-progress
    // save for the resume check below (the two goals conflict otherwise).
    if (sawQuestion && sawAnecdote) break;
  }
  check("question flow exercised", sawQuestion);
  check("anecdote displayed", sawAnecdote);

  // Save + resume path. Boot is async (loads the bank + word-games before
  // rendering the home menu), so wait for the button rather than sampling once.
  await page.reload({ waitUntil: "load" });
  const resume = page.getByRole("button", { name: "▶️ Reprendre la partie en cours" });
  const resumeShown = await resume.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  check("save offers resume", resumeShown);

  // Offline: the service worker must serve the shell.
  await page.waitForTimeout(800);
  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });
  check("offline shell served", (await page.title()).includes("Donjon du Savoir"));
  await context.setOffline(false);
} catch (err) {
  check(`no unexpected error (${err.message?.split("\n")[0]})`, false);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`\nSMOKE FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nSMOKE OK");
