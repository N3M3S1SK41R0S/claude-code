/**
 * Fiche d'analyse VELUM Philatélie — moteur `phila_v1`.
 * Module à part entière (décision produit juillet 2026) : timbres, blocs,
 * carnets. Références catalogues : Yvert & Tellier, Michel, Stanley Gibbons,
 * Scott ; sources marché : Delcampe, eBay sold, Catawiki, Colnect.
 */

export type StampCentering = 'parfait' | 'bon' | 'decale' | 'tres_decale';

export interface StampAttributes {
  country?: string;
  /** Numéro de catalogue principal (ex. "YT 1234", "Scott C3a"). */
  catalogNumber?: string;
  catalog?: 'yvert_tellier' | 'michel' | 'stanley_gibbons' | 'scott' | 'autre';
  title?: string; // sujet / série
  year?: number;
  faceValue?: string; // valeur faciale telle qu'imprimée
  color?: string;
  /** Dentelure (ex. "14 × 13½") — critère d'identification des variétés. */
  perforation?: string;
  watermark?: string; // filigrane
  printingMethod?: string; // taille-douce, typographie, héliogravure…
}

/** État philatélique — détermine fortement la cote. */
export interface StampCondition {
  /** Neuf sans charnière (**), neuf avec charnière (*), oblitéré (o), sur lettre. */
  status: 'neuf_sans_charniere' | 'neuf_avec_charniere' | 'oblitere' | 'sur_lettre' | 'inconnu';
  gum?: 'intacte' | 'alteree' | 'sans_gomme' | 'inconnue';
  centering?: StampCentering;
  faults: string[]; // aminci, pli, dent courte, rousseurs…
  confidence: number; // 0..1
  caveat: string; // réserve : estimation visuelle ≠ expertise (Calves, Brun…)
}

export interface StampAnalysisPayload {
  identification: StampAttributes;
  condition: StampCondition;
  rarity: { level: 'courante' | 'peu_courante' | 'rare' | 'tres_rare' | 'inconnue'; note?: string };
  varieties: string[]; // variétés, erreurs d'impression, nuances
  neighborIssues?: { catalogNumber: string; note: string }[];
  uncertainties: string[];
}
