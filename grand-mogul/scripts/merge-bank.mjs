// Builds public/data/bank.json from the two verified sources:
//   1. the forge output (per-theme JSON files of generated+fact-checked QCM),
//   2. the client game_script (data/game-script.json), admitted only with a
//      passing verdict in data/script-verification.json (sources + fixes).
// Usage: node scripts/merge-bank.mjs <forge-dir>
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THEME_IDS = [
  "histoire", "geographie", "litterature", "sciences", "arts", "cinema",
  "musique", "gastronomie", "sport", "langue", "pop-culture", "insolite", "general",
];

const SCRIPT_CATEGORY_MAP = {
  "Géographie": "geographie",
  "Histoire": "histoire",
  "Sciences & Nature": "sciences",
  "Sport": "sport",
  "Pop Culture": "pop-culture",
  "Insolite": "insolite",
  "Burger Loufoque": "insolite",
  "Général": "general",
};

const AGE_TO_DIFFICULTY = { enfant: 1, ado: 3, adulte: 4 };
const DIFFICULTY_TO_AGE = (d) => (d <= 1 ? "enfant" : d <= 3 ? "ado" : "adulte");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const forgeDir = process.argv[2];
const scriptFile = join(root, "data", "game-script.json");
const verifFile = join(root, "data", "script-verification.json");
const outFile = join(root, "public", "data", "bank.json");

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const seen = new Set();
const all = [];
const report = { forge: {}, script: { kept: 0, dropped: [] } };

function push(q) {
  const key = norm(q.question);
  if (seen.has(key)) return false;
  seen.add(key);
  all.push(q);
  return true;
}

/* ---------- 1. forge output (QCM, difficulty 1-5) ---------- */

if (forgeDir && existsSync(forgeDir)) {
  for (const file of readdirSync(forgeDir).filter((f) => f.endsWith(".json")).sort()) {
    const theme = file.replace(/\.json$/, "");
    if (!THEME_IDS.includes(theme)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(join(forgeDir, file), "utf8"));
    } catch (err) {
      console.warn(`! skipping ${file}: invalid JSON (${err.message})`);
      continue;
    }
    let kept = 0;
    for (const q of data.questions ?? []) {
      const valid =
        q && typeof q.question === "string" && q.question.length > 10 &&
        Array.isArray(q.choices) && q.choices.length === 4 &&
        q.choices.every((c) => typeof c === "string" && c.length > 0) &&
        new Set(q.choices.map(norm)).size === 4 &&
        Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3 &&
        Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 5 &&
        typeof q.anecdote === "string" && q.anecdote.length > 10 &&
        Array.isArray(q.sources) && q.sources.length >= 2 &&
        q.sources.every((u) => typeof u === "string" && u.startsWith("https://"));
      if (!valid) continue;
      const added = push({
        id: `${theme}-${String(kept + 1).padStart(3, "0")}`,
        theme,
        format: "qcm",
        age: DIFFICULTY_TO_AGE(q.difficulty),
        difficulty: q.difficulty,
        question: q.question.trim(),
        choices: q.choices.map((c) => c.trim()),
        answerIndex: q.answerIndex,
        anecdote: q.anecdote.trim(),
        sources: q.sources,
      });
      if (added) kept += 1;
    }
    report.forge[theme] = kept;
  }
} else {
  console.warn("! no forge dir provided or not found — merging script questions only");
}

/* ---------- 2. game_script questions, gated by their verification ---------- */

if (existsSync(scriptFile) && existsSync(verifFile)) {
  const script = JSON.parse(readFileSync(scriptFile, "utf8"));
  const verifs = JSON.parse(readFileSync(verifFile, "utf8"));
  const byId = Object.fromEntries((verifs.verdicts ?? []).map((v) => [v.id, v]));

  for (const q of script.questions ?? []) {
    const v = byId[q.id];
    if (!v) {
      report.script.dropped.push(`${q.id}: aucun verdict de vérification`);
      continue;
    }
    if (!v.keep || v.confidence < 0.9) {
      report.script.dropped.push(`${q.id}: ${v.reason}`);
      continue;
    }
    const sources = (v.sources ?? []).filter((u) => typeof u === "string" && u.startsWith("https://"));
    if (sources.length < 2) {
      report.script.dropped.push(`${q.id}: moins de 2 sources vérifiées`);
      continue;
    }
    const theme = SCRIPT_CATEGORY_MAP[q.categorie];
    if (!theme) {
      report.script.dropped.push(`${q.id}: catégorie inconnue "${q.categorie}"`);
      continue;
    }
    const age = ["enfant", "ado", "adulte"].includes(q.niveau_age) ? q.niveau_age : "adulte";
    const base = {
      id: `script-${q.id}`,
      theme,
      format: q.format,
      age,
      difficulty: AGE_TO_DIFFICULTY[age],
      question: (v.correctedText ?? q.texte).trim(),
      anecdote: (v.correctedAnecdote ?? q.anecdote).trim(),
      sources,
    };

    let entry = null;
    if (["qcm", "vrai_faux", "cash_carre_duo", "pari_confiance"].includes(q.format)) {
      const choices = (q.choix ?? []).map((c) => String(c).trim());
      const answerIndex = choices.findIndex((c) => norm(c) === norm(String(q.bonne_reponse ?? "")));
      const n = q.format === "vrai_faux" ? 2 : 4;
      if (choices.length === n && answerIndex >= 0) entry = { ...base, choices, answerIndex };
      else report.script.dropped.push(`${q.id}: choix/réponse incohérents`);
    } else if (q.format === "equipe") {
      const accepted = [...new Set([...(q.reponses_acceptees ?? []), ...(v.additionalAccepted ?? [])])]
        .map((a) => String(a).trim())
        .filter(Boolean);
      if (accepted.length >= 1) entry = { ...base, acceptedAnswers: accepted };
      else report.script.dropped.push(`${q.id}: aucune réponse acceptée`);
    } else if (q.format === "gambit_numerique") {
      if (Number.isFinite(q.reponse_numerique)) entry = { ...base, numericAnswer: q.reponse_numerique };
      else report.script.dropped.push(`${q.id}: réponse numérique manquante`);
    } else {
      report.script.dropped.push(`${q.id}: format inconnu "${q.format}"`);
    }

    if (entry && push(entry)) report.script.kept += 1;
  }
} else {
  console.warn("! game-script.json or script-verification.json missing — script questions skipped");
}

const bank = { version: Date.now(), count: all.length, questions: all };
writeFileSync(outFile, JSON.stringify(bank, null, 1) + "\n", "utf8");

console.log("Forge per-theme:", report.forge);
console.log(`Script: ${report.script.kept} gardées, ${report.script.dropped.length} écartées`);
for (const d of report.script.dropped) console.log(`  - ${d}`);
console.log(`Total: ${all.length} questions → ${outFile}`);
if (all.length < 200) console.warn(`⚠ below the 200-question target (${all.length})`);
