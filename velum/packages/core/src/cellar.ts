/**
 * Cave virtuelle (offre Gold+) — intelligence transversale mets ⇄ vins :
 *  - sens 1 : « je cuisine tel plat → quel vin DÉJÀ DANS MA CAVE ? » ;
 *  - sens 2 : « ce vin atteint son apogée → à boire, avec tel plat ».
 */

/** Vue d'un vin de la cave transmise au sommelier IA (données minimales). */
export interface CellarWineEntry {
  itemId: string;
  label: string;
  vintage?: number;
  region?: string;
  color?: string;
  /** Emplacement physique saisi par l'utilisateur (ex. "Casier B3"). */
  storageLocation?: string;
  drinkWindow?: { from: number; to: number };
  foodPairings?: string[];
  quantity?: number;
  /** Appellation (AOC/AOP, DOC…) si connue — affine l'appariement local. */
  appellation?: string;
  /** Noms des cépages si connus (ex. ["mourvèdre", "grenache"]). */
  grapes?: string[];
  /**
   * Situation du vin vis-à-vis de sa fenêtre d'apogée pour l'année en cours
   * (calculée côté serveur ou app, jamais par le modèle).
   */
  peakStatus?: DrinkWindowPhase;
}

/**
 * Urgence « à boire » d'un vin selon sa fenêtre d'apogée (année civile) :
 *  - 'past'    : fenêtre dépassée — à boire au plus vite ;
 *  - 'closing' : dernière année de la fenêtre ;
 *  - 'peak'    : dans la fenêtre ;
 *  - 'soon'    : entre dans la fenêtre l'an prochain.
 */
export type PeakStatus = 'past' | 'closing' | 'peak' | 'soon';

/**
 * Situation complète d'un vin : statut d'urgence, ou 'young' (apogée dans
 * deux ans ou plus) ou 'unknown' (fenêtre absente ou incohérente).
 */
export type DrinkWindowPhase = PeakStatus | 'young' | 'unknown';

/** Ligne de « Mes vins à leur apogée » : un vin de MA cave, avec sa position. */
export interface CellarPeakEntry {
  itemId: string;
  label: string;
  vintage?: number;
  color?: string;
  /** Emplacement physique (format canonique « Rangée 2 · Colonne 4 · Place 1 » ou texte libre). */
  storageLocation?: string;
  quantity?: number;
  windowFrom: number;
  windowTo: number;
  status: PeakStatus;
  /** 2–3 plats suggérés (accords mets-vins de l'analyse ZAPPA). */
  suggestedDishes: string[];
}

/** Rapport « à la demande » : vins à boire + vins exclus, comptés honnêtement. */
export interface CellarPeakReport {
  /** Année de référence du calcul. */
  year: number;
  /** Vins à boire, triés par urgence puis fin de fenêtre. */
  entries: CellarPeakEntry[];
  /** Vins encore en garde (apogée dans deux ans ou plus). */
  youngCount: number;
  /** Vins sans fenêtre connue (fiche complète absente) : on ne devine pas. */
  unknownWindowItemIds: string[];
}

/** Famille de vins de l'appariement local déterministe (sans IA). */
export type WineFamily =
  | 'white_crisp'
  | 'white_rich'
  | 'white_aromatic'
  | 'rose'
  | 'red_light'
  | 'red_medium'
  | 'red_structured'
  | 'sparkling'
  | 'sweet'
  | 'fortified';

/** Catégorie de plat reconnue par mots-clés. */
export type DishCategory =
  | 'shellfish'
  | 'fish'
  | 'poultry'
  | 'duck'
  | 'pork'
  | 'charcuterie'
  | 'veal'
  | 'red_meat'
  | 'lamb'
  | 'game'
  | 'goat_cheese'
  | 'blue_cheese'
  | 'hard_cheese'
  | 'soft_cheese'
  | 'alpine_cheese'
  | 'cheese'
  | 'foie_gras'
  | 'spicy_asian'
  | 'north_african'
  | 'alsatian'
  | 'pasta_pizza'
  | 'risotto'
  | 'mushroom'
  | 'grill'
  | 'vegetable'
  | 'aperitif'
  | 'fruit_dessert'
  | 'chocolate';

/** Suggestion locale « plat → vin de ma cave » (instantanée, hors-ligne). */
export interface LocalPairingSuggestion {
  itemId: string;
  label: string;
  vintage?: number;
  storageLocation?: string;
  quantity?: number;
  /** Pertinence 0..1 — plafonnée : un calcul par règles n'est jamais certain. */
  score: number;
  /** Famille retenue pour ce vin (null si le style n'a pas pu être déduit). */
  family: WineFamily | null;
  /** Catégorie du plat qui justifie l'accord, si reconnue. */
  dishCategory: DishCategory | null;
  /** Accord ZAPPA du vin qui recoupe le plat, s'il existe. */
  matchedPairing?: string;
  peakStatus: DrinkWindowPhase;
  /** Raison courte, en français. */
  reason: string;
}

/** Résultat de l'appariement local déterministe. */
export interface LocalPairingResult {
  dish: string;
  /** Catégories reconnues (vide = plat non reconnu par les règles). */
  categories: DishCategory[];
  /** Familles recherchées, de la plus adaptée à la moins adaptée. */
  wantedFamilies: WineFamily[];
  /** Top 3 des vins de la cave jugés convenables (peut être vide). */
  suggestions: LocalPairingSuggestion[];
  /** Styles / appellations à acheter si rien ne convient en cave. */
  purchaseIdeas: string[];
}

export interface PairingRequest {
  /** Le plat du soir, en texte libre (ex. "magret de canard aux figues"). */
  dish: string;
  cellar: CellarWineEntry[];
  locale?: string;
}

export interface PairingRecommendation {
  /** Toujours un item réellement présent dans la cave (anti-hallucination). */
  itemId: string;
  label: string;
  /** Pertinence de l'accord, 0..1. */
  score: number;
  /** Justification sommelier en une ou deux phrases. */
  reasoning: string;
  /** Conseil de service (température, carafage…). */
  serveAt?: string;
}

export interface PairingResult {
  recommendations: PairingRecommendation[];
  /** Si rien ne convient dans la cave : conseil d'achat ou de repli. */
  fallbackAdvice?: string;
}

/** Sens 2 — vin à l'apogée : alerte « à boire » + plats suggérés. */
export interface DrinkNowSuggestion {
  itemId: string;
  label: string;
  vintage?: number;
  windowFrom: number;
  windowTo: number;
  /** Accords mets-vins issus de l'analyse ZAPPA stockée. */
  suggestedDishes: string[];
}
