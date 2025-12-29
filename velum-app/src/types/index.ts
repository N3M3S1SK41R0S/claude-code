/**
 * VELUM - Types & Interfaces
 * Version corrigée avec types stricts et documentation JSDoc
 */

// ============================================================================
// ENUMS
// ============================================================================

/** Vue active de l'application */
export enum AppView {
  HOME = 'HOME',
  SCAN = 'SCAN',
  COLLECTION = 'COLLECTION',
  GALLERY = 'GALLERY',
  MARKET = 'MARKET',
  STUDIO = 'STUDIO',
  CHAT = 'CHAT',
  AUCTION = 'AUCTION',
  SOCIAL = 'SOCIAL'
}

/** Types de collections supportées */
export enum CollectionType {
  STAMP = 'STAMP',
  COIN = 'COIN',
  WINE = 'WINE',
  ART = 'ART'
}

// ============================================================================
// TYPE ALIASES
// ============================================================================

/** Rang du collectionneur basé sur son expérience */
export type HeritageRank =
  | 'NOVICE'
  | 'INITIATE'
  | 'CURATOR'
  | 'ARCHIVIST'
  | 'KEEPER_OF_TIME'
  | 'GRAND_MASTER';

/** Tendance du marché */
export type MarketTrend = 'UP' | 'DOWN' | 'STABLE';

/** Sévérité d'une incohérence historique */
export type InconsistencySeverity = 'LOW' | 'MEDIUM' | 'CRITICAL';

/** Recommandation d'investissement */
export type InvestmentRating = 'BUY' | 'HOLD' | 'SELL';

/** Niveau de volatilité */
export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'EXTREME';

/** Niveau de demande globale */
export type GlobalDemand = 'LOW' | 'MEDIUM' | 'HIGH' | 'FRENZY';

/** Plateformes sociales supportées */
export type SocialPlatform = 'TIKTOK' | 'LINKEDIN' | 'INSTAGRAM';

/** Type de lieu pour les enchères */
export type AuctionLocationType = 'AUCTION_HOUSE' | 'DEALER';

/** Types de tâches pour le routage des modèles */
export type TaskType =
  | 'expert-analysis'
  | 'financial-thesis'
  | 'complex-reasoning'
  | 'creative-writing'
  | 'social-content'
  | 'search'
  | 'quick-scan'
  | 'object-detection'
  | 'image-generation';

// ============================================================================
// INTERFACES - Analysis
// ============================================================================

/** Marqueur d'authenticité détecté par l'IA */
export interface AuthenticityMarker {
  /** Libellé du marqueur */
  label: string;
  /** Description détaillée */
  description: string;
  /** Score de confiance (0-100) */
  confidence: number;
}

/** Incohérence historique détectée */
export interface HistoricalInconsistency {
  /** Description du problème */
  issue: string;
  /** Niveau de sévérité */
  severity: InconsistencySeverity;
  /** Raisonnement de l'IA */
  reasoning: string;
}

/** Défaut visuel pour la heatmap */
export interface VisualFlaw {
  /** Position X en pourcentage (0-100) */
  x: number;
  /** Position Y en pourcentage (0-100) */
  y: number;
  /** Description du défaut */
  label: string;
}

/** Analyse complète par l'IA */
export interface AIAnalysis {
  /** Score d'authenticité (0-100) */
  authenticityScore: number;
  /** Avertissement de fraude éventuel */
  fraudWarning?: string;
  /** Index de rareté (ex: "R3", "Exceptionnel") */
  rarityIndex: string;
  /** Tendance du marché */
  marketTrend: MarketTrend;
  /** Valeur estimée minimum en euros */
  estimatedValueMin: number;
  /** Valeur estimée maximum en euros */
  estimatedValueMax: number;
  /** Contexte historique de l'objet */
  historicalContext: string;
  /** Provenance de l'objet */
  provenance: string;
  /** Conseils de préservation */
  preservationAdvice: string;
  /** Anecdote intéressante */
  funFact?: string;
  /** Marqueurs d'authenticité */
  authenticityMarkers: AuthenticityMarker[];
  /** Incohérences historiques détectées */
  historicalInconsistencies: HistoricalInconsistency[];
  /** Défauts visuels pour la heatmap */
  visualFlaws: VisualFlaw[];
  /** Rapport textuel complet */
  report?: string;
}

// ============================================================================
// INTERFACES - Financial
// ============================================================================

/** Thèse d'investissement générée par l'IA */
export interface FinancialThesis {
  /** Recommandation d'investissement */
  investmentRating: InvestmentRating;
  /** Niveau de volatilité */
  volatility: VolatilityLevel;
  /** Score de liquidité (0-100) */
  liquidityScore: number;
  /** Projection ROI à 5 ans */
  roiProjection5Years: string;
  /** Indication fiscale */
  taxImplicationHint: string;
  /** Raisonnement détaillé */
  reasoning: string;
}

// ============================================================================
// INTERFACES - Social
// ============================================================================

/** Contenu social généré */
export interface SocialContent {
  /** Accroche virale */
  viralHook: string;
  /** Hashtags recommandés */
  hashtagStack: string[];
  /** Script pour story */
  storyScript: string;
  /** Plateforme cible */
  platform: SocialPlatform;
  /** URL de la vidéo de fond générée (Veo) */
  generatedVideoBg?: string;
}

// ============================================================================
// INTERFACES - Auction
// ============================================================================

/** Listing concurrent détecté */
export interface CompetitorListing {
  /** Titre de l'annonce */
  title: string;
  /** Prix affiché */
  price: string;
  /** Lien vers l'annonce */
  link: string;
}

/** Lieu d'enchère/vente */
export interface AuctionLocation {
  /** Nom du lieu */
  name: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Type de lieu */
  type: AuctionLocationType;
}

/** Stratégie d'enchère générée */
export interface AuctionStrategy {
  /** Prix cible recommandé */
  targetPrice: number;
  /** Meilleure plateforme de vente */
  bestPlatform: string;
  /** Meilleur moment pour vendre */
  bestTimeToSend: string;
  /** Accroche marketing */
  marketingHook: string;
  /** Niveau de demande globale */
  globalDemand: GlobalDemand;
  /** Listings concurrents détectés */
  competitorListings: CompetitorListing[];
  /** Lieux physiques recommandés */
  locations: AuctionLocation[];
}

// ============================================================================
// INTERFACES - Collector Item
// ============================================================================

/** Données d'origine géographique */
export interface OriginData {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Nom du lieu */
  locationName: string;
}

/** Rapport d'expertise */
export interface ExpertAnalysisReport {
  /** Rapport textuel */
  report: string;
  /** Sources utilisées */
  sources: Array<{ title: string; uri: string }>;
  /** Timestamp de l'analyse */
  timestamp: string;
  /** Données d'analyse approfondie */
  deepData: AIAnalysis;
}

/** Item de collection principal */
export interface CollectorItem {
  /** Identifiant unique */
  id: string;
  /** Type de collection */
  type: CollectionType;
  /** Titre/nom de l'objet */
  title: string;
  /** Pays d'origine */
  country: string;
  /** Année de création/émission */
  year: number;
  /** État de conservation */
  condition: string;
  /** Valeur estimée en euros */
  value: number;
  /** URL de l'image originale */
  imageUrl: string;
  /** Description de l'objet */
  description: string;
  /** Indique si l'objet est à vendre */
  isForSale: boolean;

  // Champs enrichis par l'IA (optionnels)
  /** URL de l'image restaurée par IA */
  restoredImageUrl?: string;
  /** URL de la vidéo Veo générée */
  veoVideoUrl?: string;
  /** URL de l'audio biographie */
  biographyAudioUrl?: string;
  /** URL de l'arrière-plan d'époque */
  eraBackgroundUrl?: string;

  /** Rapport d'expertise complet */
  expertAnalysis?: ExpertAnalysisReport;
  /** Thèse financière */
  financials?: FinancialThesis;
  /** Données sociales */
  socialData?: SocialContent;
  /** Stratégie d'enchère */
  auctionData?: AuctionStrategy;
  /** Données d'origine */
  originData?: OriginData;

  /** Couleur thème adaptative (hex) */
  themeColor?: string;
  /** Tags de catégorisation */
  tags?: string[];
}

// ============================================================================
// INTERFACES - Chat
// ============================================================================

/** Source de grounding */
export interface GroundingSource {
  web?: {
    title: string;
    uri: string;
  };
  maps?: {
    title: string;
    uri: string;
    address?: string;
  };
}

/** Message de chat */
export interface ChatMessage {
  /** Identifiant unique */
  id: string;
  /** Rôle (user ou ai) */
  role: 'user' | 'ai';
  /** Contenu textuel */
  text: string;
  /** Timestamp */
  timestamp: Date;
  /** Sources de grounding (si recherche) */
  sources?: GroundingSource[];
  /** Indique si le message est en cours de streaming */
  isStreaming?: boolean;
}

// ============================================================================
// INTERFACES - API Responses
// ============================================================================

/** Réponse générique de l'API Gemini */
export interface GeminiResponse<T = unknown> {
  /** Données de la réponse */
  data: T;
  /** Sources de grounding */
  sources?: GroundingSource[];
  /** Texte brut */
  text?: string;
}

/** Réponse d'erreur */
export interface APIError {
  /** Code d'erreur */
  code: string;
  /** Message d'erreur */
  message: string;
  /** ID de requête pour le debugging */
  requestId?: string;
}

// ============================================================================
// INTERFACES - UI State
// ============================================================================

/** État du scanner */
export interface ScannerState {
  /** Indique si le scanner est actif */
  isActive: boolean;
  /** Label AR détecté */
  arLabel: string;
  /** Indique si une analyse est en cours */
  isAnalyzing: boolean;
  /** Défauts détectés */
  flaws: VisualFlaw[];
  /** Erreur éventuelle */
  error?: string;
}

/** État du Live Assistant */
export interface LiveAssistantState {
  /** Statut de connexion */
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Message de statut */
  statusMessage: string;
  /** Niveau de volume (0-1) */
  volume: number;
  /** Indique si l'assistant parle */
  isSpeaking: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Rend certaines propriétés optionnelles */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Crée un type pour la création d'un item (sans id) */
export type CreateCollectorItem = Omit<CollectorItem, 'id'>;

/** Type pour les mises à jour partielles */
export type UpdateCollectorItem = Partial<Omit<CollectorItem, 'id'>> & { id: string };
