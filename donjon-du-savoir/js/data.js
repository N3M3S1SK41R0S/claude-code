// Question bank: loading, adaptive drawing, no repeats within a game — and a
// persistent cross-game ledger so a question only comes back once EVERY other
// question has been seen as often ("inexhaustible" feeling on replays).
//
// HARD RULE (cahier §5): a child profile NEVER receives an above-age
// question. Every fallback recycles within the same age subset instead of
// escalating the difficulty.
import { bracketById, getState, isLast, isLeader, markAsked, youngestBracket } from "./state.js";
import { loadCustom } from "./custom.js";

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
  refreshCustom();
  return bank.length;
}

/** Mix the device's home-made questions into the bank (tagged 🏠). */
export function refreshCustom() {
  bank = bank.filter((q) => !q.maison).concat(loadCustom());
}

export function bankSize() {
  return bank.length;
}

/** Fenêtre de difficulté (1-5) de la tranche d'âge d'un pion. */
function rangeFor(pion) {
  return bracketById(pion?.bracket ?? "9-11");
}

/** Formats whose UI is a button grid (safe everywhere, incl. Trou Noir). */
const CHOICE_FORMATS = ["qcm", "vrai_faux"];

const diffOf = (q) => q.difficulte ?? 3;
const inWindow = (q, b) => diffOf(q) >= b.difMin && diffOf(q) <= b.difMax;

function subset(b, formats, { ignoreAsked = false, petitOnly = false } = {}) {
  const asked = ignoreAsked ? null : new Set(getState().askedIds);
  let candidates = bank.filter((q) => (!asked || !asked.has(q.id)));
  candidates = petitOnly
    ? candidates.filter((q) => q.niveau_age === "tout_petit")
    : candidates.filter((q) => q.niveau_age !== "tout_petit" && inWindow(q, b));
  if (formats) candidates = candidates.filter((q) => formats.includes(q.format));
  return candidates;
}

/**
 * Questions jouables pour une tranche : contenu frais d'abord, puis recyclage
 * dans la MÊME fenêtre. La tranche 2-5 privilégie le contenu « tout-petit » s'il
 * existe. Dernier recours seulement (fenêtre vide dans la banque) : on élargit
 * d'un cran pour ne jamais bloquer le jeu — jamais au-delà.
 */
function drawableFrom(b, formats) {
  if (b.petit) {
    const petit = subset(b, formats, { petitOnly: true });
    if (petit.length > 0) return petit;
    const petitRecycle = subset(b, formats, { petitOnly: true, ignoreAsked: true });
    if (petitRecycle.length > 0) return petitRecycle;
  }
  const fresh = subset(b, formats);
  if (fresh.length > 0) return fresh;
  const recycled = subset(b, formats, { ignoreAsked: true });
  if (recycled.length > 0) return recycled;
  const wide = { difMin: Math.max(1, b.difMin - 1), difMax: Math.min(5, b.difMax + 1) };
  return subset(wide, formats, { ignoreAsked: true });
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
  const candidates = drawableFrom(rangeFor(pion), formats);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => diffOf(a) - diffOf(b));
  let slice = sorted;
  if (isLeader(pion)) slice = sorted.slice(Math.floor(sorted.length * 0.66));
  else if (isLast(pion)) slice = sorted.slice(0, Math.ceil(sorted.length / 2));
  return pick(slice.length > 0 ? slice : sorted);
}

/** Trou Noir: the hardest CHOICE question within the pion's age window. */
export function drawHardest(pion) {
  const candidates = drawableFrom(rangeFor(pion), CHOICE_FORMATS);
  if (candidates.length === 0) return null;
  const maxDiff = Math.max(...candidates.map(diffOf));
  return pick(candidates.filter((q) => diffOf(q) === maxDiff));
}

/**
 * Événement collectif : une question que TOUT LE MONDE peut tenter. On vise la
 * tranche d'âge la PLUS JEUNE présente à la table (les pions et leurs membres
 * d'équipe), vrai/faux d'abord puis QCM — jamais au-dessus de cet âge.
 */
export function drawEvent() {
  const brackets = [];
  for (const p of getState().pions) {
    if (Array.isArray(p.membres) && p.membres.length) {
      for (const m of p.membres) brackets.push(m.bracket ?? p.bracket ?? "9-11");
    } else {
      brackets.push(p.bracket ?? "9-11");
    }
  }
  const b = bracketById(youngestBracket(brackets));
  const vf = drawableFrom(b, ["vrai_faux"]);
  if (vf.length > 0) return pick(vf);
  const qcm = drawableFrom(b, ["qcm"]);
  if (qcm.length > 0) return pick(qcm);
  return null;
}

/** Gambit: numeric question within the pion's age window — or null. */
export function drawGambit(pion) {
  const candidates = drawableFrom(rangeFor(pion), ["gambit_numerique"]);
  return candidates.length > 0 ? pick(candidates) : null;
}

/** Easier replacement (Bouclier Facile) — may return null; the caller must
 *  then NOT consume the power. */
export function drawEasier(pion, currentDifficulty) {
  const all = drawableFrom(rangeFor(pion), CHOICE_FORMATS);
  if (all.length === 0) return null;
  const easier = all.filter((q) => diffOf(q) < (currentDifficulty ?? 3));
  return pick(easier.length > 0 ? easier : all);
}
