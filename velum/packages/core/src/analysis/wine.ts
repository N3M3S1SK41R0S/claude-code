/**
 * Fiche d'analyse VELUM Vin — structure de sortie du moteur ZAPPA∴VINI∴SAPIENS
 * (7 modules, §6.2.2). Produite par l'Edge Function `analyze-wine`.
 */

export interface WineAttributes {
  producer?: string;
  appellation?: string;
  cuvee?: string;
  vintage?: number;
  color?: 'rouge' | 'blanc' | 'rosé' | 'orange' | 'effervescent';
  grapes?: { name: string; percent?: number }[];
  farming?: 'conventionnel' | 'bio' | 'biodynamie' | 'HVE' | 'nature' | 'inconnu';
  region?: string;
  country?: string;
  format?: string; // '750ml', 'magnum'…
}

/** Module 2 — caractéristiques œnologiques. */
export interface WineTastingProfile {
  robe: string;
  nose: string[];
  palate: { structure: string; tannins?: string; acidity: string; alcohol?: string };
  length: string;
  agingPotentialYears: [number, number];
  drinkWindow: { from: number; to: number };
}

/** Module 3 — évaluation qualitative multi-niveaux. */
export interface WineRatings {
  rvf?: string;
  bettaneDesseauve?: string;
  parker?: string;
  suckling?: string;
  jancisRobinson?: string;
  awards?: string[];
  positioning: 'confidentiel' | 'star_montante' | 'classique' | 'collector' | 'inconnu';
}

/** Module 4 — valeur marché & spéculation. */
export interface WineMarket {
  averagePriceEUR?: number;
  priceTrend?: { horizonYears: 3 | 5 | 10; direction: 'hausse' | 'stable' | 'baisse'; note?: string }[];
  marketTension?: 'faible' | 'moyenne' | 'forte';
  /** Score spéculatif /10 — INFORMATIF, jamais un conseil d'investissement (§12.4). */
  speculativeScore?: number;
  assetClass: 'conso' | 'cave' | 'speculation' | 'collection';
}

/** Module 5 — analyse comparative. */
export interface WineComparisons {
  neighborVintages?: { vintage: number; note: string }[];
  regionalEquivalents?: string[];
  fallbackSuggestions?: string[];
  foodPairings: string[];
}

export interface WineAnalysisPayload {
  identification: WineAttributes & { homonymNote?: string };
  tasting: WineTastingProfile;
  ratings: WineRatings;
  market: WineMarket;
  comparisons: WineComparisons;
  /** Module 7 — garde-fous : incertitudes signalées explicitement. */
  uncertainties: string[];
}
