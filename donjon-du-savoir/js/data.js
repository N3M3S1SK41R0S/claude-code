// Question bank: loading, adaptive drawing, no repeats within a game — and a
// persistent cross-game ledger so a question only comes back once EVERY other
// question has been seen as often ("inexhaustible" feeling on replays).
import { getState, isLast, isLeader, markAsked, resetAskedIfNeeded } from "./state.js";

let bank = [];

const SEEN_KEY = "donjon-seen-v1";
let seenCounts = null;

function seen() {
  if (seenCounts === null) {
    try {
      seenCounts = JSON.parse(localStorage.getItem(SEEN_KEY)) ?? {};
    } catch {
      seenCounts = {};
    }
  }
  return seenCounts;
}

function bumpSeen(id) {
  const s = seen();
  s[id] = (s[id] ?? 0) + 1;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {
    /* private mode: the in-memory ledger still works for this session */
  }
}

/** Keep only the least-seen candidates (cross-game freshness). */
function preferUnseen(candidates) {
  if (candidates.length <= 1) return candidates;
  const s = seen();
  let min = Infinity;
  for (const q of candidates) min = Math.min(min, s[q.id] ?? 0);
  return candidates.filter((q) => (s[q.id] ?? 0) === min);
}

export async function loadBank() {
  const res = await fetch("data/questions.json");
  if (!res.ok) throw new Error(`questions.json ${res.status}`);
  const data = await res.json();
  bank = (data.questions ?? []).filter(
    (q) => q && q.id && q.texte && q.anecdote && q.format && q.niveau_age,
  );
  return bank.length;
}

export function bankSize() {
  return bank.length;
}

/** enfant profile → enfant questions only; adulte → the whole bank. */
function allowedFor(profil) {
  return profil === "enfant" ? ["enfant"] : ["enfant", "ado", "adulte"];
}

function pool(profil, { formats = null } = {}) {
  const ages = allowedFor(profil);
  const asked = new Set(getState().askedIds);
  let candidates = bank.filter((q) => ages.includes(q.niveau_age) && !asked.has(q.id));
  if (formats) candidates = candidates.filter((q) => formats.includes(q.format));
  return candidates;
}

function pick(candidates) {
  const fresh = preferUnseen(candidates);
  const q = fresh[Math.floor(Math.random() * fresh.length)] ?? null;
  if (q) bumpSeen(q.id);
  return q;
}

/**
 * Adaptive draw (§5 of the cahier des charges):
 * - the leader draws from the hardest third of their allowed pool,
 * - the last-placed pion draws from the easier half,
 * - everyone else draws uniformly.
 * Falls back to the full pool whenever a slice is empty.
 */
export function drawQuestion(pion, { formats = null } = {}) {
  resetAskedIfNeeded(bank.length);
  let candidates = pool(pion.profil, { formats });
  if (candidates.length === 0) {
    // Everything asked for this profile: recycle by ignoring the ledger.
    const ages = allowedFor(pion.profil);
    candidates = bank.filter((q) => ages.includes(q.niveau_age));
    if (formats) candidates = candidates.filter((q) => formats.includes(q.format));
    if (candidates.length === 0) return null;
  }
  const sorted = [...candidates].sort((a, b) => (a.difficulte ?? 3) - (b.difficulte ?? 3));
  let slice = sorted;
  if (isLeader(pion)) slice = sorted.slice(Math.floor(sorted.length * 0.66));
  else if (isLast(pion)) slice = sorted.slice(0, Math.ceil(sorted.length / 2));
  const q = pick(slice.length > 0 ? slice : sorted);
  if (q) markAsked(q.id);
  return q;
}

/** Trou Noir: the hardest available question of the pion's allowed pool. */
export function drawHardest(pion) {
  resetAskedIfNeeded(bank.length);
  let candidates = pool(pion.profil, { formats: ["qcm", "vrai_faux"] });
  if (candidates.length === 0) candidates = pool(pion.profil);
  if (candidates.length === 0) return drawQuestion(pion);
  const maxDiff = Math.max(...candidates.map((q) => q.difficulte ?? 3));
  const hardest = candidates.filter((q) => (q.difficulte ?? 3) === maxDiff);
  const q = pick(hardest);
  if (q) markAsked(q.id);
  return q;
}

/** Événement collectif: a Vrai/Faux everyone can answer (child-friendly). */
export function drawEvent() {
  const state = getState();
  const hasChild = state.pions.some((p) => p.profil === "enfant");
  const profil = hasChild ? "enfant" : "adulte";
  let candidates = pool(profil, { formats: ["vrai_faux"] });
  if (candidates.length === 0) candidates = pool("adulte", { formats: ["vrai_faux"] });
  if (candidates.length === 0) candidates = pool(profil, { formats: ["qcm"] });
  const q = pick(candidates);
  if (q) markAsked(q.id);
  return q;
}

/** Gambit: numeric question, ideally within the pion's allowed ages. */
export function drawGambit(pion) {
  let candidates = pool(pion.profil, { formats: ["gambit_numerique"] });
  if (candidates.length === 0) candidates = bank.filter((q) => q.format === "gambit_numerique");
  const q = pick(candidates);
  if (q) markAsked(q.id);
  return q;
}

/** Easier replacement for Sire Cageot's child power (Bouclier Facile). */
export function drawEasier(pion, currentDifficulty) {
  const candidates = pool(pion.profil, { formats: ["qcm", "vrai_faux"] }).filter(
    (q) => (q.difficulte ?? 3) < (currentDifficulty ?? 3),
  );
  const q = pick(candidates.length > 0 ? candidates : pool(pion.profil, { formats: ["qcm", "vrai_faux"] }));
  if (q) markAsked(q.id);
  return q;
}
