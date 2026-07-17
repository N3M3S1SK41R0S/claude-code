// Board generation and rendering — a serpentine dungeon path.
// Case types and target frequencies come straight from §4 of the cahier
// des charges; gambits and the trou noir are placed at fixed spots.

export const BOARD_LENGTH = 42;
export const COLS = 7;

export const CASE_TYPES = {
  depart: { label: "Départ", emoji: "🚪", couleur: "#6aa84f" },
  question: { label: "Question", emoji: "❓", couleur: "#4a6fb5" },
  chance: { label: "Chance", emoji: "🍀", couleur: "#3ec27a" },
  evenement: { label: "Événement", emoji: "🎪", couleur: "#c28a3e" },
  malus: { label: "Coup dur", emoji: "💀", couleur: "#b54a4a" },
  pieces: { label: "Pièces", emoji: "🪙", couleur: "#c2b23e" },
  joker: { label: "Joker", emoji: "🃏", couleur: "#8e5cc2" },
  gambit: { label: "Gambit", emoji: "🎲", couleur: "#3eb8c2" },
  trounoir: { label: "Trou Noir", emoji: "🕳️", couleur: "#2b2140" },
  arrivee: { label: "Trésor", emoji: "🏆", couleur: "#d9a83c" },
};

/**
 * Build the 42-case layout. Fixed: départ (0), arrivée (41), gambits (14, 28),
 * trou noir (38). The rest follows the §4 frequencies, shuffled, with the
 * first two travelled cases guaranteed harmless.
 */
export function generateBoard() {
  const layout = new Array(BOARD_LENGTH).fill(null);
  layout[0] = "depart";
  layout[BOARD_LENGTH - 1] = "arrivee";
  layout[14] = "gambit";
  layout[28] = "gambit";
  layout[BOARD_LENGTH - 4] = "trounoir";

  const free = [];
  for (let i = 0; i < BOARD_LENGTH; i++) if (layout[i] === null) free.push(i);

  // §4 frequencies over the remaining 37 cases.
  const fill = [
    ...Array(19).fill("question"), // ~50 %
    ...Array(5).fill("chance"), // ~12 %
    ...Array(4).fill("evenement"), // ~10 %
    ...Array(5).fill("malus"), // ~12 %
    ...Array(3).fill("pieces"), // ~8 %
    ...Array(2).fill("joker"), // ~5 %
  ];
  while (fill.length < free.length) fill.push("question");

  for (let i = fill.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fill[i], fill[j]] = [fill[j], fill[i]];
  }
  free.forEach((idx, i) => {
    layout[idx] = fill[i];
  });

  // Soft landing: no malus/trou noir on the first two travelled cases.
  for (const idx of [1, 2]) {
    if (layout[idx] === "malus") {
      const swap = layout.findIndex((t, i) => i > 6 && t === "question");
      if (swap !== -1) [layout[idx], layout[swap]] = [layout[swap], layout[idx]];
    }
  }
  return layout;
}

/** Serpentine coordinates: row 0 at the bottom, direction alternating. */
export function caseCoords(index) {
  const row = Math.floor(index / COLS);
  const colInRow = index % COLS;
  const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
  return { row, col };
}

/** Render the board grid + pions into `container`. */
export function renderBoard(container, layout, pions, currentPionId) {
  const rows = Math.ceil(layout.length / COLS);
  container.style.setProperty("--cols", COLS);
  container.style.setProperty("--rows", rows);
  container.innerHTML = "";

  layout.forEach((type, i) => {
    const def = CASE_TYPES[type];
    const { row, col } = caseCoords(i);
    const cell = document.createElement("div");
    cell.className = `case case-${type}`;
    cell.style.gridColumn = String(col + 1);
    cell.style.gridRow = String(rows - row);
    cell.style.setProperty("--case-color", def.couleur);
    cell.dataset.index = String(i);
    cell.title = `Case ${i} — ${def.label}`;
    cell.innerHTML = `<span class="case-emoji" aria-hidden="true">${def.emoji}</span><span class="case-num">${i === 0 ? "" : i === layout.length - 1 ? "" : i}</span>`;
    container.appendChild(cell);
  });

  // Pions, fanned out when several share a case.
  const byCase = new Map();
  for (const p of pions) {
    if (!byCase.has(p.position)) byCase.set(p.position, []);
    byCase.get(p.position).push(p);
  }
  for (const [pos, group] of byCase) {
    const cell = container.querySelector(`[data-index="${pos}"]`);
    if (!cell) continue;
    group.forEach((p, i) => {
      const token = document.createElement("div");
      token.className = "pion" + (p.id === currentPionId ? " pion-actif" : "");
      token.style.setProperty("--pion-color", p.couleur);
      const angle = (i / Math.max(1, group.length)) * 2 * Math.PI;
      const spread = group.length > 1 ? 12 : 0;
      token.style.setProperty("--dx", `${Math.round(Math.cos(angle) * spread)}px`);
      token.style.setProperty("--dy", `${Math.round(Math.sin(angle) * spread)}px`);
      token.textContent = p.emoji;
      token.title = p.nom;
      token.setAttribute("aria-label", `${p.nom}, case ${pos}`);
      cell.appendChild(token);
    });
  }
}
