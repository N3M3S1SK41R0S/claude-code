/**
 * Vue de l'onglet Collection et recherche du carnet — logique PURE (aucune
 * dépendance React Native, testée sous Vitest).
 *
 * Règles :
 *  - recherche via `searchItems` (titre, attributs, notes, emplacement, état),
 *    insensible à la casse et aux accents ;
 *  - hors recherche, le regroupement par domaine est conservé (ordre des
 *    domaines actifs, puis domaines inattendus dans l'ordre d'apparition) ;
 *  - en recherche, liste à plat triée selon le tri choisi (la pertinence sert
 *    de départage, le tri étant stable) ;
 *  - « aucun résultat » est un état DISTINCT de la collection vide : on ne dit
 *    jamais « collection vide » quand seul un filtre ne correspond à rien.
 */
import type { CellarPeakEntry, ValuationRecord, VelumDomain, VelumItem } from '@velum/core';

import { normalizeText, searchItems, tokenize } from './search';

/** Tris proposés : ajout récent, valeur décroissante, nom A→Z. */
export type CollectionSort = 'recent' | 'value_desc' | 'name_asc';

export const COLLECTION_SORTS: readonly CollectionSort[] = ['recent', 'value_desc', 'name_asc'];

export const DEFAULT_COLLECTION_SORT: CollectionSort = 'recent';

/** Nombre de vins « à boire » affichés dans le bandeau compact. */
export const DRINK_NOW_PREVIEW_LIMIT = 3;

/**
 * Lecture React Query en pause HORS-LIGNE sans aucune donnée (ni cache) :
 * l'écran affiche l'état hors-ligne — jamais « vide » ni « introuvable ».
 * (`isLoading` est faux dans ce cas : la requête n'est pas en cours.)
 */
export function isOfflineWithoutData(query: { fetchStatus: string; data?: unknown }): boolean {
  return query.fetchStatus === 'paused' && query.data === undefined;
}

/** Paramètre de route → tri connu (repli sur le tri par défaut). */
export function parseCollectionSort(raw: unknown): CollectionSort {
  return typeof raw === 'string' && (COLLECTION_SORTS as readonly string[]).includes(raw)
    ? (raw as CollectionSort)
    : DEFAULT_COLLECTION_SORT;
}

/**
 * Paramètre de route → domaine actif, sinon null (« toutes »). Un domaine
 * inconnu ou désactivé n'est jamais appliqué silencieusement.
 */
export function parseDomainParam(
  raw: unknown,
  domains: readonly VelumDomain[],
): VelumDomain | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && (domains as readonly string[]).includes(value)
    ? (value as VelumDomain)
    : null;
}

/** Paramètre de route texte (première valeur si tableau), borné à 200 caractères. */
export function parseTextParam(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.slice(0, 200) : '';
}

/** Valeur centrale connue d'un objet, ou null (non valorisé OU cote en panne). */
export function itemValue(
  item: VelumItem,
  latestByItem: Readonly<Record<string, ValuationRecord | null>>,
  failedValuationIds: ReadonlySet<string> = new Set(),
): number | null {
  if (failedValuationIds.has(item.id)) return null;
  const central = latestByItem[item.id]?.central;
  return typeof central === 'number' && Number.isFinite(central) ? central : null;
}

/** Horodatage de création exploitable, sinon -Infinity (classé en dernier). */
function createdTime(item: VelumItem): number {
  const time = Date.parse(item.createdAt);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/** Clé de tri alphabétique : sans accents ni casse ; titre absent → en dernier. */
function nameKey(item: VelumItem): string | null {
  const key = normalizeText(item.title ?? '');
  return key.length > 0 ? key : null;
}

function compareNames(a: VelumItem, b: VelumItem): number {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Trie une copie de `items` (tri STABLE : à égalité, l'ordre d'entrée — donc
 * la pertinence d'une recherche — est conservé).
 *  - 'recent' : création la plus récente d'abord ;
 *  - 'value_desc' : valeur décroissante, objets sans valeur connue en dernier
 *    (une cote en panne n'est jamais traitée comme 0 €), puis nom A→Z ;
 *  - 'name_asc' : nom A→Z sans accents ni casse, sans titre en dernier.
 */
export function sortItems(
  items: readonly VelumItem[],
  sort: CollectionSort,
  latestByItem: Readonly<Record<string, ValuationRecord | null>>,
  failedValuationIds: ReadonlySet<string> = new Set(),
): VelumItem[] {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((x, y) => {
    let order = 0;
    if (sort === 'recent') {
      const tx = createdTime(x.item);
      const ty = createdTime(y.item);
      order = tx === ty ? 0 : ty > tx ? 1 : -1;
    } else if (sort === 'value_desc') {
      const vx = itemValue(x.item, latestByItem, failedValuationIds);
      const vy = itemValue(y.item, latestByItem, failedValuationIds);
      if (vx === null && vy !== null) order = 1;
      else if (vx !== null && vy === null) order = -1;
      else if (vx !== null && vy !== null && vx !== vy) order = vy - vx;
      else order = compareNames(x.item, y.item);
    } else {
      order = compareNames(x.item, y.item);
    }
    return order !== 0 ? order : x.index - y.index;
  });
  return indexed.map((entry) => entry.item);
}

export interface CollectionGroup {
  domain: VelumDomain;
  items: VelumItem[];
}

/**
 * Regroupe par domaine dans l'ordre `domainOrder`, puis les domaines absents
 * de cet ordre (flag désactivé mais objets existants) dans l'ordre
 * d'apparition. Les groupes vides sont omis.
 */
export function groupByDomain(
  items: readonly VelumItem[],
  domainOrder: readonly VelumDomain[],
): CollectionGroup[] {
  const buckets = new Map<VelumDomain, VelumItem[]>();
  for (const domain of domainOrder) buckets.set(domain, []);
  for (const item of items) {
    const bucket = buckets.get(item.domain);
    if (bucket) bucket.push(item);
    else buckets.set(item.domain, [item]);
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([domain, bucket]) => ({ domain, items: bucket }));
}

export interface CollectionViewInput {
  items: readonly VelumItem[];
  latestByItem: Readonly<Record<string, ValuationRecord | null>>;
  failedValuationItemIds?: readonly string[];
  query: string;
  /** null = toutes les catégories. */
  domain: VelumDomain | null;
  sort: CollectionSort;
  /** Ordre d'affichage des groupes (domaines actifs). */
  domainOrder: readonly VelumDomain[];
}

export type CollectionView =
  /** Aucun objet du tout : invitation à capturer. */
  | { kind: 'empty' }
  /** Des objets existent mais le filtre ou la recherche ne trouve rien. */
  | { kind: 'noResult'; reason: 'query' | 'domain'; query: string; domain: VelumDomain | null }
  /** Hors recherche : groupes par domaine (un seul si une catégorie est choisie). */
  | { kind: 'grouped'; groups: CollectionGroup[]; count: number; filtered: boolean }
  /** Recherche active : liste à plat triée. */
  | { kind: 'results'; items: VelumItem[]; count: number };

/** Calcule l'état d'affichage complet de l'onglet Collection. */
export function buildCollectionView(input: CollectionViewInput): CollectionView {
  if (input.items.length === 0) return { kind: 'empty' };
  const failed = new Set(input.failedValuationItemIds ?? []);
  const searching = tokenize(input.query).length > 0;
  const matched = searchItems(input.items, input.query, input.domain);

  if (matched.length === 0) {
    return {
      kind: 'noResult',
      reason: searching ? 'query' : 'domain',
      query: input.query.trim(),
      domain: input.domain,
    };
  }

  const sorted = sortItems(matched, input.sort, input.latestByItem, failed);
  if (searching) return { kind: 'results', items: sorted, count: sorted.length };
  return {
    kind: 'grouped',
    groups: groupByDomain(sorted, input.domainOrder),
    count: sorted.length,
    filtered: input.domain !== null,
  };
}

/** true si le compteur « n résultat(s) » doit être affiché (filtre ou recherche actif). */
export function showsResultCount(view: CollectionView): boolean {
  return view.kind === 'results' || (view.kind === 'grouped' && view.filtered);
}

export interface DrinkNowPreview<T = CellarPeakEntry> {
  shown: T[];
  /** Vins non affichés dans le bandeau (« Voir tout »). */
  hidden: number;
  total: number;
}

/** Bandeau « à boire » compact : les `limit` premiers (déjà triés par urgence). */
export function drinkNowPreview<T>(signals: readonly T[], limit: number = DRINK_NOW_PREVIEW_LIMIT): DrinkNowPreview<T> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : DRINK_NOW_PREVIEW_LIMIT;
  const shown = signals.slice(0, safeLimit);
  return { shown, hidden: signals.length - shown.length, total: signals.length };
}

/**
 * Lien vers l'onglet Collection pré-filtré (depuis la recherche globale).
 * Paramètres vides omis.
 */
export function collectionHref(query?: string, domain?: VelumDomain | null): string {
  const params: string[] = [];
  const text = query?.trim() ?? '';
  if (text.length > 0) params.push(`q=${encodeURIComponent(text)}`);
  if (domain) params.push(`domain=${encodeURIComponent(domain)}`);
  return params.length > 0 ? `/(tabs)/collection?${params.join('&')}` : '/(tabs)/collection';
}

// ─────────────────────────────────────────────────────────────────────────────
// Carnet : recherche dans un carnet ou dans tous les carnets
// ─────────────────────────────────────────────────────────────────────────────

export interface CarnetSearch {
  /** false si la requête est vide : le carnet s'affiche normalement. */
  active: boolean;
  /** Portée : un carnet (domaine) ou tous (null). */
  scope: VelumDomain | null;
  /** Correspondances dans la portée (ordre de pertinence). */
  items: VelumItem[];
  /** Correspondances groupées par carnet (utile pour la portée « tous »). */
  groups: CollectionGroup[];
  /** Correspondances TOUTES portées confondues, par carnet. */
  countsByDomain: Partial<Record<VelumDomain, number>>;
  /** Total toutes portées confondues. */
  total: number;
}

/**
 * Recherche du carnet. Les décomptes par carnet permettent de signaler
 * « 2 résultats dans le Médaillier » quand la portée courante ne trouve rien.
 */
export function carnetSearch(
  items: readonly VelumItem[],
  query: string,
  scope: VelumDomain | null,
  domainOrder: readonly VelumDomain[],
): CarnetSearch {
  if (tokenize(query).length === 0) {
    return { active: false, scope, items: [], groups: [], countsByDomain: {}, total: 0 };
  }
  const everywhere = searchItems(items, query);
  const countsByDomain: Partial<Record<VelumDomain, number>> = {};
  for (const item of everywhere) {
    countsByDomain[item.domain] = (countsByDomain[item.domain] ?? 0) + 1;
  }
  const inScope = scope === null ? everywhere : everywhere.filter((item) => item.domain === scope);
  return {
    active: true,
    scope,
    items: inScope,
    groups: groupByDomain(inScope, domainOrder),
    countsByDomain,
    total: everywhere.length,
  };
}

/** Nombre de correspondances HORS de la portée courante (0 si portée « tous »). */
export function carnetMatchesElsewhere(search: CarnetSearch): number {
  if (!search.active || search.scope === null) return 0;
  return search.total - (search.countsByDomain[search.scope] ?? 0);
}
