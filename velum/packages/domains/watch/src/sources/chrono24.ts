/**
 * Adaptateur Chrono24 — ANNONCES EN COURS (prix demandés, pas des ventes).
 * kind: 'listing' → poids par défaut 0.4 : un prix demandé n'est pas un prix
 * payé ; l'observation informe la fourchette sans jamais dominer les ventes
 * réalisées (Heritage, eBay vendu, Catawiki).
 *
 * URL construite :
 *   GET https://api.chrono24.com/v1/listings/search
 *       ?q=<label>[&reference=<référence constructeur>][&limit=<limit>]
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "listings": [
 *     {
 *       "title": "Rolex Submariner 124060 — 2022 — full set",
 *       "listed_at": "2026-07-01",
 *       "price": { "amount": 11900, "currency": "EUR" }
 *     }
 *   ]
 * }
 *
 * Une annonce sans prix exploitable est ignorée ; date de publication absente
 * → annonce du jour. Réponse invalide ou vide → [] (jamais de throw).
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
    this.now = options.now ?? (() => new Date());
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
    const out: PriceObservation[] = [];
    for (const listing of raw['listings']) {
      if (!isRecord(listing)) continue;
      const askPrice = listing['price'];
      if (!isRecord(askPrice)) continue;
      const price = toPositiveNumber(askPrice['amount']);
      if (price === null) continue;
      out.push({
        price,
        currency: toCurrency(askPrice['currency'], 'EUR'),
        // Annonce en cours : date de publication absente → observation du jour.
        ageDays: ageDaysFromIso(listing['listed_at'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: CHRONO24_URL },
        matchedLabel: typeof listing['title'] === 'string' ? listing['title'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
