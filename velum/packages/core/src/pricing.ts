/**
 * Types du moteur de valorisation (§7) et contrat des sources de prix (§9).
 * Toute source externe (Wine-Searcher, Numista, Artprice, eBay sold…)
 * s'intègre via `PriceSource` — l'ajout d'une source est un adaptateur,
 * le cœur du moteur ne change jamais.
 */

/** Nature d'une observation de prix — détermine son poids initial (§7.4). */
export type SourceKind =
  | 'auction_realized' // ventes réalisées maisons de vente (Drouot/Heritage)  → 1.0
  | 'official_quote' // cotes officielles (PCGS/NGC/Artprice/Wine-Searcher pro) → 0.9
  | 'marketplace_sold' // ventes conclues marketplaces (eBay sold, Catawiki)     → 0.7
  | 'listing'; // annonces en cours (prix demandés)                              → 0.4

/** Poids initiaux par type de source (§7.4) — calibrables sans toucher au moteur. */
export const DEFAULT_SOURCE_WEIGHTS: Record<SourceKind, number> = {
  auction_realized: 1.0,
  official_quote: 0.9,
  marketplace_sold: 0.7,
  listing: 0.4,
};

export interface SourceRef {
  /** Nom lisible de la source (ex. "eBay sold", "Wine-Searcher"). */
  name: string;
  kind: SourceKind;
  url?: string;
}

/** Une observation de prix normalisée, prête pour le moteur §7. */
export interface PriceObservation {
  price: number;
  /** Code ISO 4217 (EUR, USD, GBP…). */
  currency: string;
  /** Ancienneté de l'observation en jours (0 = aujourd'hui). */
  ageDays: number;
  /** Poids de fiabilité de la source, 0..1 (§7.4). */
  sourceWeight: number;
  source: SourceRef;
  /** Libellé de l'objet tel que vu par la source (traçabilité). */
  matchedLabel?: string;
}

/** Requête envoyée aux adaptateurs de sources. */
export interface PriceQuery {
  domain: 'wine' | 'coin' | 'art' | 'stamp';
  /** Libellé canonique de l'objet (ex. "Clos Rougeard Le Bourg 2014"). */
  label: string;
  /** Attributs structurés du candidat (millésime, atelier, artiste…). */
  attributes: Record<string, unknown>;
  /** État/grade si pertinent (ex. "TTB", "MS65", "bon état"). */
  condition?: string;
  /** Nombre max d'observations souhaité. */
  limit?: number;
}

/** Contrat d'intégration d'une source de prix (§9). */
export interface PriceSource {
  readonly name: string;
  readonly kind: SourceKind;
  /** Poids spécifique ; à défaut, DEFAULT_SOURCE_WEIGHTS[kind]. */
  readonly weight?: number;
  fetch(query: PriceQuery): Promise<PriceObservation[]>;
}

/** Taux de change vers EUR : 1 unité de `currency` = fx[currency] EUR. */
export type FxRates = Record<string, number>;

export interface ValuationResult {
  /** Valeur centrale (médiane pondérée), arrondie, en EUR. */
  central: number;
  /** Intervalle de confiance 80 % [bas, haut] en EUR. */
  ci80: [number, number];
  /** Intervalle de confiance 95 % [bas, haut] en EUR. */
  ci95: [number, number];
  /** Nombre d'observations conservées après rejet des outliers. */
  nSources: number;
  /** Score de fiabilité de l'estimation, 0..100 (§7.2-5). */
  reliability: number;
  currency: 'EUR';
  /** Observations conservées — traçabilité affichée à l'utilisateur. */
  observations: PriceObservation[];
}
