// Board generation and rendering — a Mario-Party-style winding path:
// round spaces on a meandering road drawn in SVG, dungeon scenery, and a
// persistent pion layer so tokens glide from space to space.
// Case types and frequencies come from §4 of the cahier des charges.

export const BOARD_LENGTH = 42;

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
};

/**
 * Build the 42-case layout. Fixed: départ (0), arrivée (41), gambits (14, 28),
 * trou noir (38). The rest follows the §4 frequencies, shuffled, with the
 * first travelled cases guaranteed harmless.
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

  const fill = [
    ...Array(19).fill("question"),
    ...Array(5).fill("chance"),
    ...Array(4).fill("evenement"),
    ...Array(5).fill("malus"),
    ...Array(3).fill("pieces"),
    ...Array(2).fill("joker"),
  ];
  while (fill.length < free.length) fill.push("question");

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
  return layout;
}

/* ---------- path geometry (viewBox 1000 × 700) ---------- */

const VIEW_W = 1000;
const VIEW_H = 700;

/** Meandering serpentine: 4 rows (11/10/11/10), organic wobble on Y. */
function buildCoords() {
  const rows = [11, 10, 11, 10];
  const yBase = [610, 452, 294, 136];
  const coords = [];
  let index = 0;
  rows.forEach((count, r) => {
    const margin = r % 2 === 0 ? 70 : 105; // alternate margins → rounder turns
    const step = (VIEW_W - margin * 2) / (count - 1);
    for (let c = 0; c < count; c++) {
      const along = r % 2 === 0 ? c : count - 1 - c;
      const x = margin + step * along;
      const wobble = Math.sin(index * 1.9) * 20 + Math.cos(index * 0.7) * 8;
      coords.push({ x, y: yBase[r] + wobble });
      index += 1;
    }
  });
  return coords.slice(0, BOARD_LENGTH);
}

const COORDS = buildCoords();

/** Catmull-Rom spline through the case centers → smooth SVG road. */
function roadPath() {
  const p = COORDS;
  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Dungeon scenery sprinkled around the road (decorative only). */
const DECOR = [
  { e: "🏰", x: 30, y: 660, s: 44 }, { e: "🌲", x: 190, y: 680, s: 26 },
  { e: "🕯️", x: 975, y: 640, s: 24 }, { e: "🍄", x: 955, y: 528, s: 22 },
  { e: "🦇", x: 60, y: 385, s: 22 }, { e: "🕸️", x: 25, y: 505, s: 26 },
  { e: "💎", x: 965, y: 370, s: 22 }, { e: "🗿", x: 30, y: 215, s: 30 },
  { e: "🌋", x: 850, y: 60, s: 30 }, { e: "🦴", x: 500, y: 675, s: 20 },
  { e: "⭐", x: 968, y: 96, s: 26 }, { e: "🔥", x: 120, y: 62, s: 22 },
];

/* ---------- rendering ---------- */

let builtSignature = null;

/**
 * Render (or update) the board. The static part — road, scenery, spaces —
 * is built once per layout; the pion layer is updated in place so CSS
 * transitions make the tokens glide.
 */
export function renderBoard(container, layout, pions, currentPionId) {
  const signature = layout.join(",");
  if (builtSignature !== signature || !container.querySelector(".pion-layer")) {
    buildStatic(container, layout);
    builtSignature = signature;
  }
  updatePions(container, layout, pions, currentPionId);
}

function buildStatic(container, layout) {
  container.innerHTML = "";
  container.classList.add("board-map");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("board-svg");
  svg.setAttribute("aria-hidden", "true");
  const d = roadPath();
  svg.innerHTML = `
    <path d="${d}" fill="none" stroke="#0e0a1c" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <path d="${d}" fill="none" stroke="#4a3a78" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#e0b04a" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" opacity="0.7"/>`;
  container.appendChild(svg);

  for (const dec of DECOR) {
    const span = document.createElement("span");
    span.className = "decor";
    span.textContent = dec.e;
    span.style.left = `${(dec.x / VIEW_W) * 100}%`;
    span.style.top = `${(dec.y / VIEW_H) * 100}%`;
    span.style.fontSize = `${dec.s / 10}cqw`;
    span.setAttribute("aria-hidden", "true");
    container.appendChild(span);
  }

  layout.forEach((type, i) => {
    const def = CASE_TYPES[type];
    const { x, y } = COORDS[i];
    const cell = document.createElement("div");
    cell.className = `case case-${type}`;
    cell.style.left = `${(x / VIEW_W) * 100}%`;
    cell.style.top = `${(y / VIEW_H) * 100}%`;
    cell.style.setProperty("--case-color", def.couleur);
    cell.dataset.index = String(i);
    cell.title = `Case ${i} — ${def.label}`;
    cell.innerHTML = `<span class="case-emoji" aria-hidden="true">${def.emoji}</span>`;
    if (i !== 0 && i !== layout.length - 1) {
      cell.innerHTML += `<span class="case-num" aria-hidden="true">${i}</span>`;
    }
    container.appendChild(cell);
  });

  // Landmarks: gate at the start, glowing treasure at the goal.
  const start = document.createElement("span");
  start.className = "landmark landmark-start";
  start.textContent = "🏁";
  start.style.left = `${(COORDS[0].x / VIEW_W) * 100}%`;
  start.style.top = `${((COORDS[0].y - 58) / VIEW_H) * 100}%`;
  start.setAttribute("aria-hidden", "true");
  container.appendChild(start);

  const goal = document.createElement("span");
  goal.className = "landmark landmark-goal";
  goal.textContent = "✨";
  const last = COORDS[BOARD_LENGTH - 1];
  goal.style.left = `${(last.x / VIEW_W) * 100}%`;
  goal.style.top = `${((last.y - 58) / VIEW_H) * 100}%`;
  goal.setAttribute("aria-hidden", "true");
  container.appendChild(goal);

  const layer = document.createElement("div");
  layer.className = "pion-layer";
  container.appendChild(layer);
}

function updatePions(container, layout, pions, currentPionId) {
  const layer = container.querySelector(".pion-layer");
  const seen = new Set();

  const byCase = new Map();
  for (const p of pions) {
    if (!byCase.has(p.position)) byCase.set(p.position, []);
    byCase.get(p.position).push(p);
  }

  for (const [pos, group] of byCase) {
    const { x, y } = COORDS[Math.max(0, Math.min(BOARD_LENGTH - 1, pos))];
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
      // Tokens stand slightly ABOVE their space, like figures on a path.
      const px = x + Math.cos(angle) * spread;
      const py = y - 26 + Math.sin(angle) * (spread * 0.6);
      token.style.left = `${(px / VIEW_W) * 100}%`;
      token.style.top = `${(py / VIEW_H) * 100}%`;
      token.title = p.nom;
      token.setAttribute("aria-label", `${p.nom}, case ${pos}`);
    });
  }

  for (const token of [...layer.querySelectorAll(".pion")]) {
    if (!seen.has(Number(token.dataset.pion))) token.remove();
  }
}
