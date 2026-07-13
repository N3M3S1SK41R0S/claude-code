/**
 * Adaptateur Magnus (§9) — ventes conclues rapportées par la marketplace,
 * kind 'marketplace_sold' (transactions réelles, poids intermédiaire).
 *
 * URL : GET https://api.magnus.art/v1/sales?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "sales": [
 *     {
 *       "artwork": "André Brasilier — Cavaliers au crépuscule",
 *       "soldPrice": 1450,
 *       "currency": "EUR",
 *       "soldAt": "2026-06-01",
 *       "url": "https://www.magnus.art/artwork/brasilier-cavaliers"
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

const BASE_URL = 'https://api.magnus.art/v1/sales';

export class MagnusSource implements PriceSource {
  readonly name = 'Magnus';
  readonly kind: SourceKind = 'marketplace_sold';

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
      if (!isRecord(raw) || !Array.isArray(raw['sales'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['sales']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['soldPrice']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: asNonEmptyString(entry['currency']) ?? 'EUR',
          ageDays: isoToAgeDays(entry['soldAt'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
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
