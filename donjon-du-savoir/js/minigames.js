// Mini-jeux DÉRIVÉS de la banque déjà vérifiée — aucun contenu neuf, donc aucun
// risque factuel. On transforme la bonne réponse d'une question existante en
// anagramme, en pendu, ou en « le plus proche » (numérique). Fonctions pures et
// testables ; l'UI et les récompenses sont dans game.js.

/** Deterministic-free shuffle (rng injectable pour les tests). */
function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Anagramme : mélange les lettres de chaque mot de la réponse (les espaces et la
 * ponctuation restent en place, comme repères). Garantit un rendu différent de
 * l'original quand le mot a assez de lettres distinctes.
 */
export function makeAnagram(answer, rng = Math.random) {
  const scrambleWord = (word) => {
    const letters = [...word];
    if (letters.filter((c) => /\p{L}/u.test(c)).length < 2) return word;
    for (let tries = 0; tries < 8; tries++) {
      const out = shuffle(letters, rng).join("");
      if (out.toLowerCase() !== word.toLowerCase()) return out;
    }
    return letters.reverse().join("");
  };
  const scrambled = answer.replace(/\p{L}+/gu, (w) => scrambleWord(w));
  return { scrambled: scrambled.toUpperCase(), answer };
}

/** Compte les lettres à deviner (hors espaces/ponctuation). */
export function hangmanLetters(answer) {
  return [...answer].filter((c) => /\p{L}/u.test(c)).length;
}

const stripDia = (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Pendu : masque de la réponse selon les lettres devinées. La comparaison
 * ignore accents et casse (deviner « e » révèle « é »). Renvoie le masque
 * affichable et si tout est révélé.
 */
export function hangmanState(answer, guessed) {
  const set = new Set([...guessed].map((g) => stripDia(g.toLowerCase())));
  let revealed = true;
  const display = [...answer]
    .map((ch) => {
      if (!/\p{L}/u.test(ch)) return ch; // espaces, apostrophes, tirets visibles
      const base = stripDia(ch.toLowerCase());
      if (set.has(base)) return ch;
      revealed = false;
      return "_";
    })
    .join("");
  return { display, revealed };
}

/** Lettres proposables (A-Z, sans doublon d'accent). */
export const HANGMAN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Une lettre est-elle dans la réponse (accents ignorés) ? */
export function hangmanHas(answer, letter) {
  const base = stripDia(letter.toLowerCase());
  return [...answer].some((ch) => /\p{L}/u.test(ch) && stripDia(ch.toLowerCase()) === base);
}

/** « Le plus proche » : classe des propositions numériques vs la vérité. */
export function closestRanking(answer, guesses) {
  return guesses
    .map((g) => ({ ...g, ecart: Math.abs(Number(g.valeur) - Number(answer)) }))
    .sort((a, b) => a.ecart - b.ecart);
}
