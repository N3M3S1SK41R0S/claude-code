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
  label = 'Rolex Submariner 124060',
): Candidate {
  return { id: 'w1', domain: 'watch', label, confidence: 0.8, attributes };
}

// ── Fixtures de reconnaissance ────────────────────────────────────────────

/** Réponse AVEC fences markdown, désordonnée, avec confiance hors bornes. */
const RECOGNITION_FENCED = [
  '```json',
  JSON.stringify({
    candidates: [
      {
        label: 'Rolex Submariner 124060',
        confidence: 0.64,
        attributes: {
          brand: 'Rolex',
          model: 'Submariner',
          reference: '124060',
          year: 2022,
          gender: 'homme',
          caseMaterial: 'acier',
          caseDiameterMm: 41,
        },
      },
      { label: 'Rolex Submariner 114060', confidence: 1.6, attributes: { reference: '114060' } },
      { label: 'Tudor Black Bay 58', confidence: 0.12, attributes: {} },
      { label: 'Rolex Sea-Dweller 126600', confidence: 0.41, attributes: { reference: '126600' } },
    ],
  }),
  '```',
].join('\n');

/** Réponse corrompue : aucun JSON exploitable. */
const RECOGNITION_CORRUPTED = 'Désolé, je ne peux pas identifier cette montre avec certitude...';

/** Réponse à faible confiance (entrée floue). */
const RECOGNITION_LOW_CONFIDENCE = JSON.stringify({
  candidates: [
    { label: 'Montre de plongée acier (incertain)', confidence: 0.2, attributes: {} },
  ],
});

describe('watchPlugin.recognize — photo', () => {
  it('appelle la vision avec les images, trie, borne et tronque à 3 candidats', async () => {
    const vision = new FakeVision([RECOGNITION_FENCED]);
    const result = await watchPlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'dial', storagePath: 'a', base64: 'data:image/png;base64,AAA=' },
          { role: 'caseback', storagePath: 'b', base64: 'BBB=' },
          { role: 'clasp', storagePath: 'c' }, // sans base64 → exclu de l'appel vision
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
    expect(req?.prompt).toContain('cadran');
    expect(req?.prompt).toContain('fond de boîte');
    expect(req?.system).toContain('horlogère');

    // Tri décroissant, confiance bornée à 1, top 3.
    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.confidence)).toEqual([1, 0.64, 0.41]);
    expect(result.candidates[0]?.label).toBe('Rolex Submariner 114060');
    expect(result.candidates[1]?.attributes['brand']).toBe('Rolex');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates.every((c) => c.domain === 'watch')).toBe(true);
  });

  it('réponse corrompue → aucun candidat et bascule en saisie assistée', async () => {
    const vision = new FakeVision([RECOGNITION_CORRUPTED]);
    const result = await watchPlugin.recognize(
      { kind: 'photo', media: [{ role: 'dial', storagePath: 'a', base64: 'AAA=' }] },
      { vision },
    );
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('meilleure confiance < 0.35 → needsAssistedEntry (jamais de fausse certitude)', async () => {
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
  it('mappe chaque ligne en candidat (confiance 0.95, stage assisted)', async () => {
    const vision = new FakeVision([]);
    const rows = [
      { brand: 'Rolex', model: 'Submariner', reference: '124060', year: 2022 },
      { label: 'Cartier Tank Must WSTA0041' },
      { boxPapers: 'full_set' }, // aucune identité → libellé générique
    ];
    const result = await watchPlugin.recognize({ kind: 'file', fileRows: rows }, { vision });

    expect(vision.requests).toHaveLength(0); // aucun appel vision pour un import
    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.confidence).toBe(0.95);
    expect(result.candidates[0]?.label).toBe('Rolex Submariner 124060');
    expect(result.candidates[0]?.attributes).toEqual(rows[0]);
    expect(result.candidates[1]?.label).toBe('Cartier Tank Must WSTA0041');
    expect(result.candidates[2]?.label).toBe('Montre importée (à préciser)');
  });
});

// ── Analyse ───────────────────────────────────────────────────────────────

const ANALYSIS_FENCED = [
  'Voici la fiche :',
  '```json',
  JSON.stringify({
    identification: {
      brand: 'Omega',
      model: 'Speedmaster Professional',
      reference: ' 3570.50 ', // espaces superflus → normalisé
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
      complications: ['chronographe', 'petite seconde', 42], // 42 → filtré
      certification: 'qualifiée NASA pour les vols habités',
    },
    condition: {
      summary: 'Bel état général, patine homogène.',
      polished: 'leger',
      issues: ['rayures superficielles sur le verre'],
      confidence: 0.55,
      caveat: 'à faire confirmer', // caveat non conforme → le plugin impose le sien
    },
    story: {
      why: 'Chronographe conçu pour la course automobile, devenu la montre des missions Apollo.',
      byWhom: 'Omega — calibre développé avec Lemania (861 puis 1861)',
      modelLaunchYear: 1957,
      milestones: [
        { year: 1965, note: 'Qualifiée par la NASA pour les vols habités' },
        { year: 1969, note: 'Première montre portée sur la Lune (Apollo 11)' },
        { note: 'jalon sans année' }, // filtré
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
    // uncertainties volontairement ABSENT → le plugin doit en imposer une.
  }),
  '```',
].join('\n');

describe('watchPlugin.analyze', () => {
  it('produit un payload watch_v1 conforme avec disclaimers et uncertainties', async () => {
    const vision = new FakeVision([ANALYSIS_FENCED]);
    const result = await watchPlugin.analyze(
      candidate({ brand: 'Omega', model: 'Speedmaster Professional' }, 'Omega Speedmaster Professional 3570.50'),
      { vision },
    );

    expect(vision.requests[0]?.system).toBe(WATCH_SYSTEM_PROMPT);
    expect(vision.requests[0]?.prompt).toContain('Omega Speedmaster Professional');

    expect(result.engine).toBe(WATCH_ENGINE);
    expect(result.confidence).toBe(0.6);
    // Spécifications complètes, référence normalisée.
    expect(result.payload.identification.brand).toBe('Omega');
    expect(result.payload.identification.reference).toBe('3570.50');
    expect(result.payload.identification.gender).toBe('homme');
    expect(result.payload.identification.caseDiameterMm).toBe(42);
    expect(result.payload.identification.boxPapers).toBe('montre_seule');
    // Mécanisme : type, calibre, complications (entrées non-texte filtrées).
    expect(result.payload.movement.type).toBe('manuel');
    expect(result.payload.movement.calibre).toBe('Omega 1861');
    expect(result.payload.movement.frequencyVph).toBe(21600);
    expect(result.payload.movement.complications).toEqual(['chronographe', 'petite seconde']);
    // Histoire du modèle : pourquoi, par qui, jalons (jalon sans année filtré).
    expect(result.payload.story.why).toContain('missions Apollo');
    expect(result.payload.story.byWhom).toContain('Omega');
    expect(result.payload.story.modelLaunchYear).toBe(1957);
    expect(result.payload.story.milestones).toHaveLength(2);
    // État : caveat horloger imposé (celui du moteur était non conforme).
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
    // uncertainties absent de la réponse → au moins une entrée imposée.
    expect(result.payload.uncertainties.length).toBeGreaterThanOrEqual(1);
    // Disclaimers TOUJOURS non vides : mention de base + contrefaçons.
    expect(result.disclaimers).toContain(
      'Estimation indicative — ni expertise légale, ni conseil en investissement.',
    );
    expect(result.disclaimers.some((d) => /contrefaçon/i.test(d))).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('payload minimal ou hors référentiel → coercition défensive', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        movement: { type: 'solaire' }, // hors référentiel → 'inconnu'
        condition: {},
        uncertainties: ['référence exacte à confirmer'],
      }),
    ]);
    const result = await watchPlugin.analyze(candidate({ brand: 'Rolex', model: 'Submariner' }), {
      vision,
    });

    // identification absente → retombe sur les attributs du candidat.
    expect(result.payload.identification.brand).toBe('Rolex');
    expect(result.payload.movement.type).toBe('inconnu');
    expect(result.payload.movement.complications).toEqual([]);
    expect(result.payload.condition.summary).toBe('État non déterminé depuis les photos.');
    expect(result.payload.condition.confidence).toBe(0.3);
    expect(result.payload.condition.caveat).toBe(CONDITION_CAVEAT);
    expect(result.payload.heritage).toBeUndefined();
    // confidence global absent → celui de l'état.
    expect(result.confidence).toBe(0.3);
    // Aucune source citée → références éditoriales par défaut.
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('réponse corrompue → VelumError ANALYSIS_FAILED', async () => {
    const vision = new FakeVision(['<html>erreur 502</html>']);
    await expect(
      watchPlugin.analyze(candidate({}), { vision }),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'ANALYSIS_FAILED');
  });
});

// ── buildPriceQuery ───────────────────────────────────────────────────────

describe('watchPlugin.buildPriceQuery', () => {
  it('compose le libellé canonique « marque modèle référence » et passe la condition', () => {
    const query = watchPlugin.buildPriceQuery(
      candidate({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '124060',
        year: 2022,
        condition: 'tres_bon',
      }),
    );
    expect(query.domain).toBe('watch');
    expect(query.label).toBe('Rolex Submariner 124060');
    expect(query.condition).toBe('tres_bon');
    expect(query.attributes['year']).toBe(2022);
    expect(query.limit).toBe(20);
  });

  it('sans marque ni référence, retombe sur le label du candidat ; sans état, pas de condition', () => {
    const query = watchPlugin.buildPriceQuery(candidate({}, 'Montre de plongée acier années 70'));
    expect(query.label).toBe('Montre de plongée acier années 70');
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
    sourceWeight: kind === 'auction_realized' ? 1 : 0.7,
    source: { name: 'fixture', kind },
  };
}

describe('watchPlugin.valuate — bout-en-bout avec @velum/valuation', () => {
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
        obs(10800, 'EUR', 'marketplace_sold', 10),
        obs(11600, 'EUR', 'marketplace_sold', 30),
        obs(11100, 'EUR', 'marketplace_sold', 5),
      ],
    };
    const sourceB: PriceSource = {
      name: 'Heritage Auctions',
      kind: 'auction_realized',
      fetch: async () => [obs(12500, 'USD', 'auction_realized', 60)],
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

    // 4 observations conservées (10800, 11600, 11100 EUR + 12500 USD → 11250 EUR).
    expect(result.nSources).toBe(4);
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

  it('aucune observation → VelumError NO_OBSERVATIONS remonte du moteur', async () => {
    const empty: PriceSource = { name: 'vide', kind: 'listing', fetch: async () => [] };
    await expect(
      watchPlugin.valuate(candidate({}), deps([empty])),
    ).rejects.toSatisfy((e: unknown) => isVelumError(e) && e.code === 'NO_OBSERVATIONS');
  });
});

describe('exports', () => {
  it('expose une instance et une classe', () => {
    expect(watchPlugin).toBeInstanceOf(WatchDomainPlugin);
    expect(watchPlugin.domain).toBe('watch');
  });
});
