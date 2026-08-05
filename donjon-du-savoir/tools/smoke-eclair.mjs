// Smoke ⚡ Partie Éclair : accueil → réglage du sprint → 3 questions jouées
// (verdict + anecdote à chaque fois) → fin anticipée → podium. Zéro erreur de
// page exigée. Lancer : node tools/smoke-eclair.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3221;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://x`).pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const corps = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(corps);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // gabarit téléphone
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: false, voixProposee: true })); } catch { /* privé */ } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });

const check = (ok, label) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) process.exitCode = 1; };

await page.getByRole("button", { name: /Partie Éclair/ }).click();
await page.waitForSelector(".eclair-setup", { timeout: 8000 });
check(true, "écran de réglage du sprint");
await page.locator(".eclair-setup .btn-small", { hasText: "Ajouter" }).click(); // 2 joueurs : pass-and-play
await page.getByRole("button", { name: "⚡ C'est parti !" }).click();
await page.waitForSelector(".eclair-carte", { timeout: 8000 });
check(true, "première question affichée");

// Une question à support visuel doit montrer son image ICI AUSSI : sans elle,
// « quel pays reconnaissez-vous à sa carte ? » n'a aucune réponse possible.
// On force TOUS les tirages en visuel, puis on relance un sprint : ce que l'on
// contrôle est bien le rendu réel du mode Éclair, pas une sonde de laboratoire.
await page.evaluate(() => { window.__DONJON_TOUT_VISUEL = true; });
await page.getByRole("button", { name: "🏁 Terminer ici" }).click();
await page.waitForSelector(".eclair-podium", { timeout: 8000 });
await page.getByRole("button", { name: /Revanche|Rejouer|Nouveau sprint/ }).first().click();
await page.waitForSelector(".eclair-carte", { timeout: 8000 });
const visuelEclair = (await page.locator(".eclair-carte .visuel svg, .eclair-carte .visuel-rebus").count()) > 0;
const enonce = await page.locator(".eclair-texte").innerText().catch(() => "");
check(visuelEclair, `le visuel s'affiche en Partie Éclair (« ${enonce.slice(0, 40)}… »)`);
if (process.env.SHOT_SETUP) await page.screenshot({ path: process.env.SHOT_SETUP, fullPage: false });

for (let i = 0; i < 3; i++) {
  await page.locator(".eclair-choix").first().click();
  await page.waitForSelector(".eclair-verdict", { timeout: 8000 });
  const anecdote = await page.locator(".eclair-v-anecdote").innerText();
  check(anecdote.length > 10, `verdict + anecdote (question ${i + 1})`);
  if (i === 0 && process.env.SHOT_VERDICT) await page.screenshot({ path: process.env.SHOT_VERDICT, fullPage: false });
  await page.getByRole("button", { name: /Question suivante|Voir le résultat/ }).click();
  await page.waitForSelector(".eclair-carte, .eclair-podium", { timeout: 8000 });
}
if (await page.locator(".eclair-carte").isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "🏁 Terminer ici" }).click();
}
await page.waitForSelector(".eclair-podium", { timeout: 8000 });
const podium = await page.locator(".eclair-podium-row").count();
check(podium === 2, `podium à 2 joueurs (${podium})`);
if (process.env.SHOT_PODIUM) await page.screenshot({ path: process.env.SHOT_PODIUM, fullPage: false });
await page.getByRole("button", { name: "⚡ Revanche !" }).click();
await page.waitForSelector(".eclair-carte", { timeout: 8000 });
check(true, "revanche relancée");
check(erreurs.length === 0, erreurs.length ? `erreurs: ${erreurs[0]}` : "aucune erreur de page");

await browser.close();
server.close();
console.log(process.exitCode ? "\nÉCLAIR SMOKE FAILED" : "\nÉCLAIR SMOKE OK");
