import { idb, idbAvailable } from "./db";
import { questionHash } from "./hash";
import { allowedAges, THEMES } from "./themes";
import type { AgeLevel, Difficulty, Question, StoredQuestion, ThemeId } from "./types";

const SEED_VERSION_KEY = "seedVersion";

/** In-memory fallback when IndexedDB is unavailable (private mode, etc.). */
let memoryBank: StoredQuestion[] | null = null;
const memoryAsked = new Set<string>();
const memoryFlagged = new Set<string>();

const AGES: AgeLevel[] = ["enfant", "ado", "adulte"];
const FORMATS = ["qcm", "vrai_faux", "cash_carre_duo", "pari_confiance", "gambit_numerique", "equipe"];

export function isValidQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const c = q as Record<string, unknown>;
  const base =
    typeof c.id === "string" &&
    typeof c.question === "string" &&
    c.question.length > 5 &&
    typeof c.anecdote === "string" &&
    THEMES.some((t) => t.id === c.theme) &&
    FORMATS.includes(c.format as string) &&
    AGES.includes(c.age as AgeLevel) &&
    typeof c.difficulty === "number" &&
    c.difficulty >= 1 &&
    c.difficulty <= 5 &&
    Array.isArray(c.sources) &&
    c.sources.every((u) => typeof u === "string" && u.startsWith("https://"));
  if (!base) return false;

  const choicesOk = (n: number) =>
    Array.isArray(c.choices) &&
    c.choices.length === n &&
    c.choices.every((x) => typeof x === "string" && x.length > 0) &&
    typeof c.answerIndex === "number" &&
    Number.isInteger(c.answerIndex) &&
    c.answerIndex >= 0 &&
    c.answerIndex < n;

  switch (c.format) {
    case "qcm":
    case "cash_carre_duo":
    case "pari_confiance":
      return choicesOk(4);
    case "vrai_faux":
      return choicesOk(2);
    case "equipe":
      return Array.isArray(c.acceptedAnswers) && c.acceptedAnswers.length >= 1 &&
        c.acceptedAnswers.every((x) => typeof x === "string" && x.length > 0);
    case "gambit_numerique":
      return typeof c.numericAnswer === "number" && Number.isFinite(c.numericAnswer);
    default:
      return false;
  }
}

async function toStored(q: Question, origin: "seed" | "api"): Promise<StoredQuestion> {
  return { ...q, hash: await questionHash(q.question), origin, addedAt: Date.now() };
}

/**
 * Load the shipped bank (public/data/bank.json, precached by the service
 * worker) into IndexedDB. Idempotent per seed version; a version change
 * also purges seed questions that were removed or reworded upstream, so
 * corrections actually reach existing players.
 */
export async function ensureSeedLoaded(): Promise<number> {
  try {
    const res = await fetch("/data/bank.json");
    if (!res.ok) throw new Error(`bank.json ${res.status}`);
    const data = (await res.json()) as { version: number; questions: unknown[] };
    const questions = (data.questions ?? []).filter(isValidQuestion);

    if (!idbAvailable()) {
      memoryBank = await Promise.all(questions.map((q) => toStored(q, "seed")));
      return memoryBank.length;
    }

    const meta = await idb.get<{ key: string; value: number }>("meta", SEED_VERSION_KEY);
    if (meta?.value !== data.version) {
      const stored = await Promise.all(questions.map((q) => toStored(q, "seed")));
      const newHashes = new Set(stored.map((s) => s.hash));
      // Purge stale seed entries (removed/reworded upstream); keep API ones.
      const existing = await idb.getAll<StoredQuestion>("questions");
      for (const old of existing) {
        if (old.origin === "seed" && !newHashes.has(old.hash)) {
          await idb.delete("questions", old.hash);
        }
      }
      for (const s of stored) await idb.put("questions", s);
      await idb.put("meta", { key: SEED_VERSION_KEY, value: data.version });
    }
    return idb.count("questions");
  } catch {
    return idbAvailable() ? idb.count("questions").catch(() => 0) : (memoryBank?.length ?? 0);
  }
}

async function excludedHashes(): Promise<Set<string>> {
  if (!idbAvailable()) return new Set([...memoryAsked, ...memoryFlagged]);
  const [askedKeys, flagKeys] = await Promise.all([idb.getAllKeys("asked"), idb.getAllKeys("flags")]);
  return new Set([...askedKeys, ...flagKeys].map(String));
}

async function allQuestions(): Promise<StoredQuestion[]> {
  if (!idbAvailable()) return (memoryBank ?? []).filter((q) => !memoryFlagged.has(q.hash));
  return idb.getAll<StoredQuestion>("questions");
}

async function allUsable(): Promise<StoredQuestion[]> {
  const [questions, excluded] = await Promise.all([allQuestions(), excludedHashes()]);
  return questions.filter((q) => !excluded.has(q.hash));
}

/**
 * Pick the next question: audience filter first (enfant suits everyone,
 * ado also suits adults), then requested theme, then difficulty as close
 * to the player's tier as possible. `excludeMatch` holds the hashes served
 * during the current match so recycling the "asked" ledger when the bank
 * runs dry can never repeat a question within the same match.
 */
export async function nextQuestion(
  theme: ThemeId | null,
  tier: Difficulty,
  audience: AgeLevel,
  excludeMatch: ReadonlySet<string>,
): Promise<StoredQuestion | null> {
  const ages = new Set(allowedAges(audience));
  const usable = () => allUsable().then((qs) => qs.filter((q) => ages.has(q.age)));

  let pool = await usable();
  if (pool.filter((q) => !excludeMatch.has(q.hash)).length === 0) {
    // Bank cycle finished: forget served questions (never the flagged ones).
    if (idbAvailable()) await idb.clear("asked").catch(() => {});
    memoryAsked.clear();
    pool = await usable();
    if (pool.length === 0) return null;
  }
  // Never repeat within the current match, unless the whole bank is smaller
  // than the match itself (then repetition beats a dead end).
  const noRepeat = pool.filter((q) => !excludeMatch.has(q.hash));
  const candidates0 = noRepeat.length > 0 ? noRepeat : pool;
  const inTheme = theme ? candidates0.filter((q) => q.theme === theme) : candidates0;
  const candidates = inTheme.length > 0 ? inTheme : candidates0;
  for (const spread of [0, 1, 2, 3, 4]) {
    const near = candidates.filter((q) => Math.abs(q.difficulty - tier) <= spread);
    if (near.length > 0) return near[Math.floor(Math.random() * near.length)] as StoredQuestion;
  }
  return candidates[Math.floor(Math.random() * candidates.length)] as StoredQuestion;
}

export async function markAsked(hash: string): Promise<void> {
  if (!idbAvailable()) {
    memoryAsked.add(hash);
    return;
  }
  await idb.put("asked", { hash, at: Date.now() }).catch(() => {});
}

/** Player report: quarantine the question locally and log it. */
export async function flagQuestion(q: StoredQuestion, reason: string): Promise<void> {
  console.warn(`[report-error] question quarantined: "${q.question}" — ${reason}`);
  if (!idbAvailable()) {
    memoryFlagged.add(q.hash);
    return;
  }
  await idb.put("flags", { hash: q.hash, reason, question: q.question, at: Date.now() }).catch(() => {});
}

export async function bankStats(): Promise<{ total: number; fresh: number }> {
  const [questions, excluded] = await Promise.all([allQuestions(), excludedHashes()]);
  const fresh = questions.filter((q) => !excluded.has(q.hash)).length;
  return { total: questions.length, fresh };
}

let prefetchInFlight = false;

/**
 * Ask /api/questions for a fresh batch while the match is running, so the
 * next questions are already local when needed. Silently no-ops offline,
 * without an API key server-side, or when a fetch is already in flight.
 */
export async function prefetchBatch(theme: ThemeId | null, tier: Difficulty): Promise<void> {
  if (prefetchInFlight) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  prefetchInFlight = true;
  try {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, difficulty: tier, count: 8 }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { questions?: unknown[] };
    const fresh = (data.questions ?? []).filter(isValidQuestion);
    for (const q of fresh) {
      const stored = await toStored(q, "api");
      if (!idbAvailable()) {
        const dupe = memoryFlagged.has(stored.hash) || (memoryBank ?? []).some((m) => m.hash === stored.hash);
        if (!dupe) memoryBank = [...(memoryBank ?? []), stored];
        continue;
      }
      const [existing, flagged] = await Promise.all([
        idb.get("questions", stored.hash),
        idb.get("flags", stored.hash),
      ]);
      if (!existing && !flagged) await idb.put("questions", stored);
    }
  } catch {
    // Offline or API down: the local bank carries the game.
  } finally {
    prefetchInFlight = false;
  }
}
