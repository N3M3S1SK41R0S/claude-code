/**
 * Adaptateur eBay Marketplace Insights — ventes RÉALISÉES, jamais les annonces.
 * L'API reste désactivée sans accès Marketplace Insights explicitement approuvé.
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

const EBAY_URL = 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search';
const EBAY_WRISTWATCHES_CATEGORY = '31387';

export class EbaySoldSource implements PriceSource {
  readonly name = 'eBay sold';
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
      const params: Record<string, string> = {
        q: query.label,
        category_ids: EBAY_WRISTWATCHES_CATEGORY,
      };
      if (query.limit !== undefined) params['limit'] = String(query.limit);
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(EBAY_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['itemSales'])) return [];
    const observations: PriceObservation[] = [];
    for (const sale of raw['itemSales']) {
      if (!isRecord(sale)) continue;
      const soldPrice = sale['lastSoldPrice'];
      if (!isRecord(soldPrice)) continue;
      const price = toPositiveNumber(soldPrice['value']);
      const ageDays = ageDaysFromIso(sale['lastSoldDate'], this.now);
      if (price === null || ageDays === null) continue;
      observations.push({
        price,
        currency: toCurrency(soldPrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: EBAY_URL },
        matchedLabel: typeof sale['title'] === 'string' ? sale['title'] : query.label,
      });
    }
    return query.limit !== undefined ? observations.slice(0, query.limit) : observations;
  }
}
