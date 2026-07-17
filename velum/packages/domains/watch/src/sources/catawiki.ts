/**
 * Adaptateur Catawiki — lots ADJUGÉS. L'endpoint reste désactivé sans contrat
 * partenaire confirmant son accès et le droit d'utiliser les données.
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

const CATAWIKI_URL = 'https://api.catawiki.com/v1/lots/sold';

export class CatawikiSource implements PriceSource {
  readonly name = 'Catawiki';
  readonly kind = 'marketplace_sold' as const;
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
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(CATAWIKI_URL, {
        headers,
        query: { q: query.label, category: 'watches' },
      });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['lots'])) return [];
    const observations: PriceObservation[] = [];
    for (const lot of raw['lots']) {
      if (!isRecord(lot)) continue;
      const soldPrice = lot['sold_price'];
      if (!isRecord(soldPrice)) continue;
      const price = toPositiveNumber(soldPrice['amount']);
      const ageDays = ageDaysFromIso(lot['sold_at'], this.now);
      if (price === null || ageDays === null) continue;
      observations.push({
        price,
        currency: toCurrency(soldPrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: CATAWIKI_URL },
        matchedLabel: typeof lot['title'] === 'string' ? lot['title'] : query.label,
      });
    }
    return query.limit !== undefined ? observations.slice(0, query.limit) : observations;
  }
}
