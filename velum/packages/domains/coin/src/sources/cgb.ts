/**
 * Adaptateur CGB Numismatique Paris — annonces boutique EN COURS
 * (prix demandés, pas des ventes conclues).
 * kind: 'listing' → poids par défaut 0.4 (le plus faible : prix demandés).
 *
 * URL construite :
 *   GET https://api.cgb.fr/v1/search
 *       ?q=<label>
 *   avec l'en-tête 'X-Api-Key: <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "items": [
 *     {
 *       "name": "5 francs Semeuse 1960 - TTB",
 *       "price": 95,
 *       "currency": "EUR",
 *       "listed_at": "2026-07-01"
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

const CGB_URL = 'https://api.cgb.fr/v1/search';

export class CgbSource implements PriceSource {
  readonly name = 'CGB Numismatique';
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
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['X-Api-Key'] = this.apiKey;
      const raw = await this.transport.getJson(CGB_URL, { headers, query: { q: query.label } });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['items'])) return [];
    const out: PriceObservation[] = [];
    for (const item of raw['items']) {
      if (!isRecord(item)) continue;
      const price = toPositiveNumber(item['price']);
      if (price === null) continue;
      out.push({
        price,
        currency: toCurrency(item['currency'], 'EUR'),
        // Annonce en cours : date de mise en ligne absente → observation du jour.
        ageDays: ageDaysFromIso(item['listed_at'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: CGB_URL },
        matchedLabel: typeof item['name'] === 'string' ? item['name'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
