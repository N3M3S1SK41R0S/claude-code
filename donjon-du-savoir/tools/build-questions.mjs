// Builds data/questions.json for Le Donjon du Savoir from the already
// fact-checked bank of the grand-mogul project (each entry verified against
// ≥2 independent sources), plus the two game_script questions that were
// quarantined for anecdote issues only (S7, B4) — reintegrated here WITH the
// corrected wording their verifiers provided. V2 stays excluded (wrong answer).
// Usage: node tools/build-questions.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gm = join(root, "..", "grand-mogul");

const bank = JSON.parse(readFileSync(join(gm, "public", "data", "bank.json"), "utf8"));
const script = JSON.parse(readFileSync(join(gm, "data", "game-script.json"), "utf8"));
const verifs = JSON.parse(readFileSync(join(gm, "data", "script-verification.json"), "utf8"));

const CATEGORY_LABEL = {
  histoire: "Histoire",
  geographie: "Géographie",
  sciences: "Sciences & Nature",
  sport: "Sport",
  "pop-culture": "Pop Culture",
  insolite: "Insolite",
  general: "Général",
  litterature: "Littérature",
  arts: "Arts",
  cinema: "Cinéma",
  musique: "Musique",
  gastronomie: "Gastronomie",
  langue: "Langue française",
};

const questions = [];

for (const q of bank.questions) {
  const entry = {
    id: q.id,
    categorie: CATEGORY_LABEL[q.theme] ?? "Général",
    niveau_age: q.age,
    difficulte: q.difficulty,
    format: q.format,
    texte: q.question,
    anecdote: q.anecdote,
    sources: q.sources,
  };
  if (q.choices) {
    entry.choix = q.choices;
    entry.bonne_reponse = q.choices[q.answerIndex];
  }
  if (q.acceptedAnswers) entry.reponses_acceptees = q.acceptedAnswers;
  if (q.numericAnswer !== undefined) entry.reponse_numerique = q.numericAnswer;
  questions.push(entry);
}

// S7 and B4: verifiers said keep=true but confidence 0.85 because of anecdote
// wording — both provided corrections. With corrections applied they meet the
// bar for family play; V2 is NOT reintegrated (its answer key is wrong).
const AGE_TO_DIFF = { enfant: 1, ado: 3, adulte: 4 };
const byId = Object.fromEntries(verifs.verdicts.map((v) => [v.id, v]));
for (const id of ["S7", "B4"]) {
  const src = script.questions.find((s) => s.id === id);
  const v = byId[id];
  if (!src || !v || !v.keep) continue;
  const sources = (v.sources ?? []).filter((u) => typeof u === "string" && u.startsWith("https://"));
  if (sources.length < 2) continue;
  questions.push({
    id: `script-${id}`,
    categorie: src.categorie === "Burger Loufoque" ? "Insolite" : src.categorie,
    niveau_age: src.niveau_age,
    difficulte: AGE_TO_DIFF[src.niveau_age] ?? 3,
    format: src.format,
    texte: (v.correctedText ?? src.texte).trim(),
    choix: src.choix,
    bonne_reponse: src.bonne_reponse,
    anecdote: (v.correctedAnecdote ?? src.anecdote).trim(),
    sources,
  });
}

const out = { version: 2, count: questions.length, questions };
writeFileSync(join(root, "data", "questions.json"), JSON.stringify(out, null, 1) + "\n", "utf8");

const byCat = {};
const byAge = {};
const byFmt = {};
for (const q of questions) {
  byCat[q.categorie] = (byCat[q.categorie] ?? 0) + 1;
  byAge[q.niveau_age] = (byAge[q.niveau_age] ?? 0) + 1;
  byFmt[q.format] = (byFmt[q.format] ?? 0) + 1;
}
console.log(`Total: ${questions.length}`);
console.log("Catégories:", byCat);
console.log("Âges:", byAge);
console.log("Formats:", byFmt);
