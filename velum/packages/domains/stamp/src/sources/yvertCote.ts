/**
 * Adaptateur Yvert & Tellier — cote catalogue PAR ÉTAT (référence pour la
 * France et les colonies françaises).
 * kind: 'official_quote' → poids par défaut 0.9.
 *
 * URL construite :
 *   GET https://api.yvert.com/v1/cotes
 *       ?q=<label>[&numero=<n° de catalogue>][&etat=<condition>]
 *   avec l'en-tête 'Authorization: Bearer <apiKey>' si une clé est fournie.
 *
 * Forme de réponse attendue (exemple) :
 * {
 *   "cotes": [
 *     {
 *       "designation": "Semeuse lignée 15c vert-gris",
 *       "etat": "neuf_sans_charniere",
 *       "valeur": 12,
 *       "devise": "EUR",
 *       "maj": "2026-05-01"
 *     }
 *   ]
 * }
 *
 * Cote par état : si un état est demandé (query.condition), seules ses lignes
 * sont retenues. Réponse invalide ou vide → [] (jamais de throw).
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

const YVERT_URL = 'https://api.yvert.com/v1/cotes';

export class YvertCoteSource implements PriceSource {
  readonly name = 'Yvert & Tellier';
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
      const numero = query.attributes['catalogNumber'];
      if (typeof numero === 'string' && numero.trim() !== '') params['numero'] = numero.trim();
      if (query.condition !== undefined) params['etat'] = query.condition;
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const raw = await this.transport.getJson(YVERT_URL, { headers, query: params });
      return this.mapResponse(raw, query);
    } catch {
      return [];
    }
  }

  private mapResponse(raw: unknown, query: PriceQuery): PriceObservation[] {
    if (!isRecord(raw) || !Array.isArray(raw['cotes'])) return [];
    const out: PriceObservation[] = [];
    for (const entry of raw['cotes']) {
      if (!isRecord(entry)) continue;
      const etat = typeof entry['etat'] === 'string' ? entry['etat'] : undefined;
      // Cote par état : si un état est demandé, on ne retient que ses lignes.
      if (
        query.condition !== undefined &&
        etat !== undefined &&
        etat.toLowerCase() !== query.condition.toLowerCase()
      ) {
        continue;
      }
      const price = toPositiveNumber(entry['valeur']);
      if (price === null) continue;
      const designation =
        typeof entry['designation'] === 'string' ? entry['designation'] : query.label;
      out.push({
        price,
        currency: toCurrency(entry['devise'], 'EUR'),
        // Cote courante : date de mise à jour absente → observation du jour.
        ageDays: ageDaysFromIso(entry['maj'], this.now) ?? 0,
        sourceWeight: DEFAULT_SOURCE_WEIGHTS[this.kind],
        source: { name: this.name, kind: this.kind, url: YVERT_URL },
        matchedLabel: etat !== undefined ? `${designation} (${etat})` : designation,
      });
    }
    return query.limit !== undefined ? out.slice(0, query.limit) : out;
  }
}
