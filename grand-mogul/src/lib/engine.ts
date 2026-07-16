import type { AgeLevel, Difficulty, PlayerState, Question } from "./types";

/*
 * Scoring — per the game_script rule, TIME NEVER INFLUENCES THE SCORE
 * (no question is timed). Points come only from difficulty, streaks,
 * format multipliers and jokers.
 */

export function basePoints(difficulty: Difficulty): number {
  return 100 * difficulty;
}

function streakBonus(streakAfter: number): number {
  return streakAfter >= 2 ? 50 * Math.min(streakAfter - 1, 5) : 0;
}

/** Total for a correct answer. `multiplier` composes format × jokers. */
export function scoreFor(difficulty: Difficulty, streakAfter: number, multiplier: number): number {
  return Math.round((basePoints(difficulty) + streakBonus(streakAfter)) * multiplier);
}

/** Adaptive difficulty: every 3-streak steps up a tier, 2 consecutive misses step down. */
export function applyCorrect(p: PlayerState, difficulty: Difficulty, multiplier: number): PlayerState {
  const streak = p.streak + 1;
  const tier = streak > 0 && streak % 3 === 0 ? (Math.min(5, p.tier + 1) as Difficulty) : p.tier;
  return {
    ...p,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    missRun: 0,
    tier,
    answered: p.answered + 1,
    correct: p.correct + 1,
    score: p.score + scoreFor(difficulty, streak, multiplier),
  };
}

/** `penalty` > 0 only for a lost confident bet (pari_confiance). Score never goes below 0. */
export function applyWrong(p: PlayerState, penalty = 0): PlayerState {
  const missRun = p.missRun + 1;
  const stepDown = missRun >= 2;
  return {
    ...p,
    streak: 0,
    missRun: stepDown ? 0 : missRun,
    tier: stepDown ? (Math.max(1, p.tier - 1) as Difficulty) : p.tier,
    answered: p.answered + 1,
    score: Math.max(0, p.score - penalty),
  };
}

export function makePlayer(id: number, name: string): PlayerState {
  return {
    id,
    name,
    score: 0,
    streak: 0,
    bestStreak: 0,
    missRun: 0,
    tier: 2,
    answered: 0,
    correct: 0,
    skillsUsed: {},
  };
}

/* ---------- age ↔ difficulty mapping (unifies script and forge banks) ---------- */

export function difficultyForAge(age: AgeLevel): Difficulty {
  return age === "enfant" ? 1 : age === "ado" ? 3 : 4;
}

export function ageForDifficulty(d: Difficulty): AgeLevel {
  return d <= 1 ? "enfant" : d <= 3 ? "ado" : "adulte";
}

/* ---------- format multipliers ---------- */

/** cash ×3, carré ×2, duo ×1 — the classic risk ladder. */
export const CCD_MULTIPLIER = { cash: 3, carre: 2, duo: 1 } as const;
export type CcdMode = keyof typeof CCD_MULTIPLIER;

/** pari_confiance: confident doubles the gain but a miss costs half the base. */
export const CONFIDENCE = {
  sur: { multiplier: 2, penaltyOfBase: 0.5 },
  prudent: { multiplier: 1, penaltyOfBase: 0 },
} as const;
export type ConfidenceLevel = keyof typeof CONFIDENCE;

/**
 * gambit_numerique: exact ×2, close ×1, near-miss ×0.5, else 0.
 * Year-like answers use absolute tolerance (±3 / ±10), other magnitudes
 * a relative one (10 % / 25 %).
 */
export function gambitMultiplier(guess: number, answer: number): number {
  if (!Number.isFinite(guess)) return 0;
  const diff = Math.abs(guess - answer);
  if (diff === 0) return 2;
  const yearLike = Number.isInteger(answer) && answer >= 1000 && answer <= 2100;
  if (yearLike) return diff <= 3 ? 1 : diff <= 10 ? 0.5 : 0;
  const rel = diff / Math.max(1, Math.abs(answer));
  return rel <= 0.1 ? 1 : rel <= 0.25 ? 0.5 : 0;
}

/* ---------- free-text answer matching (cash / equipe) ---------- */

const LEADING_ARTICLES = /^(le |la |les |l'|un |une |des |du |de la |de l')/;

export function normalizeAnswer(s: string): string {
  let n = s
    .toLowerCase()
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  while (LEADING_ARTICLES.test(n)) n = n.replace(LEADING_ARTICLES, "");
  return n.replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Lenient matching for typed answers: exact after normalization, or a
 * containment match when the typed answer is substantial enough (≥4 chars)
 * — "pyramide de gizeh" matches "la grande pyramide de Gizeh".
 */
export function answerMatches(user: string, accepted: string[]): boolean {
  const nu = normalizeAnswer(user);
  if (!nu) return false;
  return accepted.some((a) => {
    const na = normalizeAnswer(a);
    if (!na) return false;
    if (na === nu) return true;
    if (nu.length >= 4 && na.includes(nu)) return true;
    if (na.length >= 4 && nu.includes(na)) return true;
    return false;
  });
}

/** Every text answer the question considers correct (cash mode + equipe). */
export function correctTexts(q: Question): string[] {
  const texts: string[] = [];
  if (q.choices && q.answerIndex !== undefined && q.choices[q.answerIndex]) {
    texts.push(q.choices[q.answerIndex] as string);
  }
  if (q.acceptedAnswers) texts.push(...q.acceptedAnswers);
  if (q.numericAnswer !== undefined) texts.push(String(q.numericAnswer));
  return texts;
}

/* ---------- jokers ---------- */

/** Pick 2 wrong choice indexes to eliminate (GRONK's Casse-tout, needs ≥4 choices). */
export function pickEliminations(answerIndex: number, choiceCount: number, rng: () => number = Math.random): number[] {
  const wrong = Array.from({ length: choiceCount }, (_, i) => i).filter((i) => i !== answerIndex);
  for (let i = wrong.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const wi = wrong[i] as number;
    wrong[i] = wrong[j] as number;
    wrong[j] = wi;
  }
  return wrong.slice(0, 2);
}

/** LILUNE's hint, from whatever shape the answer takes. */
export function makeHint(q: Question): string {
  if (q.numericAnswer !== undefined) {
    const digits = String(Math.abs(Math.trunc(q.numericAnswer))).length;
    return `La réponse s'écrit avec ${digits} chiffre${digits > 1 ? "s" : ""}.`;
  }
  const answer = correctTexts(q)[0] ?? "";
  const first = answer.trim().charAt(0).toUpperCase();
  const words = answer.trim().split(/\s+/).length;
  return words > 1
    ? `La réponse commence par « ${first} » et compte ${words} mots.`
    : `La réponse commence par « ${first} ».`;
}
