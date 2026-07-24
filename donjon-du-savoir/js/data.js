// Question bank: loading, adaptive drawing, no repeats within a game — and a
// persistent cross-game ledger so a question only comes back once EVERY other
// question has been seen as often ("inexhaustible" feeling on replays).
//
// HARD RULE (cahier §5): a child profile NEVER receives an above-age
// question. Every fallback recycles within the same age subset instead of
// escalating the difficulty.
import { bracketById, getState, markAsked, youngestBracket } from "./state.js";
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

/** Tranche d'âge (paliers de contenu autorisés) d'un pion. */
function rangeFor(pion) {
  return bracketById(pion?.bracket ?? "9-11");
}

/** Formats whose UI is a button grid (safe everywhere, incl. Trou Noir). */
const CHOICE_FORMATS = ["qcm", "vrai_faux"];

const diffOf = (q) => q.difficulte ?? 3;
/** RÈGLE FERME : une question n'est jouable que si son palier d'âge est
 *  autorisé par la tranche (adulte ne va JAMAIS aux tranches non-adultes). */
const inTiers = (q, b) => b.tiers.includes(q.niveau_age);

function subset(b, formats, { ignoreAsked = false } = {}) {
  const asked = ignoreAsked ? null : new Set(getState().askedIds);
  let candidates = bank.filter((q) => (!asked || !asked.has(q.id)) && inTiers(q, b));
  if (formats) candidates = candidates.filter((q) => formats.includes(q.format));
  return candidates;
}

/**
 * Questions jouables pour une tranche : contenu frais d'abord, puis recyclage
 * dans les MÊMES paliers d'âge. On n'élargit JAMAIS au-dessus de l'âge : une
 * tranche sans contenu pour un format renvoie une liste vide (l'appelant gère).
 */
function drawableFrom(b, formats) {
  const fresh = subset(b, formats);
  if (fresh.length > 0) return fresh;
  return subset(b, formats, { ignoreAsked: true });
}

/** Choisit un candidat en privilégiant les moins vus (fraîcheur inter-parties)
 *  — SANS le consommer (le tirage de choix de thème n'en garde qu'un seul). */
function select(candidates) {
  const fresh = preferUnseen(candidates);
  return fresh[Math.floor(Math.random() * fresh.length)] ?? null;
}

/** Marque une question comme posée (partie) ET vue (registre inter-parties). */
export function commitQuestion(q) {
  if (!q) return;
  bumpSeen(q.id);
  markAsked(q.id);
}

function pick(candidates) {
  const q = select(candidates);
  commitQuestion(q);
  return q;
}

/**
 * Tirage adaptatif : dans les paliers d'âge autorisés (et EUX SEULS), on vise
 * la difficulté courante du joueur (`niveau` : facile au début, plus dur s'il
 * gagne). Petite fenêtre autour de la cible pour la variété, sinon tout le
 * pool. `commit:false` sélectionne sans consommer (choix de thème) ; `exclude`
 * écarte des ids déjà proposés. Le registre de fraîcheur limite les redites.
 */
export function drawQuestion(pion, { formats = null, commit = true, exclude = null } = {}) {
  let pool = drawableFrom(rangeFor(pion), formats);
  if (exclude) pool = pool.filter((q) => !exclude.has(q.id));
  if (pool.length === 0) return null;
  const target = pion?.niveau ?? 2;
  let near = pool.filter((q) => Math.abs(diffOf(q) - target) <= 1);
  if (near.length === 0) near = pool;
  const q = select(near);
  if (commit) commitQuestion(q);
  return q;
}

/** Trou Noir: the hardest CHOICE question within the pion's allowed tiers. */
export function drawHardest(pion) {
  const candidates = drawableFrom(rangeFor(pion), CHOICE_FORMATS);
  if (candidates.length === 0) return null;
  const maxDiff = Math.max(...candidates.map(diffOf));
  return pick(candidates.filter((q) => diffOf(q) === maxDiff));
}

/** Toutes les tranches d'âge présentes à la table (pions + membres d'équipe). */
function tableBrackets() {
  const brackets = [];
  for (const p of getState().pions) {
    if (Array.isArray(p.membres) && p.membres.length) {
      for (const m of p.membres) brackets.push(m.bracket ?? p.bracket ?? "9-11");
    } else {
      brackets.push(p.bracket ?? "9-11");
    }
  }
  return brackets;
}

/** Une question collective à un palier d'âge donné (vrai/faux puis QCM). */
function drawEventFor(b, { exclude = null } = {}) {
  for (const fmt of [["vrai_faux"], ["qcm"]]) {
    let pool = drawableFrom(b, fmt);
    if (exclude) pool = pool.filter((q) => !exclude.has(q.id));
    if (pool.length > 0) return pick(pool);
  }
  return null;
}

/**
 * Événement collectif : une question que TOUT LE MONDE peut tenter. On vise la
 * tranche d'âge la PLUS JEUNE présente à la table (les pions et leurs membres
 * d'équipe), vrai/faux d'abord puis QCM — jamais au-dessus de cet âge.
 */
export function drawEvent() {
  return drawEventFor(bracketById(youngestBracket(tableBrackets())));
}

/**
 * Collectif « à deux difficultés » (demande du cahier) : quand la tablée réunit
 * à la fois de jeunes joueurs ET des joueurs qui peuvent recevoir de l'adulte,
 * on prépare DEUX questions — une accessible aux plus jeunes, une pour les
 * adultes — pour que chacun brille à son niveau. Renvoie { enfant, adulte } ;
 * `null` si un seul niveau suffit (la table est homogène) → collectif simple.
 */
export function drawEventPair() {
  const brackets = tableBrackets();
  const young = bracketById(youngestBracket(brackets));
  const adulte = bracketById("18+");
  // Deux niveaux seulement si l'écart est réel : le plus jeune n'atteint pas
  // le palier « adulte » mais au moins un joueur, si.
  const hasAdult = brackets.some((id) => bracketById(id).tiers.includes("adulte"));
  if (!hasAdult || young.tiers.includes("adulte")) return null;
  const qEnfant = drawEventFor(young);
  const qAdulte = drawEventFor(adulte, { exclude: qEnfant ? new Set([qEnfant.id]) : null });
  if (!qEnfant || !qAdulte) return null;
  return { enfant: qEnfant, adulte: qAdulte };
}

/** Gambit: numeric question within the pion's allowed tiers — or null. */
export function drawGambit(pion) {
  const candidates = drawableFrom(rangeFor(pion), ["gambit_numerique"]);
  return candidates.length > 0 ? pick(candidates) : null;
}

/**
 * Mini-jeu « Ordre ! » : n faits numériques adaptés au PLUS JEUNE de la table,
 * à valeurs toutes DISTINCTES (sinon impossible à classer). Sélectionne sans
 * consommer — l'appelant committe les questions réellement posées. Renvoie
 * null s'il n'y a pas assez de faits jouables.
 */
export function drawGambitTable(n = 3) {
  const b = bracketById(youngestBracket(tableBrackets()));
  const pool = drawableFrom(b, ["gambit_numerique"]);
  const set = [];
  const seenVals = new Set();
  for (const q of pool.sort(() => Math.random() - 0.5)) {
    const v = q.reponse_numerique;
    if (typeof v !== "number" || seenVals.has(v)) continue;
    seenVals.add(v);
    set.push(q);
    if (set.length === n) return set;
  }
  return null;
}

/**
 * Savoir insolite (case 🦩) : une VRAIE question, de préférence de la catégorie
 * « Insolite », dans les paliers d'âge autorisés. Sélectionne SANS consommer
 * (l'appelant la pose et la commit). Renvoie null si rien n'est jouable.
 */
export function drawInsolite(pion) {
  const pool = drawableFrom(rangeFor(pion), ["qcm", "vrai_faux", "gambit_numerique"]);
  if (pool.length === 0) return null;
  const inso = pool.filter((q) => q.categorie === "Insolite");
  return select(inso.length > 0 ? inso : pool);
}

/** Easier replacement (Bouclier Facile) — may return null; the caller must
 *  then NOT consume the power. */
export function drawEasier(pion, currentDifficulty) {
  const all = drawableFrom(rangeFor(pion), CHOICE_FORMATS);
  if (all.length === 0) return null;
  const easier = all.filter((q) => diffOf(q) < (currentDifficulty ?? 3));
  return pick(easier.length > 0 ? easier : all);
}
