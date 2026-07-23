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

export function warmVoices() {
  if (!voiceAvailable()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
