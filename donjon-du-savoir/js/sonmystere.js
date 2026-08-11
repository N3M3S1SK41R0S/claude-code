// LE SON MYSTÈRE — sons SYNTHÉTISÉS à la volée (Web Audio), zéro fichier.
// Aucun enregistrement, donc aucun poids, aucun droit d'auteur, et ça marche
// hors ligne comme le reste du Donjon.
//
// Le parti pris est assumé : ces sons sont des IMITATIONS STYLISÉES, à la
// manière d'un bruiteur de radio qui fait le galop avec deux noix de coco. On
// ne cherche donc que des sons dont la SIGNATURE tient dans un geste simple —
// une sirène qui alterne deux notes, une cloche qui résonne, un ressort qui
// rebondit. Tout ce qui demanderait un vrai enregistrement (chant d'oiseau,
// voix, moteur précis) est écarté : mieux vaut dix sons reconnaissables que
// trente approximations.

let ctx = null;
let master = null; // tout passe par ce robinet : le couper suffit à faire le silence

/** Contexte audio partagé, créé au premier son (donc après un geste joueur). */
function audio() {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  if (!ctx) { try { ctx = new C(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
  return ctx;
}

/** Où brancher les sons : le robinet maître du contexte courant. Un nœud ne
 *  peut se relier qu'à SON contexte — les outils de contrôle rendent les
 *  partitions dans un contexte hors ligne à eux, qui a sa propre sortie. */
function sortie(c) { return master && master.context === c ? master : c.destination; }

/**
 * Coupe net le bruitage en cours. Indispensable : le Héraut annonce le verdict
 * juste après la réponse, et deux sons simultanés, c'est exactement ce qu'on
 * s'interdit partout ailleurs.
 */
export function stopSon() {
  if (!ctx || !master) return;
  try {
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    const mort = master;
    master = null;
    setTimeout(() => { try { mort.disconnect(); } catch { /* déjà détaché */ } }, 200);
  } catch { master = null; }
}

/** Le son mystère est-il jouable ici ? (sans quoi on ne propose pas le format) */
export function sonMystereDispo() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

/* ---------- briques de bruitage ---------- */

/** Note enveloppée, avec glissando optionnel vers une autre hauteur. */
function note(c, t0, { freq, vers = null, dur = 0.3, type = "sine", gain = 0.12, attaque = 0.01 }) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (vers) osc.frequency.exponentialRampToValueAtTime(Math.max(20, vers), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sortie(c));
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Bouffée de bruit filtré : la brique du vent, de la pluie, du tonnerre et
 *  des applaudissements — tout ce qui n'a pas de hauteur définie. */
function souffle(c, t0, { dur = 0.4, gain = 0.12, coupe = 1200, type = "lowpass", q = 1, monte = null }) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filtre = c.createBiquadFilter();
  filtre.type = type;
  filtre.frequency.setValueAtTime(coupe, t0);
  if (monte) filtre.frequency.linearRampToValueAtTime(monte, t0 + dur);
  filtre.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.05, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filtre).connect(g).connect(sortie(c));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Cloche : une fondamentale et ses partiels inharmoniques, qui traînent. */
function cloche(c, t0, base, gain = 0.1, dur = 2.2) {
  for (const [mult, part] of [[1, 1], [2.01, 0.5], [2.98, 0.32], [4.2, 0.18], [5.6, 0.1]]) {
    note(c, t0, { freq: base * mult, dur: dur * (1 - (mult - 1) * 0.1), gain: gain * part, type: "sine", attaque: 0.004 });
  }
}

/* ---------- LES SONS ---------- */
// Chacun est joué par une petite partition : c'est le RYTHME autant que le
// timbre qui rend un son reconnaissable (les deux tons de la sirène, les trois
// temps du galop, la montée du ressort).

export const SONS = {
  sirene: (c, t) => { // deux tons alternés, façon véhicule de secours
    for (let i = 0; i < 6; i++) note(c, t + i * 0.42, { freq: i % 2 ? 440 : 588, dur: 0.4, type: "square", gain: 0.07 });
  },
  cloche: (c, t) => { cloche(c, t, 262); cloche(c, t + 1.3, 262, 0.08); },
  tonnerre: (c, t) => { // craquement sec, puis grondement long qui s'éloigne
    souffle(c, t, { dur: 0.14, gain: 0.16, coupe: 4000, type: "highpass" });
    souffle(c, t + 0.1, { dur: 2.4, gain: 0.14, coupe: 320, monte: 90 });
  },
  pluie: (c, t) => { souffle(c, t, { dur: 2.6, gain: 0.1, coupe: 3800, type: "highpass" }); },
  galop: (c, t) => { // trois sabots groupés, quatre fois — le rythme fait tout
    // Un filtre étroit (Q élevé) mange presque toute l'énergie du bruit : les
    // sabots devenaient inaudibles. Bande plus large, sabots plus francs.
    for (let p = 0; p < 4; p++) for (let i = 0; i < 3; i++) {
      souffle(c, t + p * 0.62 + i * 0.09, { dur: 0.09, gain: 0.34, coupe: 240, q: 1.6, type: "bandpass" });
      note(c, t + p * 0.62 + i * 0.09, { freq: 130, vers: 70, dur: 0.07, type: "sine", gain: 0.1 });
    }
  },
  horloge: (c, t) => { // tic-tac régulier, puis la sonnerie de l'heure
    for (let i = 0; i < 6; i++) souffle(c, t + i * 0.5, { dur: 0.03, gain: 0.09, coupe: i % 2 ? 2600 : 1800, q: 8, type: "bandpass" });
    cloche(c, t + 3.2, 523, 0.08, 1.2);
  },
  telephone: (c, t) => { // sonnerie ancienne : trilles rapides en deux salves
    for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) {
      note(c, t + s * 1.4 + i * 0.05, { freq: i % 2 ? 1050 : 780, dur: 0.05, type: "triangle", gain: 0.07 });
    }
  },
  ressort: (c, t) => { // rebonds de plus en plus rapprochés, de plus en plus aigus
    let d = 0;
    for (let i = 0; i < 7; i++) {
      note(c, t + d, { freq: 240 + i * 90, vers: 520 + i * 130, dur: 0.13, type: "triangle", gain: 0.1 - i * 0.01 });
      d += 0.34 - i * 0.04;
    }
  },
  vaisseau: (c, t) => { // trois tirs descendants, façon laser de salle d'arcade
    for (let i = 0; i < 3; i++) note(c, t + i * 0.32, { freq: 1600, vers: 180, dur: 0.28, type: "sawtooth", gain: 0.08 });
  },
  applaudissements: (c, t) => { // une foule de claquements secs et irréguliers
    // Des claquements francs : trop discrets, ils passaient pour de la friture.
    for (let i = 0; i < 46; i++) souffle(c, t + i * 0.055 + Math.random() * 0.04, { dur: 0.04, gain: 0.26, coupe: 1400 + Math.random() * 1800, q: 1.2, type: "bandpass" });
  },
  train: (c, t) => { // le sifflet à vapeur : deux notes tenues, un peu voilées
    note(c, t, { freq: 392, dur: 1.1, type: "sawtooth", gain: 0.06, attaque: 0.12 });
    note(c, t, { freq: 466, dur: 1.1, type: "sawtooth", gain: 0.05, attaque: 0.14 });
    souffle(c, t, { dur: 1.2, gain: 0.05, coupe: 900, type: "bandpass", q: 1.5 });
  },
  goutte: (c, t) => { // gouttes d'eau isolées dans une grotte : plop montant
    for (const d of [0, 0.9, 1.5, 2.5]) note(c, t + d, { freq: 620, vers: 1500, dur: 0.09, type: "sine", gain: 0.11 });
  },
};

/** Joue un son mystère ; renvoie sa durée approximative en millisecondes. */
export function jouerSon(nom) {
  const c = audio();
  if (!c || !SONS[nom]) return 0;
  try { SONS[nom](c, c.currentTime + 0.05); } catch { return 0; }
  return DUREES[nom] ?? 2500;
}

/** Durée approximative de chaque son, pour rythmer l'écran sans le couper. */
export const DUREES = {
  sirene: 2700, cloche: 3600, tonnerre: 2700, pluie: 2700, galop: 2700,
  horloge: 4600, telephone: 3000, ressort: 1900, vaisseau: 1300,
  applaudissements: 3000, train: 1400, goutte: 2700,
};

/** Les questions du Son Mystère : l'énoncé, les propositions et le mot de la
 *  fin. Les leurres sont choisis dans la même famille sonore, pour qu'écouter
 *  serve vraiment — et jamais si proches que ce soit un piège. */
export const QUESTIONS_SON = [
  { son: "sirene", reponse: "Une sirène de pompiers", leurres: ["Une alarme d'école", "Un klaxon de camion", "Une bouilloire"],
    anecdote: "Les deux notes alternées portent bien plus loin qu'un son unique : c'est pour cela que toutes les sirènes de secours en jouent deux." },
  { son: "cloche", reponse: "Une cloche d'église", leurres: ["Un carillon de porte", "Un triangle d'orchestre", "Un verre qu'on entrechoque"],
    anecdote: "Une cloche ne fait pas une seule note : elle en sonne plusieurs à la fois, et c'est ce mélange qui lui donne sa voix." },
  { son: "tonnerre", reponse: "Le tonnerre", leurres: ["Une avalanche", "Un camion qui passe", "Une porte de garage"],
    anecdote: "Comptez les secondes entre l'éclair et le grondement, puis divisez par trois : vous avez la distance de l'orage en kilomètres." },
  { son: "pluie", reponse: "La pluie", leurres: ["Des applaudissements", "Une friture dans une poêle", "Le vent dans les feuilles"],
    anecdote: "Une goutte de pluie tombe à environ trente kilomètres par heure : bien plus lentement qu'on ne l'imagine." },
  { son: "galop", reponse: "Un cheval au galop", leurres: ["Quelqu'un qui monte un escalier", "Un tambour", "Des gouttes sur un toit"],
    anecdote: "Au galop, un cheval a les quatre pieds en l'air à chaque foulée — on l'a prouvé en 1878 avec des photos prises à la file." },
  { son: "horloge", reponse: "Une horloge qui sonne", leurres: ["Un métronome", "Un robinet qui goutte", "Un réveil électronique"],
    anecdote: "Le « tic-tac » est en fait deux fois le même bruit : notre oreille invente la différence entre le tic et le tac." },
  { son: "telephone", reponse: "Un téléphone qui sonne", leurres: ["Un minuteur de cuisine", "Une alarme incendie", "Un vélo qui klaxonne"],
    anecdote: "La sonnerie des vieux téléphones était produite par un vrai marteau frappant deux vraies clochettes de métal." },
  { son: "ressort", reponse: "Un ressort qui rebondit", leurres: ["Une balle qui rebondit", "Une machine à sous", "Un élastique qu'on lâche"],
    anecdote: "Un ressort qui rebondit monte dans les aigus à chaque saut : ses rebonds se rapprochent, donc le son s'accélère." },
  { son: "vaisseau", reponse: "Un tir de vaisseau spatial", leurres: ["Un jeu vidéo qui démarre", "Une porte automatique", "Un scanner de caisse"],
    anecdote: "Dans le vide de l'espace, aucun son ne se propage : ces bruits de tir sont une pure invention de cinéma." },
  { son: "applaudissements", reponse: "Des applaudissements", leurres: ["La pluie sur une vitre", "Un feu de bois", "Des pas dans le gravier"],
    anecdote: "Dans une salle, les applaudissements finissent souvent par se synchroniser tout seuls, sans que personne ne le décide." },
  { son: "train", reponse: "Un sifflet de train à vapeur", leurres: ["Une corne de bateau", "Un orgue", "Une bouilloire qui siffle"],
    anecdote: "Le sifflet à vapeur joue deux notes ensemble volontairement : l'accord est plus perçant qu'une note seule." },
  { son: "goutte", reponse: "Des gouttes d'eau", leurres: ["Une bulle qui éclate", "Un clavier", "Un galet jeté à l'eau"],
    anecdote: "Le « ploc » d'une goutte ne vient pas du choc : c'est une minuscule bulle d'air, piégée sous l'eau, qui vibre." },
];
