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
import {
  ART_DISCLAIMERS,
  ART_RECOGNITION_SYSTEM_PROMPT,
  ART_SYSTEM_PROMPT,
  artPlugin,
} from './index.ts';

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
    domain: 'art',
    label: 'Eugène Boudin — Plage de Trouville',
    confidence: 0.7,
    attributes: {
      artist: 'Eugène Boudin',
      title: 'Plage de Trouville',
      technique: 'huile sur panneau',
      attributionQualifier: 'attribue_a',
    },
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
      { label: 'École française — Paysage animé', confidence: 0.25, attributes: { attributionQualifier: 'ecole_de' } },
      {
        label: 'Eugène Boudin — Plage de Trouville',
        confidence: 1.4, // hors bornes → doit être ramené à 1
        attributes: {
          artist: 'Eugène Boudin',
          attributionQualifier: 'attribue_a',
          technique: 'huile sur panneau',
          dimensionsCm: { height: 24, width: 33 },
          signatureDetected: true,
        },
      },
      { label: 'Entourage de Boudin — Scène de plage', confidence: 0.55, attributes: { attributionQualifier: 'entourage_de' } },
      { label: 'Copie ancienne d’après Boudin', confidence: 0.1, attributes: { attributionQualifier: 'd_apres' } },
    ],
  }),
  '```',
].join('\n');

/** Réponse corrompue : JSON jamais refermé. */
const CORRUPTED_RESPONSE = 'Désolé, voici un début { "candidates": [ { "label": "cassé"';

/** Fiche art_v1 conforme — signature nette + confiance haute. */
const ANALYSIS_PAYLOAD = {
  identification: {
    artist: 'Eugène Boudin',
    attributionQualifier: 'signe',
    title: 'Plage de Trouville',
    technique: 'huile sur panneau',
    support: 'panneau d’acajou',
    dimensionsCm: { height: 24, width: 33 },
    estimatedPeriod: 'vers 1880',
    school: 'pré-impressionnisme',
    signatureDetected: true,
  },
  condition: {
    summary: 'Bon état général sous vernis légèrement encrassé.',
    issues: ['vernis encrassé', 'petites craquelures en partie basse'],
  },
  provenance: {
    evidence: ['Étiquette de la galerie Durand-Ruel au verso', 'Cachet de vente au pochoir'],
    note: 'Provenance cohérente avec le circuit marchand de l’artiste.',
  },
  comparables: [
    { description: 'Boudin, "Scène de plage", 22 × 32 cm, adjugé 38 000 EUR en 2025', note: 'format et sujet très proches' },
  ],
  uncertainties: ['Authenticité non vérifiée matériellement : signature à confronter au catalogue raisonné.'],
  expertiseRecommended: false,
  confidence: 0.9,
  sources: [{ name: 'Catalogue raisonné Schmit', url: 'https://example.org/schmit' }],
};

// ── recognize ────────────────────────────────────────────────────────────────

describe('artPlugin.recognize', () => {
  it('photo : parse une réponse avec fences, borne/trie/tronque à 3, transmet les images', async () => {
    const vision = new FakeVision([FENCED_RECOGNITION]);
    const result = await artPlugin.recognize(
      {
        kind: 'photo',
        media: [
          { role: 'front', storagePath: 'captures/oeuvre.png', base64: 'data:image/png;base64,QUJDRA==' },
          { role: 'signature', storagePath: 'captures/signature.jpg', base64: 'data:image/jpeg;base64,U0lHTg==' },
          { role: 'back', storagePath: 'captures/verso.jpg' }, // sans base64 → filtrée
        ],
      },
      { vision },
    );

    expect(result.stage).toBe('llm_vision');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.confidence)).toEqual([1, 0.55, 0.25]);
    expect(result.candidates[0]?.label).toBe('Eugène Boudin — Plage de Trouville');
    expect(result.candidates[0]?.domain).toBe('art');
    expect(result.candidates[0]?.attributes['attributionQualifier']).toBe('attribue_a');
    expect(result.candidates[0]?.attributes['dimensionsCm']).toEqual({ height: 24, width: 33 });

    const request = vision.requests[0];
    expect(request?.system).toBe(ART_RECOGNITION_SYSTEM_PROMPT);
    expect(request?.images).toEqual([
      { base64: 'QUJDRA==', mediaType: 'image/png' },
      { base64: 'U0lHTg==', mediaType: 'image/jpeg' },
    ]);
    expect(request?.prompt).toContain('œuvre complète');
    expect(request?.prompt).toContain('détail signature');
  });

  it('photo : réponse corrompue → aucun candidat, bascule saisie assistée', async () => {
    const vision = new FakeVision([CORRUPTED_RESPONSE]);
    const result = await artPlugin.recognize(
      {
        kind: 'photo',
        media: [{ role: 'front', storagePath: 'captures/x.jpg', base64: 'data:image/jpeg;base64,QQ==' }],
      },
      { vision },
    );

    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
  });

  it('texte flou : tolère l’entrée imprécise et signale la saisie assistée sous 0.35', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          { label: 'École de Barbizon — Sous-bois', confidence: 0.3, attributes: { attributionQualifier: 'ecole_de' } },
          { label: 'Paysagiste anonyme fin XIXe', confidence: 0.2, attributes: { attributionQualifier: 'anonyme' } },
        ],
      }),
    ]);
    const result = await artPlugin.recognize(
      { kind: 'text', text: 'petit paysage impressionniste signé illisible, cadre doré' },
      { vision },
    );

    expect(result.stage).toBe('llm_vision');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.confidence).toBe(0.3);
    expect(result.needsAssistedEntry).toBe(true); // meilleure confiance < 0.35 → jamais de fausse certitude

    const request = vision.requests[0];
    expect(request?.images).toBeUndefined();
    expect(request?.prompt).toContain('petit paysage impressionniste signé illisible, cadre doré');
  });

  it('fichier : mappe les lignes directement (confidence 0.95, stage assisted), sans LLM', async () => {
    const vision = new FakeVision([]); // toute sollicitation ferait échouer le fake
    const result = await artPlugin.recognize(
      {
        kind: 'file',
        fileRows: [
          { title: 'Plage de Trouville', artist: 'Eugène Boudin', dimensions: '24 x 33 cm' },
          { artist: 'Bernard Buffet', technique: 'lithographie' },
        ],
      },
      { vision },
    );

    expect(result.stage).toBe('assisted');
    expect(result.needsAssistedEntry).toBe(false);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((c) => c.confidence === 0.95)).toBe(true);
    expect(result.candidates[0]?.label).toBe('Plage de Trouville');
    // Dimensions texte → structurées via parseDimensions.
    expect(result.candidates[0]?.attributes['dimensionsCm']).toEqual({ height: 24, width: 33 });
    expect(result.candidates[1]?.label).toBe('Bernard Buffet — lithographie');
    expect(vision.requests).toHaveLength(0);
  });

  it('photo sans image exploitable → saisie assistée sans appel vision', async () => {
    const vision = new FakeVision([]);
    const result = await artPlugin.recognize({ kind: 'photo', media: [] }, { vision });
    expect(result).toEqual({ candidates: [], stage: 'llm_vision', needsAssistedEntry: true });
    expect(vision.requests).toHaveLength(0);
  });
});

// ── analyze ──────────────────────────────────────────────────────────────────

describe('artPlugin.analyze', () => {
  it('produit une fiche art_v1 conforme avec disclaimers obligatoires', async () => {
    const vision = new FakeVision(['```json\n' + JSON.stringify(ANALYSIS_PAYLOAD) + '\n```']);
    const result = await artPlugin.analyze(makeCandidate(), { vision });

    expect(result.engine).toBe('art_v1');
    expect(vision.requests[0]?.system).toBe(ART_SYSTEM_PROMPT);

    expect(result.payload.identification.artist).toBe('Eugène Boudin');
    expect(result.payload.identification.attributionQualifier).toBe('signe');
    expect(result.payload.identification.dimensionsCm).toEqual({ height: 24, width: 33 });
    expect(result.payload.identification.signatureDetected).toBe(true);
    expect(result.payload.condition.issues).toContain('vernis encrassé');
    expect(result.payload.provenance.evidence).toHaveLength(2);
    expect(result.payload.comparables[0]?.description).toContain('Scène de plage');
    expect(result.payload.uncertainties.length).toBeGreaterThan(0);

    expect(result.confidence).toBe(0.9);
    // Signature nette ET confiance > 0.85 → l'expertise n'est pas forcée.
    expect(result.payload.expertiseRecommended).toBe(false);

    // Disclaimers TOUJOURS non vides, avec les mentions obligatoires.
    expect(result.disclaimers).toContain(
      'Estimation indicative — ni expertise légale, ni conseil en investissement.',
    );
    expect(result.disclaimers).toContain(
      'Hypothèse d’attribution — une expertise humaine est recommandée pour toute valeur significative.',
    );
    expect(result.disclaimers).toEqual([...ART_DISCLAIMERS]);

    // Références éditoriales citées par le moteur.
    expect(result.sources).toEqual([
      { name: 'Catalogue raisonné Schmit', kind: 'official_quote', url: 'https://example.org/schmit' },
    ]);
  });

  it('force expertiseRecommended=true si la confiance est sous 0.85', async () => {
    const vision = new FakeVision([
      JSON.stringify({ ...ANALYSIS_PAYLOAD, confidence: 0.6, expertiseRecommended: false }),
    ]);
    const result = await artPlugin.analyze(makeCandidate(), { vision });

    expect(result.confidence).toBe(0.6);
    expect(result.payload.expertiseRecommended).toBe(true);
  });

  it('force expertiseRecommended=true si la signature n’est pas détectée, même à confiance haute', async () => {
    const payload = {
      ...ANALYSIS_PAYLOAD,
      identification: { ...ANALYSIS_PAYLOAD.identification, signatureDetected: false, attributionQualifier: 'attribue_a' },
      expertiseRecommended: false,
    };
    const vision = new FakeVision([JSON.stringify(payload)]);
    const result = await artPlugin.analyze(makeCandidate(), { vision });

    expect(result.payload.expertiseRecommended).toBe(true);
  });

  it('complète uncertainties si le payload parsé l’omet et qualifie une attribution manquante', async () => {
    const { uncertainties: _omitted, ...rest } = ANALYSIS_PAYLOAD;
    const withoutQualifier = {
      ...rest,
      identification: { artist: 'Eugène Boudin', signatureDetected: true },
    };
    const vision = new FakeVision([JSON.stringify(withoutQualifier)]);
    const result = await artPlugin.analyze(makeCandidate(), { vision });

    expect(result.payload.uncertainties.length).toBeGreaterThanOrEqual(1);
    // Attribution TOUJOURS qualifiée — jamais d'artiste affirmé sans qualificatif.
    expect(result.payload.identification.attributionQualifier).toBe('attribue_a');
  });

  it('attribution sans artiste → anonyme ; sources par défaut si non citées', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        identification: { school: 'école flamande', signatureDetected: false },
        condition: { summary: 'Usures.', issues: [] },
        provenance: { evidence: [] },
        comparables: [],
        uncertainties: ['Datation incertaine.'],
        expertiseRecommended: true,
        confidence: 0.4,
      }),
    ]);
    const result = await artPlugin.analyze(makeCandidate({ attributes: {} }), { vision });

    expect(result.payload.identification.attributionQualifier).toBe('anonyme');
    expect(result.payload.expertiseRecommended).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0]?.name).toContain('Artprice');
  });

  it('réponse corrompue → VelumError ANALYSIS_FAILED', async () => {
    const vision = new FakeVision([CORRUPTED_RESPONSE]);
    let error: unknown;
    try {
      await artPlugin.analyze(makeCandidate(), { vision });
    } catch (e) {
      error = e;
    }
    expect(isVelumError(error)).toBe(true);
    expect(isVelumError(error) && error.code).toBe('ANALYSIS_FAILED');
  });
});

// ── buildPriceQuery ──────────────────────────────────────────────────────────

describe('artPlugin.buildPriceQuery', () => {
  it('compose un libellé canonique depuis artiste + titre + technique, avec condition', () => {
    const query = artPlugin.buildPriceQuery(
      makeCandidate({
        attributes: {
          artist: 'Eugène Boudin',
          title: 'Plage de Trouville',
          technique: 'huile sur panneau',
          condition: 'bon état',
          dimensions: '24 x 33 cm',
        },
      }),
    );

    expect(query.domain).toBe('art');
    expect(query.label).toBe('Eugène Boudin Plage de Trouville huile sur panneau');
    expect(query.condition).toBe('bon état');
    expect(query.attributes['dimensionsCm']).toEqual({ height: 24, width: 33 });
    expect(query.limit).toBe(20);
  });

  it('replie sur le label du candidat quand les attributs textuels manquent', () => {
    const query = artPlugin.buildPriceQuery(
      makeCandidate({ label: 'Paysage animé, école française', attributes: {} }),
    );

    expect(query.label).toBe('Paysage animé, école française');
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

describe('artPlugin.valuate', () => {
  it('agrège 2 sources mockées (dont une en panne, ignorée) et valorise via le moteur réel', async () => {
    const auctionSource: PriceSource = {
      name: 'Drouot (mock)',
      kind: 'auction_realized',
      fetch: async () => [
        makeObservation(4000, 'EUR', 'auction_realized', 30),
        makeObservation(4400, 'EUR', 'auction_realized', 120),
      ],
    };
    const listingSource: PriceSource = {
      name: 'Artsy (mock)',
      kind: 'listing',
      fetch: async () => [
        makeObservation(4800, 'EUR', 'listing', 5),
        makeObservation(5000, 'USD', 'listing', 10), // 5000 × 0.9 = 4500 EUR
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

    const result = await artPlugin.valuate(makeCandidate(), deps);

    expect(result.currency).toBe('EUR');
    expect(result.nSources).toBe(4); // les 4 observations survivent au MAD, la source en panne est ignorée
    expect(result.central).toBeGreaterThanOrEqual(4000);
    expect(result.central).toBeLessThanOrEqual(4800);
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
      await artPlugin.valuate(makeCandidate(), deps);
    } catch (e) {
      error = e;
    }
    expect(isVelumError(error)).toBe(true);
    expect(isVelumError(error) && error.code).toBe('NO_OBSERVATIONS');
  });
});
