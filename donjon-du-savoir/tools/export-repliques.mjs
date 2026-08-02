// Inventaire des répliques FIXES à faire enregistrer (IA de voix tierce) :
// - data/repliques-inventaire.json : machine (perso, id, fichier, texte)
// - docs/REPLIQUES-A-ENREGISTRER.md : script de studio lisible, par personnage
// Les répliques interpolées (contenant { ou ${) restent en synthèse : exclues.
// Lancer : node tools/export-repliques.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HERALD_POOLS } from "../js/herald.js";
import { HERO_LINES } from "../js/voices.js";
import { CHARACTERS } from "../js/state.js";
import { idReplique } from "../js/voiceclips.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entrees = [];

function ajoute(perso, texte, contexte) {
  if (typeof texte !== "string" || !texte.trim()) return;
  if (texte.includes("{")) return; // interpolée : reste en synthèse
  const id = idReplique(texte);
  if (entrees.some((e) => e.perso === perso && e.id === id)) return;
  entrees.push({ perso, id, fichier: `voix/${perso}/${id}.mp3`, contexte, texte });
}

// ---- Le Héraut (priorité absolue) ----
for (const [nomPool, pool] of Object.entries(HERALD_POOLS)) {
  if (Array.isArray(pool)) {
    for (const ligne of pool) ajoute("heraut", ligne, nomPool);
  } else {
    for (const [type, lignes] of Object.entries(pool)) {
      for (const ligne of lignes) ajoute("heraut", ligne, `${nomPool}.${type}`);
    }
  }
}

// ---- Les héros (une voix chacun) ----
for (const [heros, moments] of Object.entries(HERO_LINES)) {
  for (const [moment, lignes] of Object.entries(moments)) {
    for (const ligne of [].concat(lignes)) ajoute(heros, ligne, moment);
  }
}

// ---- Sorties ----
writeFileSync(join(root, "data", "repliques-inventaire.json"), JSON.stringify(entrees, null, 1) + "\n");

const parPerso = new Map();
for (const e of entrees) {
  if (!parPerso.has(e.perso)) parPerso.set(e.perso, []);
  parPerso.get(e.perso).push(e);
}
const nomDe = (id) => id === "heraut"
  ? "LE GRAND HÉRAUT (narrateur)"
  : (CHARACTERS.find((c) => c.id === id)?.nom ?? id);

let md = `# RÉPLIQUES À ENREGISTRER — Le Donjon du Savoir
*(générées par tools/export-repliques.mjs — ${entrees.length} répliques ;
chaque fichier doit porter EXACTEMENT le nom indiqué : l'intégration est
automatique, un écart = clip ignoré sans casser le jeu)*

Format : MP3, 44,1 kHz, MONO, ~64 kbps, niveau -16 LUFS, sans musique ni
bruit de fond, silences < 150 ms en début et fin de fichier.

`;
for (const [perso, lignes] of parPerso) {
  md += `\n## ${nomDe(perso)} — dossier \`voix/${perso}/\` (${lignes.length} répliques)\n\n`;
  md += `| Fichier | Réplique à jouer |\n|---|---|\n`;
  for (const e of lignes) md += `| \`${e.id}.mp3\` | ${e.texte.replace(/\|/g, "—")} |\n`;
}
writeFileSync(join(root, "docs", "REPLIQUES-A-ENREGISTRER.md"), md);

console.log(`✓ ${entrees.length} répliques (${[...parPerso.keys()].length} personnages) → inventaire JSON + script MD`);
for (const [perso, lignes] of parPerso) console.log(`  ${perso}: ${lignes.length}`);
