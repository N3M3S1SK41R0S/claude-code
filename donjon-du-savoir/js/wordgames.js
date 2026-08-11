// Défis d'expression (Tabou / Password / Mime) — contenu vérifié, original et
// tout public, joué à la tablée sans chronomètre. Chargement + tirage avec la
// même fraîcheur inter-parties que la banque de questions (registre local).

let defis = [];
const SEEN_KEY = "donjon-defis-seen-v1";
let seenCounts = null;

function seen() {
  if (seenCounts === null) {
    try { seenCounts = JSON.parse(localStorage.getItem(SEEN_KEY)) ?? {}; }
    catch { seenCounts = {}; }
  }
  return seenCounts;
}

function bumpSeen(id) {
  const s = seen();
  s[id] = (s[id] ?? 0) + 1;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/** Least-seen first (fraîcheur), puis choix aléatoire dans ce sous-ensemble. */
function pickFresh(pool) {
  if (pool.length === 0) return null;
  let min = Infinity;
  for (const d of pool) min = Math.min(min, seen()[d.id] ?? 0);
  const fresh = pool.filter((d) => (seen()[d.id] ?? 0) === min);
  const d = fresh[Math.floor(Math.random() * fresh.length)];
  if (d) bumpSeen(d.id);
  return d ?? null;
}

export async function loadWordgames() {
  try {
    const res = await fetch("data/wordgames.json");
    if (!res.ok) throw new Error(`wordgames.json ${res.status}`);
    const data = await res.json();
    defis = (data.defis ?? []).filter(
      (d) => d && d.id && d.type && d.niveau && (d.mot || d.expression),
    );
  } catch {
    defis = []; // la case 🎭 retombera proprement sur une petite récompense
  }
  return defis.length;
}

export function wordgamesSize() {
  return defis.length;
}

/**
 * Tire un défi. Avec un enfant à la tablée, seuls les défis « enfant » sont
 * proposés (ils conviennent à tous — même règle que les événements collectifs).
 * `type` optionnel force Tabou/Password/Mime (sinon aléatoire parmi les dispos).
 */
export function drawDefi({ hasChild = false, type = null } = {}) {
  let pool = defis;
  if (hasChild) pool = pool.filter((d) => d.niveau === "enfant");
  if (type) pool = pool.filter((d) => d.type === type);
  if (pool.length === 0 && type) pool = defis.filter((d) => d.type === type); // ignore l'âge en dernier recours
  return pickFresh(pool);
}
