// VISUELS DESSINÉS PAR CODE (SVG) — drapeaux, ombres chinoises de monuments,
// rébus d'émojis. Aucune image : quelques primitives paramétrées suffisent à
// produire des dizaines de drapeaux nets à toute taille, pour un poids
// dérisoire. C'est ce qui permet aux questions visuelles d'exister AUSSI dans
// la version web partageable, dont le budget est presque saturé.
//
// Aucun visuel n'imite une œuvre protégée : un drapeau est un emblème public,
// une ombre chinoise de monument est un tracé original fait maison.

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
  "colisee": ombre("M12 84 Q12 40 50 38 Q88 40 88 84 L88 90 L12 90 Z M22 60 L30 60 L30 76 L22 76 Z M40 58 L48 58 L48 76 L40 76 Z M58 58 L66 58 L66 76 L58 76 Z M74 62 L80 62 L80 76 L74 76 Z"),
  // Dôme bulbeux flanqué de deux minarets élancés, sur sa terrasse : c'est
  // cette combinaison qui fait le Taj Mahal, pas trois formes verticales.
  "taj-mahal": ombre("M50 14 Q49 10 50 8 Q51 10 50 14 Q64 20 64 34 Q64 44 56 50 L56 74 L44 74 L44 50 Q36 44 36 34 Q36 20 50 14 Z M20 34 Q22 30 24 34 L25 74 L19 74 Z M76 34 Q78 30 80 34 L81 74 L75 74 Z M14 74 L86 74 L86 82 L14 82 Z M8 82 L92 82 L92 90 L8 90 Z"),
  // Trois signes suffisent à la reconnaître : la robe qui s'évase, la couronne
  // à pointes, et surtout le BRAS TENDU très haut portant la flamme.
  "statue-liberte": ombre("M44 34 L40 66 L60 66 L56 34 Z M46 26 Q46 20 50 20 Q54 20 54 26 Q54 31 50 33 Q46 31 46 26 Z M41 22 L44 15 L46 21 L48 13 L50 20 L52 13 L54 21 L56 15 L59 22 Q50 17 41 22 Z M55 32 L63 14 L68 16 L60 35 Z M62 15 Q65 4 68 15 Q65 12 62 15 Z M40 66 L60 66 L62 74 L38 74 Z M34 74 L66 74 L66 84 L34 84 Z M28 84 L72 84 L72 92 L28 92 Z"),
  "arc-triomphe": ombre("M14 88 L14 26 L86 26 L86 88 L66 88 L66 52 Q50 38 34 52 L34 88 Z"),
  // Le penché ne suffit pas : ce sont les étages à colonnades superposés qui
  // font reconnaître Pise. Chaque bandeau creuse la silhouette (evenodd).
  "tour-de-pise": ombre("M42 92 L36 90 L48 12 L64 14 L54 92 Z M46.6 76 L60 77 L59.4 81 L46 80 Z M49 60 L62.4 61 L61.8 65 L48.4 64 Z M51.4 44 L64.8 45 L64.2 49 L50.8 48 Z M53.8 28 L67.2 29 L66.6 33 L53.2 32 Z"),
  "moai": ombre("M34 92 L34 44 Q34 18 50 14 Q66 18 66 44 L66 92 Z M40 46 L46 46 L46 52 L40 52 Z M54 46 L60 46 L60 52 L54 52 Z M42 68 L58 68 L58 72 L42 72 Z"),
  // Saint-Basile, ce sont PLUSIEURS bulbes de tailles différentes, jamais une
  // tour unique : c'est cette skyline en oignons qui la rend inimitable.
  "cathedrale-basile": ombre("M50 20 Q38 32 40 44 L40 90 L60 90 L60 44 Q62 32 50 20 Z M50 20 Q47 14 50 8 Q53 14 50 20 Z M26 44 Q16 54 18 64 L18 90 L34 90 L34 64 Q36 54 26 44 Z M26 44 Q24 39 26 34 Q28 39 26 44 Z M74 44 Q64 54 66 64 L66 90 L82 90 L82 64 Q84 54 74 44 Z M74 44 Q72 39 74 34 Q76 39 74 44 Z M12 90 L88 90 L88 96 L12 96 Z"),
};

/* ---------- SILHOUETTES DE PAYS ---------- */
// Contours simplifiés, tracés à la main pour rester lisibles en petit : on
// garde la SIGNATURE (la botte italienne, l'hexagone français, la corne de
// l'Afrique) et l'on gomme le détail des côtes, illisible à cette taille.
export const PAYS = {
  italie: ombre("M30 10 L44 16 L52 12 L58 18 L54 26 L58 34 L66 40 L74 52 L82 62 L86 74 L80 78 L72 68 L64 60 L58 66 L50 60 L44 50 L36 44 L28 38 L22 28 L24 18 Z M84 84 Q90 80 92 86 Q88 92 84 86 Z M64 84 Q74 78 78 86 Q72 94 64 88 Z"),
  japon: ombre("M70 14 L78 20 L74 30 L66 34 L60 30 Z M56 38 L64 42 L60 54 L50 62 L42 60 L46 48 Z M38 64 L44 68 L40 78 L30 82 L26 76 Z M18 84 Q24 80 26 86 Q22 92 18 86 Z"),
  egypte: ombre("M22 24 L78 24 L78 48 L66 48 L66 76 L34 76 L34 48 L22 48 Z"),
  chili: ombre("M44 10 L56 12 L54 30 L58 48 L54 66 L56 84 L48 88 L42 70 L44 50 L40 30 Z"),
};

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
};
