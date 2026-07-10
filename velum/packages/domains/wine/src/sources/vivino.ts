/**
 * Adaptateur Vivino (§9) — annonces marchandes en cours (prix demandés),
 * kind 'listing' (poids faible : prix affichés, pas conclus).
 *
 * URL : GET https://api.vivino.com/v1/listings?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "listings": [
 *     {
 *       "wine": "Domaine Leflaive Puligny-Montrachet 2020",
 *       "amount": 118.9,
 *       "currency": "EUR",
 *       "listedAt": "2026-07-01T09:30:00Z",
 *       "url": "https://www.vivino.com/FR/fr/w/123456"
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
import { asFiniteNumber, asNonEmptyString, isRecord } from '../guards';
import { isoToAgeDays, type SourceAdapterOptions, type Transport } from '../transport';

const BASE_URL = 'https://api.vivino.com/v1/listings';

export class VivinoSource implements PriceSource {
  readonly name = 'Vivino';
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
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { 'x-api-key': this.apiKey } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['listings'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['listings']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['amount']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'EUR',
          ageDays: isoToAgeDays(entry['listedAt'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['wine']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
