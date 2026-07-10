/**
 * Normalisation des libellés vin pour les requêtes de prix (§9) :
 * minuscules, accents retirés, ponctuation neutralisée, mots vides supprimés.
 * Objectif : "Grand Vin de Bordeaux — Château Margaux 2015" et
 * "chateau margaux 2015" doivent produire des requêtes comparables.
 */

/** Mots vides français/anglais retirés des requêtes prix (articles et liaisons). */
const STOP_WORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'l',
  'd',
  'et',
  'en',
  'au',
  'aux',
  'the',
  'of',
]);

export function normalizeWineLabel(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants → lettres nues
    .toLowerCase()
    .replace(/[’']/g, ' ') // apostrophes → séparateur ("l'ermite" → "l ermite")
    .replace(/[^a-z0-9]+/g, ' ') // ponctuation/tirets → espace
    .split(' ')
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .join(' ');
}

/**
 * Extrait un millésime plausible d'un texte libre : première année à 4 chiffres
 * dans [1900, année courante + 1] (les primeurs peuvent porter l'année suivante).
 * `now` est injectable pour des tests déterministes.
 */
export function parseVintage(text: string, now: Date = new Date()): number | null {
  const maxYear = now.getFullYear() + 1;
  const matches = text.match(/\b(1[89]\d{2}|20\d{2}|21\d{2})\b/g);
  if (!matches) return null;
  for (const raw of matches) {
    const year = Number(raw);
    if (year >= 1900 && year <= maxYear) return year;
  }
  return null;
}
