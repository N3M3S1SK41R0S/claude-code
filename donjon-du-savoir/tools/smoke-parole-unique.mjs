// AUDIT « UNE SEULE BOUCHE À LA FOIS » — preuve MESURÉE qu'aucune réplique
// vocale ne se superpose à une autre (deux paroles audibles en même temps
// = défaut). L'audit est fait par INTERVALLES : chaque prise de parole est
// enregistrée avec son instant de début et de fin, tous canaux confondus
// (clips MP3 embarqués, accroches WebM, voix directe ElevenLabs en blob:,
// synthèse du navigateur), puis les intervalles sont confrontés deux à deux.
//
// Périmètre du registre — justifié par lecture du code :
//  - js/voiceclips.js, js/voixdirect.js et js/tts.js sont les SEULS modules à
//    créer des HTMLMediaElement, et tous portent de la parole (clips voix/…,
//    accroches assets/voix/…webm, blobs ElevenLabs) ;
//  - les bruitages (js/sfx.js), la musique de fond (js/music.js) et le Son
//    Mystère (js/sonmystere.js) passent par Web Audio (AudioContext,
//    oscillateurs et buffers) : ils ne peuvent PAS entrer dans le registre —
//    aucune exclusion par src n'est donc nécessaire, l'espion HTMLMediaElement
//    n'entend QUE des voix.
//
// Deux scénarios, voix ACTIVÉE et clé ElevenLabs simulée en local (mêmes
// mécanismes que tools/smoke-voix-regle.mjs — aucun octet ne sort) :
//  A. partie plateau 100 % bots, SANS __DONJON_BOTFAST : ce drapeau saute
//     l'attente de parole des bots (js/game.js:134) et fausserait l'audit —
//     ici les bots écoutent le Héraut comme de vrais joueurs ;
//  B. Partie Éclair, une douzaine de questions cliquées au rythme d'un joueur
//     (écoutes variables : parfois on laisse finir, parfois on coupe).
//
// Verdict : deux intervalles A et B (A commencé avant B) se chevauchent si
// debutB < finA - 80 ms (tolérance de fondu : les événements « pause/ended »
// arrivent en tâche différée, quelques ms après le vrai silence).
// Lancer : node tools/smoke-parole-unique.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3233;
const TOLERANCE_MS = 80; // fondu toléré entre deux répliques
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".webm": "audio/webm", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("interdit");
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
  throw new Error("Chromium introuvable");
}

// L'API simulée répond avec le PLUS COURT clip réel de la banque du Héraut
// (~2 s) : chaque réplique garde une vraie durée audible — c'est elle que
// l'audit mesure — sans étirer la partie au point de ne voir que trois tours.
const manifeste = JSON.parse(readFileSync(join(root, "data", "voix-manifest.json"), "utf8"));
const cheminCourt = Object.values(manifeste.heraut)
  .map((p) => join(root, p))
  .reduce((a, b) => (statSync(a).size <= statSync(b).size ? a : b));
const MP3_REPONSE = readFileSync(cheminCourt);

let fails = 0;
const verifie = (nom, ok) => { console.log(`${ok ? "✓" : "✗"} ${nom}`); if (!ok) fails++; };

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"],
});

/* ---------- espions embarqués (avant le chargement du jeu) ---------- */

async function ouvrePageEspionnee(viewport) {
  const page = await browser.newPage({ viewport }); // contexte NEUF : cache IndexedDB vierge
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 200)));
  const apiTextes = [];

  await page.addInitScript(() => {
    // Régime de test des smokes (parcours déterministe, pas d'overlays bloquants).
    // SURTOUT PAS __DONJON_BOTFAST : il court-circuite l'attente de parole des
    // bots (js/game.js:134) — l'audit exige le rythme réel d'écoute.
    window.__DONJON_TEST = true;
    localStorage.setItem("donjon-voice", "1");
    localStorage.setItem("donjon-elevenlabs-cle", "cle-de-test-fictive");
    localStorage.setItem("donjon-elevenlabs-voix", "vx-heraut|Donjon-Heraut");
    localStorage.setItem("donjon-voixdirect", "1");
    localStorage.setItem("donjon-prefs", JSON.stringify({ tutoVu: true, voixProposee: true }));

    // ── LE REGISTRE DE PAROLE : un intervalle par prise de parole.
    // { canal, src?, texte?, debut, fin, aJoue } — aJoue passe à true quand le
    // son DÉMARRE réellement (« playing » / « start ») ; un intervalle jamais
    // audible (autoplay refusé, coupé avant le premier échantillon) ne peut pas
    // chevaucher. debut est recalé sur l'instant audible réel.
    window.__PAROLES = [];
    const maintenant = () => performance.now();
    const nouvelIntervalle = (canal, extra) => {
      const it = { canal, debut: maintenant(), fin: null, aJoue: false, ...extra };
      window.__PAROLES.push(it);
      return it;
    };

    // ── Correspondance blob: → texte (voix directe) : le texte part dans le
    // POST vers l'API, le blob revient, l'URL blob: le rejoue — on suit la
    // chaîne pour pouvoir CITER la réplique dans le rapport. (Un blob relu du
    // cache IndexedDB perd son identité : texte inconnu, canal quand même noté.)
    const texteParBlob = new WeakMap();
    const texteParUrl = new Map();
    const fetchOrig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const rep = await fetchOrig(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : String(args[0]?.url ?? "");
        if (url.includes("/v1/text-to-speech/")) {
          let texte = null;
          try { texte = JSON.parse(args[1]?.body ?? "{}").text ?? null; } catch { /* corps illisible */ }
          const blobOrig = rep.blob.bind(rep);
          rep.blob = async () => { const b = await blobOrig(); if (texte) texteParBlob.set(b, texte); return b; };
        }
      } catch { /* l'espion ne casse jamais le jeu */ }
      return rep;
    };
    const cooOrig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      const u = cooOrig(obj);
      try { const t = texteParBlob.get(obj); if (t) texteParUrl.set(u, t); } catch { /* blob étranger */ }
      return u;
    };

    // ── Pistes audio (HTMLMediaElement) : TOUTES sont de la parole ici (voir
    // en-tête du fichier — bruitages/musique/Son Mystère = Web Audio pur).
    const suivi = new WeakMap();
    const playOrig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      const src = String(this.currentSrc || this.src || "");
      let it = suivi.get(this);
      if (!it || it.fin !== null) {
        const canal = src.startsWith("blob:") ? "voix-directe"
          : (src.includes("voix/") || src.startsWith("data:audio")) ? "clip"
            : "media-autre"; // inattendu : compté ET signalé, jamais ignoré en silence
        it = nouvelIntervalle(canal, { src: src.slice(0, 160), texte: texteParUrl.get(src) ?? null });
        suivi.set(this, it);
        const mien = it;
        const clot = () => { if (mien.fin === null) mien.fin = maintenant(); };
        this.addEventListener("playing", () => { if (mien.fin === null && !mien.aJoue) { mien.aJoue = true; mien.debut = maintenant(); } });
        for (const ev of ["ended", "pause", "emptied", "error", "abort"]) this.addEventListener(ev, clot);
      }
      const mien = it;
      const p = playOrig.apply(this, a);
      if (p?.catch) p.catch(() => { if (mien.fin === null) mien.fin = maintenant(); }); // autoplay refusé : rien d'audible
      return p;
    };
    // pause() est LE geste de coupure de l'arbitre (silence, stopClips,
    // stopDirect) : fermer l'intervalle À L'APPEL — et non à l'événement
    // différé — donne l'instant exact du silence.
    const pauseOrig = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function (...a) {
      const it = suivi.get(this);
      if (it && it.fin === null) it.fin = maintenant();
      return pauseOrig.apply(this, a);
    };

    // ── Synthèse du navigateur : début à speak(), audible à « start », fin à
    // « end »/« error » — via addEventListener, donc les onend/onerror que le
    // jeu pose de son côté ne sont JAMAIS écrasés.
    const synth = window.speechSynthesis;
    if (synth) {
      const ouvertes = new Set();
      const speakOrig = synth.speak.bind(synth);
      synth.speak = (utt) => {
        const it = nouvelIntervalle("synthese", { texte: String(utt?.text ?? "").slice(0, 160) });
        ouvertes.add(it);
        try {
          utt.addEventListener("start", () => { if (it.fin === null && !it.aJoue) { it.aJoue = true; it.debut = maintenant(); } });
          const clot = () => { if (it.fin === null) it.fin = maintenant(); ouvertes.delete(it); };
          utt.addEventListener("end", clot);
          utt.addEventListener("error", clot);
        } catch { /* utterance sans EventTarget : très vieux moteur */ }
        return speakOrig(utt);
      };
      const cancelOrig = synth.cancel.bind(synth);
      synth.cancel = () => {
        for (const it of ouvertes) { if (it.fin === null) it.fin = maintenant(); }
        ouvertes.clear();
        return cancelOrig();
      };
    }
  });

  // L'API ElevenLabs, simulée en local : chaque texte demandé est journalisé,
  // la réponse est un clip MP3 réel (voir MP3_REPONSE) — durée audible réelle.
  await page.route("https://api.elevenlabs.io/**", async (route) => {
    const req = route.request();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.url().includes("/v1/voices")) {
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ voices: [{ voice_id: "vx-heraut", name: "Donjon-Heraut" }] }) });
    }
    if (req.url().includes("/v1/text-to-speech/")) {
      try { apiTextes.push(JSON.parse(req.postData() ?? "{}").text ?? "?"); } catch { apiTextes.push("?"); }
      return route.fulfill({ status: 200, headers: cors, contentType: "audio/mpeg", body: MP3_REPONSE });
    }
    return route.abort();
  });

  return { page, erreurs, apiTextes };
}

/** Relève le registre de parole de la page (avec l'instant de clôture). */
const releveParoles = (page) => page.evaluate(() => ({ paroles: window.__PAROLES, finMesure: performance.now() }));

/* ---------- scénario A : plateau, 100 % bots, rythme réel ---------- */

async function scenarioPlateau() {
  const { page, erreurs, apiTextes } = await ouvrePageEspionnee({ width: 900, height: 1100 });
  let tours = 0, victoire = false, dureeSec = 0;
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
    await page.locator("#bank-info").textContent({ timeout: 10000 });
    await page.getByRole("button", { name: "⚔️ Nouvelle partie" }).click();
    // 2 bots, 0 humain : la partie se joue toute seule, personne ne clique —
    // seul le pilote de bots coupe/écoute la parole, comme en vraie partie.
    await page.getByRole("button", { name: "🤖 Ajouter un bot" }).click();
    await page.getByRole("button", { name: "🤖 Ajouter un bot" }).click();
    for (let i = 0; i < 2; i++) {
      const x = page.getByRole("button", { name: /Retirer le joueur/ }).first();
      if (await x.isVisible().catch(() => false)) await x.click();
    }
    await page.getByRole("button", { name: "🏰 Entrer dans le Donjon" }).click();

    // Traversée : jusqu'à victoire, 12 tours ou ~3 minutes de jeu réel —
    // la barre demandée par l'audit (les bots au rythme d'écoute sont lents).
    const debutJeu = Date.now();
    for (;;) {
      dureeSec = (Date.now() - debutJeu) / 1000;
      if (dureeSec >= 185) break;
      victoire = (await page.locator("#screen-victory:not([hidden])").count()) > 0;
      if (victoire) break;
      tours = await page.evaluate(() => import("/js/state.js").then((m) => m.getState()?.tour ?? 0).catch(() => 0));
      if (tours >= 12) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2500); // la file de parole finit sa phrase
  } catch (e) {
    erreurs.push(`déroulement: ${String(e.message).split("\n")[0]}`);
  }
  const rel = await releveParoles(page).catch(() => ({ paroles: [], finMesure: 0 }));
  await page.close().catch(() => {});
  return { nom: "plateau bots", ...rel, erreurs, apiTextes, tours, victoire, dureeSec };
}

/* ---------- scénario B : Partie Éclair, questions enchaînées ---------- */

async function scenarioEclair() {
  const { page, erreurs, apiTextes } = await ouvrePageEspionnee({ width: 390, height: 844 });
  let questions = 0;
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
    await page.locator("#bank-info").textContent({ timeout: 10000 });
    await page.getByRole("button", { name: /Partie Éclair/ }).click();
    await page.waitForSelector(".eclair-setup", { timeout: 8000 });
    await page.locator(".eclair-setup .btn-small", { hasText: "Ajouter" }).click(); // 2 joueurs
    await page.getByRole("button", { name: "⚡ C'est parti !" }).click();

    // Une douzaine de questions au rythme d'un joueur : écoutes VARIABLES —
    // parfois on laisse la lecture s'installer, parfois on coupe en répondant
    // vite (c'est le clic réel qui arbitre, exactement comme à table).
    for (let i = 0; i < 12; i++) {
      const choix = page.locator(".eclair-choix");
      try { await choix.first().waitFor({ state: "visible", timeout: 10000 }); } catch { break; }
      await page.waitForTimeout([900, 1800, 3200][i % 3]); // écoute la question (plus ou moins)
      await choix.first().click().catch(() => {});
      try { await page.waitForSelector(".eclair-verdict", { timeout: 8000 }); } catch { break; }
      questions += 1;
      await page.waitForTimeout(i % 2 ? 2800 : 1200); // écoute l'anecdote (plus ou moins)
      const suite = page.getByRole("button", { name: /Question suivante|Voir le résultat/ });
      if (await suite.isVisible().catch(() => false)) await suite.click().catch(() => {});
      if (await page.locator(".eclair-podium").isVisible().catch(() => false)) break;
    }
    if (await page.locator(".eclair-carte").isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "🏁 Terminer ici" }).click().catch(() => {});
    }
    await page.waitForSelector(".eclair-podium", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500); // l'annonce du podium finit sa phrase
  } catch (e) {
    erreurs.push(`déroulement: ${String(e.message).split("\n")[0]}`);
  }
  const rel = await releveParoles(page).catch(() => ({ paroles: [], finMesure: 0 }));
  await page.close().catch(() => {});
  return { nom: "partie éclair", ...rel, erreurs, apiTextes, questions };
}

/* ---------- analyse des intervalles ---------- */

function etiquette(p) {
  if (p.canal === "synthese") return `synthèse « ${p.texte ?? "?"} »`;
  if (p.canal === "voix-directe") return p.texte ? `voix directe « ${p.texte} »` : "voix directe (blob relu du cache local, texte non tracé)";
  const src = (p.src ?? "").replace(/^https?:\/\/[^/]+\//, "");
  return `${p.canal} ${src}`;
}

function analyse(rel) {
  // Seuls les intervalles AUDIBLES comptent pour le chevauchement : un play()
  // refusé ou une utterance jamais démarrée n'a produit aucun son.
  const audibles = rel.paroles.filter((p) => p.aJoue).sort((a, b) => a.debut - b.debut);
  const chevs = [];
  for (let i = 0; i < audibles.length; i++) {
    const A = audibles[i];
    for (let j = i + 1; j < audibles.length; j++) {
      const B = audibles[j];
      if (A.fin === null) {
        // Intervalle jamais clos : compté UNIQUEMENT contre une réplique
        // entièrement démarrée après lui (règle de l'audit).
        chevs.push({ A, B, ms: Math.round((B.fin ?? rel.finMesure) - B.debut), ouvert: true });
      } else if (B.debut < A.fin - TOLERANCE_MS) {
        chevs.push({ A, B, ms: Math.round(Math.min(A.fin, B.fin ?? rel.finMesure) - B.debut) });
      } else break; // triés par début : les suivants commencent encore plus tard
    }
  }
  const parCanal = {};
  for (const p of rel.paroles) {
    parCanal[p.canal] ??= { demandees: 0, audibles: 0 };
    parCanal[p.canal].demandees += 1;
    if (p.aJoue) parCanal[p.canal].audibles += 1;
  }
  const durees = audibles.filter((p) => p.fin !== null).map((p) => p.fin - p.debut);
  return {
    audibles, chevs, parCanal,
    coupeesVite: durees.filter((d) => d < 300).length,
    dureeMoy: durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : 0,
    ouvertes: rel.paroles.filter((p) => p.fin === null).length,
    jamaisAudibles: rel.paroles.filter((p) => !p.aJoue).length,
  };
}

function rapporte(rel, minAudibles) {
  const a = analyse(rel);
  const t0 = rel.paroles.length ? Math.min(...rel.paroles.map((p) => p.debut)) : 0;
  console.log(`\n— Scénario « ${rel.nom} » —`);
  const canaux = Object.entries(a.parCanal).map(([c, n]) => `${c} : ${n.audibles} audibles / ${n.demandees} demandées`).join(" · ");
  console.log(`  répliques mesurées : ${canaux || "AUCUNE"}`);
  console.log(`  durée moyenne d'une réplique audible : ${Math.round(a.dureeMoy)} ms · coupées < 300 ms : ${a.coupeesVite} · intervalles restés ouverts : ${a.ouvertes} · jamais audibles : ${a.jamaisAudibles}`);
  if (rel.apiTextes) console.log(`  textes fabriqués par l'API simulée : ${rel.apiTextes.length}`);
  if (a.chevs.length) {
    console.log(`  CHEVAUCHEMENTS (${a.chevs.length}) :`);
    for (const c of a.chevs) {
      console.log(`   ✗ ${c.ms} ms de recouvrement${c.ouvert ? " (1re réplique jamais close)" : ""}`);
      console.log(`     · A [${((c.A.debut - t0) / 1000).toFixed(2)} s → ${c.A.fin === null ? "?" : ((c.A.fin - t0) / 1000).toFixed(2) + " s"}] ${etiquette(c.A)}`);
      console.log(`     · B [${((c.B.debut - t0) / 1000).toFixed(2)} s → ${c.B.fin === null ? "?" : ((c.B.fin - t0) / 1000).toFixed(2) + " s"}] ${etiquette(c.B)}`);
    }
  } else {
    console.log("  chevauchements : aucun");
  }
  if (rel.erreurs.length) console.log(`  erreurs de page : ${rel.erreurs.slice(0, 3).join(" | ")}`);
  verifie(`${rel.nom} : aucun chevauchement de parole`, a.chevs.length === 0);
  verifie(`${rel.nom} : l'audit a réellement entendu des voix (≥ ${minAudibles} répliques audibles)`, a.audibles.length >= minAudibles);
  return a;
}

/* ---------- exécution ---------- */

try {
  const plateau = await scenarioPlateau();
  const eclair = await scenarioEclair();

  rapporte(plateau, 10);
  console.log(`  traversée : ${plateau.tours} tour(s) de table, ${Math.round(plateau.dureeSec)} s de jeu${plateau.victoire ? ", victoire atteinte" : ""}`);
  verifie("plateau bots : traversée suffisante (victoire, ≥ 12 tours ou ≥ 180 s)", plateau.victoire || plateau.tours >= 12 || plateau.dureeSec >= 180);

  rapporte(eclair, 8);
  console.log(`  questions jouées : ${eclair.questions}`);
  verifie("partie éclair : au moins 8 questions enchaînées", eclair.questions >= 8);
} catch (e) {
  verifie(`déroulement sans imprévu (${String(e.message).split("\n")[0]})`, false);
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? "\nPAROLE-UNIQUE SMOKE : ÉCHEC" : "\nPAROLE-UNIQUE SMOKE OK");
process.exit(fails ? 1 : 0);
