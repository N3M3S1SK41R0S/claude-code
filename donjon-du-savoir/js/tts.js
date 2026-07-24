// Narration locale : accroches Opus embarquées + synthèse vocale du navigateur
// pour le texte variable des questions et anecdotes. Aucun service réseau,
// aucun clonage et aucune imitation de personne réelle.
import { HOST_PROFILE, pickHostCue } from "./host-voice.js";

let enabled = false;
let activeAudio = null;
let speechToken = 0;
let cachedFrenchVoices = [];

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
  speechToken += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

/** Dit un texte. Un profil { pitch, rate, v } donne une voix propre au
 *  personnage (défaut : le timbre du Héraut). `queue:true` n'annule pas ce qui
 *  parle déjà (pour enchaîner Héraut puis réplique de héros). */
export function say(text, {
  pitch = 1.05,
  rate = 0.95,
  volume = 1,
  lang = "fr-FR",
  v = 0,
  queue = false,
  preferredVoiceHints = [],
} = {}) {
  if (!enabled || !voiceAvailable() || !text) return;
  const synth = window.speechSynthesis;
  if (!queue) synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.pitch = pitch;
  utter.rate = rate;
  utter.volume = volume;
  const fr = frenchVoices(synth);
  if (fr.length > 0) utter.voice = preferredVoice(fr, preferredVoiceHints, v);
  synth.speak(utter);
}

function frenchVoices(synth) {
  const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("fr"));
  if (voices.length > 0) cachedFrenchVoices = voices;
  return voices.length > 0 ? voices : cachedFrenchVoices;
}

/** Privilégie une voix française locale/naturelle quand le navigateur en offre
 *  plusieurs, avec un index stable comme repli pour les profils de personnages. */
function preferredVoice(voices, hints, fallbackIndex) {
  const scored = voices.map((voice, index) => {
    const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    const hintScore = hints.reduce((sum, hint) => sum + (haystack.includes(hint) ? 8 : 0), 0);
    const localScore = voice.localService === false ? -6 : 4;
    const exactFrench = voice.lang.toLowerCase() === "fr-fr" ? 3 : 0;
    return { voice, index, score: hintScore + localScore + exactFrench };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  if (scored[0]?.score > 0) return scored[0].voice;
  return voices[fallbackIndex % voices.length];
}

/** Rend la ponctuation plus naturelle sans modifier le sens de la question. */
function speechText(text, kind) {
  const clean = String(text)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " ou ")
    .replace(/\(([^)]+)\)/g, ", $1,")
    .trim();
  if (kind === "question" && !/[?!.…]$/.test(clean)) return `${clean} ?`;
  return clean;
}

function audioCueAvailable() {
  if (typeof Audio === "undefined" || typeof document === "undefined") return false;
  const audio = document.createElement("audio");
  return audio.canPlayType?.('audio/webm; codecs="opus"') !== "";
}

/** Joue l'accroche enregistrée puis passe la main à Web Speech. En cas de codec
 *  absent ou d'autoplay refusé, la même accroche est dite par Web Speech. */
function cueThenSpeak(cue, text, kind, token) {
  const spokenText = speechText(text, kind);
  const host = kind === "anecdote"
    ? { ...HOST_PROFILE, pitch: 1.03, rate: 0.96 }
    : { ...HOST_PROFILE, pitch: 1.08, rate: 0.99 };
  const fallback = () => {
    if (token !== speechToken) return;
    activeAudio = null;
    say(`${cue?.text ? `${cue.text} ` : ""}${spokenText}`, host);
  };
  if (!cue || !audioCueAvailable()) return fallback();

  const audio = new Audio(cue.src);
  activeAudio = audio;
  audio.preload = "auto";
  audio.volume = 0.88;
  let handedOff = false;
  const handOff = (includeCue) => {
    if (handedOff || token !== speechToken) return;
    handedOff = true;
    activeAudio = null;
    say(`${includeCue ? `${cue.text} ` : ""}${spokenText}`, host);
  };
  audio.addEventListener("ended", () => handOff(false), { once: true });
  audio.addEventListener("error", () => handOff(true), { once: true });
  const play = audio.play();
  if (play?.catch) play.catch(() => handOff(true));
}

/** L'animateur lit un texte à voix haute, précédé d'une accroche selon le type
 *  ("question" ou "anecdote"). Ne fait rien si le Héraut vocal est coupé. */
export function sayHost(text, kind = null) {
  if (!enabled || !text || !voiceAvailable()) return;
  stop();
  const token = speechToken;
  const cue = kind === "question" || kind === "anecdote" ? pickHostCue(kind) : null;
  cueThenSpeak(cue, text, kind, token);
}

export function warmVoices() {
  if (!voiceAvailable()) return;
  frenchVoices(window.speechSynthesis);
  window.speechSynthesis.onvoiceschanged = () => frenchVoices(window.speechSynthesis);
}
