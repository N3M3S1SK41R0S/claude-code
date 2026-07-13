/**
 * Contrat de transport HTTP des adaptateurs de sources de prix (§9) —
 * identique dans les 4 domaines VELUM. Les adaptateurs ne touchent JAMAIS
 * le réseau directement : le transport est injecté (Edge Function côté
 * serveur, fake côté tests). Les clés API restent côté serveur.
 */

export interface Transport {
  getJson(
    url: string,
    init?: { headers?: Record<string, string>; query?: Record<string, string> },
  ): Promise<unknown>;
}

/** Options communes des adaptateurs : transport injecté, clé API optionnelle, horloge injectable. */
export interface SourceAdapterOptions {
  transport: Transport;
  /** Clé API de la source — instanciation côté Edge Function uniquement. */
  apiKey?: string;
  /** Horloge injectable pour des tests déterministes (défaut : () => new Date()). */
  now?: () => Date;
}

/** Convertit une date ISO en ancienneté (jours entiers, ≥ 0). Date absente/invalide → 0. */
export function isoToAgeDays(iso: unknown, now: () => Date): number {
  if (typeof iso !== 'string' || iso.trim().length === 0) return 0;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return 0;
  const diffMs = now().getTime() - timestamp;
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
