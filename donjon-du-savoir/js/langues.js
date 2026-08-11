// Pack de langues : la structure multilingue du Donjon. Le manifeste
// data/langues.json déclare les packs disponibles (banque de questions et
// défis de mots par langue). Aujourd'hui : le français. Demain : une entrée
// par langue dans le manifeste, sans toucher au moteur de jeu.
// (Voir docs/PACK-LANGUES.md pour ajouter un pack.)
import { getPrefs } from "./prefs.js";

// Repli intégré : si le manifeste est illisible (mode file://, cache absent),
// le jeu reste jouable en français.
const DEFAUT = {
  version: 1,
  defaut: "fr-FR",
  langues: [
    { id: "fr-FR", nom: "Français", drapeau: "🇫🇷", banque: "data/questions.json", wordgames: "data/wordgames.json" },
  ],
};

let manifest = null;

/** Charge le manifeste des langues (idempotent, repli intégré). */
export async function loadLangues() {
  if (manifest) return manifest;
  try {
    const res = await fetch("data/langues.json");
    manifest = res.ok ? await res.json() : DEFAUT;
    if (!Array.isArray(manifest?.langues) || manifest.langues.length === 0) manifest = DEFAUT;
  } catch {
    manifest = DEFAUT;
  }
  return manifest;
}

export function langueList() {
  return (manifest ?? DEFAUT).langues;
}

/** Langue active : la préférence si son pack existe, sinon celle par défaut. */
export function activeLangue() {
  const list = langueList();
  const wanted = getPrefs().langue;
  return list.find((l) => l.id === wanted) ?? list.find((l) => l.id === (manifest ?? DEFAUT).defaut) ?? list[0];
}

/** Chemin de la banque de questions de la langue active. */
export function banquePath() {
  return activeLangue()?.banque ?? "data/questions.json";
}

/** Applique la langue au document (lecteurs d'écran et synthèse vocale). */
export function applyLangue() {
  try { document.documentElement.lang = activeLangue()?.id ?? "fr-FR"; } catch { /* hors navigateur */ }
}
