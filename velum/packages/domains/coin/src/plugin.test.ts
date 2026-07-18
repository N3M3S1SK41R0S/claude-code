import { describe, expect, it } from 'vitest';
import {
  isVelumError,
  type Candidate,
  type FxRates,
  type PriceObservation,
  type PriceSource,
  type VisionModel,
} from '@velum/core';
import { mulberry32, valuate as engineValuate } from '@velum/valuation';
import { CoinDomainPlugin, coinPlugin, NUMIS_ENGINE } from './plugin.ts';
import { NUMIS_SYSTEM_PROMPT } from './numis.ts';

type VisionRequest = Parameters<VisionModel['complete']>[0];

/** Fake vision : rejoue des réponses fixtures et enregistre les requêtes. */
class FakeVision implements VisionModel {
  readonly requests: VisionRequest[] = [];
  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  async complete(req: VisionRequest): Promise<string> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (next === undefined) throw new Error('FakeVision : plus de réponse fixture');
    return next;
  }
}

function candidate(attributes: Record<string, unknown>, label = '5 Francs Semeuse 1960'): Candidate {
  return { id: 'c1', domain: 'coin', label, confidence: 0.8, attributes };
}

// ── Fixtures de reconnaissance ────────────────────────────────────────────

/** Réponse AVEC fences markdown, désordonnée, avec confiance hors bornes. */
const RECOGNITION_FENCED = [
  '```json',
  JSON.stringify({
    candidates: [
      {
        label: '5 Francs Semeuse 1960',
        confidence: 0.62,
        attributes: { country: 'France', type: '5 Francs Semeuse', year: 1960, metal: 'argent' },
      },
      { label: '5 Francs Semeuse 1962', confidence: 1.4, attributes: { year: 1962 } },
      { label: '2 Francs Semeuse 1979', confidence: 0.15, attributes: {} },
      { label: '1 Franc Semeuse 1975', confidence: 0.4, attributes: { year: 1975 } },
    ],
  }),
  '```',
].join('\n');

/** Réponse corrompue : aucun JSON exploitable. */
const RECOGNITION_CORRUPTED = 'Désolé, je ne peux pas identifier cette pièce avec certitude...';

/** Réponse à faible confiance (entrée floue). */
const RECOGNITION_LOW_CONFIDENCE = JSON.stringify({
  candidates: [
    { label: 'Écu Napoléon III (incertain)', confidence: 0.2, attributes: { metal: 'argent' } },
  ],
});

describe('coinPlugin.recognize — photo', () => {
  it('appelle la vision avec les images, trie, borne et tronque à 3 candidats', async () => {
    const vision = new FakeVision([RECOGNITION_FENCED]);
    const result = await coinPlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'obverse', storagePath: 'a', base64: 'data:image/png;base64,AAA=' },
          { role: 'reverse', storagePath: 'b', base64: 'BBB=' },
          { role: 'edge', storagePath: 'c' }, // sans base64 → exclu de l'appel vision
        ],
      },
      { vision },
    );

    // L'appel vision ne reçoit que les médias porteurs de base64.
    const req = vision.requests[0];
    expect(req?.images).toHaveLength(2);
    expect(req?.images?.[0]).toEqual({ base64: 'AAA=', mediaType: 'image/png' });
    expect(req?.images?.[1]).toEqual({ base64: 'BBB=', mediaType: 'image/jpeg' });
    expect(req?.prompt).toContain('JSON');
    expect(req?.system).toContain('numismatique');

    // Tri décroissant, confiance bornée à 1, top 3.
    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.confidence)).toEqual([1, 0.62, 0.4]);
    expect(result.candidates[0]?.label).toBe('5 Francs Semeuse 1962');
    expect(result.candidates[1]?.attributes['country']).toBe('France');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates.every((c) => c.domain === 'coin')).toBe(true);
  });

  it('réponse corrompue → aucun candidat et bascule en saisie assistée', async () => {
    const vision = new FakeVision([RECOGNITION_CORRUPTED]);
    const result = await coinPlugin.recognize(
      { kind: 'photo', media: [{ role: 'obverse', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('meilleure confiance < 0.35 → needsAssistedEntry (jamais de fausse certitude)', async () => {
    const vision = new FakeVision([RECOGNITION_LOW_CONFIDENCE]);
    const result = await coinPlugin.recognize(
      { kind: 'photo', media: [{ role: 'obverse', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.needsAssistedEntry).toBe(true);
  });
});

describe('coinPlugin.recognize — texte flou', () => {
  it('transmet la description telle quelle et parse la réponse', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: '5 Francs Semeuse argent 1960',
            confidence: 0.55,
            attributes: { country: 'France', year: 1960 },
          },
        ],
      }),
    ]);
    const result = await coinPlugin.recognize(
      { kind: 'text', text: 'vieille pièce argent semeuse 5 francs un peu usée' },
      { vision },
    );
    expect(vision.requests[0]?.prompt).toContain('vieille pièce argent semeuse 5 francs un peu usée');
    expect(vision.requests[0]?.images).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
    expect(result.stage).toBe('llm_vision');
    expect(result.needsAssistedEntry).toBe(false);
  });
});

describe('coinPlugin.recognize — fichier', () => {
  it('mappe chaque ligne en candidat (confiance 0.95, stage assisted)', async () => {
    const vision = new FakeVision([]);
    const rows = [
      { type: '5 Francs Semeuse', year: 1960, metal: 'argent', grade: 'TTB' },
      { label: '20 Francs Coq 1912', year: 1912, metal: 'or' },
    ];
    const result = await coinPlugin.recognize({ kind: 'file', fileRows: rows }, { vision });

    expect(vision.requests).toHaveLength(0); // aucun appel vision pour un import
    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.confidence).toBe(0.95);
    expect(result.candidates[0]?.label).toBe('5 Francs Semeuse 1960');
    expect(result.candidates[0]?.attributes).toEqual(rows[0]);
    expect(result.candidates[1]?.label).toBe('20 Francs Coq 1912');
  });
});

// ── Analyse ───────────────────────────────────────────────────────────────

const ANALYSIS_FENCED = [
  'Voici la fiche :',
  '```json',
  JSON.stringify({
    identification: {
      country: 'France',
      issuer: 'Ve République',
      type: '5 Francs Semeuse',
      year: 1960,
      mintMark: 'Paris',
      metal: 'argent 835‰',
      weightGrams: 12,
      diameterMm: 29,
      mintage: 32530000,
    },
    grade: { scale: 'fr', value: 'ttb', confidence: 0.55, caveat: 'à faire confirmer' },
    rarity: { level: 'courante', note: 'Tirage très élevé' },
    varieties: ['Frappe décentrée connue pour 1960'],
    neighborYears: [{ year: 1959, note: 'Pré-série rare, valeur bien supérieure' }],
    confidence: 0.6,
    // uncertainties volontairement ABSENT → le plugin doit en imposer une.
  }),
  '```',
].join('\n');

describe('coinPlugin.analyze', () => {
  it('produit un payload numis_v1 conforme avec disclaimers et uncertainties', async () => {
    const vision = new FakeVision([ANALYSIS_FENCED]);
    const result = await coinPlugin.analyze(
      candidate({ type: '5 Francs Semeuse', year: 1960 }),
      { vision },
    );

    expect(vision.requests[0]?.system).toBe(NUMIS_SYSTEM_PROMPT);
    expect(vision.requests[0]?.prompt).toContain('5 Francs Semeuse');

    expect(result.engine).toBe(NUMIS_ENGINE);
    expect(result.confidence).toBe(0.6);
    expect(result.payload.identification.country).toBe('France');
    expect(result.payload.identification.mintage).toBe(32530000);
    // Grade normalisé + caveat professionnel imposé.
    expect(result.payload.grade).toEqual({
      scale: 'fr',
      value: 'TTB',
      confidence: 0.55,
      caveat: 'estimation visuelle — seule une gradation professionnelle (PCGS/NGC) fait foi',
    });
    expect(result.payload.rarity).toEqual({ level: 'courante', note: 'Tirage très élevé' });
    expect(result.payload.varieties).toEqual(['Frappe décentrée connue pour 1960']);
    expect(result.payload.neighborYears).toEqual([
      { year: 1959, note: 'Pré-série rare, valeur bien supérieure' },
    ]);
    // uncertainties absent de la réponse → au moins une entrée imposée.
    expect(result.payload.uncertainties.length).toBeGreaterThanOrEqual(1);
    // Disclaimers TOUJOURS non vides, avec la mention réglementaire de base.
    expect(result.disclaimers).toContain(
      'Estimation indicative — ni expertise légale, ni conseil en investissement.',
    );
    expect(result.disclaimers.length).toBeGreaterThanOrEqual(2);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('réponse corrompue → VelumError ANALYSIS_FAILED', async () => {
    const vision = new FakeVision(['<html>erreur 502</html>']);
    await expect(
      coinPlugin.analyze(candidate({}), { vision }),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'ANALYSIS_FAILED');
  });
});

// ── buildPriceQuery ───────────────────────────────────────────────────────

describe('coinPlugin.buildPriceQuery', () => {
  it('compose le libellé canonique et normalise le grade en condition', () => {
    const query = coinPlugin.buildPriceQuery(
      candidate({
        country: 'France',
        type: '5 Francs Semeuse',
        year: 1960,
        mintMark: 'A',
        grade: 'ttb',
      }),
    );
    expect(query.domain).toBe('coin');
    expect(query.label).toBe('France 5 Francs Semeuse 1960 A');
    expect(query.condition).toBe('TTB');
    expect(query.attributes['year']).toBe(1960);
  });

  it('sans type structuré, retombe sur le label du candidat ; sans grade, pas de condition', () => {
    const query = coinPlugin.buildPriceQuery(candidate({}, 'Écu Louis XV'));
    expect(query.label).toBe('Écu Louis XV');
    expect(query.condition).toBeUndefined();
  });
});

// ── Valorisation bout-en-bout avec le moteur RÉEL ─────────────────────────

function obs(
  price: number,
  currency: string,
  kind: PriceSource['kind'],
  ageDays: number,
  sourceName: string,
): PriceObservation {
  return {
    price,
    currency,
    ageDays,
    sourceWeight: kind === 'auction_realized' ? 1 : 0.7,
    source: { name: sourceName, kind },
  };
}

describe('coinPlugin.valuate — bout-en-bout avec @velum/valuation', () => {
  const fx: FxRates = { USD: 0.9 };
  const deps = (sources: PriceSource[]) => ({
    sources,
    fx,
    valuate: (o: PriceObservation[], f: FxRates) =>
      engineValuate(o, f, { rng: mulberry32(42) }),
  });

  it('agrège 2 sources, tolère une source en échec, et retourne central/IC/nSources', async () => {
    const sourceA: PriceSource = {
      name: 'eBay sold',
      kind: 'marketplace_sold',
      fetch: async () => [
        obs(100, 'EUR', 'marketplace_sold', 10, 'eBay sold'),
        obs(110, 'EUR', 'marketplace_sold', 30, 'eBay sold'),
        obs(104, 'EUR', 'marketplace_sold', 5, 'eBay sold'),
      ],
    };
    const sourceB: PriceSource = {
      name: 'Heritage',
      kind: 'auction_realized',
      fetch: async () => [obs(120, 'USD', 'auction_realized', 60, 'Heritage')],
    };
    const failing: PriceSource = {
      name: 'en panne',
      kind: 'listing',
      fetch: async () => {
        throw new Error('réseau indisponible');
      },
    };

    const result = await coinPlugin.valuate(
      candidate({ type: '5 Francs Semeuse', year: 1960, grade: 'TTB' }),
      deps([sourceA, sourceB, failing]),
    );

    // 4 observations conservées, issues de 2 plateformes distinctes.
    expect(result.nSources).toBe(2);
    expect(result.currency).toBe('EUR');
    expect(result.central).toBeGreaterThanOrEqual(100);
    expect(result.central).toBeLessThanOrEqual(110);
    expect(result.ci80[0]).toBeLessThanOrEqual(result.central);
    expect(result.ci80[1]).toBeGreaterThanOrEqual(result.central);
    expect(result.ci95[0]).toBeLessThanOrEqual(result.ci80[0]);
    expect(result.ci95[1]).toBeGreaterThanOrEqual(result.ci80[1]);
    expect(result.reliability).toBeGreaterThan(0);
    expect(result.observations).toHaveLength(4);
  });

  it('aucune observation → VelumError NO_OBSERVATIONS remonte du moteur', async () => {
    const empty: PriceSource = { name: 'vide', kind: 'listing', fetch: async () => [] };
    await expect(
      coinPlugin.valuate(candidate({}), deps([empty])),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'NO_OBSERVATIONS');
  });
});

describe('exports', () => {
  it('expose une instance et une classe', () => {
    expect(coinPlugin).toBeInstanceOf(CoinDomainPlugin);
    expect(coinPlugin.domain).toBe('coin');
  });
});
