import { idb, idbAvailable } from "./db";
import { questionHash } from "./hash";
import { THEMES } from "./themes";
import type { Difficulty, Question, StoredQuestion, ThemeId } from "./types";

const SEED_VERSION_KEY = "seedVersion";

/** In-memory fallback when IndexedDB is unavailable (private mode, etc.). */
let memoryBank: StoredQuestion[] | null = null;
const memoryAsked = new Set<string>();

function isValidQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const c = q as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.question === "string" &&
    Array.isArray(c.choices) &&
    c.choices.length === 4 &&
    c.choices.every((x) => typeof x === "string") &&
    typeof c.answerIndex === "number" &&
    c.answerIndex >= 0 &&
    c.answerIndex <= 3 &&
    typeof c.difficulty === "number" &&
    c.difficulty >= 1 &&
    c.difficulty <= 5 &&
    typeof c.anecdote === "string" &&
    Array.isArray(c.sources) &&
    c.sources.length >= 2 &&
    THEMES.some((t) => t.id === c.theme)
  );
}

async function toStored(q: Question, origin: "seed" | "api"): Promise<StoredQuestion> {
  return { ...q, hash: await questionHash(q.question), origin, addedAt: Date.now() };
}

/**
 * Load the shipped bank (public/data/bank.json, precached by the service
 * worker) into IndexedDB. Idempotent per seed version. Returns bank size.
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
      for (const q of questions) {
        await idb.put("questions", await toStored(q, "seed"));
      }
      await idb.put("meta", { key: SEED_VERSION_KEY, value: data.version });
    }
    return idb.count("questions");
  } catch {
    return idbAvailable() ? idb.count("questions").catch(() => 0) : (memoryBank?.length ?? 0);
  }
}

async function allUsable(): Promise<StoredQuestion[]> {
  if (!idbAvailable()) {
    return (memoryBank ?? []).filter((q) => !memoryAsked.has(q.hash));
  }
  const [questions, askedKeys, flagKeys] = await Promise.all([
    idb.getAll<StoredQuestion>("questions"),
    idb.getAllKeys("asked"),
    idb.getAllKeys("flags"),
  ]);
  const excluded = new Set([...askedKeys, ...flagKeys].map(String));
  return questions.filter((q) => !excluded.has(q.hash));
}

/**
 * Pick the next question: requested theme first, difficulty as close to the
 * player's tier as possible; recycles the "asked" ledger when the bank runs dry.
 */
export async function nextQuestion(theme: ThemeId | null, tier: Difficulty): Promise<StoredQuestion | null> {
  let pool = await allUsable();
  if (pool.length === 0) {
    // Bank cycle finished: forget served questions (never the flagged ones).
    if (idbAvailable()) await idb.clear("asked").catch(() => {});
    memoryAsked.clear();
    pool = await allUsable();
    if (pool.length === 0) return null;
  }
  const inTheme = theme ? pool.filter((q) => q.theme === theme) : pool;
  const candidates = inTheme.length > 0 ? inTheme : pool;
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
    memoryBank = (memoryBank ?? []).filter((m) => m.hash !== q.hash);
    return;
  }
  await idb.put("flags", { hash: q.hash, reason, question: q.question, at: Date.now() }).catch(() => {});
}

export async function bankStats(): Promise<{ total: number; fresh: number }> {
  if (!idbAvailable()) {
    const total = memoryBank?.length ?? 0;
    return { total, fresh: total - memoryAsked.size };
  }
  const [total, asked, flagged] = await Promise.all([
    idb.count("questions"),
    idb.count("asked"),
    idb.count("flags"),
  ]);
  return { total, fresh: Math.max(0, total - asked - flagged) };
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
      body: JSON.stringify({ theme, difficulty: tier, count: 10 }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { questions?: unknown[] };
    const fresh = (data.questions ?? []).filter(isValidQuestion);
    for (const q of fresh) {
      const stored = await toStored(q, "api");
      if (!idbAvailable()) {
        memoryBank = [...(memoryBank ?? []), stored];
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
