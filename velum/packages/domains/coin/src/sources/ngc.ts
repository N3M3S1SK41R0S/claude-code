/**
 * Adaptateur NGC Price Guide — cotes officielles NGC.
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.ngccoin.com/api/price-guide
 *       ?q=<label>[&grade=<condition>]
 *   avec l'en-tête 'x-api-key: <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "results": [
 *     {
 *       "description": "France 5F 1960 Semeuse",
 *       "grade": "MS64",
 *       "price": 320,
 *       "currency": "USD",
 *       "asOf": "2026-06-01"
 *     }
 *   ]
 * }
 *
 * Réponse invalide ou vide → [] (dégradation gracieuse, jamais de throw).
 */
import {
  DEFAULT_SOURCE_WEIGHTS,
  type PriceObservation,
  type PriceQuery,
  type PriceSource,
} from '@velum/core';
import { isRecord } from '../json';
import {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './transport';

const NGC_URL = 'https://api.ngccoin.com/api/price-guide';

export class NgcSource implements PriceSource {
  readonly name = 'NGC Price Guide';
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
      if (query.condition !== undefined) params['grade'] = query.condition;
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['x-api-key'] = this.apiKey;
      const raw = await this.transport.getJson(NGC_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['results'])) return [];
    const out: PriceObservation[] = [];
    for (const entry of raw['results']) {
      if (!isRecord(entry)) continue;
      const price = toPositiveNumber(entry['price']);
      if (price === null) continue;
      const grade = typeof entry['grade'] === 'string' ? entry['grade'] : undefined;
      const title = typeof entry['description'] === 'string' ? entry['description'] : query.label;
      out.push({
        price,
        currency: toCurrency(entry['currency'], 'USD'),
        // Cote courante : date absente → observation du jour.
        ageDays: ageDaysFromIso(entry['asOf'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: NGC_URL },
        matchedLabel: grade !== undefined ? `${title} (${grade})` : title,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
