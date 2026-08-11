// Inventaire des répliques FIXES à faire enregistrer (IA de voix tierce) :
// - data/repliques-inventaire.json : machine (perso, id, fichier, texte)
// - docs/REPLIQUES-A-ENREGISTRER.md : script de studio lisible, par personnage
// Les répliques interpolées (contenant { ou ${) restent en synthèse : exclues.
// Lancer : node tools/export-repliques.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { annoncePrix, HERALD_POOLS } from "../js/herald.js";
import { HOST_CUES } from "../js/host-voice.js";
import { HERO_LINES } from "../js/voices.js";
import { BONUS_STAR_POOL, CHARACTERS } from "../js/state.js";
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

// ---- Les annonces de prix de la Cérémonie (7 phrases déterministes) ----
// Générées avec le MÊME gabarit que le jeu (annoncePrix) : l'identifiant de
// clip correspond exactement à ce que la cérémonie dira en partie.
for (const prix of BONUS_STAR_POOL) ajoute("heraut", annoncePrix(prix), "ceremonie.prix");

// ---- Les accroches de l'animateur (avant question/anecdote, verdicts) ----
// Elles vivent aujourd'hui en petits clips WebM de synthèse : les versions
// jouées par la vraie voix du Héraut les remplaceront.
for (const [kind, cues] of Object.entries(HOST_CUES)) {
  for (const cue of cues) ajoute("heraut", cue.text, `accroche.${kind}`);
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

// Direction d'acteur par contexte : l'INTENTION à jouer, réplique par réplique.
const INTENTIONS = {
  ouverture: "Grandiose, lever de rideau — il ouvre le tournoi du siècle",
  debutTour: "Vif et complice — il relance le rythme de la table",
  bonneReponse: "Éclatant — il célèbre le joueur, sourire dans la voix",
  mauvaiseReponse: "Consolant et taquin — jamais moqueur",
  anecdoteIntro: "Confidence — il ménage son petit effet",
  victoire: "Triomphal, feux d'artifice dans la voix",
  docTrouNoir: "[whispers] Chuchoté, façon documentaire animalier",
  dePetit: "Compatissant, amusé du sort",
  deTriple: "Stupéfait, admiratif",
  sponsors: "Ton publicité radio rétro, second degré assumé",
  pouvoirUtilise: "Emphase héroïque, roulement de tambour verbal",
  "caseComment.trounoir": "[whispers] Faussement inquiet, suspense",
  "caseComment.malus": "Fataliste et drôle",
  "caseComment.chance": "Gourmand, ravi pour le joueur",
  "caseComment.teleporteur": "Émerveillé, un rien vertigineux",
  "caseComment.carrefour": "Curieux, met la pression gentiment",
  recitRegles: "Conteur au coin du feu — il ouvre et referme le livre des règles",
  toasts: "Crieur public solennel puis chute complice — il désigne qui commence",
  retournements: "Cataclysme théâtral — le plateau pivote, stupeur ravie",
  ceremonie: "Maître de cérémonie des grands soirs — paillettes dans la voix",
  "ceremonie.prix": "Annonce de prix, suspense montant — il fait durer le plaisir",
  "accroche.question": "Roulement de tambour verbal — il lance la question",
  "accroche.anecdote": "Confidence gourmande — il déballe le petit trésor",
  "accroche.bonne": "Éclatant, trompette dans la voix",
  "accroche.mauvaise": "Consolant et taquin — jamais moqueur",
  tour: "Le héros s'élance — dans son caractère, énergie de départ",
  bonne: "Le héros jubile — joie dans SON style",
  mauvaise: "Le héros encaisse — dépit drôle, jamais abattu",
  pouvoir: "Le héros dégaine son pouvoir — fierté signature",
};
const intentionDe = (contexte) => INTENTIONS[contexte]
  ?? (contexte.startsWith("caseComment.") ? "Annonce de case, malicieux" : "Dans le caractère du personnage");

let md = `# RÉPLIQUES À ENREGISTRER — Le Donjon du Savoir
*(générées par tools/export-repliques.mjs — ${entrees.length} répliques ;
chaque fichier doit porter EXACTEMENT le nom indiqué : l'intégration est
automatique, un écart = clip ignoré sans casser le jeu)*

Format : MP3, 44,1 kHz, MONO, ~64 kbps, niveau -16 LUFS, sans musique ni
bruit de fond, silences < 150 ms en début et fin de fichier.

`;
for (const [perso, lignes] of parPerso) {
  md += `\n## ${nomDe(perso)} — dossier \`voix/${perso}/\` (${lignes.length} répliques)\n\n`;
  md += `| Fichier | Intention (jeu d'acteur) | Réplique à jouer |\n|---|---|---|\n`;
  for (const e of lignes) md += `| \`${e.id}.mp3\` | ${intentionDe(e.contexte)} | ${e.texte.replace(/\|/g, "—")} |\n`;
}
writeFileSync(join(root, "docs", "REPLIQUES-A-ENREGISTRER.md"), md);

console.log(`✓ ${entrees.length} répliques (${[...parPerso.keys()].length} personnages) → inventaire JSON + script MD`);
for (const [perso, lignes] of parPerso) console.log(`  ${perso}: ${lignes.length}`);
