/**
 * Champs d'IDENTIFICATION éditables par domaine — source unique pour :
 *  - la saisie assistée / la correction avant confirmation (écran Candidats) ;
 *  - la correction après coup, en texte, des infos mal lues sur la photo
 *    (fiche objet).
 * Les clés sont EXACTEMENT celles des attributs du domaine (@velum/core
 * analysis/*.ts) : une correction met à jour `items.attributes` en place.
 *
 * Chaque correction est tracée dans `attributes.corrections` (valeur lue →
 * valeur corrigée, horodatée) : l'utilisateur garde la main, et le signal
 * nourrit l'amélioration de la reconnaissance — jamais de réécriture muette.
 */
import type {
  ArtAttributes,
  CoinAttributes,
  StampAttributes,
  VelumDomain,
  WatchAttributes,
  WineAttributes,
} from '@velum/core';

export interface IdentityField {
  /** Clé d'attribut du domaine (items.attributes). */
  key: string;
  /** Clé i18n du libellé. */
  labelKey: string;
  /** Valeur numérique (année, millésime, diamètre…). */
  numeric?: boolean;
  /** Bornes de validation pour les champs numériques. */
  min?: number;
  max?: number;
  /** Champ principal : proposé d'emblée en saisie assistée. */
  primary?: boolean;
}

const YEAR = { numeric: true, min: 1, max: 2100 } as const;

/** Champs par domaine, les principaux d'abord. */
export const IDENTITY_FIELDS: Record<VelumDomain, readonly IdentityField[]> = {
  wine: [
    { key: 'producer', labelKey: 'candidates.fields.wineProducer', primary: true },
    { key: 'vintage', labelKey: 'candidates.fields.wineVintage', primary: true, ...YEAR, min: 1700 },
    { key: 'appellation', labelKey: 'candidates.fields.wineAppellation', primary: true },
    { key: 'cuvee', labelKey: 'candidates.fields.wineCuvee' },
    { key: 'color', labelKey: 'candidates.fields.wineColor' },
    { key: 'region', labelKey: 'candidates.fields.wineRegion' },
    { key: 'country', labelKey: 'candidates.fields.wineCountry' },
    { key: 'format', labelKey: 'candidates.fields.wineFormat' },
  ],
  coin: [
    { key: 'country', labelKey: 'candidates.fields.coinCountry', primary: true },
    { key: 'type', labelKey: 'candidates.fields.coinType', primary: true },
    { key: 'year', labelKey: 'candidates.fields.coinYear', primary: true, ...YEAR, min: -800 },
    { key: 'mintMark', labelKey: 'candidates.fields.coinMintMark' },
    { key: 'metal', labelKey: 'candidates.fields.coinMetal' },
    { key: 'issuer', labelKey: 'candidates.fields.coinIssuer' },
  ],
  art: [
    { key: 'artist', labelKey: 'candidates.fields.artArtist', primary: true },
    { key: 'title', labelKey: 'candidates.fields.artTitle', primary: true },
    { key: 'technique', labelKey: 'candidates.fields.artTechnique', primary: true },
    { key: 'support', labelKey: 'candidates.fields.artSupport' },
    { key: 'estimatedPeriod', labelKey: 'candidates.fields.artPeriod' },
    { key: 'school', labelKey: 'candidates.fields.artSchool' },
  ],
  stamp: [
    { key: 'country', labelKey: 'candidates.fields.stampCountry', primary: true },
    { key: 'catalogNumber', labelKey: 'candidates.fields.stampCatalog', primary: true },
    { key: 'year', labelKey: 'candidates.fields.stampYear', primary: true, ...YEAR, min: 1840 },
    { key: 'title', labelKey: 'candidates.fields.stampTitle' },
    { key: 'faceValue', labelKey: 'candidates.fields.stampFaceValue' },
    { key: 'color', labelKey: 'candidates.fields.stampColor' },
    { key: 'perforation', labelKey: 'candidates.fields.stampPerforation' },
  ],
  watch: [
    { key: 'brand', labelKey: 'candidates.fields.watchBrand', primary: true },
    { key: 'model', labelKey: 'candidates.fields.watchModel', primary: true },
    { key: 'reference', labelKey: 'candidates.fields.watchReference', primary: true },
    { key: 'year', labelKey: 'candidates.fields.watchYear', primary: true, ...YEAR, min: 1700 },
    { key: 'caseMaterial', labelKey: 'candidates.fields.watchCaseMaterial' },
    { key: 'dialColor', labelKey: 'candidates.fields.watchDialColor' },
    { key: 'caseDiameterMm', labelKey: 'candidates.fields.watchDiameter', numeric: true, min: 5, max: 80 },
  ],
};

/** Champs d'un domaine (tous, ou seulement les principaux). */
export function identityFieldsFor(domain: VelumDomain, primaryOnly = false): IdentityField[] {
  const fields = IDENTITY_FIELDS[domain];
  return primaryOnly ? fields.filter((f) => f.primary === true) : [...fields];
}

// ── Attributs d'identité (liste d'INCLUSION) ─────────────────────────────────

/*
 * Attributs d'identité STRUCTURÉS documentés par domaine dans @velum/core
 * (analysis/*.ts, interfaces `…Attributes`). Le type `Record<keyof …, true>`
 * impose l'exhaustivité : un attribut ajouté au contrat doit l'être ici.
 */
const WINE_IDENTITY: Record<keyof WineAttributes, true> = {
  producer: true,
  winemaker: true,
  winemakerRenown: true,
  appellation: true,
  cuvee: true,
  vintage: true,
  color: true,
  grapes: true,
  distinctiveness: true,
  farming: true,
  region: true,
  country: true,
  format: true,
};
const COIN_IDENTITY: Record<keyof CoinAttributes, true> = {
  country: true,
  issuer: true,
  type: true,
  year: true,
  mintMark: true,
  metal: true,
  weightGrams: true,
  diameterMm: true,
  mintage: true,
  numistaId: true,
};
const ART_IDENTITY: Record<keyof ArtAttributes, true> = {
  artist: true,
  attributionQualifier: true,
  title: true,
  technique: true,
  support: true,
  dimensionsCm: true,
  estimatedPeriod: true,
  school: true,
  signatureDetected: true,
};
const STAMP_IDENTITY: Record<keyof StampAttributes, true> = {
  country: true,
  catalogNumber: true,
  catalog: true,
  title: true,
  year: true,
  faceValue: true,
  color: true,
  perforation: true,
  watermark: true,
  printingMethod: true,
};
const WATCH_IDENTITY: Record<keyof WatchAttributes, true> = {
  brand: true,
  model: true,
  reference: true,
  year: true,
  gender: true,
  caseMaterial: true,
  caseDiameterMm: true,
  dialColor: true,
  bracelet: true,
  crystal: true,
  waterResistanceM: true,
  boxPapers: true,
  limitedEdition: true,
};

const STRUCTURED_IDENTITY: Record<VelumDomain, Record<string, true>> = {
  wine: WINE_IDENTITY,
  coin: COIN_IDENTITY,
  art: ART_IDENTITY,
  stamp: STAMP_IDENTITY,
  watch: WATCH_IDENTITY,
};

/**
 * Clés d'attributs qui décrivent l'IDENTITÉ d'un objet du domaine : champs
 * d'identification éditables + attributs structurés du contrat. Liste
 * d'INCLUSION : tout le reste (quantité, « bouteille bue », prix payé ou
 * emplacement d'un import CSV, fiche, historique…) décrit l'exemplaire
 * possédé ou l'analyse, jamais l'objet recherché.
 */
export function identityAttributeKeys(domain: VelumDomain): string[] {
  const keys = new Set(IDENTITY_FIELDS[domain].map((field) => field.key));
  for (const key of Object.keys(STRUCTURED_IDENTITY[domain])) keys.add(key);
  return [...keys];
}

/** Valeurs texte des champs (pour pré-remplir un formulaire). */
export function identityValuesFrom(
  attributes: Record<string, unknown>,
  domain: VelumDomain,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of IDENTITY_FIELDS[domain]) {
    const raw = attributes[field.key];
    values[field.key] =
      typeof raw === 'string' ? raw : typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : '';
  }
  return values;
}

/** Parse un nombre saisi à la française (« 38,5 ») ; null si invalide. */
export function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized.length === 0) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// ── Acquisition (validée AVANT tout envoi) ───────────────────────────────────

/** Plafond de `items.acquired_price numeric(12, 2)`. */
export const ACQUIRED_PRICE_MAX = 9_999_999_999.99;

/** ISO AAAA-MM-JJ si la date existe (31/02 refusé), sinon null. */
function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC interprète 0–99 comme 1900–1999 : on repose l'année exacte.
  date.setUTCFullYear(year);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Date d'acquisition saisie → ISO AAAA-MM-JJ (colonne `date`). Accepte
 * AAAA-MM-JJ et la saisie à la française JJ/MM/AAAA (ou JJ.MM.AAAA,
 * JJ-MM-AAAA) ; vide → null ; illisible ou inexistante (31/02) → erreur.
 * Jamais envoyée telle quelle : Postgres (DateStyle MDY) lirait « 01/06/2020 »
 * comme le 6 janvier, et refuserait « 15/03/2019 ».
 */
export function parseAcquiredDate(raw: string): { ok: true; value: string | null } | { ok: false } {
  const text = raw.trim();
  if (text.length === 0) return { ok: true, value: null };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const french = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const value = iso
    ? isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    : french
      ? isoDate(Number(french[3]), Number(french[2]), Number(french[1]))
      : null;
  return value === null ? { ok: false } : { ok: true, value };
}

/**
 * Prix d'acquisition saisi (« 1 200,50 ») → montant ≥ 0 au centime ; vide →
 * null. Illisible, négatif ou au-delà de `numeric(12, 2)` → clé i18n d'erreur.
 */
export function parseAcquiredPrice(
  raw: string,
): { ok: true; value: number | null } | { ok: false; errorKey: string } {
  if (raw.trim().length === 0) return { ok: true, value: null };
  const value = parseNumericInput(raw);
  if (value === null) return { ok: false, errorKey: 'identity.errors.notANumber' };
  const cents = Math.round(value * 100) / 100;
  if (cents < 0 || cents > ACQUIRED_PRICE_MAX) return { ok: false, errorKey: 'identity.errors.outOfRange' };
  return { ok: true, value: cents };
}

/** Erreurs de validation par clé de champ (clés i18n). Vide = valide. */
export function validateIdentityValues(
  values: Record<string, string>,
  domain: VelumDomain,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of IDENTITY_FIELDS[domain]) {
    const raw = (values[field.key] ?? '').trim();
    if (!field.numeric || raw.length === 0) continue;
    const value = parseNumericInput(raw);
    if (value === null) {
      errors[field.key] = 'identity.errors.notANumber';
    } else if (
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      errors[field.key] = 'identity.errors.outOfRange';
    }
  }
  return errors;
}

/** Une correction tracée (valeur lue par l'IA → valeur saisie). */
export interface IdentityCorrection {
  field: string;
  from: string | number | null;
  to: string | number | null;
  at: string;
}

/** Nombre maximal de corrections conservées dans l'historique d'un objet. */
export const MAX_CORRECTIONS_KEPT = 30;

/**
 * Clé RÉSERVÉE sous laquelle est tracée la correction de la DÉSIGNATION de
 * l'objet (`items.title`). Distincte de toute clé d'attribut : l'art (titre de
 * l'œuvre) et le timbre (sujet) ont un champ d'identité nommé `title`, qui ne
 * doit pas passer pour un simple renommage.
 */
export const DESIGNATION_FIELD = '@title';

/**
 * true si l'entrée d'historique porte sur la désignation. Les historiques
 * d'avant la clé réservée tracent la désignation sous `title` : relus comme
 * tels seulement pour un domaine SANS champ d'identité `title` (vin, pièce,
 * montre) — ailleurs, l'entrée est relue comme le champ du domaine.
 */
export function isDesignationCorrection(domain: VelumDomain, field: string): boolean {
  if (field === DESIGNATION_FIELD) return true;
  return field === 'title' && !IDENTITY_FIELDS[domain].some((f) => f.key === 'title');
}

export interface CorrectionResult {
  attributes: Record<string, unknown>;
  title: string | null;
  corrections: IdentityCorrection[];
}

function scalar(value: unknown): string | number | null {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    ? value
    : null;
}

/**
 * Applique les valeurs saisies aux attributs : champ vidé → clé supprimée,
 * nombres parsés, tout changement tracé dans `attributes.corrections`.
 * La désignation est corrigée si elle diffère (`newTitle` vide → inchangée),
 * tracée sous `designationField` : DESIGNATION_FIELD pour la fiche objet et
 * la capture ; `title` par défaut (compatibilité des historiques existants).
 * Pré-condition : `validateIdentityValues` sans erreur.
 */
export function applyIdentityCorrections(input: {
  domain: VelumDomain;
  attributes: Record<string, unknown>;
  title: string | null;
  values: Record<string, string>;
  newTitle?: string;
  now: Date;
  designationField?: string;
}): CorrectionResult {
  const at = input.now.toISOString();
  const attributes: Record<string, unknown> = { ...input.attributes };
  const corrections: IdentityCorrection[] = [];

  for (const field of IDENTITY_FIELDS[input.domain]) {
    const raw = (input.values[field.key] ?? '').trim();
    const next: string | number | null =
      raw.length === 0 ? null : field.numeric ? parseNumericInput(raw) : raw;
    const previous = scalar(attributes[field.key]);
    if (next === previous) continue;
    if (next === null) delete attributes[field.key];
    else attributes[field.key] = next;
    corrections.push({ field: field.key, from: previous, to: next, at });
  }

  let title = input.title;
  const trimmedTitle = input.newTitle?.trim() ?? '';
  if (trimmedTitle.length > 0 && trimmedTitle !== (input.title ?? '')) {
    corrections.push({ field: input.designationField ?? 'title', from: input.title, to: trimmedTitle, at });
    title = trimmedTitle;
  }

  if (corrections.length > 0) {
    const history = Array.isArray(input.attributes['corrections'])
      ? (input.attributes['corrections'] as unknown[])
      : [];
    attributes['corrections'] = [...history, ...corrections].slice(-MAX_CORRECTIONS_KEPT);
  }
  return { attributes, title, corrections };
}

/** Libellé par défaut composé des champs principaux renseignés. */
export function labelFromValues(domain: VelumDomain, values: Record<string, string>): string {
  return IDENTITY_FIELDS[domain]
    .filter((f) => f.primary === true)
    .map((f) => (values[f.key] ?? '').trim())
    .filter((v) => v.length > 0)
    .join(' ');
}
