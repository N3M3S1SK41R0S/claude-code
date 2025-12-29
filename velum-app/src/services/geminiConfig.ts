/**
 * VELUM - Configuration Gemini AI
 * Version corrigée avec types stricts, validation et constantes typées
 */

import type { TaskType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/** Configuration des modèles Gemini */
export interface GeminiModels {
  readonly FLASH_LITE: string;
  readonly FLASH: string;
  readonly PRO: string;
  readonly IMAGEN: string;
  readonly EDIT: string;
  readonly VEO: string;
  readonly TTS: string;
  readonly LIVE: string;
  readonly EMBEDDING: string;
}

/** Configuration du mode thinking */
export interface ThinkingConfig {
  readonly MAX_BUDGET: number;
  readonly DEFAULT_BUDGET: number;
  readonly HIGH_BUDGET: number;
}

/** Configuration des images */
export interface ImageConfig {
  readonly aspectRatios: readonly string[];
  readonly sizes: readonly ('1K' | '2K' | '4K')[];
}

/** Configuration d'optimisation des images */
export interface ImageOptimizationConfig {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly format: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly quality: number;
}

/** Configuration de rate limiting */
export interface RateLimitConfig {
  readonly burstSize: number;
  readonly tokensPerMinute: number;
}

/** Configuration de retry */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly initialDelay: number;
  readonly backoffMultiplier: number;
  readonly maxDelay: number;
}

/** Configuration globale Gemini */
export interface GeminiConfiguration {
  readonly models: GeminiModels;
  readonly thinking: ThinkingConfig;
  readonly image: ImageConfig;
  readonly imageOptimization: ImageOptimizationConfig;
  readonly rateLimits: {
    readonly flash: RateLimitConfig;
    readonly pro: RateLimitConfig;
  };
  readonly proxyUrl: string;
  readonly retry: RetryConfig;
  readonly timeouts: {
    readonly default: number;
    readonly video: number;
    readonly image: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration globale de l'API Gemini
 * Utilise `as const` pour une inférence de type maximale
 */
export const GEMINI_CONFIG: GeminiConfiguration = {
  models: {
    FLASH_LITE: 'gemini-2.0-flash-lite',
    FLASH: 'gemini-2.5-flash-preview-05-20',
    PRO: 'gemini-2.5-pro-preview-06-05',
    IMAGEN: 'imagen-3.0-generate-002',
    EDIT: 'gemini-2.0-flash-exp',
    VEO: 'veo-2.0-generate-001',
    TTS: 'gemini-2.5-flash-preview-tts',
    LIVE: 'gemini-2.0-flash-live-001',
    EMBEDDING: 'text-embedding-004'
  },
  thinking: {
    MAX_BUDGET: 32768,
    DEFAULT_BUDGET: 8192,
    HIGH_BUDGET: 16384
  },
  image: {
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'] as const,
    sizes: ['1K', '2K', '4K'] as const
  },
  imageOptimization: {
    maxWidth: 1024,
    maxHeight: 1024,
    format: 'image/jpeg',
    quality: 0.85
  },
  rateLimits: {
    flash: { burstSize: 30, tokensPerMinute: 120 },
    pro: { burstSize: 5, tokensPerMinute: 20 }
  },
  proxyUrl: '/api/generate',
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000
  },
  timeouts: {
    default: 60000,    // 60s
    video: 180000,     // 3 min pour Veo
    image: 90000       // 90s pour Imagen
  }
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mapping des types de tâches vers les modèles appropriés
 */
const TASK_MODEL_MAP: Record<TaskType, keyof GeminiModels> = {
  'expert-analysis': 'PRO',
  'financial-thesis': 'PRO',
  'complex-reasoning': 'PRO',
  'creative-writing': 'FLASH',
  'social-content': 'FLASH',
  'search': 'FLASH',
  'quick-scan': 'FLASH_LITE',
  'object-detection': 'FLASH_LITE',
  'image-generation': 'IMAGEN'
};

/**
 * Retourne le modèle approprié pour un type de tâche donné
 * @param taskType - Type de tâche à effectuer
 * @returns Nom du modèle Gemini
 */
export function getModelForTask(taskType: TaskType): string {
  const modelKey = TASK_MODEL_MAP[taskType];
  return GEMINI_CONFIG.models[modelKey];
}

/**
 * Retourne le budget de thinking approprié pour un type de tâche
 * @param taskType - Type de tâche
 * @returns Budget de tokens pour le thinking mode
 */
export function getThinkingBudgetForTask(taskType: TaskType): number {
  switch (taskType) {
    case 'expert-analysis':
    case 'financial-thesis':
      return GEMINI_CONFIG.thinking.MAX_BUDGET;
    case 'complex-reasoning':
      return GEMINI_CONFIG.thinking.HIGH_BUDGET;
    default:
      return GEMINI_CONFIG.thinking.DEFAULT_BUDGET;
  }
}

/**
 * Vérifie si un modèle supporte le mode thinking
 * @param model - Nom du modèle
 * @returns true si le modèle supporte le thinking
 */
export function supportsThinking(model: string): boolean {
  return model.includes('pro') || model.includes('2.5');
}

/**
 * Retourne le timeout approprié pour un type d'opération
 * @param operationType - Type d'opération
 * @returns Timeout en millisecondes
 */
export function getTimeout(operationType: 'default' | 'video' | 'image'): number {
  return GEMINI_CONFIG.timeouts[operationType];
}

/**
 * Valide une configuration de modèle
 * @param model - Nom du modèle à valider
 * @returns true si le modèle est valide
 */
export function isValidModel(model: string): boolean {
  return Object.values(GEMINI_CONFIG.models).includes(model);
}

/**
 * Retourne la configuration de rate limit pour un modèle
 * @param model - Nom du modèle
 * @returns Configuration de rate limit
 */
export function getRateLimitConfig(model: string): RateLimitConfig {
  return model.includes('pro')
    ? GEMINI_CONFIG.rateLimits.pro
    : GEMINI_CONFIG.rateLimits.flash;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { TaskType };
