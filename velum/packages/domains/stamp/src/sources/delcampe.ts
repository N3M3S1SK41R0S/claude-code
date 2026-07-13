/**
 * Adaptateur Delcampe — ventes RÉALISÉES (source majeure de la philatélie),
 * jamais les annonces en cours.
 * kind: 'marketplace_sold' → poids par défaut 0.7.
 *
 * URL construite :
 *   GET https://api.delcampe.net/v1/sales/closed
 *       ?q=<label>&category=stamps[&limit=<limit>]
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "sales": [
 *     {
 *       "title": "France YT 130 Semeuse lignée 15c oblitéré",
 *       "closed_at": "2026-06-20T14:00:00Z",
 *       "price": { "amount": "5.50", "currency": "EUR" }
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

const DELCAMPE_URL = 'https://api.delcampe.net/v1/sales/closed';

export class DelcampeSource implements PriceSource {
  readonly name = 'Delcampe';
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
      const params: Record<string, string> = { q: query.label, category: 'stamps' };
      if (query.limit !== undefined) params['limit'] = String(query.limit);
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(DELCAMPE_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['sales'])) return [];
    const out: PriceObservation[] = [];
    for (const sale of raw['sales']) {
      if (!isRecord(sale)) continue;
      const salePrice = sale['price'];
      if (!isRecord(salePrice)) continue;
      const price = toPositiveNumber(salePrice['amount']);
      const ageDays = ageDaysFromIso(sale['closed_at'], this.now);
      if (price === null || ageDays === null) continue; // vente non datée → inexploitable
      out.push({
        price,
        currency: toCurrency(salePrice['currency'], 'EUR'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: DELCAMPE_URL },
        matchedLabel: typeof sale['title'] === 'string' ? sale['title'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
