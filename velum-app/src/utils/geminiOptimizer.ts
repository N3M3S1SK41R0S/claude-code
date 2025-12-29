/**
 * VELUM - Optimiseur Gemini
 * Utilitaires pour optimiser les performances des appels Gemini
 */

import { compressForGemini, extractBase64 } from './imageCompressor';
import { geminiLimiters, RateLimiter } from './rateLimiter';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizedRequest {
  /** Prompt optimisé */
  prompt: string;
  /** Images optimisées en base64 */
  images: { base64: string; mimeType: string }[];
  /** Tokens estimés */
  estimatedTokens: number;
  /** Coût estimé en crédits */
  estimatedCost: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  errorRate: number;
  lastError?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Estimation des tokens (approximatif)
const CHARS_PER_TOKEN = 4;
const IMAGE_TOKEN_ESTIMATE = 258; // ~258 tokens par image selon Google

// Cache TTL par défaut (5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

// Coûts estimés par 1000 tokens (en crédits virtuels)
const COST_PER_1K_TOKENS = {
  'gemini-2.0-flash-exp': 0.1,
  'gemini-1.5-pro-latest': 0.25,
  'gemini-2.0-flash-thinking-exp-01-21': 0.15,
  'imagen-3.0-generate-002': 5.0,
  'veo-001': 50.0
};

// ============================================================================
// RESPONSE CACHE
// ============================================================================

/**
 * Cache LRU pour les réponses Gemini
 */
class ResponseCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Génère une clé de cache à partir des paramètres
   */
  generateKey(prompt: string, ...extras: unknown[]): string {
    const data = JSON.stringify({ prompt, extras });
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Récupère une entrée du cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Mettre à jour les hits et remonter l'entrée (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Ajoute une entrée au cache
   */
  set(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
    // Éviction si nécessaire
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });
  }

  /**
   * Invalide une entrée
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtient les statistiques du cache
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    this.cache.forEach((entry) => {
      totalHits += entry.hits;
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0
    };
  }
}

// ============================================================================
// PROMPT OPTIMIZER
// ============================================================================

/**
 * Optimise un prompt pour réduire les tokens
 */
export function optimizePrompt(prompt: string): string {
  let optimized = prompt;

  // Supprimer les espaces multiples
  optimized = optimized.replace(/\s+/g, ' ');

  // Supprimer les espaces en début/fin
  optimized = optimized.trim();

  // Remplacer les longues séquences de ponctuation
  optimized = optimized.replace(/\.{3,}/g, '...');
  optimized = optimized.replace(/!{2,}/g, '!');
  optimized = optimized.replace(/\?{2,}/g, '?');

  return optimized;
}

/**
 * Estime le nombre de tokens d'un texte
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estime le nombre de tokens pour une image
 */
export function estimateImageTokens(_imageBase64: string): number {
  // Gemini utilise environ 258 tokens par image
  return IMAGE_TOKEN_ESTIMATE;
}

/**
 * Estime le coût d'une requête
 */
export function estimateCost(
  tokens: number,
  model: keyof typeof COST_PER_1K_TOKENS = 'gemini-2.0-flash-exp'
): number {
  const costPer1K = COST_PER_1K_TOKENS[model] || 0.1;
  return (tokens / 1000) * costPer1K;
}

// ============================================================================
// REQUEST OPTIMIZER
// ============================================================================

/**
 * Optimise une requête complète (prompt + images)
 */
export async function optimizeRequest(
  prompt: string,
  images: (string | File | Blob)[] = [],
  model: keyof typeof COST_PER_1K_TOKENS = 'gemini-2.0-flash-exp'
): Promise<OptimizedRequest> {
  // Optimiser le prompt
  const optimizedPrompt = optimizePrompt(prompt);

  // Compresser les images
  const optimizedImages: { base64: string; mimeType: string }[] = [];

  for (const image of images) {
    try {
      const compressed = await compressForGemini(image);
      const base64 = extractBase64(compressed.dataUrl);
      const mimeType = 'image/jpeg';
      optimizedImages.push({ base64, mimeType });
    } catch (error) {
      console.warn('[Optimizer] Erreur de compression image:', error);
      // Si c'est déjà un base64, l'utiliser directement
      if (typeof image === 'string' && image.startsWith('data:image')) {
        const base64 = extractBase64(image);
        const mimeType = image.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg';
        optimizedImages.push({ base64, mimeType });
      }
    }
  }

  // Estimer les tokens
  const textTokens = estimateTokens(optimizedPrompt);
  const imageTokens = optimizedImages.length * IMAGE_TOKEN_ESTIMATE;
  const estimatedTokens = textTokens + imageTokens;

  // Estimer le coût
  const estimatedCost = estimateCost(estimatedTokens, model);

  return {
    prompt: optimizedPrompt,
    images: optimizedImages,
    estimatedTokens,
    estimatedCost
  };
}

// ============================================================================
// BATCH PROCESSOR
// ============================================================================

interface BatchItem<T, R> {
  input: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

/**
 * Processeur de requêtes en batch
 */
export class BatchProcessor<T, R> {
  private batch: BatchItem<T, R>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private processor: (items: T[]) => Promise<R[]>;
  private maxBatchSize: number;
  private delayMs: number;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    options: { maxBatchSize?: number; delayMs?: number } = {}
  ) {
    this.processor = processor;
    this.maxBatchSize = options.maxBatchSize ?? 10;
    this.delayMs = options.delayMs ?? 50;
  }

  /**
   * Ajoute un item au batch
   */
  add(input: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push({ input, resolve, reject });

      // Traiter immédiatement si batch plein
      if (this.batch.length >= this.maxBatchSize) {
        this.flush();
      } else {
        // Sinon, démarrer/reset le timer
        this.scheduleFlush();
      }
    });
  }

  /**
   * Planifie le flush du batch
   */
  private scheduleFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  /**
   * Traite le batch courant
   */
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) return;

    const items = this.batch.splice(0, this.maxBatchSize);
    const inputs = items.map((item) => item.input);

    try {
      const results = await this.processor(inputs);

      items.forEach((item, index) => {
        if (results[index] !== undefined) {
          item.resolve(results[index]);
        } else {
          item.reject(new Error('Résultat manquant pour l\'item'));
        }
      });
    } catch (error) {
      items.forEach((item) => {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      });
    }

    // Continuer si d'autres items en attente
    if (this.batch.length > 0) {
      this.scheduleFlush();
    }
  }
}

// ============================================================================
// PERFORMANCE TRACKER
// ============================================================================

/**
 * Traqueur de performance pour les appels Gemini
 */
class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLatency: 0,
    errorRate: 0
  };

  private latencies: number[] = [];
  private errors = 0;
  private maxLatencies = 100;

  /**
   * Enregistre une requête
   */
  recordRequest(latencyMs: number, fromCache: boolean, error?: Error): void {
    this.metrics.totalRequests++;

    if (fromCache) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    if (error) {
      this.errors++;
      this.metrics.lastError = error.message;
    }

    // Mise à jour de la latence moyenne
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift();
    }

    this.metrics.averageLatency =
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;

    this.metrics.errorRate = this.errors / this.metrics.totalRequests;
  }

  /**
   * Obtient les métriques actuelles
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Réinitialise les métriques
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      errorRate: 0
    };
    this.latencies = [];
    this.errors = 0;
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/** Cache de réponses global */
export const responseCache = new ResponseCache<unknown>(100);

/** Traqueur de performance global */
export const performanceTracker = new PerformanceTracker();

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * Exécute une requête avec toutes les optimisations
 */
export async function executeOptimized<T>(
  cacheKey: string,
  limiter: RateLimiter,
  fn: () => Promise<T>,
  options: {
    useCache?: boolean;
    cacheTtl?: number;
  } = {}
): Promise<T> {
  const { useCache = true, cacheTtl = DEFAULT_CACHE_TTL } = options;
  const startTime = Date.now();

  // Vérifier le cache
  if (useCache) {
    const cached = responseCache.get(cacheKey) as T | null;
    if (cached !== null) {
      performanceTracker.recordRequest(0, true);
      return cached;
    }
  }

  try {
    // Exécuter avec rate limiting
    const result = await limiter.execute(fn);

    // Mettre en cache
    if (useCache) {
      responseCache.set(cacheKey, result, cacheTtl);
    }

    const latency = Date.now() - startTime;
    performanceTracker.recordRequest(latency, false);

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    performanceTracker.recordRequest(
      latency,
      false,
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Obtient le rate limiter approprié pour un modèle
 */
export function getLimiterForModel(model: string): RateLimiter {
  if (model.includes('flash')) {
    return geminiLimiters.flash;
  }
  if (model.includes('imagen')) {
    return geminiLimiters.imagen;
  }
  if (model.includes('veo')) {
    return geminiLimiters.veo;
  }
  if (model.includes('tts')) {
    return geminiLimiters.tts;
  }
  if (model.includes('live')) {
    return geminiLimiters.live;
  }
  return geminiLimiters.pro;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ResponseCache, PerformanceTracker };
export type { OptimizedRequest, CacheEntry, PerformanceMetrics };
