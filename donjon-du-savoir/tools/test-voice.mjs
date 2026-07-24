// Contrat statique du lot voix : manifeste, fichiers, inlining et précache.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST_CUES, pickHostCue, resetHostCues } from "../js/host-voice.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path));
const text = (path) => read(path).toString("utf8");
const manifest = JSON.parse(text("data/voix.json"));
const hostModule = text("js/host-voice.js");
const worker = text("sw.js");
const builder = text("tools/build-standalone.mjs");
const game = text("js/game.js");

assert.equal(manifest.version, 1);
assert.equal(manifest.langue, "fr-FR");
assert.equal(manifest.clips.length, 36);
assert.deepEqual(
  Object.fromEntries(
    ["question", "anecdote", "bonne", "mauvaise"].map((kind) => [
      kind,
      manifest.clips.filter((clip) => clip.categorie === kind).length,
    ]),
  ),
  { question: 12, anecdote: 12, bonne: 6, mauvaise: 6 },
);

const ids = new Set();
let totalBytes = 0;
for (const clip of manifest.clips) {
  assert(!ids.has(clip.id), `identifiant dupliqué : ${clip.id}`);
  ids.add(clip.id);
  assert.match(clip.texte, /\S/);
  assert.match(clip.fichier, /^assets\/voix\/[a-z]+-\d{2}\.webm$/);
  assert(!clip.fichier.includes("http"), `chemin réseau interdit : ${clip.fichier}`);
  assert(hostModule.includes(`"${clip.fichier}"`), `chemin non littéral : ${clip.fichier}`);
  assert(worker.includes(`"./${clip.fichier}"`), `fichier absent du SHELL : ${clip.fichier}`);
  const absolute = join(root, clip.fichier);
  const bytes = statSync(absolute).size;
  assert(bytes > 4_000, `clip vide ou tronqué : ${clip.fichier}`);
  totalBytes += bytes;
  const magic = readFileSync(absolute).subarray(0, 4);
  assert.deepEqual([...magic], [0x1a, 0x45, 0xdf, 0xa3], `WebM invalide : ${clip.fichier}`);
}

assert(totalBytes < 400 * 1024, `budget voix dépassé : ${Math.round(totalBytes / 1024)} Ko`);
assert(builder.includes('webm: "audio/webm;codecs=opus"'));
assert(builder.includes('"host-voice", "tts"'));
assert.match(worker, /const VERSION = "donjon-v\d+";/);
assert(game.includes('sayHost(q.texte, "question")'));
assert(game.includes('sayHost(q.anecdote, "anecdote", { reaction })'));
assert(game.includes('reaction: correct ? "bonne" : "mauvaise"'));
assert((game.match(/narrateQuestion\(q\);/g) ?? []).length >= 9);
assert((game.match(/narrateAnecdote\(q/g) ?? []).length >= 4);

// Au premier tirage, toute la liste est accessible — y compris le dernier clip.
const nativeRandom = Math.random;
try {
  resetHostCues();
  Math.random = () => 0.999999;
  assert.equal(pickHostCue("bonne"), HOST_CUES.bonne.at(-1));
} finally {
  Math.random = nativeRandom;
  resetHostCues();
}

// Contrat d'enchaînement : réaction enregistrée, lancement enregistré, puis
// lecture du texte variable par Web Speech.
const played = [];
const spoken = [];
const previousGlobals = {
  Audio: globalThis.Audio,
  SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance,
  document: globalThis.document,
  window: globalThis.window,
};
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.listeners = new Map();
    played.push(src);
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  play() {
    queueMicrotask(() => this.listeners.get("ended")?.());
    return Promise.resolve();
  }
  pause() {}
  removeAttribute() {}
  load() {}
}
class FakeUtterance {
  constructor(value) { this.text = value; }
}
try {
  globalThis.Audio = FakeAudio;
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  globalThis.document = { createElement: () => ({ canPlayType: () => "probably" }) };
  globalThis.window = {
    speechSynthesis: {
      cancel() {},
      getVoices: () => [],
      speak: (utterance) => spoken.push(utterance.text),
    },
  };
  const tts = await import(`../js/tts.js?voice-test=${Date.now()}`);
  tts.setVoice(true);
  tts.sayHost("Les abeilles dansent.", "anecdote", { reaction: "bonne" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(played.length, 2);
  assert.match(played[0], /^assets\/voix\/bonne-\d{2}\.webm$/);
  assert.match(played[1], /^assets\/voix\/anecdote-\d{2}\.webm$/);
  assert.equal(spoken.at(-1), "Les abeilles dansent.");
  tts.stop();
} finally {
  Object.assign(globalThis, previousGlobals);
}

console.log(`✓ voix : ${manifest.clips.length} clips, ${Math.round(totalBytes / 1024)} Ko, manifeste/SHELL/inlining cohérents`);
