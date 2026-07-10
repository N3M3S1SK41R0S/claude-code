/**
 * Adaptateur Numista (§9) — cotes du catalogue collaboratif de référence.
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.numista.com/api/v3/types
 *       ?q=<label>&category=coin[&year=<année>]
 *   avec l'en-tête 'Numista-API-Key: <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "types": [
 *     {
 *       "id": 2506,
 *       "title": "5 francs Semeuse (argent)",
 *       "prices": [
 *         { "grade": "TTB", "value": 14.5, "currency": "EUR", "date": "2026-06-01" }
 *       ]
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

const NUMISTA_URL = 'https://api.numista.com/api/v3/types';

export class NumistaSource implements PriceSource {
  readonly name = 'Numista';
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
      const params: Record<string, string> = { q: query.label, category: 'coin' };
      const year = query.attributes['year'];
      if (typeof year === 'number' || typeof year === 'string') params['year'] = String(year);
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Numista-API-Key'] = this.apiKey;
      const raw = await this.transport.getJson(NUMISTA_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return []; // une source en échec ne bloque jamais la valorisation
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['types'])) return [];
    const out: PriceObservation[] = [];
    for (const type of raw['types']) {
      if (!isRecord(type) || !Array.isArray(type['prices'])) continue;
      const title = typeof type['title'] === 'string' ? type['title'] : query.label;
      for (const entry of type['prices']) {
        if (!isRecord(entry)) continue;
        const grade = typeof entry['grade'] === 'string' ? entry['grade'] : undefined;
        // Cote par grade : si un état est demandé, on ne retient que sa ligne.
        if (
          query.condition !== undefined &&
          grade !== undefined &&
          grade.toUpperCase() !== query.condition.toUpperCase()
        ) {
          continue;
        }
        const price = toPositiveNumber(entry['value']);
        // Cote courante : date de mise à jour absente → observation du jour.
        const ageDays = ageDaysFromIso(entry['date'], this.now) ?? 0;
        if (price === null) continue;
        out.push({
          price,
          currency: toCurrency(entry['currency'], 'EUR'),
          ageDays,
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: { name: this.name, kind: this.kind, url: NUMISTA_URL },
          matchedLabel: grade !== undefined ? `${title} (${grade})` : title,
        });
      }
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
