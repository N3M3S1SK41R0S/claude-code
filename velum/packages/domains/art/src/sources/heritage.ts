/**
 * Adaptateur Heritage Auctions (§9) — lots adjugés (département Fine Art),
 * kind 'auction_realized' (poids maximal : ventes réellement conclues).
 *
 * URL : GET https://api.ha.com/v1/sold-lots?query=<label>&category=fine-art&limit=<n>
 * Réponse documentée :
 * {
 *   "lots": [
 *     {
 *       "title": "Maurice Utrillo — Rue de Montmartre",
 *       "hammerPrice": 5200,
 *       "currency": "USD",
 *       "soldOn": "2026-03-15T00:00:00Z",
 *       "lotUrl": "https://fineart.ha.com/itm/utrillo/a/8123-67001.s"
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

const BASE_URL = 'https://api.ha.com/v1/sold-lots';

export class HeritageArtSource implements PriceSource {
  readonly name = 'Heritage Auctions';
  readonly kind: SourceKind = 'auction_realized';

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
          query: query.label,
          category: 'fine-art',
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { 'x-api-key': this.apiKey } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['lots'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['lots']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['hammerPrice']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'USD',
          ageDays: isoToAgeDays(entry['soldOn'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['lotUrl']) ?? BASE_URL,
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
