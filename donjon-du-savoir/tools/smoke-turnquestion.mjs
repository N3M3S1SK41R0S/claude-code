// Targeted test: "une question par tour, quelle que soit la case". Drives the
// served PWA in Étoiles mode with the deterministic seam AND __DONJON_TURNQ,
// which forces the guarantee even under __DONJON_TEST. Every single turn must
// surface a real question (case Question/Insolite/Gambit/Trou Noir/défi, OR the
// guaranteed bonus question appended after a coins/joker/boutique/event turn).
// Run: node tools/smoke-turnquestion.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3219;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

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
// __DONJON_TEST rend la navigation déterministe (pas de PNJ/mini-jeu aléatoire),
// __DONJON_TURNQ force la garantie « une question par tour » malgré le test.
await page.addInitScript(() => { window.__DONJON_TEST = true; window.__DONJON_TURNQ = true; });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

// Clique un panneau générique (choix, paris, nombre, continuer…). Renvoie true
// si une action a été effectuée.
async function advancePanels(page) {
  // Réponse à une question à choix.
  if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) {
    await page.locator(".choices .btn-choice:not([disabled])").first().click(); return true;
  }
  // Paris du Gambit.
  const groups = page.locator(".bet-buttons");
  for (let g = 0; g < (await groups.count()); g++) {
    const grp = groups.nth(g);
    if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); return true; }
  }
  // Boutons génériques (défi, marchand, boutique, anecdote…).
  const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder|Personne|J'abandonne|au meneur seul|a écrit/ }).first();
  if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
    if ((await next.textContent()) === "Valider mon nombre") await page.locator(".num-input").fill("50");
    await next.click(); return true;
  }
  return false;
}

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  // Mode Étoiles + partie assez longue pour observer beaucoup de tours.
  await page.locator(".board-card", { hasText: "Étoiles" }).click();
  await page.locator(".rounds-input").fill("12");
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();

  const TURNS = 14;
  let turnsChecked = 0;
  let turnsWithQuestion = 0;
  for (let t = 0; t < TURNS; t++) {
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (!(await roll.isVisible().catch(() => false))) break;
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});

    // Déroule le tour jusqu'au prochain « Lancer le dé » (ou victoire).
    let sawQuestion = false;
    for (let s = 0; s < 60; s++) {
      if ((await page.locator(".question-texte").count()) > 0) sawQuestion = true;
      if (await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false)) break;
      if (await page.locator("#screen-victory:not([hidden])").count()) break;
      if (!(await advancePanels(page))) await page.waitForTimeout(60);
    }
    turnsChecked += 1;
    if (sawQuestion) turnsWithQuestion += 1;
    else console.log(`  ✗ tour ${t + 1} : aucune question posée`);
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
  }

  check("plusieurs tours joués", turnsChecked >= 6);
  check("une question à CHAQUE tour", turnsChecked > 0 && turnsWithQuestion === turnsChecked);
  console.log(`  (${turnsWithQuestion}/${turnsChecked} tours avec question)`);
  check("no page errors", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`no unexpected error (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.error(`\nTURN-QUESTION SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nTURN-QUESTION SMOKE OK");
