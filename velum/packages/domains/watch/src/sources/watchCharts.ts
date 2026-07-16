/**
 * Adaptateur WatchCharts — cote de marché PAR RÉFÉRENCE (agrégateur de prix
 * horlogers, référence du marché secondaire).
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.watchcharts.com/v3/watch/price
 *       ?q=<label>[&reference=<référence constructeur>]
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "quotes": [
 *     {
 *       "name": "Rolex Submariner 124060",
 *       "market_price": 11500,
 *       "currency": "EUR",
 *       "updated_at": "2026-07-01"
 *     }
 *   ]
 * }
 *
 * Une cote sans prix exploitable est ignorée ; date de mise à jour absente →
 * cote du jour. Réponse invalide ou vide → [] (jamais de throw).
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

const WATCHCHARTS_URL = 'https://api.watchcharts.com/v3/watch/price';

export class WatchChartsSource implements PriceSource {
  readonly name = 'WatchCharts';
  readonly kind = 'official_quote' as const;
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
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(WATCHCHARTS_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['quotes'])) return [];
    const out: PriceObservation[] = [];
    for (const quote of raw['quotes']) {
      if (!isRecord(quote)) continue;
      const price = toPositiveNumber(quote['market_price']);
      if (price === null) continue;
      out.push({
        price,
        currency: toCurrency(quote['currency'], 'EUR'),
        // Cote courante : date de mise à jour absente → observation du jour.
        ageDays: ageDaysFromIso(quote['updated_at'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: WATCHCHARTS_URL },
        matchedLabel: typeof quote['name'] === 'string' ? quote['name'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
