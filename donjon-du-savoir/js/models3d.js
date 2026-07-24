// Figurines 3D animées du Donjon. Les chemins restent des chaînes littérales :
// le constructeur du fichier autonome peut ainsi remplacer chaque GLB par une
// data-URI. Aucun chargement réseau n'est nécessaire, même en file://.

const THREE = globalThis.THREE;

export const HERO_MODEL_URLS = {
  cageot: "assets/3d/heroes/hero-cageot.glb",
  etincelle: "assets/3d/heroes/hero-etincelle.glb",
  gobelin: "assets/3d/heroes/hero-gobelin.glb",
  nebulia: "assets/3d/heroes/hero-nebulia.glb",
  boumbastien: "assets/3d/heroes/hero-boumbastien.glb",
  duchesse: "assets/3d/heroes/hero-duchesse.glb",
  flaque: "assets/3d/heroes/hero-flaque.glb",
  pelote: "assets/3d/heroes/hero-pelote.glb",
  hibou: "assets/3d/heroes/hero-hibou.glb",
  kribouille: "assets/3d/heroes/hero-kribouille.glb",
  plomberoy: "assets/3d/heroes/hero-plomberoy.glb",
};

export const BUILDING_MODEL_URLS = {
  chateau: "assets/3d/buildings/batiment-chateau.glb",
  etoile: "assets/3d/buildings/batiment-etoile.glb",
  "tour-mage": "assets/3d/buildings/batiment-tour-mage.glb",
  bibliotheque: "assets/3d/buildings/batiment-bibliotheque.glb",
  taverne: "assets/3d/buildings/batiment-taverne.glb",
  portail: "assets/3d/buildings/batiment-portail.glb",
  boutique: "assets/3d/buildings/batiment-boutique.glb",
  fontaine: "assets/3d/buildings/batiment-fontaine.glb",
  pont: "assets/3d/buildings/batiment-pont.glb",
  champignon: "assets/3d/buildings/batiment-champignon.glb",
};

export const TILE_MODEL_URLS = {
  question: "assets/3d/tiles/socle-question.glb",
  chance: "assets/3d/tiles/socle-chance.glb",
  evenement: "assets/3d/tiles/socle-evenement.glb",
  malus: "assets/3d/tiles/socle-malus.glb",
  pieces: "assets/3d/tiles/socle-pieces.glb",
  joker: "assets/3d/tiles/socle-joker.glb",
  gambit: "assets/3d/tiles/socle-gambit.glb",
  trounoir: "assets/3d/tiles/socle-trounoir.glb",
  boutique: "assets/3d/tiles/socle-boutique.glb",
  insolite: "assets/3d/tiles/socle-insolite.glb",
  expression: "assets/3d/tiles/socle-expression.glb",
  tresor: "assets/3d/tiles/socle-tresor.glb",
};

export const DUNGEON_MODEL_URLS = {
  mur: "assets/3d/dungeon/module-mur.glb",
  arche: "assets/3d/dungeon/module-arche.glb",
  colonne: "assets/3d/dungeon/module-colonne.glb",
  brasero: "assets/3d/dungeon/module-brasero.glb",
};

let loader = null;
let dracoLoader = null;
const templateCache = new Map();

/** Prépare les loaders vendorés. En fichier autonome, le décodeur Draco est
 *  injecté en mémoire par le bundler ; dans la PWA, il vient du cache local. */
function getLoader() {
  if (loader) return loader;
  if (!THREE?.GLTFLoader || !THREE?.DRACOLoader) {
    throw new Error("Loaders glTF/Draco indisponibles");
  }

  dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderConfig({ type: "wasm" });
  const memoire = Number(navigator.deviceMemory || 4);
  const coeurs = Number(navigator.hardwareConcurrency || 4);
  dracoLoader.setWorkerLimit(memoire <= 4 || coeurs <= 4 ? 1 : 2);

  const embarque = globalThis.__DONJON_DRACO;
  if (embarque?.wrapper && embarque?.wasm && dracoLoader.setDecoderResources) {
    dracoLoader.setDecoderResources(embarque.wrapper, embarque.wasm);
  } else {
    dracoLoader.setDecoderPath("vendor/draco/");
  }

  loader = new THREE.GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

function loadTemplate(key, url) {
  if (!url) return Promise.reject(new Error(`Modèle 3D inconnu : ${key}`));
  if (!templateCache.has(key)) {
    templateCache.set(key, new Promise((resolve, reject) => {
      getLoader().load(url, resolve, undefined, reject);
    }).catch((error) => {
      templateCache.delete(key);
      throw error;
    }));
  }
  return templateCache.get(key);
}

/** Crée une instance autonome d'un héros. Les géométries et matériaux peuvent
 *  être partagés entre exemplaires ; les groupes et le mixer restent privés. */
export async function createAnimatedHero(characterId) {
  const gltf = await loadTemplate(`hero:${characterId}`, HERO_MODEL_URLS[characterId]);
  const model = gltf.scene.clone(true);
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });

  // Tous les modèles sont normalisés à la même hauteur de figurine, puis posés
  // sur l'origine de leur groupe-ancre (la dalle est à y = 0,35).
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2.9 / Math.max(0.1, size.y);
  model.scale.setScalar(scale);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBounds.min.y;

  const object = new THREE.Group();
  object.name = `Figurine_${characterId}`;
  object.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();
  for (const clip of gltf.animations ?? []) actions.set(clip.name, mixer.clipAction(clip));
  const hero = { characterId, object, model, mixer, actions, current: null };
  playHeroAnimation(hero, "idle");
  return hero;
}

function prepareStaticModel(gltf, name, { height = 3, tile = false } = {}) {
  const model = gltf.scene.clone(true);
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (tile) {
    const horizontal = 2.12 / Math.max(0.1, size.x, size.z);
    model.scale.set(horizontal, 0.52 / Math.max(0.1, size.y), horizontal);
  } else {
    // Les bâtiments bas et larges (pont, fontaine) ne doivent pas envahir le
    // plateau : la hauteur demandée sert aussi de plafond à leur empreinte.
    const scale = Math.min(
      height / Math.max(0.1, size.y),
      (height * 1.35) / Math.max(0.1, size.x, size.z),
    );
    model.scale.setScalar(scale);
  }
  const scaled = new THREE.Box3().setFromObject(model);
  const center = scaled.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaled.min.y, -center.z);
  const object = new THREE.Group();
  object.name = name;
  object.add(model);
  return object;
}

export async function createBuildingModel(id, height = 4.5) {
  const gltf = await loadTemplate(`building:${id}`, BUILDING_MODEL_URLS[id]);
  return prepareStaticModel(gltf, `Batiment_${id}`, { height });
}

export async function createTileModel(type) {
  const id = type === "arrivee" ? "tresor" : type;
  const url = TILE_MODEL_URLS[id];
  if (!url) return null; // départ : la dalle procédurale reste volontairement.
  const gltf = await loadTemplate(`tile:${id}`, url);
  return prepareStaticModel(gltf, `Socle_${id}`, { tile: true });
}

export async function createDungeonModule(id, height = 3) {
  const gltf = await loadTemplate(`dungeon:${id}`, DUNGEON_MODEL_URLS[id]);
  return prepareStaticModel(gltf, `Module_${id}`, { height });
}

/** Lance une animation avec un fondu court. `joy` et `disappointment` ne
 *  bouclent pas ; board3d remet ensuite la figurine au repos. */
export function playHeroAnimation(hero, name) {
  const next = hero?.actions?.get(name);
  if (!next || hero.current === name) return false;
  const previous = hero.actions.get(hero.current);
  next.enabled = true;
  next.reset();
  if (name === "joy" || name === "disappointment") {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  if (previous) previous.fadeOut(0.16);
  next.fadeIn(0.16).play();
  hero.current = name;
  return true;
}

export function disposeAnimatedHero(hero) {
  if (!hero) return;
  try { hero.mixer.stopAllAction(); hero.mixer.uncacheRoot(hero.model); } catch { /* repli silencieux */ }
}
