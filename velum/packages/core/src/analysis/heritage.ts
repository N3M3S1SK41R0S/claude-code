/**
 * Profil patrimonial partagé aux 4 modules — surface l'HISTOIRE, la RARETÉ et le
 * NOMBRE D'EXEMPLAIRES d'un objet sur sa fiche. Renseigné par les moteurs
 * d'analyse (`analyze-wine|coin|stamp|art`) à partir des catalogues et sources
 * de référence. Les DERNIÈRES VENTES, elles, vivent dans les observations de la
 * valorisation (§7, `ValuationRecord.sources`) — ce sont des ventes réelles
 * attribuées à leur source (iDealwine, Numista, Delcampe, Heritage, eBay vendu…).
 */

/** Rareté qualitative, du plus courant au plus exceptionnel. */
export type RarityLevel =
  | 'courante'
  | 'peu_courante'
  | 'rare'
  | 'tres_rare'
  | 'exceptionnelle'
  | 'inconnue';

/**
 * Nombre d'exemplaires connus/estimés : tirage (pièces, timbres), production
 * (vin), édition/épreuves (art). `unit` est une clé i18n (`edition.unit.*`).
 */
export interface EditionSize {
  count?: number;
  /** Clé d'unité i18n : 'exemplaires' | 'bottles' | 'stamps' | 'prints' | 'unique'. */
  unit: string;
  /** Précision libre : « tirage », « production estimée », « œuvre unique »… */
  note?: string;
}

export interface HeritageProfile {
  /** Récit : histoire et contexte (domaine, émission, règne, artiste, série). */
  history?: string;
  rarity?: { level: RarityLevel; note?: string };
  editionSize?: EditionSize;
}
