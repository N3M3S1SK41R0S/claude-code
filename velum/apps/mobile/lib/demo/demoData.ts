/**
 * Données et générateurs du MODE DÉMO — l'app tourne sans backend ni clé :
 * reconnaissance, fiches d'analyse (par domaine) et estimations réalistes,
 * ces dernières calculées par le VRAI moteur §7 (@velum/valuation). Tout est
 * en mémoire ; rien ne part sur le réseau.
 */
import type {
  AlertRecord,
  AnalysisResult,
  Candidate,
  CaptureInput,
  PriceObservation,
  RecognitionResult,
  ValuationResult,
  VelumDomain,
  VelumItem,
} from '@velum/core';
import { valuate as runValuation } from '@velum/valuation';

export const DEMO_OWNER = 'demo-user';

export function nowIso(): string {
  return new Date().toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function uid(): string {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

/** Hash déterministe d'un libellé → prix pseudo-aléatoire stable. */
function seedPrice(label: string, base: number): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return Math.round(base * (0.7 + (h % 60) / 100)); // ±30 %
}

// ── Fiches d'analyse par domaine ─────────────────────────────────────────────

function wineAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { producer: label, winemaker: 'Daniel Ravier', appellation: 'Bandol', vintage: 2018, color: 'rouge', region: 'Provence', country: 'France' },
    tasting: {
      robe: 'Grenat profond',
      nose: ['fruits noirs', 'garrigue', 'épices'],
      noseFirst: ['fruits noirs', 'mûre', 'violette'],
      noseSecond: ['garrigue', 'cuir', 'tabac blond'],
      palate: { structure: 'ample', tannins: 'fondus', acidity: 'fraîche', alcohol: '14 %' },
      palateAttack: 'Ample et charnue, sur le fruit mûr',
      palateEvolution: 'Évolue sur les épices douces et la réglisse, finale légèrement saline',
      length: 'longue',
      cellarTemperatureC: [12, 14],
      serviceTemperatureC: [16, 18],
      decanting: { recommended: true, durationMinutes: 60, note: 'Ouvre le second nez sur la garrigue.' },
      agingPotentialYears: [6, 18],
      drinkWindow: { from: 2023, to: 2032 },
    },
    ratings: { rvf: '16/20', positioning: 'classique' },
    market: { marketTension: 'moyenne', speculativeScore: 6, assetClass: 'cave' },
    comparisons: { foodPairings: ['gigot d’agneau', 'daube provençale', 'fromages affinés'], regionalEquivalents: ['Château Pradeaux'] },
    heritage: {
      history:
        'Fief historique du mourvèdre à Bandol, sur restanques calcaires face à la Méditerranée. Une cuvée de garde façonnée par la même famille depuis l’après-guerre, référence de l’appellation.',
      rarity: { level: 'peu_courante', note: 'cuvée de propriété, allocation limitée' },
      editionSize: { count: 30000, unit: 'bottles', note: 'production estimée du millésime' },
    },
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}
function coinAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { country: 'France', type: label, year: 1960, metal: 'argent 835‰', mintMark: 'A', weightGrams: 12, diameterMm: 29 },
    grade: { scale: 'fr', value: 'SUP', confidence: 0.7, caveat: 'Estimation visuelle — seule une gradation PCGS/NGC fait foi.' },
    rarity: { level: 'peu_courante' },
    varieties: [],
    heritage: {
      history:
        'La Semeuse d’Oscar Roty, gravée dès 1897, sème « à tout vent » — figure de la République reprise sur l’argent de la Ve République. Les états supérieurs (SUP et au-delà) sont les plus recherchés.',
      rarity: { level: 'peu_courante', note: 'millésime courant, rare en qualité choisie' },
      editionSize: { count: 5000000, unit: 'exemplaires', note: 'tirage — atelier de Paris' },
    },
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}
function artAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { attributionQualifier: 'ecole_de', title: label, technique: 'huile sur toile', support: 'toile', estimatedPeriod: 'début XXe', school: 'École provençale', signatureDetected: false },
    condition: { summary: 'Bon état général', issues: [] },
    provenance: { evidence: [] },
    comparables: [{ description: 'Paysages provençaux de la même période' }],
    heritage: {
      history:
        'Paysage dans la mouvance provençale du début du XXe siècle, dans le sillage de l’école de Marseille — oliviers et lumière méridionale, sujet prisé des ateliers régionaux.',
      rarity: { level: 'inconnue', note: 'attribution à confirmer par expertise' },
      editionSize: { unit: 'unique' },
    },
    uncertainties: ['Mode démo : hypothèse illustrative — une expertise humaine reste requise.'],
    expertiseRecommended: true,
  };
}
function stampAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { country: 'France', catalog: 'yvert_tellier', catalogNumber: label, year: 1903, faceValue: '15c', color: 'vert', perforation: '14 × 13½' },
    condition: { status: 'neuf_avec_charniere', gum: 'intacte', centering: 'bon', faults: [], confidence: 0.7, caveat: 'Estimation visuelle — une expertise fait foi pour les fortes valeurs.' },
    rarity: { level: 'courante' },
    varieties: [],
    heritage: {
      history:
        'Type Semeuse lignée gravé par Louis-Oscar Roty, usuel emblématique de la IIIe République imprimé en taille-douce au tout début du XXe siècle. Coté selon la dentelure, le centrage et la gomme.',
      rarity: { level: 'courante', note: 'usuel ; les variétés de dentelure sont plus rares' },
      editionSize: { count: 120000000, unit: 'stamps', note: 'tirage courant' },
    },
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}

function watchAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { brand: 'Omega', model: label, reference: '3570.50', year: 1998, gender: 'homme', caseMaterial: 'acier', caseDiameterMm: 42, dialColor: 'noir', bracelet: 'acier', crystal: 'hésalite (plexiglas)', waterResistanceM: 50, boxPapers: 'montre_seule' },
    movement: { type: 'manuel', calibre: 'Omega 1861', powerReserveHours: 48, frequencyVph: 21600, jewels: 18, complications: ['chronographe', 'petite seconde'], certification: 'qualifiée NASA pour les vols habités' },
    condition: { summary: 'Bel état général, patine homogène du boîtier.', polished: 'leger', issues: ['rayures superficielles sur le verre'], confidence: 0.7, caveat: 'Estimation visuelle — seul un horloger ouvrant le boîtier peut attester du mouvement et de l’authenticité.' },
    story: {
      why: 'Chronographe conçu en 1957 pour la course automobile et l’ingénierie, devenu la montre des missions Apollo après les tests de qualification de la NASA.',
      byWhom: 'Omega — calibre chronographe développé avec Lemania (321, puis 861/1861).',
      modelLaunchYear: 1957,
      milestones: [
        { year: 1965, note: 'Qualifiée par la NASA pour tous les vols spatiaux habités' },
        { year: 1969, note: 'Première montre portée sur la Lune (Apollo 11)' },
      ],
    },
    heritage: {
      history:
        'La « Moonwatch » : lancée en 1957 dans la trilogie des montres professionnelles Omega, elle accompagne toutes les missions Apollo. Production continue depuis, ce qui en fait l’un des chronographes les plus documentés du marché.',
      rarity: { level: 'courante', note: 'grande série ; références anciennes et cadrans particuliers recherchés' },
      editionSize: { unit: 'exemplaires', note: 'production continue, non limitée' },
    },
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}

const ANALYSIS: Record<VelumDomain, (label: string) => Record<string, unknown>> = {
  wine: wineAnalysis,
  coin: coinAnalysis,
  art: artAnalysis,
  stamp: stampAnalysis,
  watch: watchAnalysis,
};
const ENGINE: Record<VelumDomain, string> = { wine: 'zappa_vini', coin: 'numis_v1', art: 'art_v1', stamp: 'phila_v1', watch: 'watch_v1' };
const BASE_PRICE: Record<VelumDomain, number> = { wine: 55, coin: 20, art: 600, stamp: 12, watch: 4200 };

const DISCLAIMERS = [
  'Estimation indicative — ni expertise légale, ni conseil en investissement.',
  'Mode démo : données générées localement, sans source de prix réelle.',
];

// ── Générateurs ──────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<VelumDomain, string[]> = {
  wine: ['Bandol Domaine Tempier 2018', 'Châteauneuf-du-Pape 2019', 'Sancerre Vacheron 2022'],
  coin: ['5 Francs Semeuse argent 1960', '20 Francs Or Marianne 1907', '2 Euros commémorative 2012'],
  art: ['École provençale — Paysage aux oliviers', 'Nature morte, huile sur toile', 'Marine impressionniste'],
  stamp: ['YT 130 — Semeuse 15c vert', 'YT 216 — Merson 3f', 'Bloc CITEX 1949'],
  watch: ['Omega Speedmaster Professional 3570.50', 'Rolex Datejust 36 16234', 'Cartier Tank Must WSTA0041'],
};

export function demoRecognize(domain: VelumDomain, input: CaptureInput): RecognitionResult {
  if (input.kind === 'file' && input.fileRows) {
    const candidates: Candidate[] = input.fileRows.slice(0, 3).map((row) => ({
      id: uid(),
      domain,
      label: String(row['title'] ?? row['label'] ?? Object.values(row)[0] ?? 'Objet importé'),
      confidence: 0.95,
      attributes: row,
    }));
    return { candidates, stage: 'assisted', needsAssistedEntry: candidates.length === 0 };
  }
  const base = input.kind === 'text' && input.text?.trim() ? input.text.trim() : (DOMAIN_LABELS[domain][0] as string);
  const alt = DOMAIN_LABELS[domain];
  const candidates: Candidate[] = [
    { id: uid(), domain, label: base, confidence: 0.86, attributes: { source: 'demo' } },
    { id: uid(), domain, label: alt[1] as string, confidence: 0.42, attributes: { source: 'demo' } },
    { id: uid(), domain, label: alt[2] as string, confidence: 0.21, attributes: { source: 'demo' } },
  ];
  return { candidates, stage: 'llm_vision', needsAssistedEntry: false };
}

export function demoAnalyze(domain: VelumDomain, candidate: Candidate): AnalysisResult {
  const payload = ANALYSIS[domain](candidate.label);
  return {
    engine: ENGINE[domain],
    payload,
    confidence: candidate.confidence,
    sources: [{ name: 'VELUM Démo', kind: 'official_quote' }],
    disclaimers: DISCLAIMERS,
  };
}

/**
 * Sources marché par domaine — les MÊMES maisons que les adaptateurs réels
 * (packages/domains/<domaine>/src/sources) : en production ces observations
 * viennent de leurs API ; en démo, on les simule pour illustrer les ventes.
 */
const SALES_SOURCES: Record<VelumDomain, { name: string; kind: PriceObservation['source']['kind'] }[]> = {
  wine: [
    { name: 'iDealwine', kind: 'auction_realized' },
    { name: 'Wine-Searcher', kind: 'official_quote' },
    { name: 'iDealwine', kind: 'auction_realized' },
    { name: 'eBay (vendu)', kind: 'marketplace_sold' },
    { name: 'Cavissima', kind: 'listing' },
    { name: 'Vivino Market', kind: 'listing' },
  ],
  coin: [
    { name: 'Heritage Auctions', kind: 'auction_realized' },
    { name: 'CGB', kind: 'auction_realized' },
    { name: 'Numista', kind: 'official_quote' },
    { name: 'eBay (vendu)', kind: 'marketplace_sold' },
    { name: 'Catawiki', kind: 'marketplace_sold' },
    { name: 'NGC', kind: 'official_quote' },
  ],
  stamp: [
    { name: 'Delcampe', kind: 'marketplace_sold' },
    { name: 'Yvert & Tellier', kind: 'official_quote' },
    { name: 'eBay (vendu)', kind: 'marketplace_sold' },
    { name: 'Catawiki', kind: 'marketplace_sold' },
    { name: 'Colnect', kind: 'official_quote' },
    { name: 'Delcampe', kind: 'marketplace_sold' },
  ],
  art: [
    { name: 'Drouot', kind: 'auction_realized' },
    { name: 'Artprice', kind: 'official_quote' },
    { name: 'Heritage Auctions', kind: 'auction_realized' },
    { name: 'Catawiki', kind: 'marketplace_sold' },
    { name: 'Artsy', kind: 'listing' },
    { name: 'Drouot', kind: 'auction_realized' },
  ],
  watch: [
    { name: 'Heritage Auctions', kind: 'auction_realized' },
    { name: 'WatchCharts', kind: 'official_quote' },
    { name: 'eBay (vendu)', kind: 'marketplace_sold' },
    { name: 'Catawiki', kind: 'marketplace_sold' },
    { name: 'Chrono24', kind: 'listing' },
    { name: 'Heritage Auctions', kind: 'auction_realized' },
  ],
};

const KIND_WEIGHT: Record<PriceObservation['source']['kind'], number> = {
  auction_realized: 1,
  official_quote: 0.9,
  marketplace_sold: 0.7,
  listing: 0.4,
};

export function demoValuate(domain: VelumDomain, candidate: Candidate): ValuationResult {
  const center = seedPrice(candidate.label, BASE_PRICE[domain]);
  // Observations synthétiques autour du centre → vrai moteur §7 (IC, fiabilité).
  // Chaque observation est attribuée à une source marché et datée (dernières ventes).
  const obs: PriceObservation[] = [1.0, 0.94, 1.07, 0.82, 1.18, 0.9].map((k, i) => {
    const src = SALES_SOURCES[domain][i % SALES_SOURCES[domain].length] as {
      name: string;
      kind: PriceObservation['source']['kind'];
    };
    return {
      price: Math.round(center * k),
      currency: 'EUR',
      ageDays: 12 + i * 34,
      sourceWeight: KIND_WEIGHT[src.kind],
      source: { name: src.name, kind: src.kind },
      matchedLabel: candidate.label,
    };
  });
  return runValuation(obs, {});
}

// ── État initial (collection démo pré-remplie) ───────────────────────────────

function makeItem(domain: VelumDomain, title: string, extra: Partial<VelumItem> = {}): VelumItem {
  return {
    id: uid(),
    ownerId: DEMO_OWNER,
    domain,
    title,
    attributes: { analysis: ANALYSIS[domain](title) },
    confidence: 0.9,
    acquiredAt: daysAgo(600),
    acquiredPrice: Math.round(BASE_PRICE[domain] * 0.7),
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(20),
    ...extra,
  };
}

export function seedItems(): VelumItem[] {
  return [
    makeItem('wine', 'Bandol Domaine Tempier 2016', { storageLocation: 'Cave — casier B3', attributes: { vintage: 2016, analysis: wineAnalysis('Domaine Tempier') } }),
    makeItem('wine', 'Châteauneuf-du-Pape 2019', { storageLocation: 'Rangée 3 · Colonne 4 · Place 2', attributes: { vintage: 2019, analysis: wineAnalysis('Châteauneuf-du-Pape') } }),
    makeItem('coin', '5 Francs Semeuse argent 1960', { storageLocation: 'Médaillier — plateau 2', attributes: { grade: 'SUP', year: 1960, analysis: coinAnalysis('5 Francs Semeuse') } }),
    makeItem('art', 'École provençale — Paysage aux oliviers', { storageLocation: 'Salon', confidence: 0.62, attributes: { analysis: artAnalysis('Paysage aux oliviers') } }),
    makeItem('stamp', 'Semeuse lignée 15c vert — YT 130', { storageLocation: 'Album 1 — page 12', attributes: { catalogNumber: 'YT 130', analysis: stampAnalysis('YT 130') } }),
    makeItem('watch', 'Omega Speedmaster Professional 3570.50', { storageLocation: 'Écrin — emplacement 1', attributes: { brand: 'Omega', reference: '3570.50', analysis: watchAnalysis('Speedmaster Professional') } }),
  ];
}

export function seedAlerts(items: VelumItem[]): AlertRecord[] {
  const wine = items.find((i) => i.domain === 'wine');
  return wine ? [{ id: uid(), itemId: wine.id, type: 'drink_window', config: {}, active: true }] : [];
}

export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
}
export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: uid(),
    title: 'À boire — apogée atteinte',
    body: 'Bandol Domaine Tempier 2016 est dans sa fenêtre optimale. Accord : gigot d’agneau aux herbes.',
    created_at: daysAgo(2),
  },
];
