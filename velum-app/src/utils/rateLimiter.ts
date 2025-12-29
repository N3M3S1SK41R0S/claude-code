/**
 * VELUM - Utilitaire de Rate Limiting
 * Gestion des limites d'appels API Gemini
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Nombre maximum de requêtes par fenêtre */
  maxRequests: number;
  /** Durée de la fenêtre en millisecondes */
  windowMs: number;
  /** Délai minimum entre les requêtes en ms */
  minDelayMs?: number;
}

export interface RateLimitStatus {
  /** Requêtes restantes dans la fenêtre actuelle */
  remaining: number;
  /** Timestamp de reset de la fenêtre */
  resetAt: number;
  /** Temps avant le prochain appel autorisé en ms */
  retryAfter: number;
  /** Limite atteinte */
  isLimited: boolean;
}

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  addedAt: number;
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private requests: number[] = [];
  private config: Required<RateLimitConfig>;
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private lastRequestTime = 0;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      minDelayMs: config.minDelayMs ?? 100
    };
  }

  /**
   * Nettoie les anciennes requêtes de la fenêtre
   */
  private cleanOldRequests(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.requests = this.requests.filter((time) => time > windowStart);
  }

  /**
   * Obtient le statut actuel du rate limiter
   */
  getStatus(): RateLimitStatus {
    this.cleanOldRequests();

    const now = Date.now();
    const remaining = this.config.maxRequests - this.requests.length;
    const oldestRequest = this.requests[0] || now;
    const resetAt = oldestRequest + this.config.windowMs;

    // Calcul du temps d'attente
    let retryAfter = 0;
    if (remaining <= 0) {
      retryAfter = resetAt - now;
    } else {
      // Respecter le délai minimum entre requêtes
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.config.minDelayMs) {
        retryAfter = this.config.minDelayMs - timeSinceLastRequest;
      }
    }

    return {
      remaining: Math.max(0, remaining),
      resetAt,
      retryAfter,
      isLimited: remaining <= 0
    };
  }

  /**
   * Vérifie si une requête peut être effectuée maintenant
   */
  canMakeRequest(): boolean {
    const status = this.getStatus();
    return !status.isLimited && status.retryAfter === 0;
  }

  /**
   * Enregistre une requête effectuée
   */
  private recordRequest(): void {
    const now = Date.now();
    this.requests.push(now);
    this.lastRequestTime = now;
  }

  /**
   * Attend le temps nécessaire avant d'effectuer une requête
   */
  async waitForSlot(): Promise<void> {
    const status = this.getStatus();

    if (status.retryAfter > 0) {
      await this.delay(status.retryAfter);
    }
  }

  /**
   * Exécute une fonction avec rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    this.recordRequest();

    try {
      return await fn();
    } catch (error) {
      // En cas d'erreur 429, ajouter un délai supplémentaire
      if (this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        await this.delay(retryAfter);
        // Réessayer une fois
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Ajoute une requête à la queue avec priorité
   */
  enqueue<T>(
    fn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        addedAt: Date.now()
      });

      // Trier par priorité (plus haut = plus prioritaire)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Traite la queue de requêtes
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      try {
        await this.waitForSlot();
        this.recordRequest();
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;
  }

  /**
   * Vérifie si une erreur est une erreur de rate limit
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('quota exceeded')
      );
    }
    return false;
  }

  /**
   * Extrait le temps d'attente d'une erreur de rate limit
   */
  private extractRetryAfter(error: unknown): number {
    if (error instanceof Error) {
      // Chercher un pattern comme "retry after X seconds"
      const match = error.message.match(/retry after (\d+)/i);
      if (match) {
        return parseInt(match[1], 10) * 1000;
      }
    }
    // Valeur par défaut: attendre 60 secondes
    return 60000;
  }

  /**
   * Utilitaire de délai
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Réinitialise le rate limiter
   */
  reset(): void {
    this.requests = [];
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
  }

  /**
   * Obtient le nombre de requêtes en attente
   */
  get pendingCount(): number {
    return this.queue.length;
  }
}

// ============================================================================
// PRE-CONFIGURED LIMITERS
// ============================================================================

/**
 * Rate limiters préconfigurés pour les différentes API Gemini
 */
export const geminiLimiters = {
  /** Gemini Pro - 60 RPM */
  pro: new RateLimiter({
    maxRequests: 60,
    windowMs: 60000,
    minDelayMs: 200
  }),

  /** Gemini Flash - 100 RPM */
  flash: new RateLimiter({
    maxRequests: 100,
    windowMs: 60000,
    minDelayMs: 100
  }),

  /** Imagen - 10 RPM */
  imagen: new RateLimiter({
    maxRequests: 10,
    windowMs: 60000,
    minDelayMs: 1000
  }),

  /** Veo - 5 RPM */
  veo: new RateLimiter({
    maxRequests: 5,
    windowMs: 60000,
    minDelayMs: 2000
  }),

  /** TTS - 30 RPM */
  tts: new RateLimiter({
    maxRequests: 30,
    windowMs: 60000,
    minDelayMs: 500
  }),

  /** Live API - 10 connections */
  live: new RateLimiter({
    maxRequests: 10,
    windowMs: 60000,
    minDelayMs: 1000
  })
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wrapper pour exécuter une fonction avec rate limiting automatique
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  fn: () => Promise<T>
): Promise<T> {
  return limiter.execute(fn);
}

/**
 * Décorateur pour ajouter du rate limiting à une fonction
 */
export function rateLimited<T extends unknown[], R>(
  limiter: RateLimiter
) {
  return function decorator(
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: T) => Promise<R>;

    descriptor.value = async function (this: unknown, ...args: T): Promise<R> {
      return limiter.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Crée un rate limiter adaptatif qui ajuste ses limites en fonction des erreurs
 */
export function createAdaptiveLimiter(
  initialConfig: RateLimitConfig
): RateLimiter & { adjust: (factor: number) => void } {
  let currentConfig = { ...initialConfig };
  let limiter = new RateLimiter(currentConfig);

  return {
    ...limiter,
    getStatus: () => limiter.getStatus(),
    canMakeRequest: () => limiter.canMakeRequest(),
    execute: <T>(fn: () => Promise<T>) => limiter.execute(fn),
    enqueue: <T>(fn: () => Promise<T>, priority?: number) =>
      limiter.enqueue(fn, priority),
    reset: () => limiter.reset(),
    get pendingCount() {
      return limiter.pendingCount;
    },
    waitForSlot: () => limiter.waitForSlot(),

    /**
     * Ajuste les limites par un facteur (< 1 = plus restrictif)
     */
    adjust(factor: number): void {
      currentConfig = {
        ...currentConfig,
        maxRequests: Math.max(1, Math.floor(currentConfig.maxRequests * factor)),
        minDelayMs: Math.ceil((currentConfig.minDelayMs || 100) / factor)
      };
      const oldQueue = limiter.pendingCount;
      limiter = new RateLimiter(currentConfig);
      console.log(
        `[RateLimiter] Ajusté: ${currentConfig.maxRequests} req/min, délai min: ${currentConfig.minDelayMs}ms, queue: ${oldQueue}`
      );
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { RateLimitConfig, RateLimitStatus };
