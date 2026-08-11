// BILAN DE LA BANQUE : la carte des questions par thème, par âge et par
// format, avec les cases trop maigres signalées. C'est ce tableau qui dit où
// forger la prochaine fois — un total global ne le dit jamais.
//
//   node tools/bilan-banque.mjs                 → la banque
//   node tools/bilan-banque.mjs --seuil 30      → autre seuil de « trop maigre »
//   node tools/bilan-banque.mjs --json fichier  → écrit le bilan en JSON
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (nom, defaut) => { const i = process.argv.indexOf(nom); return i > -1 ? process.argv[i + 1] : defaut; };
const SEUIL = Number(arg("--seuil", 25));
const sortieJson = arg("--json", null);

const banque = JSON.parse(readFileSync(join(root, "data", "questions.json"), "utf8"));
const questions = banque.questions;
const AGES = ["tout_petit", "enfant", "ado", "adulte"];
const FORMATS = ["qcm", "vrai_faux", "gambit_numerique", "equipe", "cash_carre_duo"];
const cats = [...new Set(questions.map((q) => q.categorie))].sort((a, b) => a.localeCompare(b, "fr"));

const parCatAge = {}, parFormatAge = {};
for (const c of cats) { parCatAge[c] = Object.fromEntries(AGES.map((a) => [a, 0])); }
for (const f of FORMATS) { parFormatAge[f] = Object.fromEntries(AGES.map((a) => [a, 0])); }
for (const q of questions) {
  if (parCatAge[q.categorie] && q.niveau_age in parCatAge[q.categorie]) parCatAge[q.categorie][q.niveau_age] += 1;
  if (parFormatAge[q.format] && q.niveau_age in parFormatAge[q.format]) parFormatAge[q.format][q.niveau_age] += 1;
}

const ligne = (nom, valeurs, total) =>
  nom.padEnd(20) + valeurs.map((v) => String(v).padStart(11)).join("") + String(total).padStart(9);

console.log(`BANQUE : ${questions.length} questions\n`);
console.log("THÈME".padEnd(20) + AGES.map((a) => a.padStart(11)).join("") + "TOTAL".padStart(9));
const maigres = [];
for (const c of cats) {
  const v = AGES.map((a) => parCatAge[c][a]);
  console.log(ligne(c, v, v.reduce((s, x) => s + x, 0)));
  AGES.forEach((a, i) => { if (v[i] < SEUIL) maigres.push({ categorie: c, age: a, n: v[i] }); });
}
console.log("\nFORMAT".padEnd(20) + AGES.map((a) => a.padStart(11)).join("") + "TOTAL".padStart(9));
for (const f of FORMATS) {
  const v = AGES.map((a) => parFormatAge[f][a]);
  if (v.every((x) => x === 0)) continue;
  console.log(ligne(f, v, v.reduce((s, x) => s + x, 0)));
}

// ÉQUILIBRE DES VRAI/FAUX : si « Vrai » est presque toujours la bonne
// réponse, répondre « Vrai » les yeux fermés devient une stratégie gagnante
// et le format ne teste plus rien. Défaut invisible à la relecture — une
// vague entière est arrivée à 87 % de « Vrai » sans que rien ne le signale —
// donc mesuré ici à demeure.
const vf = questions.filter((q) => q.format === "vrai_faux");
if (vf.length) {
  const vrais = vf.filter((q) => q.bonne_reponse === "Vrai").length;
  const part = Math.round((vrais / vf.length) * 100);
  const verdict = part >= 40 && part <= 60 ? "✓" : part >= 30 && part <= 70 ? "≈" : "⚠️";
  console.log(`\n${verdict} vrai/faux : ${vrais} « Vrai » contre ${vf.length - vrais} « Faux » (${part} % de Vrai — l'équilibre visé est 50 %)`);
  if (part > 70 || part < 30) console.log("   Répondre toujours pareil suffirait à gagner : à rééquilibrer.");
}

if (maigres.length) {
  console.log(`\n${maigres.length} case(s) sous ${SEUIL} questions :`);
  for (const m of maigres.sort((a, b) => a.n - b.n)) console.log(`  ${String(m.n).padStart(4)}  ${m.categorie} / ${m.age}`);
} else {
  console.log(`\n✓ aucune case sous ${SEUIL} questions : chaque thème sait parler à chaque âge.`);
}

if (sortieJson) {
  writeFileSync(join(root, sortieJson), JSON.stringify({ total: questions.length, parCatAge, parFormatAge, maigres }, null, 1) + "\n");
  console.log(`\n→ ${sortieJson}`);
}
