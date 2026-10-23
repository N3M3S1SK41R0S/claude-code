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
import type { VelumDomain } from '@velum/core';

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
 * Le titre est corrigé s'il diffère (`title` vide → inchangé).
 * Pré-condition : `validateIdentityValues` sans erreur.
 */
export function applyIdentityCorrections(input: {
  domain: VelumDomain;
  attributes: Record<string, unknown>;
  title: string | null;
  values: Record<string, string>;
  newTitle?: string;
  now: Date;
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
    corrections.push({ field: 'title', from: input.title, to: trimmedTitle, at });
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
