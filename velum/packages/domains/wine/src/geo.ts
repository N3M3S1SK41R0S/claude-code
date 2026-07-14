/**
 * Géolocalisation du vin — Pari « visuels » (demande produit juillet 2026).
 *
 * Résout la région/appellation/pays d'un vin en coordonnées, pour afficher une
 * CARTE (France pour les vins français, monde pour les vins étrangers) avec le
 * domaine localisé. Les silhouettes de carte sont définies en COORDONNÉES
 * géographiques et projetées avec la MÊME fonction que le marqueur → le point
 * tombe toujours au bon endroit, sans données SVG pré-calculées.
 *
 * Pur, testable, sans réseau. `[lng, lat]` partout (ordre x,y géographique).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export type MapScope = 'france' | 'world';

export interface WineOrigin {
  lat: number;
  lng: number;
  /** Libellé lisible (appellation/région ou pays). */
  label: string;
  scope: MapScope;
  /** Clé de lieu réellement appariée (traçabilité). */
  matched: string;
}

/** Normalise une chaîne pour l'appariement : minuscules, sans accents ni ponctuation. */
export function normalizePlace(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FRANCE_SYNONYMS = new Set(['france', 'fr', 'francais', 'francaise']);

/** Régions & appellations françaises → coordonnées (vignoble). */
export const FRENCH_PLACES: Record<string, LatLng> = {
  // Bordelais
  pauillac: { lat: 45.2, lng: -0.75 },
  margaux: { lat: 45.04, lng: -0.67 },
  'saint julien': { lat: 45.16, lng: -0.75 },
  'saint estephe': { lat: 45.26, lng: -0.76 },
  medoc: { lat: 45.35, lng: -0.85 },
  'haut medoc': { lat: 45.13, lng: -0.72 },
  'saint emilion': { lat: 44.89, lng: -0.16 },
  pomerol: { lat: 44.93, lng: -0.19 },
  sauternes: { lat: 44.53, lng: -0.32 },
  pessac: { lat: 44.79, lng: -0.63 },
  graves: { lat: 44.72, lng: -0.4 },
  bordeaux: { lat: 44.84, lng: -0.58 },
  // Bourgogne
  chablis: { lat: 47.81, lng: 3.8 },
  'gevrey chambertin': { lat: 47.22, lng: 4.97 },
  'vosne romanee': { lat: 47.16, lng: 4.95 },
  'nuits saint georges': { lat: 47.14, lng: 4.95 },
  beaune: { lat: 47.02, lng: 4.84 },
  meursault: { lat: 46.98, lng: 4.77 },
  puligny: { lat: 46.95, lng: 4.75 },
  'cote de nuits': { lat: 47.18, lng: 4.95 },
  'cote de beaune': { lat: 47.0, lng: 4.8 },
  macon: { lat: 46.31, lng: 4.83 },
  pouilly: { lat: 46.29, lng: 4.73 },
  bourgogne: { lat: 47.05, lng: 4.85 },
  // Champagne
  reims: { lat: 49.26, lng: 4.03 },
  epernay: { lat: 49.04, lng: 3.96 },
  champagne: { lat: 49.05, lng: 3.99 },
  // Rhône
  'cote rotie': { lat: 45.5, lng: 4.75 },
  hermitage: { lat: 45.07, lng: 4.83 },
  cornas: { lat: 44.96, lng: 4.86 },
  'chateauneuf du pape': { lat: 44.06, lng: 4.83 },
  gigondas: { lat: 44.19, lng: 5.0 },
  'cotes du rhone': { lat: 44.5, lng: 4.83 },
  rhone: { lat: 44.5, lng: 4.83 },
  // Loire
  sancerre: { lat: 47.33, lng: 2.84 },
  'pouilly fume': { lat: 47.29, lng: 2.96 },
  vouvray: { lat: 47.41, lng: 0.79 },
  chinon: { lat: 47.17, lng: 0.24 },
  saumur: { lat: 47.26, lng: -0.08 },
  muscadet: { lat: 47.2, lng: -1.35 },
  'val de loire': { lat: 47.3, lng: 0.5 },
  loire: { lat: 47.3, lng: 0.5 },
  // Autres régions
  alsace: { lat: 48.2, lng: 7.4 },
  beaujolais: { lat: 46.1, lng: 4.65 },
  provence: { lat: 43.5, lng: 6.2 },
  bandol: { lat: 43.14, lng: 5.75 },
  languedoc: { lat: 43.5, lng: 3.3 },
  roussillon: { lat: 42.7, lng: 2.9 },
  jura: { lat: 46.9, lng: 5.75 },
  savoie: { lat: 45.6, lng: 5.9 },
  cahors: { lat: 44.45, lng: 1.44 },
  madiran: { lat: 43.55, lng: -0.05 },
  jurancon: { lat: 43.29, lng: -0.42 },
  'sud ouest': { lat: 44.0, lng: 0.5 },
  corse: { lat: 42.0, lng: 9.1 },
  corsica: { lat: 42.0, lng: 9.1 },
};

/** Pays viticoles étrangers → coordonnées (région phare quand pertinent). */
export const FOREIGN_PLACES: Record<string, LatLng & { label: string }> = {
  italie: { lat: 43.0, lng: 11.5, label: 'Italie' },
  italy: { lat: 43.0, lng: 11.5, label: 'Italie' },
  toscane: { lat: 43.4, lng: 11.3, label: 'Toscane (Italie)' },
  piemont: { lat: 44.7, lng: 8.0, label: 'Piémont (Italie)' },
  espagne: { lat: 42.4, lng: -2.7, label: 'Espagne' },
  spain: { lat: 42.4, lng: -2.7, label: 'Espagne' },
  rioja: { lat: 42.4, lng: -2.7, label: 'Rioja (Espagne)' },
  portugal: { lat: 41.1, lng: -7.8, label: 'Portugal' },
  douro: { lat: 41.1, lng: -7.8, label: 'Douro (Portugal)' },
  allemagne: { lat: 49.9, lng: 7.0, label: 'Allemagne' },
  germany: { lat: 49.9, lng: 7.0, label: 'Allemagne' },
  mosel: { lat: 49.9, lng: 7.0, label: 'Mosel (Allemagne)' },
  autriche: { lat: 48.4, lng: 15.6, label: 'Autriche' },
  austria: { lat: 48.4, lng: 15.6, label: 'Autriche' },
  suisse: { lat: 46.2, lng: 7.0, label: 'Suisse' },
  switzerland: { lat: 46.2, lng: 7.0, label: 'Suisse' },
  hongrie: { lat: 48.1, lng: 21.4, label: 'Hongrie (Tokaj)' },
  grece: { lat: 38.5, lng: 22.8, label: 'Grèce' },
  greece: { lat: 38.5, lng: 22.8, label: 'Grèce' },
  georgie: { lat: 41.9, lng: 45.5, label: 'Géorgie' },
  liban: { lat: 33.8, lng: 35.9, label: 'Liban (Bekaa)' },
  'etats unis': { lat: 38.5, lng: -122.4, label: 'Californie (USA)' },
  usa: { lat: 38.5, lng: -122.4, label: 'Californie (USA)' },
  californie: { lat: 38.5, lng: -122.4, label: 'Californie (USA)' },
  california: { lat: 38.5, lng: -122.4, label: 'Californie (USA)' },
  oregon: { lat: 45.3, lng: -123.1, label: 'Oregon (USA)' },
  argentine: { lat: -32.9, lng: -68.8, label: 'Mendoza (Argentine)' },
  argentina: { lat: -32.9, lng: -68.8, label: 'Mendoza (Argentine)' },
  chili: { lat: -34.0, lng: -70.9, label: 'Chili' },
  chile: { lat: -34.0, lng: -70.9, label: 'Chili' },
  'afrique du sud': { lat: -33.9, lng: 18.9, label: 'Afrique du Sud' },
  'south africa': { lat: -33.9, lng: 18.9, label: 'Afrique du Sud' },
  australie: { lat: -34.9, lng: 138.6, label: 'Australie' },
  australia: { lat: -34.9, lng: 138.6, label: 'Australie' },
  'nouvelle zelande': { lat: -41.5, lng: 173.9, label: 'Nouvelle-Zélande' },
  'new zealand': { lat: -41.5, lng: 173.9, label: 'Nouvelle-Zélande' },
};

/** Centre de la France métropolitaine (repli si pays = France sans région). */
const FRANCE_CENTER: LatLng = { lat: 46.6, lng: 2.4 };

/** Cherche la clé de lieu la plus spécifique (la plus longue) contenue dans l'entrée. */
function matchPlace<T>(input: string, table: Record<string, T>): { key: string; value: T } | null {
  const norm = normalizePlace(input);
  if (norm === '') return null;
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (norm === key || norm.includes(key)) return { key, value: table[key] as T };
  }
  return null;
}

/**
 * Résout l'origine géographique d'un vin depuis ses attributs.
 * Priorité : appellation (plus spécifique) → région → pays. Retourne null si
 * rien n'est reconnu — jamais de localisation inventée (principe #1).
 */
export function resolveWineOrigin(attrs: {
  appellation?: string;
  region?: string;
  country?: string;
}): WineOrigin | null {
  const countryNorm = attrs.country ? normalizePlace(attrs.country) : '';
  const isFrance = FRANCE_SYNONYMS.has(countryNorm);

  // 1) Lieux français (appellation puis région) — priment si pays = France ou inconnu.
  if (!attrs.country || isFrance || countryNorm === '') {
    for (const field of [attrs.appellation, attrs.region]) {
      if (!field) continue;
      const hit = matchPlace(field, FRENCH_PLACES);
      if (hit) {
        return { ...hit.value, label: titleize(hit.key), scope: 'france', matched: hit.key };
      }
    }
  } else {
    // Pays étranger : on tente quand même une région française nommée par erreur ?
    // Non — on respecte le pays déclaré.
  }

  // 2) Lieux étrangers (région étrangère nommée dans appellation/region, puis pays).
  for (const field of [attrs.appellation, attrs.region, attrs.country]) {
    if (!field) continue;
    const hit = matchPlace(field, FOREIGN_PLACES);
    if (hit) {
      return { lat: hit.value.lat, lng: hit.value.lng, label: hit.value.label, scope: 'world', matched: hit.key };
    }
  }

  // 3) Pays = France mais aucune région reconnue → centre France.
  if (isFrance) {
    return { ...FRANCE_CENTER, label: 'France', scope: 'france', matched: 'france' };
  }

  return null;
}

function titleize(key: string): string {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Projection ────────────────────────────────────────────────────────────────

/** Boîte englobante de la France métropolitaine (Corse incluse). */
export const FRANCE_BBOX: BBox = { minLng: -5.4, maxLng: 9.8, minLat: 41.3, maxLat: 51.2 };
/** Boîte englobante monde (équirectangulaire). */
export const WORLD_BBOX: BBox = { minLng: -170, maxLng: 180, minLat: -58, maxLat: 78 };

/**
 * Projette [lat, lng] en coordonnées normalisées 0..1 dans une boîte (x = est,
 * y = sud, adapté à l'écran). Hors-boîte → clampé à [0,1].
 */
export function projectNorm(lat: number, lng: number, bbox: BBox): { nx: number; ny: number } {
  const nx = (lng - bbox.minLng) / (bbox.maxLng - bbox.minLng);
  const ny = (bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat);
  return { nx: clamp01(nx), ny: clamp01(ny) };
}

/** Ratio largeur/hauteur d'une boîte, corrigé de la convergence des méridiens. */
export function bboxAspect(bbox: BBox): number {
  const midLat = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const lngSpan = (bbox.maxLng - bbox.minLng) * Math.cos(midLat);
  const latSpan = bbox.maxLat - bbox.minLat;
  return lngSpan / latSpan;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// ── Silhouettes (coordonnées [lng, lat]) ────────────────────────────────────────

/** Contour simplifié de la France métropolitaine (hexagone reconnaissable). */
export const FRANCE_OUTLINE: [number, number][] = [
  [2.4, 51.0], [3.2, 50.5], [4.2, 50.3], [5.6, 49.5], [7.6, 49.1], [8.2, 48.9],
  [7.6, 47.6], [7.0, 47.4], [6.9, 46.4], [6.8, 46.1], [7.0, 45.2], [6.9, 44.4],
  [7.5, 43.8], [6.6, 43.1], [5.4, 43.3], [4.0, 43.5], [3.0, 42.5], [1.7, 42.5],
  [0.6, 42.7], [-1.4, 43.3], [-1.6, 44.2], [-1.1, 45.6], [-1.1, 46.3], [-2.1, 47.0],
  [-2.6, 47.4], [-4.3, 47.8], [-4.8, 48.4], [-3.3, 48.7], [-1.6, 48.6], [-1.6, 49.7],
  [-0.2, 49.3], [0.2, 49.7], [1.6, 50.9], [2.4, 51.0],
];

/** Corse (petit contour séparé). */
export const CORSICA_OUTLINE: [number, number][] = [
  [9.35, 43.0], [9.55, 42.7], [9.45, 42.3], [9.4, 41.9], [9.2, 41.4], [8.7, 41.6],
  [8.6, 42.2], [8.8, 42.6], [9.1, 42.8], [9.35, 43.0],
];

/**
 * Silhouettes monde très simplifiées (continents utiles au vin), en anneaux
 * [lng, lat]. Coarse mais reconnaissable : le marqueur pays porte l'information.
 */
export const WORLD_OUTLINES: [number, number][][] = [
  // Europe + Afrique du Nord/Ouest
  [[-10, 43], [-9, 38], [-6, 36], [0, 38], [3, 43], [8, 44], [12, 45], [18, 46], [28, 45],
   [30, 40], [24, 38], [15, 37], [12, 37], [10, 34], [0, 35], [-6, 33], [-10, 35], [-10, 43]],
  // Afrique subsaharienne (silhouette grossière)
  [[-17, 15], [0, 16], [15, 12], [30, 15], [43, 11], [40, -5], [35, -18], [25, -34], [18, -35],
   [12, -18], [8, -2], [-8, 5], [-17, 15]],
  // Amérique du Nord (ouest utile : Californie/Oregon)
  [[-125, 48], [-124, 40], [-120, 34], [-114, 32], [-97, 26], [-81, 25], [-80, 32], [-70, 44],
   [-80, 50], [-100, 50], [-125, 48]],
  // Amérique du Sud (Chili/Argentine)
  [[-79, 8], [-70, 0], [-60, 5], [-48, -2], [-40, -12], [-48, -25], [-58, -35], [-66, -45],
   [-70, -52], [-73, -40], [-72, -30], [-70, -18], [-79, 8]],
  // Océanie (Australie + NZ approx dans le cadre)
  [[113, -22], [122, -18], [131, -12], [142, -11], [147, -20], [150, -35], [140, -38], [129, -32],
   [118, -34], [113, -22]],
];
