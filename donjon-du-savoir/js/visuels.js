// VISUELS DESSINÉS PAR CODE (SVG) — drapeaux, ombres chinoises de monuments,
// rébus d'émojis. Aucune image : quelques primitives paramétrées suffisent à
// produire des dizaines de drapeaux nets à toute taille, pour un poids
// dérisoire. C'est ce qui permet aux questions visuelles d'exister AUSSI dans
// la version web partageable, dont le budget est presque saturé.
//
// Aucun visuel n'imite une œuvre protégée : un drapeau est un emblème public,
// une ombre chinoise de monument est un tracé original fait maison, et les
// cartes viennent de Natural Earth, qui est dans le domaine public.
import { CARTES } from "./cartes.js";
import { cielSvg, CIELS } from "./constellations.js";

/* ---------- palette héraldique commune ---------- */

const C = {
  rouge: "#d72b34", rougeSombre: "#b02128", bleu: "#1f4fa3", bleuClair: "#3d9be9",
  bleuNuit: "#12315e", vert: "#177a48", vertClair: "#3aa76d", jaune: "#f2c230",
  or: "#e0b04a", blanc: "#f6f2e8", noir: "#1a1520", orange: "#e8802a",
};

const svg = (contenu, ratio = "0 0 90 60") =>
  `<svg viewBox="${ratio}" xmlns="http://www.w3.org/2000/svg" role="img" class="visuel-svg">${contenu}</svg>`;

/* ---------- primitives de drapeaux ---------- */

/** Bandes verticales de largeur égale (France, Italie, Belgique…). */
const vertical = (...couleurs) => svg(couleurs.map((c, i) =>
  `<rect x="${(90 / couleurs.length) * i}" y="0" width="${90 / couleurs.length}" height="60" fill="${c}"/>`).join(""));

/** Bandes horizontales de largeur égale (Allemagne, Pays-Bas, Pologne…). */
const horizontal = (...couleurs) => svg(couleurs.map((c, i) =>
  `<rect x="0" y="${(60 / couleurs.length) * i}" width="90" height="${60 / couleurs.length}" fill="${c}"/>`).join(""));

/** Croix scandinave décentrée (Suède, Danemark, Norvège, Finlande, Islande).
 *  `liseres` dessine la croix bordée des drapeaux norvégien et islandais. */
const croixNordique = (fond, croix, liseres = null) => svg(`
  <rect width="90" height="60" fill="${fond}"/>
  ${liseres ? `<rect x="26" y="0" width="18" height="60" fill="${liseres}"/><rect x="0" y="21" width="90" height="18" fill="${liseres}"/>` : ""}
  <rect x="30" y="0" width="10" height="60" fill="${croix}"/>
  <rect x="0" y="25" width="90" height="10" fill="${croix}"/>`);

/** Disque central (Japon, Bangladesh, Palaos). */
const disque = (fond, cercle, cx = 45, cy = 30, r = 15) =>
  svg(`<rect width="90" height="60" fill="${fond}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${cercle}"/>`);

/** Croissant et étoile (Turquie, Tunisie) — croissant obtenu par soustraction. */
const croissant = (fond, motif, centre = false) => svg(`
  <rect width="90" height="60" fill="${fond}"/>
  <g transform="translate(${centre ? 45 : 33},30)">
    <circle cx="0" cy="0" r="13" fill="${motif}"/>
    <circle cx="5" cy="0" r="10.5" fill="${fond}"/>
    ${etoileBranches(18, 0, 5.5, motif)}
  </g>`);

/** Étoile à cinq branches, en coordonnées locales. */
function etoileBranches(cx, cy, r, couleur, rotation = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rayon = i % 2 === 0 ? r : r * 0.4;
    const a = ((rotation + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * rayon).toFixed(2)},${(cy + Math.sin(a) * rayon).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${couleur}"/>`;
}

/** Triangle au guindant (Tchéquie, Cuba, Soudan, Bahamas…). */
const triangleGuindant = (bandes, triangle, largeur = 34, etoile = null) => svg(`
  ${bandes.map((c, i) => `<rect x="0" y="${(60 / bandes.length) * i}" width="90" height="${60 / bandes.length}" fill="${c}"/>`).join("")}
  <polygon points="0,0 ${largeur},30 0,60" fill="${triangle}"/>
  ${etoile ? etoileBranches(11, 30, 6, etoile) : ""}`);

/* ---------- LES DRAPEAUX ---------- */
// Choisis pour être reconnaissables ET pédagogiques : on apprend en jouant.
export const DRAPEAUX = {
  france: vertical(C.bleu, C.blanc, C.rouge),
  italie: vertical(C.vert, C.blanc, C.rouge),
  irlande: vertical(C.vert, C.blanc, C.orange),
  belgique: vertical(C.noir, C.jaune, C.rouge),
  roumanie: vertical(C.bleu, C.jaune, C.rouge),
  tchad: vertical(C.bleuNuit, C.jaune, C.rouge),
  mali: vertical(C.vert, C.jaune, C.rouge),
  guinee: vertical(C.rouge, C.jaune, C.vert),
  nigeria: vertical(C.vert, C.blanc, C.vert),
  perou: vertical(C.rouge, C.blanc, C.rouge),
  autriche: horizontal(C.rouge, C.blanc, C.rouge),
  allemagne: horizontal(C.noir, C.rouge, C.jaune),
  paysbas: horizontal(C.rouge, C.blanc, C.bleu),
  russie: horizontal(C.blanc, C.bleu, C.rouge),
  hongrie: horizontal(C.rouge, C.blanc, C.vert),
  bulgarie: horizontal(C.blanc, C.vert, C.rouge),
  lituanie: horizontal(C.jaune, C.vert, C.rouge),
  colombie: svg(`<rect width="90" height="60" fill="${C.jaune}"/><rect y="30" width="90" height="15" fill="${C.bleu}"/><rect y="45" width="90" height="15" fill="${C.rouge}"/>`),
  pologne: horizontal(C.blanc, C.rouge),
  indonesie: horizontal(C.rouge, C.blanc),
  ukraine: horizontal(C.bleuClair, C.jaune),
  suede: croixNordique(C.bleu, C.jaune),
  danemark: croixNordique(C.rouge, C.blanc),
  finlande: croixNordique(C.blanc, C.bleuNuit),
  norvege: croixNordique(C.rouge, C.bleuNuit, C.blanc),
  islande: croixNordique(C.bleuNuit, C.rouge, C.blanc),
  japon: disque(C.blanc, C.rouge, 45, 30, 14),
  bangladesh: disque(C.vert, C.rouge, 40, 30, 14),
  turquie: croissant(C.rouge, C.blanc),
  tunisie: svg(`<rect width="90" height="60" fill="${C.rouge}"/><circle cx="45" cy="30" r="19" fill="${C.blanc}"/>
    <circle cx="45" cy="30" r="12" fill="${C.rouge}"/><circle cx="49" cy="30" r="9.5" fill="${C.blanc}"/>${etoileBranches(52, 30, 5, C.rouge)}`),
  tchequie: triangleGuindant([C.blanc, C.rouge], C.bleu),
  cuba: triangleGuindant([C.bleu, C.blanc, C.bleu, C.blanc, C.bleu], C.rouge, 30, C.blanc),
  soudan: triangleGuindant([C.rouge, C.blanc, C.noir], C.vert, 30),
  bahamas: triangleGuindant([C.bleuClair, C.jaune, C.bleuClair], C.noir, 30),
  vietnam: svg(`<rect width="90" height="60" fill="${C.rouge}"/>${etoileBranches(45, 30, 17, C.jaune)}`),
  maroc: svg(`<rect width="90" height="60" fill="${C.rouge}"/>
    <polygon points="45,15 51.6,35.4 34.2,22.8 55.8,22.8 38.4,35.4" fill="none" stroke="${C.vert}" stroke-width="2.4"/>`),
  suisse: svg(`<rect width="60" height="60" fill="${C.rouge}"/><rect x="25" y="11" width="10" height="38" fill="${C.blanc}"/>
    <rect x="11" y="25" width="38" height="10" fill="${C.blanc}"/>`, "0 0 60 60"),
  // Feuille d'érable : onze pointes et une tige, tracées symétriquement —
  // la version « étoile à branches » d'avant ne ressemblait à rien.
  canada: svg(`<rect width="90" height="60" fill="${C.blanc}"/><rect width="22" height="60" fill="${C.rouge}"/>
    <rect x="68" width="22" height="60" fill="${C.rouge}"/>
    <path d="M45 12 L47.5 21 L52.5 18.5 L51 27 L58 25.5 L56 30 L62 34 L57 36.5 L58.5 41 L50 40 L49.5 43.5 L46 40 L46.8 50 L43.2 50 L44 40 L40.5 43.5 L40 40 L31.5 41 L33 36.5 L28 34 L34 30 L32 25.5 L39 27 L37.5 18.5 L42.5 21 Z" fill="${C.rouge}"/>`),
  // Les quatre petites étoiles décrivent un ARC autour de la grande, chacune
  // inclinée vers elle : disposées en colonne, on ne reconnaissait rien.
  chine: svg(`<rect width="90" height="60" fill="${C.rouge}"/>${etoileBranches(17, 16, 8, C.jaune)}
    ${etoileBranches(31, 7, 2.8, C.jaune, -60)}${etoileBranches(37, 14, 2.8, C.jaune, -75)}
    ${etoileBranches(37, 23, 2.8, C.jaune, -105)}${etoileBranches(31, 30, 2.8, C.jaune, -120)}`),
  grece: svg(`${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect y="${i * 6.66}" width="90" height="6.66" fill="${i % 2 ? C.blanc : C.bleu}"/>`).join("")}
    <rect width="30" height="33.3" fill="${C.bleu}"/><rect x="12" y="0" width="6" height="33.3" fill="${C.blanc}"/><rect x="0" y="13.6" width="30" height="6" fill="${C.blanc}"/>`),
  bresil: svg(`<rect width="90" height="60" fill="${C.vert}"/><polygon points="45,8 82,30 45,52 8,30" fill="${C.jaune}"/>
    <circle cx="45" cy="30" r="13" fill="${C.bleuNuit}"/><path d="M32 26 Q45 34 58 26" stroke="${C.blanc}" stroke-width="3.4" fill="none"/>`),
  portugal: svg(`<rect width="90" height="60" fill="${C.rouge}"/><rect width="36" height="60" fill="${C.vert}"/>
    <circle cx="36" cy="30" r="11" fill="none" stroke="${C.jaune}" stroke-width="2.6"/><rect x="30" y="24" width="12" height="12" rx="2" fill="${C.rouge}"/>`),
  inde: svg(`<rect width="90" height="60" fill="${C.blanc}"/><rect width="90" height="20" fill="${C.orange}"/>
    <rect y="40" width="90" height="20" fill="${C.vert}"/><circle cx="45" cy="30" r="8" fill="none" stroke="${C.bleuNuit}" stroke-width="1.6"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<line x1="45" y1="30" x2="${45 + Math.cos(a) * 8}" y2="${30 + Math.sin(a) * 8}" stroke="${C.bleuNuit}" stroke-width="0.9"/>`; }).join("")}`),
  argentine: svg(`<rect width="90" height="60" fill="${C.blanc}"/><rect width="90" height="20" fill="${C.bleuClair}"/>
    <rect y="40" width="90" height="20" fill="${C.bleuClair}"/><circle cx="45" cy="30" r="7" fill="${C.jaune}"/>`),
  espagne: svg(`<rect width="90" height="60" fill="${C.rouge}"/><rect y="15" width="90" height="30" fill="${C.jaune}"/>
    <rect x="18" y="22" width="14" height="16" rx="2" fill="${C.rouge}" opacity="0.85"/>`),
  jamaique: svg(`<rect width="90" height="60" fill="${C.vert}"/>
    <polygon points="0,0 45,30 0,60" fill="${C.noir}"/><polygon points="90,0 45,30 90,60" fill="${C.noir}"/>
    <path d="M0 0 L90 60 M90 0 L0 60" stroke="${C.jaune}" stroke-width="8"/>`),
  israel: svg(`<rect width="90" height="60" fill="${C.blanc}"/><rect y="8" width="90" height="7" fill="${C.bleu}"/>
    <rect y="45" width="90" height="7" fill="${C.bleu}"/>
    <polygon points="45,18 53,32 37,32" fill="none" stroke="${C.bleu}" stroke-width="2.2"/>
    <polygon points="45,42 53,28 37,28" fill="none" stroke="${C.bleu}" stroke-width="2.2"/>`),
  coreedusud: svg(`<rect width="90" height="60" fill="${C.blanc}"/>
    <path d="M45 16 A14 14 0 0 1 45 44 A7 7 0 0 0 45 30 A7 7 0 0 1 45 16" fill="${C.rouge}"/>
    <path d="M45 44 A14 14 0 0 1 45 16 A7 7 0 0 1 45 30 A7 7 0 0 0 45 44" fill="${C.bleu}"/>`),
};

/* ---------- OMBRES CHINOISES DE MONUMENTS ---------- */
// Il n'en reste que quatre : celles dont le monument n'a pas ENCORE reçu son
// aquarelle. Une silhouette noire se devine mal — dès qu'une illustration
// existe (voir AQUARELLES plus bas), elle prend la place et l'ombre disparaît.
// Silhouettes originales, tracées à la main : reconnaissables au seul contour.
// `fill-rule="evenodd"` est INDISPENSABLE : sans elle, les sous-tracés
// (arcades du Colisée, yeux du moai) se remplissent au lieu de creuser, et la
// silhouette devient une masse informe.
const ombre = (d, ratio = "0 0 100 100") =>
  svg(`<rect width="100" height="100" fill="none"/><path d="${d}" fill="currentColor" fill-rule="evenodd"/>`, ratio);

export const MONUMENTS = {
  "tour-eiffel": ombre("M50 6 L53 20 L56 20 L58 34 L64 34 L66 48 L74 48 L78 70 L86 92 L70 92 L62 74 L56 74 L54 92 L46 92 L44 74 L38 74 L30 92 L14 92 L22 70 L26 48 L34 48 L36 34 L42 34 L44 20 L47 20 Z"),
  "pyramide": ombre("M50 14 L92 86 L8 86 Z M50 14 L50 86"),
  // La signature de Big Ben, c'est le CADRAN rond haut perché sous une flèche
  // pointue, pas une tour rectangulaire : le cercle est creusé (evenodd).
  "big-ben": ombre("M50 4 L44 20 L42 20 L42 30 L38 30 L38 92 L62 92 L62 30 L58 30 L58 20 L56 20 Z M50 46 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0 Z"),
  "arc-triomphe": ombre("M14 88 L14 26 L86 26 L86 88 L66 88 L66 52 Q50 38 34 52 L34 88 Z"),
};

/* ---------- CARTES DE PAYS ---------- */
// Mes silhouettes tracées à la main donnaient des patates méconnaissables.
// Ici, ce sont les VRAIES frontières : contours Natural Earth (domaine public),
// projetés en Mercator et simplifiés hors ligne par tools/forge-cartes.mjs,
// puis embarqués sous forme de chemins SVG. Le jeu ne demande rien à internet.
export const PAYS = Object.fromEntries(
  Object.entries(CARTES).map(([cle, d]) => [cle, ombre(d)]),
);

/* ---------- MONUMENTS ILLUSTRÉS ---------- */
// Aquarelles originales peintes pour le jeu (lot « Les Merveilles du Donjon »).
// Elles remplacent peu à peu les ombres chinoises : une silhouette noire se
// devine mal, une aquarelle se reconnaît. Chaque fichier est embarqué en
// data-URI par le constructeur — aucune requête réseau en partie.
//
// Le contrôle des droits est consigné dans NOTES-DROITS-MONUMENTS.txt : tout
// monument dont l'œuvre architecturale est encore protégée (opéra de Sydney,
// Sagrada Família, Christ Rédempteur, Atomium) est ABSENT de cette liste, et
// doit le rester — peindre au lieu de photographier n'y change rien.
// Les chemins sont écrits EN TOUTES LETTRES, jamais construits par
// concaténation : le constructeur du fichier autonome remplace les chaînes
// « assets/... » qu'il TROUVE dans le source par l'image en base64. Un chemin
// assemblé à l'exécution lui échappe, et le jeu partirait sans ses images.
export const AQUARELLE_SRC = {
  "cathedrale-basile": "assets/monuments/cathedrale-basile.webp",
  "colisee": "assets/monuments/colisee.webp",
  "golden-gate": "assets/monuments/golden-gate.webp",
  "grande-muraille": "assets/monuments/grande-muraille.webp",
  "machu-picchu": "assets/monuments/machu-picchu.webp",
  "moai": "assets/monuments/moai.webp",
  "mont-saint-michel": "assets/monuments/mont-saint-michel.webp",
  "neuschwanstein": "assets/monuments/neuschwanstein.webp",
  "parthenon": "assets/monuments/parthenon.webp",
  "porte-brandebourg": "assets/monuments/porte-brandebourg.webp",
  "sphinx": "assets/monuments/sphinx.webp",
  "statue-liberte": "assets/monuments/statue-liberte.webp",
  "stonehenge": "assets/monuments/stonehenge.webp",
  "taj-mahal": "assets/monuments/taj-mahal.webp",
  "tour-de-pise": "assets/monuments/tour-de-pise.webp",
};
export const AQUARELLES = Object.keys(AQUARELLE_SRC);

/** Chemin de l'illustration d'un monument (remplacé par un data-URI à la
 *  construction du fichier autonome). */
const aquarelle = (cle) => AQUARELLE_SRC[cle];

/* ---------- FIGURES DU CIEL ---------- */
// Tracées d'après les vraies coordonnées des étoiles (voir constellations.js) :
// la Grande Ourse a la forme qu'elle a réellement ce soir au-dessus du jardin.

/* ---------- rendu ---------- */

/** Fabrique l'élément visuel d'une question, ou null si le type est inconnu
 *  (le jeu affiche alors la question sans image — jamais d'écran cassé). */
export function visuelEl(visuel) {
  if (!visuel || typeof visuel !== "object") return null;
  const boite = document.createElement("div");
  boite.className = `visuel visuel-${visuel.type}`;
  boite.setAttribute("aria-hidden", "true"); // l'énoncé porte déjà le sens
  if (visuel.type === "drapeau" && DRAPEAUX[visuel.cle]) {
    boite.innerHTML = DRAPEAUX[visuel.cle];
  } else if (visuel.type === "ombre" && MONUMENTS[visuel.cle]) {
    boite.innerHTML = MONUMENTS[visuel.cle];
  } else if (visuel.type === "pays" && PAYS[visuel.cle]) {
    boite.className = "visuel visuel-ombre visuel-pays"; // même plaque sombre
    boite.innerHTML = PAYS[visuel.cle];
  } else if (visuel.type === "monument" && AQUARELLES.includes(visuel.cle)) {
    // Une aquarelle est posée comme une page de carnet : léger cadre ivoire,
    // ombre douce, mêmes coins arrondis que le reste des visuels.
    boite.className = "visuel visuel-monument";
    const img = document.createElement("img");
    img.src = aquarelle(visuel.cle);
    img.alt = "";
    img.decoding = "async";
    img.className = "visuel-aquarelle";
    boite.append(img);
  } else if (visuel.type === "ciel" && CIELS.includes(visuel.cle)) {
    // Le ciel a sa propre plaque, plus sombre : des étoiles sur fond clair,
    // personne n'y croirait.
    boite.className = "visuel visuel-ciel";
    boite.innerHTML = cielSvg(visuel.cle);
  } else if (visuel.type === "rebus" && visuel.emojis) {
    boite.className = "visuel visuel-rebus";
    boite.textContent = visuel.emojis;
  } else {
    return null;
  }
  return boite;
}

/** Inventaire (outils de contrôle) : tout ce que le module sait dessiner. */
export const VISUELS_CONNUS = {
  drapeau: Object.keys(DRAPEAUX),
  ombre: Object.keys(MONUMENTS),
  pays: Object.keys(PAYS),
  ciel: CIELS,
  monument: AQUARELLES,
};
