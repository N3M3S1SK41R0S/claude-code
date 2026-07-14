import type { CellarWineEntry } from '@velum/core';
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

/**
 * Convertit les lignes JSONB/PostgREST en inventaire minimal transmis au modèle.
 * Les champs optionnels malformés sont omis ; une ligne sans identifiant bloque
 * le traitement, car l'anti-hallucination repose sur cet identifiant.
 */
export function parseCellarRows(rows: unknown): CellarWineEntry[] {
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
    const title = nonEmptyString(rawRow['title']);
    const producer = nonEmptyString(attributes['producer']);
    const cuvee = nonEmptyString(attributes['cuvee']);
    const vintage = finiteNumber(attributes['vintage']);
    const composedLabel = [producer, cuvee, vintage === undefined ? undefined : String(vintage)]
      .filter((part): part is string => part !== undefined)
      .join(' ');
    const label = title ?? (composedLabel.length > 0 ? composedLabel : 'Vin sans étiquette');

    const region = nonEmptyString(attributes['region']);
    const color = nonEmptyString(attributes['color']);
    const storageLocation = nonEmptyString(rawRow['storage_location']);
    const quantity = finiteNumber(attributes['quantity']);
    const drinkWindow = drinkWindowFrom(attributes);
    const foodPairings = foodPairingsFrom(attributes);

    return {
      itemId,
      label,
      ...(vintage !== undefined ? { vintage } : {}),
      ...(region ? { region } : {}),
      ...(color ? { color } : {}),
      ...(storageLocation ? { storageLocation } : {}),
      ...(drinkWindow ? { drinkWindow } : {}),
      ...(foodPairings ? { foodPairings } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
    };
  });
}
