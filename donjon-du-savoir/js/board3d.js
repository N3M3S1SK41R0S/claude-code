// Rendu 3D du plateau (WebGL via three.js embarqué, global THREE). Façon Mario
// Party : le chemin serpentin devient un ruban 3D, les héros sont des figurines
// posées dessus, et la CAMÉRA SUIT le joueur actif quand il avance. Purement
// visuel : les règles ne connaissent que des positions. Repli 2D garanti si
// WebGL est indisponible, l'immersion coupée, ou en test (voir use3D()).
import { BUILDINGS, CASE_TYPES, DECOR, boardGeometry, VIEW_W, heroArt } from "./board.js";
import {
  createAnimatedHero,
  createBuildingModel,
  createDungeonModule,
  createTileModel,
  disposeAnimatedHero,
  playHeroAnimation,
} from "./models3d.js";
import { getPrefs } from "./prefs.js";

const THREE = globalThis.THREE;

/* ---------- disponibilité & choix du renderer ---------- */

let webglCache = null;
let runtime3DDisabled = false;
export function webglAvailable() {
  if (webglCache !== null) return webglCache;
  if (!THREE) return (webglCache = false);
  try {
    const c = document.createElement("canvas");
    webglCache = !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch { webglCache = false; }
  return webglCache;
}

/** Faut-il rendre en 3D ? Le confort et l'autonomie passent avant l'effet :
 *  mouvements réduits ou appareil très contraint gardent le plateau 2D. */
export function use3D() {
  if (globalThis.__DONJON_TEST) return false;
  if (runtime3DDisabled) return false;
  const prefs = getPrefs();
  if (prefs.immersion === false || prefs.animations === "reduites") return false;
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  if (Number(navigator.deviceMemory || 4) <= 2) return false;
  if (Number(navigator.hardwareConcurrency || 4) <= 2) return false;
  return webglAvailable();
}

/* ---------- état de la scène ---------- */

const SPAN = 26; // largeur du plateau en unités-monde
let R = null; // renderer
let scene = null, camera = null, raf = null;
let boardGroup = null, pionGroup = null, effectGroup = null, starMesh = null;
let builtSig = null;
const pionObjs = new Map(); // id -> { obj, target:THREE.Vector3, walk:[Vector3]|null, wi:0 }
const caseEffects = [];
const animatedTiles = [];
let sceneEpoch = 0; // invalide les chargements async d'un ancien plateau
let focusId = null; // pion suivi par la caméra
const camPos = THREE ? new THREE.Vector3(0, 24, 30) : null;
const camLook = THREE ? new THREE.Vector3(0, 0, 0) : null;
// Vue d'ensemble (recadrée sur tout le plateau) — recalculée par plateau.
const overPos = THREE ? new THREE.Vector3(0, 24, 30) : null;
const overLook = THREE ? new THREE.Vector3(0, 0, 0) : null;
let mounted = null; // conteneur canvas
let qualityReduced = false, perfStarted = 0, perfFrames = 0, lowFpsWindows = 0;

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

const SKYBOX_PALETTE = {
  donjon: ["#463065", "#130d25", "#e0b04a"],
  crypte: ["#365541", "#091710", "#7fd39a"],
  tour: ["#713744", "#190c1b", "#e57962"],
  labyrinthe: ["#786526", "#1b1608", "#f2cf62"],
  catacombes: ["#27636a", "#08171b", "#69d4d4"],
};
const skyboxCache = new Map();

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** Cubemap originale et légère : six petits canevas peints localement par
 *  thème. Aucun panorama externe, aucune requête, et une vraie profondeur de
 *  ciel autour de la caméra. */
function themeSkybox(theme) {
  const id = SKYBOX_PALETTE[theme] ? theme : "donjon";
  if (skyboxCache.has(id)) return skyboxCache.get(id);
  const [haut, bas, accent] = SKYBOX_PALETTE[id];
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 192);
    gradient.addColorStop(0, face === 2 ? haut : bas);
    gradient.addColorStop(1, face === 3 ? "#08060e" : haut);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 192, 192);
    const random = seededRandom([...id].reduce((sum, char) => sum + char.charCodeAt(0), face * 997 + 31));
    for (let i = 0; i < 34; i++) {
      const radius = 0.6 + random() * 2.2;
      ctx.globalAlpha = 0.16 + random() * 0.5;
      ctx.fillStyle = i % 5 === 0 ? accent : "#fff4d6";
      ctx.beginPath();
      ctx.arc(random() * 192, random() * 154, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(96, 198, 76 + face * 3, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return canvas;
  });
  const texture = new THREE.CubeTexture(faces);
  texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  skyboxCache.set(id, texture);
  return texture;
}

// Bâtiment « repère » posé sur certaines cases (on reconnaît l'échoppe, etc.).
const CASE_BUILDING = {
  boutique: { id: "boutique", art: "assets/batiment-boutique.png" },
  gambit: { id: "taverne", art: "assets/batiment-taverne.png" },
  trounoir: { id: "portail", art: "assets/batiment-portail.png" },
  insolite: { id: "champignon", art: "assets/batiment-champignon.png" },
  expression: { id: "taverne", art: "assets/batiment-taverne.png" },
  evenement: { id: "fontaine", art: "assets/batiment-fontaine.png" },
  arrivee: { id: "chateau", art: "assets/batiment-chateau.png" },
  depart: { id: "pont", art: "assets/batiment-pont.png" },
};

const BUILDING_ID = {
  "assets/batiment-chateau.png": "chateau",
  "assets/batiment-etoile.png": "etoile",
  "assets/batiment-tour-mage.png": "tour-mage",
  "assets/batiment-bibliotheque.png": "bibliotheque",
  "assets/batiment-taverne.png": "taverne",
  "assets/batiment-portail.png": "portail",
  "assets/batiment-boutique.png": "boutique",
  "assets/batiment-fontaine.png": "fontaine",
  "assets/batiment-pont.png": "pont",
  "assets/batiment-champignon.png": "champignon",
};

const DUNGEON_LAYOUT = [
  { id: "mur", u: 0.02, v: 0.47, h: 3.1, ry: Math.PI / 2 },
  { id: "arche", u: 0.51, v: 0.025, h: 3.5, ry: 0 },
  { id: "colonne", u: 0.985, v: 0.47, h: 3.2, ry: 0 },
  { id: "brasero", u: 0.17, v: 0.035, h: 2.2, ry: 0 },
  { id: "brasero", u: 0.83, v: 0.035, h: 2.2, ry: 0 },
];

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
    const maxRatio = Number(navigator.deviceMemory || 4) <= 4 ? 1.5 : 2;
    R.setPixelRatio(Math.min(maxRatio, window.devicePixelRatio || 1));
    R.outputEncoding = THREE.sRGBEncoding;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.08;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a1230, 34, 74);

    camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    scene.add(new THREE.HemisphereLight(0xffe8c6, 0x25183e, 0.68));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.1);
    key.position.set(-14, 26, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -28; key.shadow.camera.right = 28;
    key.shadow.camera.top = 28; key.shadow.camera.bottom = -28;
    key.shadow.camera.near = 1; key.shadow.camera.far = 70;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8e6cff, 0.4);
    rim.position.set(16, 10, -14);
    scene.add(rim);

    boardGroup = new THREE.Group();
    pionGroup = new THREE.Group();
    effectGroup = new THREE.Group();
    scene.add(boardGroup, pionGroup, effectGroup);
    qualityReduced = false;
    perfStarted = perfFrames = lowFpsWindows = 0;

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
  while (caseEffects.length) removeCaseEffect(caseEffects.pop());
  for (const rec of pionObjs.values()) disposePion(rec);
  animatedTiles.length = 0;
  sceneEpoch += 1;
  R = scene = camera = boardGroup = pionGroup = effectGroup = starMesh = null;
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
  // Vraie cubemap par thème ; l'illustration WebP locale reste le dernier repli.
  try { scene.background = themeSkybox(boardDef.theme); }
  catch {
    try { scene.background = loadTex(THEME_FOND[boardDef.theme] ?? THEME_FOND.donjon); } catch { /* fond uni */ }
  }
  while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
  while (caseEffects.length) removeCaseEffect(caseEffects.shift());
  animatedTiles.length = 0;
  // Nouveau plateau : on repart de pions neufs (personnages potentiellement
  // différents) pour ne pas réutiliser une figurine périmée.
  for (const rec of pionObjs.values()) { pionGroup.remove(rec.obj); disposePion(rec); }
  pionObjs.clear();
  sceneEpoch += 1;
  const epoch = sceneEpoch;

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
  ground.receiveShadow = true;
  boardGroup.add(ground);

  // Ruban du chemin (tube lissé passant par les centres de case).
  const pts = coords.map((c) => new THREE.Vector3((c.x - VIEW_W / 2) * s, -0.12, (c.y - viewH / 2) * s));
  if (pts.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, length * 4, 1.15, 8, false),
      new THREE.MeshStandardMaterial({ color: hex(boardDef.road || "#4a3a78"), roughness: 0.9 }),
    );
    tube.castShadow = true;
    tube.receiveShadow = true;
    boardGroup.add(tube);
  }

  // Une tuile 3D par case, teintée par son type ; bâtiment-repère sur certaines.
  const tileGeo = new THREE.CylinderGeometry(1.05, 1.2, 0.5, 20);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < length; i++) {
    const type = layout[i];
    const t = CASE_TYPES[type] ?? CASE_TYPES.question;
    const mat = new THREE.MeshStandardMaterial({ color: hex(t.couleur), roughness: 0.6, metalness: 0.05 });
    const p = worldOf(i, length);
    const anchor = new THREE.Group();
    anchor.position.set(p.x, 0, p.z);
    const tile = new THREE.Mesh(tileGeo, mat);
    tile.castShadow = true;
    tile.receiveShadow = true;
    anchor.add(tile);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    const special = type === "depart" || type === "arrivee";
    if (special) anchor.scale.set(1.3, 1.3, 1.3);
    boardGroup.add(anchor);
    if (["chance", "evenement", "joker", "gambit", "trounoir"].includes(type)) {
      animatedTiles.push({ anchor, type, phase: i * 0.73 });
    }
    upgradeStatic(anchor, tile, createTileModel(type), epoch, `socle ${type}`);
    // Bâtiment posé DERRIÈRE la case-repère (le héros se tient devant).
    const bat = CASE_BUILDING[type];
    if (bat) addBuilding(bat.id, bat.art, p.clone().setZ(p.z - 1.6), type === "arrivee" ? 6.5 : 4.6, epoch);
  }

  // Bâtiments et décors d'ambiance aux abords du plateau (village de donjon).
  for (const b of BUILDINGS) {
    addBuilding(BUILDING_ID[b.art], b.art, worldUV(b.u, b.v, length), b.w * (SPAN / 100) * 1.35, epoch);
  }
  // Modules de pierre réemployés aux quatre bords : ils composent le donjon
  // sans multiplier les assets ni charger de grande scène monolithique.
  for (const module of DUNGEON_LAYOUT) {
    const anchor = new THREE.Group();
    anchor.position.copy(worldUV(module.u, module.v, length));
    anchor.rotation.y = module.ry;
    boardGroup.add(anchor);
    upgradeStatic(anchor, null, createDungeonModule(module.id, module.h), epoch, `module ${module.id}`);
  }
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

const warnedModels = new Set();
function upgradeStatic(anchor, fallback, promise, epoch, label) {
  Promise.resolve(promise).then((model) => {
    if (!model || epoch !== sceneEpoch || anchor.parent !== boardGroup) return;
    if (fallback) {
      anchor.remove(fallback);
      fallback.material?.dispose?.();
    }
    anchor.add(model);
  }).catch((error) => {
    if (warnedModels.has(label)) return;
    warnedModels.add(label);
    console.warn(`Modèle 3D ${label} indisponible, repli conservé :`, error);
  });
}

function addBuilding(id, art, position, height, epoch) {
  const anchor = new THREE.Group();
  anchor.position.copy(position);
  const fallback = standee(art, new THREE.Vector3(), height);
  anchor.add(fallback);
  boardGroup.add(anchor);
  upgradeStatic(anchor, fallback, createBuildingModel(id, height), epoch, `bâtiment ${id}`);
}

/* ---------- mises en scène courtes des cases ---------- */

const CASE_EFFECT_COLOR = {
  question: 0x4f8de0,
  chance: 0x4fd18a,
  evenement: 0xe3a44c,
  malus: 0xdb5656,
  pieces: 0xf0c84d,
  joker: 0xa66ce0,
  gambit: 0x55d0d8,
  trounoir: 0x5d3a86,
  boutique: 0xdc72b3,
  insolite: 0xf06b9f,
  expression: 0xdd7845,
  arrivee: 0xf0c84d,
  depart: 0x67c36b,
};

function effectGeometry(type) {
  if (type === "pieces") return new THREE.CylinderGeometry(0.16, 0.16, 0.055, 10);
  if (type === "joker") return new THREE.BoxGeometry(0.25, 0.38, 0.045);
  if (type === "gambit") return new THREE.BoxGeometry(0.24, 0.24, 0.24);
  if (type === "trounoir") return new THREE.TorusGeometry(0.34, 0.055, 6, 18);
  if (type === "malus") return new THREE.ConeGeometry(0.15, 0.42, 7);
  if (type === "expression") return new THREE.TorusGeometry(0.14, 0.035, 5, 12);
  return new THREE.OctahedronGeometry(0.16, 0);
}

function removeCaseEffect(effect) {
  if (!effect) return;
  effectGroup?.remove(effect.group);
  effect.geometry?.dispose?.();
  effect.material?.dispose?.();
}

/** Déclenche une pluie, un vortex ou un éclat coloré à l'emplacement du pion.
 *  Purement visuel : aucun délai de jeu, aucun impact sur la logique. */
export function stageCase3D(type, pionId) {
  const rec = pionObjs.get(pionId);
  if (!effectGroup || !rec?.obj) return;
  while (caseEffects.length >= 3) removeCaseEffect(caseEffects.shift());

  const color = CASE_EFFECT_COLOR[type] ?? CASE_EFFECT_COLOR.question;
  const geometry = effectGeometry(type);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.32,
    metalness: type === "pieces" ? 0.55 : 0.08,
    roughness: 0.42,
    transparent: true,
  });
  const group = new THREE.Group();
  group.position.copy(rec.obj.position);
  const count = Number(navigator.deviceMemory || 4) <= 4 ? 12 : 18;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const object = new THREE.Mesh(geometry, material);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.25;
    const radius = type === "trounoir" ? 0.08 : 0.2 + Math.random() * 0.5;
    object.position.set(Math.cos(angle) * radius, Math.random() * 0.35, Math.sin(angle) * radius);
    object.rotation.set(Math.random() * Math.PI, angle, Math.random() * Math.PI);
    object.castShadow = true;
    group.add(object);
    particles.push({
      object,
      velocity: new THREE.Vector3(Math.cos(angle) * (0.7 + Math.random()), 1.3 + Math.random() * 1.4, Math.sin(angle) * (0.7 + Math.random())),
      spin: (Math.random() - 0.5) * 5,
    });
  }
  const light = new THREE.PointLight(color, 1.15, 6);
  light.position.y = 1.2;
  group.add(light);
  effectGroup.add(group);
  caseEffects.push({ type, group, particles, light, geometry, material, age: 0, ttl: type === "trounoir" ? 2.8 : 2.25 });
}

/* ---------- pions ---------- */

function makePionSprite(p) {
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

function disposePion(rec) {
  disposeAnimatedHero(rec?.hero);
  if (rec?.obj?.isSprite) rec.obj.material?.dispose?.();
}

function markLoadedModels() {
  if (!mounted?.canvas) return;
  mounted.canvas.dataset.heroModels = String([...pionObjs.values()].filter((rec) => rec.hero).length);
}

/** Affiche immédiatement le sprite 2D, puis le remplace par le GLB lorsque le
 *  décodeur a fini. Un modèle manquant ne bloque donc jamais la partie. */
function makePion(p) {
  const rec = {
    obj: makePionSprite(p),
    hero: null,
    walk: null,
    wi: 0,
    target: null,
    active: false,
    reactionUntil: 0,
    epoch: sceneEpoch,
  };
  createAnimatedHero(p.characterId).then((hero) => {
    if (rec.epoch !== sceneEpoch || pionObjs.get(p.id) !== rec || !pionGroup) {
      disposeAnimatedHero(hero);
      return;
    }
    hero.object.position.copy(rec.obj.position);
    hero.object.rotation.copy(rec.obj.rotation);
    pionGroup.remove(rec.obj);
    rec.obj.material?.dispose?.();
    rec.obj = hero.object;
    rec.hero = hero;
    rec.obj.scale.setScalar(rec.active ? 1.08 : 1);
    if (rec.walk) playHeroAnimation(hero, "walk");
    else if (rec.reactionUntil > performance.now()) {
      playHeroAnimation(hero, rec.pendingReaction);
    }
    pionGroup.add(rec.obj);
    markLoadedModels();
  }).catch((error) => {
    // Le sprite reste jouable : le journal suffit pour diagnostiquer l'asset.
    console.warn(`Figurine 3D ${p.characterId} indisponible, sprite conservé :`, error);
  });
  return rec;
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
      starMesh.castShadow = true;
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
      if (!rec) { rec = makePion(p); pionObjs.set(p.id, rec); }
      const base = worldOf(pos, layout.length);
      const spread = group.length > 1 ? 1.4 : 0;
      const ang = (i / Math.max(1, group.length)) * Math.PI * 2;
      const target = new THREE.Vector3(base.x + Math.cos(ang) * spread, 0.55, base.z + Math.sin(ang) * spread);
      rec.target = target;
      if (!rec.walk) rec.obj.position.lerp(target, 1); // pose directe si pas de trajet en cours
      rec.obj.material && (rec.obj.material.opacity = 1);
      // Halo du pion actif (léger agrandissement).
      const activeScale = p.id === currentPionId ? 3.2 : 2.8;
      if (rec.obj.isSprite) rec.obj.scale.set(activeScale, activeScale, 1);
      else rec.obj.scale.setScalar(p.id === currentPionId ? 1.08 : 1);
      rec.active = p.id === currentPionId;
    });
  }
  // Retire les pions disparus.
  for (const [id, rec] of pionObjs) {
    if (!seen.has(id)) { pionGroup.remove(rec.obj); disposePion(rec); pionObjs.delete(id); markLoadedModels(); }
  }
  updateMinimap(hostBoard, layout, pions, currentPionId, starPos);
  return true;
}

/** Anime un pion le long du chemin (case par case) et fait suivre la caméra. */
export function walk3D(pionId, path, length) {
  const rec = pionObjs.get(pionId);
  if (!rec || !Array.isArray(path) || path.length === 0) return;
  rec.walk = path.map((pos) => worldOf(pos, length).setY(0.55));
  rec.wi = 0;
  focusId = pionId;
  playHeroAnimation(rec.hero, "walk");
}

/** Réaction visuelle à une réponse. Sans 3D ou pendant un repli, c'est un
 *  no-op : le moteur de jeu reste entièrement indépendant du rendu. */
export function react3D(pionId, success) {
  const rec = pionObjs.get(pionId);
  if (!rec) return;
  rec.pendingReaction = success ? "joy" : "disappointment";
  rec.reactionUntil = performance.now() + 1500;
  playHeroAnimation(rec.hero, rec.pendingReaction);
}

/* ---------- boucle de rendu ---------- */

let lastFrame = 0;
function watchPerformance(now) {
  if (!perfStarted) perfStarted = now;
  perfFrames += 1;
  const elapsed = now - perfStarted;
  if (elapsed < 2500) return;
  const fps = (perfFrames * 1000) / elapsed;
  perfStarted = now;
  perfFrames = 0;
  if (fps >= 24) { lowFpsWindows = 0; return; }
  if (!qualityReduced) {
    qualityReduced = true;
    R.setPixelRatio(1);
    R.shadowMap.enabled = false;
    resize();
    return;
  }
  if (fps >= 20) { lowFpsWindows = 0; return; }
  lowFpsWindows += 1;
  if (lowFpsWindows < 2 || runtime3DDisabled) return;
  runtime3DDisabled = true;
  show3D(false);
  globalThis.dispatchEvent?.(new CustomEvent("donjon-3d-fallback"));
}

function loop(now = performance.now()) {
  raf = requestAnimationFrame(loop);
  if (!R) return;
  // Canvas non affiché (écran caché, ou vue 2D active) : offsetParent est null,
  // on ne rend rien pour épargner le GPU/la batterie ; la boucle reste programmée.
  if (document.hidden || (mounted && mounted.canvas.offsetParent === null)) {
    lastFrame = now;
    perfStarted = perfFrames = 0;
    return;
  }
  const dt = lastFrame ? Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000)) : 1 / 60;
  lastFrame = now;
  watchPerformance(now);

  // Avance les pions en trajet (vitesse ~ 7 unités/s).
  for (const rec of pionObjs.values()) {
    rec.hero?.mixer.update(dt);
    if (rec.walk) {
      const next = rec.walk[rec.wi];
      const d = next.clone().sub(rec.obj.position);
      const step = 9 * dt;
      if (d.length() <= step) {
        rec.obj.position.copy(next);
        rec.wi += 1;
        if (rec.wi >= rec.walk.length) {
          rec.walk = null;
          if (rec.target) rec.obj.position.copy(rec.target);
          playHeroAnimation(rec.hero, "idle");
        }
      } else {
        if (!rec.obj.isSprite) rec.obj.rotation.y = Math.atan2(d.x, d.z);
        rec.obj.position.add(d.normalize().multiplyScalar(step));
      }
    } else if (rec.target) {
      rec.obj.position.lerp(rec.target, 0.18);
    }
    if (!rec.walk && rec.reactionUntil && now >= rec.reactionUntil) {
      rec.reactionUntil = 0;
      playHeroAnimation(rec.hero, "idle");
    }
    // Petit sautillement du pion actif.
    if (rec.obj.isSprite) rec.obj.position.y = 0.55;
  }

  // Les cases spéciales respirent très légèrement au repos ; ce mouvement
  // n'existe jamais lorsque le réglage « mouvements réduits » impose la 2D.
  const time = now / 1000;
  for (const tile of animatedTiles) {
    tile.anchor.position.y = Math.sin(time * 1.4 + tile.phase) * 0.025;
    if (tile.type === "trounoir") tile.anchor.rotation.y += dt * 0.22;
  }

  for (let i = caseEffects.length - 1; i >= 0; i--) {
    const effect = caseEffects[i];
    effect.age += dt;
    const fade = Math.max(0, 1 - effect.age / effect.ttl);
    effect.material.opacity = fade;
    effect.light.intensity = fade * 1.15;
    effect.group.rotation.y += dt * (effect.type === "trounoir" ? 1.8 : 0.45);
    for (let j = 0; j < effect.particles.length; j++) {
      const particle = effect.particles[j];
      if (effect.type === "trounoir") {
        const pulse = 0.7 + Math.sin(effect.age * 5 + j) * 0.18;
        particle.object.scale.setScalar(pulse);
        particle.object.rotation.z += dt * (1 + j * 0.04);
      } else {
        particle.object.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= dt * 1.8;
        particle.object.rotation.x += dt * particle.spin;
        particle.object.rotation.z -= dt * particle.spin * 0.7;
      }
    }
    if (effect.age >= effect.ttl) {
      caseEffects.splice(i, 1);
      removeCaseEffect(effect);
    }
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
