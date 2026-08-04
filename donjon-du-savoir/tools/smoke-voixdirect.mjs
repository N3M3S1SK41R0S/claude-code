// Vérifie la VOIX DIRECTE du Héraut de bout en bout, SANS clé réelle :
// l'API ElevenLabs est interceptée en LOCAL (fausse voix « Donjon-Heraut »,
// MP3 de silence). Prouve que :
//   1. le cache IndexedDB fonctionne — un texte lu deux fois = UN seul appel ;
//   2. dans une vraie partie, la QUESTION affichée part vers la voix du
//      Héraut en direct (et non vers la synthèse du navigateur).
// Run: node tools/smoke-voixdirect.mjs
import { chromium } from "playwright-core";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", "donjon-standalone.html");
const MP3_SILENCE = Buffer.from("SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMgAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAALAAAJygAqKioqKioqKio/Pz8/Pz8/Pz9VVVVVVVVVVVVqampqampqamp/f39/f39/f3+VlZWVlZWVlZWqqqqqqqqqqqq/v7+/v7+/v7/V1dXV1dXV1dXq6urq6urq6ur///////////8AAAAATGF2ZgAAAAAAAAAAAAAAAAAAAAAAJAQvAAAAAAAACcpLYt5KAAAAAAAAAAAAAAAAAAAAAP/7UGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1JkVg/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UmSpD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tSZKkP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1JkqQ/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UmSpD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tSZKkP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1JkqQ/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UmSpD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tSZKkP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1JkqQ/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==", "base64");

function findChromium() {
  for (const c of [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    if (!existsSync(c)) continue;
    if (statSync(c).isFile()) return c;
    for (const sub of ["chrome-linux/chrome", "chrome"]) { const p = join(c, sub); if (existsSync(p) && statSync(p).isFile()) return p; }
  }
  throw new Error("Chromium not found");
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? "✓" : "✗"} ${name}`); if (!ok) fails++; };

// La clé et la voix sont pré-branchées (valeurs FICTIVES) + Héraut vocal actif.
await page.addInitScript(() => {
  window.__DONJON_TEST = true;
  localStorage.setItem("donjon-voice", "1");
  localStorage.setItem("donjon-elevenlabs-cle", "cle-de-test-fictive");
  localStorage.setItem("donjon-elevenlabs-voix", "vx-heraut|Donjon-Heraut");
  localStorage.setItem("donjon-voixdirect", "1");
  // MONITEUR D'ANTI-SUPERPOSITION : toute création d'Audio est enregistrée,
  // et on échantillonne le nombre de pistes qui JOUENT en même temps — la
  // règle de la table : une seule bouche à la fois.
  const pistes = [];
  const AudioOrig = window.Audio;
  window.Audio = function (...args) { const a = new AudioOrig(...args); pistes.push(a); return a; };
  window.Audio.prototype = AudioOrig.prototype;
  window.__maxSimultane = 0;
  setInterval(() => {
    const n = pistes.filter((a) => !a.paused && !a.ended && a.currentTime > 0).length;
    if (n > window.__maxSimultane) window.__maxSimultane = n;
  }, 100);
});

// Interception TOTALE de l'API : rien ne sort de la machine.
const ttsTexts = [];
await page.route("https://api.elevenlabs.io/**", async (route) => {
  const req = route.request();
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (req.url().includes("/v1/voices")) {
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ voices: [{ voice_id: "vx-heraut", name: "Donjon-Heraut" }] }) });
  }
  if (req.url().includes("/v1/text-to-speech/")) {
    try { ttsTexts.push(JSON.parse(req.postData() ?? "{}").text ?? ""); } catch { ttsTexts.push("?"); }
    return route.fulfill({ status: 200, headers: cors, contentType: "audio/mpeg", body: MP3_SILENCE });
  }
  return route.abort();
});

const attend = async (cond, ms) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (cond()) return true; await page.waitForTimeout(150); }
  return cond();
};

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.locator("#bank-info").textContent({ timeout: 8000 });

  // ① CACHE : même texte lu deux fois → un SEUL appel API, entrée en IndexedDB.
  const TEXTE = "Le donjon vérifie sa mémoire de perroquet.";
  await page.evaluate((t) => window.__donjonLireDirect(t), TEXTE);
  check("1re lecture : appel API émis", await attend(() => ttsTexts.filter((t) => t === TEXTE).length === 1, 5000));
  await page.waitForTimeout(600); // cacheEcrit est asynchrone
  await page.evaluate((t) => window.__donjonLireDirect(t), TEXTE);
  await page.waitForTimeout(1200);
  check("2e lecture : AUCUN nouvel appel (cache)", ttsTexts.filter((t) => t === TEXTE).length === 1);
  const enCache = await page.evaluate(() => new Promise((res) => {
    const req = indexedDB.open("donjon-voixdirect", 1);
    req.onsuccess = () => { try { const t = req.result.transaction("clips").objectStore("clips").count(); t.onsuccess = () => res(t.result); t.onerror = () => res(-1); } catch { res(-1); } };
    req.onerror = () => res(-1);
  }));
  check(`clip conservé en IndexedDB (${enCache})`, enCache >= 1);

  // ② PARTIE RÉELLE : la question affichée doit partir vers la voix du Héraut.
  await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
  await page.getByRole("radio", { name: /Étoiles/ }).click();
  await page.locator(".rounds-input").fill("6");
  await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();
  await page.getByRole("button", { name: "🎲 Au hasard !" }).click();

  let question = null;
  let guard = 0;
  while (guard++ < 120 && !question) {
    if (await page.locator(".question-texte").count()) {
      question = (await page.locator(".question-texte").first().textContent())?.trim();
      break;
    }
    if (await page.getByText("Le Marchand d'Étoile").count()) {
      await page.getByRole("button", { name: /Garder mon or|Continuer/ }).first().click().catch(() => {});
      continue;
    }
    if (await page.getByText("La Boutique du Donjon").count()) {
      await page.getByRole("button", { name: "Quitter la boutique" }).click().catch(() => {});
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
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.locator(".bet-selected").count()) === 0) { await grp.locator("button").first().click().catch(() => {}); voted = true; break; }
    }
    if (voted) continue;
    if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) { await page.locator(".choices .btn-choice:not([disabled])").first().click().catch(() => {}); continue; }
    const next = page.getByRole("button", { name: /Découvrir|Continuer|Révéler|Valider|Subir|Quitter|Garder|a écrit/ }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      if ((await next.textContent().catch(() => "")) === "Valider mon nombre") await page.locator(".num-input").fill("50").catch(() => {});
      await next.click().catch(() => {});
      continue;
    }
    await page.waitForTimeout(200);
  }
  check(`question affichée (« ${(question ?? "").slice(0, 50)}… »)`, Boolean(question));
  if (!question) {
    // Diagnostic : où la partie s'est-elle coincée ?
    console.log("  [panneau]", (await page.locator("#panel, .panel").first().innerText().catch(() => "?")).replace(/\n+/g, " · ").slice(0, 400));
  }
  // Même toilettage que speechText (guillemets et émojis retirés) pour que
  // l'aiguille corresponde au texte réellement envoyé à la voix.
  const aiguille = (t) => t.replace(/[\p{Extended_Pictographic}«»"]/gu, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  const nbChoix = await page.locator(".choices .btn-choice").count();
  if (question) {
    // 90 s : la file de parole joue accroches et réactions en temps réel avant
    // la question — les tirages les plus bavards dépassent 45 s.
    const lue = await attend(() => ttsTexts.some((t) => t.includes(aiguille(question))), 90000);
    check(`la question est LUE par la voix du Héraut en direct (${ttsTexts.length} appels au total)`, lue);
    if (!lue) for (const t of ttsTexts) console.log("  [tts]", t.slice(0, 90));
  } else {
    check("la question est LUE par la voix du Héraut en direct", false);
  }
  // ② LES PROPOSITIONS (QCM à 3+ choix) : énumérées par la même voix.
  if (nbChoix >= 3) {
    const propositionsLues = await attend(() => ttsTexts.some((t) => t.startsWith("Les propositions sont")), 90000);
    check("les propositions sont LUES par la voix du Héraut", propositionsLues);
  } else {
    console.log(`  (question à ${nbChoix} choix : pas d'énumération attendue)`);
  }
  // ③ L'ANECDOTE : on répond, puis la carte anecdote doit être lue aussi.
  let anecdote = null;
  let garde2 = 0;
  while (garde2++ < 40 && !anecdote) {
    if (await page.locator(".anecdote-card").count()) {
      // Le CORPS de l'anecdote = la ligne la PLUS LONGUE de la carte (les
      // autres sont le titre « 📜 L'ANECDOTE DU HÉRAUT » et les sources).
      const lignes = ((await page.locator(".anecdote-card").first().innerText()) ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      anecdote = lignes.sort((a, b) => b.length - a.length)[0] ?? null;
      break;
    }
    if ((await page.locator(".choices .btn-choice:not([disabled])").count()) > 0) { await page.locator(".choices .btn-choice:not([disabled])").first().click().catch(() => {}); continue; }
    const next2 = page.getByRole("button", { name: /Révéler|Valider|Continuer/ }).first();
    if ((await next2.isVisible().catch(() => false)) && (await next2.isEnabled().catch(() => false))) {
      if ((await next2.textContent().catch(() => "")) === "Valider mon nombre") await page.locator(".num-input").fill("50").catch(() => {});
      await next2.click().catch(() => {});
      continue;
    }
    await page.waitForTimeout(200);
  }
  if (anecdote) {
    check(`anecdote affichée (« ${anecdote.slice(0, 40)}… »)`, true);
    const lue = await attend(() => ttsTexts.some((t) => t.includes(aiguille(anecdote))), 90000);
    check(`l'anecdote est LUE par la voix du Héraut en direct (${ttsTexts.length} appels au total)`, lue);
    if (!lue) { console.log("  [aiguille]", aiguille(anecdote)); for (const t of ttsTexts.slice(-8)) console.log("  [tts]", t.slice(0, 90)); }
  } else {
    // Certains tirages (défi d'expression, mini-jeux) n'ont pas de carte
    // anecdote : la vérification n'a pas d'objet sur cette partie-là.
    console.log("  (pas de carte anecdote sur ce tirage : vérification sautée)");
  }
  // ④ JAMAIS DE SUPERPOSITION : au plus UNE piste audio active à tout instant.
  const maxSimultane = await page.evaluate(() => window.__maxSimultane);
  check(`aucune superposition audio (max simultané : ${maxSimultane})`, maxSimultane <= 1);
  check("aucune erreur de page", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
} finally {
  await browser.close();
}
console.log(fails ? "VOIXDIRECT SMOKE: ÉCHEC" : "VOIXDIRECT SMOKE OK");
process.exit(fails ? 1 : 0);
