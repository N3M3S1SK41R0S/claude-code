// Appends verified questions (any difficulty 1-5) to public/data/bank.json.
// Same bar as merge-bank.mjs but as an APPEND (the forge dirs are not kept on
// disk, so a full re-merge is not possible). Every candidate is re-validated
// (>=2 distinct https sources, coherent choices/answer, deduped against the
// whole bank) and rejected by default. `age` is derived from difficulty like
// merge-bank; ids are namespaced `ext-NNNN` to never collide with `theme-NNN`.
// Formats: qcm, vrai_faux, gambit_numerique. Usage:
//   node scripts/add-questions.mjs <candidates.json> [candidates2.json ...]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THEME_IDS = new Set([
  "histoire", "geographie", "litterature", "sciences", "arts", "cinema",
  "musique", "gastronomie", "sport", "langue", "pop-culture", "insolite", "general",
]);
const DIFFICULTY_TO_AGE = (d) => (d <= 1 ? "enfant" : d <= 3 ? "ado" : "adulte");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bankFile = join(root, "public", "data", "bank.json");
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/add-questions.mjs <candidates.json> [more.json ...]");
  process.exit(1);
}

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const bank = JSON.parse(readFileSync(bankFile, "utf8"));
const seen = new Set(bank.questions.map((q) => norm(q.question)));
let n = bank.questions.reduce((max, q) => {
  const m = /^ext-(\d+)$/.exec(q.id ?? "");
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);

const dropped = [];
const kept = [];

for (const file of files) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const candidates = Array.isArray(data) ? data : data.questions ?? [];
  for (const q of candidates) {
    const why = (r) => { dropped.push(`${(q.question ?? "??").slice(0, 50)} — ${r}`); return false; };
    const ok = (() => {
      if (typeof q.question !== "string" || q.question.trim().length <= 10) return why("question trop courte");
      if (typeof q.anecdote !== "string" || q.anecdote.trim().length <= 10) return why("anecdote trop courte");
      if (!THEME_IDS.has(q.theme)) return why(`thème inconnu "${q.theme}"`);
      if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) return why("difficulté hors 1-5");
      if (!Array.isArray(q.sources) || q.sources.length < 2 ||
          !q.sources.every((u) => typeof u === "string" && u.startsWith("https://"))) return why("< 2 sources https");
      if (new Set(q.sources).size < 2) return why("sources non distinctes");
      const key = norm(q.question);
      if (seen.has(key)) return why("doublon");
      if (q.format === "qcm" || q.format === "vrai_faux") {
        const nc = q.format === "vrai_faux" ? 2 : 4;
        if (!Array.isArray(q.choices) || q.choices.length !== nc) return why("nombre de choix invalide");
        if (!q.choices.every((c) => typeof c === "string" && c.trim().length > 0)) return why("choix vide");
        if (new Set(q.choices.map(norm)).size !== nc) return why("choix en double");
        if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= nc) return why("answerIndex invalide");
      } else if (q.format === "gambit_numerique") {
        if (!Number.isFinite(q.numericAnswer)) return why("numericAnswer invalide");
      } else if (q.format === "equipe") {
        if (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length < 3 ||
            !q.acceptedAnswers.every((a) => typeof a === "string" && a.trim().length > 0)) return why("acceptedAnswers invalide (>=3)");
      } else {
        return why(`format "${q.format}" non pris en charge`);
      }
      return true;
    })();
    if (!ok) continue;
    seen.add(norm(q.question));
    n += 1;
    const entry = {
      id: `ext-${String(n).padStart(4, "0")}`,
      theme: q.theme,
      age: DIFFICULTY_TO_AGE(q.difficulty),
      difficulty: q.difficulty,
      question: q.question.trim(),
      anecdote: q.anecdote.trim(),
      sources: q.sources,
      format: q.format,
    };
    if (q.format === "gambit_numerique") entry.numericAnswer = q.numericAnswer;
    else if (q.format === "equipe") entry.acceptedAnswers = q.acceptedAnswers.map((a) => a.trim());
    else { entry.choices = q.choices.map((c) => c.trim()); entry.answerIndex = q.answerIndex; }
    kept.push(entry);
  }
}

bank.questions.push(...kept);
bank.count = bank.questions.length;
writeFileSync(bankFile, JSON.stringify(bank, null, 1) + "\n", "utf8");

console.log(`gardées : ${kept.length}`);
console.log(`écartées : ${dropped.length}`);
for (const d of dropped) console.log(`  - ${d}`);
console.log(`Total banque : ${bank.count} → ${bankFile}`);
