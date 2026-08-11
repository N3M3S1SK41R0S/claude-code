// Joueurs automatiques (bots) pour compléter une partie quand on n'est pas assez
// nombreux. Quatre niveaux : ils changent la PROBABILITÉ qu'un bot réponde juste
// (jamais le contenu des questions, jamais l'âge des autres joueurs). Un bot joue
// tout seul son tour : il lance le dé, avance, et répond selon son niveau.

export const BOT_LEVELS = {
  facile: { id: "facile", nom: "Facile", emoji: "🙂", p: 0.40 },
  intermediaire: { id: "intermediaire", nom: "Intermédiaire", emoji: "😎", p: 0.62 },
  difficile: { id: "difficile", nom: "Difficile", emoji: "🧠", p: 0.80 },
  genie: { id: "genie", nom: "Génie", emoji: "🧞", p: 0.95 },
};

export const BOT_LEVEL_ORDER = ["facile", "intermediaire", "difficile", "genie"];

export function botLevelMeta(level) {
  return BOT_LEVELS[level] ?? BOT_LEVELS.intermediaire;
}

/** Probabilité qu'un bot de ce niveau réponde juste. */
export function botProb(level) {
  return botLevelMeta(level).p;
}

/** Le bot vise-t-il la bonne réponse à ce coup ? */
export function botWantsCorrect(level) {
  return Math.random() < botProb(level);
}

/** Réponse numérique d'un bot (Gambit) : juste avec sa probabilité, sinon un
 *  nombre plausible mais à côté — l'écart se resserre avec le niveau. */
export function botNumericGuess(answer, level) {
  const p = botProb(level);
  if (Math.random() < p) return answer; // pile bon
  const base = Math.abs(answer) || 10;
  const spread = Math.max(1, Math.round(base * (1 - p) * 0.6) + 2);
  const off = Math.round((Math.random() * 2 - 1) * spread) || 1;
  return answer + off;
}
