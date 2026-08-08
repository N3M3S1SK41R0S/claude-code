// GÉNÉRATION DES VOIX PNJ (mini-lot 4) — à lancer SUR L'APPAREIL DE PIERRE :
//
//   ELEVENLABS_API_KEY=sk_… node tools/genere-voix-pnj.mjs
//
// La clé ne se colle QUE dans la variable d'environnement : elle ne s'écrit
// jamais dans un fichier, jamais dans le dépôt, jamais dans le jeu partagé.
//
// Le script fait TOUT le travail d'intégration qui rendait la livraison en
// ZIP fragile : pour chaque réplique, il appelle l'API, nomme le fichier par
// l'empreinte EXACTE de son texte (la même fonction que le jeu, importée —
// aucun identifiant recopié à la main), range le MP3 dans voix/<perso>/,
// inscrit le clip dans data/voix-manifest.json et complète la liste du
// service worker. Il est REJOUABLE : un clip déjà présent est sauté
// (--force pour le refaire), donc on peut générer en plusieurs fois.
//
// Le CASTING (quelle voix ElevenLabs pour quel PNJ) vit dans
// data/voix-pnj-casting.json — quinze voix DISTINCTES, choisies dans la
// bibliothèque du compte. C'est le seul fichier à remplir avant de lancer.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { idReplique } from "../js/voiceclips.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLE = process.env.ELEVENLABS_API_KEY;
const FORCE = process.argv.includes("--force");
if (!CLE) {
  console.error("Clé absente. Lancer :  ELEVENLABS_API_KEY=sk_…  node tools/genere-voix-pnj.mjs");
  console.error("(la clé ne s'écrit nulle part — elle ne vit que le temps de la commande)");
  process.exit(2);
}

// ── Les répliques — copie conforme de js/game.js (NPCS) et des annonces ──────
// game.js reste la source de vérité : si une réplique y change, la régénérer
// ici avec le texte à jour (l'empreinte changera d'elle-même).
const REPLIQUES = [
  { perso: "merlinouche", texte: "« Aaah, un aventurier ! J'ai encore raté ma potion… réponds juste et je te change un caillou en or ! »" },
  { perso: "biscornu", texte: "« Grrr… enfin, miaou. Réponds à mon énigme et je te souffle un p'tit trésor (pas de feu, promis). »" },
  { perso: "hibou-passage", texte: "« Hou hou ! Une petite colle pour un esprit bien affûté ? »" },
  { perso: "barnabe", texte: "« Approchez, approchez ! Une devinette, un cadeau ! »" },
  { perso: "roquefort", texte: "« Psst ! Un raccourci sous les racines, ça t'dit ? Suis-moi ! »" },
  { perso: "fee-bricole", texte: "« Tiens, un petit sort de chance — je l'avais en double ! »" },
  { perso: "boubou", texte: "« Bouh… oh pardon, j'voulais pas faire peur. Tiens, un bonbon-pièce. »" },
  { perso: "gerard", texte: "« Auriez-vous deux pièces pour un os de rechange ? Merci infiniment, très aimable. »" },
  { perso: "turbo", texte: "« Suis-moi, je connais un raccourci ! …enfin, dès que j'y arrive. »" },
  { perso: "groumf", texte: "« Moi Groumf. Moi pas manger toi si toi réponds bien. Marché ? »" },
  { perso: "ratichon", texte: "« J'ai arrêté de voler ! Enfin… presque. Une devinette et je te rends ton or ! »" },
  { perso: "sylvette", texte: "« Une énigme des bois, voyageur ? La forêt récompense les curieux. »" },
  { perso: "coassin", texte: "« Coa ! Un bisou ? Non ? Tant pis, tiens quand même une piécette. »" },
  { perso: "piquot", texte: "« Poussez-vous, poussez-vous ! Oh, pardon — filez donc devant moi. »" },
  { perso: "zebulon", texte: "« Ton vœu est exaucé ! …c'était quoi déjà ? Bon, tiens de l'or. »" },
  // Annonces fixes des nouveaux mini-jeux : MÊME voix que le Héraut actuel.
  { perso: "heraut", texte: "Devinette en CASCADE ! Plus vous trouvez tôt, plus vous avancez. Premier indice…" },
  { perso: "heraut", texte: "Mini-jeu : l'Anagramme ! Ces lettres cachent la réponse — remettez-les dans l'ordre." },
  { perso: "heraut", texte: "Mini-jeu : le Pendu ! Devinez les lettres pour reconstituer la réponse." },
  { perso: "heraut", texte: "🔊 LE SON MYSTÈRE ! Tendez l'oreille — et réécoutez autant de fois que vous voulez." },
  { perso: "heraut", texte: "🔄 Question incomprise ? Le Héraut en tire une autre, sans pénalité." },
  { perso: "heraut", texte: "🔄 Ce bruitage ne dit rien à personne ? Le Donjon en fabrique un autre, sans pénalité." },
];

// ── Le casting : perso → voix ElevenLabs, rempli à la main (ou par Comet) ────
const cheminCasting = join(root, "data", "voix-pnj-casting.json");
if (!existsSync(cheminCasting)) {
  console.error(`Casting absent : ${cheminCasting}`);
  console.error("Le remplir d'abord (un voice_id ElevenLabs par perso, quinze voix DISTINCTES).");
  process.exit(2);
}
const casting = JSON.parse(readFileSync(cheminCasting, "utf8"));
const manquants = [...new Set(REPLIQUES.map((r) => r.perso))].filter((p) => !casting[p]?.voice_id);
if (manquants.length) {
  console.error("Casting incomplet — voice_id manquant pour : " + manquants.join(", "));
  process.exit(2);
}
const doublons = Object.entries(
  Object.entries(casting).reduce((m, [p, v]) => { (m[v.voice_id] ??= []).push(p); return m; }, {}),
).filter(([, persos]) => persos.length > 1);
if (doublons.length) {
  console.error("⚠️ Deux personnages partagent une voix — la règle exige des timbres distincts :");
  for (const [vid, persos] of doublons) console.error(`   ${vid} → ${persos.join(", ")}`);
  if (!process.argv.includes("--accepter-doublons")) process.exit(2);
}

// ── Génération, une réplique à la fois (l'API n'aime pas la bousculade) ──────
const manifest = JSON.parse(readFileSync(join(root, "data", "voix-manifest.json"), "utf8"));
let faits = 0, sautes = 0, echecs = 0;
for (const { perso, texte } of REPLIQUES) {
  const id = idReplique(texte);
  const relatif = `voix/${perso}/${id}.mp3`;
  const chemin = join(root, relatif);
  if (existsSync(chemin) && !FORCE) { sautes += 1; continue; }
  mkdirSync(dirname(chemin), { recursive: true });
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${casting[perso].voice_id}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": CLE, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texte,
        model_id: "eleven_multilingual_v2",
        // Mêmes réglages que la lecture en direct du jeu : la voix d'un PNJ en
        // clip et la voix du Héraut en direct doivent respirer pareil.
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45 },
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
    writeFileSync(chemin, Buffer.from(await r.arrayBuffer()));
    (manifest[perso] ??= {})[id] = relatif;
    faits += 1;
    console.log(`✓ ${perso.padEnd(14)} ${relatif}`);
    await new Promise((res) => setTimeout(res, 400)); // politesse envers l'API
  } catch (e) {
    echecs += 1;
    console.error(`✗ ${perso.padEnd(14)} ${e.message}`);
  }
}

// ── Intégration : manifeste + liste du service worker ────────────────────────
writeFileSync(join(root, "data", "voix-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
const cheminSw = join(root, "sw.js");
let sw = readFileSync(cheminSw, "utf8");
let ajoutsSw = 0;
for (const clips of Object.values(manifest)) {
  for (const rel of Object.values(clips)) {
    const ligne = `  "./${rel}",`;
    if (!sw.includes(ligne)) { sw = sw.replace('  "./data/voix-manifest.json",', `  "./data/voix-manifest.json",\n${ligne}`); ajoutsSw += 1; }
  }
}
if (ajoutsSw) writeFileSync(cheminSw, sw);

console.log(`\n${faits} clip(s) générés, ${sautes} déjà présents, ${echecs} échec(s).`);
console.log(`Manifeste à jour ; ${ajoutsSw} entrée(s) ajoutée(s) au service worker.`);
console.log("Dernières étapes : monter la VERSION du sw.js, puis  node tools/build-standalone.mjs");
if (echecs) process.exit(1);
