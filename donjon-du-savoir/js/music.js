// Musique de fond PROCÉDURALE (Web Audio) — aucun fichier, hors-ligne, muetable.
// Une boucle douce et chaleureuse « donjon de conte » : nappe d'accords + basse
// paisible + arpège cristallin épars, en la mineur pentatonique (aucune fausse
// note possible). Volume volontairement bas : c'est une ambiance, jamais un
// premier plan. Désactivée par défaut ; activée via le bouton 🎵 de l'en-tête.

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
    filter.frequency.value = 1600; // adoucit le timbre
    master = ctx.createGain();
    master.gain.value = 0.0001;
    filter.connect(master).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/* ---------- briques sonores ---------- */

function padChord(freqs, t, dur) {
  const c = ctx;
  for (const f of freqs) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.5);       // attaque lente
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);      // longue extinction
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function bass(freq, t, dur) {
  const c = ctx;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(filter);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function pluck(freq, t) {
  const c = ctx;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  osc.connect(g).connect(filter);
  osc.start(t);
  osc.stop(t + 0.55);
}

/* ---------- partition (la mineur : Am – F – C – G) ---------- */

// Accords (nappe) par mesure, basse à la fondamentale.
const CHORDS = [
  { pad: [220.0, 261.63, 329.63], bass: 110.0 }, // Am  (A3 C4 E4 / A2)
  { pad: [174.61, 220.0, 261.63], bass: 87.31 }, // F   (F3 A3 C4 / F2)
  { pad: [261.63, 329.63, 392.0], bass: 130.81 }, // C  (C4 E4 G4 / C3)
  { pad: [196.0, 246.94, 293.66], bass: 98.0 },  // G   (G3 B3 D4 / G2)
];
// Vivier pentatonique pour l'arpège cristallin (A C D E G, aigus).
const PENTA = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

const STEPS_PER_BAR = 8;       // croches
const BARS = CHORDS.length;    // 4 mesures
const TOTAL = STEPS_PER_BAR * BARS;
const BPM = 68;
const STEP_DUR = 60 / BPM / 2; // durée d'une croche

// Mélodie éparse déterministe (pas de hasard : douce et reproductible), un motif
// par mesure sur quelques croches choisies.
const MELODY_HITS = new Set([0, 3, 6, 9, 12, 14, 17, 20, 22, 25, 28, 30]);

function scheduleStep(s, t) {
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const chord = CHORDS[bar];
  if (inBar === 0) {
    padChord(chord.pad, t, STEP_DUR * STEPS_PER_BAR * 0.98);
    bass(chord.bass, t, STEP_DUR * 3.2);
  } else if (inBar === 4) {
    bass(chord.bass, t, STEP_DUR * 2.4);
  }
  if (MELODY_HITS.has(s)) {
    // note pentatonique liée à la position (motif montant/descendant doux)
    const idx = (s * 3 + bar * 2) % PENTA.length;
    pluck(PENTA[idx], t + STEP_DUR * 0.02);
  }
}

function scheduler() {
  if (!running || !ctx) return;
  const ahead = ctx.currentTime + 0.28;
  while (nextTime < ahead) {
    scheduleStep(step, nextTime);
    nextTime += STEP_DUR;
    step = (step + 1) % TOTAL;
  }
}

function startLoop() {
  if (running || !ensureCtx()) return;
  running = true;
  step = 0;
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
