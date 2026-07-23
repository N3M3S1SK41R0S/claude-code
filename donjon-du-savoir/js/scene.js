// Immersion 2.5D : une brève « scène d'arrivée » animée quand on atteint une
// case marquante (façon Mario Party). On empile plusieurs plans (fond du
// donjon, bâtiment, PNJ, héros qui entre en scène) pour donner de la
// profondeur, sans aucune dépendance ni moteur 3D. C'est une saynète NON
// bloquante : un calque par-dessus le jeu, transparent aux clics, qui se
// dissipe tout seul — les bots et les tests ne sont jamais gênés. Repli garanti :
// image manquante → l'emoji et le dégradé restent. Chemins d'assets LITTÉRAUX
// (inlinés en data-URI dans le fichier unique par le bundler).
import { el } from "./ui.js";
import { getState } from "./state.js";
import { boardById, heroArt } from "./board.js";
import { getPrefs } from "./prefs.js";

// type de case marquante → décor (bâtiment), PNJ éventuel, emoji et légende.
const SCENES = {
  boutique: { bat: "assets/batiment-boutique.png", npc: "assets/pnj-gerard.png", emoji: "🛒", cap: "À l'échoppe !" },
  etoile: { bat: "assets/batiment-etoile.png", npc: "assets/pnj-merlinouche.png", emoji: "⭐", cap: "Le marchand d'étoiles !" },
  trounoir: { bat: "assets/batiment-portail.png", npc: null, emoji: "🕳️", cap: "Le Trou Noir s'ouvre…" },
  gambit: { bat: "assets/batiment-taverne.png", npc: null, emoji: "🎲", cap: "La table des paris !" },
  evenement: { bat: "assets/batiment-fontaine.png", npc: null, emoji: "🎪", cap: "Toute la tablée joue !" },
  insolite: { bat: "assets/batiment-champignon.png", npc: "assets/pnj-piquot.png", emoji: "🦩", cap: "Savoir insolite !" },
  expression: { bat: "assets/batiment-taverne.png", npc: "assets/pnj-turbo.png", emoji: "🎭", cap: "Défi d'expression !" },
};

// thème du donjon → image de fond (parallaxe arrière). Repli : dégradé CSS.
const THEME_FOND = {
  donjon: "assets/fond-donjon.png",
  crypte: "assets/fond-crypte.png",
  tour: "assets/fond-tour.png",
  labyrinthe: "assets/fond-labyrinthe.png",
  catacombes: "assets/fond-catacombes.png",
};

/** L'immersion (scènes + caméra) est-elle active ? (réglage, activé par défaut). */
export function immersionOn() {
  return getPrefs().immersion !== false;
}

/** Mouvements réduits ? (réglage maison OU préférence système) — pas de saynète. */
function reducedMotion() {
  if (getPrefs().animations === "reduites") return true;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** Image qui se retire proprement si le fichier manque (repli sur le fond). */
function layerImg(src, cls) {
  if (!src) return null;
  const img = document.createElement("img");
  img.className = cls;
  img.alt = "";
  img.decoding = "async";
  img.src = src;
  img.onerror = () => img.remove();
  return img;
}

/**
 * Joue la saynète 2.5D d'une case marquante pour le personnage donné : un
 * calque décoratif apparaît par-dessus le jeu puis se dissipe (~1,9 s). Ne
 * bloque JAMAIS (pointer-events: none) et ne fait rien si l'immersion est
 * coupée, si les mouvements sont réduits, ou si la case n'a pas de scène.
 */
export function playScene(type, characterId) {
  if (typeof document === "undefined") return;
  // Jamais pendant les tests automatisés (saynète purement décorative : sa
  // légende ne doit pas parasiter la détection de panneaux par les smokes).
  if (globalThis.__DONJON_TEST) return;
  if (!immersionOn() || reducedMotion()) return;
  const s = SCENES[type];
  if (!s) return;
  const theme = boardById(getState()?.boardId ?? "grand-donjon")?.theme ?? "donjon";
  const fond = THEME_FOND[theme] ?? "assets/fond-donjon.png";

  const stage = el("div", { class: `scene-stage scene-${type}` });
  const bg = layerImg(fond, "scene-bg");
  if (bg) stage.append(bg);
  const bat = layerImg(s.bat, "scene-building");
  if (bat) stage.append(bat);
  const npc = layerImg(s.npc, "scene-npc");
  if (npc) stage.append(npc);
  const hero = layerImg(heroArt(characterId), "scene-hero");
  if (hero) stage.append(hero);
  else stage.append(el("span", { class: "scene-hero scene-hero-emoji", text: "🧑‍🎓" }));
  stage.append(el("div", { class: "scene-caption" }, el("span", { text: `${s.emoji} ${s.cap}` })));

  // Retire une éventuelle saynète encore à l'écran, puis pose la nouvelle.
  for (const old of document.querySelectorAll(".scene-overlay")) old.remove();
  const overlay = el("div", { class: "scene-overlay", "aria-hidden": "true" }, stage);
  document.body.append(overlay);
  setTimeout(() => overlay.remove(), 1900);
}
