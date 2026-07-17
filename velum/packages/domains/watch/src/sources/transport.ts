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

/** Options communes à tous les adaptateurs de sources. */
export interface SourceAdapterOptions {
  transport: Transport;
  /** Clé API — reste côté serveur : les adaptateurs sont instanciés par les Edge Functions. */
  apiKey?: string;
  /** Horloge injectable (défaut : () => new Date()) pour des tests déterministes. */
  now?: () => Date;
  /** Attente injectable pour respecter les limites de débit sans ralentir les tests. */
  wait?: (milliseconds: number) => Promise<void>;
}

const DAY_MS = 86_400_000;

/**
 * Convertit une date ISO en ancienneté en jours entiers (≥ 0) via l'horloge
 * injectée. Retourne null si la date est absente ou illisible.
 */
export function ageDaysFromIso(iso: unknown, now: () => Date): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now().getTime() - t) / DAY_MS));
}

/** Prix exploitable : nombre fini strictement positif (accepte "12.50" en chaîne). */
export function toPositiveNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Code devise exploitable, sinon repli sur la devise par défaut de la source. */
export function toCurrency(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v.trim().toUpperCase())
    ? v.trim().toUpperCase()
    : fallback;
}
