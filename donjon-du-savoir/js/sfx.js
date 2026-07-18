// Effets sonores SYNTHÉTISÉS (Web Audio) — aucun fichier, hors-ligne, muetables.
// De petits bips joyeux qui ponctuent les moments clés, jamais envahissants.
// Désactivés par défaut ; l'utilisateur les active via le bouton 🔊 de l'en-tête.

let ctx = null;
let enabled = false;

export function sfxAvailable() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

export function setSfx(on) {
  enabled = !!on;
  if (enabled) audio(); // débloque le contexte audio sur le geste utilisateur
}

export function sfxEnabled() {
  return enabled;
}

function audio() {
  if (!enabled || !sfxAvailable()) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Une note enveloppée (attack/decay court) — brique de tous les effets. */
function tone(freq, dur, { type = "sine", gain = 0.14, delay = 0, sweep = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const SFX = {
  dice: () => { tone(200, 0.05, { type: "square", gain: 0.06 }); tone(280, 0.05, { type: "square", gain: 0.06, delay: 0.06 }); },
  coin: () => { tone(880, 0.07, { type: "triangle", gain: 0.11 }); tone(1320, 0.1, { type: "triangle", gain: 0.09, delay: 0.05 }); },
  good: () => { tone(523, 0.1, { gain: 0.11 }); tone(659, 0.1, { gain: 0.11, delay: 0.08 }); tone(784, 0.16, { gain: 0.11, delay: 0.16 }); },
  bad: () => { tone(240, 0.22, { type: "sawtooth", gain: 0.09, sweep: -120 }); },
  star: () => { tone(659, 0.09, { gain: 0.11 }); tone(988, 0.09, { gain: 0.11, delay: 0.08 }); tone(1319, 0.22, { type: "triangle", gain: 0.11, delay: 0.16 }); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.13, delay: i * 0.13 })); },
  malus: () => { tone(320, 0.2, { type: "sawtooth", gain: 0.09, sweep: -180 }); },
};

/** Joue un effet nommé ; silencieux si désactivé ou si l'audio est indisponible. */
export function sfx(name) {
  try { SFX[name]?.(); } catch { /* audio non autorisé dans ce contexte */ }
}
