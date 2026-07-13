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
