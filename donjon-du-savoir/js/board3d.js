// Rendu 3D du plateau (WebGL via three.js embarqué, global THREE). Façon Mario
// Party : le chemin serpentin devient un ruban 3D, les héros sont des figurines
// posées dessus, et la CAMÉRA SUIT le joueur actif quand il avance. Purement
// visuel : les règles ne connaissent que des positions. Repli 2D garanti si
// WebGL est indisponible, l'immersion coupée, ou en test (voir use3D()).
import { BUILDINGS, CASE_TYPES, DECOR, boardGeometry, VIEW_W, heroArt } from "./board.js";
import {
  createAnimatedHero,
  createBuildingModel,
  createAnimatedPnj,
  createDecorModel,
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
// FIDÉLITÉ TRAIT POUR TRAIT : les personnages sont les FIGURINES PEINTES de
// GEN 2 (identiques aux portraits), animées par le code. Les GLB stylisés
// restent disponibles derrière ces drapeaux s'ils deviennent fidèles un jour.
const USE_GLB_HEROES = false;
const USE_GLB_PNJ = false;
const braseroLights = []; // flammes de braseros : lumière qui tremble dans la boucle
const animatedDecors = []; // nœuds « anim » des décors v3 (ailes, bannières, seaux)
const pnj3d = []; // PNJ GLB animés : idle + signature de temps en temps
const activeFx = []; // sprites d'effets (feuilles 4×4) en cours de lecture
let lastStarPos = null; // pour saluer l'achat d'étoile d'un halo
let dustCloud = null; // poussière dorée d'ambiance (un seul THREE.Points)
let camFocus = null; // gros plan bref quand un héros atterrit sur une case marquante
// Mode caméra au repos : « heros » (zoom sur le joueur actif, toujours visible)
// ou « ensemble » (tout le plateau). Persisté sur l'appareil.
let camMode = "heros";
try { if (localStorage.getItem("donjon-cam") === "ensemble") camMode = "ensemble"; } catch { /* privé */ }
let camBtn = null; // bouton de bascule posé sur le plateau 3D
let heroSpot = null; // projecteur doux qui suit le joueur actif
const swayPos = THREE ? new THREE.Vector3() : null; // cible du tilt doux au repos
const lookTmp = THREE ? new THREE.Vector3() : null; // regard temporaire (zéro alloc/frame)
// « On voit TOUJOURS son héros » : ce qui s'interpose entre la caméra et le
// joueur actif devient translucide (matériaux clonés, jamais partagés).
const occluderRay = THREE ? new THREE.Raycaster() : null;
const rayDir = THREE ? new THREE.Vector3() : null;
const fadedNow = new Set();
let fadedPrev = new Set();

/** Rend un objet (et tout son sous-arbre) translucide de façon PERMANENTE :
 *  on voit le plateau et les cases À TRAVERS les bâtiments. Idempotent. */
function ghostify(root, opacity) {
  root.traverse((child) => {
    if (!child.isMesh && !child.isSprite) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = true;
      m.opacity = Math.min(m.opacity ?? 1, opacity);
      m.depthWrite = false;
    }
  });
}

/** Réchauffe un modèle GLB sombre : éclaircit ses couleurs vers l'ivoire —
 *  les volumes v3 (moulin, puits, arbres…) ne virent plus à la silhouette
 *  sous l'étalonnage ACES, et s'accordent aux peintures. */
function rechauffe(root, force = 0.26) {
  const ivoire = new THREE.Color(0xf4ecd8);
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m?.color || m.userData?.rechauffe) continue;
      if (m.map && "emissive" in m) {
        // Texture sombre : le multiplicateur `color` ne peut pas dépasser le
        // blanc — on auto-illumine le décor par SA PROPRE texture.
        m.emissiveMap = m.map;
        m.emissive.set(0xffffff);
        m.emissiveIntensity = force;
      } else {
        m.color.lerp(ivoire, force);
      }
      if ("metalness" in m) m.metalness = Math.min(m.metalness ?? 0, 0.25);
      m.userData.rechauffe = true;
    }
  });
}

function fadeMesh(mesh) {
  if (!(mesh.isMesh || mesh.isSprite) || !mesh.material) return;
  if (!mesh.userData.fadeOrig) {
    mesh.userData.fadeOrig = mesh.material;
    const ghost = mesh.material.clone();
    ghost.transparent = true;
    ghost.opacity = 0.15; // quasi invisible : la vue du héros prime toujours
    ghost.depthWrite = false;
    mesh.userData.fadeGhost = ghost;
  }
  mesh.material = mesh.userData.fadeGhost;
  fadedNow.add(mesh);
}

function unfadeMesh(mesh) {
  if (mesh.userData.fadeOrig) mesh.material = mesh.userData.fadeOrig;
}

/** Racine « bâtiment » d'un objet touché : l'ancre enfant direct de boardGroup. */
function buildingRoot(obj) {
  let node = obj;
  while (node && node.parent && node.parent !== boardGroup) node = node.parent;
  return node && node.parent === boardGroup ? node : null;
}

function updateOccluders(heroPos) {
  fadedNow.clear();
  if (heroPos && occluderRay) {
    // TROIS rayons (tête, buste, pieds) : un bâtiment ne peut pas se glisser
    // entre deux rayons — le héros reste visible en entier, jamais à moitié.
    for (const hy of [2.3, 1.2, 0.3]) {
      rayDir.copy(heroPos).setY(heroPos.y + hy).sub(camPos);
      const dist = rayDir.length();
      occluderRay.set(camPos, rayDir.normalize());
      occluderRay.camera = camera; // requis par le raycast des sprites (r128)
      occluderRay.far = Math.max(0.1, dist - 1.2);
      for (const hit of occluderRay.intersectObject(boardGroup, true)) {
        const root = buildingRoot(hit.object);
        if (!root || root === dustCloud) continue;
        root.traverse((child) => fadeMesh(child));
      }
    }
    // Règle de PROXIMITÉ : tout bâtiment collé à la case du héros s'efface
    // aussi, même situé derrière lui — rien n'encombre jamais son décor proche.
    for (const child of boardGroup.children) {
      if (!child.userData?.isBatiment) continue;
      const dx = child.position.x - heroPos.x;
      const dz = child.position.z - heroPos.z;
      if (dx * dx + dz * dz < 4.6 * 4.6) child.traverse((m) => fadeMesh(m));
    }
  }
  for (const mesh of fadedPrev) if (!fadedNow.has(mesh)) unfadeMesh(mesh);
  const swap = fadedPrev;
  fadedPrev = fadedNow.size ? new Set(fadedNow) : (swap.clear(), swap);
}
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

/** Découpe une vue (un tiers) d'un atlas de figurine peinte GEN 2 en texture
 *  propre. Léger retrait horizontal : aucune vue voisine ne déborde sur la
 *  tranche. Cache global : une seule découpe par (atlas, vue) pour la session. */
const figViewCache = new Map();
function figurineView(src, third, cb) {
  const key = `${src}#${third}`;
  if (figViewCache.has(key)) { cb(figViewCache.get(key)); return; }
  const img = new Image();
  img.onload = () => {
    const w = Math.floor(img.width / 3);
    const inset = Math.round(w * 0.03);
    const canvas = document.createElement("canvas");
    canvas.width = w - inset * 2;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, third * w + inset, 0, canvas.width, img.height, 0, 0, canvas.width, img.height);
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    figViewCache.set(key, t);
    cb(t);
  };
  img.src = src;
}

/** Figurine PNJ peinte (vue de face de son atlas) posée debout en `pos`. */
function figStandee(art, pos, height) {
  const groupe = new THREE.Group();
  groupe.position.copy(pos);
  const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.center.set(0.5, 0);
  spr.scale.set(height * 0.34, height, 1);
  groupe.add(spr);
  const ombre = ombrePortee(height * 0.19); // ancre le PNJ au sol
  ombre.position.y = 0.02;
  groupe.add(ombre);
  figurineView(art, 0, (t) => { mat.map = t; mat.needsUpdate = true; });
  return groupe;
}

/** Texture radiale douce partagée (ombres portées, bouffées de poussière). */
const radialTexCache = new Map();
function radialTexture(rgb, alpha) {
  const key = `${rgb}/${alpha}`;
  if (radialTexCache.has(key)) return radialTexCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  radialTexCache.set(key, t);
  return t;
}

/** Tache d'ombre douce qui ancre une figurine au sol. */
function ombrePortee(radius) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: radialTexture("10, 6, 24", 0.45), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Bouffées de poussière sous les pas des figurines en marche. */
const dustPuffs = [];
function spawnDustPuff(x, z) {
  if (!effectGroup || dustPuffs.length > 24) return;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("244, 236, 216", 0.5), transparent: true, depthWrite: false, opacity: 0.4,
  }));
  spr.position.set(x + (Math.random() - 0.5) * 0.3, 0.62, z + (Math.random() - 0.5) * 0.3);
  spr.scale.setScalar(0.35);
  effectGroup.add(spr);
  dustPuffs.push({ spr, age: 0 });
}

/** Texture-emoji d'un type de case (repli quand il n'a pas de jeton peint). */
const emojiTexCache = new Map();
function emojiTexture(emoji) {
  if (emojiTexCache.has(emoji)) return emojiTexCache.get(emoji);
  const c = document.createElement("canvas");
  c.width = c.height = 192;
  const g = c.getContext("2d");
  g.font = "150px serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 96, 104);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  emojiTexCache.set(emoji, t);
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
  boutique: { id: "boutique", art: "assets/batiment-boutique.webp" },
  gambit: { id: "taverne", art: "assets/batiment-taverne.webp" },
  trounoir: { id: "portail", art: "assets/batiment-portail.webp" },
  insolite: { id: "champignon", art: "assets/batiment-champignon.webp" },
  expression: { id: "taverne", art: "assets/batiment-taverne.webp" },
  evenement: { id: "fontaine", art: "assets/batiment-fontaine.webp" },
  arrivee: { id: "chateau", art: "assets/batiment-chateau.webp" },
  depart: { id: "pont", art: "assets/batiment-pont.webp" },
};

const BUILDING_ID = {
  "assets/batiment-chateau.webp": "chateau",
  "assets/batiment-etoile.webp": "etoile",
  "assets/batiment-tour-mage.webp": "tour-mage",
  "assets/batiment-bibliotheque.webp": "bibliotheque",
  "assets/batiment-taverne.webp": "taverne",
  "assets/batiment-portail.webp": "portail",
  "assets/batiment-boutique.webp": "boutique",
  "assets/batiment-fontaine.webp": "fontaine",
  "assets/batiment-pont.webp": "pont",
  "assets/batiment-champignon.webp": "champignon",
};

const DUNGEON_LAYOUT = [
  { id: "mur", u: 0.02, v: 0.47, h: 3.1, ry: Math.PI / 2 },
  { id: "arche", u: 0.51, v: 0.025, h: 3.5, ry: 0 },
  { id: "colonne", u: 0.985, v: 0.47, h: 3.2, ry: 0 },
  { id: "brasero", u: 0.17, v: 0.035, h: 2.2, ry: 0 },
  { id: "brasero", u: 0.83, v: 0.035, h: 2.2, ry: 0 },
  { id: "brasero", u: 0.02, v: 0.78, h: 2.2, ry: 0 },
  { id: "brasero", u: 0.985, v: 0.78, h: 2.2, ry: 0 },
];

/* ---------- sol dallé procédural ---------- */

/** Assombrit/éclaircit une couleur hexadécimale (#rrggbb) d'un facteur v. */
function shadeHex(hex6, v) {
  const n = parseInt(hex6.slice(1), 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(x * v)));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

const groundTexCache = new Map();
/** Texture de dallage dessinée en canvas (une par thème, mise en cache). */
function themeGroundTexture(theme, road) {
  if (groundTexCache.has(theme)) return groundTexCache.get(theme);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#17102a"; // joints sombres
  g.fillRect(0, 0, 256, 256);
  const T = 32;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      // Dalles : la couleur de la route du thème, assombrie, avec variation.
      g.fillStyle = shadeHex(road || "#4a3a78", 0.5 + Math.random() * 0.22);
      g.fillRect(x * T + 1.5, y * T + 1.5, T - 3, T - 3);
      // Éclat discret en coin de dalle (usure).
      if (Math.random() < 0.3) {
        g.fillStyle = "rgba(244, 236, 216, 0.05)";
        g.fillRect(x * T + 3, y * T + 3, 7, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 10);
  groundTexCache.set(theme, tex);
  return tex;
}

/* ---------- sols et ciels peints (GEN 2) ---------- */

// Chemins LITTÉRAUX (inlinés en data-URI dans le fichier unique).
const THEME_SOL = {
  crypte: "assets/3d/textures/sol-crypte.webp",
  donjon: "assets/3d/textures/sol-donjon.webp",
  tour: "assets/3d/textures/sol-tour.webp",
  catacombes: "assets/3d/textures/sol-catacombes.webp",
  labyrinthe: "assets/3d/textures/sol-labyrinthe.webp",
};
const THEME_CIEL = {
  crypte: "assets/ciel-crypte.webp",
  donjon: "assets/ciel-donjon.webp",
  tour: "assets/ciel-tour.webp",
  catacombes: "assets/ciel-catacombes.webp",
  labyrinthe: "assets/ciel-labyrinthe.webp",
};

const solTexCache = new Map();
/** Remplace le dallage procédural par la texture PEINTE dès qu'elle est
 *  décodée (repli garanti : le dallage canvas reste si l'image manque). */
function upgradeGroundTexture(mat, theme) {
  const src = THEME_SOL[theme];
  if (!src) return;
  if (solTexCache.has(theme)) { mat.map = solTexCache.get(theme); mat.needsUpdate = true; return; }
  new THREE.TextureLoader().load(src, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(11, 10);
    tex.encoding = THREE.sRGBEncoding;
    solTexCache.set(theme, tex);
    mat.map = tex;
    mat.needsUpdate = true;
  }, undefined, () => { /* repli : dallage peint à la volée déjà en place */ });
}

let skySphere = null;
const cielTexCache = new Map();
/** Dôme de ciel peint (panorama 360° équirectangulaire) posé par-dessus la
 *  cubemap procédurale dès que l'image est prête. Hors brume : il EST l'horizon. */
function upgradeSky(theme, epoch) {
  if (skySphere) { scene.remove(skySphere); skySphere.geometry.dispose(); skySphere.material.dispose(); skySphere = null; }
  const src = THEME_CIEL[theme];
  if (!src) return;
  const attach = (tex) => {
    if (epoch !== sceneEpoch || !scene) return;
    skySphere = new THREE.Mesh(
      new THREE.SphereGeometry(140, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    skySphere.renderOrder = -1000;
    scene.add(skySphere);
  };
  if (cielTexCache.has(theme)) return attach(cielTexCache.get(theme));
  new THREE.TextureLoader().load(src, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    cielTexCache.set(theme, tex);
    attach(tex);
  }, undefined, () => { /* repli : cubemap procédurale conservée */ });
}

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

    // L'heure réelle teinte la lumière du donjon (même esprit que le filtre
    // horaire du plateau 2D) : matin clair, soirée dorée, nuit bleutée.
    const heure = new Date().getHours();
    const nuit = heure >= 21 || heure < 7;
    const soir = !nuit && heure >= 18;
    scene.add(new THREE.HemisphereLight(nuit ? 0xbcc8ff : 0xffe8c6, 0x25183e, nuit ? 0.52 : 0.68));
    const key = new THREE.DirectionalLight(nuit ? 0xa8b8ff : soir ? 0xffd9a0 : 0xfff0d8, nuit ? 0.82 : soir ? 1.2 : 1.1);
    key.position.set(-14, 26, 12);
    if (soir) key.position.set(-20, 15, 16); // soleil bas et doré du soir
    key.castShadow = true;
    key.shadow.mapSize.set(...(Number(navigator.deviceMemory || 4) <= 4 ? [1024, 1024] : [2048, 2048]));
    key.shadow.radius = 4;
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

    // Projecteur doux braqué sur le joueur actif : où que soit la caméra, on
    // repère TOUJOURS son héros d'un coup d'œil.
    heroSpot = new THREE.SpotLight(0xffe2a8, 0.85, 26, Math.PI / 7, 0.55, 1.2);
    heroSpot.position.set(0, 14, 2);
    scene.add(heroSpot, heroSpot.target);

    // Bascule de caméra : zoom héros (défaut) ↔ vue d'ensemble.
    camBtn = document.createElement("button");
    camBtn.type = "button";
    camBtn.className = "cam-toggle";
    const camLabel = () => {
      camBtn.textContent = camMode === "heros" ? "🎥 Héros" : "🗺️ Vue d'ensemble";
      camBtn.setAttribute("aria-label", camMode === "heros"
        ? "Caméra : zoom sur le joueur (appuyez pour la vue d'ensemble)"
        : "Caméra : vue d'ensemble (appuyez pour zoomer sur le joueur)");
    };
    camLabel();
    camBtn.addEventListener("click", () => {
      camMode = camMode === "heros" ? "ensemble" : "heros";
      try { localStorage.setItem("donjon-cam", camMode); } catch { /* privé */ }
      camLabel();
    });
    host.style.position = host.style.position || "relative";
    host.appendChild(camBtn);
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
  camBtn?.remove(); camBtn = null; heroSpot = null; skySphere = null;
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
    if (camBtn) camBtn.style.display = on ? "block" : "none";
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
  // La carte GLOBALE : chaque case dans sa couleur (départ/arrivée plus gros),
  // l'étoile du marchand et les pions par-dessus — l'état du plateau d'un œil.
  const cases = layout.map((type, i) => {
    const c = coords[i];
    const def = CASE_TYPES[type] ?? CASE_TYPES.question;
    const big = type === "depart" || type === "arrivee";
    return `<circle cx="${nx(c.x)}" cy="${ny(c.y)}" r="${big ? 2.6 : 1.7}" fill="${def.couleur}" stroke="#0e0a1c" stroke-width="0.45"/>`;
  }).join("");
  const star = starPos != null ? `<circle cx="${nx(cl(starPos).x)}" cy="${ny(cl(starPos).y)}" r="3.4" fill="#e0b04a" stroke="#1a1230" stroke-width="0.6"/>` : "";
  const dots = pions.map((p) => { const c = cl(p.position); return `<circle cx="${nx(c.x)}" cy="${ny(c.y)}" r="${p.id === currentId ? 4 : 2.6}" fill="${p.couleur || "#e0b04a"}" stroke="#fff" stroke-width="0.7"/>`; }).join("");
  minimapEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><path d="${pathD}" fill="none" stroke="#8e6cff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>${cases}${star}${dots}</svg>`;
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
  braseroLights.length = 0;
  animatedDecors.length = 0;
  pnj3d.length = 0;
  while (activeFx.length) { const fx = activeFx.pop(); effectGroup?.remove(fx.spr); fx.mat.map?.dispose?.(); fx.mat.dispose(); }
  lastStarPos = null;
  dustCloud = null;
  camFocus = null;
  // Nouveau plateau : on repart de pions neufs (personnages potentiellement
  // différents) pour ne pas réutiliser une figurine périmée.
  for (const rec of pionObjs.values()) { pionGroup.remove(rec.obj); disposePion(rec); }
  pionObjs.clear();
  sceneEpoch += 1;
  const epoch = sceneEpoch;
  upgradeSky(boardDef.theme, epoch); // dôme de ciel peint GEN 2 (repli : cubemap)

  const length = layout.length;
  const s = SPAN / VIEW_W;
  const { coords, viewH } = boardGeometry(length);

  // Sol du donjon : dallage peint à la volée (canvas) aux couleurs du thème —
  // bien plus riche qu'un aplat, sans le moindre asset supplémentaire.
  const groundMat = new THREE.MeshStandardMaterial({ map: themeGroundTexture(boardDef.theme, boardDef.road), roughness: 1, metalness: 0 });
  upgradeGroundTexture(groundMat, boardDef.theme); // texture peinte GEN 2 dès que prête
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SPAN * 2.4, (SPAN * viewH) / VIEW_W * 2.2),
    groundMat,
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
    // Ruban APLATI : large sous les pieds mais bien plus bas que les pastilles
    // et jetons de case (l'ancien tube plein les engloutissait entièrement).
    tube.scale.y = 0.3;
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
    // Le JETON PEINT du type posé À PLAT sur le socle + un ANNEAU lumineux de
    // la couleur du type : chaque case est reconnaissable d'un coup d'œil en
    // 3D, exactement comme sur le plateau 2D. (Ajoutés à l'ancre : ils
    // survivent au remplacement du cylindre par le socle GLB.)
    // Pastille de COULEUR opaque (le dessus de la case = la couleur du type,
    // lisible de loin comme en 2D) + le jeton peint par-dessus.
    // Liseré sombre : le disque coloré se détache du ruban clair du chemin
    // quel que soit le thème.
    const lisere = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 28),
      new THREE.MeshBasicMaterial({ color: 0x171028 }),
    );
    lisere.rotation.x = -Math.PI / 2;
    lisere.position.y = 0.55;
    anchor.add(lisere);
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(1.14, 28),
      new THREE.MeshStandardMaterial({ color: hex(t.couleur), emissive: hex(t.couleur), emissiveIntensity: 0.5, roughness: 0.5 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.585;
    anchor.add(plate);
    // Symbole du type : jeton peint, ou l'emoji du type dessiné au canvas
    // (case Départ) — plus aucune case muette.
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(1.02, 28),
      new THREE.MeshBasicMaterial({ map: t.art ? loadTex(t.art) : emojiTexture(t.emoji), transparent: true, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.64;
    decal.renderOrder = 2;
    anchor.add(decal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.085, 8, 32),
      new THREE.MeshStandardMaterial({ color: hex(t.couleur), emissive: hex(t.couleur), emissiveIntensity: 0.85, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    anchor.add(ring);
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
    // Bâtiment-repère bien EN RETRAIT (3,4 u) : sa silhouette fantôme ne voile
    // plus jamais le socle, la pastille de couleur ni le jeton de la case.
    if (bat) addBuilding(bat.id, bat.art, p.clone().setZ(p.z - 3.4), type === "arrivee" ? 6.5 : 4.6, epoch);
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
    // Braseros VIVANTS : flamme émissive qui danse + lueur qui tremble.
    if (module.id === "brasero") {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.9, 7),
        new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8c1a, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 }),
      );
      flame.position.y = module.h + 0.35;
      anchor.add(flame);
      const light = new THREE.PointLight(0xff9a3c, 1.0, 10, 2);
      light.position.y = module.h + 0.55;
      anchor.add(light);
      braseroLights.push({ flame, light, phase: anchor.position.x * 1.7 });
    }
  }
  // Les petits autocollants « décor » du premier lot (arbre sombre, toile,
  // statue…) sont retirés de la scène 3D : le village v4.5 (maquettes, PNJ,
  // objets peints) les a rendus superflus — ils ne survivent qu'en 2D.
  void DECOR;

  // Décors VIVANTS v3 (GEN 2) : moulin, bannières, lampadaires, puits, arbres,
  // gargouille — leurs nœuds « anim » sont animés dans la boucle de rendu.
  const DECOR3D_LAYOUT = [
    { id: "moulin-a-vent", u: 0.055, v: 0.07, h: 4.4, anim: "spin" },
    { id: "puits", u: 0.945, v: 0.5, h: 2.6, anim: "bob" },
    { id: "lampadaire-lucioles", u: 0.3, v: 0.03, h: 3.2, anim: "sway" },
    { id: "lampadaire-lucioles", u: 0.7, v: 0.968, h: 3.2, anim: "sway" },
    { id: "banniere-donjon", u: 0.5, v: 0.028, h: 3.4, anim: "sway" },
    { id: "banniere-donjon", u: 0.055, v: 0.5, h: 3.4, anim: "sway" },
    { id: "gargouille-baillante", u: 0.945, v: 0.945, h: 1.9, force: 0.4 },
  ];
  for (const d of DECOR3D_LAYOUT) {
    const anchor = new THREE.Group();
    anchor.position.copy(worldUV(d.u, d.v, length));
    boardGroup.add(anchor);
    upgradeStatic(anchor, null, Promise.resolve(createDecorModel(d.id, d.h)).then((m) => {
      if (m) rechauffe(m, d.force ?? 0.26);
      if (m && d.anim && epoch === sceneEpoch) {
        const node = m.getObjectByName("anim");
        if (node) animatedDecors.push({ node, kind: d.anim, phase: d.u * 9 });
      }
      return m;
    }), epoch, `décor ${d.id}`);
  }

  // Remparts modulaires : bordent le plateau, translucides comme les bâtiments.
  const REMPARTS = [
    { id: "rempart-angle", u: 0.015, v: 0.99 }, { id: "rempart-droit", u: 0.35, v: 0.995 },
    { id: "rempart-porte", u: 0.5, v: 0.997 }, { id: "rempart-droit", u: 0.65, v: 0.995 },
    { id: "rempart-angle", u: 0.985, v: 0.99 },
    { id: "rempart-droit", u: 0.2, v: 0.005 }, { id: "rempart-droit", u: 0.8, v: 0.005 },
  ];
  for (const r of REMPARTS) {
    const anchor = new THREE.Group();
    anchor.userData.isBatiment = true; // translucide + règles anti-occlusion
    anchor.position.copy(worldUV(r.u, r.v, length));
    boardGroup.add(anchor);
    upgradeStatic(anchor, null, Promise.resolve(createDecorModel(r.id, 1.6)).then((m) => {
      if (m) rechauffe(m); // opaques ; le fondu dynamique s'en charge au besoin
      return m;
    }), epoch, `rempart ${r.id}`);
  }

  // PNJ 3D animés : chacun posté près de « sa » case (repli : case libre).
  const PNJ3D_CASE = [
    { slug: "gerard", type: "boutique", sig: "bow" },
    { slug: "zebulon", type: "trounoir", sig: "lose-thread" },
    { slug: "merlinouche", type: "arrivee", sig: "spell-fail" },
  ];
  for (const pdef of USE_GLB_PNJ ? PNJ3D_CASE : []) {
    const idx = layout.indexOf(pdef.type);
    if (idx === -1) continue;
    const pos = worldOf(idx, length).add(new THREE.Vector3(1.9, 0, 0.7));
    createAnimatedPnj(pdef.slug).then((pnj) => {
      if (!pnj || epoch !== sceneEpoch || !boardGroup) return;
      pnj.object.position.copy(pos);
      boardGroup.add(pnj.object);
      pnj3d.push({ pnj, sig: pdef.sig, next: 5 + Math.random() * 9 });
    }).catch(() => { /* PNJ 3D optionnel */ });
  }

  // Les PNJ PEINTS (GEN 2) habitent le village 3D : chacun se poste près de
  // « sa » case-repère — l'échoppier devant la boutique, Piquot au savoir
  // insolite, Zébulon au Trou Noir… et six flâneurs aux abords. Les objets
  // peints (coffre, tonneau, torche…) parsèment les bords. L'art original
  // cohabite ainsi avec les volumes low-poly au lieu d'être remplacé.
  const PNJ_CASE = {
    boutique: "assets/figurines/pnj-gerard.webp",
    insolite: "assets/figurines/pnj-piquot.webp",
    expression: "assets/figurines/pnj-turbo.webp",
    gambit: "assets/figurines/pnj-roquefort.webp",
    evenement: "assets/figurines/pnj-fee-bricole.webp",
    trounoir: "assets/figurines/pnj-zebulon.webp",
    arrivee: "assets/figurines/pnj-merlinouche.webp",
  };
  for (let i = 0; i < length; i++) {
    const art = PNJ_CASE[layout[i]];
    if (!art) continue;
    const p = worldOf(i, length);
    boardGroup.add(figStandee(art, p.clone().add(new THREE.Vector3(1.9, 0, 0.7)), 3.0));
  }
  const FLANEURS = ["assets/figurines/pnj-boubou.webp", "assets/figurines/pnj-groumf.webp", "assets/figurines/pnj-sylvette.webp", "assets/figurines/pnj-coassin.webp", "assets/figurines/pnj-barnabe.webp", "assets/figurines/pnj-ratichon.webp", "assets/figurines/pnj-biscornu.webp", "assets/figurines/pnj-hibou-passage.webp"];
  FLANEURS.forEach((art, i) => boardGroup.add(figStandee(art, worldUV(0.08 + 0.115 * i, i % 2 ? 0.035 : 0.975, length), 2.6)));
  const PROPS = ["assets/objet-coffre.png", "assets/objet-tonneau.png", "assets/objet-torche.png", "assets/objet-cristal.png", "assets/objet-potion.png"];
  PROPS.forEach((art, i) => boardGroup.add(standee(art, worldUV(0.05 + 0.225 * i, i % 2 ? 0.07 : 0.93, length), 1.35)));

  // Vue d'ensemble : recule assez pour cadrer TOUT le plateau (le joueur voit
  // le plateau global au repos ; la caméra ne se rapproche que pendant un trajet).
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ);
  const dist = Math.max(spanX * 0.62, spanZ * 0.95) + 12;
  overPos.set(cx, dist * 0.92, cz + dist * 0.82);
  overLook.set(cx, 0, cz + 1);
  // Cinématique d'ouverture : la caméra part au ras du village et S'ÉLÈVE vers
  // la vue d'ensemble — le lissage de la boucle fait le travelling tout seul.
  camPos.set(cx - spanX * 0.55, 3.2, cz + spanZ * 0.85);
  camLook.set(cx, 1.2, cz);

  // Poussière dorée d'ambiance : un nuage de points qui dérive en bloc
  // au-dessus du donjon (zéro coût CPU par particule).
  const dustCount = Number(navigator.deviceMemory || 4) <= 4 ? 70 : 130;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = cx + (Math.random() - 0.5) * spanX * 1.25;
    dustPos[i * 3 + 1] = 1 + Math.random() * 7;
    dustPos[i * 3 + 2] = cz + (Math.random() - 0.5) * spanZ * 1.25;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustCloud = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xe8c876, size: 0.14, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true,
  }));
  boardGroup.add(dustCloud);
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
  anchor.userData.isBatiment = true; // ciblé par les règles anti-occlusion
  // VERDICT DU TEST DE FIDÉLITÉ (lot v4) : à l'écran, les volumes restent en
  // deçà des peintures — les bâtiments demeurent donc les ŒUVRES PEINTES de
  // GEN 2. Les GLB v4 restent dans le dépôt ; pour les rebrancher, remettre
  // l'upgradeStatic(createBuildingModel) ici.
  void id; void epoch;
  const affiche = standee(art, new THREE.Vector3(), height);
  // Pleine opacité : le village est éclatant au repos. Le fondu dynamique
  // (rayons caméra→héros + proximité) efface un bâtiment SEULEMENT quand il
  // gêne réellement la vue — fini le village fantôme permanent.
  anchor.add(affiche);
  boardGroup.add(anchor);
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

  // Transition caméra : bref gros plan quand la case vaut le détour.
  if (["gambit", "trounoir", "boutique", "arrivee", "evenement", "insolite"].includes(type)) {
    camFocus = { target: rec.obj.position.clone(), until: performance.now() + 1600 };
  }
  // Effets peints v3 : pluie de pièces, fumée du Trou Noir, confettis du Trésor.
  const FX_BY_CASE = { pieces: "plouf-piece", trounoir: "fumee-douce", arrivee: "confettis", tresor: "confettis" };
  if (FX_BY_CASE[type]) spawnFx(FX_BY_CASE[type], rec.obj.position);
  // À l'arrivée : la danse de la victoire (GLB ou figurine peinte).
  if (type === "arrivee") {
    if (rec.hero) {
      if (!playHeroAnimation(rec.hero, "dance")) playHeroAnimation(rec.hero, "joy");
      rec.pendingReaction = "dance";
      rec.reactionUntil = performance.now() + 2600;
    } else {
      rec.spriteAnim = { kind: "dance", start: performance.now(), until: performance.now() + 2600 };
    }
  }
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

/* ---------- effets peints (feuilles de sprites 4×4, GEN 2 v3) ---------- */

const FX_URLS = {
  etincelles: "assets/fx/etincelles.png",
  "fumee-douce": "assets/fx/fumee-douce.png",
  confettis: "assets/fx/confettis.png",
  "halo-etoile": "assets/fx/halo-etoile.png",
  "plouf-piece": "assets/fx/plouf-piece.png",
};
const fxTexCache = new Map();

/** Joue une feuille d'effet (16 images) au-dessus d'une position du plateau. */
function spawnFx(kind, position) {
  const src = FX_URLS[kind];
  if (!src || !effectGroup) return;
  const play = (tex) => {
    if (!effectGroup) return;
    const map = tex.clone();
    map.needsUpdate = true;
    map.repeat.set(0.25, 0.25);
    map.offset.set(0, 0.75);
    const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(2.7, 2.7, 1);
    spr.position.copy(position).add(new THREE.Vector3(0, 1.7, 0));
    effectGroup.add(spr);
    activeFx.push({ spr, mat, age: 0, dur: 0.95 });
  };
  if (fxTexCache.has(kind)) return play(fxTexCache.get(kind));
  new THREE.TextureLoader().load(src, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    fxTexCache.set(kind, tex);
    play(tex);
  }, undefined, () => { /* effet optionnel */ });
}

/* ---------- pions ---------- */

// Figurines en pied peintes par GEN 2 (lot v4.4) — chemins littéraux pour
// l'inliner. Trois vues par héros (face, trois quarts, dos) dans chaque atlas.
export const FIGURINE_ATLAS = {
  cageot: "assets/figurines/atlas-cageot.webp",
  etincelle: "assets/figurines/atlas-etincelle.webp",
  gobelin: "assets/figurines/atlas-gobelin.webp",
  nebulia: "assets/figurines/atlas-nebulia.webp",
  boumbastien: "assets/figurines/atlas-boumbastien.webp",
  duchesse: "assets/figurines/atlas-duchesse.webp",
  flaque: "assets/figurines/atlas-flaque.webp",
  pelote: "assets/figurines/atlas-pelote.webp",
  hibou: "assets/figurines/atlas-hibou.webp",
  kribouille: "assets/figurines/atlas-kribouille.webp",
  plomberoy: "assets/figurines/atlas-plomberoy.webp",
};

function makePionSprite(p) {
  const atlas = FIGURINE_ATLAS[p.characterId];
  const art = heroArt(p.characterId);
  let obj;
  if (atlas) {
    // Figurine en pied : la vue de face s'affiche dès l'atlas décodé ; la
    // boucle de rendu choisit ensuite la vue selon la direction de marche.
    const mat = new THREE.SpriteMaterial({ transparent: true });
    obj = new THREE.Sprite(mat);
    obj.scale.set(1.06, 3.15, 1);
    obj.center.set(0.5, 0);
    const fig = { view: "face", views: {} };
    obj.userData.figurine = fig;
    [["face", 0], ["quart", 1], ["dos", 2]].forEach(([view, third]) => {
      figurineView(atlas, third, (t) => {
        fig.views[view] = t;
        if (view === fig.view && !mat.map) { mat.map = t; mat.needsUpdate = true; }
      });
    });
  } else if (art) {
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
  if (rec?.ring) {
    pionGroup?.remove(rec.ring);
    rec.ring.geometry.dispose();
    rec.ring.material.dispose();
    rec.ring = null;
  }
  if (rec?.ombre) {
    pionGroup?.remove(rec.ombre);
    rec.ombre.geometry.dispose();
    rec.ombre.material.dispose();
    rec.ombre = null;
  }
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
  // Anneau de tenue (skin débloqué via les succès) : halo coloré sous le héros.
  const skin = p.skin ? skinById(p.skin) : null;
  if (skin?.couleur) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.08, 10, 36),
      new THREE.MeshStandardMaterial({ color: hex(skin.couleur), emissive: hex(skin.couleur), emissiveIntensity: 0.75, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    pionGroup.add(ring);
    rec.ring = ring;
  }
  // Ombre portée : ancre la figurine au sol (suivie dans la boucle de rendu).
  rec.ombre = ombrePortee(0.95);
  rec.ombre.position.y = 0.645;
  pionGroup.add(rec.ombre);
  if (!USE_GLB_HEROES) return rec; // figurine peinte = fidélité garantie
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
    rec.obj.scale.setScalar(rec.active ? 1.35 : 1.2);
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
    if (lastStarPos != null && lastStarPos !== starPos) {
      spawnFx("halo-etoile", worldOf(lastStarPos, layout.length)); // étoile achetée ici
    }
    lastStarPos = starPos;
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
      if (rec.obj.userData?.figurine) rec.obj.scale.set(activeScale * 0.38, activeScale * 1.13, 1);
      else if (rec.obj.isSprite) rec.obj.scale.set(activeScale, activeScale, 1);
      else rec.obj.scale.setScalar(p.id === currentPionId ? 1.35 : 1.2);
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
  if (rec.hero) playHeroAnimation(rec.hero, rec.pendingReaction);
  else rec.spriteAnim = { kind: success ? "joy" : "sad", start: performance.now(), until: performance.now() + 1500 };
  if (success) spawnFx("etincelles", rec.obj.position); // gerbe peinte v3
}

/** Petites scènes de héros (clips v3) : « salute » au début du tour, « think »
 *  pendant la question, « dance » à l'arrivée. No-op sans 3D ou en marche. */
export function heroMoment3D(pionId, moment) {
  const rec = pionObjs.get(pionId);
  if (!rec || rec.walk) return;
  if (rec.hero) {
    if (!playHeroAnimation(rec.hero, moment)) return;
    if (moment === "salute") {
      rec.pendingReaction = "salute";
      rec.reactionUntil = performance.now() + 1700;
    }
    return;
  }
  // Figurine peinte : petite chorégraphie équivalente pilotée par le code.
  rec.spriteAnim = { kind: moment, start: performance.now(), until: performance.now() + (moment === "dance" ? 2600 : 1600) };
}

/* ---------- boucle de rendu ---------- */

let lastFrame = 0;
function watchPerformance(now) {
  // Sonde de test : __DONJON_KEEP3D désactive le repli 2D et la baisse de
  // qualité (captures d'écran et diagnostics sur rendu logiciel lent).
  if (globalThis.__DONJON_KEEP3D) return;
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
        d.normalize();
        rec.dir = { x: d.x, z: d.z }; // cap de marche : sert au choix de la vue
        rec.obj.position.add(d.multiplyScalar(step));
        // Petites bouffées de poussière sous les pas.
        rec.dustAt = (rec.dustAt || 0) + dt;
        if (rec.dustAt > 0.24) { rec.dustAt = 0; spawnDustPuff(rec.obj.position.x, rec.obj.position.z); }
      }
    } else if (rec.target) {
      rec.obj.position.lerp(rec.target, 0.18);
    }
    if (!rec.walk && rec.reactionUntil && now >= rec.reactionUntil) {
      rec.reactionUntil = 0;
      playHeroAnimation(rec.hero, "idle");
    }
    // Vie des figurines peintes : marche sautillante et petites chorégraphies
    // (joie = bond, déception = affaissement, danse = déhanché, salut = hop).
    if (rec.obj.isSprite) {
      // Figurine directionnelle : dos quand le héros s'éloigne de la caméra,
      // face quand il approche, trois quarts (miroité à gauche) entre les deux.
      const fig = rec.obj.userData.figurine;
      if (fig) {
        let view = "face", mirror = false;
        if (rec.walk && rec.dir && camera) {
          const vx = rec.obj.position.x - camera.position.x;
          const vz = rec.obj.position.z - camera.position.z;
          const vlen = Math.hypot(vx, vz) || 1;
          const dot = (rec.dir.x * vx + rec.dir.z * vz) / vlen;
          if (dot > 0.55) view = "dos";
          else if (dot >= -0.55) {
            view = "quart";
            mirror = rec.dir.x * vz - rec.dir.z * vx > 0;
          }
        }
        const tex = fig.views[view];
        if (tex && (fig.view !== view || !rec.obj.material.map)) {
          fig.view = view;
          rec.obj.material.map = tex;
          rec.obj.material.needsUpdate = true;
        }
        const sx = Math.abs(rec.obj.scale.x);
        rec.obj.scale.x = mirror ? -sx : sx;
      }
      let y = 0.55;
      if (rec.walk) y += Math.abs(Math.sin(now * 0.02)) * 0.3;
      const a = rec.spriteAnim;
      if (a && now < a.until) {
        const t = (now - a.start) / 1000;
        if (a.kind === "joy" || a.kind === "salute") y += Math.abs(Math.sin(t * 9)) * 0.45;
        else if (a.kind === "dance") { y += Math.abs(Math.sin(t * 6)) * 0.35; rec.obj.material.rotation = Math.sin(t * 8) * 0.14; }
        else if (a.kind === "sad") { y -= 0.08; rec.obj.material.rotation = Math.sin(t * 2) * 0.04; }
        else if (a.kind === "think") rec.obj.material.rotation = Math.sin(t * 1.6) * 0.06;
      } else if (a) {
        rec.spriteAnim = null;
        rec.obj.material.rotation = 0;
      }
      rec.obj.position.y = y;
      if (rec.ombre) {
        rec.ombre.position.set(rec.obj.position.x, 0.645, rec.obj.position.z);
        const bond = Math.max(0, y - 0.55);
        rec.ombre.scale.setScalar(Math.max(0.55, 1 - bond * 0.9));
        rec.ombre.material.opacity = Math.max(0.35, 1 - bond);
      }
    }
    // L'anneau de tenue suit la figurine et pulse doucement.
    if (rec.ring) {
      rec.ring.position.set(rec.obj.position.x, 0.08, rec.obj.position.z);
      rec.ring.scale.setScalar(1 + Math.sin(now * 0.004) * 0.07);
    }
  }

  // Les cases spéciales respirent très légèrement au repos ; ce mouvement
  // n'existe jamais lorsque le réglage « mouvements réduits » impose la 2D.
  const time = now / 1000;
  for (const tile of animatedTiles) {
    tile.anchor.position.y = Math.sin(time * 1.4 + tile.phase) * 0.025;
    if (tile.type === "trounoir") tile.anchor.rotation.y += dt * 0.22;
  }

  // Braseros : la flamme danse et la lueur tremble (déterministe, sans RNG).
  for (const b of braseroLights) {
    const f = Math.sin(time * 9 + b.phase) * 0.5 + Math.sin(time * 23 + b.phase * 2.3) * 0.5;
    b.light.intensity = 0.95 + f * 0.3;
    b.flame.scale.set(1 + f * 0.12, 1 + f * 0.22, 1 + f * 0.12);
    b.flame.rotation.y += dt * 2.4;
  }
  // La poussière dorée dérive en bloc, très lentement.
  if (dustCloud) {
    dustCloud.rotation.y += dt * 0.012;
    dustCloud.position.y = Math.sin(time * 0.22) * 0.5;
  }

  // Décors vivants v3 : ailes qui tournent, bannières qui ondulent, seau qui danse.
  for (const d of animatedDecors) {
    if (d.kind === "spin") d.node.rotation.z += dt * 1.5;
    else if (d.kind === "sway") d.node.rotation.y = Math.sin(time * 1.1 + d.phase) * 0.18;
    else if (d.kind === "bob") d.node.position.y = Math.sin(time * 1.3 + d.phase) * 0.12;
  }
  // PNJ 3D : idle en continu, et de temps en temps leur signature (une fois).
  for (const rec of pnj3d) {
    rec.pnj.mixer.update(dt);
    rec.next -= dt;
    if (rec.next <= 0) {
      rec.next = 11 + Math.random() * 15;
      const sig = rec.pnj.actions.get(rec.sig);
      const idle = rec.pnj.actions.get("idle");
      if (sig && idle) {
        sig.reset();
        sig.setLoop(THREE.LoopOnce, 1);
        idle.fadeOut(0.2);
        sig.fadeIn(0.2).play();
        const retour = Math.max(0.4, sig.getClip().duration - 0.15) * 1000;
        window.setTimeout(() => {
          try { sig.fadeOut(0.25); idle.reset().fadeIn(0.25).play(); } catch { /* scène rebâtie */ }
        }, retour);
      }
    }
  }
  // Sprites d'effets : avance des 16 images puis retrait propre.
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const fx = activeFx[i];
    fx.age += dt;
    const frame = Math.min(15, Math.floor((fx.age / fx.dur) * 16));
    fx.mat.map.offset.set((frame % 4) * 0.25, 0.75 - Math.floor(frame / 4) * 0.25);
    fx.mat.opacity = fx.age > fx.dur * 0.7 ? Math.max(0, 1 - (fx.age - fx.dur * 0.7) / (fx.dur * 0.3)) : 1;
    if (fx.age >= fx.dur) {
      effectGroup.remove(fx.spr);
      fx.mat.map.dispose();
      fx.mat.dispose();
      activeFx.splice(i, 1);
    }
  }
  for (let i = dustPuffs.length - 1; i >= 0; i--) {
    const puff = dustPuffs[i];
    puff.age += dt;
    const t = puff.age / 0.6;
    if (t >= 1 || !effectGroup) {
      effectGroup?.remove(puff.spr);
      puff.spr.material.dispose();
      dustPuffs.splice(i, 1);
      continue;
    }
    puff.spr.scale.setScalar(0.35 + t * 0.55);
    puff.spr.material.opacity = 0.38 * (1 - t);
    puff.spr.position.y = 0.62 + t * 0.25;
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
  // Amorti indépendant du framerate : sur un appareil lent, la caméra rejoint
  // sa cible aussi vite (en secondes) que sur un appareil rapide.
  const damp = (k) => 1 - Math.pow(1 - k, dt * 60);
  if (walker) {
    const t = walker.obj.position;
    camPos.lerp(new THREE.Vector3(t.x * 0.55, 13, overLook.z * 0.2 + t.z + 14), damp(0.05));
    camLook.lerp(new THREE.Vector3(t.x * 0.6, 1.6, t.z - 2), damp(0.07));
  } else if (camFocus && now < camFocus.until) {
    // Gros plan bref sur la case marquante où le héros vient d'atterrir.
    camPos.lerp(swayPos.set(camFocus.target.x, 8.5, camFocus.target.z + 10.5), damp(0.06));
    camLook.lerp(camFocus.target, damp(0.08));
  } else if (camMode === "heros" && focusId != null && pionObjs.get(focusId)) {
    // ZOOM HÉROS (défaut) : la caméra cadre le joueur actif d'assez près pour
    // qu'on le voie TOUJOURS bien, avec un léger balancement de vie. La
    // mini-carte garde la vue d'ensemble en permanence.
    const hero = pionObjs.get(focusId).obj.position;
    // Assez haut pour plonger PAR-DESSUS les toits du village : rien ne peut
    // s'interposer entre la caméra et le héros.
    swayPos.set(
      hero.x + Math.sin(time * 0.14) * 0.6,
      15.5 + Math.sin(time * 0.1) * 0.4,
      hero.z + 5.5 + Math.cos(time * 0.11) * 0.5,
    );
    camPos.lerp(swayPos, damp(0.05));
    camLook.lerp(lookTmp.set(hero.x, 0.8, hero.z - 1.2), damp(0.07));
  } else {
    // Vue d'ensemble avec un TILT très doux : le plateau respire (parallaxe).
    swayPos.set(
      overPos.x + Math.sin(time * 0.12) * 1.1,
      overPos.y + Math.sin(time * 0.09) * 0.45,
      overPos.z + Math.cos(time * 0.1) * 1.1,
    );
    camPos.lerp(swayPos, damp(0.045));
    camLook.lerp(overLook, damp(0.045));
  }
  // Rien ne cache jamais le héros actif : les obstacles deviennent translucides.
  const focusRec = focusId != null ? pionObjs.get(focusId) : null;
  updateOccluders(focusRec ? focusRec.obj.position : null);

  // Le projecteur suit le joueur actif (ou s'éteint s'il n'y en a pas).
  if (heroSpot) {
    const active = focusId != null ? pionObjs.get(focusId) : null;
    if (active) {
      heroSpot.intensity = 0.85;
      const p = active.obj.position;
      heroSpot.position.set(p.x + 1.5, 13, p.z + 3);
      heroSpot.target.position.set(p.x, 0.5, p.z);
    } else {
      heroSpot.intensity = 0;
    }
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  // Sonde de debug (tests uniquement) : positions caméra / héros actif.
  if (!window.__DONJON_DBG3D) {
    window.__DONJON_DBG3D = () => {
      const rec = focusId != null ? pionObjs.get(focusId) : null;
      return {
        cam: camPos.toArray().map((v) => +v.toFixed(1)),
        look: camLook.toArray().map((v) => +v.toFixed(1)),
        hero: rec ? rec.obj.position.toArray().map((v) => +v.toFixed(1)) : null,
        focusId, mode: camMode, walk: !!(rec && rec.walk), heroIsGlb: !!rec?.hero,
      };
    };
  }

  R.render(scene, camera);
}
