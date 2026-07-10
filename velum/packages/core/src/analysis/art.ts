/**
 * Fiche d'analyse VELUM Tableaux (§6.4) — moteur `art_v1`.
 * PRUDENCE ATTRIBUTION : jamais d'authentification ferme ; hypothèses
 * qualifiées + recommandation d'expertise humaine pour toute valeur significative.
 */

export type AttributionQualifier =
  | 'attribue_a' // attribué à
  | 'entourage_de'
  | 'ecole_de'
  | 'd_apres'
  | 'signe' // signature détectée et cohérente
  | 'anonyme';

export interface ArtAttributes {
  artist?: string;
  attributionQualifier?: AttributionQualifier;
  title?: string;
  technique?: string; // huile sur toile, aquarelle…
  support?: string;
  dimensionsCm?: { height: number; width: number };
  estimatedPeriod?: string; // ex. "fin XIXe"
  school?: string; // école / mouvement
  signatureDetected?: boolean;
}

export interface ArtAnalysisPayload {
  identification: ArtAttributes;
  condition: { summary: string; issues: string[] };
  provenance: { evidence: string[]; note?: string };
  comparables: { description: string; note?: string }[];
  /** Toujours non vide : « estimation indicative, pas une expertise légale ». */
  uncertainties: string[];
  expertiseRecommended: boolean;
}
