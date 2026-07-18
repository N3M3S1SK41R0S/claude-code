/**
 * Contrat de transport HTTP des adaptateurs de sources de prix (§9) —
 * identique dans les domaines VELUM. Les adaptateurs ne touchent JAMAIS
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

const DAY_MS = 86_400_000;
/** Tolérance aux fuseaux et petites dérives d’horloge des fournisseurs. */
const MAX_FUTURE_SKEW_MS = DAY_MS;

/**
 * Convertit une date ISO en ancienneté. Une date absente, invalide ou située
 * à plus de 24 h dans le futur est inexploitable et retourne null.
 */
export function isoToAgeDays(iso: unknown, now: () => Date): number | null {
  if (typeof iso !== 'string' || iso.trim().length === 0) return null;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;
  const diffMs = now().getTime() - timestamp;
  if (diffMs < -MAX_FUTURE_SKEW_MS) return null;
  return Math.max(0, Math.floor(diffMs / DAY_MS));
}
