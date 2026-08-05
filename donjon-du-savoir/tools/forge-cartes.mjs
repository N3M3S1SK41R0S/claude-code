// FORGE DES CARTES DE PAYS — à partir des contours Natural Earth (DOMAINE
// PUBLIC, via world-atlas). Mes silhouettes tracées à la main donnaient des
// patates ; ici les frontières sont exactes. Le résultat est converti en
// chemins SVG légers, EMBARQUÉS dans le jeu : rien n'est chargé depuis
// internet en partie (le Donjon reste 100 % hors-ligne).
//
// Chaîne : TopoJSON → contours → projection → simplification → viewBox 0-100.
// Lancer : node tools/forge-cartes.mjs [chemin/countries-110m.json]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Source par défaut : le fond de carte au 1/50 000 000e. Le 1/110 000 000e,
// essayé d'abord, était trop grossier : l'Irlande et l'Islande y devenaient des
// blocs anguleux. Le fichier source est plus lourd, mais il ne sert qu'ICI —
// seul le résultat simplifié part dans le jeu.
const source = process.argv[2] ?? join(root, "vendor", "countries-50m.json");
const topo = JSON.parse(readFileSync(source, "utf8"));

/* ---------- décodage TopoJSON (arcs en deltas quantifiés) ---------- */

const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty]; // → longitude, latitude
  });
});
// Un indice négatif désigne l'arc ~i parcouru à l'envers (convention TopoJSON).
const arcPoints = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
const anneau = (indices) => {
  const pts = [];
  for (const i of indices) {
    const a = arcPoints(i);
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
};
const contours = (geom) => {
  if (geom.type === "Polygon") return geom.arcs.map(anneau);
  if (geom.type === "MultiPolygon") return geom.arcs.flatMap((poly) => poly.map(anneau));
  return [];
};

/* ---------- projection et mise en boîte ---------- */

// Mercator : garde les FORMES reconnaissables (une carte scolaire), au prix
// des surfaces — c'est exactement ce qu'on veut pour faire deviner un pays.
const mercator = ([lon, lat]) => {
  const phi = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return [lon, -Math.log(Math.tan(Math.PI / 4 + phi / 2)) * 180 / Math.PI];
};

/** Douglas-Peucker : jette les points qui ne changent pas la silhouette. */
function simplifie(points, tol) {
  if (points.length < 3) return points;
  const dist2 = (p, a, b) => {
    let [x, y] = a; let dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = b;
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };
  const garde = new Uint8Array(points.length);
  garde[0] = garde[points.length - 1] = 1;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop();
    let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = dist2(points[k], points[i], points[j]);
      if (d > max) { max = d; idx = k; }
    }
    if (max > tol * tol && idx > 0) { garde[idx] = 1; pile.push([i, idx], [idx, j]); }
  }
  return points.filter((_, k) => garde[k]);
}

const aire = (pts) => Math.abs(pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

/** Boîte englobante d'un anneau : [xmin, ymin, xmax, ymax]. */
const boite = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

/** Écart BORD À BORD entre deux boîtes (0 si elles se touchent ou se chevauchent).
 *  Mesurer de centre à centre trompait : un grand pays « absorbait » des
 *  territoires très lointains simplement parce qu'il était large. */
const ecart = (a, b) => Math.hypot(
  Math.max(0, a[0] - b[2], b[0] - a[2]),
  Math.max(0, a[1] - b[3], b[1] - a[3]),
);

/** Fabrique le chemin SVG d'un pays, cadré dans une viewBox 0 0 100 100. */
function cheminDe(geom, { partsMax = 14, tolerance = 0.22, portee = 0.3 } = {}) {
  let parties = contours(geom).map((anneau) => anneau.map(mercator));
  if (!parties.length) return null;
  // On garde les morceaux SIGNIFICATIFS : sans cela, les confettis d'îlots
  // écrasent le pays principal une fois la carte mise à l'échelle.
  parties.sort((a, b) => aire(b) - aire(a));
  const aireMax = aire(parties[0]);
  parties = parties.filter((p) => aire(p) >= aireMax * 0.012).slice(0, partsMax);
  // …ET les morceaux PROCHES. Sans ce filtre, la Guyane et la Réunion tirent
  // la boîte de cadrage à l'échelle du globe : la France métropolitaine
  // devenait un timbre-poste illisible dans un coin de l'image ; le Svalbard
  // coupait la Norvège en deux morceaux méconnaissables. On garde donc ce qui
  // colle au pays principal (Corse, Sicile, Crète) et on écarte le lointain.
  const principal = parties[0];
  const boiteP = boite(principal);
  const diagonale = Math.hypot(boiteP[2] - boiteP[0], boiteP[3] - boiteP[1]);
  parties = parties.filter((p) => ecart(boiteP, boite(p)) <= diagonale * portee);

  const tous = parties.flat();
  const xs = tous.map((p) => p[0]), ys = tous.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const etendue = Math.max(x1 - x0, y1 - y0) || 1;
  const k = 92 / etendue; // marge de 4 % de chaque côté
  const decX = (100 - (x1 - x0) * k) / 2, decY = (100 - (y1 - y0) * k) / 2;
  const vers = ([x, y]) => [(x - x0) * k + decX, (y - y0) * k + decY];

  return parties.map((partie) => {
    const pts = simplifie(partie.map(vers), tolerance);
    if (pts.length < 3) return "";
    return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + "Z";
  }).filter(Boolean).join(" ");
}

/* ---------- les pays retenus ---------- */
// Choisis pour être reconnaissables à leur seule forme, et pour faire le tour
// du monde (pas seulement l'Europe).
const VOULUS = {
  "France": "france", "Italy": "italie", "Spain": "espagne", "Portugal": "portugal",
  "United Kingdom": "royaumeuni", "Ireland": "irlande", "Germany": "allemagne",
  "Switzerland": "suisse", "Greece": "grece", "Norway": "norvege", "Sweden": "suede",
  "Iceland": "islande", "Turkey": "turquie", "Japan": "japon", "China": "chine",
  "India": "inde", "Australia": "australie", "New Zealand": "nouvellezelande",
  "Brazil": "bresil", "Chile": "chili", "Argentina": "argentine", "Mexico": "mexique",
  "Canada": "canada", "United States of America": "etatsunis", "Egypt": "egypte",
  "South Africa": "afriquedusud", "Madagascar": "madagascar", "Morocco": "maroc",
};

// Deux pays demandent un cadrage plus serré que la règle générale : l'Alaska
// réduisait les quarante-huit États à un timbre-poste, et les îles Andaman
// semaient des confettis à droite de l'Inde. On resserre la portée pour eux.
const REGLAGES = {
  etatsunis: { portee: 0.05 },
  inde: { portee: 0.1 },
};

const sortie = {};
let manquants = [];
for (const geom of topo.objects.countries.geometries) {
  const nom = geom.properties?.name;
  if (!nom || !VOULUS[nom]) continue;
  const d = cheminDe(geom, REGLAGES[VOULUS[nom]]);
  if (d) sortie[VOULUS[nom]] = d;
}
manquants = Object.entries(VOULUS).filter(([, cle]) => !sortie[cle]).map(([n]) => n);

const entete = `// CARTES DES PAYS — contours réels issus de Natural Earth (domaine public),
// convertis en chemins SVG par tools/forge-cartes.mjs. Embarqués dans le jeu :
// aucune requête réseau en partie. Ne pas éditer à la main — relancer l'outil.
export const CARTES = ${JSON.stringify(sortie, null, 1)};
`;
writeFileSync(join(root, "js", "cartes.js"), entete);
const poids = Buffer.byteLength(entete) / 1024;
console.log(`✓ ${Object.keys(sortie).length} cartes → js/cartes.js (${poids.toFixed(1)} Ko)`);
if (manquants.length) console.log("  introuvables dans la source :", manquants.join(", "));
for (const [cle, d] of Object.entries(sortie)) {
  console.log(`  ${cle.padEnd(16)} ${d.split("M").length - 1} morceau(x), ${d.length} caractères`);
}
