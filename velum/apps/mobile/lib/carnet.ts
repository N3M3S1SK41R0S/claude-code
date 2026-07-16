/**
 * Carnet virtuel (offre Gold) — fonctions PURES, sans dépendance React
 * Native : regroupement de la cave par emplacement, totaux du carnet,
 * clés i18n de mise en scène par domaine et extraction sûre d'attributs
 * d'affichage. Testé en vitest (environnement node).
 */
import type {
  AttributionQualifier,
  ValuationRecord,
  VelumDomain,
  VelumItem,
} from '@velum/core';

/** Groupe d'items par emplacement physique (null = « Sans emplacement »). */
export interface LocationGroup {
  location: string | null;
  items: VelumItem[];
}

/**
 * Regroupe les items par `storageLocation` : emplacements nommés triés
 * alphabétiquement (locale fr, insensible à la casse), puis les items sans
 * emplacement (null ou chaîne vide) dans un dernier groupe `location: null`.
 * L'ordre des items à l'intérieur d'un groupe suit l'ordre d'entrée.
 */
export function groupByLocation(items: VelumItem[]): LocationGroup[] {
  const named = new Map<string, VelumItem[]>();
  const unplaced: VelumItem[] = [];
  for (const item of items) {
    const location = item.storageLocation?.trim() ?? '';
    if (location.length === 0) {
      unplaced.push(item);
      continue;
    }
    const bucket = named.get(location);
    if (bucket) bucket.push(item);
    else named.set(location, [item]);
  }
  const groups: LocationGroup[] = [...named.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    .map(([location, grouped]) => ({ location, items: grouped }));
  if (unplaced.length > 0) groups.push({ location: null, items: unplaced });
  return groups;
}

/** Totaux d'un carnet (ou d'un groupe d'emplacement). */
export interface BookTotals {
  /** Nombre total d'objets du carnet. */
  count: number;
  /** Somme des valorisations centrales disponibles (EUR). */
  totalEUR: number;
  /** Nombre d'objets disposant d'une valorisation. */
  valuedCount: number;
  /** Horodatage ISO de la valorisation la plus récente, ou null. */
  lastValuedAt: string | null;
}

/** Calcule les totaux du carnet à partir des dernières valorisations. */
export function bookTotals(
  items: VelumItem[],
  latestByItem: Record<string, ValuationRecord | null>,
): BookTotals {
  let totalEUR = 0;
  let valuedCount = 0;
  let lastValuedAt: string | null = null;
  for (const item of items) {
    const latest = latestByItem[item.id] ?? null;
    if (!latest) continue;
    totalEUR += latest.central;
    valuedCount += 1;
    if (lastValuedAt === null || Date.parse(latest.valuedAt) > Date.parse(lastValuedAt)) {
      lastValuedAt = latest.valuedAt;
    }
  }
  return { count: items.length, totalEUR, valuedCount, lastValuedAt };
}

/** Clé i18n du « livre » d'un domaine (cave / médaillier / galerie / album / écrin). */
export type CarnetBookKey =
  | 'carnet.cave'
  | 'carnet.medaillier'
  | 'carnet.galerie'
  | 'carnet.album'
  | 'carnet.ecrin';

const BOOK_LABEL_KEYS: Record<VelumDomain, CarnetBookKey> = {
  wine: 'carnet.cave',
  coin: 'carnet.medaillier',
  art: 'carnet.galerie',
  stamp: 'carnet.album',
  watch: 'carnet.ecrin',
};

/** Clé i18n de la mise en scène du carnet pour un domaine. */
export function domainBookLabelKey(domain: VelumDomain): CarnetBookKey {
  return BOOK_LABEL_KEYS[domain];
}

/* ------------------------------------------------------------------ */
/* Rangement structuré de cave : rangée / colonne / place.             */
/* Le résultat vit dans `storageLocation` (chaîne libre, AUCUNE        */
/* migration) au format canonique « Rangée 3 · Colonne 4 · Place 2 ».  */
/* ------------------------------------------------------------------ */

/** Position structurée d'une bouteille dans la cave (tout optionnel). */
export interface CellarSlot {
  row?: number;
  column?: number;
  place?: number;
}

/**
 * Formate une position structurée en emplacement lisible :
 * « Rangée 3 · Colonne 4 · Place 2 ». N'inclut que les champs fournis
 * (nombres finis) ; null si aucun champ n'est renseigné.
 */
export function formatCellarSlot({ row, column, place }: CellarSlot): string | null {
  const parts: string[] = [];
  if (row !== undefined && Number.isFinite(row)) parts.push(`Rangée ${row}`);
  if (column !== undefined && Number.isFinite(column)) parts.push(`Colonne ${column}`);
  if (place !== undefined && Number.isFinite(place)) parts.push(`Place ${place}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const SLOT_KEYS: Record<string, keyof CellarSlot> = {
  rangée: 'row',
  rangee: 'row',
  colonne: 'column',
  place: 'place',
};

/**
 * Re-parse un emplacement au format produit par `formatCellarSlot`
 * (tolérant à la casse et aux espaces, segments dans n'importe quel ordre).
 * Retourne null si la chaîne est absente, vide ou non conforme
 * (segment inconnu, doublon, valeur non numérique).
 */
export function parseCellarSlot(location: string | null): CellarSlot | null {
  if (location === null) return null;
  const trimmed = location.trim();
  if (trimmed.length === 0) return null;
  const slot: CellarSlot = {};
  for (const segment of trimmed.split('·')) {
    const match = /^\s*([A-Za-zÀ-ÿ]+)\s+(\d+)\s*$/.exec(segment);
    if (!match || match[1] === undefined || match[2] === undefined) return null;
    const key = SLOT_KEYS[match[1].toLowerCase()];
    if (key === undefined) return null;
    if (slot[key] !== undefined) return null; // doublon → non conforme
    slot[key] = Number.parseInt(match[2], 10);
  }
  return slot;
}

/* ------------------------------------------------------------------ */
/* Extraction sûre d'attributs d'affichage (attributes est un Record   */
/* <string, unknown> : tout accès est validé avant usage).             */
/* ------------------------------------------------------------------ */

/** Chaîne d'attribut non vide (trimée), ou null. */
export function attributeString(item: VelumItem, key: string): string | null {
  const raw = item.attributes[key];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

/** Nombre fini d'attribut, ou null. */
export function attributeNumber(item: VelumItem, key: string): number | null {
  const raw = item.attributes[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** Payload d'analyse stocké dans attributes.analysis, ou null. */
function analysisOf(item: VelumItem): Record<string, unknown> | null {
  const raw = item.attributes['analysis'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/** Bloc identification du payload d'analyse, ou null. */
function identificationOf(item: VelumItem): Record<string, unknown> | null {
  const analysis = analysisOf(item);
  const raw = analysis?.['identification'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/** Grade d'une pièce : attributes.grade, sinon analysis.grade.value. */
export function coinGradeLabel(item: VelumItem): string | null {
  const direct = attributeString(item, 'grade');
  if (direct) return direct;
  const grade = analysisOf(item)?.['grade'];
  if (grade && typeof grade === 'object') {
    const value = (grade as Record<string, unknown>)['value'];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Période estimée d'un tableau : attributes puis analysis.identification. */
export function artEstimatedPeriod(item: VelumItem): string | null {
  const direct = attributeString(item, 'estimatedPeriod');
  if (direct) return direct;
  const raw = identificationOf(item)?.['estimatedPeriod'];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

const ART_QUALIFIERS: readonly AttributionQualifier[] = [
  'attribue_a',
  'entourage_de',
  'ecole_de',
  'd_apres',
  'signe',
  'anonyme',
];

/** Qualificatif d'attribution VALIDÉ (clé i18n sûre), ou null. */
export function artAttributionQualifier(item: VelumItem): AttributionQualifier | null {
  const candidates = [
    attributeString(item, 'attributionQualifier'),
    identificationOf(item)?.['attributionQualifier'],
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && (ART_QUALIFIERS as readonly string[]).includes(raw)) {
      return raw as AttributionQualifier;
    }
  }
  return null;
}

export type StampStatus =
  | 'neuf_sans_charniere'
  | 'neuf_avec_charniere'
  | 'oblitere'
  | 'sur_lettre'
  | 'inconnu';

const STAMP_STATUSES: readonly StampStatus[] = [
  'neuf_sans_charniere',
  'neuf_avec_charniere',
  'oblitere',
  'sur_lettre',
  'inconnu',
];

/** État philatélique VALIDÉ (attributes.status puis analysis.condition.status). */
export function stampConditionStatus(item: VelumItem): StampStatus | null {
  const condition = analysisOf(item)?.['condition'];
  const candidates: unknown[] = [
    attributeString(item, 'status'),
    condition && typeof condition === 'object'
      ? (condition as Record<string, unknown>)['status']
      : null,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && (STAMP_STATUSES as readonly string[]).includes(raw)) {
      return raw as StampStatus;
    }
  }
  return null;
}
