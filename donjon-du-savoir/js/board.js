// Boards — Mario-Party-style winding maps, now PLURAL: five dungeons with
// different lengths, hazards, distributions and moods. Geometry and layout
// are fully parametric; §4 frequencies remain the baseline of the classic.

export const CASE_TYPES = {
  depart: { label: "Départ", emoji: "🚪", couleur: "#58a24f" },
  question: { label: "Question", emoji: "❓", couleur: "#4a6fb5" },
  chance: { label: "Chance", emoji: "🍀", couleur: "#3ec27a" },
  evenement: { label: "Événement", emoji: "🎪", couleur: "#c28a3e" },
  malus: { label: "Coup dur", emoji: "💀", couleur: "#b54a4a" },
  pieces: { label: "Pièces", emoji: "🪙", couleur: "#c2a93e" },
  joker: { label: "Joker", emoji: "🃏", couleur: "#8e5cc2" },
  gambit: { label: "Gambit", emoji: "🎲", couleur: "#3eb8c2" },
  trounoir: { label: "Trou Noir", emoji: "🕳️", couleur: "#181026" },
  arrivee: { label: "Trésor", emoji: "🏆", couleur: "#e0b04a" },
  boutique: { label: "Boutique", emoji: "🛒", couleur: "#c25ea0" },
  insolite: { label: "Savoir insolite", emoji: "🦩", couleur: "#e0568f" },
};

/**
 * The five dungeons. `dist` weights apply to the free cases (start, goal,
 * gambits and trous noirs are placed first); `road` tints the path.
 */
export const BOARDS = [
  {
    id: "crypte",
    nom: "La Crypte d'Initiation",
    emoji: "🕯️",
    desc: "Courte et clémente : plus de chance, aucun trou noir. Parfaite avec des enfants ou pour découvrir.",
    length: 28,
    gambits: [13],
    trounoirs: [],
    dist: { question: 13, chance: 5, evenement: 2, malus: 1, pieces: 3, joker: 1 },
    road: "#3f6b46",
    theme: "crypte",
  },
  {
    id: "grand-donjon",
    nom: "Le Grand Donjon",
    emoji: "🏰",
    desc: "Le parcours classique : équilibré, deux gambits, un trou noir en fin de route.",
    length: 42,
    gambits: [14, 28],
    trounoirs: [38],
    dist: { question: 18, chance: 5, evenement: 4, malus: 5, pieces: 3, joker: 2 },
    road: "#4a3a78",
    theme: "donjon",
  },
  {
    id: "tour",
    nom: "La Tour du Vertige",
    emoji: "🗼",
    desc: "Étroite et cruelle : coups durs fréquents et DEUX trous noirs. Pour les âmes trempées.",
    length: 48,
    gambits: [16, 33],
    trounoirs: [40, 44],
    dist: { question: 19, chance: 4, evenement: 4, malus: 9, pieces: 3, joker: 3 },
    road: "#6e3a3a",
    theme: "tour",
  },
  {
    id: "catacombes",
    nom: "Les Catacombes du Chaos",
    emoji: "💀",
    desc: "Le royaume du pari : trois gambits et des événements collectifs à chaque détour.",
    length: 44,
    gambits: [11, 22, 33],
    trounoirs: [40],
    dist: { question: 16, chance: 5, evenement: 8, malus: 5, pieces: 2, joker: 2 },
    road: "#2e5f63",
    theme: "catacombes",
  },
  {
    id: "labyrinthe",
    nom: "Le Labyrinthe Doré",
    emoji: "💰",
    desc: "Long marathon à trésors : pièces et jokers abondent, les pouvoirs se rachètent souvent.",
    length: 56,
    gambits: [18, 37],
    trounoirs: [50],
    dist: { question: 23, chance: 6, evenement: 5, malus: 6, pieces: 7, joker: 4 },
    road: "#7a6428",
    theme: "labyrinthe",
  },
];

export function boardById(id) {
  return BOARDS.find((b) => b.id === id) ?? BOARDS[1];
}

/**
 * Build a board layout from its definition: fixed cases first (start, goal,
 * gambits, trous noirs), then the weighted shuffle of everything else, with
 * the first travelled cases guaranteed harmless.
 */
export function generateBoard(def = boardById("grand-donjon")) {
  const L = def.length;
  const layout = new Array(L).fill(null);
  layout[0] = "depart";
  layout[L - 1] = "arrivee";
  for (const g of def.gambits) layout[g] = "gambit";
  for (const t of def.trounoirs) layout[t] = "trounoir";

  const free = [];
  for (let i = 0; i < L; i++) if (layout[i] === null) free.push(i);

  const fill = [];
  for (const [type, count] of Object.entries(def.dist)) fill.push(...Array(count).fill(type));
  // dist sums are tuned to equal the free-case count; pad with questions if a
  // definition ever undershoots (never silently drop an announced case).
  while (fill.length < free.length) fill.push("question");
  if (fill.length > free.length) fill.length = free.length;

  for (let i = fill.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fill[i], fill[j]] = [fill[j], fill[i]];
  }
  free.forEach((idx, i) => {
    layout[idx] = fill[i];
  });

  for (const idx of [1, 2]) {
    if (layout[idx] === "malus") {
      const swap = layout.findIndex((t, i) => i > 6 && t === "question");
      if (swap !== -1) [layout[idx], layout[swap]] = [layout[swap], layout[idx]];
    }
  }

  // v2 : semer une Boutique et une case Savoir insolite (plus une 2e boutique
  // sur les grands plateaux) en recyclant quelques cases Question.
  const seed = (type, count) => {
    for (let k = 0; k < count; k++) {
      const i = layout.findIndex((t, idx) => idx > 3 && idx < L - 2 && t === "question");
      if (i !== -1) layout[i] = type;
    }
  };
  seed("boutique", L >= 44 ? 2 : 1);
  seed("insolite", L >= 40 ? 2 : 1);
  return layout;
}

/* ---------- path geometry (viewBox 1000 × H) ---------- */

const VIEW_W = 1000;

/** Meandering serpentine sized to the board: ~10-11 cases per row. */
function buildCoords(length) {
  const rowCount = Math.max(3, Math.round(length / 10.5));
  const viewH = 180 + rowCount * 158;
  const base = Math.floor(length / rowCount);
  const extra = length - base * rowCount;
  const rows = Array.from({ length: rowCount }, (_, r) => base + (r < extra ? 1 : 0));

  const coords = [];
  let index = 0;
  rows.forEach((count, r) => {
    const margin = r % 2 === 0 ? 70 : 105;
    const step = count > 1 ? (VIEW_W - margin * 2) / (count - 1) : 0;
    const yRow = viewH - 90 - r * 158;
    for (let c = 0; c < count; c++) {
      const along = r % 2 === 0 ? c : count - 1 - c;
      const x = margin + step * along;
      const wobble = Math.sin(index * 1.9) * 20 + Math.cos(index * 0.7) * 8;
      coords.push({ x, y: yRow + wobble });
      index += 1;
    }
  });
  return { coords: coords.slice(0, length), viewH };
}

const geomCache = new Map();
function geometry(length) {
  if (!geomCache.has(length)) geomCache.set(length, buildCoords(length));
  return geomCache.get(length);
}

/** Catmull-Rom spline through the case centers → smooth SVG road. */
function roadPath(coords) {
  const p = coords;
  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Dungeon scenery (relative positions 0-1, scaled to each board). */
const DECOR = [
  { e: "🏰", u: 0.03, v: 0.94, s: 44 }, { e: "🌲", u: 0.19, v: 0.97, s: 26 },
  { e: "🕯️", u: 0.975, v: 0.91, s: 24 }, { e: "🍄", u: 0.955, v: 0.75, s: 22 },
  { e: "🦇", u: 0.06, v: 0.55, s: 22 }, { e: "🕸️", u: 0.025, v: 0.72, s: 26 },
  { e: "💎", u: 0.965, v: 0.53, s: 22 }, { e: "🗿", u: 0.03, v: 0.31, s: 30 },
  { e: "🌋", u: 0.85, v: 0.09, s: 30 }, { e: "🦴", u: 0.5, v: 0.965, s: 20 },
  { e: "⭐", u: 0.968, v: 0.14, s: 26 }, { e: "🔥", u: 0.12, v: 0.09, s: 22 },
];

/* ---------- rendering ---------- */

let builtSignature = null;

/**
 * Render (or update) the board. The static part — road, scenery, spaces —
 * is built once per layout; the pion layer is updated in place so CSS
 * transitions make the tokens glide.
 */
export function renderBoard(container, layout, pions, currentPionId, boardDef = boardById("grand-donjon")) {
  const signature = `${boardDef.id}:${layout.join(",")}`;
  if (builtSignature !== signature || !container.querySelector(".pion-layer")) {
    buildStatic(container, layout, boardDef);
    builtSignature = signature;
  }
  updatePions(container, layout, pions, currentPionId);
}

function buildStatic(container, layout, def) {
  const { coords, viewH } = geometry(layout.length);
  container.innerHTML = "";
  container.className = `board-map board-theme-${def.theme}`;
  container.style.aspectRatio = `${VIEW_W} / ${viewH}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${viewH}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("board-svg");
  svg.setAttribute("aria-hidden", "true");
  const d = roadPath(coords);
  svg.innerHTML = `
    <path d="${d}" fill="none" stroke="#0e0a1c" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <path d="${d}" fill="none" stroke="${def.road}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#e0b04a" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" opacity="0.7"/>`;
  container.appendChild(svg);

  for (const dec of DECOR) {
    const span = document.createElement("span");
    span.className = "decor";
    span.textContent = dec.e;
    span.style.left = `${dec.u * 100}%`;
    span.style.top = `${dec.v * 100}%`;
    span.style.fontSize = `${dec.s / 10}cqw`;
    span.setAttribute("aria-hidden", "true");
    container.appendChild(span);
  }

  layout.forEach((type, i) => {
    const defCase = CASE_TYPES[type];
    const { x, y } = coords[i];
    const cell = document.createElement("div");
    cell.className = `case case-${type}`;
    cell.style.left = `${(x / VIEW_W) * 100}%`;
    cell.style.top = `${(y / viewH) * 100}%`;
    cell.style.setProperty("--case-color", defCase.couleur);
    cell.dataset.index = String(i);
    cell.title = `Case ${i} — ${defCase.label}`;
    cell.innerHTML = `<span class="case-emoji" aria-hidden="true">${defCase.emoji}</span>`;
    if (i !== 0 && i !== layout.length - 1) {
      cell.innerHTML += `<span class="case-num" aria-hidden="true">${i}</span>`;
    }
    container.appendChild(cell);
  });

  const start = document.createElement("span");
  start.className = "landmark landmark-start";
  start.textContent = "🏁";
  start.style.left = `${(coords[0].x / VIEW_W) * 100}%`;
  start.style.top = `${((coords[0].y - 58) / viewH) * 100}%`;
  start.setAttribute("aria-hidden", "true");
  container.appendChild(start);

  const goal = document.createElement("span");
  goal.className = "landmark landmark-goal";
  goal.textContent = "✨";
  const last = coords[coords.length - 1];
  goal.style.left = `${(last.x / VIEW_W) * 100}%`;
  goal.style.top = `${((last.y - 58) / viewH) * 100}%`;
  goal.setAttribute("aria-hidden", "true");
  container.appendChild(goal);

  const layer = document.createElement("div");
  layer.className = "pion-layer";
  container.appendChild(layer);
}

function updatePions(container, layout, pions, currentPionId) {
  const { coords, viewH } = geometry(layout.length);
  const layer = container.querySelector(".pion-layer");
  const seen = new Set();

  const byCase = new Map();
  for (const p of pions) {
    if (!byCase.has(p.position)) byCase.set(p.position, []);
    byCase.get(p.position).push(p);
  }

  for (const [pos, group] of byCase) {
    const { x, y } = coords[Math.max(0, Math.min(layout.length - 1, pos))];
    group.forEach((p, i) => {
      seen.add(p.id);
      let token = layer.querySelector(`[data-pion="${p.id}"]`);
      if (!token) {
        token = document.createElement("div");
        token.dataset.pion = String(p.id);
        token.textContent = p.emoji;
        layer.appendChild(token);
      }
      token.className = "pion" + (p.id === currentPionId ? " pion-actif" : "");
      token.style.setProperty("--pion-color", p.couleur);
      const angle = (i / Math.max(1, group.length)) * 2 * Math.PI;
      const spread = group.length > 1 ? 16 : 0;
      const px = x + Math.cos(angle) * spread;
      const py = y - 26 + Math.sin(angle) * (spread * 0.6);
      token.style.left = `${(px / VIEW_W) * 100}%`;
      token.style.top = `${(py / viewH) * 100}%`;
      token.title = p.nom;
      token.setAttribute("aria-label", `${p.nom}, case ${pos}`);
    });
  }

  for (const token of [...layer.querySelectorAll(".pion")]) {
    if (!seen.has(Number(token.dataset.pion))) token.remove();
  }
}
