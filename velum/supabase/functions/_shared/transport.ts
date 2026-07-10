/**
 * Implémentation serveur du contrat Transport des adaptateurs de sources de
 * prix (§9). Les adaptateurs (@velum/domain-*) ne touchent jamais le réseau
 * directement : cette implémentation fetch est injectée à la construction.
 *
 * Le type Transport est identique dans les 4 packages de domaine ; on
 * l'importe depuis @velum/domain-wine (structurellement compatible partout).
 */
import type { Transport } from '@velum/domain-wine';

export class FetchTransport implements Transport {
  async getJson(
    url: string,
    init?: { headers?: Record<string, string>; query?: Record<string, string> },
  ): Promise<unknown> {
    const target = new URL(url);
    for (const [key, value] of Object.entries(init?.query ?? {})) {
      target.searchParams.set(key, value);
    }

    const response = await fetch(target.toString(), {
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      // Les adaptateurs interceptent et dégradent gracieusement (→ []).
      throw new Error(`HTTP ${response.status} pour ${target.hostname}`);
    }
    return (await response.json()) as unknown;
  }
}

/** Instance partagée par toutes les fonctions. */
export const serverTransport: Transport = new FetchTransport();
