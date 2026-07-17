/**
 * Contrat de transport HTTP des adaptateurs de sources de prix. L'implémentation
 * réelle (fetch côté Edge Function, clés uniquement côté serveur) est injectée ;
 * les tests utilisent des transports à fixtures.
 */
export interface Transport {
  getJson(
    url: string,
    init?: { headers?: Record<string, string>; query?: Record<string, string> },
  ): Promise<unknown>;
}

/** Sérialise les tâches partageant une même clé, sans bloquer les autres clés. */
export interface KeyedRateLimiter {
  run<T>(
    key: string,
    task: () => Promise<T>,
    cooldown: () => Promise<void>,
  ): Promise<T>;
}

/**
 * Crée une file FIFO par clé. Le verrou n'est libéré qu'après le cooldown,
 * y compris lorsque la requête échoue, afin de respecter le débit fournisseur.
 */
export function createKeyedRateLimiter(): KeyedRateLimiter {
  const tails = new Map<string, Promise<void>>();

  return {
    async run<T>(
      key: string,
      task: () => Promise<T>,
      cooldown: () => Promise<void>,
    ): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      let release: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const current = previous.catch(() => undefined).then(() => gate);
      tails.set(key, current);

      await previous.catch(() => undefined);
      try {
        return await task();
      } finally {
        try {
          await cooldown();
        } finally {
          release?.();
          if (tails.get(key) === current) tails.delete(key);
        }
      }
    },
  };
}

/** Options communes à tous les adaptateurs de sources. */
export interface SourceAdapterOptions {
  transport: Transport;
  /** Clé API — reste côté serveur : les adaptateurs sont instanciés par les Edge Functions. */
  apiKey?: string;
  /** Horloge obligatoire, injectée au point de composition. */
  now: () => Date;
  /** Attente injectable pour respecter les limites de débit sans ralentir les tests. */
  wait?: (milliseconds: number) => Promise<void>;
  /** Limiteur injectable ; WatchCharts utilise par défaut un registre partagé par clé. */
  limiter?: KeyedRateLimiter;
}

const DAY_MS = 86_400_000;

/**
 * Convertit une date ISO en ancienneté en jours entiers (≥ 0) via l'horloge
 * injectée. Retourne null si la date est absente ou illisible.
 */
export function ageDaysFromIso(iso: unknown, now: () => Date): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now().getTime() - timestamp) / DAY_MS));
}

/** Prix exploitable : nombre fini strictement positif (accepte "12.50" en chaîne). */
export function toPositiveNumber(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return null;
  return number;
}

/** Code devise exploitable, sinon repli sur la devise par défaut de la source. */
export function toCurrency(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : fallback;
}
