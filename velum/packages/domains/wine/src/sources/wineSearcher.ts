/**
 * Adaptateur Wine-Searcher (§9) — cotes professionnelles, kind 'official_quote'.
 *
 * URL : GET https://api.wine-searcher.com/v1/prices?query=<label>&vintage=<n>&limit=<n>
 * Réponse documentée :
 * {
 *   "results": [
 *     {
 *       "name": "Chateau Margaux Premier Grand Cru Classe 2015",
 *       "price": 720.5,
 *       "currency": "EUR",
 *       "updated": "2026-06-01T00:00:00Z",
 *       "url": "https://www.wine-searcher.com/find/chateau-margaux-2015"
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

const BASE_URL = 'https://api.wine-searcher.com/v1/prices';

export class WineSearcherSource implements PriceSource {
  readonly name = 'Wine-Searcher';
  readonly kind: SourceKind = 'official_quote';

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
      const vintage = asFiniteNumber(query.attributes['vintage']);
      const raw = await this.transport.getJson(BASE_URL, {
        query: {
          query: query.label,
          ...(vintage !== undefined ? { vintage: String(vintage) } : {}),
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { 'x-api-key': this.apiKey } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['results'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['results']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['price']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'EUR',
          ageDays: isoToAgeDays(entry['updated'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['name']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
