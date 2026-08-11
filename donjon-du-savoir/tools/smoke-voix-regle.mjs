// AUDIT DE LA RÈGLE DES VOIX — la règle de la maison : quand la voix du
// Héraut (ElevenLabs) est armée, AUCUNE réplique du jeu ne doit sortir par la
// synthèse du navigateur. Questions, propositions, anecdotes, verdicts,
// annonces, mini-jeux : tout passe par un clip enregistré ou par la voix
// directe. La synthèse n'est qu'un filet de PANNE — si elle parle alors que
// tout va bien, une réplique a échappé à la règle.
//
// La vérification est MESURÉE, pas déclarée : on joue une vraie partie avec
// l'API ElevenLabs simulée en local (aucun octet ne sort de la machine), en
// espionnant les trois canaux de sortie — synthèse, clips, voix directe.
// Verdict : zéro utterance de synthèse pendant toute la traversée.
// Lancer : node tools/smoke-voix-regle.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, readFile as rf } from "node:fs/promises";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3229;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
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
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

// Un MP3 de silence suffit : on audite QUI parle, pas ce qui se dit.
const MP3_SILENCE = readFileSync(join(root, "voix", "heraut", Object.values(JSON.parse(readFileSync(join(root, "data", "voix-manifest.json"), "utf8")).heraut)[0].split("/").pop()));

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let fails = 0;
const check = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };

// Voix armée + espions AVANT le chargement du jeu : pas un mot ne nous échappe.
await page.addInitScript(() => {
  window.__DONJON_TEST = true;
  localStorage.setItem("donjon-voice", "1");
  localStorage.setItem("donjon-elevenlabs-cle", "cle-de-test-fictive");
  localStorage.setItem("donjon-elevenlabs-voix", "vx-heraut|Donjon-Heraut");
  localStorage.setItem("donjon-voixdirect", "1");
  window.__AUDIT = { synthese: [], clips: 0, directs: 0 };
  // ① la synthèse du navigateur — le canal qui doit rester MUET
  const speakOrig = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = (utt) => {
    if (utt?.text?.trim()) window.__AUDIT.synthese.push(utt.text.slice(0, 160));
    return speakOrig(utt);
  };
  // ② les pistes audio — clips embarqués (voix/…mp3) vs voix directe (blob:)
  const playOrig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    const src = String(this.currentSrc || this.src || "");
    if (src.startsWith("blob:")) window.__AUDIT.directs += 1;
    else if (src.includes("voix/") || src.startsWith("data:audio")) window.__AUDIT.clips += 1;
    return playOrig.apply(this, a);
  };
});

// L'API ElevenLabs, simulée en local : chaque texte demandé est journalisé.
const apiTexts = [];
await page.route("https://api.elevenlabs.io/**", async (route) => {
  const req = route.request();
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (req.url().includes("/v1/voices")) {
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ voices: [{ voice_id: "vx-heraut", name: "Donjon-Heraut" }] }) });
  }
  if (req.url().includes("/v1/text-to-speech/")) {
    try { apiTexts.push(JSON.parse(req.postData() ?? "{}").text ?? ""); } catch { apiTexts.push("?"); }
    return route.fulfill({ status: 200, headers: cors, contentType: "audio/mpeg", body: MP3_SILENCE });
  }
  return route.abort();
});

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 10000 });
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });

  // Une longue traversée : questions, propositions, anecdotes, rencontres,
  // boutique, verdicts… tout ce qui parle doit passer devant les espions.
  // ADAPTATIVE : elle continue jusqu'à avoir réuni ses trois preuves (question,
  // propositions, anecdote lues en voix directe) — un parcours chanceux peut
  // enchaîner les Vrai/Faux et les cases sans question, et le clic du testeur
  // coupe la parole comme celui d'un vrai joueur : compter sur un quota fixe
  // de tours rendait le verdict aléatoire.
  const banque = JSON.parse(readFileSync(join(root, "data", "questions.json"), "utf8")).questions;
  const morceau = (t) => String(t).slice(0, 40);
  const preuves = () => ({
    question: apiTexts.some((t) => banque.some((q) => q.texte && t.includes(morceau(q.texte)))),
    anecdote: apiTexts.some((t) => banque.some((q) => q.anecdote && t.includes(morceau(q.anecdote)))),
    propositions: apiTexts.some((t) => t.startsWith("Les propositions sont")),
  });
  for (let i = 0; i < 260; i++) {
    if (i > 30) { const p = preuves(); if (p.question && p.anecdote && p.propositions) break; }
    // Devant des propositions, on laisse le Héraut COMMENCER à les lire avant
    // de répondre — comme un joueur qui écoute. Cliquer à la microseconde
    // coupait la file de parole avant la fabrication de la lecture.
    if (await page.locator(".choices .btn-choice:visible").count()) await page.waitForTimeout(900);
    for (const nom of ["Quitter la boutique", "Garder mon or"]) {
      const sortie = page.getByRole("button", { name: nom });
      if (await sortie.isVisible().catch(() => false)) await sortie.click().catch(() => {});
    }
    const roll = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await roll.isVisible().catch(() => false)) {
      await roll.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click({ timeout: 8000 }).catch(() => {});
      // Un petit temps de parole entre deux tours : les lectures s'enclenchent.
      await page.waitForTimeout(350);
      continue;
    }
    const groups = page.locator(".bet-buttons");
    let vote = false;
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click().catch(() => {}); vote = true; break; }
    }
    if (vote) continue;
    if ((await page.locator(".num-input").count()) > 0) { await page.locator(".num-input").first().fill("50").catch(() => {}); }
    const suite = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder|Passer|Suivant|Terminer|Tout le monde a écrit/ }).first();
    if ((await suite.isVisible().catch(() => false)) && (await suite.isEnabled().catch(() => false))) { await suite.click().catch(() => {}); await page.waitForTimeout(250); continue; }
    if (await page.locator("#screen-victory:not([hidden])").count()) break;
    const gros = page.locator("#panel .btn-big:not([disabled]):visible, #panel .btn-choice:not([disabled]):visible, #panel button:not([disabled]):visible").first();
    if (await gros.isVisible().catch(() => false)) { await gros.click().catch(() => {}); await page.waitForTimeout(250); continue; }
    await page.waitForTimeout(120);
  }
  // Dernier temps de parole : que les files se vident avant le relevé.
  await page.waitForTimeout(1500);

  const audit = await page.evaluate(() => window.__AUDIT);
  console.log(`  (canaux : ${audit.directs} lectures ElevenLabs, ${audit.clips} clips, ${apiTexts.length} textes fabriqués, ${audit.synthese.length} synthèses)`);

  // ① LA RÈGLE : voix directe armée → la synthèse du navigateur reste muette.
  check("aucune réplique n'échappe aux voix personnalisées", audit.synthese.length === 0);
  if (audit.synthese.length) {
    console.log("  répliques ÉCHAPPÉES (canal synthèse) :");
    for (const t of audit.synthese.slice(0, 12)) console.log(`   · « ${t} »`);
  }
  // ② Preuve POSITIVE : les lectures attendues sont bien parties en voix
  // directe — sans quoi un jeu muet passerait l'audit sans rien prouver.
  const p = preuves();
  check("au moins une QUESTION lue par la voix du Héraut", p.question);
  check("au moins une ANECDOTE lue par la voix du Héraut", p.anecdote);
  check("au moins une liste de PROPOSITIONS lue par la voix du Héraut", p.propositions);
  check("des voix ont réellement parlé pendant la partie", audit.directs + audit.clips > 10);
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log("  " + errors.slice(0, 3).join("\n  "));
} catch (e) {
  check(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? "VOIX-RÈGLE SMOKE: ÉCHEC" : "VOIX-RÈGLE SMOKE OK");
process.exit(fails ? 1 : 0);
