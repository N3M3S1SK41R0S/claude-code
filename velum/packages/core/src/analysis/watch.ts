/**
 * Fiche d'analyse VELUM Montres — moteur `watch_v1` (horlogerie de collection,
 * hommes et femmes). Produite par l'Edge Function `analyze-watch`.
 *
 * Couvre les exigences produit (juillet 2026) : spécifications complètes,
 * mécanisme (mouvement/calibre/complications), histoire du modèle (pourquoi
 * il a été créé, par qui), historique de production, état. Les DERNIÈRES
 * TRANSACTIONS vivent dans les observations de la valorisation §7
 * (`ValuationRecord.sources`) — ventes réelles attribuées à leur source
 * (Heritage, eBay vendu, Catawiki, Chrono24…), affichées sur la fiche.
 *
 * PRUDENCE : jamais d'authentification ferme — l'horlogerie de collection est
 * un marché à contrefaçons ; toute valeur significative renvoie à un
 * horloger/expert (mêmes principes que l'art, §3.3).
 */
import type { HeritageProfile } from './heritage.ts';

/** Spécifications d'identification de la montre. */
export interface WatchAttributes {
  brand?: string; // Rolex, Omega, Cartier…
  model?: string; // Submariner, Speedmaster, Tank…
  /** Référence constructeur (ex. "124060", "311.30.42.30.01.005"). */
  reference?: string;
  year?: number; // année de production (ou estimée)
  gender?: 'homme' | 'femme' | 'mixte';
  caseMaterial?: string; // acier, or jaune, titane, céramique…
  caseDiameterMm?: number;
  dialColor?: string;
  bracelet?: string; // oyster acier, cuir, NATO…
  /** Verre : saphir, plexiglas, minéral… */
  crystal?: string;
  waterResistanceM?: number;
  /** Coffret et papiers d'origine présents (full set) — pèse sur la cote. */
  boxPapers?: 'full_set' | 'boite_seule' | 'papiers_seuls' | 'montre_seule' | 'inconnu';
  limitedEdition?: string; // ex. "édition limitée 1957 ex."
}

/** Mécanisme — le cœur de la montre. */
export interface WatchMovement {
  /** Type de mouvement. */
  type: 'automatique' | 'manuel' | 'quartz' | 'squelette' | 'inconnu';
  /** Calibre (ex. "Rolex 3235", "Omega 1861", "ETA 2824-2"). */
  calibre?: string;
  powerReserveHours?: number;
  /** Fréquence en alternances/heure (ex. 28800). */
  frequencyVph?: number;
  jewels?: number;
  /** Complications : date, chronographe, GMT, phase de lune, tourbillon… */
  complications: string[];
  /** Certification : chronomètre COSC, Master Chronometer, poinçon de Genève… */
  certification?: string;
  note?: string;
}

/**
 * Histoire du MODÈLE : pourquoi il a été créé, par qui, dans quel contexte.
 * Complète `HeritageProfile` (récit, rareté, production) avec les champs
 * propres à l'horlogerie.
 */
export interface WatchStory {
  /** Pourquoi ce modèle a été créé (plongée, aviation, course, cadeau royal…). */
  why?: string;
  /** Par qui : fondateur, designer, directeur technique (ex. "Gérald Genta"). */
  byWhom?: string;
  /** Année de lancement du modèle (≠ année de production de l'exemplaire). */
  modelLaunchYear?: number;
  /** Jalons du modèle : évolutions de référence, calibres, faits marquants. */
  milestones?: { year: number; note: string }[];
}

/** État de l'exemplaire — détermine fortement la cote. */
export interface WatchCondition {
  summary: string;
  /** Historique d'entretien connu (révisions, remplacements). */
  serviceHistory?: string;
  /** Boîtier repoli (fait baisser la cote des montres de collection). */
  polished?: 'non' | 'leger' | 'important' | 'inconnu';
  /** Pièces non d'origine détectées/suspectées (cadran, aiguilles, lunette…). */
  nonOriginalParts?: string[];
  issues: string[]; // rayures, oxydation, lume abîmé…
  confidence: number; // 0..1
  /** Réserve : estimation visuelle ≠ ouverture du boîtier par un horloger. */
  caveat: string;
}

export interface WatchAnalysisPayload {
  identification: WatchAttributes;
  movement: WatchMovement;
  condition: WatchCondition;
  /** Histoire du modèle : pourquoi, par qui, jalons. */
  story: WatchStory;
  /** Récit patrimonial, rareté, volume de production (contrat partagé). */
  heritage?: HeritageProfile;
  /** Références voisines (autres générations du même modèle). */
  neighborReferences?: { reference: string; note: string }[];
  /** Garde-fous : incertitudes signalées explicitement (jamais vide de sens). */
  uncertainties: string[];
}
