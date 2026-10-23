import type { CellarWineEntry } from '@velum/core';
import { peakStatus } from '@velum/domain-wine';
import {
  validateJsonObject,
  type ValidationResult,
} from '../_shared/input.ts';

export interface PairingBody {
  dish: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Valide le corps public avant quota, lecture de cave et appel IA. */
export function validatePairingBody(value: unknown): ValidationResult<PairingBody> {
  const bodyResult = validateJsonObject(value);
  if (!bodyResult.ok) return bodyResult;

  const dish = nonEmptyString(bodyResult.value['dish']);
  if (!dish || dish.length > 500) {
    return {
      ok: false,
      message: "Champ 'dish' requis (description du plat, ≤ 500 caractères)",
    };
  }
  return { ok: true, value: { dish } };
}

function drinkWindowFrom(attributes: Record<string, unknown>): { from: number; to: number } | undefined {
  const analysis = attributes['analysis'];
  if (!isRecord(analysis)) return undefined;
  const tasting = analysis['tasting'];
  if (!isRecord(tasting)) return undefined;
  const window = tasting['drinkWindow'];
  if (!isRecord(window)) return undefined;
  const from = finiteNumber(window['from']);
  const to = finiteNumber(window['to']);
  return from !== undefined && to !== undefined && from <= to ? { from, to } : undefined;
}

/** Bloc `analysis.identification` de la fiche ZAPPA, s'il est exploitable. */
function identificationFrom(attributes: Record<string, unknown>): Record<string, unknown> {
  const analysis = attributes['analysis'];
  if (!isRecord(analysis)) return {};
  const identification = analysis['identification'];
  return isRecord(identification) ? identification : {};
}

/** Cépages : chaînes ou objets `{ name }` (format ZAPPA), dédupliqués. */
function grapesFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names: string[] = [];
  for (const raw of value) {
    const name = nonEmptyString(isRecord(raw) ? raw['name'] : raw);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length > 0 ? names.slice(0, 8) : undefined;
}

function foodPairingsFrom(attributes: Record<string, unknown>): string[] | undefined {
  const analysis = attributes['analysis'];
  if (!isRecord(analysis)) return undefined;
  const comparisons = analysis['comparisons'];
  if (!isRecord(comparisons) || !Array.isArray(comparisons['foodPairings'])) return undefined;
  const pairings = comparisons['foodPairings']
    .map(nonEmptyString)
    .filter((pairing): pairing is string => pairing !== undefined);
  return pairings.length > 0 ? pairings : undefined;
}

export interface ParseCellarOptions {
  /**
   * Année de référence : si fournie, chaque vin porte son `peakStatus`
   * (calculé ici, jamais par le modèle). Injectée pour des tests déterministes.
   */
  year?: number;
}

/**
 * Convertit les lignes JSONB/PostgREST en inventaire minimal transmis au modèle.
 * Les champs optionnels malformés sont omis ; une ligne sans identifiant bloque
 * le traitement, car l'anti-hallucination repose sur cet identifiant. Les
 * attributs directs priment ; à défaut, l'identification ZAPPA est relue.
 */
export function parseCellarRows(rows: unknown, options: ParseCellarOptions = {}): CellarWineEntry[] {
  if (!Array.isArray(rows)) {
    throw new TypeError('Résultat items invalide : tableau attendu');
  }

  return rows.map((rawRow, index) => {
    if (!isRecord(rawRow)) {
      throw new TypeError(`Ligne items ${index} invalide : objet attendu`);
    }
    const itemId = nonEmptyString(rawRow['id']);
    if (!itemId) {
      throw new TypeError(`Ligne items ${index} invalide : id non vide attendu`);
    }

    const attributes = isRecord(rawRow['attributes']) ? rawRow['attributes'] : {};
    const identification = identificationFrom(attributes);
    const title = nonEmptyString(rawRow['title']);
    const producer = nonEmptyString(attributes['producer']);
    const cuvee = nonEmptyString(attributes['cuvee']);
    const vintage = finiteNumber(attributes['vintage']) ?? finiteNumber(identification['vintage']);
    const composedLabel = [producer, cuvee, vintage === undefined ? undefined : String(vintage)]
      .filter((part): part is string => part !== undefined)
      .join(' ');
    const label = title ?? (composedLabel.length > 0 ? composedLabel : 'Vin sans étiquette');

    const region = nonEmptyString(attributes['region']) ?? nonEmptyString(identification['region']);
    const color = nonEmptyString(attributes['color']) ?? nonEmptyString(identification['color']);
    const appellation =
      nonEmptyString(attributes['appellation']) ?? nonEmptyString(identification['appellation']);
    const grapes = grapesFrom(attributes['grapes']) ?? grapesFrom(identification['grapes']);
    const storageLocation = nonEmptyString(rawRow['storage_location']);
    const quantity = finiteNumber(attributes['quantity']);
    const drinkWindow = drinkWindowFrom(attributes);
    const foodPairings = foodPairingsFrom(attributes);
    const year = options.year;

    return {
      itemId,
      label,
      ...(vintage !== undefined ? { vintage } : {}),
      ...(region ? { region } : {}),
      ...(appellation ? { appellation } : {}),
      ...(color ? { color } : {}),
      ...(grapes ? { grapes } : {}),
      ...(storageLocation ? { storageLocation } : {}),
      ...(drinkWindow ? { drinkWindow } : {}),
      ...(year !== undefined && Number.isFinite(year) ? { peakStatus: peakStatus(drinkWindow, year) } : {}),
      ...(foodPairings ? { foodPairings } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
    };
  });
}
