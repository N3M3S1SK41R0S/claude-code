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
import { CONDITION_CAVEAT, PHILA_ENGINE, StampDomainPlugin, stampPlugin } from './plugin.ts';
import { PHILA_SYSTEM_PROMPT } from './phila.ts';

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

function candidate(
  attributes: Record<string, unknown>,
  label = 'Semeuse lignée 15c 1903',
): Candidate {
  return { id: 's1', domain: 'stamp', label, confidence: 0.8, attributes };
}

// ── Fixtures de reconnaissance ────────────────────────────────────────────

/** Réponse AVEC fences markdown, désordonnée, avec confiance hors bornes. */
const RECOGNITION_FENCED = [
  '```json',
  JSON.stringify({
    candidates: [
      {
        label: 'Semeuse lignée 15c vert-gris (YT 130)',
        confidence: 0.64,
        attributes: {
          country: 'France',
          title: 'Semeuse lignée',
          year: 1903,
          faceValue: '15c',
          catalogNumber: 'YT 130',
          catalog: 'yvert_tellier',
        },
      },
      { label: 'Semeuse camée 10c (YT 138)', confidence: 1.6, attributes: { year: 1907 } },
      { label: 'Blanc 5c vert (YT 111)', confidence: 0.12, attributes: {} },
      { label: 'Semeuse lignée 10c (YT 129)', confidence: 0.41, attributes: { year: 1903 } },
    ],
  }),
  '```',
].join('\n');

/** Réponse corrompue : aucun JSON exploitable. */
const RECOGNITION_CORRUPTED = 'Désolé, je ne peux pas identifier ce timbre avec certitude...';

/** Réponse à faible confiance (entrée floue). */
const RECOGNITION_LOW_CONFIDENCE = JSON.stringify({
  candidates: [
    { label: 'Cérès 20c noir (incertain)', confidence: 0.2, attributes: { country: 'France' } },
  ],
});

describe('stampPlugin.recognize — photo', () => {
  it('appelle la vision avec les images, trie, borne et tronque à 3 candidats', async () => {
    const vision = new FakeVision([RECOGNITION_FENCED]);
    const result = await stampPlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'front', storagePath: 'a', base64: 'data:image/png;base64,AAA=' },
          { role: 'back', storagePath: 'b', base64: 'BBB=' },
          { role: 'detail', storagePath: 'c' }, // sans base64 → exclu de l'appel vision
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
    expect(req?.prompt).toContain('recto');
    expect(req?.prompt).toContain('verso (gomme)');
    expect(req?.system).toContain('philatélique');

    // Tri décroissant, confiance bornée à 1, top 3.
    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.confidence)).toEqual([1, 0.64, 0.41]);
    expect(result.candidates[0]?.label).toBe('Semeuse camée 10c (YT 138)');
    expect(result.candidates[1]?.attributes['country']).toBe('France');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates.every((c) => c.domain === 'stamp')).toBe(true);
  });

  it('réponse corrompue → aucun candidat et bascule en saisie assistée', async () => {
    const vision = new FakeVision([RECOGNITION_CORRUPTED]);
    const result = await stampPlugin.recognize(
      { kind: 'photo', media: [{ role: 'front', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('meilleure confiance < 0.35 → needsAssistedEntry (jamais de fausse certitude)', async () => {
    const vision = new FakeVision([RECOGNITION_LOW_CONFIDENCE]);
    const result = await stampPlugin.recognize(
      { kind: 'photo', media: [{ role: 'front', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.needsAssistedEntry).toBe(true);
  });
});

describe('stampPlugin.recognize — texte flou', () => {
  it('transmet la description telle quelle et parse la réponse', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'Semeuse lignée 15c 1903',
            confidence: 0.5,
            attributes: { country: 'France', year: 1903 },
          },
        ],
      }),
    ]);
    const result = await stampPlugin.recognize(
      { kind: 'text', text: 'vieux timbre français vert avec une semeuse, un peu jauni' },
      { vision },
    );
    expect(vision.requests[0]?.prompt).toContain(
      'vieux timbre français vert avec une semeuse, un peu jauni',
    );
    expect(vision.requests[0]?.images).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
    expect(result.stage).toBe('llm_vision');
    expect(result.needsAssistedEntry).toBe(false);
  });
});

describe('stampPlugin.recognize — fichier', () => {
  it('mappe chaque ligne en candidat (confiance 0.95, stage assisted)', async () => {
    const vision = new FakeVision([]);
    const rows = [
      { title: 'Semeuse lignée 15c', year: 1903, catalogNumber: 'YT 130', status: 'oblitere' },
      { catalogNumber: 'yt 262', country: 'France' },
    ];
    const result = await stampPlugin.recognize({ kind: 'file', fileRows: rows }, { vision });

    expect(vision.requests).toHaveLength(0); // aucun appel vision pour un import
    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.confidence).toBe(0.95);
    expect(result.candidates[0]?.label).toBe('Semeuse lignée 15c 1903');
    expect(result.candidates[0]?.attributes).toEqual(rows[0]);
    expect(result.candidates[1]?.label).toBe('YT 262'); // référence normalisée
  });
});

// ── Analyse ───────────────────────────────────────────────────────────────

const ANALYSIS_FENCED = [
  'Voici la fiche :',
  '```json',
  JSON.stringify({
    identification: {
      country: 'France',
      catalogNumber: 'yt 130',
      title: 'Semeuse lignée',
      year: 1903,
      faceValue: '15c',
      color: 'vert-gris',
      perforation: '14 × 13½',
      printingMethod: 'typographie',
    },
    condition: {
      status: 'neuf_avec_charniere',
      gum: 'intacte',
      centering: 'bon',
      faults: ['trace de charnière propre'],
      confidence: 0.55,
      caveat: 'à faire confirmer', // caveat non conforme → le plugin impose le sien
    },
    rarity: { level: 'courante', note: 'Émission très courante, sauf nuances rares' },
    varieties: ['Nuance vert-bleu cotée séparément', 'Papier GC (Grande Consommation)'],
    neighborIssues: [
      { catalogNumber: 'YT 129', note: 'Type I/II de la 10c, valeur très différente' },
    ],
    confidence: 0.6,
    // uncertainties volontairement ABSENT → le plugin doit en imposer une.
  }),
  '```',
].join('\n');

describe('stampPlugin.analyze', () => {
  it('produit un payload phila_v1 conforme avec disclaimers et uncertainties', async () => {
    const vision = new FakeVision([ANALYSIS_FENCED]);
    const result = await stampPlugin.analyze(
      candidate({ title: 'Semeuse lignée', year: 1903 }),
      { vision },
    );

    expect(vision.requests[0]?.system).toBe(PHILA_SYSTEM_PROMPT);
    expect(vision.requests[0]?.prompt).toContain('Semeuse lignée');

    expect(result.engine).toBe(PHILA_ENGINE);
    expect(result.confidence).toBe(0.6);
    expect(result.payload.identification.country).toBe('France');
    // Référence de catalogue normalisée ("yt 130" → "YT 130" + catalogue déduit).
    expect(result.payload.identification.catalogNumber).toBe('YT 130');
    expect(result.payload.identification.catalog).toBe('yvert_tellier');
    expect(result.payload.identification.perforation).toBe('14 × 13½');
    // État conforme + caveat d'expertise imposé.
    expect(result.payload.condition).toEqual({
      status: 'neuf_avec_charniere',
      gum: 'intacte',
      centering: 'bon',
      faults: ['trace de charnière propre'],
      confidence: 0.55,
      caveat: CONDITION_CAVEAT,
    });
    expect(result.payload.rarity).toEqual({
      level: 'courante',
      note: 'Émission très courante, sauf nuances rares',
    });
    expect(result.payload.varieties).toHaveLength(2);
    expect(result.payload.neighborIssues).toEqual([
      { catalogNumber: 'YT 129', note: 'Type I/II de la 10c, valeur très différente' },
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
      stampPlugin.analyze(candidate({}), { vision }),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'ANALYSIS_FAILED');
  });
});

// ── buildPriceQuery ───────────────────────────────────────────────────────

describe('stampPlugin.buildPriceQuery', () => {
  it('compose le libellé canonique et inclut le statut philatélique en condition', () => {
    const query = stampPlugin.buildPriceQuery(
      candidate({
        country: 'France',
        title: 'Semeuse lignée',
        faceValue: '15c',
        year: 1903,
        catalogNumber: 'yt 130',
        status: 'neuf_sans_charniere',
      }),
    );
    expect(query.domain).toBe('stamp');
    expect(query.label).toBe('France Semeuse lignée 15c 1903 YT 130');
    expect(query.condition).toBe('neuf_sans_charniere');
    expect(query.attributes['year']).toBe(1903);
  });

  it('normalise les statuts saisis librement ("**" → neuf_sans_charniere)', () => {
    const query = stampPlugin.buildPriceQuery(
      candidate({ catalogNumber: 'YT 262', condition: '**' }),
    );
    expect(query.label).toBe('YT 262');
    expect(query.condition).toBe('neuf_sans_charniere');
  });

  it('sans série ni référence, retombe sur le label du candidat ; sans statut, pas de condition', () => {
    const query = stampPlugin.buildPriceQuery(candidate({}, 'Cérès 20c noir'));
    expect(query.label).toBe('Cérès 20c noir');
    expect(query.condition).toBeUndefined();
  });
});

// ── Valorisation bout-en-bout avec le moteur RÉEL ─────────────────────────

function obs(
  price: number,
  currency: string,
  kind: PriceSource['kind'],
  ageDays: number,
): PriceObservation {
  return {
    price,
    currency,
    ageDays,
    sourceWeight: kind === 'official_quote' ? 0.9 : 0.7,
    source: { name: 'fixture', kind },
  };
}

describe('stampPlugin.valuate — bout-en-bout avec @velum/valuation', () => {
  const fx: FxRates = { USD: 0.9 };
  const deps = (sources: PriceSource[]) => ({
    sources,
    fx,
    valuate: (o: PriceObservation[], f: FxRates) =>
      engineValuate(o, f, { rng: mulberry32(42) }),
  });

  it('agrège 2 sources, tolère une source en échec, et retourne central/IC/nSources', async () => {
    const sourceA: PriceSource = {
      name: 'Delcampe',
      kind: 'marketplace_sold',
      fetch: async () => [
        obs(40, 'EUR', 'marketplace_sold', 10),
        obs(46, 'EUR', 'marketplace_sold', 30),
        obs(42, 'EUR', 'marketplace_sold', 5),
      ],
    };
    const sourceB: PriceSource = {
      name: 'Yvert & Tellier',
      kind: 'official_quote',
      fetch: async () => [obs(50, 'USD', 'official_quote', 60)],
    };
    const failing: PriceSource = {
      name: 'en panne',
      kind: 'listing',
      fetch: async () => {
        throw new Error('réseau indisponible');
      },
    };

    const result = await stampPlugin.valuate(
      candidate({ title: 'Semeuse lignée', year: 1903, status: 'oblitere' }),
      deps([sourceA, sourceB, failing]),
    );

    // 4 observations conservées (40, 46, 42 EUR + 50 USD → 45 EUR).
    expect(result.nSources).toBe(4);
    expect(result.currency).toBe('EUR');
    expect(result.central).toBeGreaterThanOrEqual(40);
    expect(result.central).toBeLessThanOrEqual(46);
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
      stampPlugin.valuate(candidate({}), deps([empty])),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'NO_OBSERVATIONS');
  });
});

describe('exports', () => {
  it('expose une instance et une classe', () => {
    expect(stampPlugin).toBeInstanceOf(StampDomainPlugin);
    expect(stampPlugin.domain).toBe('stamp');
  });
});
