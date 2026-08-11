// L'ARTIFACT PUBLIÉ, joué depuis le disque (file://). Sa banque n'est PAS
// stockée comme celle du fichier autonome : pour tenir sous le plafond de
// 16 Mio, elle y voyage COMPRESSÉE et se décompresse au premier accès. Ce
// chemin-là n'existe nulle part ailleurs — sans ce contrôle, une panne de
// décompression donnerait un jeu vide de questions, et personne ne le verrait
// avant la publication. Run : node tools/smoke-artifact.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-artifact.html");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium introuvable");
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
const echecs = [];
const check = (nom, ok, detail = "") => { console.log(`${ok ? "✓" : "✗"} ${nom}${detail ? ` — ${detail}` : ""}`); if (!ok) echecs.push(nom); };

try {
  await page.addInitScript(() => { try { localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, immersion: false, voixProposee: true })); } catch { /* mode privé */ } });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  // L'artifact est un FRAGMENT (ni <html> ni <head> : la page hôte les fournit
  // à la publication) — on l'identifie donc à son bandeau, pas à son titre.
  check("la page s'ouvre", /Donjon du Savoir/i.test(await page.locator("body").innerText({ timeout: 10000 })));

  // ① La banque compressée arrive bien jusqu'à l'accueil.
  const info = await page.locator("#bank-info").textContent({ timeout: 15000 }).catch(() => "");
  const annonce = /(\d[\d   ]*) questions vérifiées/.exec(info || "");
  const nb = annonce ? Number(annonce[1].replace(/[^\d]/g, "")) : 0;
  check("la banque se décompresse et s'annonce", nb > 0, `${nb} questions`);

  // ② Le compte annoncé est bien CELUI de la banque du dépôt (une
  //    décompression tronquée passerait autrement inaperçue).
  const attendu = JSON.parse(await import("node:fs").then((m) => m.readFileSync(join(root, "data", "questions.json"), "utf8"))).questions.length;
  check("aucune question perdue à la compression", nb === attendu, `${nb} / ${attendu}`);

  // ③ Une vraie question s'affiche en partie : la banque est exploitable,
  //    pas seulement comptée.
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click({ timeout: 8000 });
  let question = false;
  for (let i = 0; i < 40 && !question; i++) {
    const de = page.getByRole("button", { name: "🎲 Lancer le dé" });
    if (await de.isVisible().catch(() => false)) {
      await de.click();
      await page.getByRole("button", { name: /Avancer de \d/ }).click().catch(() => {});
    }
    await page.waitForTimeout(500);
    if ((await page.locator(".choices .btn-choice").count()) > 0) { question = true; break; }
    const suite = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Garder|Quitter/ }).first();
    if (await suite.isVisible().catch(() => false)) await suite.click().catch(() => {});
  }
  check("une question jouable s'affiche", question);

  check("aucune erreur de page", erreurs.length === 0, erreurs[0]?.slice(0, 110) ?? "");
} catch (e) {
  check(`déroulement : ${String(e.message).split("\n")[0]}`, false);
}

await browser.close();
console.log(echecs.length ? `\nARTIFACT SMOKE: ÉCHEC (${echecs.join(", ")})` : "\nARTIFACT SMOKE OK");
process.exit(echecs.length ? 1 : 0);
