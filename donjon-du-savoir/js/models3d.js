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

function loadTemplate(characterId) {
  const url = HERO_MODEL_URLS[characterId];
  if (!url) return Promise.reject(new Error(`Figurine inconnue : ${characterId}`));
  if (!templateCache.has(characterId)) {
    templateCache.set(characterId, new Promise((resolve, reject) => {
      getLoader().load(url, resolve, undefined, reject);
    }).catch((error) => {
      templateCache.delete(characterId);
      throw error;
    }));
  }
  return templateCache.get(characterId);
}

/** Crée une instance autonome d'un héros. Les géométries et matériaux peuvent
 *  être partagés entre exemplaires ; les groupes et le mixer restent privés. */
export async function createAnimatedHero(characterId) {
  const gltf = await loadTemplate(characterId);
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
