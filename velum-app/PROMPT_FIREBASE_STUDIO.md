# PROMPT COMPLET POUR FIREBASE STUDIO / GOOGLE IDX

## Instructions Initiales

Copie ce prompt en entier dans Firebase Studio pour créer l'application VELUM.

---

# CRÉER L'APPLICATION VELUM - Expertise d'Objets de Collection avec IA Gemini

## Description du Projet

Crée une application React + TypeScript appelée **VELUM** - une application d'expertise et d'authentification d'objets de collection utilisant l'IA Gemini. L'application permet aux collectionneurs d'analyser, authentifier et gérer leurs objets précieux.

## Stack Technique

- **Framework**: React 18 avec TypeScript strict
- **Build Tool**: Vite
- **Styling**: Tailwind CSS avec thème sombre luxueux (or/noir)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **AI**: Google Gemini API (@google/genai)
- **Fonts**: Cinzel (titres), Cormorant Garamond (serif), Inter (sans)

## Structure des Fichiers à Créer

```
src/
├── index.tsx
├── App.tsx
├── types/index.ts
├── services/
│   ├── geminiConfig.ts
│   ├── geminiService.ts
│   ├── liveService.ts
│   └── audioEngine.ts
├── components/
│   ├── Animations.tsx
│   ├── Shared.tsx
│   ├── Toast.tsx
│   ├── Scanner.tsx
│   ├── ChatBot.tsx
│   ├── LiveAssistant.tsx
│   ├── AuctionRoom.tsx
│   ├── MapsView.tsx
│   ├── VirtualGallery.tsx
│   └── CreativeStudio.tsx
└── utils/
    ├── imageCompressor.ts
    ├── rateLimiter.ts
    └── geminiOptimizer.ts
public/
└── index.html
```

---

## FICHIER 1: src/types/index.ts

```typescript
/**
 * VELUM - Types et Interfaces
 * Définitions TypeScript pour l'application de collection
 */

// ============================================================================
// ENUMS ET CONSTANTES
// ============================================================================

export type TaskType =
  | 'analysis'
  | 'financial'
  | 'restoration'
  | 'video'
  | 'image'
  | 'chat'
  | 'live'
  | 'auction'
  | 'maps'
  | 'creative';

export type MarketTrend = 'rising' | 'stable' | 'declining' | 'volatile';
export type InvestmentRating = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type ConditionGrade = 'mint' | 'excellent' | 'good' | 'fair' | 'poor';
export type AuthenticityStatus = 'authentic' | 'likely_authentic' | 'uncertain' | 'likely_fake' | 'fake';

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

export interface CollectorItem {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  currentEstimate?: number;
  condition?: ConditionGrade;
  provenance?: string;
  notes?: string;
  tags?: string[];
  analysis?: AIAnalysis;
  financialThesis?: FinancialThesis;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysis {
  id: string;
  itemId: string;
  timestamp: string;
  authenticity: AuthenticityConfidence;
  period: PeriodEstimate;
  materials: MaterialAnalysis[];
  craftsmanship: CraftsmanshipAnalysis;
  condition: ConditionAnalysis;
  provenance: ProvenanceAnalysis;
  comparables: ComparableItem[];
  summary: string;
  confidence: number;
  modelUsed: string;
  thinkingProcess?: string;
}

export interface AuthenticityConfidence {
  status: AuthenticityStatus;
  confidence: number;
  indicators: AuthenticityIndicator[];
  concerns: string[];
}

export interface AuthenticityIndicator {
  aspect: string;
  finding: string;
  supports: boolean;
  weight: number;
}

export interface PeriodEstimate {
  era: string;
  dateRange: { start: number; end: number };
  confidence: number;
  styleIndicators: string[];
}

export interface MaterialAnalysis {
  material: string;
  location: string;
  quality: string;
  authenticity: number;
  notes: string;
}

export interface CraftsmanshipAnalysis {
  technique: string;
  quality: number;
  origin: string;
  signatures: string[];
  toolMarks: string[];
}

export interface ConditionAnalysis {
  grade: ConditionGrade;
  score: number;
  issues: ConditionIssue[];
  restorations: string[];
  recommendations: string[];
}

export interface ConditionIssue {
  type: string;
  severity: 'minor' | 'moderate' | 'major';
  location: string;
  description: string;
  repairCost?: number;
}

export interface ProvenanceAnalysis {
  knownHistory: ProvenanceEntry[];
  gaps: string[];
  redFlags: string[];
  verificationSuggestions: string[];
}

export interface ProvenanceEntry {
  period: string;
  owner?: string;
  location?: string;
  documentation?: string;
  confidence: number;
}

export interface ComparableItem {
  description: string;
  salePrice: number;
  saleDate: string;
  auctionHouse?: string;
  condition: string;
  relevance: number;
}

// ============================================================================
// FINANCIAL TYPES
// ============================================================================

export interface FinancialThesis {
  id: string;
  itemId: string;
  timestamp: string;
  valuation: ValuationAnalysis;
  marketAnalysis: MarketAnalysis;
  investmentMetrics: InvestmentMetrics;
  scenarios: InvestmentScenario[];
  recommendation: InvestmentRecommendation;
  risks: RiskFactor[];
  catalysts: Catalyst[];
  thinkingProcess?: string;
}

export interface ValuationAnalysis {
  currentValue: number;
  currency: string;
  methodology: string;
  comparables: ValuationComparable[];
  adjustments: ValuationAdjustment[];
  range: { low: number; mid: number; high: number };
  confidence: number;
}

export interface ValuationComparable {
  description: string;
  price: number;
  date: string;
  adjustmentFactor: number;
  reasoning: string;
}

export interface ValuationAdjustment {
  factor: string;
  impact: number;
  reasoning: string;
}

export interface MarketAnalysis {
  segment: string;
  size: number;
  growth: number;
  trend: MarketTrend;
  drivers: string[];
  headwinds: string[];
  keyPlayers: string[];
  recentActivity: string;
}

export interface InvestmentMetrics {
  expectedReturn: number;
  timeHorizon: string;
  volatility: number;
  sharpeRatio?: number;
  liquidity: 'high' | 'medium' | 'low';
  correlationToMarket: number;
}

export interface InvestmentScenario {
  name: string;
  probability: number;
  returnRange: { low: number; high: number };
  triggers: string[];
  timeline: string;
}

export interface InvestmentRecommendation {
  rating: InvestmentRating;
  targetPrice: number;
  timeframe: string;
  conviction: number;
  rationale: string;
  actionItems: string[];
}

export interface RiskFactor {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
  probability: number;
}

export interface Catalyst {
  event: string;
  expectedDate?: string;
  impact: 'positive' | 'negative';
  magnitude: number;
  probability: number;
}

// ============================================================================
// AUCTION TYPES
// ============================================================================

export interface AuctionStrategy {
  itemId: string;
  timestamp: string;
  marketContext: AuctionMarketContext;
  biddingStrategy: BiddingStrategy;
  logistics: AuctionLogistics;
  alternatives: AuctionAlternative[];
  thinkingProcess?: string;
}

export interface AuctionMarketContext {
  upcomingAuctions: UpcomingAuction[];
  recentResults: AuctionResult[];
  marketSentiment: string;
  seasonality: string;
}

export interface UpcomingAuction {
  house: string;
  date: string;
  location: string;
  specialty: string;
  estimatedTotal: number;
  relevantLots: number;
}

export interface AuctionResult {
  house: string;
  date: string;
  item: string;
  estimate: { low: number; high: number };
  hammer: number;
  premium: number;
  notes: string;
}

export interface BiddingStrategy {
  recommendedVenue: string;
  timing: string;
  maxBid: number;
  openingStrategy: string;
  tactics: string[];
  walkAwayPrice: number;
  reasoning: string;
}

export interface AuctionLogistics {
  viewingDates: string[];
  registrationDeadline: string;
  depositRequired: number;
  buyersPremium: number;
  shippingOptions: string[];
  insuranceNotes: string;
}

export interface AuctionAlternative {
  venue: string;
  type: 'auction' | 'dealer' | 'private';
  pros: string[];
  cons: string[];
  estimatedNet: number;
}

// ============================================================================
// CHAT & LIVE TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  sources?: SearchSource[];
  error?: string;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface LiveSession {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startTime?: string;
  transcript: TranscriptEntry[];
  currentItem?: CollectorItem;
}

export interface TranscriptEntry {
  timestamp: string;
  speaker: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
}

// ============================================================================
// CREATIVE TYPES
// ============================================================================

export interface CreativeProject {
  id: string;
  type: 'image' | 'video' | 'restoration' | 'documentary';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: CreativeInput;
  output?: CreativeOutput;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface CreativeInput {
  prompt: string;
  sourceImage?: string;
  style?: string;
  duration?: number;
  aspectRatio?: string;
  additionalParams?: Record<string, unknown>;
}

export interface CreativeOutput {
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

export type ViewType =
  | 'collection'
  | 'scanner'
  | 'chat'
  | 'live'
  | 'auction'
  | 'maps'
  | 'gallery'
  | 'creative'
  | 'detail';

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}
```

---

## FICHIER 2: src/services/geminiConfig.ts

```typescript
/**
 * VELUM - Configuration Gemini
 * Configuration centralisée pour les modèles Gemini AI
 */

import type { TaskType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelConfig {
  name: string;
  displayName: string;
  maxTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  costPer1kTokens: number;
}

export interface GenerationConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  thinkingBudget?: number;
}

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const MODELS: Record<string, ModelConfig> = {
  flash: {
    name: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash',
    maxTokens: 8192,
    supportsThinking: false,
    supportsVision: true,
    supportsAudio: true,
    costPer1kTokens: 0.1
  },
  thinking: {
    name: 'gemini-2.0-flash-thinking-exp-01-21',
    displayName: 'Gemini 2.0 Thinking',
    maxTokens: 32768,
    supportsThinking: true,
    supportsVision: true,
    supportsAudio: false,
    costPer1kTokens: 0.15
  },
  pro: {
    name: 'gemini-1.5-pro-latest',
    displayName: 'Gemini 1.5 Pro',
    maxTokens: 8192,
    supportsThinking: false,
    supportsVision: true,
    supportsAudio: true,
    costPer1kTokens: 0.25
  },
  imagen: {
    name: 'imagen-3.0-generate-002',
    displayName: 'Imagen 3',
    maxTokens: 0,
    supportsThinking: false,
    supportsVision: false,
    supportsAudio: false,
    costPer1kTokens: 5.0
  },
  veo: {
    name: 'veo-2.0-generate-001',
    displayName: 'Veo 2',
    maxTokens: 0,
    supportsThinking: false,
    supportsVision: false,
    supportsAudio: false,
    costPer1kTokens: 50.0
  },
  live: {
    name: 'gemini-2.0-flash-live-001',
    displayName: 'Gemini Live',
    maxTokens: 4096,
    supportsThinking: false,
    supportsVision: true,
    supportsAudio: true,
    costPer1kTokens: 0.2
  }
} as const;

// ============================================================================
// TASK CONFIGURATIONS
// ============================================================================

const TASK_MODEL_MAP: Record<TaskType, keyof typeof MODELS> = {
  analysis: 'thinking',
  financial: 'thinking',
  restoration: 'flash',
  video: 'veo',
  image: 'imagen',
  chat: 'flash',
  live: 'live',
  auction: 'thinking',
  maps: 'flash',
  creative: 'flash'
};

const THINKING_BUDGETS: Partial<Record<TaskType, number>> = {
  analysis: 24576,
  financial: 24576,
  auction: 16384
};

// ============================================================================
// GENERATION CONFIGS
// ============================================================================

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192
};

export const TASK_GENERATION_CONFIGS: Partial<Record<TaskType, Partial<GenerationConfig>>> = {
  analysis: {
    temperature: 0.3,
    maxOutputTokens: 16384
  },
  financial: {
    temperature: 0.2,
    maxOutputTokens: 16384
  },
  chat: {
    temperature: 0.8,
    maxOutputTokens: 4096
  },
  creative: {
    temperature: 0.9,
    maxOutputTokens: 2048
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getModelForTask(task: TaskType): ModelConfig {
  const modelKey = TASK_MODEL_MAP[task];
  return MODELS[modelKey];
}

export function getThinkingBudgetForTask(task: TaskType): number | undefined {
  return THINKING_BUDGETS[task];
}

export function getGenerationConfigForTask(task: TaskType): GenerationConfig {
  const taskConfig = TASK_GENERATION_CONFIGS[task] || {};
  const thinkingBudget = getThinkingBudgetForTask(task);

  return {
    ...DEFAULT_GENERATION_CONFIG,
    ...taskConfig,
    ...(thinkingBudget ? { thinkingBudget } : {})
  };
}

export function supportsThinking(task: TaskType): boolean {
  const model = getModelForTask(task);
  return model.supportsThinking;
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const SYSTEM_PROMPTS = {
  analysis: `Tu es VELUM, un expert mondial en authentification et expertise d'objets de collection.
Tu analyses avec une précision scientifique les matériaux, techniques, styles et provenances.
Tu fournis des analyses détaillées en JSON structuré.
Tu es honnête sur les incertitudes et signales les éléments suspects.`,

  financial: `Tu es VELUM, un analyste financier spécialisé dans le marché de l'art et des collectibles.
Tu produis des thèses d'investissement rigoureuses basées sur les données de marché.
Tu évalues les risques et opportunités avec objectivité.
Format de sortie: JSON structuré avec métriques précises.`,

  chat: `Tu es VELUM, un assistant expert en objets de collection.
Tu réponds de manière concise et précise aux questions sur l'art et les antiquités.
Tu cites tes sources quand pertinent.
Tu admets quand tu ne sais pas.`,

  auction: `Tu es VELUM, un conseiller stratégique pour les enchères d'art.
Tu connais les maisons de vente, leurs spécialités et le calendrier des ventes.
Tu fournis des stratégies d'enchères optimales et des alternatives.`,

  creative: `Tu es VELUM, un directeur artistique spécialisé dans la mise en valeur d'objets de collection.
Tu génères des descriptions créatives et des prompts pour la création d'images.`
} as const;

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  baseUrl: 'https://generativelanguage.googleapis.com',
  version: 'v1beta',
  timeout: 120000,
  retryAttempts: 3,
  retryDelay: 1000
} as const;

export const RATE_LIMITS = {
  flash: { rpm: 100, tpm: 1000000 },
  thinking: { rpm: 60, tpm: 500000 },
  pro: { rpm: 60, tpm: 500000 },
  imagen: { rpm: 10, tpm: 0 },
  veo: { rpm: 5, tpm: 0 },
  live: { connections: 10 }
} as const;
```

---

## FICHIER 3: src/services/geminiService.ts

```typescript
/**
 * VELUM - Service Gemini
 * Service principal pour les appels à l'API Gemini
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  MODELS,
  SYSTEM_PROMPTS,
  getModelForTask,
  getGenerationConfigForTask,
  getThinkingBudgetForTask
} from './geminiConfig';
import type {
  CollectorItem,
  AIAnalysis,
  FinancialThesis,
  AuctionStrategy,
  ChatMessage,
  SearchSource,
  TaskType
} from '../types';

// ============================================================================
// INITIALIZATION
// ============================================================================

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = (window as { GEMINI_API_KEY?: string }).GEMINI_API_KEY ||
                   import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Clé API Gemini non configurée. Définissez VITE_GEMINI_API_KEY.');
    }

    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const objectURLs = new Set<string>();

export function createObjectURL(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  objectURLs.add(url);
  return url;
}

export function revokeObjectURL(url: string): void {
  if (objectURLs.has(url)) {
    URL.revokeObjectURL(url);
    objectURLs.delete(url);
  }
}

export function revokeAllObjectURLs(): void {
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  objectURLs.clear();
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable = lastError.message.includes('503') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('UNAVAILABLE');

      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }

      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function safeJSONParse<T>(text: string, fallback: T): T {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr) as T;
    }
    return fallback;
  } catch {
    console.warn('[GeminiService] Échec du parsing JSON');
    return fallback;
  }
}

function extractBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

export async function performDeepAnalysis(
  imageBase64: string,
  itemInfo?: Partial<CollectorItem>
): Promise<AIAnalysis> {
  const genAI = getAI();
  const model = getModelForTask('analysis');
  const config = getGenerationConfigForTask('analysis');
  const thinkingBudget = getThinkingBudgetForTask('analysis');

  const prompt = `Analyse cet objet de collection en détail.
${itemInfo?.name ? `Nom: ${itemInfo.name}` : ''}
${itemInfo?.category ? `Catégorie: ${itemInfo.category}` : ''}
${itemInfo?.description ? `Description: ${itemInfo.description}` : ''}

Fournis une analyse complète en JSON avec:
- authenticity: { status, confidence, indicators[], concerns[] }
- period: { era, dateRange: { start, end }, confidence, styleIndicators[] }
- materials: [{ material, location, quality, authenticity, notes }]
- craftsmanship: { technique, quality (0-100), origin, signatures[], toolMarks[] }
- condition: { grade, score, issues[], restorations[], recommendations[] }
- provenance: { knownHistory[], gaps[], redFlags[], verificationSuggestions[] }
- comparables: [{ description, salePrice, saleDate, condition, relevance }]
- summary: résumé de 2-3 phrases
- confidence: score global 0-100`;

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: model.name,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: extractBase64(imageBase64) } }
        ]
      }],
      config: {
        systemInstruction: SYSTEM_PROMPTS.analysis,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        ...(thinkingBudget ? {
          thinkingConfig: { thinkingBudget }
        } : {})
      }
    });
  });

  const text = response.text || '';
  const thinkingText = response.candidates?.[0]?.content?.parts?.find(
    (p: { thought?: boolean }) => p.thought
  )?.text;

  const analysis = safeJSONParse<Partial<AIAnalysis>>(text, {});

  return {
    id: crypto.randomUUID(),
    itemId: itemInfo?.id || '',
    timestamp: new Date().toISOString(),
    authenticity: analysis.authenticity || {
      status: 'uncertain',
      confidence: 0,
      indicators: [],
      concerns: ['Analyse incomplète']
    },
    period: analysis.period || {
      era: 'Indéterminée',
      dateRange: { start: 0, end: 0 },
      confidence: 0,
      styleIndicators: []
    },
    materials: analysis.materials || [],
    craftsmanship: analysis.craftsmanship || {
      technique: '',
      quality: 0,
      origin: '',
      signatures: [],
      toolMarks: []
    },
    condition: analysis.condition || {
      grade: 'fair',
      score: 50,
      issues: [],
      restorations: [],
      recommendations: []
    },
    provenance: analysis.provenance || {
      knownHistory: [],
      gaps: [],
      redFlags: [],
      verificationSuggestions: []
    },
    comparables: analysis.comparables || [],
    summary: analysis.summary || 'Analyse en cours...',
    confidence: analysis.confidence || 0,
    modelUsed: model.name,
    thinkingProcess: thinkingText
  };
}

// ============================================================================
// FINANCIAL FUNCTIONS
// ============================================================================

export async function generateFinancialThesis(
  item: CollectorItem,
  analysis?: AIAnalysis
): Promise<FinancialThesis> {
  const genAI = getAI();
  const model = getModelForTask('financial');
  const config = getGenerationConfigForTask('financial');
  const thinkingBudget = getThinkingBudgetForTask('financial');

  const prompt = `Génère une thèse d'investissement pour cet objet de collection:

Objet: ${item.name}
Catégorie: ${item.category}
Description: ${item.description}
${item.acquisitionPrice ? `Prix d'acquisition: ${item.acquisitionPrice}€` : ''}
${analysis ? `
Analyse:
- Authenticité: ${analysis.authenticity.status} (${analysis.authenticity.confidence}%)
- Période: ${analysis.period.era}
- Condition: ${analysis.condition.grade}
` : ''}

Fournis une thèse complète en JSON:
- valuation: { currentValue, methodology, range: { low, mid, high }, confidence }
- marketAnalysis: { segment, size, growth, trend, drivers[], headwinds[] }
- investmentMetrics: { expectedReturn, timeHorizon, volatility, liquidity }
- scenarios: [{ name, probability, returnRange, triggers[], timeline }]
- recommendation: { rating, targetPrice, timeframe, conviction, rationale }
- risks: [{ category, description, severity, mitigation, probability }]
- catalysts: [{ event, impact, magnitude, probability }]`;

  const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [{
    role: 'user',
    parts: [{ text: prompt }]
  }];

  if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
    contents[0].parts.push({
      inlineData: { mimeType: 'image/jpeg', data: extractBase64(item.imageUrl) }
    });
  }

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: model.name,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPTS.financial,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        ...(thinkingBudget ? {
          thinkingConfig: { thinkingBudget }
        } : {})
      }
    });
  });

  const text = response.text || '';
  const thesis = safeJSONParse<Partial<FinancialThesis>>(text, {});

  return {
    id: crypto.randomUUID(),
    itemId: item.id,
    timestamp: new Date().toISOString(),
    valuation: thesis.valuation || {
      currentValue: 0,
      currency: 'EUR',
      methodology: '',
      comparables: [],
      adjustments: [],
      range: { low: 0, mid: 0, high: 0 },
      confidence: 0
    },
    marketAnalysis: thesis.marketAnalysis || {
      segment: '',
      size: 0,
      growth: 0,
      trend: 'stable',
      drivers: [],
      headwinds: [],
      keyPlayers: [],
      recentActivity: ''
    },
    investmentMetrics: thesis.investmentMetrics || {
      expectedReturn: 0,
      timeHorizon: '',
      volatility: 0,
      liquidity: 'medium',
      correlationToMarket: 0
    },
    scenarios: thesis.scenarios || [],
    recommendation: thesis.recommendation || {
      rating: 'hold',
      targetPrice: 0,
      timeframe: '',
      conviction: 0,
      rationale: '',
      actionItems: []
    },
    risks: thesis.risks || [],
    catalysts: thesis.catalysts || []
  };
}

// ============================================================================
// AUCTION STRATEGY
// ============================================================================

export async function generateAuctionStrategy(
  item: CollectorItem,
  userLocation?: { lat: number; lng: number },
  budget?: number
): Promise<AuctionStrategy> {
  const genAI = getAI();
  const model = getModelForTask('auction');
  const config = getGenerationConfigForTask('auction');

  const prompt = `Élabore une stratégie d'enchères pour cet objet:

Objet: ${item.name}
Catégorie: ${item.category}
${item.currentEstimate ? `Estimation: ${item.currentEstimate}€` : ''}
${budget ? `Budget max: ${budget}€` : ''}
${userLocation ? `Localisation: ${userLocation.lat}, ${userLocation.lng}` : ''}

Fournis une stratégie en JSON:
- marketContext: { upcomingAuctions[], recentResults[], marketSentiment, seasonality }
- biddingStrategy: { recommendedVenue, timing, maxBid, openingStrategy, tactics[], walkAwayPrice, reasoning }
- logistics: { viewingDates[], registrationDeadline, depositRequired, buyersPremium, shippingOptions[] }
- alternatives: [{ venue, type, pros[], cons[], estimatedNet }]`;

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: model.name,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPTS.auction,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    });
  });

  const text = response.text || '';
  const strategy = safeJSONParse<Partial<AuctionStrategy>>(text, {});

  return {
    itemId: item.id,
    timestamp: new Date().toISOString(),
    marketContext: strategy.marketContext || {
      upcomingAuctions: [],
      recentResults: [],
      marketSentiment: '',
      seasonality: ''
    },
    biddingStrategy: strategy.biddingStrategy || {
      recommendedVenue: '',
      timing: '',
      maxBid: 0,
      openingStrategy: '',
      tactics: [],
      walkAwayPrice: 0,
      reasoning: ''
    },
    logistics: strategy.logistics || {
      viewingDates: [],
      registrationDeadline: '',
      depositRequired: 0,
      buyersPremium: 0,
      shippingOptions: [],
      insuranceNotes: ''
    },
    alternatives: strategy.alternatives || []
  };
}

// ============================================================================
// CHAT FUNCTIONS
// ============================================================================

export async function* chatWithGemini(
  messages: ChatMessage[],
  currentItem?: CollectorItem
): AsyncGenerator<string, void, unknown> {
  const genAI = getAI();
  const model = getModelForTask('chat');
  const config = getGenerationConfigForTask('chat');

  const systemContext = currentItem
    ? `${SYSTEM_PROMPTS.chat}\n\nContexte - Objet actuel:\nNom: ${currentItem.name}\nCatégorie: ${currentItem.category}\nDescription: ${currentItem.description}`
    : SYSTEM_PROMPTS.chat;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const response = await genAI.models.generateContentStream({
    model: model.name,
    contents,
    config: {
      systemInstruction: systemContext,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens
    }
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}

// ============================================================================
// GROUNDED SEARCH
// ============================================================================

export async function groundedSearch(
  query: string
): Promise<{ text: string; sources: SearchSource[] }> {
  const genAI = getAI();
  const model = getModelForTask('chat');

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: model.name,
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
  });

  const text = response.text || '';
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  const sources: SearchSource[] = groundingMetadata?.groundingChunks?.map(
    (chunk: { web?: { uri?: string; title?: string }; retrievedContext?: { text?: string } }) => ({
      title: chunk.web?.title || 'Source',
      url: chunk.web?.uri || '',
      snippet: chunk.retrievedContext?.text || ''
    })
  ) || [];

  return { text, sources };
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export async function generateProImage(
  prompt: string,
  style?: string
): Promise<string> {
  const genAI = getAI();

  const enhancedPrompt = style
    ? `${prompt}. Style: ${style}. Haute qualité, détaillé, professionnel.`
    : `${prompt}. Haute qualité, détaillé, professionnel.`;

  const response = await withRetry(async () => {
    return await genAI.models.generateImages({
      model: MODELS.imagen.name,
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg'
      }
    });
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) {
    throw new Error('Aucune image générée');
  }

  const base64 = typeof image.image.imageBytes === 'string'
    ? image.image.imageBytes
    : btoa(String.fromCharCode(...new Uint8Array(image.image.imageBytes)));

  return `data:image/jpeg;base64,${base64}`;
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

export async function generateVeoVideo(
  prompt: string,
  imageBase64?: string
): Promise<string> {
  const genAI = getAI();

  const request: {
    model: string;
    prompt: string;
    config: { aspectRatio: string; durationSeconds: number };
    image?: { imageBytes: string; mimeType: string };
  } = {
    model: MODELS.veo.name,
    prompt: `${prompt}. Cinématique, haute qualité, mouvement fluide.`,
    config: {
      aspectRatio: '16:9',
      durationSeconds: 5
    }
  };

  if (imageBase64) {
    request.image = {
      imageBytes: extractBase64(imageBase64),
      mimeType: 'image/jpeg'
    };
  }

  const operation = await withRetry(async () => {
    return await genAI.models.generateVideos(request);
  });

  // Poll for completion
  let result = operation;
  while (!result.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    result = await genAI.operations.get({ operation: result.name });
  }

  const video = result.response?.generatedVideos?.[0];
  if (!video?.video?.uri) {
    throw new Error('Aucune vidéo générée');
  }

  return video.video.uri;
}

// ============================================================================
// TTS
// ============================================================================

export async function generateSpeech(
  text: string,
  voice: string = 'Puck'
): Promise<ArrayBuffer> {
  const genAI = getAI();

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error('Aucun audio généré');
  }

  const binaryString = atob(audioData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

// ============================================================================
// OBJECT DETECTION (STREAMING)
// ============================================================================

export async function* detectObjectStream(
  imageBase64: string
): AsyncGenerator<string, void, unknown> {
  const genAI = getAI();
  const model = getModelForTask('chat');

  const prompt = `Identifie et décris l'objet dans cette image.
Fournis:
1. Type d'objet
2. Époque probable
3. Origine géographique
4. Matériaux visibles
5. État de conservation
6. Valeur estimée (fourchette)
7. Points d'attention pour l'authentification`;

  const response = await genAI.models.generateContentStream({
    model: model.name,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: extractBase64(imageBase64) } }
      ]
    }],
    config: {
      temperature: 0.5,
      maxOutputTokens: 2048
    }
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}

// ============================================================================
// MAPS GROUNDING
// ============================================================================

export async function groundedMapsSearch(
  query: string,
  location?: { lat: number; lng: number }
): Promise<{ text: string; sources: SearchSource[] }> {
  const genAI = getAI();
  const model = getModelForTask('maps');

  const enhancedQuery = location
    ? `${query} près de ${location.lat}, ${location.lng}`
    : query;

  const response = await withRetry(async () => {
    return await genAI.models.generateContent({
      model: model.name,
      contents: [{ role: 'user', parts: [{ text: enhancedQuery }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
  });

  const text = response.text || '';
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  const sources: SearchSource[] = groundingMetadata?.groundingChunks?.map(
    (chunk: { web?: { uri?: string; title?: string }; retrievedContext?: { text?: string } }) => ({
      title: chunk.web?.title || 'Source',
      url: chunk.web?.uri || '',
      snippet: chunk.retrievedContext?.text || ''
    })
  ) || [];

  return { text, sources };
}
```

---

## FICHIER 4: src/services/liveService.ts

```typescript
/**
 * VELUM - Service Live
 * Gestion de l'API Gemini Live pour conversations audio en temps réel
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { MODELS, SYSTEM_PROMPTS } from './geminiConfig';

// ============================================================================
// TYPES
// ============================================================================

export type LiveServiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting';

export interface LiveServiceCallbacks {
  onStatusChange?: (status: LiveServiceStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudioOutput?: (audioData: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

interface LiveSession {
  send: (data: { media?: { chunks: string[] }; text?: string }) => void;
  receive: () => AsyncIterable<{ text?: string; data?: string; serverContent?: { interrupted?: boolean } }>;
  close: () => void;
}

// ============================================================================
// LIVE SERVICE CLASS
// ============================================================================

class LiveService {
  private session: LiveSession | null = null;
  private status: LiveServiceStatus = 'idle';
  private callbacks: LiveServiceCallbacks = {};
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private isProcessing = false;

  /**
   * Configure les callbacks
   */
  setCallbacks(callbacks: LiveServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Met à jour le statut et notifie
   */
  private setStatus(newStatus: LiveServiceStatus): void {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  /**
   * Obtient le statut actuel
   */
  getStatus(): LiveServiceStatus {
    return this.status;
  }

  /**
   * Connecte au service Live
   */
  async connect(systemContext?: string): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    try {
      const apiKey = (window as { GEMINI_API_KEY?: string }).GEMINI_API_KEY ||
                     import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('Clé API Gemini non configurée');
      }

      const ai = new GoogleGenAI({ apiKey });

      this.session = await ai.live.connect({
        model: MODELS.live.name,
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          systemInstruction: systemContext || SYSTEM_PROMPTS.chat,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          }
        }
      });

      this.setStatus('connected');
      this.reconnectAttempts = 0;

      // Démarrer l'écoute des réponses
      this.startReceiving();

    } catch (error) {
      this.setStatus('error');
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );

      // Tenter une reconnexion
      this.attemptReconnect(systemContext);
    }
  }

  /**
   * Tente une reconnexion automatique
   */
  private async attemptReconnect(systemContext?: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[LiveService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.setStatus('reconnecting');

    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    await this.connect(systemContext);
  }

  /**
   * Démarre la réception des messages
   */
  private async startReceiving(): Promise<void> {
    if (!this.session) return;

    try {
      for await (const message of this.session.receive()) {
        // Interruption serveur
        if (message.serverContent?.interrupted) {
          continue;
        }

        // Texte
        if (message.text) {
          this.callbacks.onTranscript?.(message.text, true);
        }

        // Audio
        if (message.data) {
          const binaryString = atob(message.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          this.callbacks.onAudioOutput?.(bytes.buffer);
        }
      }
    } catch (error) {
      if (this.status === 'connected') {
        this.callbacks.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
        this.attemptReconnect();
      }
    }
  }

  /**
   * Démarre l'envoi audio depuis le microphone
   */
  async startAudioInput(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Note: ScriptProcessorNode est déprécié, préférer AudioWorklet en production
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.session || this.status !== 'connected') return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

        this.session.send({
          media: { chunks: [base64] }
        });
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isProcessing = true;

    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error('Erreur d\'accès au microphone')
      );
    }
  }

  /**
   * Arrête l'entrée audio
   */
  stopAudioInput(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isProcessing = false;
  }

  /**
   * Envoie un message texte
   */
  sendText(text: string): void {
    if (!this.session || this.status !== 'connected') {
      throw new Error('Session non connectée');
    }

    this.session.send({ text });
  }

  /**
   * Déconnecte la session
   */
  disconnect(): void {
    this.stopAudioInput();

    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Ignorer les erreurs de fermeture
      }
      this.session = null;
    }

    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Vérifie si le service est connecté
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const liveService = new LiveService();
```

---

## FICHIER 5: src/services/audioEngine.ts

```typescript
/**
 * VELUM - Moteur Audio
 * Gestion de la lecture audio avec cache LRU
 */

// ============================================================================
// TYPES
// ============================================================================

export type AudioEngineState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface CacheEntry {
  buffer: AudioBuffer;
  size: number;
  lastAccess: number;
}

type StateListener = (state: AudioEngineState) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CACHE_ENTRIES = 50;

// ============================================================================
// AUDIO ENGINE CLASS
// ============================================================================

class AudioEngine {
  private context: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private cache = new Map<string, CacheEntry>();
  private cacheSize = 0;
  private state: AudioEngineState = 'idle';
  private stateListeners = new Set<StateListener>();

  /**
   * Initialise le contexte audio
   */
  private getContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    return this.context;
  }

  /**
   * Met à jour l'état et notifie les listeners
   */
  private setState(newState: AudioEngineState): void {
    this.state = newState;
    this.stateListeners.forEach(listener => listener(newState));
  }

  /**
   * Ajoute un listener d'état
   */
  addStateListener(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Obtient l'état actuel
   */
  getState(): AudioEngineState {
    return this.state;
  }

  /**
   * Génère une clé de cache
   */
  private getCacheKey(text: string, voice: string): string {
    let hash = 0;
    const str = `${text}:${voice}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Éviction LRU du cache
   */
  private evictCache(neededSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (this.cacheSize - freedSpace + neededSpace <= MAX_CACHE_SIZE &&
          this.cache.size <= MAX_CACHE_ENTRIES) {
        break;
      }

      this.cache.delete(key);
      freedSpace += entry.size;
    }

    this.cacheSize -= freedSpace;
  }

  /**
   * Ajoute un buffer au cache
   */
  private addToCache(key: string, buffer: AudioBuffer): void {
    const size = buffer.length * buffer.numberOfChannels * 4;

    if (size > MAX_CACHE_SIZE) {
      return;
    }

    if (this.cacheSize + size > MAX_CACHE_SIZE || this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictCache(size);
    }

    this.cache.set(key, {
      buffer,
      size,
      lastAccess: Date.now()
    });

    this.cacheSize += size;
  }

  /**
   * Récupère un buffer du cache
   */
  private getFromCache(key: string): AudioBuffer | null {
    const entry = this.cache.get(key);

    if (entry) {
      entry.lastAccess = Date.now();
      return entry.buffer;
    }

    return null;
  }

  /**
   * Joue un ArrayBuffer audio
   */
  async play(audioData: ArrayBuffer, cacheKey?: string): Promise<void> {
    this.stop();
    this.setState('loading');

    try {
      const context = this.getContext();
      let buffer: AudioBuffer;

      if (cacheKey) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          buffer = cached;
        } else {
          buffer = await context.decodeAudioData(audioData.slice(0));
          this.addToCache(cacheKey, buffer);
        }
      } else {
        buffer = await context.decodeAudioData(audioData.slice(0));
      }

      this.currentSource = context.createBufferSource();
      this.currentSource.buffer = buffer;
      this.currentSource.connect(context.destination);

      this.currentSource.onended = () => {
        this.currentSource = null;
        this.setState('idle');
      };

      this.currentSource.start(0);
      this.setState('playing');

    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Arrête la lecture
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignorer les erreurs si déjà arrêté
      }
      this.currentSource = null;
    }
    this.setState('idle');
  }

  /**
   * Pause/Resume
   */
  async togglePause(): Promise<void> {
    const context = this.getContext();

    if (context.state === 'running') {
      await context.suspend();
      this.setState('paused');
    } else if (context.state === 'suspended') {
      await context.resume();
      this.setState('playing');
    }
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Obtient les stats du cache
   */
  getCacheStats(): { entries: number; size: number; maxSize: number } {
    return {
      entries: this.cache.size,
      size: this.cacheSize,
      maxSize: MAX_CACHE_SIZE
    };
  }

  /**
   * Libère les ressources
   */
  dispose(): void {
    this.stop();
    this.clearCache();
    this.stateListeners.clear();

    if (this.context && this.context.state !== 'closed') {
      this.context.close();
      this.context = null;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const audioEngine = new AudioEngine();
```

---

## FICHIER 6: src/components/Shared.tsx

```typescript
/**
 * VELUM - Composants Partagés
 * Composants UI réutilisables avec accessibilité
 */

import React, { useId, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// VELUM LOGO
// ============================================================================

interface VelumLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const VelumLogo: React.FC<VelumLogoProps> = ({
  size = 'md',
  animated = true
}) => {
  const gradientId = useId();

  const sizes = {
    sm: { width: 32, height: 32, text: 'text-lg' },
    md: { width: 48, height: 48, text: 'text-2xl' },
    lg: { width: 64, height: 64, text: 'text-4xl' }
  };

  const { width, height, text } = sizes[size];

  return (
    <div className="flex items-center gap-3" role="img" aria-label="VELUM Logo">
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        className={animated ? 'motion-safe:animate-pulse-slow' : ''}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#F4E4BC" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
        />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fill={`url(#${gradientId})`}
          fontFamily="Cinzel, serif"
          fontSize="28"
          fontWeight="600"
        >
          V
        </text>
      </svg>
      <span className={`font-display font-semibold ${text} text-gold-500`}>
        VELUM
      </span>
    </div>
  );
};

// ============================================================================
// ACTION BUTTON
// ============================================================================

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  type = 'button',
  'aria-label': ariaLabel
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || isLoading || loading) return;

    if (onClick) {
      const result = onClick();
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
        } finally {
          setIsLoading(false);
        }
      }
    }
  }, [onClick, disabled, isLoading, loading]);

  const isDisabled = disabled || isLoading || loading;

  const variants = {
    primary: 'bg-gradient-to-r from-gold-600 to-gold-500 text-black hover:from-gold-500 hover:to-gold-400 shadow-glow-gold',
    secondary: 'bg-heritage-800 text-heritage-100 hover:bg-heritage-700 border border-heritage-600',
    ghost: 'bg-transparent text-heritage-300 hover:text-gold-500 hover:bg-heritage-800/50',
    danger: 'bg-red-900/80 text-red-100 hover:bg-red-800 border border-red-700'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-heritage-950
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      aria-label={ariaLabel}
      aria-busy={isLoading || loading}
    >
      {(isLoading || loading) ? (
        <svg
          className="animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon}
      {children}
    </motion.button>
  );
};

// ============================================================================
// SPOTLIGHT CARD
// ============================================================================

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  interactive = false
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  }, [interactive, onClick]);

  return (
    <motion.div
      className={`
        relative overflow-hidden rounded-xl
        bg-heritage-900/80 backdrop-blur-sm
        border border-heritage-700/50
        ${interactive ? 'cursor-pointer hover:border-gold-500/30' : ''}
        ${className}
      `}
      onMouseMove={handleMouseMove}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      whileHover={interactive ? { scale: 1.01 } : undefined}
    >
      {/* Spotlight effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(212, 175, 55, 0.1), transparent 40%)`
        }}
        aria-hidden="true"
      />

      {children}
    </motion.div>
  );
};

// ============================================================================
// WAX SEAL
// ============================================================================

interface WaxSealProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'gold' | 'red' | 'blue';
}

export const WaxSeal: React.FC<WaxSealProps> = ({
  text,
  size = 'md',
  color = 'gold'
}) => {
  const sizes = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-20 h-20 text-base'
  };

  const colors = {
    gold: 'from-gold-600 to-gold-700 text-gold-100',
    red: 'from-red-700 to-red-800 text-red-100',
    blue: 'from-blue-700 to-blue-800 text-blue-100'
  };

  return (
    <div
      className={`
        ${sizes[size]}
        rounded-full bg-gradient-to-br ${colors[color]}
        flex items-center justify-center
        font-display font-bold uppercase
        shadow-lg motion-safe:animate-spin-slow
        ring-2 ring-offset-2 ring-offset-heritage-950 ring-current/20
      `}
      role="img"
      aria-label={`Sceau: ${text}`}
    >
      {text}
    </div>
  );
};

// ============================================================================
// LOADING SPINNER
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text
}) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div className={`${sizes[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-heritage-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
      </div>
      {text && (
        <p className="text-heritage-400 text-sm">{text}</p>
      )}
      <span className="sr-only">{text || 'Chargement...'}</span>
    </div>
  );
};

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="text-heritage-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-heritage-200 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-heritage-400 max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && (
        <ActionButton onClick={action.onClick} variant="primary">
          {action.label}
        </ActionButton>
      )}
    </div>
  );
};
```

---

[SUITE DANS LE FICHIER SUIVANT - Ce prompt dépasse la limite, je vais le diviser]

---

Veux-tu que je continue avec les autres fichiers (components, utils, App.tsx, index.tsx, index.html) ?

Réponds "CONTINUE" pour la suite.
