// Rendu 3D du plateau (WebGL via three.js embarqué, global THREE). Façon Mario
// Party : le chemin serpentin devient un ruban 3D, les héros sont des figurines
// posées dessus, et la CAMÉRA SUIT le joueur actif quand il avance. Purement
// visuel : les règles ne connaissent que des positions. Repli 2D garanti si
// WebGL est indisponible, l'immersion coupée, ou en test (voir use3D()).
import { BUILDINGS, CASE_TYPES, DECOR, boardGeometry, VIEW_W, heroArt } from "./board.js";
import { getPrefs } from "./prefs.js";

const THREE = globalThis.THREE;

/* ---------- disponibilité & choix du renderer ---------- */

let webglCache = null;
export function webglAvailable() {
  if (webglCache !== null) return webglCache;
  if (!THREE) return (webglCache = false);
  try {
    const c = document.createElement("canvas");
    webglCache = !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch { webglCache = false; }
  return webglCache;
}

/** Faut-il rendre en 3D ? Immersion activée + WebGL dispo + hors tests. */
export function use3D() {
  if (globalThis.__DONJON_TEST) return false;
  if (getPrefs().immersion === false) return false;
  return webglAvailable();
}

/* ---------- état de la scène ---------- */

const SPAN = 26; // largeur du plateau en unités-monde
let R = null; // renderer
let scene = null, camera = null, raf = null;
let boardGroup = null, pionGroup = null, starMesh = null;
let builtSig = null;
const pionObjs = new Map(); // id -> { obj, target:THREE.Vector3, walk:[Vector3]|null, wi:0 }
let focusId = null; // pion suivi par la caméra
const camPos = THREE ? new THREE.Vector3(0, 24, 30) : null;
const camLook = THREE ? new THREE.Vector3(0, 0, 0) : null;
// Vue d'ensemble (recadrée sur tout le plateau) — recalculée par plateau.
const overPos = THREE ? new THREE.Vector3(0, 24, 30) : null;
const overLook = THREE ? new THREE.Vector3(0, 0, 0) : null;
let mounted = null; // conteneur canvas

/* ---------- utilitaires de coordonnées ---------- */

function worldOf(pos, length) {
  const { coords, viewH } = boardGeometry(length);
  const c = coords[Math.max(0, Math.min(length - 1, pos))];
  const s = SPAN / VIEW_W;
  return new THREE.Vector3((c.x - VIEW_W / 2) * s, 0, (c.y - viewH / 2) * s);
}

/** Position monde d'un point relatif (u,v ∈ 0-1) — pour bâtiments et décors. */
function worldUV(u, v, length) {
  const { viewH } = boardGeometry(length);
  const s = SPAN / VIEW_W;
  return new THREE.Vector3((u - 0.5) * SPAN, 0, (v - 0.5) * viewH * s);
}

function hex(color) {
  return new THREE.Color(color);
}

// Textures partagées (une par image) pour éviter de recharger le même PNG.
const texCache = new Map();
function loadTex(src) {
  if (texCache.has(src)) return texCache.get(src);
  const t = new THREE.TextureLoader().load(src);
  t.encoding = THREE.sRGBEncoding;
  texCache.set(src, t);
  return t;
}

/** Panneau debout (billboard) posé au sol en `pos`, haut de `height` unités. */
function standee(art, pos, height) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: loadTex(art), transparent: true, depthWrite: false }));
  spr.center.set(0.5, 0);
  spr.scale.set(height * 0.92, height, 1);
  spr.position.copy(pos);
  return spr;
}

// Fond peint du donjon (thème) posé en toile de fond de la scène 3D.
const THEME_FOND = {
  donjon: "assets/fond-donjon.webp",
  crypte: "assets/fond-crypte.webp",
  tour: "assets/fond-tour.webp",
  labyrinthe: "assets/fond-labyrinthe.webp",
  catacombes: "assets/fond-catacombes.webp",
};

// Bâtiment « repère » posé sur certaines cases (on reconnaît l'échoppe, etc.).
const CASE_BUILDING = {
  boutique: "assets/batiment-boutique.png",
  gambit: "assets/batiment-taverne.png",
  trounoir: "assets/batiment-portail.png",
  insolite: "assets/batiment-champignon.png",
  expression: "assets/batiment-taverne.png",
  evenement: "assets/batiment-fontaine.png",
  arrivee: "assets/batiment-chateau.png",
  depart: "assets/batiment-pont.png",
};

/* ---------- init / dispose ---------- */

/** Crée (une fois) le canvas 3D dans le conteneur du plateau et démarre la
 *  boucle de rendu. Renvoie false si l'init échoue (→ repli 2D). */
export function init3D(hostBoard) {
  if (R) return true;
  if (!THREE || !webglAvailable()) return false;
  try {
    const host = hostBoard.parentElement || hostBoard; // .board-scroll
    const canvas = document.createElement("canvas");
    canvas.className = "board3d-canvas";
    host.insertBefore(canvas, host.firstChild);
    mounted = { host, canvas, hostBoard };

    R = new THREE.WebGLRenderer({ canvas, antialias: true });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a1230, 34, 74);

    camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xfff0d8, 0.95);
    key.position.set(-14, 26, 12);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8e6cff, 0.4);
    rim.position.set(16, 10, -14);
    scene.add(rim);

    boardGroup = new THREE.Group();
    pionGroup = new THREE.Group();
    scene.add(boardGroup, pionGroup);

    resize();
    window.addEventListener("resize", resize);
    loop();
    return true;
  } catch (e) {
    console.warn("3D indisponible, repli 2D :", e);
    dispose3D();
    return false;
  }
}

function resize() {
  if (!R || !mounted) return;
  const w = mounted.host.clientWidth || 360;
  const h = Math.round(w * 0.7); // même proportion que le plateau 2D (10/7)
  R.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  mounted.canvas.style.height = `${h}px`;
}

export function dispose3D() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  window.removeEventListener("resize", resize);
  try { R?.dispose?.(); } catch { /* ignore */ }
  mounted?.canvas?.remove();
  minimapEl?.remove();
  R = scene = camera = boardGroup = pionGroup = starMesh = null;
  builtSig = null; focusId = null; mounted = null; minimapEl = null;
  pionObjs.clear();
}

/** Montre/masque la vue 3D (et cache la carte 2D quand la 3D est active). */
export function show3D(on) {
  if (mounted) {
    mounted.canvas.style.display = on ? "block" : "none";
    mounted.hostBoard.style.display = on ? "none" : "";
    if (minimapEl) minimapEl.style.display = on ? "block" : "none";
  }
}

/* ---------- mini-carte (vue d'ensemble du plateau) ---------- */

let minimapEl = null;
function updateMinimap(hostBoard, layout, pions, currentId, starPos) {
  const host = hostBoard.parentElement || hostBoard;
  const length = layout.length;
  const { coords, viewH } = boardGeometry(length);
  if (!minimapEl) { minimapEl = document.createElement("div"); minimapEl.className = "minimap"; minimapEl.setAttribute("aria-hidden", "true"); host.appendChild(minimapEl); }
  const W = 100, H = Math.round((100 * viewH) / VIEW_W);
  const nx = (x) => ((x / VIEW_W) * W).toFixed(1);
  const ny = (y) => ((y / viewH) * H).toFixed(1);
  const cl = (p) => coords[Math.max(0, Math.min(length - 1, p))];
  const pathD = coords.map((c, i) => `${i ? "L" : "M"}${nx(c.x)} ${ny(c.y)}`).join(" ");
  const star = starPos != null ? `<circle cx="${nx(cl(starPos).x)}" cy="${ny(cl(starPos).y)}" r="3.4" fill="#e0b04a" stroke="#1a1230" stroke-width="0.6"/>` : "";
  const dots = pions.map((p) => { const c = cl(p.position); return `<circle cx="${nx(c.x)}" cy="${ny(c.y)}" r="${p.id === currentId ? 4 : 2.6}" fill="${p.couleur || "#e0b04a"}" stroke="#fff" stroke-width="0.7"/>`; }).join("");
  minimapEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><path d="${pathD}" fill="none" stroke="#8e6cff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>${star}${dots}</svg>`;
}

/* ---------- construction du plateau ---------- */

function buildBoard(layout, boardDef) {
  const sig = `${boardDef.id}:${layout.length}`;
  if (builtSig === sig) return;
  builtSig = sig;
  // Toile de fond peinte selon le thème du donjon (ambiance).
  try { scene.background = loadTex(THEME_FOND[boardDef.theme] ?? THEME_FOND.donjon); } catch { /* repli : fond uni */ }
  while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
  // Nouveau plateau : on repart de pions neufs (personnages potentiellement
  // différents) pour ne pas réutiliser une figurine périmée.
  for (const rec of pionObjs.values()) pionGroup.remove(rec.obj);
  pionObjs.clear();

  const length = layout.length;
  const s = SPAN / VIEW_W;
  const { coords, viewH } = boardGeometry(length);

  // Sol du donjon.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SPAN * 2.4, (SPAN * viewH) / VIEW_W * 2.2),
    new THREE.MeshStandardMaterial({ color: 0x241a45, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  boardGroup.add(ground);

  // Ruban du chemin (tube lissé passant par les centres de case).
  const pts = coords.map((c) => new THREE.Vector3((c.x - VIEW_W / 2) * s, -0.12, (c.y - viewH / 2) * s));
  if (pts.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, length * 4, 1.15, 8, false),
      new THREE.MeshStandardMaterial({ color: hex(boardDef.road || "#4a3a78"), roughness: 0.9 }),
    );
    boardGroup.add(tube);
  }

  // Une tuile 3D par case, teintée par son type ; bâtiment-repère sur certaines.
  const tileGeo = new THREE.CylinderGeometry(1.05, 1.2, 0.5, 20);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < length; i++) {
    const type = layout[i];
    const t = CASE_TYPES[type] ?? CASE_TYPES.question;
    const mat = new THREE.MeshStandardMaterial({ color: hex(t.couleur), roughness: 0.6, metalness: 0.05 });
    const tile = new THREE.Mesh(tileGeo, mat);
    const p = worldOf(i, length);
    tile.position.set(p.x, 0, p.z);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    const special = type === "depart" || type === "arrivee";
    if (special) tile.scale.set(1.3, 1.6, 1.3);
    boardGroup.add(tile);
    // Bâtiment posé DERRIÈRE la case-repère (le héros se tient devant).
    const bat = CASE_BUILDING[type];
    if (bat) boardGroup.add(standee(bat, p.clone().setZ(p.z - 1.6), type === "arrivee" ? 6.5 : 4.6));
  }

  // Bâtiments et décors d'ambiance aux abords du plateau (village de donjon).
  for (const b of BUILDINGS) boardGroup.add(standee(b.art, worldUV(b.u, b.v, length), b.w * (SPAN / 100) * 1.35));
  for (const d of DECOR) boardGroup.add(standee(d.art, worldUV(d.u, d.v, length), d.s * 0.05 + 1.2));

  // Vue d'ensemble : recule assez pour cadrer TOUT le plateau (le joueur voit
  // le plateau global au repos ; la caméra ne se rapproche que pendant un trajet).
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ);
  const dist = Math.max(spanX * 0.62, spanZ * 0.95) + 12;
  overPos.set(cx, dist * 0.92, cz + dist * 0.82);
  overLook.set(cx, 0, cz + 1);
  camPos.copy(overPos); camLook.copy(overLook); // départ en vue d'ensemble
}

/* ---------- pions ---------- */

function makePion(p) {
  const art = heroArt(p.characterId);
  let obj;
  if (art) {
    const mat = new THREE.SpriteMaterial({ map: loadTex(art), transparent: true });
    obj = new THREE.Sprite(mat);
    obj.scale.set(2.8, 2.8, 1);
    obj.center.set(0.5, 0);
  } else {
    obj = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: hex(p.couleur || "#e0b04a") }),
    );
  }
  pionGroup.add(obj);
  return obj;
}

/* ---------- API de rendu (appelée par le moteur) ---------- */

/** Met à jour la scène 3D depuis l'état de jeu (même signature que le 2D). */
export function render3D(hostBoard, layout, pions, currentPionId, boardDef, starPos) {
  if (!R && !init3D(hostBoard)) return false;
  show3D(true);
  buildBoard(layout, boardDef);
  focusId = currentPionId;

  // Étoile (mode Étoiles).
  if (starPos != null) {
    if (!starMesh) {
      starMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.95),
        new THREE.MeshStandardMaterial({ color: 0xe0b04a, emissive: 0x7a5a12, roughness: 0.3 }),
      );
      scene.add(starMesh);
    }
    const sp = worldOf(starPos, layout.length);
    starMesh.position.set(sp.x, 1.9, sp.z);
  } else if (starMesh) { scene.remove(starMesh); starMesh = null; }

  const seen = new Set();
  // Regroupe par case pour écarter légèrement les pions superposés.
  const byCase = new Map();
  for (const p of pions) { if (!byCase.has(p.position)) byCase.set(p.position, []); byCase.get(p.position).push(p); }

  for (const [pos, group] of byCase) {
    group.forEach((p, i) => {
      seen.add(p.id);
      let rec = pionObjs.get(p.id);
      if (!rec) { rec = { obj: makePion(p), walk: null, wi: 0 }; pionObjs.set(p.id, rec); }
      const base = worldOf(pos, layout.length);
      const spread = group.length > 1 ? 1.4 : 0;
      const ang = (i / Math.max(1, group.length)) * Math.PI * 2;
      const target = new THREE.Vector3(base.x + Math.cos(ang) * spread, 0.35, base.z + Math.sin(ang) * spread);
      rec.target = target;
      if (!rec.walk) rec.obj.position.lerp(target, 1); // pose directe si pas de trajet en cours
      rec.obj.material && (rec.obj.material.opacity = 1);
      // Halo du pion actif (léger agrandissement).
      const activeScale = p.id === currentPionId ? 3.2 : 2.8;
      if (rec.obj.isSprite) rec.obj.scale.set(activeScale, activeScale, 1);
    });
  }
  // Retire les pions disparus.
  for (const [id, rec] of pionObjs) {
    if (!seen.has(id)) { pionGroup.remove(rec.obj); pionObjs.delete(id); }
  }
  updateMinimap(hostBoard, layout, pions, currentPionId, starPos);
  return true;
}

/** Anime un pion le long du chemin (case par case) et fait suivre la caméra. */
export function walk3D(pionId, path, length) {
  const rec = pionObjs.get(pionId);
  if (!rec || !Array.isArray(path) || path.length === 0) return;
  rec.walk = path.map((pos) => worldOf(pos, length).setY(0.35));
  rec.wi = 0;
  focusId = pionId;
}

/* ---------- boucle de rendu ---------- */

function loop() {
  raf = requestAnimationFrame(loop);
  if (!R) return;
  // Canvas non affiché (écran caché, ou vue 2D active) : offsetParent est null,
  // on ne rend rien pour épargner le GPU/la batterie ; la boucle reste programmée.
  if (mounted && mounted.canvas.offsetParent === null) return;
  const dt = 1 / 60;

  // Avance les pions en trajet (vitesse ~ 7 unités/s).
  for (const rec of pionObjs.values()) {
    if (rec.walk) {
      const next = rec.walk[rec.wi];
      const d = next.clone().sub(rec.obj.position);
      const step = 9 * dt;
      if (d.length() <= step) {
        rec.obj.position.copy(next);
        rec.wi += 1;
        if (rec.wi >= rec.walk.length) { rec.walk = null; if (rec.target) rec.obj.position.copy(rec.target); }
      } else {
        rec.obj.position.add(d.normalize().multiplyScalar(step));
      }
    } else if (rec.target) {
      rec.obj.position.lerp(rec.target, 0.18);
    }
    // Petit sautillement du pion actif.
    if (rec.obj.isSprite) rec.obj.position.y = 0.35;
  }

  // Caméra : au REPOS, vue d'ensemble (tout le plateau visible). Pendant un
  // TRAJET, elle se rapproche et suit le pion qui marche, puis revient.
  let walker = null;
  for (const rec of pionObjs.values()) { if (rec.walk) { walker = rec; break; } }
  if (walker) {
    const t = walker.obj.position;
    camPos.lerp(new THREE.Vector3(t.x * 0.55, 13, overLook.z * 0.2 + t.z + 14), 0.05);
    camLook.lerp(new THREE.Vector3(t.x * 0.6, 1.6, t.z - 2), 0.07);
  } else {
    camPos.lerp(overPos, 0.045);
    camLook.lerp(overLook, 0.045);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  R.render(scene, camera);
}
