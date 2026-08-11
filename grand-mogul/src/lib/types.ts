export type ThemeId =
  | "histoire"
  | "geographie"
  | "litterature"
  | "sciences"
  | "arts"
  | "cinema"
  | "musique"
  | "gastronomie"
  | "sport"
  | "langue"
  | "pop-culture"
  | "insolite"
  | "general";

/**
 * Question formats, per the game_script schema:
 * qcm (4 choices) | vrai_faux (2) | cash_carre_duo (answer freely ×3, among
 * 4 ×2, or among 2 ×1) | pari_confiance (qcm + confidence bet) |
 * gambit_numerique (numeric estimate) | equipe (open list of accepted answers).
 * Per the script: NO question is timed — time never influences the score.
 */
export type QuestionFormat =
  | "qcm"
  | "vrai_faux"
  | "cash_carre_duo"
  | "pari_confiance"
  | "gambit_numerique"
  | "equipe";

/** enfant suits everyone; ado also suits adults (game_script rule). */
export type AgeLevel = "enfant" | "ado" | "adulte";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Question {
  id: string;
  theme: ThemeId;
  format: QuestionFormat;
  age: AgeLevel;
  /** Internal fine-grained level used for scoring and adaptive selection. */
  difficulty: Difficulty;
  question: string;
  /** Present for qcm (4), vrai_faux (2), cash_carre_duo (4), pari_confiance (4). */
  choices?: string[];
  answerIndex?: number;
  /** Present for equipe. */
  acceptedAnswers?: string[];
  /** Present for gambit_numerique. */
  numericAnswer?: number;
  anecdote: string;
  /** ≥2 verified sources for bank questions; shown after the reveal. */
  sources: string[];
}

/** Question as stored in IndexedDB, keyed by content hash. */
export interface StoredQuestion extends Question {
  hash: string;
  origin: "seed" | "api";
  addedAt: number;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  /** Accent color used by the wheel and theme chips. */
  color: string;
}

export type CastId = "gronk" | "lilune" | "bargol" | "melissandre" | "fifrelin";

export type SkillId = "casse-tout" | "vision" | "double-ou-rien" | "temps-gele" | "joker-chante";

export interface VoiceProfile {
  pitch: number;
  rate: number;
}

export interface CastMember {
  id: CastId;
  name: string;
  title: string;
  emoji: string;
  color: string;
  skill: { id: SkillId; name: string; description: string };
  voice: VoiceProfile;
  /** Lines spoken when the skill is used — always in-register, ≤2 lines. */
  onUse: string[];
  /** Host's single retort after the skill (1 exchange max per question). */
  hostRetorts: string[];
}

export type GameMode = "solo" | "party";

export interface MatchConfig {
  mode: GameMode;
  playerNames: string[];
  questionsPerPlayer: number;
  /** Audience filter: enfant → enfant only; ado → enfant+ado; adulte → all. */
  audience: AgeLevel;
}

export interface PlayerState {
  id: number;
  name: string;
  score: number;
  streak: number;
  bestStreak: number;
  /** Consecutive misses, for the adaptive difficulty step-down. */
  missRun: number;
  tier: Difficulty;
  answered: number;
  correct: number;
  skillsUsed: Partial<Record<CastId, boolean>>;
}

export interface MatchRecord {
  id: string;
  date: number;
  mode: GameMode;
  players: { name: string; score: number; correct: number; answered: number; bestStreak: number }[];
}

export interface Settings {
  muted: boolean;
  haptics: boolean;
  colorScheme: "dark" | "light";
}

export const DEFAULT_SETTINGS: Settings = { muted: false, haptics: true, colorScheme: "dark" };
