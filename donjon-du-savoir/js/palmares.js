// Palmarès persistant entre les parties (localStorage) : compteurs cumulés,
// records et succès débloqués. Agrège les exploits des joueurs HUMAINS de cet
// appareil (les victoires de bots ne comptent pas). Résilient au mode privé.

const KEY = "donjon-palmares";

function blank() {
  return {
    parties: 0, // parties terminées sur cet appareil
    victoires: 0, // victoires humaines (tous modes)
    bonnesTotal: 0, // bonnes réponses cumulées
    questionsTotal: 0, // questions posées cumulées
    orTotal: 0, // or gagné cumulé
    meilleurTaux: 0, // meilleur taux de réussite sur une partie (%)
    meilleuresEtoiles: 0, // plus d'étoiles amassées en une partie
    persos: {}, // victoires par personnage (characterId -> nombre)
    succes: [], // ids de succès débloqués
  };
}

let data = blank();

export function loadPalmares() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === "object") data = { ...blank(), ...raw };
  } catch { /* mode privé */ }
  return data;
}

export function getPalmares() {
  return data;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* mode privé */ }
}

// Définitions des succès. `test(ctx)` reçoit le contexte d'une partie terminée
// (déjà cumulé dans `data`). L'ordre définit l'affichage.
export const SUCCES = [
  { id: "premiere", emoji: "🎉", titre: "Première victoire", desc: "Remporter une partie.", test: (c) => c.gagnant },
  { id: "erudit", emoji: "🧠", titre: "Érudit", desc: "10 bonnes réponses en une seule partie.", test: (c) => c.erudit },
  { id: "sansfaute", emoji: "💯", titre: "Sans-faute", desc: "100 % de réussite (au moins 5 questions).", test: (c) => c.sansfaute },
  { id: "marathon", emoji: "🏃", titre: "Marathonien", desc: "Jouer 10 parties.", test: (c) => c.parties >= 10 },
  { id: "fidele", emoji: "📅", titre: "Fidèle du Donjon", desc: "Jouer 25 parties.", test: (c) => c.parties >= 25 },
  { id: "collection", emoji: "🎭", titre: "Collectionneur", desc: "Gagner avec 5 personnages différents.", test: (c) => Object.keys(c.persos).length >= 5 },
  { id: "etoiles", emoji: "🌟", titre: "Pluie d'étoiles", desc: "Gagner une partie Étoiles avec 5 ⭐ ou plus.", test: (c) => c.gagnantEtoiles5 },
  { id: "equipe", emoji: "🤝", titre: "Esprit d'équipe", desc: "Gagner une partie en équipes.", test: (c) => c.gagnant && c.mode === "equipes" },
  { id: "genie", emoji: "🤖", titre: "Plus malin qu'un génie", desc: "Gagner une partie où joue un bot Génie.", test: (c) => c.batsGenie },
  { id: "fortune", emoji: "🪙", titre: "Fortune", desc: "Amasser 200 pièces au total.", test: (c) => c.orTotal >= 200 },
];

/**
 * Enregistre une partie terminée et débloque les succès mérités.
 * info = { pions, winner, mode, etoilesMode } — `pions` sont les données de
 * classement (bonnes, questions, orGagne, etoiles, characterId, bot, botLevel).
 * Renvoie la liste des succès NOUVELLEMENT débloqués (pour l'écran de victoire).
 */
export function recordGame({ pions = [], winner = null, mode = "individuel", etoilesMode = false } = {}) {
  data.parties += 1;
  const humains = pions.filter((p) => !p.bot);
  let erudit = false, sansfaute = false, bestTaux = 0, bestEtoiles = 0;
  for (const p of humains) {
    const bonnes = p.bonnes ?? 0;
    const questions = p.questions ?? 0;
    data.bonnesTotal += bonnes;
    data.questionsTotal += questions;
    data.orTotal += p.orGagne ?? 0;
    if (bonnes >= 10) erudit = true;
    if (questions >= 5 && bonnes === questions) sansfaute = true;
    if (questions >= 5) bestTaux = Math.max(bestTaux, Math.round((bonnes / questions) * 100));
    bestEtoiles = Math.max(bestEtoiles, p.etoiles ?? 0);
  }
  const winnerHuman = !!winner && !winner.bot;
  if (winnerHuman) {
    data.victoires += 1;
    if (winner.characterId) data.persos[winner.characterId] = (data.persos[winner.characterId] ?? 0) + 1;
  }
  data.meilleurTaux = Math.max(data.meilleurTaux, bestTaux);
  data.meilleuresEtoiles = Math.max(data.meilleuresEtoiles, bestEtoiles);

  const ctx = {
    parties: data.parties,
    persos: data.persos,
    orTotal: data.orTotal,
    gagnant: winnerHuman,
    erudit,
    sansfaute,
    etoilesMode: etoilesMode,
    mode,
    gagnantEtoiles5: winnerHuman && etoilesMode && (winner.etoiles ?? 0) >= 5,
    batsGenie: winnerHuman && pions.some((p) => p.bot && p.botLevel === "genie"),
  };
  const newly = [];
  for (const s of SUCCES) {
    if (!data.succes.includes(s.id) && s.test(ctx)) { data.succes.push(s.id); newly.push(s); }
  }
  persist();
  return newly;
}

/* ---------- tenues (skins) de héros ---------- */

// Tenues débloquées par les succès : liseré coloré sur le portrait en 2D,
// anneau lumineux sous la figurine en 3D. `succes: null` = offerte d'emblée.
export const SKINS = [
  { id: "classique", nom: "Classique", emoji: "🎨", couleur: null, succes: null },
  { id: "dore", nom: "Dorée", emoji: "✨", couleur: "#e0b04a", succes: "premiere" },
  { id: "emeraude", nom: "Émeraude", emoji: "🌿", couleur: "#3ec27a", succes: "erudit" },
  { id: "flamboyant", nom: "Flamboyante", emoji: "🔥", couleur: "#e05a3c", succes: "sansfaute" },
  { id: "royal", nom: "Royale", emoji: "👑", couleur: "#c23e6b", succes: "marathon" },
  { id: "cosmique", nom: "Cosmique", emoji: "🌌", couleur: "#7a6ad0", succes: "etoiles" },
];

export function skinById(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function skinUnlocked(s) {
  return !s.succes || data.succes.includes(s.succes);
}

/** Tenues jouables sur cet appareil (chaque succès listé en ouvre une). */
export function unlockedSkins() {
  return SKINS.filter((s) => skinUnlocked(s));
}

/* ---------- Livre d'or familial : mémoire longue par prénom ---------- */

const LIVRE_KEY = "donjon-livredor";

// Titres évolutifs (du plus prestigieux au plus modeste) : le premier seuil
// atteint devient le titre affiché du joueur dans le Livre d'or.
const TITRES = [
  { seuil: (e) => e.victoires >= 10, titre: "🐉 Légende du Donjon" },
  { seuil: (e) => e.victoires >= 5, titre: "👑 Monarque du Savoir" },
  { seuil: (e) => e.etoiles >= 40, titre: "🌟 Empereur des étoiles" },
  { seuil: (e) => e.bonnes >= 200, titre: "🦉 Puits de science" },
  { seuil: (e) => e.victoires >= 2, titre: "🛡️ Chevalier confirmé" },
  { seuil: (e) => e.parties >= 10, titre: "🏰 Pilier de la taverne" },
  { seuil: (e) => e.bonnes >= 50, titre: "📚 Apprenti prometteur" },
  { seuil: (e) => e.parties >= 3, titre: "🎲 Habitué du plateau" },
  { seuil: () => true, titre: "🌱 Jeune pousse" },
];

export function loadLivreDor() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVRE_KEY));
    if (raw && typeof raw === "object") return raw;
  } catch { /* mode privé */ }
  return {};
}

export function titreLivreDor(entry) {
  return TITRES.find((t) => t.seuil(entry)).titre;
}

/** Cumule une partie terminée dans le Livre d'or (joueurs humains seulement,
 *  identifiés par prénom — les surnoms de la famille traversent les parties). */
export function recordLivreDor(ranking) {
  const livre = loadLivreDor();
  ranking.forEach((joueur, i) => {
    if (joueur.bot) return;
    const cle = (joueur.nom ?? "").trim().toLowerCase();
    if (!cle) return;
    const e = livre[cle] ?? { nom: joueur.nom.trim(), parties: 0, victoires: 0, etoiles: 0, bonnes: 0, or: 0 };
    e.nom = joueur.nom.trim();
    e.parties += 1;
    if (i === 0) e.victoires += 1;
    e.etoiles += joueur.etoiles ?? 0;
    e.bonnes += joueur.bonnes ?? 0;
    e.or += joueur.orGagne ?? 0;
    livre[cle] = e;
  });
  try { localStorage.setItem(LIVRE_KEY, JSON.stringify(livre)); } catch { /* mode privé */ }
  return livre;
}
