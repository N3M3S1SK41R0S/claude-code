// Intègre des lots de questions forgées (JSON) dans data/questions.json, avec
// un contrôle qualité STRICT (schéma, sources https, cohérence âge/difficulté)
// et un DÉDOUBLONNAGE (contre la banque existante et à l'intérieur du lot).
// Chaque lot est un fichier JSON = tableau d'objets question.
// Usage : node tools/add-batch.mjs <dossier-des-lots>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
if (!dir) { console.error("Usage: node tools/add-batch.mjs <dossier>"); process.exit(1); }

const CATS = new Set([
  "Histoire", "Géographie", "Sciences & Nature", "Sport", "Pop Culture", "Insolite",
  "Général", "Littérature", "Arts", "Cinéma", "Musique", "Gastronomie", "Langue française",
  "Jeux vidéo", "Jeux de société", "Manga", "Dessin animé", "Séries",
]);
const AGES = new Set(["tout_petit", "enfant", "ado", "adulte"]);
const FORMATS = new Set(["qcm", "vrai_faux", "gambit_numerique", "equipe"]);
// Plage de difficulté cohérente par âge (borne le contenu : rien d'ardu chez les petits).
const DIFF_RANGE = { tout_petit: [1, 2], enfant: [1, 2], ado: [1, 4], adulte: [2, 5] };

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

const data = JSON.parse(readFileSync(join(root, "data", "questions.json"), "utf8"));
const seen = new Set(data.questions.map((q) => norm(q.texte)));
let maxAdd = 0;
for (const q of data.questions) { const m = /^add-(\d+)$/.exec(q.id); if (m) maxAdd = Math.max(maxAdd, +m[1]); }

const rejects = [];
const accepted = [];
const reject = (q, why) => rejects.push({ why, texte: (q && q.texte) ? String(q.texte).slice(0, 60) : "?" });

function valid(q) {
  if (!q || typeof q !== "object") return reject(q, "pas un objet"), false;
  if (!CATS.has(q.categorie)) return reject(q, `catégorie « ${q.categorie} »`), false;
  if (!AGES.has(q.niveau_age)) return reject(q, `âge « ${q.niveau_age} »`), false;
  if (!FORMATS.has(q.format)) return reject(q, `format « ${q.format} »`), false;
  if (!Number.isInteger(q.difficulte) || q.difficulte < 1 || q.difficulte > 5) return reject(q, "difficulté hors 1-5"), false;
  const [lo, hi] = DIFF_RANGE[q.niveau_age];
  if (q.difficulte < lo || q.difficulte > hi) return reject(q, `difficulté ${q.difficulte} incohérente pour ${q.niveau_age}`), false;
  if (typeof q.texte !== "string" || q.texte.trim().length < 8) return reject(q, "texte trop court"), false;
  if (typeof q.anecdote !== "string" || q.anecdote.trim().length < 20) return reject(q, "anecdote trop courte"), false;
  const src = Array.isArray(q.sources) ? q.sources.filter((u) => typeof u === "string" && u.startsWith("https://")) : [];
  if (src.length < 2) return reject(q, "moins de 2 sources https"), false;
  if (new Set(src.map(host)).size < 2) return reject(q, "sources non indépendantes (même domaine)"), false;
  if (q.format === "qcm") {
    // 2 à 4 choix (2 = utile pour les tout-petits : « miaou ou coin-coin ? »).
    if (!Array.isArray(q.choix) || q.choix.length < 2 || q.choix.length > 4) return reject(q, "qcm : 2-4 choix requis"), false;
    if (new Set(q.choix.map(norm)).size !== q.choix.length) return reject(q, "qcm : choix en double"), false;
    if (!q.choix.includes(q.bonne_reponse)) return reject(q, "qcm : bonne_reponse absente des choix"), false;
  } else if (q.format === "vrai_faux") {
    if (JSON.stringify(q.choix) !== JSON.stringify(["Vrai", "Faux"])) return reject(q, "vrai_faux : choix doivent être [Vrai, Faux]"), false;
    if (!["Vrai", "Faux"].includes(q.bonne_reponse)) return reject(q, "vrai_faux : bonne_reponse invalide"), false;
  } else if (q.format === "gambit_numerique") {
    if (typeof q.reponse_numerique !== "number" || !Number.isFinite(q.reponse_numerique)) return reject(q, "gambit : reponse_numerique invalide"), false;
  } else if (q.format === "equipe") {
    if (!Array.isArray(q.reponses_acceptees) || q.reponses_acceptees.length < 1) return reject(q, "equipe : reponses_acceptees vide"), false;
  }
  const key = norm(q.texte);
  if (key.length < 8) return reject(q, "clé de doublon trop courte"), false;
  if (seen.has(key)) return reject(q, "doublon"), false;
  seen.add(key);
  return true;
}

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
for (const f of files) {
  let arr;
  try { arr = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch (e) { console.warn(`⚠ ${f} illisible : ${e.message}`); continue; }
  if (!Array.isArray(arr)) { console.warn(`⚠ ${f} n'est pas un tableau`); continue; }
  for (const q of arr) if (valid(q)) {
    const id = `add-${String(++maxAdd).padStart(4, "0")}`;
    const entry = { id, categorie: q.categorie, niveau_age: q.niveau_age, difficulte: q.difficulte, format: q.format, texte: q.texte.trim(), anecdote: q.anecdote.trim(), sources: q.sources.filter((u) => typeof u === "string" && u.startsWith("https://")).slice(0, 3) };
    if (q.format === "qcm" || q.format === "vrai_faux") { entry.choix = q.choix; entry.bonne_reponse = q.bonne_reponse; }
    if (q.format === "gambit_numerique") entry.reponse_numerique = q.reponse_numerique;
    if (q.format === "equipe") entry.reponses_acceptees = q.reponses_acceptees;
    accepted.push(entry);
  }
}

data.questions.push(...accepted);
data.count = data.questions.length;
writeFileSync(join(root, "data", "questions.json"), JSON.stringify(data, null, 1) + "\n", "utf8");

// Rapport.
const dist = {};
for (const q of accepted) { const k = `${q.niveau_age} d${q.difficulte}`; dist[k] = (dist[k] || 0) + 1; }
console.log(`✓ Acceptées : ${accepted.length} · Rejetées : ${rejects.length} · Nouveau total : ${data.count}`);
console.log("Répartition ajoutée :", JSON.stringify(dist));
const why = {};
for (const r of rejects) why[r.why.replace(/«[^»]*»/, "«…»")] = (why[r.why.replace(/«[^»]*»/, "«…»")] || 0) + 1;
if (rejects.length) console.log("Motifs de rejet :", JSON.stringify(why));
