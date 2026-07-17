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
export function newGame(config, boardLayout) {
  state = {
    version: 1,
    mode: config.mode,
    boardId: config.boardId ?? "grand-donjon",
    board: boardLayout,
    pions: config.pions.map((p, i) => ({
      id: i,
      nom: p.nom,
      characterId: p.characterId,
      profil: p.profil,
      membres: p.membres ?? null,
      porteParoleIndex: 0,
      position: 0,
      pieces: 0,
      jokers: 0,
      pouvoirUtilise: false,
      tourASauter: false,
      doublePieces: false,
      stats: { bonnes: 0, questions: 0 },
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

/** Ranking by board position (descending), ties by coins. */
export function ranking() {
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
