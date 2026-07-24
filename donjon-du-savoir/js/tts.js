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

function hostProfile(kind) {
  return kind === "anecdote"
    ? { ...HOST_PROFILE, pitch: 1.03, rate: 0.96 }
    : { ...HOST_PROFILE, pitch: 1.08, rate: 0.99 };
}

/** Dit les accroches restantes avec le texte variable quand le codec ou
 *  l'autoplay refuse un clip. La réaction reste donc audible même sans Opus. */
function speakCueFallback(cues, startIndex, spokenText, host, token) {
  if (token !== speechToken) return;
  activeAudio = null;
  const remaining = cues.slice(startIndex).map((cue) => cue.text).filter(Boolean);
  say([...remaining, spokenText].join(" "), host);
}

/** Joue une suite d'accroches enregistrées, puis passe la main à Web Speech.
 *  Une réponse produit ainsi : réaction → lancement d'anecdote → anecdote. */
function cueSequenceThenSpeak(cues, text, kind, token) {
  const spokenText = speechText(text, kind);
  const host = hostProfile(kind);
  const playAt = (index) => {
    if (token !== speechToken) return;
    if (index >= cues.length) {
      activeAudio = null;
      say(spokenText, host);
      return;
    }
    if (!audioCueAvailable()) {
      speakCueFallback(cues, index, spokenText, host, token);
      return;
    }

    const cue = cues[index];
    const audio = new Audio(cue.src);
    activeAudio = audio;
    audio.preload = "auto";
    audio.volume = 0.88;
    let handedOff = false;
    const advance = () => {
      if (handedOff || token !== speechToken) return;
      handedOff = true;
      activeAudio = null;
      playAt(index + 1);
    };
    const fallback = () => {
      if (handedOff || token !== speechToken) return;
      handedOff = true;
      speakCueFallback(cues, index, spokenText, host, token);
    };
    audio.addEventListener("ended", advance, { once: true });
    audio.addEventListener("error", fallback, { once: true });
    try {
      const playback = audio.play();
      if (playback?.catch) playback.catch(fallback);
    } catch {
      fallback();
    }
  };
  playAt(0);
}

/** L'animateur lit un texte à voix haute, précédé d'une accroche selon le type
 *  ("question" ou "anecdote"). Une anecdote peut être précédée de la réaction
 *  enregistrée "bonne" ou "mauvaise". Ne fait rien si le Héraut est coupé. */
export function sayHost(text, kind = null, { reaction = null } = {}) {
  if (!enabled || !text || !voiceAvailable()) return;
  stop();
  const token = speechToken;
  const cues = [];
  if (reaction === "bonne" || reaction === "mauvaise") {
    const reactionCue = pickHostCue(reaction);
    if (reactionCue) cues.push(reactionCue);
  }
  const cue = kind === "question" || kind === "anecdote" ? pickHostCue(kind) : null;
  if (cue) cues.push(cue);
  cueSequenceThenSpeak(cues, text, kind, token);
}

export function warmVoices() {
  if (!voiceAvailable()) return;
  frenchVoices(window.speechSynthesis);
  window.speechSynthesis.onvoiceschanged = () => frenchVoices(window.speechSynthesis);
}
