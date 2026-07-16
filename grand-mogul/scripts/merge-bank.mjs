// Merges the verified per-theme JSON files produced by the question-forge
// pipeline into public/data/bank.json. Usage:
//   node scripts/merge-bank.mjs <dir-with-theme-json-files>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THEME_IDS = [
  "histoire", "geographie", "litterature", "sciences", "arts",
  "cinema", "musique", "gastronomie", "sport", "langue",
];

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Usage: node scripts/merge-bank.mjs <dir>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "public", "data", "bank.json");

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const isValid = (q) =>
  q && typeof q.question === "string" && q.question.length > 10 &&
  Array.isArray(q.choices) && q.choices.length === 4 &&
  q.choices.every((c) => typeof c === "string" && c.length > 0) &&
  new Set(q.choices.map(norm)).size === 4 &&
  Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3 &&
  Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 5 &&
  typeof q.anecdote === "string" && q.anecdote.length > 10 &&
  Array.isArray(q.sources) && q.sources.length >= 2 &&
  q.sources.every((u) => typeof u === "string" && u.startsWith("https://"));

const seen = new Set();
const all = [];
const perTheme = {};

for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".json")).sort()) {
  const theme = file.replace(/\.json$/, "");
  if (!THEME_IDS.includes(theme)) {
    console.warn(`! skipping ${file}: unknown theme`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(join(srcDir, file), "utf8"));
  } catch (err) {
    console.warn(`! skipping ${file}: invalid JSON (${err.message})`);
    continue;
  }
  const questions = (data.questions ?? []).filter(isValid);
  let kept = 0;
  for (const q of questions) {
    const key = norm(q.question);
    if (seen.has(key)) continue;
    seen.add(key);
    kept += 1;
    all.push({
      id: `${theme}-${String(kept).padStart(3, "0")}`,
      theme,
      difficulty: q.difficulty,
      question: q.question.trim(),
      choices: q.choices.map((c) => c.trim()),
      answerIndex: q.answerIndex,
      anecdote: q.anecdote.trim(),
      sources: q.sources,
    });
  }
  perTheme[theme] = kept;
}

const bank = { version: Date.now(), count: all.length, questions: all };
writeFileSync(outFile, JSON.stringify(bank, null, 1) + "\n", "utf8");

console.log("Per-theme:", perTheme);
console.log(`Total: ${all.length} questions → ${outFile}`);
if (all.length < 200) console.warn(`⚠ below the 200-question target (${all.length})`);
