/**
 * Dégustation à l'aveugle — pour jouer entre amis autour des vins de SA cave.
 * Fonctions PURES (testées en vitest) : tirage DÉTERMINISTE des bouteilles
 * (PRNG mulberry32 seedé — jamais Math.random ici), cartes anonymes « Vin n°X »
 * avec étapes guidées (robe, premier/second nez, attaque, évolution, finale,
 * garde, devinettes), et page de réponses séparée avec indices issus de
 * l'analyse ZAPPA. L'affichage (app / feuille imprimable) traduit les clés
 * d'étape via i18n (`blind.steps.<key>`).
 */
import type { WineAnalysisPayload } from '@velum/core';

/** Vin candidat au tirage (payload d'analyse optionnel — bouteille non analysée ok). */
export interface BlindTastingWine {
  itemId: string;
  label: string;
  vintage?: number;
  payload?: WineAnalysisPayload;
}

/** Clés d'étape stables — traduites côté app via `blind.steps.<key>`. */
export type BlindStepKey =
  | 'robe'
  | 'noseFirst'
  | 'noseSecond'
  | 'attack'
  | 'evolution'
  | 'finale'
  | 'aging'
  | 'guessRegion'
  | 'guessGrapes'
  | 'guessVintage';

/** Étape guidée d'une carte : observation à noter ou devinette. */
export interface BlindStep {
  key: BlindStepKey;
  kind: 'observation' | 'guess';
}

/** Carte anonyme servie au joueur : « Vin n°1 »… sans identité. */
export interface BlindCard {
  /** Numéro de service (1-based) : « Vin n°1 », « Vin n°2 »… */
  number: number;
  steps: BlindStep[];
}

/** Réponse (page séparée) : correspondance numéro → bouteille + indices. */
export interface BlindAnswer {
  number: number;
  itemId: string;
  label: string;
  vintage?: number;
  /** Indices issus du payload d'analyse : région, cépages, accords… */
  hints: string[];
}

export interface BlindTastingSession {
  cards: BlindCard[];
  answers: BlindAnswer[];
}

/** Déroulé guidé d'une dégustation à l'aveugle (identique pour chaque carte). */
export const BLIND_TASTING_STEPS: readonly BlindStep[] = [
  { key: 'robe', kind: 'observation' },
  { key: 'noseFirst', kind: 'observation' },
  { key: 'noseSecond', kind: 'observation' },
  { key: 'attack', kind: 'observation' },
  { key: 'evolution', kind: 'observation' },
  { key: 'finale', kind: 'observation' },
  { key: 'aging', kind: 'observation' },
  { key: 'guessRegion', kind: 'guess' },
  { key: 'guessGrapes', kind: 'guess' },
  { key: 'guessVintage', kind: 'guess' },
];

/** Graine par défaut (constante arbitraire) — l'appelant passe la sienne pour varier. */
const DEFAULT_SEED = 0x5e1_c0de;

/**
 * PRNG mulberry32 : rapide, déterministe, largement suffisant pour mélanger
 * une poignée de bouteilles. Retourne un générateur de flottants [0, 1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher-Yates piloté par le PRNG seedé (copie, jamais en place). */
function shuffle<T>(input: readonly T[], random: () => number): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** Indices révélables (page réponses) extraits du payload — jamais le nom du vin. */
function hintsFrom(payload: WineAnalysisPayload | undefined): string[] {
  if (!payload) return [];
  const hints: string[] = [];
  const identification = payload.identification;
  if (identification) {
    const origin = [identification.region, identification.country]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(', ');
    if (origin.length > 0) hints.push(origin);
    if (typeof identification.appellation === 'string' && identification.appellation.length > 0) {
      hints.push(identification.appellation);
    }
    if (Array.isArray(identification.grapes) && identification.grapes.length > 0) {
      const grapes = identification.grapes
        .map((g) => (g && typeof g.name === 'string' ? g.name : ''))
        .filter((name) => name.length > 0);
      if (grapes.length > 0) hints.push(grapes.join(' / '));
    }
  }
  const pairings = payload.comparisons?.foodPairings;
  if (Array.isArray(pairings)) {
    for (const dish of pairings.slice(0, 2)) {
      if (typeof dish === 'string' && dish.length > 0) hints.push(dish);
    }
  }
  return hints;
}

/**
 * Construit une session de dégustation à l'aveugle : tire `count` vins
 * (borné au nombre de vins disponibles) dans un ordre DÉTERMINISTE pour la
 * graine donnée, numérote les cartes 1..n et prépare la page de réponses.
 */
export function buildBlindTastingSession(
  wines: BlindTastingWine[],
  options?: { count?: number; seed?: number },
): BlindTastingSession {
  const seed = options?.seed ?? DEFAULT_SEED;
  const requested = options?.count ?? wines.length;
  const count = Math.max(0, Math.min(Math.floor(requested), wines.length));
  const picked = shuffle(wines, mulberry32(seed)).slice(0, count);

  const cards: BlindCard[] = [];
  const answers: BlindAnswer[] = [];
  picked.forEach((wine, index) => {
    const number = index + 1;
    cards.push({ number, steps: [...BLIND_TASTING_STEPS] });
    answers.push({
      number,
      itemId: wine.itemId,
      label: wine.label,
      ...(wine.vintage !== undefined ? { vintage: wine.vintage } : {}),
      hints: hintsFrom(wine.payload),
    });
  });
  return { cards, answers };
}
