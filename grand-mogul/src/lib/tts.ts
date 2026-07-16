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

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stop(): void {
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

async function playBlob(blob: Blob): Promise<void> {
  stop();
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

async function speakEleven(text: string, speaker: Speaker): Promise<boolean> {
  if (elevenAvailable === false) return false;
  try {
    const key = idbAvailable() ? await audioKey(speaker, text) : null;
    if (key) {
      const cached = await idb.get<{ key: string; blob: Blob }>("audio", key);
      if (cached?.blob) {
        elevenAvailable = true;
        await playBlob(cached.blob);
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
    elevenAvailable = true;
    // Audio sprite cache: same line never fetched twice.
    if (key) idb.put("audio", { key, blob }).catch(() => {});
    await playBlob(blob);
    return true;
  } catch {
    return false;
  }
}

function speakWebSpeech(text: string, speaker: Speaker): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve(false);
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
 * Never throws, never blocks gameplay on failure.
 */
export async function speak(text: string, speaker: Speaker = "mogul"): Promise<void> {
  if (muted || !text || typeof window === "undefined") return;
  const viaEleven = await speakEleven(text, speaker);
  if (!viaEleven) await speakWebSpeech(text, speaker);
}

/** Warm the fr-FR voice list (Chrome loads it async). */
export function warmVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
