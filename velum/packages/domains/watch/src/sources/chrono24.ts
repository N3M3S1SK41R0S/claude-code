/**
 * Adaptateur Chrono24 — annonces EN COURS, pondérées comme prix demandés.
 * L'endpoint reste désactivé sans contrat partenaire confirmé.
 */
import {
  DEFAULT_SOURCE_WEIGHTS,
  type PriceObservation,
  type PriceQuery,
  type PriceSource,
} from '@velum/core';
import { isRecord } from '../json.ts';
import {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './transport.ts';

const CHRONO24_URL = 'https://api.chrono24.com/v1/listings/search';

export class Chrono24Source implements PriceSource {
  readonly name = 'Chrono24';
  readonly kind = 'listing' as const;
  private readonly transport: Transport;
  private readonly apiKey: string | undefined;
  private readonly now: () => Date;

  constructor(options: SourceAdapterOptions) {
    this.transport = options.transport;
    this.apiKey = options.apiKey;
    this.now = options.now;
  }

  async fetch(query: PriceQuery): Promise<PriceObservation[]> {
    try {
      const params: Record<string, string> = { q: query.label };
      const reference = query.attributes['reference'];
      if (typeof reference === 'string' && reference.trim() !== '') {
        params['reference'] = reference.trim();
      }
      if (query.limit !== undefined) params['limit'] = String(query.limit);
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(CHRONO24_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['listings'])) return [];
    const observations: PriceObservation[] = [];
    for (const listing of raw['listings']) {
      if (!isRecord(listing)) continue;
      const askPrice = listing['price'];
      if (!isRecord(askPrice)) continue;
      const price = toPositiveNumber(askPrice['amount']);
      const ageDays = ageDaysFromIso(listing['listed_at'], this.now);
      if (price === null || ageDays === null) continue;
      observations.push({
        price,
        currency: toCurrency(askPrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: CHRONO24_URL },
        matchedLabel: typeof listing['title'] === 'string' ? listing['title'] : query.label,
      });
    }
    return query.limit !== undefined ? observations.slice(0, query.limit) : observations;
  }
}
