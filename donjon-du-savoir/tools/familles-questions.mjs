// FAMILLES DE QUASI-DOUBLONS : « Qui a peint la Joconde ? » existe en huit
// variantes — cet outil les regroupe et écrit un champ `famille` dans
// data/questions.json. Le tirage (data.js) écarte alors TOUTE la famille dès
// qu'un de ses membres a été posé dans la partie : fini l'impression de
// retomber sans cesse sur la même question sous un habit différent.
//
// Règles de regroupement (volontairement STRICTES — mieux vaut rater une
// famille que marier deux questions différentes) : même RÉPONSE normalisée
// ET similarité de Jaccard ≥ 0,45 entre leurs mots-clés (mots outils et
// tournures de quiz exclus). Relancer : node tools/familles-questions.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chemin = join(root, "data", "questions.json");
const banque = JSON.parse(readFileSync(chemin, "utf8"));

const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// Mots outils + vocabulaire générique de quiz : ils ne disent RIEN du sujet.
const STOP = new Set(`le la les un une des de du au aux et ou a l d en dans sur pour par avec sans que qui quoi dont quel quelle quels quelles est sont etait fut ont avait combien comment pourquoi ou quand tres plus moins celebre celebres connu connue grand grande petit petite monde terre france francais francaise pays ville nom nombre annee siecle premier premiere dernier derniere possede compte existe appelle designe trouve situe joue jouee film roman serie histoire question reponse classique standard officiel officielle veritable vrai vraie faux fausse`.split(" "));
const motscles = (q) => new Set(norm(q.texte).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.max(1, a.size + b.size - inter);
};

// Regroupe par réponse d'abord (une famille partage TOUJOURS sa réponse).
const parReponse = new Map();
for (const q of banque.questions) {
  delete q.famille; // recalcul intégral : les grappes d'hier ne collent pas
  const rep = q.bonne_reponse ?? q.reponse_numerique;
  if (rep === undefined || /^(vrai|faux)$/i.test(String(rep))) continue;
  const cle = norm(rep);
  if (!cle) continue;
  if (!parReponse.has(cle)) parReponse.set(cle, []);
  parReponse.get(cle).push(q);
}

let nFamilles = 0, nMembres = 0;
const exemples = [];
for (const groupe of parReponse.values()) {
  if (groupe.length < 2) continue;
  const cles = groupe.map(motscles);
  const dejaPris = new Set();
  for (let i = 0; i < groupe.length; i++) {
    if (dejaPris.has(i)) continue;
    const membres = [i];
    for (let j = i + 1; j < groupe.length; j++) {
      if (dejaPris.has(j)) continue;
      // Rattaché si proche d'AU MOINS UN membre déjà retenu (chaînage).
      if (membres.some((k) => jaccard(cles[k], cles[j]) >= 0.45)) {
        membres.push(j); dejaPris.add(j);
      }
    }
    if (membres.length < 2) continue;
    nFamilles += 1;
    const nom = `fam-${String(nFamilles).padStart(3, "0")}`;
    for (const k of membres) { groupe[k].famille = nom; nMembres += 1; }
    if (exemples.length < 8) exemples.push(`${nom} ×${membres.length} : ${groupe[membres[0]].texte.slice(0, 60)}`);
  }
}

writeFileSync(chemin, JSON.stringify(banque, null, 1) + "\n");
console.log(`✓ ${nFamilles} familles, ${nMembres} questions marquées (sur ${banque.questions.length})`);
for (const e of exemples) console.log("  " + e);
