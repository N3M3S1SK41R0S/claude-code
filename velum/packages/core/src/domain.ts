/**
 * Contrat commun des modules VELUM (§4.2) : chaque domaine (`wine`, `coin`,
 * `art`, `stamp`) est un plugin qui implémente la même interface
 * `recognize()` / `analyze()` / `valuate()`. Tout module futur est additif.
 */
import type { FxRates, PriceObservation, PriceQuery, PriceSource, SourceRef, ValuationResult } from './pricing.ts';

export type VelumDomain = 'wine' | 'coin' | 'art' | 'stamp' | 'watch';

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
  | 'dial' // cadran (montre)
  | 'caseback' // fond de boîte (montre)
  | 'movement' // mouvement visible (montre)
  | 'clasp' // fermoir / boucle (montre)
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

/**
 * Fourchette de valeur INDICATIVE donnée par le modèle au scan éclair (en un
 * seul appel avec l'identification). Ce n'est JAMAIS une cote vérifiée : la
 * valorisation §7 (sources de marché, IC, fiabilité) reste la seule estimation
 * présentée comme telle. Montants en euros, `low` ≤ `high`.
 */
export interface QuickEstimate {
  low: number;
  high: number;
  currency: 'EUR';
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
  /**
   * Scan éclair : fourchette indicative du modèle (absente si le modèle ne
   * peut pas l'estimer honnêtement ou si l'identification est trop incertaine).
   */
  quickEstimate?: QuickEstimate;
  /**
   * Scan éclair : classement du général au précis, pour ranger l'objet
   * (ex. ['France', 'Cérès', '1849–1850'] ou ['Vin', 'Bordeaux', 'Pauillac']).
   */
  classification?: string[];
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

/**
 * Mode classeur — un objet détecté sur UNE photo de planche (page de classeur
 * de timbres, plateau de pièces…).
 */
export interface SheetDetection {
  /** Rang de lecture (0, 1, 2… de gauche à droite puis de haut en bas). */
  index: number;
  /** Position lisible sur la planche (ex. « rangée 2, case 3 »). */
  position?: string;
  /** Candidats de CET objet (au plus 3), triés par confiance décroissante. */
  candidates: Candidate[];
  /** true → identification trop incertaine : saisie assistée pour cet objet. */
  needsAssistedEntry: boolean;
}

/** Résultat de la reconnaissance d'une planche multi-objets. */
export interface SheetRecognitionResult {
  /** Objets détectés, au plus `MAX_SHEET_DETECTIONS`, dans l'ordre de lecture. */
  detections: SheetDetection[];
  stage: RecognitionStage;
  /**
   * true → la liste est INCOMPLÈTE (plus d'objets que la limite, ou réponse du
   * modèle coupée) : l'utilisateur doit photographier le reste séparément.
   */
  truncated: boolean;
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
  /**
   * Mode classeur (optionnel) : UNE photo de planche → plusieurs objets
   * détectés. Implémenté par les domaines où l'on range des séries entières
   * (timbres, pièces). Un domaine sans cette méthode refuse le mode planche.
   */
  recognizeSheet?(input: CaptureInput, deps: RecognizeDeps): Promise<SheetRecognitionResult>;
  analyze(candidate: Candidate, deps: AnalyzeDeps): Promise<AnalysisResult<TAnalysis>>;
  valuate(candidate: Candidate, deps: ValuateDeps): Promise<ValuationResult>;
  /** Construit la requête de prix normalisée pour les adaptateurs (§9). */
  buildPriceQuery(candidate: Candidate): PriceQuery;
}

// ── Scan éclair : bornes et coercition PARTAGÉES par tous les plugins ─────────
//
// Une seule source de vérité pour ce que les plugins acceptent du modèle et
// pour les budgets de sortie que l'Edge Function `recognize` fait respecter.

/** Sous ce seuil de confiance, on bascule sur la saisie assistée (§3.3). */
export const ASSISTED_ENTRY_THRESHOLD = 0.35;

/**
 * Budget de sortie de la reconnaissance d'UN objet. Sortie compacte : au plus
 * 3 candidats × ~150 tokens (libellé, attributs lus, fourchette, classement)
 * ≈ 450 tokens ; 768 garde une marge de ~70 % contre la troncature, tout en
 * plafonnant la génération (l'ancien budget de 1024 laissait le modèle
 * « raconter »). La réflexion Gemini est réservée EN PLUS (voir llm.ts).
 */
export const RECOGNITION_MAX_TOKENS = 768;

/** Nombre maximal d'objets restitués pour une planche (mode classeur). */
export const MAX_SHEET_DETECTIONS = 24;

/**
 * Budget de sortie d'une planche : 24 objets × ~110 tokens (2 candidats
 * compacts au plus par objet) ≈ 2 640 tokens, arrondi à 3 072. Au-delà, la
 * réponse est coupée : les objets complets sont conservés et `truncated` levé.
 */
export const SHEET_RECOGNITION_MAX_TOKENS = 3072;

/** Fourchette indicative montrée seulement au-dessus de cette confiance d'identification. */
export const QUICK_ESTIMATE_MIN_CONFIDENCE = ASSISTED_ENTRY_THRESHOLD;

/** Rapport haut/bas au-delà duquel une fourchette n'informe plus (écartée). */
export const QUICK_ESTIMATE_MAX_SPREAD = 100;

/** Plafond par défaut d'une fourchette (EUR) : au-delà, valeur aberrante écartée. */
export const QUICK_ESTIMATE_DEFAULT_MAX_EUR = 100_000_000;

/** Classement : niveaux et longueur maximale d'un niveau. */
export const CLASSIFICATION_MAX_LEVELS = 5;
const CLASSIFICATION_MAX_LEVEL_LENGTH = 60;

/**
 * Consignes de concision communes aux prompts de scan éclair (ajoutées au
 * schéma JSON propre à chaque domaine). Elles réduisent la sortie — donc la
 * latence — sans dégrader l'identification.
 */
export const QUICK_SCAN_OUTPUT_RULES = `Scan éclair — réponse COMPACTE et rapide :
- JSON minifié sur une seule ligne, aucune explication, aucun texte hors du JSON, pas de fences markdown.
- "label" court (≤ 60 caractères) ; n'inclus dans "attributes" QUE ce qui est lu ou déduit avec assurance : omets les clés inconnues (jamais de null ni de chaîne vide).
- "estimate" : fourchette INDICATIVE de valeur de marché en euros {"low":n,"high":n} pour un exemplaire dans l'état visible ; fourchette honnête (jamais artificiellement étroite) ; omets-la si tu ne peux pas l'estimer.
- "classification" : 2 à 4 niveaux, du plus général au plus précis.
- "confidence" entre 0 et 1, HONNÊTE : en cas de doute, baisse-la.`;

function toFiniteAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s/g, '').replace(',', '.').replace(/€$/, '');
    if (normalized === '') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coercition DÉFENSIVE d'une fourchette proposée par le modèle. Renvoie
 * `undefined` (jamais une valeur inventée) si : montants non numériques ou
 * négatifs, haut nul, devise autre que l'euro, valeur au-delà du plafond du
 * domaine, ou fourchette si large qu'elle n'informe plus. Bornes inversées →
 * remises dans l'ordre. Arrondi au centime.
 */
export function coerceQuickEstimate(
  raw: unknown,
  options: { maxEur?: number } = {},
): QuickEstimate | undefined {
  let lowRaw: unknown;
  let highRaw: unknown;
  if (Array.isArray(raw)) {
    [lowRaw, highRaw] = raw;
  } else if (isPlainRecord(raw)) {
    const currency = raw['currency'];
    if (currency !== undefined && (typeof currency !== 'string' || currency.trim().toUpperCase() !== 'EUR')) {
      return undefined;
    }
    lowRaw = raw['low'] ?? raw['min'];
    highRaw = raw['high'] ?? raw['max'];
  } else {
    return undefined;
  }
  const a = toFiniteAmount(lowRaw);
  const b = toFiniteAmount(highRaw);
  if (a === null || b === null || a < 0 || b < 0) return undefined;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const maxEur = options.maxEur ?? QUICK_ESTIMATE_DEFAULT_MAX_EUR;
  if (high <= 0 || high > maxEur) return undefined;
  if (low > 0 && high / low > QUICK_ESTIMATE_MAX_SPREAD) return undefined;
  const cents = (n: number) => Math.round(n * 100) / 100;
  return { low: cents(low), high: cents(high), currency: 'EUR' };
}

/**
 * Coercition DÉFENSIVE d'un classement : tableau de chaînes (ou chaîne
 * « A > B > C »), niveaux nettoyés, vides et doublons consécutifs retirés,
 * tronqué à `CLASSIFICATION_MAX_LEVELS`. `undefined` si rien d'exploitable.
 */
export function coerceClassification(raw: unknown): string[] | undefined {
  let parts: unknown[];
  if (Array.isArray(raw)) parts = raw;
  else if (typeof raw === 'string') parts = raw.split(/\s*(?:>|›|»|\/|\|)\s*/);
  else return undefined;
  const levels: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'string' && typeof part !== 'number') continue;
    const level = String(part).trim().replace(/\s+/g, ' ');
    if (level === '' || level.length > CLASSIFICATION_MAX_LEVEL_LENGTH) continue;
    if (levels.at(-1)?.toLowerCase() === level.toLowerCase()) continue;
    levels.push(level);
    if (levels.length === CLASSIFICATION_MAX_LEVELS) break;
  }
  return levels.length > 0 ? levels : undefined;
}

/**
 * Champs « scan éclair » d'une entrée candidat du modèle (`estimate` ou
 * `quickEstimate`, `classification`). La fourchette n'est conservée que si
 * l'identification est assez sûre : un prix pour un objet mal identifié serait
 * une fausse certitude.
 */
export function quickScanFields(
  entry: Record<string, unknown>,
  confidence: number,
  options: { maxEur?: number } = {},
): Pick<Candidate, 'quickEstimate' | 'classification'> {
  const out: Pick<Candidate, 'quickEstimate' | 'classification'> = {};
  if (confidence >= QUICK_ESTIMATE_MIN_CONFIDENCE) {
    const estimate = coerceQuickEstimate(entry['estimate'] ?? entry['quickEstimate'], options);
    if (estimate !== undefined) out.quickEstimate = estimate;
  }
  const classification = coerceClassification(entry['classification']);
  if (classification !== undefined) out.classification = classification;
  return out;
}

/** Détection de planche à partir de ses candidats (tri, top 3, saisie assistée). */
export function sheetDetectionFrom(
  index: number,
  candidates: Candidate[],
  position?: string,
): SheetDetection {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const best = sorted[0]?.confidence ?? 0;
  const trimmed = position?.trim();
  return {
    index,
    ...(trimmed ? { position: trimmed.slice(0, 80) } : {}),
    candidates: sorted,
    needsAssistedEntry: sorted.length === 0 || best < ASSISTED_ENTRY_THRESHOLD,
  };
}
