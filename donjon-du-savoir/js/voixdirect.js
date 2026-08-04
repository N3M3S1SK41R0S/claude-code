// VOIX EN DIRECT (option « pour aller plus loin ») : les textes VARIABLES
// (questions, anecdotes) sont lus par la VRAIE voix ElevenLabs du Héraut,
// générés à la volée avec la clé API du propriétaire du jeu, puis mis en
// CACHE DÉFINITIF sur l'appareil (IndexedDB) : une question lue une fois est
// acquise pour toujours — au fil des parties, toute la banque devient de
// vrais enregistrements, gratuits et hors-ligne.
//
// Règles de sécurité et de sobriété :
// - la clé reste sur CET appareil (localStorage), jamais dans le fichier
//   partagé ni dans une sauvegarde de partie ;
// - AUCUN appel réseau tant que l'option n'est pas activée par son
//   propriétaire ; hors-ligne ou en cas d'erreur, repli silencieux sur la
//   synthèse — le jeu ne dépend jamais de ce service ;
// - voix 100 % originale du projet (Donjon-Heraut), jamais de clonage.
import { idReplique } from "./voiceclips.js";

const CLE_STOCKAGE = "donjon-elevenlabs-cle";
const VOIX_STOCKAGE = "donjon-elevenlabs-voix";
const ACTIF_STOCKAGE = "donjon-voixdirect";
const API = "https://api.elevenlabs.io/v1";

let audioDirect = null;
// RÉSERVATION DE PAROLE : dès que lireEnDirect ACCEPTE un texte, la voix est
// « en cours » pour l'arbitre — même pendant la lecture du cache ou l'appel
// réseau (qui peut durer des secondes). Sans elle, la file croyait au silence
// et lançait la réplique suivante PAR-DESSUS la lecture qui arrivait.
let attenteDirect = false;
// Jeton anti-fantôme : si stop() intervient pendant l'appel réseau, la réponse
// tardive est jetée au lieu de parler par-dessus la suite de la partie.
let jetonDirect = 0;

/* ---------- réglages persistés ---------- */

const lit = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const pose = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* privé */ } };

export function voixDirectConfigure() { return Boolean(lit(CLE_STOCKAGE) && lit(VOIX_STOCKAGE)); }
export function voixDirectActif() { return voixDirectConfigure() && lit(ACTIF_STOCKAGE) === "1"; }
export function setVoixDirect(on) { pose(ACTIF_STOCKAGE, on ? "1" : "0"); }
export function nomVoixDirect() { return (lit(VOIX_STOCKAGE) ?? "").split("|")[1] ?? ""; }
export function oublierCle() { pose(CLE_STOCKAGE, null); pose(VOIX_STOCKAGE, null); pose(ACTIF_STOCKAGE, null); }

/** Enregistre la clé après l'avoir validée : cherche la voix du LECTEUR sur le
 *  compte — le Héraut d'abord (choix officiel de la table), sinon un éventuel
 *  animateur « Chienhaut », sinon la première voix « Donjon-… » du casting. */
export async function configurerCle(cle) {
  const r = await fetch(`${API}/voices`, { headers: { "xi-api-key": cle } });
  if (!r.ok) throw new Error(r.status === 401 ? "Clé refusée par ElevenLabs." : `ElevenLabs répond ${r.status}.`);
  const { voices = [] } = await r.json();
  const voix = voices.find((v) => v.name === "Donjon-Heraut")
    ?? voices.find((v) => /chienhaut/i.test(v.name ?? ""))
    ?? voices.find((v) => v.name?.startsWith("Donjon-"));
  if (!voix) throw new Error("Aucune voix « Donjon-… » sur ce compte.");
  pose(CLE_STOCKAGE, cle);
  pose(VOIX_STOCKAGE, `${voix.voice_id}|${voix.name}`);
  pose(ACTIF_STOCKAGE, "1");
  return voix.name;
}

/* ---------- cache définitif (IndexedDB) ---------- */

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open("donjon-voixdirect", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("clips");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  return dbPromise;
}
async function cacheLit(id) {
  try {
    const d = await db();
    return await new Promise((res) => {
      const t = d.transaction("clips").objectStore("clips").get(id);
      t.onsuccess = () => res(t.result ?? null);
      t.onerror = () => res(null);
    });
  } catch { return null; }
}
async function cacheEcrit(id, blob) {
  try {
    const d = await db();
    d.transaction("clips", "readwrite").objectStore("clips").put(blob, id);
  } catch { /* cache plein ou privé : tant pis, on regénérera */ }
}

/** Nombre de clips acquis (pour l'afficher dans les Réglages). */
export async function tailleCache() {
  try {
    const d = await db();
    return await new Promise((res) => {
      const t = d.transaction("clips").objectStore("clips").count();
      t.onsuccess = () => res(t.result);
      t.onerror = () => res(0);
    });
  } catch { return 0; }
}

/* ---------- lecture ---------- */

/** Une lecture ElevenLabs en direct est-elle en cours ou RÉSERVÉE ?
 *  (arbitre de parole — la réservation compte comme une prise de parole) */
export function directEnCours() {
  return attenteDirect || audioDirect !== null;
}

export function stopDirect() {
  attenteDirect = false;
  jetonDirect += 1; // toute lecture en préparation devient caduque
  if (audioDirect) {
    try { audioDirect.pause(); } catch { /* déjà arrêté */ }
    audioDirect = null;
  }
}

function joue(blob, onEchec) {
  const a = new Audio(URL.createObjectURL(blob));
  attenteDirect = false; // la réservation devient une vraie lecture
  audioDirect = a;
  a.addEventListener("ended", () => { if (audioDirect === a) audioDirect = null; URL.revokeObjectURL(a.src); });
  a.addEventListener("error", () => { if (audioDirect === a) { audioDirect = null; onEchec?.(); } });
  a.play().catch(() => { if (audioDirect === a) { audioDirect = null; onEchec?.(); } });
}

/** Lit un texte avec la vraie voix (cache d'abord, API sinon). Renvoie true si
 *  la lecture est prise en charge ; en cas de pépin, onEchec() rend la main à
 *  la synthèse — jamais de silence, jamais de blocage. La parole est RÉSERVÉE
 *  dès l'acceptation (voir attenteDirect), et une réponse arrivée après un
 *  stop() est jetée (jetonDirect) au lieu de parler par-dessus la suite. */
export function lireEnDirect(texte, { onEchec } = {}) {
  if (!voixDirectActif() || !texte) return false;
  const id = idReplique(texte);
  const [voiceId] = (lit(VOIX_STOCKAGE) ?? "").split("|");
  attenteDirect = true;
  const jeton = ++jetonDirect + 0; // valeur figée : stopDirect() l'invalide
  const echec = () => { if (jeton === jetonDirect) { attenteDirect = false; onEchec?.(); } };
  (async () => {
    const enCache = await cacheLit(id);
    if (jeton !== jetonDirect) return; // stop() est passé par là : on se tait
    if (enCache) return joue(enCache, onEchec);
    if (!navigator.onLine) return echec();
    try {
      const r = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": lit(CLE_STOCKAGE), "Content-Type": "application/json" },
        body: JSON.stringify({
          text: texte,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45 },
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      cacheEcrit(id, blob); // acquis pour toujours — même si cette lecture est caduque
      if (jeton !== jetonDirect) return; // trop tard pour parler, le cache reste
      joue(blob, onEchec);
    } catch {
      echec();
    }
  })();
  return true;
}
