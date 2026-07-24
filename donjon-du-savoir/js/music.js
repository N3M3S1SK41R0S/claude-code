// Musique de fond PROCÉDURALE (Web Audio) — aucun fichier, hors-ligne, muetable.
// v2 « Le Barde du Donjon » : au lieu d'une boucle fixe, un petit barde
// GÉNÉRATIF improvise sans fin — progressions d'accords variées, mélodie
// pentatonique en marche aléatoire (aucune fausse note possible),
// orchestration qui évolue par sections (nappe, basse, arpège, clochettes),
// tempo et couleur qui respirent. Jamais deux fois le même chemin.
// Volume volontairement bas : une ambiance, jamais un premier plan.
// Désactivée par défaut ; activée via le bouton 🎵 de l'en-tête.

let ctx = null;
let master = null;
let filter = null;
let want = false;       // l'utilisateur veut-il la musique ?
let running = false;    // le séquenceur tourne-t-il ?
let timer = null;
let nextTime = 0;
let step = 0;

export function musicAvailable() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

export function musicEnabled() {
  return want;
}

function ensureCtx() {
  if (!musicAvailable()) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    try { ctx = new C(); } catch { return null; }
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600; // adoucit le timbre (modulé par section)
    master = ctx.createGain();
    master.gain.value = 0.0001;
    filter.connect(master).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/* ---------- briques sonores ---------- */

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const alea = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Humanisation : léger flottement de volume et de placement (un vrai barde).
const humGain = (g) => g * (0.8 + Math.random() * 0.4);
const humTime = (t) => t + (Math.random() - 0.5) * 0.014;

/** Sortie éventuellement pannée (léger placement stéréo par note). */
function out(pan) {
  if (ctx.createStereoPanner && pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(filter);
    return p;
  }
  return filter;
}

function tone(freq, t, dur, { type = "triangle", gain = 0.05, attack = 0.02, pan = 0 } = {}) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = Math.max(t, ctx.currentTime);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out(pan));
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const padChord = (notes, t, dur) => {
  for (const n of notes) tone(midi(n), t, dur, { gain: humGain(0.042), attack: 0.5, pan: -0.12 });
};
const bassNote = (n, t, dur) => tone(midi(n), t, dur, { type: "sine", gain: humGain(0.085), attack: 0.04 });
const pluck = (n, t, gain = 0.055) =>
  tone(midi(n), humTime(t), 0.5, { gain: humGain(gain), attack: 0.015, pan: (Math.random() - 0.5) * 0.5 });
const bell = (n, t) => tone(midi(n), humTime(t), 1.9, { type: "sine", gain: humGain(0.032), attack: 0.01, pan: 0.25 });

/* ---------- matière musicale (la mineur / do majeur : tout est consonant) ---------- */

// Accords diatoniques (MIDI : triade + basse à la fondamentale).
const CHORDS = {
  Am: { pad: [57, 60, 64], bass: 45 },
  F: { pad: [53, 57, 60], bass: 41 },
  C: { pad: [60, 64, 67], bass: 48 },
  G: { pad: [55, 59, 62], bass: 43 },
  Em: { pad: [52, 55, 59], bass: 40 },
  Dm: { pad: [50, 53, 57], bass: 38 },
};

// Progressions de 4 mesures, toutes interchangeables — le barde en change
// à chaque section, donc l'harmonie ne tourne jamais en rond.
const PROGRESSIONS = [
  ["Am", "F", "C", "G"],
  ["Am", "G", "F", "Em"],
  ["C", "G", "Am", "F"],
  ["F", "C", "G", "Am"],
  ["Am", "Em", "F", "G"],
  ["Dm", "Am", "G", "C"],
  ["Am", "F", "Dm", "G"],
];

// Vivier mélodique : pentatonique de la mineur sur deux octaves (MIDI).
const PENTA = [69, 72, 74, 76, 79, 81, 84];

// Grilles rythmiques de mélodie (croches actives dans une mesure de 8).
const RYTHMES = [
  [0, 3, 6],
  [0, 2, 4, 6],
  [1, 4],
  [0, 5],
  [2, 6],
  [0, 3, 4, 7],
];

// Motifs de basse : positions (croche) → durée relative.
const BASSES = [
  [[0, 3.2], [4, 2.4]],                 // fondamentale posée
  [[0, 2.2], [3, 1.6], [5, 2.2]],       // marche tranquille
  [[0, 5.6]],                            // longue tenue
];

const STEPS_PER_BAR = 8;   // croches
const SECTION_BARS = 8;    // une « scène » musicale = 8 mesures
const SECTION_STEPS = STEPS_PER_BAR * SECTION_BARS;

/* ---------- le barde : une section = une scène d'orchestration ---------- */

let section = null;
let melodyIdx = 3;   // position dans PENTA (marche aléatoire à mémoire)
let stepDur = 60 / 68 / 2;

/** Compose la prochaine scène : progression, tempo, couches, couleur. */
function newSection() {
  const bpm = 62 + Math.floor(Math.random() * 15); // 62-76 : ça respire
  stepDur = 60 / bpm / 2;
  section = {
    prog: alea(PROGRESSIONS),
    rythmeA: alea(RYTHMES),
    rythmeB: alea(RYTHMES),
    basse: alea(BASSES),
    // Orchestration : les couches vont et viennent (jamais toutes en même temps).
    arpege: Math.random() < 0.45,
    cloches: Math.random() < 0.35,
    melodieProb: 0.55 + Math.random() * 0.35,
    octaveHaut: Math.random() < 0.3, // mélodie une octave plus haut, parfois
  };
  // Couleur : le filtre glisse doucement vers sa nouvelle teinte.
  if (filter) {
    const cible = 1200 + Math.random() * 1100;
    filter.frequency.cancelScheduledValues(ctx.currentTime);
    filter.frequency.setValueAtTime(filter.frequency.value, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(cible, ctx.currentTime + 3);
  }
}

/** Prochaine note de mélodie : marche aléatoire douce, rappelée vers le centre. */
function nextMelodyNote() {
  const saut = alea([-2, -1, -1, 1, 1, 2]);
  melodyIdx = Math.max(0, Math.min(PENTA.length - 1, melodyIdx + saut));
  // Rappel doux vers le milieu du registre (évite de camper dans un coin).
  if (Math.random() < 0.25) melodyIdx = Math.max(1, Math.min(PENTA.length - 2, melodyIdx + (melodyIdx > 3 ? -1 : 1)));
  return PENTA[melodyIdx];
}

function scheduleStep(s, t) {
  if (s === 0 || !section) newSection();
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const chord = CHORDS[section.prog[bar % 4]];

  // Nappe : un accord tenu par mesure (voicing enrichi une fois sur quatre).
  if (inBar === 0) {
    const notes = Math.random() < 0.25 ? [...chord.pad, chord.pad[0] + 12] : chord.pad;
    padChord(notes, t, stepDur * STEPS_PER_BAR * 0.98);
  }
  // Basse : le motif de la section.
  for (const [pos, len] of section.basse) {
    if (inBar === pos) bassNote(chord.bass, t, stepDur * len);
  }
  // Arpège cristallin : notes de l'accord égrenées sur les contretemps.
  if (section.arpege && inBar % 2 === 1 && Math.random() < 0.7) {
    pluck(chord.pad[(bar + (inBar >> 1)) % chord.pad.length] + 12, t, 0.035);
  }
  // Mélodie improvisée : grille rythmique (deux motifs alternés) + marche aléatoire.
  const grille = bar % 2 === 0 ? section.rythmeA : section.rythmeB;
  if (grille.includes(inBar) && Math.random() < section.melodieProb) {
    const n = nextMelodyNote() + (section.octaveHaut ? 12 : 0);
    pluck(n, t + stepDur * 0.02);
  }
  // Clochettes rares : un éclat aigu qui traîne, une fois par mesure au plus.
  if (section.cloches && inBar === 6 && Math.random() < 0.3) {
    bell(alea(PENTA) + 12, t);
  }
  // Cadence de fin de section : trois notes descendantes, comme une révérence.
  if (bar === SECTION_BARS - 1 && inBar >= 5 && Math.random() < 0.8) {
    pluck(PENTA[Math.max(0, 6 - (inBar - 5) * 2)], t, 0.045);
  }
}

function scheduler() {
  if (!running || !ctx) return;
  const ahead = ctx.currentTime + 0.3;
  while (nextTime < ahead) {
    scheduleStep(step, nextTime);
    nextTime += stepDur;
    step = (step + 1) % SECTION_STEPS;
  }
}

function startLoop() {
  if (running || !ensureCtx()) return;
  running = true;
  step = 0;
  section = null; // nouvelle scène à chaque reprise
  nextTime = ctx.currentTime + 0.1;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 2.0); // fondu d'entrée
  timer = window.setInterval(scheduler, 60);
  scheduler();
}

function stopLoop() {
  if (!running) return;
  running = false;
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); // fondu de sortie
  }
}

/** Active/coupe la musique (persistée par l'appelant). Démarre le contexte audio
 *  sur le geste utilisateur ; si activée sans geste (au chargement), un écouteur
 *  unique la lance à la première interaction. */
export function setMusic(on) {
  want = !!on;
  if (want) {
    if (ensureCtx() && ctx.state === "running") startLoop();
    else armGesture();
  } else {
    stopLoop();
  }
}

let armed = false;
function armGesture() {
  if (armed) return;
  armed = true;
  const go = () => {
    armed = false;
    document.removeEventListener("pointerdown", go);
    document.removeEventListener("keydown", go);
    if (want) { ensureCtx(); startLoop(); }
  };
  document.addEventListener("pointerdown", go, { once: true });
  document.addEventListener("keydown", go, { once: true });
}
