/**
 * Contrat commun des modules VELUM (§4.2) : chaque domaine (`wine`, `coin`,
 * `art`, `stamp`) est un plugin qui implémente la même interface
 * `recognize()` / `analyze()` / `valuate()`. Tout module futur est additif.
 */
import type { FxRates, PriceObservation, PriceQuery, PriceSource, SourceRef, ValuationResult } from './pricing';

export type VelumDomain = 'wine' | 'coin' | 'art' | 'stamp';

/** Rôle d'un cliché — guide de cadrage par domaine (§6.1.2). */
export type MediaRole =
  | 'label' // étiquette (vin)
  | 'capsule' // capsule (vin)
  | 'obverse' // avers (pièce)
  | 'reverse' // revers (pièce)
  | 'edge' // tranche (pièce)
  | 'front' // œuvre complète (tableau)
  | 'back' // verso / étiquettes de dos (tableau)
  | 'signature' // détail signature (tableau)
  | 'frame' // cadre (tableau)
  | 'detail'; // détail libre

export interface CaptureMedia {
  role: MediaRole;
  /** Chemin dans Supabase Storage (jamais d'URL signée persistée). */
  storagePath: string;
  /** Data URL base64 éphémère pour l'appel vision (jamais stockée). */
  base64?: string;
}

/** Entrée universelle de capture (§6.1.2) : photo(s), texte libre ou inventaire. */
export interface CaptureInput {
  kind: 'photo' | 'text' | 'file';
  media?: CaptureMedia[];
  /** Saisie libre, éventuellement imprécise ("pièce argent Napoléon"). */
  text?: string;
  /** Lignes d'un import CSV/Excel/JSON déjà parsé. */
  fileRows?: Record<string, unknown>[];
  locale?: string;
}

/** Un candidat d'identification (écran « Candidats », §6.1.3). */
export interface Candidate {
  id: string;
  domain: VelumDomain;
  /** Libellé lisible (ex. "Château Margaux 2015", "5 Francs Semeuse 1960"). */
  label: string;
  /** Confiance 0..1 — TOUJOURS affichée, jamais de fausse certitude (§3.3). */
  confidence: number;
  thumbnailUrl?: string;
  /** Attributs structurés spécifiques au domaine (→ items.attributes JSONB). */
  attributes: Record<string, unknown>;
}

/** Étage du pipeline de reconnaissance ayant produit le résultat (§10.1). */
export type RecognitionStage =
  | 'llm_vision'
  | 'vector_similarity'
  | 'catalog_api'
  | 'community'
  | 'assisted';

export interface RecognitionResult {
  /** Top-3 (au plus) trié par confiance décroissante. */
  candidates: Candidate[];
  stage: RecognitionStage;
  /** true → basculer sur la saisie assistée (§3.3). */
  needsAssistedEntry: boolean;
}

export interface AnalysisResult<TPayload = Record<string, unknown>> {
  /** Moteur ayant produit la fiche : 'zappa_vini' | 'numis_v1' | 'art_v1'. */
  engine: string;
  /** Fiche structurée normalisée (→ analyses.payload JSONB). */
  payload: TPayload;
  /** Confiance globale 0..1. */
  confidence: number;
  sources: SourceRef[];
  /** Avertissements obligatoires (estimation indicative, pas d'authentification…). */
  disclaimers: string[];
}

// ── Dépendances injectées (testabilité : aucun plugin n'appelle le réseau en dur) ──

/** Abstraction du LLM multimodal (Claude/Gemini vision) — étage 1 (§10.1). */
export interface VisionModel {
  /**
   * Envoie images + prompt, attend un JSON structuré.
   * L'implémentation serveur (Edge Function) porte la clé API.
   */
  complete(req: {
    system: string;
    prompt: string;
    images?: { base64: string; mediaType: string }[];
    maxTokens?: number;
  }): Promise<string>;
}

/** Abstraction de l'index vectoriel (Qdrant) — étage 2 (§10.1). */
export interface VectorIndex {
  searchSimilar(req: {
    collection: string;
    embedding: number[];
    limit: number;
  }): Promise<{ id: string; score: number; payload: Record<string, unknown> }[]>;
}

export interface RecognizeDeps {
  vision: VisionModel;
  vectorIndex?: VectorIndex;
}

export interface AnalyzeDeps {
  vision: VisionModel;
}

export interface ValuateDeps {
  sources: PriceSource[];
  fx: FxRates;
  /** Moteur §7 injecté (implémentation : @velum/valuation). */
  valuate(obs: PriceObservation[], fx: FxRates): ValuationResult;
}

/**
 * LE contrat de module, implémenté par les 4 domaines :
 * `wine`, `coin`, `art` et `stamp` (philatélie, module à part entière).
 */
export interface DomainPlugin<TAnalysis = Record<string, unknown>> {
  readonly domain: VelumDomain;
  recognize(input: CaptureInput, deps: RecognizeDeps): Promise<RecognitionResult>;
  analyze(candidate: Candidate, deps: AnalyzeDeps): Promise<AnalysisResult<TAnalysis>>;
  valuate(candidate: Candidate, deps: ValuateDeps): Promise<ValuationResult>;
  /** Construit la requête de prix normalisée pour les adaptateurs (§9). */
  buildPriceQuery(candidate: Candidate): PriceQuery;
}
