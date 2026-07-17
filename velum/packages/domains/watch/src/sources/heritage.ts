/**
 * Adaptateur Heritage Auctions — PRIX RÉALISÉS en maison de vente
 * (département Timepieces). L'endpoint reste désactivé sans agrément partenaire.
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
    this.now = options.now;
  }

  async fetch(query: PriceQuery): Promise<PriceObservation[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['X-Api-Key'] = this.apiKey;
      const raw = await this.transport.getJson(HERITAGE_URL, {
        headers,
        query: { q: query.label, department: 'timepieces' },
      });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['results'])) return [];
    const observations: PriceObservation[] = [];
    for (const lot of raw['results']) {
      if (!isRecord(lot)) continue;
      const price = toPositiveNumber(lot['realizedPrice']);
      const ageDays = ageDaysFromIso(lot['saleDate'], this.now);
      if (price === null || ageDays === null) continue;
      observations.push({
        price,
        currency: toCurrency(lot['currency'], 'USD'),
        ageDays,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: HERITAGE_URL },
        matchedLabel: typeof lot['lotTitle'] === 'string' ? lot['lotTitle'] : query.label,
      });
    }
    return query.limit !== undefined ? observations.slice(0, query.limit) : observations;
  }
}
