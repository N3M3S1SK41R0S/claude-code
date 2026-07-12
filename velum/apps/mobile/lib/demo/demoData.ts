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
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}
function coinAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { country: 'France', type: label, year: 1960, metal: 'argent 835‰', mintMark: 'A', weightGrams: 12, diameterMm: 29 },
    grade: { scale: 'fr', value: 'SUP', confidence: 0.7, caveat: 'Estimation visuelle — seule une gradation PCGS/NGC fait foi.' },
    rarity: { level: 'peu_courante' },
    varieties: [],
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}
function artAnalysis(label: string): Record<string, unknown> {
  return {
    identification: { attributionQualifier: 'ecole_de', title: label, technique: 'huile sur toile', support: 'toile', estimatedPeriod: 'début XXe', school: 'École provençale', signatureDetected: false },
    condition: { summary: 'Bon état général', issues: [] },
    provenance: { evidence: [] },
    comparables: [{ description: 'Paysages provençaux de la même période' }],
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
    uncertainties: ['Mode démo : fiche illustrative générée localement.'],
  };
}

const ANALYSIS: Record<VelumDomain, (label: string) => Record<string, unknown>> = {
  wine: wineAnalysis,
  coin: coinAnalysis,
  art: artAnalysis,
  stamp: stampAnalysis,
};
const ENGINE: Record<VelumDomain, string> = { wine: 'zappa_vini', coin: 'numis_v1', art: 'art_v1', stamp: 'phila_v1' };
const BASE_PRICE: Record<VelumDomain, number> = { wine: 55, coin: 20, art: 600, stamp: 12 };

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

export function demoValuate(domain: VelumDomain, candidate: Candidate): ValuationResult {
  const center = seedPrice(candidate.label, BASE_PRICE[domain]);
  // Observations synthétiques autour du centre → vrai moteur §7 (IC, fiabilité).
  const obs: PriceObservation[] = [0.82, 0.94, 1.0, 1.07, 1.18, 0.9].map((k, i) => ({
    price: Math.round(center * k),
    currency: 'EUR',
    ageDays: i * 25,
    sourceWeight: i < 2 ? 1 : 0.7,
    source: { name: i < 2 ? 'Ventes réalisées (démo)' : 'Marketplace (démo)', kind: i < 2 ? 'auction_realized' : 'marketplace_sold' },
  }));
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
