/**
 * Logique PURE de la fiche objet (sans React Native, testable sous Vitest) :
 *  - vue des champs d'identification renseignés et historique des corrections ;
 *  - correction EN TEXTE des infos mal lues sur la photo (au-dessus de
 *    `applyIdentityCorrections` : une valeur seulement re-typée n'est pas une
 *    correction, et la fourchette indicative de l'objet mal lu est retirée) ;
 *  - fusion de la fiche complète générée à la demande dans `attributes` ;
 *  - fourchette indicative du scan éclair, péremption de l'estimation ;
 *  - alerte de prix (sens + seuil) et comportement des sections repliables.
 *
 * Conventions `items.attributes` : voir analysisState.ts (source unique).
 */
import type { AlertRecord, AnalysisResult, ValuationRecord, VelumDomain, VelumItem } from '@velum/core';

import { analysisStatusOf, isAnalysisOutdated } from './analysisState';
import {
  DESIGNATION_FIELD,
  IDENTITY_FIELDS,
  MAX_CORRECTIONS_KEPT,
  applyIdentityCorrections,
  identityValuesFrom,
  isDesignationCorrection,
  labelFromValues,
  parseNumericInput,
  validateIdentityValues,
  type IdentityCorrection,
} from './identityFields';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

function timeOf(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Clé i18n du libellé du titre (désignation) dans l'historique et le formulaire. */
export const TITLE_FIELD_LABEL_KEY = 'item.identity.titleField';

/** Clé i18n de l'erreur « désignation obligatoire ». */
export const TITLE_REQUIRED_ERROR_KEY = 'identity.errors.titleRequired';

/** Sous ce seuil de confiance (sans correction), on invite à vérifier l'identification. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

// ── Affichage des valeurs ────────────────────────────────────────────────────

/**
 * Valeur d'identité lisible : texte tel quel, nombre selon la locale SANS
 * séparateur de milliers (une année reste « 1849 », un diamètre « 38,5 »).
 */
export function formatIdentityValue(value: string | number, locale = 'fr'): string {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    useGrouping: false,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Clé i18n du libellé d'un champ corrigé (null : champ inconnu du domaine).
 * La désignation (clé réservée, ou ancienne clé `title` d'un domaine sans
 * champ homonyme) n'est jamais confondue avec le titre d'une œuvre ou le
 * sujet d'un timbre.
 */
export function correctionFieldLabelKey(domain: VelumDomain, field: string): string | null {
  if (isDesignationCorrection(domain, field)) return TITLE_FIELD_LABEL_KEY;
  return IDENTITY_FIELDS[domain].find((f) => f.key === field)?.labelKey ?? null;
}

// ── Historique des corrections ───────────────────────────────────────────────

/** Correction relue depuis `attributes.corrections` (JSONB défensif). */
export interface CorrectionEntry {
  field: string;
  /** Clé i18n du libellé, null si le champ n'appartient plus au domaine. */
  labelKey: string | null;
  /** Valeur lue avant correction (null : champ vide). */
  from: string | null;
  /** Valeur saisie (null : champ vidé). */
  to: string | null;
  /** Horodatage ISO de la correction. */
  at: string;
}

function parseCorrections(attributes: Record<string, unknown>): IdentityCorrection[] {
  const raw = attributes['corrections'];
  if (!Array.isArray(raw)) return [];
  const out: IdentityCorrection[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const field = entry['field'];
    const at = entry['at'];
    if (typeof field !== 'string' || field.length === 0) continue;
    if (typeof at !== 'string' || timeOf(at) === null) continue;
    const from = entry['from'];
    const to = entry['to'];
    out.push({ field, at, from: isScalar(from) ? from : null, to: isScalar(to) ? to : null });
  }
  return out;
}

/** Historique des corrections, la plus récente d'abord (entrées invalides ignorées). */
export function correctionHistory(
  attributes: Record<string, unknown>,
  domain: VelumDomain,
  locale = 'fr',
): CorrectionEntry[] {
  return parseCorrections(attributes)
    .map((c, index) => ({ c, index }))
    .sort((a, b) => {
      const diff = (timeOf(b.c.at) ?? 0) - (timeOf(a.c.at) ?? 0);
      // À horodatage égal (même enregistrement), ordre de saisie inversé.
      return diff !== 0 ? diff : b.index - a.index;
    })
    .map(({ c }) => ({
      field: c.field,
      labelKey: correctionFieldLabelKey(domain, c.field),
      from: c.from === null ? null : formatIdentityValue(c.from, locale),
      to: c.to === null ? null : formatIdentityValue(c.to, locale),
      at: c.at,
    }));
}

/** true si l'utilisateur a corrigé au moins une information de l'objet. */
export function hasCorrections(attributes: Record<string, unknown>): boolean {
  return parseCorrections(attributes).length > 0;
}

/** Horodatage ISO de la DERNIÈRE correction (null : jamais corrigé). */
export function lastCorrectionAt(attributes: Record<string, unknown>): string | null {
  let latest: { at: string; ms: number } | null = null;
  for (const c of parseCorrections(attributes)) {
    const ms = timeOf(c.at);
    if (ms !== null && (latest === null || ms > latest.ms)) latest = { at: c.at, ms };
  }
  return latest?.at ?? null;
}

// ── Vue « Identification » ───────────────────────────────────────────────────

export interface IdentityRow {
  key: string;
  labelKey: string;
  value: string;
  /** Champ corrigé par l'utilisateur (au moins une fois). */
  corrected: boolean;
}

/** Champs d'identité RENSEIGNÉS de l'objet, dans l'ordre du domaine. */
export function identityRows(
  item: Pick<VelumItem, 'domain' | 'attributes'>,
  locale = 'fr',
): IdentityRow[] {
  const correctedFields = new Set(parseCorrections(item.attributes).map((c) => c.field));
  const rows: IdentityRow[] = [];
  for (const field of IDENTITY_FIELDS[item.domain]) {
    const raw = item.attributes[field.key];
    if (!isScalar(raw)) continue;
    const value = formatIdentityValue(raw, locale).trim();
    if (value.length === 0) continue;
    rows.push({ key: field.key, labelKey: field.labelKey, value, corrected: correctedFields.has(field.key) });
  }
  return rows;
}

/** Classement du scan éclair (du général au précis), null si absent. */
export function classificationOf(attributes: Record<string, unknown>): string[] | null {
  const raw = attributes['classification'];
  if (!Array.isArray(raw)) return null;
  const levels = raw
    .filter((level): level is string => typeof level === 'string')
    .map((level) => level.trim())
    .filter((level) => level.length > 0);
  return levels.length > 0 ? levels : null;
}

/** Inviter à vérifier : identification peu sûre et jamais corrigée. */
export function shouldSuggestCorrection(item: Pick<VelumItem, 'confidence' | 'attributes'>): boolean {
  return (
    item.confidence !== null &&
    item.confidence < LOW_CONFIDENCE_THRESHOLD &&
    !hasCorrections(item.attributes)
  );
}

// ── Formulaire de correction ─────────────────────────────────────────────────

/**
 * Valeurs initiales du formulaire : désignation + TOUS les champs du domaine.
 * Sans désignation enregistrée, on propose celle composée des champs
 * principaux lus (l'utilisateur la valide ou la modifie).
 */
export function identityFormInitialValues(item: Pick<VelumItem, 'domain' | 'attributes' | 'title'>): {
  title: string;
  values: Record<string, string>;
} {
  const values = identityValuesFrom(item.attributes, item.domain);
  const title = item.title !== null && item.title.trim().length > 0 ? item.title : labelFromValues(item.domain, values);
  return { title, values };
}

/**
 * Erreurs du formulaire (clés i18n). La désignation est séparée des champs :
 * certains domaines ont un champ d'identité nommé `title` (sujet d'un timbre,
 * titre d'une œuvre) qui ne doit pas hériter de l'erreur de désignation.
 */
export interface IdentityFormErrors {
  /** Erreur de la désignation (obligatoire), null si valide. */
  title: string | null;
  /** Erreurs par clé de champ d'identité. */
  fields: Record<string, string>;
}

export function validateIdentityForm(
  domain: VelumDomain,
  title: string,
  values: Record<string, string>,
): IdentityFormErrors {
  return {
    title: title.trim().length === 0 ? TITLE_REQUIRED_ERROR_KEY : null,
    fields: validateIdentityValues(values, domain),
  };
}

/** true si le formulaire contient au moins une erreur. */
export function hasFormErrors(errors: IdentityFormErrors): boolean {
  return errors.title !== null || Object.keys(errors.fields).length > 0;
}

export interface IdentityCorrectionOutcome {
  /** false : rien à enregistrer (aucune valeur réellement modifiée). */
  changed: boolean;
  /**
   * true si un champ d'identité (pas seulement la désignation) a changé : la
   * fourchette et le classement du scan éclair sont alors retirés.
   */
  identityChanged: boolean;
  title: string | null;
  attributes: Record<string, unknown>;
  /** Corrections RÉELLES ajoutées à l'historique par cet enregistrement. */
  corrections: IdentityCorrection[];
}

/**
 * Correction après coup, en texte, des infos lues sur la photo.
 *  - Une valeur seulement re-typée (1849 lu en nombre, « 1849 » ressaisi)
 *    n'est pas une correction : la valeur lue est conservée, rien n'est tracé.
 *  - Chaque correction réelle est tracée dans `attributes.corrections`
 *    (historique borné à MAX_CORRECTIONS_KEPT).
 *  - La désignation est tracée sous une clé réservée (DESIGNATION_FIELD) :
 *    corriger le titre d'une œuvre ou le sujet d'un timbre (champ `title`
 *    du domaine) est bien un changement d'identité.
 *  - Si l'identité change, la fourchette indicative ET le classement du scan
 *    éclair — avis du modèle sur l'objet MAL lu — sont retirés (jamais de
 *    fausse certitude).
 * Pré-condition : `validateIdentityForm` sans erreur.
 */
export function correctItemIdentity(input: {
  item: Pick<VelumItem, 'domain' | 'attributes' | 'title'>;
  values: Record<string, string>;
  title: string;
  now: Date;
}): IdentityCorrectionOutcome {
  const { item } = input;
  const original = item.attributes;
  // Un formulaire partiel ne doit pas effacer les champs qu'il n'affiche pas.
  const values = { ...identityValuesFrom(original, item.domain), ...input.values };
  const result = applyIdentityCorrections({
    domain: item.domain,
    attributes: original,
    title: item.title,
    values,
    newTitle: input.title,
    now: input.now,
    designationField: DESIGNATION_FIELD,
  });
  const real = result.corrections.filter(
    (c) => c.field === DESIGNATION_FIELD || String(c.from ?? '') !== String(c.to ?? ''),
  );
  if (real.length === 0) {
    return { changed: false, identityChanged: false, title: item.title, attributes: original, corrections: [] };
  }

  const attributes: Record<string, unknown> = { ...result.attributes };
  for (const correction of result.corrections) {
    if (!real.includes(correction)) attributes[correction.field] = original[correction.field];
  }
  const history = Array.isArray(original['corrections']) ? (original['corrections'] as unknown[]) : [];
  attributes['corrections'] = [...history, ...real].slice(-MAX_CORRECTIONS_KEPT);

  const identityChanged = real.some((c) => c.field !== DESIGNATION_FIELD);
  if (identityChanged) {
    delete attributes['quickEstimate'];
    delete attributes['classification'];
  }

  return { changed: true, identityChanged, title: result.title, attributes, corrections: real };
}

// ── Fiche complète à la demande ──────────────────────────────────────────────

/**
 * État affiché pour la fiche complète :
 *  - 'missing'  : jamais chargée (scan éclair) → carte « Charger » ;
 *  - 'failed'   : génération précédente en échec → carte « Réessayer » ;
 *  - 'outdated' : identité corrigée APRÈS la génération → « Régénérer » ;
 *  - 'complete' : fiche à jour.
 */
export type FullSheetState = 'complete' | 'outdated' | 'missing' | 'failed';

export function fullSheetState(item: Pick<VelumItem, 'attributes'>): FullSheetState {
  const status = analysisStatusOf(item);
  if (status === 'complete') return isAnalysisOutdated(item) ? 'outdated' : 'complete';
  return status === 'failed' ? 'failed' : 'missing';
}

/**
 * Fusionne une fiche complète fraîchement générée dans les attributs :
 * payload, moteur, avertissements, `analyzedAt`, et retire le marqueur
 * `analysisStatus` (fiche désormais présente). `analyzedAt` = instant où la
 * génération a été DEMANDÉE : une correction faite pendant la génération
 * (la fiche décrit alors l'ancienne identité) la rend bien « périmée ».
 * Retourne null si le payload n'est pas un objet (fiche inexploitable).
 */
export function mergeAnalysisAttributes(
  attributes: Record<string, unknown>,
  analysis: Pick<AnalysisResult, 'payload' | 'engine' | 'disclaimers'>,
  analyzedAt: Date,
): Record<string, unknown> | null {
  if (!isRecord(analysis.payload)) return null;
  const rest: Record<string, unknown> = { ...attributes };
  delete rest['analysisStatus'];
  const disclaimers = Array.isArray(analysis.disclaimers)
    ? analysis.disclaimers.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : [];
  return {
    ...rest,
    analysis: analysis.payload,
    analysisEngine: typeof analysis.engine === 'string' ? analysis.engine : null,
    disclaimers,
    analyzedAt: analyzedAt.toISOString(),
  };
}

/** Moteur et date de génération de la fiche complète (si connus). */
export function analysisMeta(attributes: Record<string, unknown>): {
  engine: string | null;
  analyzedAt: string | null;
} {
  const engine = attributes['analysisEngine'];
  const analyzedAt = attributes['analyzedAt'];
  return {
    engine: typeof engine === 'string' && engine.length > 0 ? engine : null,
    analyzedAt: typeof analyzedAt === 'string' && timeOf(analyzedAt) !== null ? analyzedAt : null,
  };
}

/** Avertissements de la fiche (chaînes non vides seulement). */
export function itemDisclaimers(attributes: Record<string, unknown>): string[] {
  const raw = attributes['disclaimers'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is string => typeof d === 'string' && d.trim().length > 0);
}

/** Payload de la fiche complète (null : non chargée). */
export function analysisPayloadOf(attributes: Record<string, unknown>): Record<string, unknown> | null {
  const payload = attributes['analysis'];
  return isRecord(payload) ? payload : null;
}

/** Résultat d'analyse reconstruit depuis l'objet (export PDF), null sans fiche. */
export function analysisResultFromItem(item: Pick<VelumItem, 'attributes' | 'confidence'>): AnalysisResult | null {
  const payload = analysisPayloadOf(item.attributes);
  if (payload === null) return null;
  return {
    engine: analysisMeta(item.attributes).engine ?? '—',
    payload,
    confidence: item.confidence ?? 0,
    sources: [],
    disclaimers: itemDisclaimers(item.attributes),
  };
}

// ── Estimation ───────────────────────────────────────────────────────────────

/** Fourchette INDICATIVE du scan éclair (EUR) — jamais une cote vérifiée. */
export interface QuickEstimateRange {
  low: number;
  high: number;
}

/** Fourchette du scan éclair relue défensivement (null si absente ou incohérente). */
export function quickEstimateOf(attributes: Record<string, unknown>): QuickEstimateRange | null {
  const raw = attributes['quickEstimate'];
  if (!isRecord(raw)) return null;
  const { low, high, currency } = raw;
  if (currency !== undefined && currency !== 'EUR') return null;
  if (typeof low !== 'number' || typeof high !== 'number') return null;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (low < 0 || high <= 0 || low > high) return null;
  return { low, high };
}

/**
 * true si l'estimation affichée est ANTÉRIEURE à la dernière correction :
 * elle porte sur l'identité mal lue → proposer de la relancer.
 */
export function isValuationOutdated(
  item: Pick<VelumItem, 'attributes'>,
  valuation: Pick<ValuationRecord, 'valuedAt'> | null,
): boolean {
  if (valuation === null) return false;
  const corrected = lastCorrectionAt(item.attributes);
  if (corrected === null) return false;
  const valuedMs = timeOf(valuation.valuedAt);
  const correctedMs = timeOf(corrected);
  if (valuedMs === null || correctedMs === null) return false;
  return correctedMs > valuedMs;
}

/**
 * Estimation à RELANCER : antérieure à la dernière correction, sauf si une
 * relance a réussi depuis (`revaluedAtMs`, horloge locale — tolère un écart
 * entre l'horloge du serveur, qui date l'estimation, et celle de l'appareil).
 */
export function isValuationStale(
  item: Pick<VelumItem, 'attributes'>,
  valuation: Pick<ValuationRecord, 'valuedAt'> | null,
  revaluedAtMs: number | null,
): boolean {
  const corrected = lastCorrectionAt(item.attributes);
  if (corrected === null) return false;
  const correctedMs = timeOf(corrected);
  if (revaluedAtMs !== null && correctedMs !== null && revaluedAtMs >= correctedMs) return false;
  return isValuationOutdated(item, valuation);
}

// ── Alerte de prix ───────────────────────────────────────────────────────────

/** Sens de l'alerte — schéma lu par price-cron : { direction, threshold }. */
export type AlertDirection = 'above' | 'below';

export const ALERT_DIRECTIONS: readonly AlertDirection[] = ['above', 'below'];

/** Seuil saisi (« 1 200,50 » accepté), arrondi au centime ; null si absent, invalide ou ≤ 0. */
export function parseAlertThreshold(raw: string): number | null {
  const value = parseNumericInput(raw);
  if (value === null) return null;
  const cents = Math.round(value * 100) / 100;
  return cents > 0 ? cents : null;
}

/**
 * Seuil affiché tel que saisi : centimes montrés seulement s'il y en a
 * (« 1 200,50 € », « 300 € ») — jamais arrondi à l'euro à l'insu de l'utilisateur.
 */
export function formatThreshold(value: number, locale = 'fr'): string {
  const fractional = !Number.isInteger(value);
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: fractional ? 2 : 0,
  }).format(value);
}

export interface PriceAlertConfig {
  direction: AlertDirection;
  threshold: number;
}

/** Configuration d'alerte `price_threshold` attendue par price-cron. */
export function priceAlertConfig(direction: AlertDirection, threshold: number): PriceAlertConfig {
  return { direction, threshold };
}

/**
 * Alerte de prix ACTIVE relue défensivement (config JSONB) ; null si ce n'est
 * pas une alerte de seuil exploitable par price-cron.
 */
export function priceAlertOf(
  alert: Pick<AlertRecord, 'type' | 'config' | 'active'>,
): PriceAlertConfig | null {
  if (alert.type !== 'price_threshold' || !alert.active) return null;
  const direction = alert.config['direction'];
  const threshold = alert.config['threshold'];
  if (direction !== 'above' && direction !== 'below') return null;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) return null;
  return { direction, threshold };
}

// ── Sections repliables ──────────────────────────────────────────────────────

export interface SectionBehavior {
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/**
 * Comportement effectif d'une section : les props explicites l'emportent sur
 * les valeurs par défaut du groupe (ex. fiche complète repliée par défaut).
 * Une section non repliable est toujours ouverte.
 */
export function resolveSectionBehavior(
  props: SectionBehavior,
  defaults: SectionBehavior,
): { collapsible: boolean; initiallyOpen: boolean } {
  const collapsible = props.collapsible ?? defaults.collapsible ?? false;
  if (!collapsible) return { collapsible: false, initiallyOpen: true };
  return { collapsible: true, initiallyOpen: props.defaultOpen ?? defaults.defaultOpen ?? true };
}
