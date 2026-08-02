// BANQUE DE VOIX ENREGISTRÉES — les répliques FIXES (Héraut, héros, PNJ) sont
// en nombre fini : des clips MP3 joués par de vraies voix de personnages
// (enregistrés par une IA de voix tierce, 100 % originales) remplacent la
// synthèse vocale dès qu'ils existent. Tout texte sans clip retombe sans bruit
// sur la synthèse : le jeu ne dépend JAMAIS de la présence des fichiers.
//
// Identifiants stables : FNV-1a sur le texte NORMALISÉ (émojis et guillemets
// retirés, espaces repliés, minuscules). Le même calcul sert à l'outil
// d'inventaire (tools/export-repliques.mjs) et au moteur : un clip nommé
// voix/<perso>/<id>.mp3 correspond à sa réplique pour toujours, tant que le
// texte ne change pas.

/** Normalisation partagée inventaire ↔ moteur : seule la MATIÈRE parlée compte. */
export function normaliseReplique(texte) {
  return String(texte ?? "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "") // émojis
    .replace(/[«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Identifiant FNV-1a (32 bits, hexadécimal) d'une réplique normalisée. */
export function idReplique(texte) {
  const s = normaliseReplique(texte);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* ---------- manifeste + lecture ---------- */

// Manifeste { perso: { id: "voix/perso/id.mp3" } } — vide tant que le lot de
// voix n'est pas livré. Chargé une fois, jamais bloquant.
let manifest = {};
if (typeof window !== "undefined" && typeof fetch === "function") {
  fetch("data/voix-manifest.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => { if (m && typeof m === "object") manifest = m; })
    .catch(() => { /* pas de lot de voix : la synthèse assure tout */ });
}

let courant = null; // Audio en cours
let file = []; // clips en attente (queue: true)

function jouerSuivant() {
  const prochain = file.shift();
  if (!prochain) { courant = null; return; }
  demarrer(prochain);
}

function demarrer(src) {
  try {
    const a = new Audio(src);
    courant = a;
    a.addEventListener("ended", jouerSuivant);
    a.addEventListener("error", jouerSuivant);
    a.play().catch(() => jouerSuivant()); // autoplay refusé : on passe au suivant
  } catch {
    jouerSuivant();
  }
}

/** Coupe tout clip en cours (miroir du synth.cancel de la synthèse). */
export function stopClips() {
  file = [];
  if (courant) {
    try { courant.pause(); } catch { /* déjà arrêté */ }
    courant = null;
  }
}

/** Joue le clip d'une réplique si le lot le contient. Renvoie true si un clip
 *  prend la parole (la synthèse doit alors se taire), false sinon. */
export function playClip(perso, texte, { queue = false } = {}) {
  const src = manifest?.[perso]?.[idReplique(texte)];
  if (!src) return false;
  if (queue && courant) file.push(src);
  else {
    stopClips();
    try { window.speechSynthesis?.cancel(); } catch { /* pas de synthèse ici */ }
    demarrer(src);
  }
  return true;
}
