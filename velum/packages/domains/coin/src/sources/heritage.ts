/**
 * Adaptateur Heritage Auctions — PRIX RÉALISÉS en maison de vente.
 * kind: 'auction_realized' → poids par défaut 1.0 (source la plus fiable).
 *
 * URL construite :
 *   GET https://api.ha.com/v1/search/realized
 *       ?q=<label>&department=coins
 *   avec l'en-tête 'X-Api-Key: <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "results": [
 *     {
 *       "lotTitle": "France. 5 Francs 1960 Semeuse, MS65 NGC",
 *       "saleDate": "2026-04-12",
 *       "realizedPrice": 1200,
 *       "currency": "USD"
 *     }
 *   ]
 * }
 *
 * Une adjudication sans date ou sans prix exploitable est ignorée.
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

const HERITAGE_URL = 'https://api.ha.com/v1/search/realized';

export class HeritageSource implements PriceSource {
  readonly name = 'Heritage Auctions';
  readonly kind = 'auction_realized' as const;
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
      if (this.apiKey !== undefined) headers['X-Api-Key'] = this.apiKey;
      const raw = await this.transport.getJson(HERITAGE_URL, {
        headers,
        query: { q: query.label, department: 'coins' },
      });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['results'])) return [];
    const out: PriceObservation[] = [];
    for (const lot of raw['results']) {
      if (!isRecord(lot)) continue;
      const price = toPositiveNumber(lot['realizedPrice']);
      const ageDays = ageDaysFromIso(lot['saleDate'], this.now);
      if (price === null || ageDays === null) continue; // adjudication non datée → inexploitable
      out.push({
        price,
        currency: toCurrency(lot['currency'], 'USD'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: HERITAGE_URL },
        matchedLabel: typeof lot['lotTitle'] === 'string' ? lot['lotTitle'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
