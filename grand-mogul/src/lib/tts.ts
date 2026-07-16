import { CAST_BY_ID } from "./cast";
import { idb, idbAvailable } from "./db";
import { audioKey } from "./hash";
import type { CastId, VoiceProfile } from "./types";

export type Speaker = CastId | "mogul";

/** Host voice: grave, slow-ironic (spec: pitch 0.9). */
const MOGUL_VOICE: VoiceProfile = { pitch: 0.9, rate: 0.92 };

function profileFor(speaker: Speaker): VoiceProfile {
  return speaker === "mogul" ? MOGUL_VOICE : CAST_BY_ID[speaker].voice;
}

let muted = false;
export function setMuted(m: boolean): void {
  muted = m;
  if (m) stop();
}

/** Once ElevenLabs answers 503/501 (no key), stop trying for the session. */
let elevenAvailable: boolean | null = null;

/**
 * Cancellation generation: stop() bumps it, and every async step of a speech
 * chain re-checks it, so a line whose TTS fetch is still in flight when the
 * turn changes is dropped instead of playing stale audio later.
 */
let generation = 0;

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

/** Silence whatever is playing right now, without cancelling pending chains. */
function haltPlayback(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Cancel current playback AND every in-flight speech chain. */
export function stop(): void {
  generation += 1;
  haltPlayback();
}

async function playBlob(blob: Blob, gen: number): Promise<void> {
  if (gen !== generation) return;
  haltPlayback();
  await new Promise<void>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;
    const done = () => {
      if (currentUrl === url) {
        URL.revokeObjectURL(url);
        currentUrl = null;
      }
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

async function speakEleven(text: string, speaker: Speaker, gen: number): Promise<boolean> {
  if (elevenAvailable === false) return false;
  try {
    const key = idbAvailable() ? await audioKey(speaker, text) : null;
    if (gen !== generation) return true; // cancelled: swallow, don't fall back
    if (key) {
      const cached = await idb.get<{ key: string; blob: Blob }>("audio", key);
      if (gen !== generation) return true;
      if (cached?.blob) {
        elevenAvailable = true;
        await playBlob(cached.blob, gen);
        return true;
      }
    }
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!res.ok) {
      if (res.status === 503 || res.status === 501) elevenAvailable = false;
      return false;
    }
    const blob = await res.blob();
    if (gen !== generation) return true;
    elevenAvailable = true;
    // Audio sprite cache: same line never fetched twice.
    if (key) idb.put("audio", { key, blob }).catch(() => {});
    await playBlob(blob, gen);
    return true;
  } catch {
    return false;
  }
}

function speakWebSpeech(text: string, speaker: Speaker, gen: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve(false);
    if (gen !== generation) return resolve(true);
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const profile = profileFor(speaker);
    utter.lang = "fr-FR";
    utter.pitch = profile.pitch;
    utter.rate = profile.rate;
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
    if (voices.length > 0) utter.voice = voices[0] as SpeechSynthesisVoice;
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    synth.speak(utter);
    // Safari sometimes never fires onend for cancelled utterances.
    setTimeout(() => resolve(true), Math.min(20000, 300 * text.length));
  });
}

/**
 * Speak a line with the character's voice profile.
 * Chain: ElevenLabs (if key configured server-side) → Web Speech API → silence.
 * Never throws, never blocks gameplay on failure; stop() cancels it even
 * while its network fetch is still pending.
 */
export async function speak(text: string, speaker: Speaker = "mogul"): Promise<void> {
  if (muted || !text || typeof window === "undefined") return;
  const gen = generation;
  const viaEleven = await speakEleven(text, speaker, gen);
  if (gen !== generation) return;
  if (!viaEleven) await speakWebSpeech(text, speaker, gen);
}

/** Warm the fr-FR voice list (Chrome loads it async). */
export function warmVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
