/**
 * Contrat de transport HTTP des adaptateurs de sources de prix. L'implémentation
 * réelle (fetch côté Edge Function, avec les clés API côté serveur) est injectée ;
 * les tests injectent un FakeTransport à fixtures.
 */
export interface Transport {
  getJson(
    url: string,
    init?: { headers?: Record<string, string>; query?: Record<string, string> },
  ): Promise<unknown>;
}

/** Options communes à tous les adaptateurs de sources. */
export interface SourceAdapterOptions {
  transport: Transport;
  /** Clé API — reste côté serveur : les adaptateurs sont instanciés par les Edge Functions. */
  apiKey?: string;
  /** Horloge injectable (défaut : () => new Date()) pour des tests déterministes. */
  now?: () => Date;
}

const DAY_MS = 86_400_000;
/** Tolérance aux fuseaux et petites dérives d’horloge des fournisseurs. */
const MAX_FUTURE_SKEW_MS = DAY_MS;

/**
 * Convertit une date ISO en ancienneté en jours entiers via l'horloge injectée.
 * Retourne null si la date est absente, illisible ou à plus de 24 h dans le futur.
 */
export function ageDaysFromIso(iso: unknown, now: () => Date): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;
  const diffMs = now().getTime() - timestamp;
  if (diffMs < -MAX_FUTURE_SKEW_MS) return null;
  return Math.max(0, Math.floor(diffMs / DAY_MS));
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
