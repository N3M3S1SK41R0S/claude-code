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
  | "langue";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Question {
  id: string;
  theme: ThemeId;
  difficulty: Difficulty;
  question: string;
  choices: string[];
  answerIndex: number;
  anecdote: string;
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
