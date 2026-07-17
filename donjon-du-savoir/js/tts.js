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

export function say(text) {
  if (!enabled || !voiceAvailable() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fr-FR";
  utter.pitch = 1.05;
  utter.rate = 0.95;
  const fr = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (fr.length > 0) utter.voice = fr[0];
  synth.speak(utter);
}

export function warmVoices() {
  if (!voiceAvailable()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
