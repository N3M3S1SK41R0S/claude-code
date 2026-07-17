/**
 * Adaptateur Artsy (§9) — annonces en cours de galeries et marchands,
 * kind 'listing' (prix demandés, poids faible).
 *
 * URL : GET https://api.artsy.net/v1/listings?q=<label>&size=<n>
 * Réponse documentée :
 * {
 *   "listings": [
 *     {
 *       "artwork": "Bernard Buffet — Bouquet de fleurs",
 *       "askPrice": 3900,
 *       "currency": "USD",
 *       "listedAt": "2026-06-25T00:00:00Z",
 *       "permalink": "https://www.artsy.net/artwork/bernard-buffet-bouquet"
 *     }
 *   ]
 * }
 * Réponse invalide ou vide → [] (dégradation gracieuse, jamais de throw).
 */
import {
  DEFAULT_SOURCE_WEIGHTS,
  type PriceObservation,
  type PriceQuery,
  type PriceSource,
  type SourceKind,
} from '@velum/core';
import { asFiniteNumber, asNonEmptyString, isRecord } from '../guards.ts';
import { isoToAgeDays, type SourceAdapterOptions, type Transport } from '../transport.ts';

const BASE_URL = 'https://api.artsy.net/v1/listings';

export class ArtsySource implements PriceSource {
  readonly name = 'Artsy';
  readonly kind: SourceKind = 'listing';

  private readonly transport: Transport;
  private readonly apiKey: string | undefined;
  private readonly now: () => Date;

  constructor(options: SourceAdapterOptions) {
    this.transport = options.transport;
    this.apiKey = options.apiKey;
    this.now = options.now ?? (() => new Date());
  }

  async fetch(query: PriceQuery): Promise<PriceObservation[]> {
    try {
      const raw = await this.transport.getJson(BASE_URL, {
        query: {
          q: query.label,
          size: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { 'x-xapp-token': this.apiKey } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['listings'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['listings']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['askPrice']);
        const ageDays = isoToAgeDays(entry['listedAt'], this.now);
        if (price === undefined || price <= 0 || ageDays === null) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'USD',
          ageDays,
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['permalink']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['artwork']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
