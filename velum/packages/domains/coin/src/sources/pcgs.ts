/**
 * Adaptateur PCGS Price Guide — cote officielle PAR GRADE.
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.pcgs.com/publicapi/priceguide/GetPriceByGrade
 *       ?q=<label>[&grade=<condition>]
 *   avec l'en-tête 'authorization: bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple — objet unique) :
 * {
 *   "CoinTitle": "1904-O Morgan Dollar",
 *   "Grade": "MS65",
 *   "PriceGuideValue": 450,
 *   "Currency": "USD",
 *   "LastUpdated": "2026-06-20T00:00:00Z"
 * }
 *
 * Réponse invalide ou sans cote → [] (dégradation gracieuse, jamais de throw).
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

const PCGS_URL = 'https://api.pcgs.com/publicapi/priceguide/GetPriceByGrade';

export class PcgsSource implements PriceSource {
  readonly name = 'PCGS Price Guide';
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
      if (this.apiKey !== undefined) headers['authorization'] = `bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(PCGS_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw)) return [];
    const price = toPositiveNumber(raw['PriceGuideValue']);
    if (price === null) return [];
    const grade = typeof raw['Grade'] === 'string' ? raw['Grade'] : undefined;
    const title = typeof raw['CoinTitle'] === 'string' ? raw['CoinTitle'] : query.label;
    return [
      {
        price,
        currency: toCurrency(raw['Currency'], 'USD'),
        // Cote courante : LastUpdated absente → observation du jour.
        ageDays: ageDaysFromIso(raw['LastUpdated'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: PCGS_URL },
        matchedLabel: grade !== undefined ? `${title} (${grade})` : title,
      },
    ];
  }
}
