/**
 * Adaptateur Cavissima (§9) — catalogue marchand français (prix demandés),
 * kind 'listing'. Les prix Cavissima sont toujours exprimés en EUR.
 *
 * URL : GET https://api.cavissima.com/v1/catalog/search?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "items": [
 *     {
 *       "title": "Château Rayas Châteauneuf-du-Pape 2016",
 *       "priceEur": 640,
 *       "publishedAt": "2026-06-20",
 *       "url": "https://www.cavissima.com/vin/chateau-rayas-2016"
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

const BASE_URL = 'https://api.cavissima.com/v1/catalog/search';

export class CavissimaSource implements PriceSource {
  readonly name = 'Cavissima';
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
      if (!isRecord(raw) || !Array.isArray(raw['items'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['items']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['priceEur']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: 'EUR', // catalogue exclusivement en euros
          ageDays: isoToAgeDays(entry['publishedAt'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['title']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
