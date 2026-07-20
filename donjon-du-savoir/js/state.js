// Game state: pions (players or teams), board, economy, persistence.
// A "pion" is the unit that moves: one per player in individual mode,
// one per team in team mode (with a rotating spokesperson).

export const SAVE_KEY = "donjon-savoir-save-v1";

export const CHARACTERS = [
  { id: "cageot", nom: "Sire Cageot", emoji: "🛡️", couleur: "#c2703e", titre: "Chevalier en carton et casseroles" },
  { id: "etincelle", nom: "Dame Étincelle", emoji: "✨", couleur: "#8e5cc2", titre: "Magicienne facétieuse" },
  { id: "gobelin", nom: "Gobelin Comptable", emoji: "🪙", couleur: "#3ec27a", titre: "Obsédé par les pièces d'or" },
  { id: "nebulia", nom: "Nébulia", emoji: "🌌", couleur: "#3e6ec2", titre: "Sorcière cosmique" },
  { id: "boumbastien", nom: "Boumbastien", emoji: "💥", couleur: "#c2b23e", titre: "Inventeur farfelu" },
  { id: "duchesse", nom: "La Duchesse Anecdote", emoji: "👑", couleur: "#c23e6b", titre: "Érudite excentrique" },
];

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/**
 * Tranches d'âge des joueurs (du plus jeune au plus âgé). Chaque tranche ouvre
 * une FENÊTRE de difficulté de questions (difMin..difMax, sur l'échelle 1-5) ;
 * la 1re privilégie le contenu « tout-petit » (`petit`). Les pouvoirs des
 * personnages restent en deux familles : « enfant » pour les 3 plus jeunes
 * tranches, « adulte » pour les 3 plus âgées.
 */
export const AGE_BRACKETS = [
  { id: "2-5", label: "2–5 ans", emoji: "🍼", difMin: 1, difMax: 1, petit: true },
  { id: "5-8", label: "5–8 ans", emoji: "🧸", difMin: 1, difMax: 2 },
  { id: "9-11", label: "9–11 ans", emoji: "🧒", difMin: 1, difMax: 3 },
  { id: "12-14", label: "12–14 ans", emoji: "🧑", difMin: 2, difMax: 4 },
  { id: "14-16", label: "14–16 ans", emoji: "🎓", difMin: 3, difMax: 5 },
  { id: "16-18", label: "16–18 ans", emoji: "🧑‍🎓", difMin: 4, difMax: 5 },
  { id: "18+", label: "18 ans et +", emoji: "🧙", difMin: 3, difMax: 5 },
];

export function bracketById(id) {
  return AGE_BRACKETS.find((b) => b.id === id) ?? AGE_BRACKETS[2];
}

export function bracketIndex(id) {
  const i = AGE_BRACKETS.findIndex((b) => b.id === id);
  return i === -1 ? 2 : i;
}

/** Famille de pouvoirs : « enfant » pour les 3 tranches les plus jeunes. */
export function bracketProfil(id) {
  return bracketIndex(id) <= 2 ? "enfant" : "adulte";
}

/** Tranche la PLUS JEUNE d'un ensemble (pour que le collectif convienne à tous). */
export function youngestBracket(ids) {
  if (!ids || ids.length === 0) return "9-11";
  let best = AGE_BRACKETS.length - 1;
  for (const id of ids) best = Math.min(best, bracketIndex(id));
  return AGE_BRACKETS[Math.max(0, best)].id;
}

/** Compat : ancien profil enfant/adulte → une tranche par défaut. */
function profilToBracket(profil) {
  return profil === "enfant" ? "5-8" : "18+";
}

let state = null;

export function getState() {
  return state;
}

/**
 * config = {
 *   mode: "individuel" | "equipes",
 *   pions: [{ nom, characterId, profil: "enfant"|"adulte", membres?: [{nom, profil}] }],
 * }
 * In team mode each pion carries its members; the team profile is "enfant"
 * if AT LEAST one member is a child (questions must suit everyone at the table).
 */
export const STAR_BASE_PRICE = 20;
export const STAR_STEP = 5;
export const LAP_BONUS = 10;
export const LAST_ROUND_BONUS = 15;

export function newGame(config, boardLayout) {
  const variant = config.variant === "etoiles" ? "etoiles" : "course";
  // Star sits on a random inner case; landing there lets you buy it.
  const starPos = variant === "etoiles"
    ? 1 + Math.floor(Math.random() * Math.max(1, boardLayout.length - 2))
    : null;
  state = {
    version: 1,
    mode: config.mode,
    variant,
    // Manches : de 5 à 200 (bornées ici quelle que soit l'entrée).
    rounds: variant === "etoiles" ? Math.max(5, Math.min(200, Math.round(config.rounds ?? 10))) : null,
    starPos,
    lastRoundBoost: false,
    boardId: config.boardId ?? "grand-donjon",
    board: boardLayout,
    pions: config.pions.map((p, i) => ({
      id: i,
      nom: p.nom,
      characterId: p.characterId,
      // Tranche d'âge (fenêtre de difficulté) + profil dérivé (famille de pouvoirs).
      bracket: p.bracket ?? profilToBracket(p.profil),
      profil: p.profil ?? bracketProfil(p.bracket ?? "16-18"),
      membres: p.membres ?? null,
      porteParoleIndex: 0,
      position: 0,
      // Seam de test : or gonflé UNIQUEMENT si un flag global de test est posé
      // (jamais en jeu réel), pour couvrir déterministiquement l'achat d'étoile.
      pieces: (typeof globalThis !== "undefined" && globalThis.__DONJON_TEST) ? 200 : 8,
      etoiles: 0,
      jokers: 0,
      objets: [],
      besasse: false,
      pouvoirUtilise: false,
      tourASauter: false,
      objetUtilise: false,
      doublePieces: false,
      stats: { bonnes: 0, questions: 0 },
      malusSubis: 0,
      orGagne: 0,
      casesParcourues: 0,
    })),
    currentIndex: 0,
    tour: 1,
    askedIds: [],
    // Case landed on but not yet resolved — lets a reload resume mid-turn
    // instead of offering a free second dice roll (and prevents dodging a
    // malus or the Trou Noir by refreshing the page).
    pendingCase: null,
    finished: false,
    ranking: null,
  };
  save();
  return state;
}

export function isEtoiles() {
  return state?.variant === "etoiles";
}

/** Prix de la prochaine étoile pour ce pion (escalade INDIVIDUELLE anti-runaway). */
export function starPrice(pion) {
  return STAR_BASE_PRICE + STAR_STEP * (pion.etoiles ?? 0);
}

/** Déplace le marchand d'étoile sur une nouvelle case interne, ≠ l'actuelle. */
export function moveStar() {
  const L = state.board.length;
  let pos = state.starPos;
  for (let tries = 0; tries < 20 && pos === state.starPos; tries++) {
    pos = 1 + Math.floor(Math.random() * Math.max(1, L - 2));
  }
  state.starPos = pos;
  save();
  return pos;
}

/* ---------- étoiles bonus de fin de partie (façon Mario Party) ---------- */
// À la fin d'une partie Étoiles, 3 récompenses tirées au sort sur des compteurs
// MESURABLES (jamais l'humeur du meneur) peuvent renverser le classement — un
// dernier frisson. Chaque prix couronne un exploit chiffré de la partie.

export const BONUS_STAR_POOL = [
  { key: "lievre", titre: "Le Lièvre", emoji: "🐇", desc: "a galopé le plus de cases", metric: (p) => p.casesParcourues ?? 0, dir: "max" },
  { key: "tortue", titre: "La Tortue Sage", emoji: "🐢", desc: "a avancé le moins, tout en sagesse", metric: (p) => p.casesParcourues ?? 0, dir: "min" },
  { key: "roi_questions", titre: "Le Roi des Questions", emoji: "🧠", desc: "a donné le plus de bonnes réponses", metric: (p) => p.stats?.bonnes ?? 0, dir: "max", minValue: 1 },
  { key: "oeil_de_lynx", titre: "L'Œil de Lynx", emoji: "🦉", desc: "a le meilleur taux de réussite", metric: (p) => (p.stats?.questions ?? 0) >= 3 ? (p.stats.bonnes / p.stats.questions) : -1, dir: "max", minValue: 0 },
  { key: "magnat", titre: "Le Magnat", emoji: "💰", desc: "a amassé le plus d'or de toute la partie", metric: (p) => p.orGagne ?? 0, dir: "max", minValue: 1 },
  { key: "souffre_douleur", titre: "Le Souffre-Douleur", emoji: "🤕", desc: "a vaillamment encaissé le plus de coups durs", metric: (p) => p.malusSubis ?? 0, dir: "max", minValue: 1 },
  { key: "chouchou", titre: "Le Chouchou du Destin", emoji: "🍀", desc: "a été désigné par le pur hasard des dés", metric: () => 0, dir: "random" },
];

function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choisit jusqu'à `count` prix bonus DISTINCTS et leur lauréat, sans muter les
 * pions. Un prix n'entre dans le tirage que s'il a au moins un lauréat éligible.
 * Départage des ex æquo : d'abord vers le pion qui a le MOINS d'étoiles (esprit
 * anti-runaway / comeback), puis par ordre de jeu. `rng` injectable pour les tests.
 */
export function computeBonusStars(pions, { count = 3, rng = Math.random } = {}) {
  if (!Array.isArray(pions) || pions.length === 0) return [];
  const eligibleFor = (award, p) => award.minValue === undefined || award.metric(p) >= award.minValue;
  const pool = BONUS_STAR_POOL.filter((a) =>
    a.dir === "random" ? true : pions.some((p) => eligibleFor(a, p)),
  );
  const chosen = shuffled(pool, rng).slice(0, Math.min(count, pool.length));
  return chosen.map((a) => {
    let winner;
    if (a.dir === "random") {
      winner = pions[Math.floor(rng() * pions.length)];
    } else {
      winner = pions
        .filter((p) => eligibleFor(a, p))
        .slice()
        .sort((x, y) => {
          const vx = a.metric(x), vy = a.metric(y);
          if (vx !== vy) return a.dir === "max" ? vy - vx : vx - vy;
          if ((x.etoiles ?? 0) !== (y.etoiles ?? 0)) return (x.etoiles ?? 0) - (y.etoiles ?? 0);
          return x.id - y.id;
        })[0];
    }
    return { key: a.key, titre: a.titre, emoji: a.emoji, desc: a.desc, pionId: winner.id, nom: winner.nom, characterId: winner.characterId };
  });
}

export function setPendingCase(type) {
  state.pendingCase = type;
  save();
}

export function clearPendingCase() {
  if (state.pendingCase !== null) {
    state.pendingCase = null;
    save();
  }
}

export function currentPion() {
  return state.pions[state.currentIndex];
}

/** Classement : en mode Étoiles, plus d'étoiles puis plus d'or ; en mode
 *  Course, plus avancé sur le plateau puis plus d'or. */
export function ranking() {
  if (state.variant === "etoiles") {
    return [...state.pions].sort((a, b) => (b.etoiles ?? 0) - (a.etoiles ?? 0) || b.pieces - a.pieces);
  }
  return [...state.pions].sort((a, b) => b.position - a.position || b.pieces - a.pieces);
}

export function rankOf(pion) {
  return ranking().findIndex((p) => p.id === pion.id);
}

export function isLast(pion) {
  return state.pions.length >= 3 && rankOf(pion) === state.pions.length - 1;
}

export function isLeader(pion) {
  return state.pions.length >= 2 && rankOf(pion) === 0;
}

/** Advance to the next pion; returns the skipped players so the table is
 *  told WHO lost their turn (the nap is public knowledge). */
export function nextTurn() {
  const skipped = [];
  for (let hop = 0; hop < state.pions.length + 1; hop++) {
    state.currentIndex = (state.currentIndex + 1) % state.pions.length;
    if (state.currentIndex === 0) state.tour += 1;
    const pion = currentPion();
    if (pion.tourASauter) {
      pion.tourASauter = false;
      skipped.push(pion.nom);
      continue;
    }
    save();
    return { pion, skipped };
  }
  save();
  return { pion: currentPion(), skipped };
}

/** Rotating spokesperson for team pions (returns null in individual mode). */
export function porteParole(pion) {
  if (!pion.membres || pion.membres.length === 0) return null;
  const m = pion.membres[pion.porteParoleIndex % pion.membres.length];
  pion.porteParoleIndex += 1;
  return m;
}

export function markAsked(id) {
  if (!state.askedIds.includes(id)) state.askedIds.push(id);
  save();
}

export function resetAskedIfNeeded(totalBankSize) {
  if (state.askedIds.length >= totalBankSize) state.askedIds = [];
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or private mode: the game continues without persistence */
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pions)) return null;
    if (!parsed.boardId) parsed.boardId = "grand-donjon"; // saves from before multi-boards
    if (parsed.pendingCase === undefined) parsed.pendingCase = null;
    // Sauvegardes d'avant les tranches d'âge : dériver un bracket depuis le profil.
    for (const p of parsed.pions) {
      if (!p.bracket) p.bracket = p.profil === "enfant" ? "5-8" : "18+";
      if (!p.profil) p.profil = bracketProfil(p.bracket);
      if (p.objetUtilise === undefined) p.objetUtilise = false;
    }
    state = parsed;
    return state;
  } catch {
    return null;
  }
}

export function clearSave() {
  state = null;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
