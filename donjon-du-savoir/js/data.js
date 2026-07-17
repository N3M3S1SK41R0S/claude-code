// Question bank: loading, adaptive drawing, no repeats within a game — and a
// persistent cross-game ledger so a question only comes back once EVERY other
// question has been seen as often ("inexhaustible" feeling on replays).
//
// HARD RULE (cahier §5): a child profile NEVER receives an above-age
// question. Every fallback recycles within the same age subset instead of
// escalating the difficulty.
import { getState, isLast, isLeader, markAsked } from "./state.js";

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

/** Formats whose UI is a button grid (safe everywhere, incl. Trou Noir). */
const CHOICE_FORMATS = ["qcm", "vrai_faux"];

function subset(ages, formats, { ignoreAsked = false } = {}) {
  const asked = ignoreAsked ? null : new Set(getState().askedIds);
  let candidates = bank.filter((q) => ages.includes(q.niveau_age) && (!asked || !asked.has(q.id)));
  if (formats) candidates = candidates.filter((q) => formats.includes(q.format));
  return candidates;
}

/** Fresh questions first; when the subset is exhausted, recycle it — but
 *  NEVER widen the age constraint. */
function drawableFrom(ages, formats) {
  const fresh = subset(ages, formats);
  if (fresh.length > 0) return fresh;
  return subset(ages, formats, { ignoreAsked: true });
}

function pick(candidates) {
  const fresh = preferUnseen(candidates);
  const q = fresh[Math.floor(Math.random() * fresh.length)] ?? null;
  if (q) {
    bumpSeen(q.id);
    markAsked(q.id);
  }
  return q;
}

/**
 * Adaptive draw (§5): the leader draws from the hardest third of their
 * allowed pool, the last-placed pion from the easier half, everyone else
 * uniformly. Slices always fall back to the full allowed pool.
 */
export function drawQuestion(pion, { formats = null } = {}) {
  const candidates = drawableFrom(allowedFor(pion.profil), formats);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => (a.difficulte ?? 3) - (b.difficulte ?? 3));
  let slice = sorted;
  if (isLeader(pion)) slice = sorted.slice(Math.floor(sorted.length * 0.66));
  else if (isLast(pion)) slice = sorted.slice(0, Math.ceil(sorted.length / 2));
  return pick(slice.length > 0 ? slice : sorted);
}

/** Trou Noir: the hardest CHOICE question of the pion's allowed pool —
 *  choice formats only, so the panel always has answer buttons. */
export function drawHardest(pion) {
  const candidates = drawableFrom(allowedFor(pion.profil), CHOICE_FORMATS);
  if (candidates.length === 0) return null;
  const maxDiff = Math.max(...candidates.map((q) => q.difficulte ?? 3));
  return pick(candidates.filter((q) => (q.difficulte ?? 3) === maxDiff));
}

/**
 * Événement collectif: a question EVERYONE at the table can answer.
 * With a child present, only enfant questions qualify — vrai/faux first,
 * then enfant QCM, then recycled enfant questions. Never age-escalation.
 */
export function drawEvent() {
  const hasChild = getState().pions.some((p) => p.profil === "enfant");
  const ages = hasChild ? ["enfant"] : ["enfant", "ado", "adulte"];
  const vf = drawableFrom(ages, ["vrai_faux"]);
  if (vf.length > 0) return pick(vf);
  const qcm = drawableFrom(ages, ["qcm"]);
  if (qcm.length > 0) return pick(qcm);
  return null;
}

/** Gambit: numeric question within the pion's allowed ages — or null
 *  (the case then falls back to a classic question, never age-escalates). */
export function drawGambit(pion) {
  const candidates = drawableFrom(allowedFor(pion.profil), ["gambit_numerique"]);
  return candidates.length > 0 ? pick(candidates) : null;
}

/** Easier replacement (Bouclier Facile) — may return null; the caller must
 *  then NOT consume the power. */
export function drawEasier(pion, currentDifficulty) {
  const all = drawableFrom(allowedFor(pion.profil), CHOICE_FORMATS);
  if (all.length === 0) return null;
  const easier = all.filter((q) => (q.difficulte ?? 3) < (currentDifficulty ?? 3));
  return pick(easier.length > 0 ? easier : all);
}
