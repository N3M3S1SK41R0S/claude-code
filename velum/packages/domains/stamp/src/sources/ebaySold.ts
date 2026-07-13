/**
 * Adaptateur eBay Marketplace Insights — ventes RÉALISÉES (item_sales),
 * jamais les annonces en cours.
 * kind: 'marketplace_sold' → poids par défaut 0.7.
 *
 * URL construite :
 *   GET https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search
 *       ?q=<label>&category_ids=260[&limit=<limit>]
 *   (260 = catégorie eBay « Stamps »)
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "itemSales": [
 *     {
 *       "title": "France YT 130 Semeuse lignée 15c neuf sans charnière",
 *       "lastSoldDate": "2026-06-15T10:30:00.000Z",
 *       "lastSoldPrice": { "value": "12.50", "currency": "EUR" }
 *     }
 *   ]
 * }
 *
 * Une vente sans date ou sans prix exploitable est ignorée.
 * Réponse invalide ou vide → [] (dégradation gracieuse, jamais de throw).
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
const EBAY_STAMPS_CATEGORY = '260';

export class EbaySoldSource implements PriceSource {
  readonly name = 'eBay sold';
  readonly kind = 'marketplace_sold' as const;
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
      const params: Record<string, string> = { q: query.label, category_ids: EBAY_STAMPS_CATEGORY };
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
    const out: PriceObservation[] = [];
    for (const sale of raw['itemSales']) {
      if (!isRecord(sale)) continue;
      const soldPrice = sale['lastSoldPrice'];
      if (!isRecord(soldPrice)) continue;
      const price = toPositiveNumber(soldPrice['value']);
      const ageDays = ageDaysFromIso(sale['lastSoldDate'], this.now);
      if (price === null || ageDays === null) continue; // vente non datée → inexploitable
      out.push({
        price,
        currency: toCurrency(soldPrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: EBAY_URL },
        matchedLabel: typeof sale['title'] === 'string' ? sale['title'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
