/**
 * Recherche locale unifiée (collection, carnet, envies, catalogue) — pure et
 * testée. Insensible à la casse, aux accents et aux apostrophes ; requête
 * multi-mots en ET (« margaux 2015 » trouve « Château Margaux 2015 ») ;
 * classement : titre exact > début de titre > titre > autres champs.
 */
import type { VelumDomain, VelumItem } from '@velum/core';

/** Clés d'attributs exclues de l'index : volumineuses ou hors identification. */
const IGNORED_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'analysis',
  'analysisEngine',
  'analysisStatus',
  'disclaimers',
  'corrections',
  'thumbnailUrl',
]);

/** Minuscules, sans diacritiques, apostrophes/espaces normalisés. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}'.,/\-+ ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mots de la requête (vides ignorés). */
export function tokenize(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

/** Aplatit une valeur JSON quelconque en texte indexable (profondeur bornée). */
export function flattenSearchable(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.flatMap((v) => flattenSearchable(v, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      depth === 0 && IGNORED_ATTRIBUTE_KEYS.has(key) ? [] : flattenSearchable(v, depth + 1),
    );
  }
  return [];
}

/** Document indexable : un titre (pondéré) et des champs secondaires. */
export interface SearchDocument {
  title: string;
  fields: unknown[];
}

/**
 * true si `text` contient `token`. Les mots très courts (≤ 2 caractères, ex.
 * « or ») ne correspondent qu'en début de mot, sinon « or » trouverait
 * « Bordeaux ».
 */
function containsToken(text: string, token: string): boolean {
  if (token.length > 2) return text.includes(token);
  for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1)) {
    if (at === 0 || WORD_SEPARATORS.has(text.charAt(at - 1))) return true;
  }
  return false;
}

/** Caractères qui ouvrent un nouveau mot (« d'or », « saint-julien »). */
const WORD_SEPARATORS: ReadonlySet<string> = new Set([' ', "'", '-', '/', '.', ',', '+']);

/**
 * Score de pertinence d'un document pour une requête déjà tokenisée.
 * 0 = ne correspond pas (au moins un mot absent) ; plus haut = plus pertinent.
 */
export function scoreDocument(doc: SearchDocument, tokens: readonly string[]): number {
  if (tokens.length === 0) return 1;
  const title = normalizeText(doc.title);
  const rest = normalizeText(flattenSearchable(doc.fields).join(' '));
  let score = 0;
  for (const token of tokens) {
    if (containsToken(title, token)) {
      score += title.startsWith(token) || title.includes(` ${token}`) ? 3 : 2;
    } else if (containsToken(rest, token)) {
      score += 1;
    } else {
      return 0;
    }
  }
  if (title === tokens.join(' ')) score += 5;
  return score;
}

/**
 * Filtre et classe `entries` selon `query`. À score égal, l'ordre d'origine est
 * conservé (tri stable) ; requête vide → toutes les entrées, ordre d'origine.
 */
export function searchEntries<T>(
  entries: readonly T[],
  query: string,
  toDocument: (entry: T) => SearchDocument,
): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...entries];
  return entries
    .map((entry, index) => ({ entry, index, score: scoreDocument(toDocument(entry), tokens) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((scored) => scored.entry);
}

/** Document de recherche d'un objet de la collection. */
export function itemSearchDocument(item: VelumItem): SearchDocument {
  return {
    title: item.title ?? '',
    fields: [item.attributes, item.notes, item.storageLocation, item.condition],
  };
}

/** Recherche dans la collection, filtrée par domaine si fourni. */
export function searchItems(
  items: readonly VelumItem[],
  query: string,
  domain?: VelumDomain | null,
): VelumItem[] {
  const scoped = domain ? items.filter((item) => item.domain === domain) : items;
  return searchEntries(scoped, query, itemSearchDocument);
}
