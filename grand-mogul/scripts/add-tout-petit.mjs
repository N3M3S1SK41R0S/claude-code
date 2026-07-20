// Appends verified "tout_petit" (2-5 ans) questions to public/data/bank.json.
// The normal merge-bank pipeline derives `age` from `difficulty` and can only
// emit enfant/ado/adulte, so the toddler tier is added here from a separate
// forge file of already fact-checked candidates. Every candidate is re-checked
// (>=2 https sources, coherent choices, deduped against the whole bank) and
// rejected by default. Usage: node scripts/add-tout-petit.mjs <candidates.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THEME_IDS = new Set([
  "histoire", "geographie", "litterature", "sciences", "arts", "cinema",
  "musique", "gastronomie", "sport", "langue", "pop-culture", "insolite", "general",
]);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bankFile = join(root, "public", "data", "bank.json");
const candFile = process.argv[2];
if (!candFile) {
  console.error("Usage: node scripts/add-tout-petit.mjs <candidates.json>");
  process.exit(1);
}

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const bank = JSON.parse(readFileSync(bankFile, "utf8"));
const cand = JSON.parse(readFileSync(candFile, "utf8"));
const candidates = Array.isArray(cand) ? cand : cand.questions ?? [];

const seen = new Set(bank.questions.map((q) => norm(q.question)));
const dropped = [];
const kept = [];
// Continue numbering after any tout_petit already present (append-safe waves).
let n = bank.questions.reduce((max, q) => {
  const m = /^tp-(\d+)$/.exec(q.id ?? "");
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);

for (const q of candidates) {
  const why = (r) => { dropped.push(`${(q.question ?? "??").slice(0, 50)} — ${r}`); return false; };
  const ok = (() => {
    if (typeof q.question !== "string" || q.question.trim().length <= 10) return why("question trop courte");
    if (typeof q.anecdote !== "string" || q.anecdote.trim().length <= 10) return why("anecdote trop courte");
    if (!THEME_IDS.has(q.theme)) return why(`thème inconnu "${q.theme}"`);
    if (!Array.isArray(q.sources) || q.sources.length < 2 ||
        !q.sources.every((u) => typeof u === "string" && u.startsWith("https://"))) return why("< 2 sources https");
    // distinct source hosts (independence heuristic)
    const hosts = new Set(q.sources.map((u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } }));
    if (hosts.size < 2) return why("sources non indépendantes (même hôte)");
    const key = norm(q.question);
    if (seen.has(key)) return why("doublon");
    const nChoices = q.format === "vrai_faux" ? 2 : 4;
    if (q.format !== "qcm" && q.format !== "vrai_faux") return why(`format "${q.format}"`);
    if (!Array.isArray(q.choices) || q.choices.length !== nChoices) return why("nombre de choix invalide");
    if (!q.choices.every((c) => typeof c === "string" && c.trim().length > 0)) return why("choix vide");
    if (new Set(q.choices.map(norm)).size !== nChoices) return why("choix en double");
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= nChoices) return why("answerIndex invalide");
    return true;
  })();
  if (!ok) continue;
  seen.add(norm(q.question));
  n += 1;
  kept.push({
    id: `tp-${String(n).padStart(3, "0")}`,
    theme: q.theme,
    age: "tout_petit",
    difficulty: 1,
    question: q.question.trim(),
    anecdote: q.anecdote.trim(),
    sources: q.sources,
    format: q.format,
    choices: q.choices.map((c) => c.trim()),
    answerIndex: q.answerIndex,
  });
}

bank.questions.push(...kept);
bank.count = bank.questions.length;
writeFileSync(bankFile, JSON.stringify(bank, null, 1) + "\n", "utf8");

console.log(`tout_petit gardées : ${kept.length}`);
console.log(`écartées : ${dropped.length}`);
for (const d of dropped) console.log(`  - ${d}`);
console.log(`Total banque : ${bank.count} → ${bankFile}`);
