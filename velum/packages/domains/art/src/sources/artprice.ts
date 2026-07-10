/**
 * Adaptateur Artprice (§9) — cotes officielles du marché de l'art,
 * kind 'official_quote'.
 *
 * URL : GET https://api.artprice.com/v1/quotes?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "quotes": [
 *     {
 *       "work": "Eugène Boudin — Plage de Trouville",
 *       "price": 12500,
 *       "currency": "EUR",
 *       "quotedAt": "2026-05-01",
 *       "url": "https://www.artprice.com/artist/boudin/quote-123"
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

const BASE_URL = 'https://api.artprice.com/v1/quotes';

export class ArtpriceSource implements PriceSource {
  readonly name = 'Artprice';
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
      const raw = await this.transport.getJson(BASE_URL, {
        query: {
          q: query.label,
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { 'x-api-key': this.apiKey } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['quotes'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['quotes']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['price']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'EUR',
          ageDays: isoToAgeDays(entry['quotedAt'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['work']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
