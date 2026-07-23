// Optional narration via the browser's own speech synthesis (Web Speech API).
// No external service, no recording, no impersonation — a generic fr-FR
// voice with a slightly theatrical profile for the Héraut.

let enabled = false;

export function setVoice(on) {
  enabled = on;
  if (!on) stop();
}

export function voiceEnabled() {
  return enabled;
}

export function voiceAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stop() {
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

/** Dit un texte. Un profil { pitch, rate, v } donne une voix propre au
 *  personnage (défaut : le timbre du Héraut). `queue:true` n'annule pas ce qui
 *  parle déjà (pour enchaîner Héraut puis réplique de héros). */
export function say(text, { pitch = 1.05, rate = 0.95, v = 0, queue = false } = {}) {
  if (!enabled || !voiceAvailable() || !text) return;
  const synth = window.speechSynthesis;
  if (!queue) synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fr-FR";
  utter.pitch = pitch;
  utter.rate = rate;
  const fr = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("fr"));
  if (fr.length > 0) utter.voice = fr[v % fr.length];
  synth.speak(utter);
}

// Voix d'ANIMATEUR (maître de jeu télé, plein d'entrain, jamais l'imitation
// d'une personne réelle) : timbre vif, débit enlevé. Lit les questions puis les
// anecdotes avec une petite accroche qui change à chaque fois.
const HOST = { pitch: 1.12, rate: 1.03, v: 0 };
const INTRO_Q = [
  "Attention, question !", "À vous de jouer !", "Ouvrez grand les oreilles…",
  "Roulement de tambour…", "Alors, alors…", "Celle-là, elle est belle !",
];
const INTRO_A = [
  "Et maintenant, l'anecdote !", "Le saviez-vous ?", "Minute culture !",
  "Accrochez-vous…", "Et l'anecdote qui tue…", "Petit bonus de savoir…",
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** L'animateur lit un texte à voix haute, précédé d'une accroche selon le type
 *  ("question" ou "anecdote"). Ne fait rien si le Héraut vocal est coupé. */
export function sayHost(text, kind = null) {
  if (!enabled || !text) return;
  const intro = kind === "question" ? pick(INTRO_Q) : kind === "anecdote" ? pick(INTRO_A) : null;
  say(intro ? `${intro} ${text}` : text, HOST);
}

export function warmVoices() {
  if (!voiceAvailable()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
