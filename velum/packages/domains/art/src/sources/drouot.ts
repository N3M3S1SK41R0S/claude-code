/**
 * Adaptateur Drouot (§9) — résultats d'adjudication de l'hôtel des ventes,
 * kind 'auction_realized' (poids maximal : ventes réellement conclues).
 * Place de marché française : prix toujours exprimés en EUR.
 *
 * URL : GET https://api.drouot.com/v1/resultats?q=<label>&limit=<n>
 * Réponse documentée :
 * {
 *   "resultats": [
 *     {
 *       "lot": "École française du XIXe — Paysage animé, huile sur toile",
 *       "adjudicationEur": 4200,
 *       "dateVente": "2026-04-12",
 *       "url": "https://www.drouot.com/l/12345-ecole-francaise-paysage"
 *     }
 *   ]
 * }
 * Réponse invalide ou vide → [] (dégradation gracieuse, jamais de throw).
 */
import {
  DEFAULT_SOURCE_WEIGHTS,
  type PriceObservation,
  type PriceQuery,
  type PriceSource,
  type SourceKind,
} from '@velum/core';
import { asFiniteNumber, asNonEmptyString, isRecord } from '../guards';
import { isoToAgeDays, type SourceAdapterOptions, type Transport } from '../transport';

const BASE_URL = 'https://api.drouot.com/v1/resultats';

export class DrouotSource implements PriceSource {
  readonly name = 'Drouot';
  readonly kind: SourceKind = 'auction_realized';

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
      const raw = await this.transport.getJson(BASE_URL, {
        query: {
          q: query.label,
          limit: String(query.limit ?? 20),
        },
        ...(this.apiKey ? { headers: { authorization: `Bearer ${this.apiKey}` } } : {}),
      });
      if (!isRecord(raw) || !Array.isArray(raw['resultats'])) return [];

      const observations: PriceObservation[] = [];
      for (const entry of raw['resultats']) {
        if (!isRecord(entry)) continue;
        const price = asFiniteNumber(entry['adjudicationEur']);
        if (price === undefined || price <= 0) continue;
        observations.push({
          price,
          currency: 'EUR',
          ageDays: isoToAgeDays(entry['dateVente'], this.now),
          sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
          source: {
            name: this.name,
            kind: this.kind,
            url: asNonEmptyString(entry['url']) ?? BASE_URL,
          },
          matchedLabel: asNonEmptyString(entry['lot']),
        });
      }
      return observations;
    } catch {
      return []; // source indisponible → dégradation gracieuse
    }
  }
}
