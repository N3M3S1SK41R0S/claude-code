import type { Difficulty, PlayerState } from "./types";

export const QUESTION_TIME_S = 20;
export const FREEZE_BONUS_S = 15;

/**
 * Score for a correct answer.
 * Base 100 × difficulty; streak bonus +50 × min(streak−1, 5) from the 2nd
 * correct answer in a row; BARGOL's "Double ou rien" doubles the total.
 */
export function scoreFor(difficulty: Difficulty, streakAfter: number, doubled: boolean): number {
  const base = 100 * difficulty;
  const bonus = streakAfter >= 2 ? 50 * Math.min(streakAfter - 1, 5) : 0;
  return (base + bonus) * (doubled ? 2 : 1);
}

/** Adaptive difficulty: every 3-streak steps up a tier, 2 consecutive misses step down. */
export function applyCorrect(p: PlayerState, difficulty: Difficulty, doubled: boolean): PlayerState {
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
    score: p.score + scoreFor(difficulty, streak, doubled),
  };
}

export function applyWrong(p: PlayerState): PlayerState {
  const missRun = p.missRun + 1;
  const stepDown = missRun >= 2;
  return {
    ...p,
    streak: 0,
    missRun: stepDown ? 0 : missRun,
    tier: stepDown ? (Math.max(1, p.tier - 1) as Difficulty) : p.tier,
    answered: p.answered + 1,
  };
}

/** FIFRELIN's skip: no points, no answer counted, streak preserved. */
export function applySkip(p: PlayerState): PlayerState {
  return p;
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

/** Pick 2 wrong choice indexes to eliminate (GRONK's Casse-tout). */
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

/** LILUNE's hint: first letter and word count of the correct answer. */
export function makeHint(answer: string): string {
  const first = answer.trim().charAt(0).toUpperCase();
  const words = answer.trim().split(/\s+/).length;
  return words > 1
    ? `La réponse commence par « ${first} » et compte ${words} mots.`
    : `La réponse commence par « ${first} ».`;
}
