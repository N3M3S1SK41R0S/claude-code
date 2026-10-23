/**
 * Données et générateurs du MODE DÉMO — l'app tourne sans backend ni clé :
 * reconnaissance, fiches d'analyse (par domaine) et estimations réalistes,
 * ces dernières calculées par le VRAI moteur §7 (@velum/valuation). Tout est
 * en mémoire ; rien ne part sur le réseau.
 */
import {
  ASSISTED_ENTRY_THRESHOLD,
  VelumError,
  type AlertRecord,
  type AnalysisResult,
  type Candidate,
  type CaptureInput,
  type PriceObservation,
  type QuickEstimate,
  type RecognitionResult,
  type SheetDetection,
  type SheetRecognitionResult,
  type ValuationResult,
  type VelumDomain,
  type VelumItem,
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

/** Identification démo : libellé, attributs d'identité, classement, prix indicatif central. */
interface DemoIdentity {
  label: string;
  attributes: Record<string, unknown>;
  classification: string[];
  /** Valeur centrale indicative (EUR) — la fourchette démo l'encadre à ±25 %. */
  value: number;
}

const DOMAIN_IDENTITIES: Record<VelumDomain, DemoIdentity[]> = {
  wine: [
    { label: 'Bandol Domaine Tempier 2018', attributes: { producer: 'Domaine Tempier', appellation: 'Bandol', vintage: 2018, color: 'rouge', region: 'Provence', country: 'France' }, classification: ['Vin', 'Provence', 'Bandol'], value: 45 },
    { label: 'Châteauneuf-du-Pape 2019', attributes: { appellation: 'Châteauneuf-du-Pape', vintage: 2019, color: 'rouge', region: 'Vallée du Rhône' }, classification: ['Vin', 'Vallée du Rhône', 'Châteauneuf-du-Pape'], value: 38 },
    { label: 'Sancerre Vacheron 2022', attributes: { producer: 'Domaine Vacheron', appellation: 'Sancerre', vintage: 2022, color: 'blanc' }, classification: ['Vin', 'Loire', 'Sancerre'], value: 32 },
  ],
  coin: [
    { label: '5 Francs Semeuse argent 1960', attributes: { country: 'France', type: '5 Francs Semeuse', year: 1960, metal: 'argent' }, classification: ['France', 'Semeuse argent', '1959–1969'], value: 12 },
    { label: '20 Francs Or Marianne 1907', attributes: { country: 'France', type: '20 Francs Marianne Coq', year: 1907, metal: 'or' }, classification: ['France', 'Or', 'Marianne Coq'], value: 420 },
    { label: '2 Euros commémorative 2012', attributes: { country: 'France', type: '2 Euros commémorative', year: 2012 }, classification: ['France', 'Euro', 'Commémoratives'], value: 4 },
  ],
  art: [
    { label: 'École provençale — Paysage aux oliviers', attributes: { attributionQualifier: 'ecole_de', title: 'Paysage aux oliviers', technique: 'huile sur toile', school: 'École provençale' }, classification: ['Peinture', 'École provençale', 'début XXe'], value: 600 },
    { label: 'Nature morte, huile sur toile', attributes: { attributionQualifier: 'anonyme', technique: 'huile sur toile' }, classification: ['Peinture', 'Nature morte', 'XIXe'], value: 350 },
    { label: 'Marine impressionniste', attributes: { attributionQualifier: 'anonyme', title: 'Marine' }, classification: ['Peinture', 'Impressionnisme', 'fin XIXe'], value: 800 },
  ],
  stamp: [
    { label: 'YT 130 — Semeuse 15c vert', attributes: { country: 'France', catalogNumber: 'YT 130', catalog: 'yvert_tellier', year: 1903, faceValue: '15c', color: 'vert', status: 'oblitere' }, classification: ['France', 'Semeuse lignée', '1903'], value: 1.5 },
    { label: 'YT 216 — Merson 3f', attributes: { country: 'France', catalogNumber: 'YT 216', catalog: 'yvert_tellier', year: 1925, faceValue: '3f' }, classification: ['France', 'Merson', '1925–1926'], value: 25 },
    { label: 'Bloc CITEX 1949', attributes: { country: 'France', title: 'Bloc CITEX', year: 1949 }, classification: ['France', 'Blocs', '1949'], value: 60 },
  ],
  watch: [
    { label: 'Omega Speedmaster Professional 3570.50', attributes: { brand: 'Omega', model: 'Speedmaster Professional', reference: '3570.50' }, classification: ['Omega', 'Speedmaster', 'années 1990'], value: 4800 },
    { label: 'Rolex Datejust 36 16234', attributes: { brand: 'Rolex', model: 'Datejust 36', reference: '16234' }, classification: ['Rolex', 'Datejust', 'années 1990'], value: 6200 },
    { label: 'Cartier Tank Must WSTA0041', attributes: { brand: 'Cartier', model: 'Tank Must', reference: 'WSTA0041' }, classification: ['Cartier', 'Tank', 'années 2020'], value: 2900 },
  ],
};

/** Libellé de catégorie démo pour une saisie libre (classement minimal honnête). */
const DOMAIN_ROOT: Record<VelumDomain, string> = {
  wine: 'Vin',
  coin: 'Monnaies',
  art: 'Peinture',
  stamp: 'Timbres',
  watch: 'Montres',
};

/** Fourchette indicative démo : ±25 % autour d'une valeur, arrondie (jamais une cote). */
function demoEstimate(value: number): QuickEstimate {
  const round = (n: number) => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));
  return { low: round(value * 0.75), high: round(value * 1.25), currency: 'EUR' };
}

function demoCandidate(domain: VelumDomain, identity: DemoIdentity, confidence: number): Candidate {
  return {
    id: uid(),
    domain,
    label: identity.label,
    confidence,
    attributes: { ...identity.attributes },
    classification: [...identity.classification],
    // Même règle que les plugins : pas de prix sous le seuil de saisie assistée.
    ...(confidence >= ASSISTED_ENTRY_THRESHOLD ? { quickEstimate: demoEstimate(identity.value) } : {}),
  };
}

/** Scan éclair démo : identification + classement + fourchette indicative. */
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
  const known = DOMAIN_IDENTITIES[domain];
  const [first, second, third] = known;
  const text = input.kind === 'text' ? input.text?.trim() : undefined;
  const best: DemoIdentity | undefined = text
    ? {
        label: text,
        attributes: {},
        classification: [DOMAIN_ROOT[domain]],
        value: seedPrice(text, BASE_PRICE[domain]),
      }
    : first;
  const candidates: Candidate[] = [];
  if (best) candidates.push(demoCandidate(domain, best, 0.86));
  if (second) candidates.push(demoCandidate(domain, second, 0.42));
  if (third) candidates.push(demoCandidate(domain, third, 0.21));
  return { candidates, stage: 'llm_vision', needsAssistedEntry: false };
}

// ── Mode classeur démo : planches de timbres et plateaux de pièces ───────────

/** Objets d'une planche démo ; `confidence` 0 = case illisible (saisie assistée). */
const SHEET_CONTENT: Partial<Record<VelumDomain, (DemoIdentity & { confidence: number })[]>> = {
  stamp: [
    { label: 'Semeuse camée 10c rouge (YT 138)', attributes: { country: 'France', catalogNumber: 'YT 138', year: 1906, faceValue: '10c', color: 'rouge', status: 'oblitere' }, classification: ['France', 'Semeuse camée', '1906–1937'], value: 0.6, confidence: 0.82 },
    { label: 'Marianne de Gandon 15f rouge (YT 813)', attributes: { country: 'France', catalogNumber: 'YT 813', year: 1948, faceValue: '15f' }, classification: ['France', 'Marianne de Gandon', '1945–1954'], value: 0.4, confidence: 0.78 },
    { label: 'Mercure 10c outremer (YT 546)', attributes: { country: 'France', catalogNumber: 'YT 546', year: 1942, faceValue: '10c' }, classification: ['France', 'Mercure', '1938–1942'], value: 0.3, confidence: 0.74 },
    { label: 'Paix 1f50 brun-rouge (YT 288)', attributes: { country: 'France', catalogNumber: 'YT 288', year: 1932, faceValue: '1f50' }, classification: ['France', 'Type Paix', '1932–1939'], value: 0.8, confidence: 0.7 },
    { label: 'Arc de Triomphe 2f (YT 629)', attributes: { country: 'France', catalogNumber: 'YT 629', year: 1944, faceValue: '2f' }, classification: ['France', 'Arc de Triomphe', '1944–1945'], value: 0.5, confidence: 0.62 },
    { label: 'Pasteur 50c rouge (YT 176)', attributes: { country: 'France', catalogNumber: 'YT 176', year: 1923, faceValue: '50c' }, classification: ['France', 'Pasteur', '1923–1926'], value: 1.2, confidence: 0.58 },
    { label: 'Cérès 20c noir (YT 3)', attributes: { country: 'France', catalogNumber: 'YT 3', year: 1849, faceValue: '20c', color: 'noir', status: 'oblitere' }, classification: ['France', 'Cérès', '1849–1850'], value: 60, confidence: 0.55 },
    { label: 'Sage 15c bleu type II (YT 90)', attributes: { country: 'France', catalogNumber: 'YT 90', year: 1878, faceValue: '15c' }, classification: ['France', 'Type Sage', '1876–1900'], value: 2, confidence: 0.52 },
    { label: 'Case illisible', attributes: {}, classification: [], value: 0, confidence: 0 },
    { label: 'Iris 1f rouge (YT 433) ?', attributes: { country: 'France', catalogNumber: 'YT 433' }, classification: ['France', 'Iris'], value: 0.3, confidence: 0.3 },
    { label: 'Blason de Lyon (YT 572)', attributes: { country: 'France', catalogNumber: 'YT 572', year: 1943 }, classification: ['France', 'Blasons', '1941–1946'], value: 0.5, confidence: 0.66 },
    { label: 'Marianne de Muller 20f (YT 1011B)', attributes: { country: 'France', catalogNumber: 'YT 1011B', year: 1955, faceValue: '20f' }, classification: ['France', 'Marianne de Muller', '1955–1959'], value: 0.3, confidence: 0.69 },
  ],
  coin: [
    { label: '5 Francs Semeuse argent 1962', attributes: { country: 'France', type: '5 Francs Semeuse', year: 1962, metal: 'argent' }, classification: ['France', 'Semeuse argent', '1959–1969'], value: 12, confidence: 0.84 },
    { label: '1 Franc Semeuse 1960', attributes: { country: 'France', type: '1 Franc Semeuse', year: 1960, metal: 'nickel' }, classification: ['France', 'Semeuse nickel', '1960–2001'], value: 4, confidence: 0.8 },
    { label: '10 Francs Hercule 1965', attributes: { country: 'France', type: '10 Francs Hercule', year: 1965, metal: 'argent' }, classification: ['France', 'Hercule argent', '1964–1973'], value: 20, confidence: 0.76 },
    { label: '20 Francs Turin 1933', attributes: { country: 'France', type: '20 Francs Turin', year: 1933, metal: 'argent' }, classification: ['France', 'Turin', '1929–1939'], value: 24, confidence: 0.68 },
    { label: '2 Francs Morlon 1931', attributes: { country: 'France', type: '2 Francs Morlon', year: 1931, metal: 'bronze-aluminium' }, classification: ['France', 'Morlon', '1931–1941'], value: 1.2, confidence: 0.55 },
    { label: '10 Centimes Lavrillier 1939', attributes: { country: 'France', type: '10 Centimes Lavrillier', year: 1939 }, classification: ['France', 'Lavrillier', '1938–1939'], value: 0.6, confidence: 0.5 },
    { label: 'Pièce illisible', attributes: {}, classification: [], value: 0, confidence: 0 },
    { label: '1 Franc Pétain 1943 ?', attributes: { country: 'France', type: '1 Franc État français' }, classification: ['France', 'État français'], value: 0.5, confidence: 0.29 },
    { label: '50 Centimes Morlon 1932', attributes: { country: 'France', type: '50 Centimes Morlon', year: 1932 }, classification: ['France', 'Morlon', '1931–1947'], value: 0.8, confidence: 0.61 },
  ],
};

/** Empreinte stable d'une photo de planche (varie le contenu d'une planche à l'autre). */
function sheetSeed(input: CaptureInput): number {
  const first = input.media?.[0];
  const key = `${first?.storagePath ?? ''}${(first?.base64 ?? '').slice(-64)}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Planche démo (timbres, pièces) : 6 à 12 objets détectés, contenu stable pour
 * une même photo, dont une case illisible et une identification incertaine.
 * Un domaine sans mode planche est refusé comme par le serveur.
 */
export function demoRecognizeSheet(domain: VelumDomain, input: CaptureInput): SheetRecognitionResult {
  const content = SHEET_CONTENT[domain];
  if (!content) {
    throw new VelumError('INVALID_INPUT', `Le mode planche n'est pas disponible pour le module « ${domain} » (démo)`);
  }
  if (input.kind !== 'photo' || (input.media ?? []).length !== 1) {
    throw new VelumError('INVALID_INPUT', 'Le mode planche attend exactement une photo de la planche (démo)');
  }
  const seed = sheetSeed(input);
  const count = Math.min(content.length, 6 + (seed % 7));
  const offset = seed % content.length;
  const detections: SheetDetection[] = [];
  for (let i = 0; i < count; i++) {
    const entry = content[(offset + i) % content.length];
    if (!entry) continue;
    const candidates = entry.confidence > 0 ? [demoCandidate(domain, entry, entry.confidence)] : [];
    const row = Math.floor(i / 4) + 1;
    const cell = (i % 4) + 1;
    detections.push({
      index: i,
      position: `rangée ${row}, case ${cell}`,
      candidates,
      needsAssistedEntry: candidates.length === 0 || entry.confidence < ASSISTED_ENTRY_THRESHOLD,
    });
  }
  return { detections, stage: 'llm_vision', truncated: false };
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
