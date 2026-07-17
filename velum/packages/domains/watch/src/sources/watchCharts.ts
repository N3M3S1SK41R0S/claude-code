/**
 * Adaptateur WatchCharts — cote de marché par marque + référence.
 *
 * Contrat officiel v3 :
 *   1. GET /v3/search/watch?brand_name=...&reference=...&exact_match=true
 *      → UUID de la montre ;
 *   2. GET /v3/watch/info?uuid=...&currency=EUR
 *      → market_price et date de mise à jour.
 *
 * Chaque requête utilise `x-api-key`. WatchCharts limite une clé à une requête
 * par seconde : toutes les instances partageant une clé passent par la même
 * file FIFO et chaque tentative réseau est suivie d'un cooldown de 1,1 s.
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
  createKeyedRateLimiter,
  toPositiveNumber,
  type KeyedRateLimiter,
  type SourceAdapterOptions,
  type Transport,
} from './transport.ts';

const WATCHCHARTS_SEARCH_URL = 'https://api.watchcharts.com/v3/search/watch';
const WATCHCHARTS_INFO_URL = 'https://api.watchcharts.com/v3/watch/info';
const REQUEST_INTERVAL_MS = 1_100;
const SHARED_LIMITER = createKeyedRateLimiter();

type RequestInit = { headers?: Record<string, string>; query?: Record<string, string> };

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstWatchUuid(raw: unknown): string | null {
  if (!isRecord(raw) || !Array.isArray(raw['results'])) return null;
  for (const result of raw['results']) {
    if (!isRecord(result)) continue;
    const uuid = nonEmptyString(result['uuid']);
    if (uuid !== null) return uuid;
  }
  return null;
}

function matchedLabel(raw: Record<string, unknown>, fallback: string): string {
  const parts = [raw['brand'], raw['collection'], raw['model']]
    .map(nonEmptyString)
    .filter((value): value is string => value !== null);
  return parts.length > 0 ? parts.join(' ') : fallback;
}

export class WatchChartsSource implements PriceSource {
  readonly name = 'WatchCharts';
  readonly kind = 'official_quote' as const;
  private readonly transport: Transport;
  private readonly apiKey: string | undefined;
  private readonly now: () => Date;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly limiter: KeyedRateLimiter;

  constructor(options: SourceAdapterOptions) {
    this.transport = options.transport;
    this.apiKey = options.apiKey;
    this.now = options.now;
    this.wait =
      options.wait ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.limiter = options.limiter ?? SHARED_LIMITER;
  }

  private getJsonRateLimited(
    apiKey: string,
    url: string,
    init: RequestInit,
  ): Promise<unknown> {
    return this.limiter.run(
      apiKey,
      () => this.transport.getJson(url, init),
      () => this.wait(REQUEST_INTERVAL_MS),
    );
  }

  async fetch(query: PriceQuery): Promise<PriceObservation[]> {
    const brand = nonEmptyString(query.attributes['brand']);
    const reference = nonEmptyString(query.attributes['reference']);
    const apiKey = nonEmptyString(this.apiKey);
    if (brand === null || reference === null || apiKey === null) return [];

    const headers = { 'x-api-key': apiKey };
    try {
      const search = await this.getJsonRateLimited(apiKey, WATCHCHARTS_SEARCH_URL, {
        headers,
        query: {
          brand_name: brand,
          reference,
          exact_match: 'true',
        },
      });
      const uuid = firstWatchUuid(search);
      if (uuid === null) return [];

      const info = await this.getJsonRateLimited(apiKey, WATCHCHARTS_INFO_URL, {
        headers,
        query: { uuid, currency: 'EUR' },
      });
      if (!isRecord(info)) return [];

      const price = toPositiveNumber(info['market_price']);
      const ageDays = ageDaysFromIso(info['updated'], this.now);
      if (price === null || ageDays === null) return [];

      return [
        {
          price,
          currency: 'EUR',
          ageDays,
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: { name: this.name, kind: this.kind, url: WATCHCHARTS_INFO_URL },
          matchedLabel: matchedLabel(info, query.label),
        },
      ];
    } catch {
      return [];
    }
  }
}
