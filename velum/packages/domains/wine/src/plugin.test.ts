import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_WEIGHTS,
  isVelumError,
  type Candidate,
  type PriceObservation,
  type PriceSource,
  type SourceKind,
  type ValuateDeps,
  type VisionModel,
} from '@velum/core';
import { mulberry32, valuate as engineValuate } from '@velum/valuation';
import { WINE_RECOGNITION_SYSTEM_PROMPT, winePlugin } from './index.ts';
import { ZAPPA_SYSTEM_PROMPT } from './zappa.ts';

// ── Fakes ────────────────────────────────────────────────────────────────────

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
    if (next === undefined) throw new Error('FakeVision : aucune réponse restante');
    return next;
  }
}

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-1',
    domain: 'wine',
    label: 'Clos Rougeard Le Bourg 2014',
    confidence: 0.9,
    attributes: { producer: 'Clos Rougeard', cuvee: 'Le Bourg', vintage: 2014 },
    ...overrides,
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Réponse vision AVEC fences markdown, désordonnée, avec confiance hors bornes. */
const FENCED_RECOGNITION = [
  'Voici mon identification :',
  '```json',
  JSON.stringify({
    candidates: [
      { label: 'Pavillon Rouge 2015', confidence: 0.3, attributes: {} },
      {
        label: 'Château Margaux 2015',
        confidence: 1.4, // hors bornes → doit être ramené à 1
        attributes: { producer: 'Château Margaux', appellation: 'Margaux', vintage: 2015, color: 'rouge' },
      },
      { label: 'Château Margaux 2016', confidence: 0.62, attributes: { vintage: 2016 } },
      { label: 'Margaux générique', confidence: 0.1, attributes: {} },
    ],
  }),
  '```',
].join('\n');

/** Réponse corrompue : JSON jamais refermé. */
const CORRUPTED_RESPONSE = 'Désolé, voici un début { "candidates": [ { "label": "cassé"';

const ANALYSIS_PAYLOAD = {
  identification: {
    producer: 'Clos Rougeard',
    appellation: 'Saumur-Champigny',
    cuvee: 'Le Bourg',
    vintage: 2014,
    color: 'rouge',
    grapes: [{ name: 'cabernet franc', percent: 100 }],
    farming: 'bio',
    region: 'Val de Loire',
    country: 'France',
  },
  tasting: {
    robe: 'grenat profond',
    nose: ['fruits noirs', 'violette', 'poivre'],
    palate: { structure: 'ample', tannins: 'fins', acidity: 'fraîche', alcohol: '13 %' },
    length: 'très longue',
    agingPotentialYears: [10, 25],
    drinkWindow: { from: 2024, to: 2039 },
  },
  ratings: {
    rvf: '18/20',
    bettaneDesseauve: null,
    parker: '95/100',
    suckling: null,
    jancisRobinson: null,
    positioning: 'collector',
  },
  market: {
    averagePriceEUR: 350,
    priceTrend: [{ horizonYears: 5, direction: 'hausse', note: 'rareté croissante' }],
    marketTension: 'forte',
    speculativeScore: 8,
    assetClass: 'collection',
  },
  comparisons: {
    neighborVintages: [{ vintage: 2015, note: 'millésime solaire, plus mûr' }],
    regionalEquivalents: ['Domaine Guiberteau Les Arboises'],
    fallbackSuggestions: ['Château Yvonne Saumur-Champigny'],
    foodPairings: ['pigeon rôti', 'filet de bœuf', 'comté affiné'],
  },
  uncertainties: ['Niveau et état de la bouteille inconnus.'],
};

// ── recognize ────────────────────────────────────────────────────────────────

describe('winePlugin.recognize', () => {
  it('photo : parse une réponse avec fences, borne/trie/tronque à 3, transmet les images', async () => {
    const vision = new FakeVision([FENCED_RECOGNITION]);
    const result = await winePlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'label', storagePath: 'captures/etiquette.png', base64: 'data:image/png;base64,QUJDRA==' },
          { role: 'capsule', storagePath: 'captures/capsule.jpg' }, // sans base64 → filtrée
        ],
      },
      { vision },
    );

    expect(result.stage).toBe('llm_vision');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.confidence)).toEqual([1, 0.62, 0.3]);
    expect(result.candidates[0]?.label).toBe('Château Margaux 2015');
    expect(result.candidates[0]?.domain).toBe('wine');
    expect(result.candidates[0]?.attributes['vintage']).toBe(2015);

    const request = vision.requests[0];
    expect(request?.system).toBe(WINE_RECOGNITION_SYSTEM_PROMPT);
    expect(request?.images).toEqual([{ base64: 'QUJDRA==', mediaType: 'image/png' }]);
  });

  it('photo : réponse corrompue → aucun candidat, bascule saisie assistée', async () => {
    const vision = new FakeVision([CORRUPTED_RESPONSE]);
    const result = await winePlugin.recognize(
      {
        kind: 'photo',
        media: [{ role: 'label', storagePath: 'captures/x.jpg', base64: 'data:image/jpeg;base64,QQ==' }],
      },
      { vision },
    );

    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('texte flou : tolère l’entrée imprécise et signale la saisie assistée sous 0.35', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          { label: 'Château Pontet-Canet 2019', confidence: 0.3, attributes: { farming: 'biodynamie', vintage: 2019 } },
          { label: 'Château Palmer 2019', confidence: 0.2, attributes: { vintage: 2019 } },
        ],
      }),
    ]);
    const result = await winePlugin.recognize(
      { kind: 'text', text: 'grand vin de Bordeaux bio 2019' },
      { vision },
    );

    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.confidence).toBe(0.3);
    expect(result.needsAssistedEntry).toBe(true); // meilleure confiance < 0.35 → jamais de fausse certitude

    const request = vision.requests[0];
    expect(request?.images).toBeUndefined();
    expect(request?.prompt).toContain('grand vin de Bordeaux bio 2019');
  });

  it('fichier : mappe les lignes directement (confidence 0.95, stage assisted), sans LLM', async () => {
    const vision = new FakeVision([]); // toute sollicitation ferait échouer le fake
    const result = await winePlugin.recognize(
      {
        kind: 'file',
        fileRows: [
          { name: 'Clos Rougeard Le Bourg 2014', condition: 'bon état' },
          { producer: 'Domaine Leflaive', cuvee: 'Puligny-Montrachet', vintage: 2020 },
        ],
      },
      { vision },
    );

    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((c) => c.confidence === 0.95)).toBe(true);
    expect(result.candidates[0]?.label).toBe('Clos Rougeard Le Bourg 2014');
    expect(result.candidates[0]?.attributes['vintage']).toBe(2014); // millésime extrait du libellé
    expect(result.candidates[1]?.label).toBe('Domaine Leflaive Puligny-Montrachet 2020');
    expect(vision.requests).toHaveLength(0);
  });

  it('photo sans image exploitable → saisie assistée sans appel vision', async () => {
    const vision = new FakeVision([]);
    const result = await winePlugin.recognize({ kind: 'photo', media: [] }, { vision });
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
    expect(vision.requests).toHaveLength(0);
  });
});

// ── analyze ──────────────────────────────────────────────────────────────────

describe('winePlugin.analyze', () => {
  it('produit une fiche ZAPPA conforme avec disclaimers et sources éditoriales', async () => {
    const vision = new FakeVision(['```json\n' + JSON.stringify(ANALYSIS_PAYLOAD) + '\n```']);
    const result = await winePlugin.analyze(makeCandidate(), { vision });

    expect(result.engine).toBe('zappa_vini');
    expect(vision.requests[0]?.system).toBe(ZAPPA_SYSTEM_PROMPT);

    expect(result.payload.identification.producer).toBe('Clos Rougeard');
    expect(result.payload.tasting.drinkWindow).toEqual({ from: 2024, to: 2039 });
    expect(result.payload.ratings.parker).toBe('95/100');
    expect(result.payload.market.assetClass).toBe('collection');
    expect(result.payload.comparisons.foodPairings.length).toBeGreaterThan(0);
    expect(result.payload.uncertainties.length).toBeGreaterThan(0);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // Disclaimers TOUJOURS non vides, avec la mention réglementaire.
    expect(result.disclaimers).toContain(
      'Estimation indicative — ni expertise légale, ni conseil en investissement.',
    );
    expect(result.disclaimers.length).toBeGreaterThanOrEqual(2);

    // Références éditoriales citées : seules les notes réellement présentes (RVF + Parker).
    const sourceNames = result.sources.map((s) => s.name);
    expect(sourceNames).toContain('La Revue du Vin de France');
    expect(sourceNames).toContain('Robert Parker Wine Advocate');
    expect(sourceNames).not.toContain('James Suckling');
  });

  it('complète uncertainties si le payload parsé l’omet', async () => {
    const { uncertainties: _omitted, ...withoutUncertainties } = ANALYSIS_PAYLOAD;
    const vision = new FakeVision([JSON.stringify(withoutUncertainties)]);
    const result = await winePlugin.analyze(makeCandidate(), { vision });

    expect(result.payload.uncertainties.length).toBeGreaterThanOrEqual(1);
  });

  it('réponse corrompue → VelumError ANALYSIS_FAILED', async () => {
    const vision = new FakeVision([CORRUPTED_RESPONSE]);
    let error: unknown;
    try {
      await winePlugin.analyze(makeCandidate(), { vision });
    } catch (e) {
      error = e;
    }
    expect(isVelumError(error)).toBe(true);
    expect(isVelumError(error) && error.code).toBe('ANALYSIS_FAILED');
  });
});

// ── buildPriceQuery ──────────────────────────────────────────────────────────

describe('winePlugin.buildPriceQuery', () => {
  it('compose un libellé canonique normalisé depuis les attributs + condition', () => {
    const query = winePlugin.buildPriceQuery(
      makeCandidate({ attributes: { producer: 'Clos Rougeard', cuvee: 'Le Bourg', vintage: 2014, condition: 'bon état' } }),
    );

    expect(query.domain).toBe('wine');
    expect(query.label).toBe('clos rougeard bourg 2014'); // "Le" est un mot vide
    expect(query.condition).toBe('bon état');
    expect(query.attributes['vintage']).toBe(2014);
    expect(query.limit).toBe(20);
  });

  it('replie sur le label du candidat et extrait le millésime du texte', () => {
    const query = winePlugin.buildPriceQuery(
      makeCandidate({ label: 'Grand vin de Bordeaux 2019', attributes: {} }),
    );

    expect(query.label).toBe('grand vin bordeaux 2019');
    expect(query.attributes['vintage']).toBe(2019);
    expect(query.condition).toBeUndefined();
  });
});

// ── valuate (bout-en-bout avec le moteur RÉEL @velum/valuation) ─────────────

function makeObservation(price: number, currency: string, kind: SourceKind, ageDays: number): PriceObservation {
  return {
    price,
    currency,
    ageDays,
    sourceWeight: DEFAULT_SOURCE_WEIGHTS[kind],
    source: { name: `fake-${kind}`, kind },
  };
}

describe('winePlugin.valuate', () => {
  it('agrège 2 sources mockées (dont une en panne, ignorée) et valorise via le moteur réel', async () => {
    const auctionSource: PriceSource = {
      name: 'iDealwine (mock)',
      kind: 'auction_realized',
      fetch: async () => [
        makeObservation(300, 'EUR', 'auction_realized', 30),
        makeObservation(320, 'EUR', 'auction_realized', 90),
      ],
    };
    const listingSource: PriceSource = {
      name: 'Vivino (mock)',
      kind: 'listing',
      fetch: async () => [
        makeObservation(340, 'EUR', 'listing', 5),
        makeObservation(360, 'USD', 'listing', 10), // 360 × 0.9 = 324 EUR
      ],
    };
    const brokenSource: PriceSource = {
      name: 'source en panne',
      kind: 'listing',
      fetch: async () => {
        throw new Error('réseau indisponible');
      },
    };

    const deps: ValuateDeps = {
      sources: [auctionSource, listingSource, brokenSource],
      fx: { USD: 0.9 },
      valuate: (obs, fx) => engineValuate(obs, fx, { rng: mulberry32(42) }),
    };

    const result = await winePlugin.valuate(makeCandidate(), deps);

    expect(result.currency).toBe('EUR');
    expect(result.nSources).toBe(4); // les 4 observations survivent au MAD, la source en panne est ignorée
    expect(result.central).toBeGreaterThanOrEqual(300);
    expect(result.central).toBeLessThanOrEqual(340);
    expect(result.ci80[0]).toBeLessThanOrEqual(result.central);
    expect(result.ci80[1]).toBeGreaterThanOrEqual(result.central);
    expect(result.ci95[0]).toBeLessThanOrEqual(result.ci80[0]);
    expect(result.ci95[1]).toBeGreaterThanOrEqual(result.ci80[1]);
    expect(result.reliability).toBeGreaterThan(0);
  });

  it('laisse remonter VelumError NO_OBSERVATIONS quand toutes les sources sont vides', async () => {
    const emptySource: PriceSource = { name: 'vide', kind: 'listing', fetch: async () => [] };
    const deps: ValuateDeps = {
      sources: [emptySource],
      fx: {},
      valuate: (obs, fx) => engineValuate(obs, fx),
    };

    let error: unknown;
    try {
      await winePlugin.valuate(makeCandidate(), deps);
    } catch (e) {
      error = e;
    }
    expect(isVelumError(error)).toBe(true);
    expect(isVelumError(error) && error.code).toBe('NO_OBSERVATIONS');
  });
});
