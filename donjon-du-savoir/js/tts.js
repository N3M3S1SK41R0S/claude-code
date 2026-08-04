import { clipEnCours, clipFor, playClip, stopClips } from "./voiceclips.js";
import { directEnCours, lireEnDirect, stopDirect, voixDirectActif } from "./voixdirect.js";
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

/** Coupe tous les CANAUX (accroche, clips, voix directe, synthèse) sans
 *  toucher à la file d'attente — la coupure interne de l'arbitre. */
function silence() {
  speechToken += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  stopClips(); // les répliques enregistrées aussi : le silence est total
  stopDirect();
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

/** La coupure PUBLIQUE : l'écran a tourné, on coupe tout ET les paroles en
 *  attente n'ont plus d'objet. */
export function stop() {
  silence();
  videFileParole();
}

/** Dit un texte. Un profil { pitch, rate, v } donne une voix propre au
 *  personnage (défaut : le timbre du Héraut). `queue:true` n'annule pas ce qui
 *  parle déjà (pour enchaîner Héraut puis réplique de héros). */
// Karaoké : un abonné unique reçoit (charIndex, texteDeLUtterance) à chaque
// frontière de mot — le panneau de question surligne le mot lu.
let boundaryCb = null;
export function onSpeechBoundary(cb) { boundaryCb = cb; }

// ANTI-SACCADE : Chrome met la synthèse en pause au milieu des phrases longues
// (bug connu du moteur) — un resume() périodique pendant la lecture la remet
// en selle sans effet audible ailleurs. C'est LA cause classique du débit haché.
let keepAliveTimer = null;
function keepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.resume();
    else { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  }, 5000);
}

export function say(text, {
  pitch = 1.05,
  rate = 1.02,
  volume = 1,
  lang = "fr-FR",
  v = 0,
  queue = false,
  preferredVoiceHints = [],
  perso = null,
  force = false,
} = {}) {
  // `force` : lecture DEMANDÉE par un bouton (ex. « écouter les règles ») —
  // elle passe outre le Héraut muet, sans changer le réglage de la tablée.
  if ((!enabled && !force) || !voiceAvailable() || !text) return;
  // UNE seule voie de sortie : la réplique choisit son canal AU MOMENT de
  // parler — clip enregistré d'abord, voix ElevenLabs en direct pour la voix
  // du jeu (règles de question, annonces, textes interpolés du Héraut),
  // synthèse du navigateur en filet. Les héros gardent leur timbre propre.
  const voixDuJeu = !perso || perso === "heraut";
  const canal = () => {
    if (perso && playClip(perso, text)) return;
    if (voixDuJeu && voixDirectActif()
      && lireEnDirect(text, { onEchec: () => diseEnSynthese(text, { pitch, rate, volume, lang, v, preferredVoiceHints }) })) return;
    diseEnSynthese(text, { pitch, rate, volume, lang, v, preferredVoiceHints });
  };
  // `queue:true` : la réplique prend sa place dans la FILE et ne démarre qu'au
  // silence TOTAL (anecdote comprise) — jamais par-dessus quelqu'un.
  if (queue) { direQuand(canal); return; }
  stop(); // le jeu enchaîne : on coupe TOUT — une seule bouche à la fois
  canal();
}

function diseEnSynthese(text, { pitch = 1.05, rate = 1.02, volume = 1, lang = "fr-FR", v = 0, preferredVoiceHints = [] } = {}) {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  // Micro-variations de hauteur et de débit : deux lectures identiques ne
  // sonnent jamais EXACTEMENT pareil — l'oreille y lit de la vie, pas du robot.
  utter.pitch = Math.max(0.5, pitch + (Math.random() * 0.05 - 0.025));
  utter.rate = Math.max(0.5, rate * (0.985 + Math.random() * 0.035));
  utter.volume = volume;
  const fr = frenchVoices(synth);
  if (fr.length > 0) utter.voice = preferredVoice(fr, preferredVoiceHints, v);
  utter.onboundary = (e) => { try { boundaryCb?.(e.charIndex ?? 0, text); } catch { /* jamais bloquant */ } };
  synth.speak(utter);
  keepAlive();
}

function frenchVoices(synth) {
  const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("fr"));
  if (voices.length > 0) cachedFrenchVoices = voices;
  return voices.length > 0 ? voices : cachedFrenchVoices;
}

/** Privilégie une voix française locale/naturelle quand le navigateur en offre
 *  plusieurs, avec un index stable comme repli pour les profils de personnages.
 *  Les voix HAUT DE GAMME connues (Siri améliorées, Google, Microsoft) sont
 *  favorisées nommément ; les moteurs robotiques (eSpeak, variantes
 *  « compact » iOS) sont pénalisés : c'est le premier levier d'humanisation. */
const VOIX_SOIGNEES = ["audrey", "amélie", "amelie", "thomas", "marie", "denise", "henri", "vivienne", "eloise", "google français", "google french", "chantal"];
const VOIX_ROBOTS = ["espeak", "eloquence", "compact", "flo ", "grandma", "grandpa", "albert", "jacques", "zarvox"];
function preferredVoice(voices, hints, fallbackIndex) {
  const scored = voices.map((voice, index) => {
    const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    const hintScore = hints.reduce((sum, hint) => sum + (haystack.includes(hint) ? 8 : 0), 0);
    const soigneeScore = VOIX_SOIGNEES.some((n) => haystack.includes(n)) ? 10 : 0;
    const robotScore = VOIX_ROBOTS.some((n) => haystack.includes(n)) ? -24 : 0;
    const premiumScore = /premium|enhanced|améliorée|amelioree|natural|neural/.test(haystack) ? 12 : 0;
    const localScore = voice.localService === false ? -6 : 4;
    const exactFrench = voice.lang.toLowerCase() === "fr-fr" ? 3 : 0;
    return { voice, index, score: hintScore + soigneeScore + robotScore + premiumScore + localScore + exactFrench };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  if (scored[0]?.score > 0) return scored[0].voice;
  return voices[fallbackIndex % voices.length];
}

/** Rend la ponctuation plus naturelle sans modifier le sens de la question :
 *  les tirets, points-virgules et symboles muets deviennent des respirations
 *  courtes — moins d'arrêts mécaniques, plus de phrasé. */
function speechText(text, kind) {
  const clean = String(text)
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "") // un emoji lu à voix haute casse tout
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " ou ")
    .replace(/\(([^)]+)\)/g, ", $1,")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*;\s*/g, ", ")
    .replace(/[«»"]/g, "")
    .replace(/\s*\.{3}\s*/g, "… ")
    .replace(/,\s*,/g, ",")
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
 *  absent ou d'autoplay refusé, la même accroche est dite par Web Speech.
 *  La VRAIE voix du Héraut (banque de clips MP3) prime sur l'accroche WebM
 *  de synthèse dès qu'elle existe pour ce texte. */
function cueThenSpeak(cue, text, kind, token) {
  const spokenText = speechText(text, kind);
  // Tempo VIF demandé à la table : une question se lit d'un trait (1.07),
  // l'anecdote garde un rien de gourmandise (1.02) — jamais de lenteur.
  const host = kind === "anecdote"
    ? { ...HOST_PROFILE, pitch: 1.03, rate: 1.02 }
    : { ...HOST_PROFILE, pitch: 1.06, rate: 1.07 };
  // Le texte VARIABLE part vers la voix ElevenLabs EN DIRECT quand l'option
  // est armée (cache définitif sur l'appareil) ; sinon — ou au moindre pépin
  // réseau — la synthèse du navigateur assure, comme toujours.
  const direTexte = (avecAccroche) => {
    const t = `${avecAccroche && cue?.text ? `${cue.text} ` : ""}${spokenText}`;
    // Synthèse DIRECTE (pas say) : les canaux sont déjà à nous, et la file
    // d'attente (propositions, anecdote…) doit survivre à cette lecture.
    if (voixDirectActif() && lireEnDirect(t, { onEchec: () => { if (token === speechToken) diseEnSynthese(t, host); } })) return;
    diseEnSynthese(t, host);
  };
  const fallback = () => {
    if (token !== speechToken) return;
    activeAudio = null;
    direTexte(true);
  };
  const clip = cue ? clipFor("heraut", cue.text) : null; // MP3 : lisible partout
  if (!cue || (!clip && !audioCueAvailable())) return fallback();

  const audio = new Audio(clip ?? cue.src);
  activeAudio = audio;
  audio.preload = "auto";
  audio.volume = 0.88;
  let handedOff = false;
  const handOff = (includeCue) => {
    if (handedOff || token !== speechToken) return;
    handedOff = true;
    activeAudio = null;
    direTexte(includeCue);
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
  // silence() et non stop() : quand la question arrive PAR la file, les
  // répliques déjà en attente (propositions, anecdote) gardent leur tour.
  silence();
  const token = speechToken;
  const cue = kind === "question" || kind === "anecdote" ? pickHostCue(kind) : null;
  cueThenSpeak(cue, text, kind, token);
}

/** L'ARBITRE DE PAROLE : vrai si QUELQU'UN parle, tous canaux confondus —
 *  clip enregistré, accroche, lecture en direct ou synthèse. */
export function parleEnCours() {
  return activeAudio !== null || clipEnCours() || directEnCours()
    || (voiceAvailable() && window.speechSynthesis.speaking);
}

/** FILE DE PAROLE ordonnée : chaque prise de parole s'exécute au prochain
 *  silence total, DANS L'ORDRE de dépôt (réaction → question → propositions →
 *  anecdote), avec un plafond anti-blocage — jamais coincé, jamais
 *  chevauché. stop() vide la file (l'écran a tourné). */
let fileParole = [];
let fileTimer = null;
let fileDebut = 0;
// Le plafond couvre la PLUS LONGUE lecture légitime (une anecdote copieuse en
// synthèse) : il ne sert qu'à débloquer un canal qui se croit occupé à tort.
const PLAFOND_PAROLE_MS = 30000;
function draineFile() {
  if (fileTimer) return;
  fileDebut = Date.now();
  fileTimer = setInterval(() => {
    if (!fileParole.length) { clearInterval(fileTimer); fileTimer = null; return; }
    if (!parleEnCours() || Date.now() - fileDebut > PLAFOND_PAROLE_MS) {
      if (parleEnCours()) silence(); // débloqué en COUPANT — jamais par-dessus
      const cb = fileParole.shift();
      fileDebut = Date.now();
      try { cb(); } catch { /* la parole suivante ne meurt jamais d'une erreur */ }
    }
  }, 150);
}
export function direQuand(cb) {
  if (!parleEnCours() && fileParole.length === 0) { cb(); return; }
  fileParole.push(cb);
  draineFile();
}
export function videFileParole() {
  fileParole = [];
}

export function warmVoices() {
  if (!voiceAvailable()) return;
  frenchVoices(window.speechSynthesis);
  window.speechSynthesis.onvoiceschanged = () => frenchVoices(window.speechSynthesis);
}
