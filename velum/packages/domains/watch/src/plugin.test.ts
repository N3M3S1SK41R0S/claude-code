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
import { CONDITION_CAVEAT, WATCH_ENGINE, WatchDomainPlugin, watchPlugin } from './plugin.ts';
import { WATCH_SYSTEM_PROMPT } from './horo.ts';

type VisionRequest = Parameters<VisionModel['complete']>[0];

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
  label = 'Rolex Submariner 124060',
): Candidate {
  return { id: 'w1', domain: 'watch', label, confidence: 0.8, attributes };
}

const RECOGNITION_FENCED = [
  '```json',
  JSON.stringify({
    candidates: [
      {
        label: 'Rolex Submariner 124060',
        confidence: 0.64,
        attributes: {
          brand: ' Rolex ',
          model: 'Submariner',
          reference: '124060',
          year: 2022,
          gender: 'homme',
          caseMaterial: 'acier',
          caseDiameterMm: 41,
          arbitrary: 'écarté',
        },
      },
      { label: 'Rolex Submariner 114060', confidence: 1.6, attributes: { reference: '114060' } },
      { label: 'Tudor Black Bay 58', confidence: 0.12, attributes: {} },
      { label: 'Rolex Sea-Dweller 126600', confidence: 0.41, attributes: { reference: '126600' } },
    ],
  }),
  '```',
].join('\n');

const RECOGNITION_CORRUPTED = 'Désolé, je ne peux pas identifier cette montre avec certitude...';

const RECOGNITION_LOW_CONFIDENCE = JSON.stringify({
  candidates: [
    { label: 'Montre de plongée acier (incertain)', confidence: 0.2, attributes: {} },
  ],
});

describe('watchPlugin.recognize — photo', () => {
  it('appelle la vision, valide les attributs et dégrade une confiance hors plage', async () => {
    const vision = new FakeVision([RECOGNITION_FENCED]);
    const result = await watchPlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'dial', storagePath: 'a', base64: 'data:image/png;base64,AAA=' },
          { role: 'caseback', storagePath: 'b', base64: 'BBB=' },
          { role: 'clasp', storagePath: 'c' },
        ],
      },
      { vision },
    );

    const req = vision.requests[0];
    expect(req?.images).toHaveLength(2);
    expect(req?.images?.[0]).toEqual({ base64: 'AAA=', mediaType: 'image/png' });
    expect(req?.images?.[1]).toEqual({ base64: 'BBB=', mediaType: 'image/jpeg' });
    expect(req?.prompt).toContain('JSON');
    expect(req?.prompt).toContain('cadran');
    expect(req?.prompt).toContain('fond de boîte');
    expect(req?.system).toContain('horlogère');

    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((entry) => entry.confidence)).toEqual([0.64, 0.41, 0.12]);
    expect(result.candidates[0]?.label).toBe('Rolex Submariner 124060');
    expect(result.candidates[0]?.attributes).toEqual({
      brand: 'Rolex',
      model: 'Submariner',
      reference: '124060',
      year: 2022,
      gender: 'homme',
      caseMaterial: 'acier',
      caseDiameterMm: 41,
    });
    expect(result.candidates.some((entry) => entry.label === 'Rolex Submariner 114060')).toBe(false);
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates.every((entry) => entry.domain === 'watch')).toBe(true);
  });

  it('réponse corrompue → aucun candidat et saisie assistée', async () => {
    const vision = new FakeVision([RECOGNITION_CORRUPTED]);
    const result = await watchPlugin.recognize(
      { kind: 'photo', media: [{ role: 'dial', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('meilleure confiance < 0.35 → saisie assistée', async () => {
    const vision = new FakeVision([RECOGNITION_LOW_CONFIDENCE]);
    const result = await watchPlugin.recognize(
      { kind: 'photo', media: [{ role: 'dial', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.needsAssistedEntry).toBe(true);
  });
});

describe('watchPlugin.recognize — texte flou', () => {
  it('transmet la description telle quelle et parse la réponse', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'Omega Speedmaster Professional',
            confidence: 0.5,
            attributes: { brand: 'Omega', model: 'Speedmaster Professional' },
          },
        ],
      }),
    ]);
    const result = await watchPlugin.recognize(
      { kind: 'text', text: 'chronographe acier cadran noir, hérité de mon grand-père' },
      { vision },
    );
    expect(vision.requests[0]?.prompt).toContain(
      'chronographe acier cadran noir, hérité de mon grand-père',
    );
    expect(vision.requests[0]?.images).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
    expect(result.stage).toBe('llm_vision');
    expect(result.needsAssistedEntry).toBe(false);
  });
});

describe('watchPlugin.recognize — fichier', () => {
  it('dérive la confiance des identifiants réellement fournis', async () => {
    const vision = new FakeVision([]);
    const rows = [
      { brand: 'Rolex', model: 'Submariner', reference: '124060', year: 2022 },
      { label: 'Cartier Tank Must WSTA0041' },
      { boxPapers: 'full_set' },
    ];
    const result = await watchPlugin.recognize({ kind: 'file', fileRows: rows }, { vision });

    expect(vision.requests).toHaveLength(0);
    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((entry) => entry.confidence)).toEqual([0.95, 0.65, 0.1]);
    expect(result.candidates[0]?.label).toBe('Rolex Submariner 124060');
    expect(result.candidates[0]?.attributes).toEqual(rows[0]);
    expect(result.candidates[1]?.label).toBe('Cartier Tank Must WSTA0041');
    expect(result.candidates[1]?.attributes).toEqual({});
    expect(result.candidates[2]?.label).toBe('Montre importée (à préciser)');
    expect(result.candidates[2]?.attributes).toEqual({ boxPapers: 'full_set' });
  });

  it('une ligne sans identité reste explicitement à préciser', async () => {
    const result = await watchPlugin.recognize(
      { kind: 'file', fileRows: [{ boxPapers: 'full_set' }] },
      { vision: new FakeVision([]) },
    );
    expect(result.candidates[0]?.confidence).toBe(0.1);
    expect(result.needsAssistedEntry).toBe(true);
  });
});

const ANALYSIS_FENCED = [
  'Voici la fiche :',
  '```json',
  JSON.stringify({
    identification: {
      brand: 'Omega',
      model: 'Speedmaster Professional',
      reference: ' 3570.50 ',
      year: 1998,
      gender: 'homme',
      caseMaterial: 'acier',
      caseDiameterMm: 42,
      dialColor: 'noir',
      bracelet: 'acier',
      crystal: 'hésalite (plexiglas)',
      waterResistanceM: 50,
      boxPapers: 'montre_seule',
    },
    movement: {
      type: 'manuel',
      calibre: 'Omega 1861',
      powerReserveHours: 48,
      frequencyVph: 21600,
      jewels: 18,
      complications: ['chronographe', 'petite seconde', 42],
      certification: 'qualifiée NASA pour les vols habités',
    },
    condition: {
      summary: 'Bel état général, patine homogène.',
      polished: 'leger',
      issues: ['rayures superficielles sur le verre'],
      confidence: 0.55,
      caveat: 'à faire confirmer',
    },
    story: {
      why: 'Chronographe conçu pour la course automobile, devenu la montre des missions Apollo.',
      byWhom: 'Omega — calibre développé avec Lemania (861 puis 1861)',
      modelLaunchYear: 1957,
      milestones: [
        { year: 1965, note: 'Qualifiée par la NASA pour les vols habités' },
        { year: 1969, note: 'Première montre portée sur la Lune (Apollo 11)' },
        { note: 'jalon sans année' },
      ],
    },
    heritage: {
      history: 'La « Moonwatch » : en production continue depuis 1957.',
      rarity: { level: 'courante', note: 'Grande série, mais références anciennes recherchées' },
    },
    neighborReferences: [
      { reference: '145.022', note: 'Génération calibre 861 précédente, cote proche' },
    ],
    confidence: 0.6,
  }),
  '```',
].join('\n');

describe('watchPlugin.analyze', () => {
  it('produit un payload watch_v1 conforme avec réserves', async () => {
    const vision = new FakeVision([ANALYSIS_FENCED]);
    const result = await watchPlugin.analyze(
      candidate(
        { brand: 'Omega', model: 'Speedmaster Professional' },
        'Omega Speedmaster Professional 3570.50',
      ),
      { vision },
    );

    expect(vision.requests[0]?.system).toBe(WATCH_SYSTEM_PROMPT);
    expect(vision.requests[0]?.prompt).toContain('Omega Speedmaster Professional');
    expect(result.engine).toBe(WATCH_ENGINE);
    expect(result.confidence).toBe(0.6);
    expect(result.payload.identification.brand).toBe('Omega');
    expect(result.payload.identification.reference).toBe('3570.50');
    expect(result.payload.identification.gender).toBe('homme');
    expect(result.payload.identification.caseDiameterMm).toBe(42);
    expect(result.payload.identification.boxPapers).toBe('montre_seule');
    expect(result.payload.movement.type).toBe('manuel');
    expect(result.payload.movement.calibre).toBe('Omega 1861');
    expect(result.payload.movement.frequencyVph).toBe(21600);
    expect(result.payload.movement.complications).toEqual(['chronographe', 'petite seconde']);
    expect(result.payload.story.why).toContain('missions Apollo');
    expect(result.payload.story.byWhom).toContain('Omega');
    expect(result.payload.story.modelLaunchYear).toBe(1957);
    expect(result.payload.story.milestones).toHaveLength(2);
    expect(result.payload.condition).toEqual({
      summary: 'Bel état général, patine homogène.',
      polished: 'leger',
      issues: ['rayures superficielles sur le verre'],
      confidence: 0.55,
      caveat: CONDITION_CAVEAT,
    });
    expect(result.payload.heritage?.rarity?.level).toBe('courante');
    expect(result.payload.neighborReferences).toEqual([
      { reference: '145.022', note: 'Génération calibre 861 précédente, cote proche' },
    ]);
    expect(result.payload.uncertainties.length).toBeGreaterThanOrEqual(1);
    expect(result.disclaimers).toContain(
      'Estimation indicative — ni expertise légale, ni conseil en investissement.',
    );
    expect(result.disclaimers.some((entry) => /contrefaçon/i.test(entry))).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('préserve les identifiants connus quand l’analyse est partielle', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        identification: { model: 'Submariner Date' },
        movement: { type: 'automatique', complications: [] },
        condition: { confidence: 0.4, issues: [] },
        story: {},
        uncertainties: ['référence exacte à confirmer'],
        confidence: 0.5,
      }),
    ]);
    const result = await watchPlugin.analyze(
      candidate({ brand: 'Rolex', model: 'Submariner', reference: '16610' }),
      { vision },
    );

    expect(result.payload.identification).toMatchObject({
      brand: 'Rolex',
      model: 'Submariner Date',
      reference: '16610',
    });
  });

  it('payload minimal ou hors référentiel → coercition défensive', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        movement: { type: 'solaire' },
        condition: { confidence: 1.5 },
        uncertainties: ['référence exacte à confirmer'],
        confidence: -2,
      }),
    ]);
    const result = await watchPlugin.analyze(
      candidate({ brand: 'Rolex', model: 'Submariner' }),
      { vision },
    );

    expect(result.payload.identification.brand).toBe('Rolex');
    expect(result.payload.movement.type).toBe('inconnu');
    expect(result.payload.movement.complications).toEqual([]);
    expect(result.payload.condition.summary).toBe('État non déterminé depuis les photos.');
    expect(result.payload.condition.confidence).toBe(0.3);
    expect(result.payload.condition.caveat).toBe(CONDITION_CAVEAT);
    expect(result.payload.heritage).toBeUndefined();
    expect(result.confidence).toBe(0.3);
    expect(result.sources).toEqual([]);
  });

  it('réponse corrompue → VelumError ANALYSIS_FAILED', async () => {
    const vision = new FakeVision(['<html>erreur 502</html>']);
    await expect(
      watchPlugin.analyze(candidate({}), { vision }),
    ).rejects.toSatisfy((error: unknown) => isVelumError(error) && error.code === 'ANALYSIS_FAILED');
  });
});

describe('watchPlugin.buildPriceQuery', () => {
  it('compose le libellé canonique et passe l’état validé', () => {
    const query = watchPlugin.buildPriceQuery(
      candidate({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '124060',
        year: 2022,
        condition: 'tres_bon',
        arbitrary: 'écarté',
      }),
    );
    expect(query.domain).toBe('watch');
    expect(query.label).toBe('Rolex Submariner 124060');
    expect(query.condition).toBe('tres_bon');
    expect(query.attributes).toEqual({
      brand: 'Rolex',
      model: 'Submariner',
      reference: '124060',
      year: 2022,
      condition: 'tres_bon',
    });
    expect(query.limit).toBe(20);
  });

  it('sans marque ni référence, retombe sur le label du candidat', () => {
    const query = watchPlugin.buildPriceQuery(candidate({}, 'Montre de plongée acier années 70'));
    expect(query.label).toBe('Montre de plongée acier années 70');
    expect(query.condition).toBeUndefined();
  });
});

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

describe('watchPlugin.valuate — bout-en-bout avec @velum/valuation', () => {
  const fx: FxRates = { USD: 0.9 };
  const deps = (sources: PriceSource[]) => ({
    sources,
    fx,
    valuate: (observations: PriceObservation[], rates: FxRates) =>
      engineValuate(observations, rates, { rng: mulberry32(42) }),
  });

  it('agrège les sources, tolère une panne et retourne central/IC', async () => {
    const sourceA: PriceSource = {
      name: 'eBay sold',
      kind: 'marketplace_sold',
      fetch: async () => [
        obs(10800, 'EUR', 'marketplace_sold', 10, 'eBay sold'),
        obs(11600, 'EUR', 'marketplace_sold', 30, 'eBay sold'),
        obs(11100, 'EUR', 'marketplace_sold', 5, 'eBay sold'),
      ],
    };
    const sourceB: PriceSource = {
      name: 'Heritage Auctions',
      kind: 'auction_realized',
      fetch: async () => [obs(12500, 'USD', 'auction_realized', 60, 'Heritage Auctions')],
    };
    const failing: PriceSource = {
      name: 'en panne',
      kind: 'listing',
      fetch: async () => {
        throw new Error('réseau indisponible');
      },
    };

    const result = await watchPlugin.valuate(
      candidate({ brand: 'Rolex', model: 'Submariner', reference: '124060' }),
      deps([sourceA, sourceB, failing]),
    );

    expect(result.nSources).toBe(2); // 2 plateformes distinctes, 4 observations conservées
    expect(result.currency).toBe('EUR');
    expect(result.central).toBeGreaterThanOrEqual(10800);
    expect(result.central).toBeLessThanOrEqual(11600);
    expect(result.ci80[0]).toBeLessThanOrEqual(result.central);
    expect(result.ci80[1]).toBeGreaterThanOrEqual(result.central);
    expect(result.ci95[0]).toBeLessThanOrEqual(result.ci80[0]);
    expect(result.ci95[1]).toBeGreaterThanOrEqual(result.ci80[1]);
    expect(result.reliability).toBeGreaterThan(0);
    expect(result.observations).toHaveLength(4);
  });

  it('aucune observation → VelumError NO_OBSERVATIONS', async () => {
    const empty: PriceSource = { name: 'vide', kind: 'listing', fetch: async () => [] };
    await expect(
      watchPlugin.valuate(candidate({}), deps([empty])),
    ).rejects.toSatisfy((error: unknown) => isVelumError(error) && error.code === 'NO_OBSERVATIONS');
  });
});

describe('exports', () => {
  it('expose une instance et une classe', () => {
    expect(watchPlugin).toBeInstanceOf(WatchDomainPlugin);
    expect(watchPlugin.domain).toBe('watch');
  });
});
