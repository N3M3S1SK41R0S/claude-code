/**
 * Adaptateur Catawiki — lots ADJUGÉS (ventes conclues aux enchères en ligne).
 * kind: 'marketplace_sold' → poids par défaut 0.7.
 *
 * URL construite :
 *   GET https://api.catawiki.com/v1/lots/sold
 *       ?q=<label>&category=watches
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "lots": [
 *     {
 *       "title": "Cartier - Tank Must - WSTA0041 - Unisexe - 2021",
 *       "sold_at": "2026-05-30",
 *       "sold_price": { "amount": 2450, "currency": "EUR" }
 *     }
 *   ]
 * }
 *
 * Un lot sans date ou sans prix exploitable est ignoré.
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
    this.now = options.now ?? (() => new Date());
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
    const out: PriceObservation[] = [];
    for (const lot of raw['lots']) {
      if (!isRecord(lot)) continue;
      const soldPrice = lot['sold_price'];
      if (!isRecord(soldPrice)) continue;
      const price = toPositiveNumber(soldPrice['amount']);
      const ageDays = ageDaysFromIso(lot['sold_at'], this.now);
      if (price === null || ageDays === null) continue; // vente non datée → inexploitable
      out.push({
        price,
        currency: toCurrency(soldPrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: CATAWIKI_URL },
        matchedLabel: typeof lot['title'] === 'string' ? lot['title'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
