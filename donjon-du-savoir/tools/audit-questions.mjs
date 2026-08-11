// AUDIT DE LA BANQUE : détecte les énoncés ambigus ou mal formés, classe par
// famille, et applique (avec --corrige) les seules retouches MÉCANIQUES sans
// risque. Tout le reste part dans un rapport pour reformulation raisonnée.
// Lancer : node tools/audit-questions.mjs [--corrige] [--rapport chemin.json]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chemin = join(root, "data", "questions.json");
const banque = JSON.parse(readFileSync(chemin, "utf8"));
const corrige = process.argv.includes("--corrige");
const argRapport = process.argv.indexOf("--rapport");
const cheminRapport = argRapport > -1 ? process.argv[argRapport + 1] : join(root, "data", "audit-questions.json");

const constats = {}; // famille → [{id, texte, detail}]
const note = (famille, q, detail = "") => {
  (constats[famille] ??= []).push({ id: q.id, texte: q.texte, ...(detail ? { detail } : {}) });
};

const UNITES = /\b(m[èe]tres?|kilom[èe]tres?|km|centim[èe]tres?|cm|millim[èe]tres?|euros?|dollars?|francs?|kilos?|kilogrammes?|grammes?|tonnes?|litres?|centilitres?|degr[ée]s?|celsius|secondes?|minutes?|heures?|jours?|semaines?|mois|ans|ann[ée]es?|habitants?|km\/h|m²|km²|kilom[èe]tres? carr[ée]s|pour cent|%)\b/i;
const MESURES = /\b(hauteur|longueur|largeur|profondeur|superficie|altitude|vitesse|poids|masse|temp[ée]rature|distance|dur[ée]e|diam[èe]tre|circonf[ée]rence|envergure)\b/i;
const SUPERLATIF = /\b(le plus grand|la plus grande|le plus petit|la plus petite|le plus gros|la plus grosse)\b/i;
const CIBLE_AMBIGUE = /\b(pays|ville|océan|oc[ée]an|continent|[îi]le|d[ée]sert|lac|for[êe]t)\b/i;
// Un superlatif est LIMPIDE quand le critère ou le périmètre est déjà dans
// l'énoncé (chaud/froid, superficie, « nombre de », outre-mer, entièrement…) —
// et « plus grand océan/continent » est une convention sans double lecture.
const CRITERE = /\b(superficie|surface|population|habitants|[ée]tendue|volume|nombre de|chauds?|froids?|tous types confondus|outre-mer|entièrement|oc[ée]an|continent)\b/i;

// Cas examinés UN PAR UN lors d'une revue et jugés volontaires (démythage
// affirmé, texte à trou pour tout-petits, réponse inhérente au sujet type
// « Uno »/« Chaperon rouge ») : l'audit ne les re-signale plus.
const VALIDES_EN_REVUE = new Set([
  "insolite-025", "insolite-028", "sciences-036", "tp-097", "add-0406",
  "add-2053", "add-2096", "add-2377", "add-2559", // démythages vrai/faux relus
  "ext-0418", "add-0088", "add-0097", "add-0672", "add-1439", "add-2007", "add-2440", // réponse inhérente, niveaux jeunes
  "add-1033", "add-1104", "add-1318", "add-2493", // périphrases déjà limpides (Annecy, Caspienne)
  // Compter les cochons des « Trois Petits Cochons » : la réponse est dans le
  // titre, et c'est VOULU à 2-5 ans — l'enfant reconnaît son conte et compte
  // jusqu'à trois. Même famille que les cas Uno / Chaperon rouge ci-dessus :
  // à cet âge, la question sert la participation, pas la difficulté.
  "v6a-138",
]);

let retouches = 0;
for (const q of banque.questions) {
  if (VALIDES_EN_REVUE.has(q.id)) continue;
  const t = q.texte.trim();
  const aTrou = /(\.\.\.|…)\s*$/.test(t); // texte à trou volontaire (tout-petits)
  const num = q.reponse_numerique !== undefined ? Number(q.reponse_numerique) : null;
  const ressembleAnnee = num !== null && Number.isInteger(num) && num >= 500 && num <= 2100;

  // ── Intégrité (toujours bloquant, jamais ambigu) ─────────────────────────
  if (q.format === "qcm" || q.format === "vrai_faux") {
    if (!Array.isArray(q.choix) || !q.choix.includes(q.bonne_reponse)) note("integrite_bonne_reponse_hors_choix", q);
    else if (new Set(q.choix.map((c) => String(c).toLowerCase())).size !== q.choix.length) note("integrite_choix_doublons", q);
  }

  // ── Retouches mécaniques sûres (appliquées avec --corrige) ───────────────
  // 1. Une vraie question (hors vrai/faux et hors texte à trou) finit par « ? ».
  if (q.format !== "vrai_faux" && !aTrou && !/[?]\s*»?\s*$/.test(t)
    && /^(qui|que|quel|quelle|quels|quelles|comment|combien|pourquoi|o[ùu]|quand|en quelle)/i.test(t)) {
    note("forme_sans_point_interrogation", q);
    if (corrige) { q.texte = t.replace(/[.\s]*$/, "") + " ?"; retouches++; }
  }
  // 2. « Quand … ? » avec réponse-année → « En quelle année … ? » (zéro flou).
  if (/^Quand\b/.test(t) && ressembleAnnee) {
    note("forme_quand_vers_annee", q);
    if (corrige) { q.texte = t.replace(/^Quand\b/, "En quelle année"); retouches++; }
  }

  // ── Familles à reformulation RAISONNÉE (rapport seulement) ───────────────
  // 3. Réponse numérique qui ressemble à une année, sans « année » dans
  //    l'énoncé — sauf si une unité ou une année de contexte cadre déjà tout.
  if (ressembleAnnee && !/ann[ée]e/i.test(t) && !UNITES.test(t) && !/\ben (1[0-9]|20)\d{2}\b/.test(t)) {
    note("annee_sans_formule", q, `réponse ${num}`);
  }
  // 4. Grandeur mesurable sans unité explicite dans l'énoncé.
  if (num !== null && MESURES.test(t) && !UNITES.test(t)) note("mesure_sans_unite", q, `réponse ${num}`);
  // 5. « Combien … » sans « de/d' » nulle part et sans unité (« Combien mesure… »).
  if (num !== null && /^Combien\b/i.test(t) && !/\bde\b|\bd'/i.test(t) && !UNITES.test(t)) note("combien_sans_unite", q, `réponse ${num}`);
  // 6. Superlatif de taille sur une cible ambiguë sans critère (superficie ? population ?).
  if (SUPERLATIF.test(t) && CIBLE_AMBIGUE.test(t) && !CRITERE.test(t)) note("superlatif_sans_critere", q);
  // 7. Vrai/Faux avec négation : « Vrai ou faux : X n'est pas… » fait douter tout le monde.
  if (q.format === "vrai_faux" && /\b(ne\s+\w+\s+(pas|jamais|plus)|n'(est|a|ont|existe)\s+(pas|jamais|plus))\b/i.test(t)) note("vrai_faux_negation", q);
  // 8. QCM qui contient sa propre réponse dans l'énoncé (cadeau involontaire).
  if (q.format === "qcm" && typeof q.bonne_reponse === "string" && q.bonne_reponse.length > 3) {
    const rep = q.bonne_reponse.toLowerCase().replace(/\s*\(.*\)\s*/, "").trim();
    if (rep && t.toLowerCase().includes(rep)) note("reponse_dans_enonce", q, `réponse « ${q.bonne_reponse} »`);
  }
}

// ── Sorties ────────────────────────────────────────────────────────────────
const familles = Object.entries(constats).sort((a, b) => b[1].length - a[1].length);
console.log(`AUDIT — ${banque.questions.length} questions examinées`);
for (const [f, liste] of familles) console.log(`  ${String(liste.length).padStart(4)}  ${f}`);
if (!familles.length) console.log("  aucune anomalie détectée");
writeFileSync(cheminRapport, JSON.stringify(Object.fromEntries(familles), null, 1) + "\n");
console.log(`rapport → ${cheminRapport}`);
if (corrige) {
  writeFileSync(chemin, JSON.stringify(banque, null, 1) + "\n");
  console.log(`✓ ${retouches} retouche(s) mécanique(s) écrite(s) dans data/questions.json`);
}
