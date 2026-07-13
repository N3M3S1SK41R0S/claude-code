/**
 * Adaptateur Colnect (§9) — cotes du catalogue collaboratif philatélique.
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.colnect.net/fr/api/stamps/list
 *       ?q=<label>[&year=<année>][&country=<pays>]
 *   avec l'en-tête 'X-Colnect-Api-Key: <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "items": [
 *     {
 *       "name": "Semeuse lignée 15c vert-gris",
 *       "catalog_value": 8.5,
 *       "currency": "EUR",
 *       "updated_at": "2026-06-01"
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
import { isRecord } from '../json.ts';
import {
  ageDaysFromIso,
  toCurrency,
  toPositiveNumber,
  type SourceAdapterOptions,
  type Transport,
} from './transport.ts';

const COLNECT_URL = 'https://api.colnect.net/fr/api/stamps/list';

export class ColnectSource implements PriceSource {
  readonly name = 'Colnect';
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
      const year = query.attributes['year'];
      if (typeof year === 'number' || typeof year === 'string') params['year'] = String(year);
      const country = query.attributes['country'];
      if (typeof country === 'string') params['country'] = country;
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['X-Colnect-Api-Key'] = this.apiKey;
      const raw = await this.transport.getJson(COLNECT_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return []; // une source en échec ne bloque jamais la valorisation
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['items'])) return [];
    const out: PriceObservation[] = [];
    for (const item of raw['items']) {
      if (!isRecord(item)) continue;
      const price = toPositiveNumber(item['catalog_value']);
      if (price === null) continue;
      out.push({
        price,
        currency: toCurrency(item['currency'], 'EUR'),
        // Cote courante : date de mise à jour absente → observation du jour.
        ageDays: ageDaysFromIso(item['updated_at'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: COLNECT_URL },
        matchedLabel: typeof item['name'] === 'string' ? item['name'] : query.label,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
