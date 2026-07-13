/**
 * Adaptateur iDealwine (§9) — résultats d'adjudication aux enchères,
 * kind 'auction_realized' (poids maximal : ventes réellement conclues).
 *
 * URL : GET https://api.idealwine.com/v1/auction-results?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "adjudications": [
 *     {
 *       "label": "Clos Rougeard Le Bourg 2014",
 *       "hammerPrice": 310,
 *       "currency": "EUR",
 *       "saleDate": "2026-04-15",
 *       "lotUrl": "https://www.idealwine.com/fr/acheter-du-vin/lot-123.jsp"
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

const BASE_URL = 'https://api.idealwine.com/v1/auction-results';

export class IdealwineSource implements PriceSource {
  readonly name = 'iDealwine';
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
          q: query.label,
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { authorization: `Bearer ${this.apiKey}` } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['adjudications'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['adjudications']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['hammerPrice']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'EUR',
          ageDays: isoToAgeDays(entry['saleDate'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['lotUrl']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['label']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
