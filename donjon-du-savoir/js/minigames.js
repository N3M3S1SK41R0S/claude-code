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

/* ---------- Devinette en cascade ---------- */

// Un article initial ne dit rien de la réponse : « L'Italie » commencerait par
// un L, ce qui serait un indice absurde. On travaille donc sur le mot utile.
const ARTICLE = /^(l'|les\s|le\s|la\s|un\s|une\s|des\s|du\s|de\s+la\s|de\s+l'|d')/i;

/** Le mot utile d'une réponse : sans article, tel qu'il s'écrit. */
export function motCle(reponse) {
  return String(reponse ?? "").trim().replace(ARTICLE, "").trim();
}

/**
 * Squelette d'un mot : première et dernière lettre visibles, puis une lettre
 * sur trois. Assez pour « voir » la réponse sans jamais la donner.
 */
export function squelette(mot) {
  const lettres = [...String(mot)];
  const positions = lettres.map((c, i) => (/\p{L}/u.test(c) ? i : -1)).filter((i) => i >= 0);
  const visibles = new Set([positions[0], positions[positions.length - 1]]);
  for (let k = 3; k < positions.length - 1; k += 3) visibles.add(positions[k]);
  // Espaces INSÉCABLES : le navigateur réduit les espaces ordinaires à un seul,
  // et « Daniel Craig » perdait la coupure entre ses deux mots.
  const AIR = " ";
  return lettres
    .map((c, i) => (!/\p{L}/u.test(c) ? (/\s/.test(c) ? `${AIR}${AIR}${AIR}` : c) : visibles.has(i) ? c.toUpperCase() : "_"))
    .join(AIR);
}

/**
 * Les trois indices d'une devinette en cascade, du plus vague au plus parlant.
 * Tout est déduit de la question elle-même : aucun contenu à écrire à la main,
 * donc la cascade marche sur TOUTE la banque.
 */
export function indicesCascade(q) {
  const mot = motCle(q.bonne_reponse);
  const lettres = hangmanLetters(mot);
  const mots = mot.split(/\s+/).filter(Boolean).length;
  const premiere = ([...mot].find((c) => /\p{L}/u.test(c)) ?? "").toUpperCase();
  return [
    {
      cases: 4,
      texte: `Le domaine, c'est « ${q.categorie} », et la réponse s'écrit en ${lettres} lettres${mots > 1 ? ` réparties sur ${mots} mots` : ""}.`,
    },
    { cases: 3, texte: `La réponse commence par la lettre « ${premiere} ».` },
    { cases: 2, texte: `Voici ce qu'on en voit : ${squelette(mot)}`, squelette: squelette(mot) },
  ];
}

/** Une question se prête-t-elle à la cascade ? Il faut une réponse à deviner :
 *  ni un Vrai/Faux (une chance sur deux), ni un pavé de plusieurs phrases. */
export function cascadeEligible(q) {
  if (!q || q.format !== "qcm") return false;
  const mot = motCle(q.bonne_reponse);
  const lettres = hangmanLetters(mot);
  return lettres >= 4 && lettres <= 20 && mot.split(/\s+/).length <= 3;
}

/* ---------- Baccalauréat Éclair (le petit bac du Donjon) ---------- */

// Lettres jouables uniquement : un « X » ou un « W » bloquerait la tablée et
// transformerait le jeu en punition. On reste sur des lettres généreuses.
export const LETTRES_BAC = "ABCDEFGHIJLMNOPRSTV".split("");

// Rubriques choisies pour qu'un enfant de six ans ait toujours quelque chose à
// dire, et qu'un adulte puisse briller sur la même lettre.
export const RUBRIQUES_BAC = [
  "un animal", "un pays", "un prénom", "un métier", "un aliment", "une couleur",
  "un objet de la maison", "un personnage de dessin animé", "un sport", "une ville",
  "un instrument de musique", "un vêtement", "une fleur ou un arbre", "un jeu",
  "un moyen de transport", "quelque chose qui se mange au petit-déjeuner",
  "une chose qu'on trouve dans une école", "un héros ou une héroïne",
  "quelque chose de froid", "un mot de plus de huit lettres",
];

/** Tire une lettre et trois rubriques distinctes pour un Baccalauréat Éclair. */
export function tirageBac(rng = Math.random) {
  const lettre = LETTRES_BAC[Math.floor(rng() * LETTRES_BAC.length)];
  return { lettre, rubriques: shuffle(RUBRIQUES_BAC, rng).slice(0, 3) };
}

/** « Le plus proche » : classe des propositions numériques vs la vérité. */
export function closestRanking(answer, guesses) {
  return guesses
    .map((g) => ({ ...g, ecart: Math.abs(Number(g.valeur) - Number(answer)) }))
    .sort((a, b) => a.ecart - b.ecart);
}
