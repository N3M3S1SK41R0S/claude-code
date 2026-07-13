/** Fiche d'analyse VELUM Pièces (§6.3) — moteur `numis_v1`. */
import type { HeritageProfile } from './heritage.ts';

export interface CoinAttributes {
  country?: string;
  issuer?: string; // autorité émettrice
  type?: string; // ex. "5 Francs Semeuse"
  year?: number;
  mintMark?: string; // atelier
  metal?: string;
  weightGrams?: number;
  diameterMm?: number;
  mintage?: number; // tirage
  numistaId?: string;
}

/**
 * Grade proposé automatiquement — TOUJOURS avec réserve : une estimation
 * visuelle ne remplace pas une gradation professionnelle (PCGS/NGC).
 */
export interface CoinGrade {
  /** Échelle française (B, TB, TTB, SUP, SPL, FDC) ou Sheldon (VG8…MS70). */
  scale: 'fr' | 'sheldon';
  value: string;
  confidence: number; // 0..1
  caveat: string;
}

export interface CoinAnalysisPayload {
  identification: CoinAttributes;
  grade: CoinGrade;
  rarity: { level: 'courante' | 'peu_courante' | 'rare' | 'tres_rare' | 'inconnue'; note?: string };
  varieties: string[]; // variantes & erreurs de frappe notables
  neighborYears?: { year: number; note: string }[];
  /** Contexte historique (règne, atelier, série) + tirage détaillé. */
  heritage?: HeritageProfile;
  uncertainties: string[];
}
