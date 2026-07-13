/**
 * Normalisation des numéros de catalogue philatéliques : Yvert & Tellier,
 * Michel, Stanley Gibbons, Scott. Une référence saisie librement ("yt 1234",
 * "YT1234", "Scott C3a", "Mi. 99") est ramenée à une forme canonique.
 */

export type StampCatalog = 'yvert_tellier' | 'michel' | 'stanley_gibbons' | 'scott';

export interface NormalizedCatalogNumber {
  catalog: StampCatalog;
  /** Forme canonique préfixée (ex. "YT 1234", "Scott C3a", "Mi 99"). */
  catalogNumber: string;
}

/** Alias reconnus → catalogue + préfixe canonique (les plus longs d'abord). */
const CATALOG_ALIASES: readonly { alias: string; catalog: StampCatalog; prefix: string }[] = [
  { alias: 'yvert et tellier', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'yvert & tellier', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'yvert-tellier', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'stanley gibbons', catalog: 'stanley_gibbons', prefix: 'SG' },
  { alias: 'gibbons', catalog: 'stanley_gibbons', prefix: 'SG' },
  { alias: 'michel', catalog: 'michel', prefix: 'Mi' },
  { alias: 'yvert', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'scott', catalog: 'scott', prefix: 'Scott' },
  { alias: 'y&t', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'sc', catalog: 'scott', prefix: 'Scott' },
  { alias: 'sg', catalog: 'stanley_gibbons', prefix: 'SG' },
  { alias: 'yt', catalog: 'yvert_tellier', prefix: 'YT' },
  { alias: 'mi', catalog: 'michel', prefix: 'Mi' },
];

/**
 * Numéro plausible : lettre(s) de préfixe optionnelles (poste aérienne "C3a",
 * préoblitérés…), partie numérique obligatoire, suffixe de variété optionnel
 * (ex. "1234", "C3a", "99a", "129A").
 */
const NUMBER_PATTERN = /^[A-Za-z]{0,2}\d+[A-Za-z0-9]*$/;

/**
 * Reconnaît une référence de catalogue saisie librement ("yt 1234", "YT1234",
 * "Scott C3a", "Mi. 99", "Yvert & Tellier 129"…) et la normalise.
 * Retourne null si l'entrée n'est pas une référence reconnue — jamais de
 * devinette (un numéro sans catalogue explicite est ambigu).
 */
export function normalizeCatalogNumber(input: string): NormalizedCatalogNumber | null {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (raw === '') return null;
  const lower = raw.toLowerCase();

  for (const { alias, catalog, prefix } of CATALOG_ALIASES) {
    if (!lower.startsWith(alias)) continue;
    let rest = raw.slice(alias.length);
    // Séparateurs tolérés après l'alias : point, deux-points, espaces, "n°"/"no".
    const separated = /^[\s.:]/.test(rest) || rest === '';
    rest = rest.replace(/^[\s.:]+/, '').replace(/^n[°o]\s*/i, '');
    if (rest === '') return null; // alias seul, sans numéro
    // Sans séparateur, le numéro doit commencer par un chiffre ("YT1234" oui,
    // "mint 12" non — 'mi' collé à des lettres n'est pas une référence).
    if (!separated && !/^\d/.test(rest)) continue;
    if (!NUMBER_PATTERN.test(rest)) return null;
    return { catalog, catalogNumber: `${prefix} ${rest}` };
  }
  return null;
}
