// Targeted test: collectif « à deux difficultés ». With a toddler (2–5) AND an
// adult (18+) at the table, the between-turns team bonus must offer TWO levels —
// « Version enfants » then « Version adultes » — so each shines at their own.
// __DONJON_BONUS forces the team bonus every turn. Run: node tools/smoke-collective.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3221;
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
await page.addInitScript(() => { window.__DONJON_TEST = true; window.__DONJON_BONUS = true; });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failures = [];
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) failures.push(n); };

async function advancePanels(page) {
  // Révélation du collectif : les noms des joueurs sont aussi des .btn-choice ;
  // pour AVANCER il faut valider — on passe donc « Personne n'a trouvé ».
  const rien = page.getByRole("button", { name: "Personne n'a trouvé" });
  if (await rien.isVisible().catch(() => false)) { await rien.click(); return true; }
  if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) {
    await page.locator(".choices .btn-choice:not([disabled])").first().click(); return true;
  }
  const groups = page.locator(".bet-buttons");
  for (let g = 0; g < (await groups.count()); g++) {
    const grp = groups.nth(g);
    if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click(); return true; }
  }
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

  // Deux joueurs d'âges très éloignés : un tout-petit (2–5) et un adulte (18+).
  const selects = page.locator("select.age-select");
  await selects.nth(0).selectOption("2-5");
  await selects.nth(1).selectOption("18+");
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();

  let sawEnfant = false, sawAdulte = false;
  for (let t = 0; t < 8 && !(sawEnfant && sawAdulte); t++) {
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (!(await roll.isVisible().catch(() => false))) break;
    await roll.click();
    await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
    for (let s = 0; s < 70; s++) {
      if (await page.getByText("Version enfants").count()) sawEnfant = true;
      if (await page.getByText("Version adultes").count()) sawAdulte = true;
      if (sawEnfant && sawAdulte) break;
      if (await page.getByRole("button", { name: "🎲 Lancer le dé" }).isVisible().catch(() => false)) break;
      if (await page.locator("#screen-victory:not([hidden])").count()) break;
      if (!(await advancePanels(page))) await page.waitForTimeout(60);
    }
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
  }

  check("collectif « Version enfants » proposé", sawEnfant);
  check("collectif « Version adultes » proposé", sawAdulte);
  check("no page errors", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 3).join(" | "));
} catch (err) {
  check(`no unexpected error (${String(err.message).split("\n")[0]})`, false);
  if (errors.length) console.log("  page errors:", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.error(`\nCOLLECTIVE SMOKE FAILED: ${failures.join(", ")}`); process.exit(1); }
console.log("\nCOLLECTIVE SMOKE OK");
