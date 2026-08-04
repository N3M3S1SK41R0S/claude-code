// INSERTION CONTRÔLÉE de nouvelles questions : chaque candidate est confrontée
// à TOUTE la banque avant d'entrer — même réponse + mots-clés proches = rejet.
// C'est le garde-fou qui empêche de recréer les quasi-doublons qu'on vient
// d'éradiquer (familles). Rejets listés, rien n'est écrit s'il en reste.
// Usage : node tools/inserer-questions.mjs <fichier.json> [--prefixe v3] [--force]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chemin = join(root, "data", "questions.json");
const fichier = process.argv[2];
if (!fichier) { console.error("usage : node tools/inserer-questions.mjs <fichier.json> [--prefixe v3]"); process.exit(2); }
const iPref = process.argv.indexOf("--prefixe");
const prefixe = iPref > -1 ? process.argv[iPref + 1] : "v3";
const force = process.argv.includes("--force");

const banque = JSON.parse(readFileSync(chemin, "utf8"));
const candidates = JSON.parse(readFileSync(fichier, "utf8"));

const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(`le la les un une des de du au aux et ou a l d en dans sur pour par avec sans que qui quoi dont quel quelle quels quelles est sont etait fut ont avait combien comment pourquoi ou quand tres plus moins celebre celebres connu connue grand grande petit petite monde terre france francais francaise pays ville nom nombre annee siecle premier premiere dernier derniere possede compte existe appelle designe trouve situe joue jouee film roman serie histoire question reponse classique standard officiel officielle veritable vrai vraie faux fausse`.split(" "));
const motscles = (q) => new Set(norm(q.texte).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => { let i = 0; for (const w of a) if (b.has(w)) i++; return i / Math.max(1, a.size + b.size - i); };
const repDe = (q) => norm(q.bonne_reponse ?? q.reponse_numerique ?? "");

// Champs obligatoires : une question mal formée casserait le jeu en silence.
const OBLIGATOIRES = ["categorie", "niveau_age", "difficulte", "format", "texte", "anecdote", "sources"];
const AGES = ["tout_petit", "enfant", "ado", "adulte"];
const CATEGORIES = new Set(banque.questions.map((q) => q.categorie));

const clesBanque = banque.questions.map((q) => ({ q, mots: motscles(q), rep: repDe(q) }));
const retenues = [];
const rejets = [];
for (const c of candidates) {
  const manque = OBLIGATOIRES.filter((k) => c[k] === undefined);
  if (manque.length) { rejets.push([c.texte, `champs manquants : ${manque.join(", ")}`]); continue; }
  if (!AGES.includes(c.niveau_age)) { rejets.push([c.texte, `âge inconnu : ${c.niveau_age}`]); continue; }
  if (!CATEGORIES.has(c.categorie)) { rejets.push([c.texte, `catégorie inconnue : ${c.categorie}`]); continue; }
  if ((c.format === "qcm" || c.format === "vrai_faux") && !(c.choix ?? []).includes(c.bonne_reponse)) {
    rejets.push([c.texte, "la bonne réponse n'est pas dans les choix"]); continue;
  }
  // Anti-doublon : même réponse ET mots-clés proches (seuil plus SÉVÈRE qu'en
  // regroupement — à l'entrée, on préfère refuser une bonne question que
  // laisser passer une redite).
  const mots = motscles(c), rep = repDe(c);
  const jumelle = clesBanque.find((b) => b.rep && b.rep === rep && jaccard(b.mots, mots) >= 0.34);
  if (jumelle) { rejets.push([c.texte, `quasi-doublon de ${jumelle.q.id} — « ${jumelle.q.texte.slice(0, 60)} »`]); continue; }
  retenues.push(c);
  clesBanque.push({ q: c, mots, rep }); // les candidates se comparent aussi entre elles
}

console.log(`${retenues.length} retenue(s), ${rejets.length} rejet(s) sur ${candidates.length} candidate(s)`);
for (const [t, raison] of rejets) console.log(`  ✗ « ${String(t).slice(0, 55)} » — ${raison}`);
if (rejets.length && !force) { console.log("\nRien n'a été écrit (--force pour insérer quand même les retenues)."); process.exit(1); }

let n = 0;
const existants = new Set(banque.questions.map((q) => q.id));
for (const c of retenues) {
  do { n += 1; c.id = `${prefixe}-${String(n).padStart(3, "0")}`; } while (existants.has(c.id));
  existants.add(c.id);
  banque.questions.push(c);
}
banque.count = banque.questions.length;
writeFileSync(chemin, JSON.stringify(banque, null, 1) + "\n");
console.log(`✓ banque : ${banque.questions.length} questions (+${retenues.length})`);
