/**
 * « Rechercher partout » — logique PURE de l'écran /search (testée sous
 * Vitest, aucune dépendance React Native).
 *
 * Trois sections, chacune avec son PROPRE état (chargement / panne / prêt) :
 *  - Ma collection : recherche locale (`searchItems`) sur la liste en cache ;
 *  - Mes envies : `client.wishlist.list()` + `searchEntries` ;
 *  - Échanges & ventes : `client.marketplace.catalogue({ text })`, réservé à
 *    l'offre Platine. Une offre insuffisante, une fonction serveur pas encore
 *    câblée ou une panne donnent une section REPLIÉE avec message — jamais une
 *    erreur bloquante, jamais un faux « aucun résultat ».
 */
import {
  isVelumError,
  type CatalogueListing,
  type CatalogueQuery,
  type VelumItem,
  type WishlistEntry,
} from '@velum/core';

import { scoreDocument, searchEntries, searchItems, tokenize, type SearchDocument } from './search';

/** Route de l'écran de recherche globale. */
export const GLOBAL_SEARCH_PATH = '/search';

/** Résultats affichés par section avant « Voir tout ». */
export const GLOBAL_SEARCH_SECTION_LIMIT = 5;

/** Longueur minimale (caractères utiles) avant d'interroger le catalogue serveur. */
export const MIN_CATALOGUE_QUERY_LENGTH = 2;

/** Résultats demandés au catalogue (le serveur peut en renvoyer moins). */
export const CATALOGUE_SEARCH_LIMIT = 20;

/** Longueur maximale d'une requête (au-delà : tronquée). */
export const MAX_QUERY_LENGTH = 200;

/**
 * Clé React Query de la liste d'envies — la MÊME que l'écran « Mes envies »
 * (`client.wishlist.list()` sans filtre) : cache partagé et invalidé ensemble.
 */
export const WISHLIST_LIST_KEY = ['wishlist'] as const;

/** Clé React Query d'une recherche catalogue (sous le préfixe « community »). */
export function catalogueSearchKey(query: CatalogueQuery) {
  return ['community', 'catalogue', 'globalSearch', query] as const;
}

/** Lien vers la recherche globale, requête pré-remplie si fournie. */
export function globalSearchHref(query?: string): string {
  const text = query?.trim() ?? '';
  return text.length > 0
    ? `${GLOBAL_SEARCH_PATH}?q=${encodeURIComponent(text.slice(0, MAX_QUERY_LENGTH))}`
    : GLOBAL_SEARCH_PATH;
}

/** true si la requête contient au moins un mot recherchable. */
export function isSearchableQuery(query: string): boolean {
  return tokenize(query).length > 0;
}

/**
 * Requête catalogue pour un texte saisi : espaces normalisés, au moins
 * MIN_CATALOGUE_QUERY_LENGTH caractères, sinon null (pas d'appel serveur).
 */
export function catalogueQueryFor(query: string): CatalogueQuery | null {
  const text = query.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  if (text.length < MIN_CATALOGUE_QUERY_LENGTH || !isSearchableQuery(text)) return null;
  return { text, limit: CATALOGUE_SEARCH_LIMIT };
}

export interface SectionSlice<T> {
  results: T[];
  total: number;
  /** true si des résultats ne sont pas affichés (« Voir tout »). */
  hasMore: boolean;
}

/** Tronque une liste de résultats à `limit` (limite invalide → défaut). */
export function sliceSection<T>(
  all: readonly T[],
  limit: number = GLOBAL_SEARCH_SECTION_LIMIT,
): SectionSlice<T> {
  const safe = Number.isInteger(limit) && limit > 0 ? limit : GLOBAL_SEARCH_SECTION_LIMIT;
  const results = all.slice(0, safe);
  return { results, total: all.length, hasMore: all.length > results.length };
}

/** Ma collection : recherche locale (titre, attributs, notes, emplacement). */
export function searchCollectionSection(
  items: readonly VelumItem[],
  query: string,
  limit?: number,
): SectionSlice<VelumItem> {
  if (!isSearchableQuery(query)) return sliceSection([], limit);
  return sliceSection(searchItems(items, query), limit);
}

/** Document de recherche d'une envie (titre pondéré, attributs, notes). */
export function wishlistSearchDocument(entry: WishlistEntry): SearchDocument {
  return { title: entry.title, fields: [entry.attributes, entry.notes] };
}

/**
 * Mes envies : envies non satisfaites d'abord (à pertinence égale, l'ordre
 * du dépôt est conservé), puis celles déjà acquises.
 */
export function searchWishlistSection(
  entries: readonly WishlistEntry[],
  query: string,
  limit?: number,
): SectionSlice<WishlistEntry> {
  if (!isSearchableQuery(query)) return sliceSection([], limit);
  const matched = searchEntries(entries, query, wishlistSearchDocument);
  const ordered = [
    ...matched.filter((entry) => !entry.acquired),
    ...matched.filter((entry) => entry.acquired),
  ];
  return sliceSection(ordered, limit);
}

/** Document de recherche d'une annonce du catalogue. */
export function listingSearchDocument(listing: CatalogueListing): SearchDocument {
  return { title: listing.title ?? '', fields: [listing.description, listing.exchangeWishes] };
}

/**
 * Classe les annonces renvoyées par le SERVEUR par pertinence locale, sans en
 * retirer aucune (le serveur a déjà filtré ; sa correspondance peut différer
 * de la nôtre — ex. accents). Tri stable : à score égal, ordre serveur.
 */
export function rankCatalogue(
  listings: readonly CatalogueListing[],
  query: string,
): CatalogueListing[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...listings];
  return listings
    .map((listing, index) => ({
      listing,
      index,
      score: scoreDocument(listingSearchDocument(listing), tokens),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((scored) => scored.listing);
}

/** Motif d'indisponibilité du catalogue. */
export type CatalogueIssue =
  /** Le serveur exige une offre supérieure. */
  | 'plan'
  /** Fonction serveur pas encore câblée (« pas encore disponible »). */
  | 'notYetAvailable'
  /** Panne (réseau, PostgREST…) : relance possible. */
  | 'failed';

/** Interprète une erreur du catalogue (jamais présentée comme une liste vide). */
export function classifyCatalogueError(error: unknown): CatalogueIssue {
  if (isVelumError(error)) {
    if (error.code === 'PLAN_REQUIRED') return 'plan';
    if (error.code === 'SOURCE_UNAVAILABLE' && /pas encore disponible/i.test(error.message)) {
      return 'notYetAvailable';
    }
  }
  return 'failed';
}

/**
 * Politique de relance React Query du catalogue : inutile d'insister sur une
 * offre insuffisante ou une fonction pas encore câblée ; une relance sinon.
 */
export function catalogueRetry(failureCount: number, error: unknown): boolean {
  return classifyCatalogueError(error) === 'failed' && failureCount < 1;
}

/** Accès au catalogue selon l'état du plan (cf. usePlan). */
export type CatalogueAccess = 'loading' | 'error' | 'locked' | 'open';

export function catalogueAccess(
  plan: { status: 'loading' } | { status: 'error' } | { status: 'ready'; community: boolean },
): CatalogueAccess {
  if (plan.status === 'loading') return 'loading';
  if (plan.status === 'error') return 'error';
  return plan.community ? 'open' : 'locked';
}

/** Instantané d'une lecture asynchrone (sous-ensemble de React Query). */
export interface FetchSnapshot<T> {
  status: 'pending' | 'error' | 'success';
  data?: T;
  error?: unknown;
}

/** État d'affichage d'une section de recherche. */
export type SectionState<T> =
  /** Requête vide ou trop courte : la section n'est pas interrogée. */
  | { status: 'idle' }
  | { status: 'loading' }
  /** Panne de chargement : message + « Réessayer ». */
  | { status: 'error'; error: unknown }
  /** Échanges & ventes : offre Platine requise (plan confirmé). */
  | { status: 'locked' }
  /** Échanges & ventes : indisponible (plan illisible, fonction non câblée…). */
  | { status: 'unavailable'; issue: CatalogueIssue | 'planError'; error: unknown }
  | { status: 'ready'; slice: SectionSlice<T> };

/** Section locale (collection, envies) : chargement → panne → résultats. */
export function localSectionState<S, T>(
  query: string,
  source: FetchSnapshot<S>,
  search: (data: S, query: string) => SectionSlice<T>,
): SectionState<T> {
  if (!isSearchableQuery(query)) return { status: 'idle' };
  // Une donnée en cache reste exploitable même si son rafraîchissement échoue.
  if (source.data !== undefined) return { status: 'ready', slice: search(source.data, query) };
  if (source.status === 'error') return { status: 'error', error: source.error };
  return { status: 'loading' };
}

/** Section « Échanges & ventes » : plan → requête → catalogue. */
export function marketSectionState(input: {
  query: string;
  access: CatalogueAccess;
  planError?: unknown;
  catalogue: FetchSnapshot<CatalogueListing[]>;
  limit?: number;
}): SectionState<CatalogueListing> {
  if (catalogueQueryFor(input.query) === null) return { status: 'idle' };
  if (input.access === 'loading') return { status: 'loading' };
  if (input.access === 'error') {
    return { status: 'unavailable', issue: 'planError', error: input.planError };
  }
  if (input.access === 'locked') return { status: 'locked' };
  if (input.catalogue.status === 'error') {
    const issue = classifyCatalogueError(input.catalogue.error);
    return issue === 'plan'
      ? { status: 'locked' }
      : { status: 'unavailable', issue, error: input.catalogue.error };
  }
  if (input.catalogue.data === undefined) return { status: 'loading' };
  return {
    status: 'ready',
    slice: sliceSection(rankCatalogue(input.catalogue.data, input.query), input.limit),
  };
}

/** Issue globale de la recherche, pour le message d'en-tête. */
export type GlobalSearchOutcome =
  /** Aucune requête. */
  | 'idle'
  /** Au moins un résultat quelque part. */
  | 'results'
  /** Toutes les sections interrogeables ont répondu : rien nulle part. */
  | 'noResult'
  /** Rien pour l'instant, mais une section charge ou est en panne : pas de verdict. */
  | 'incomplete';

/** true si la section n'a pas (encore) pu répondre : chargement ou panne. */
function isPending(section: SectionState<unknown>): boolean {
  if (section.status === 'loading' || section.status === 'error') return true;
  // Une fonction pas encore câblée n'est pas interrogeable (comme une section
  // verrouillée) ; une panne ou un plan illisible, si.
  return section.status === 'unavailable' && section.issue !== 'notYetAvailable';
}

/**
 * Verdict global. « Aucun résultat » n'est affirmé que si CHAQUE section
 * interrogeable a effectivement répondu (une section verrouillée par l'offre,
 * pas encore câblée ou non interrogée faute de requête suffisante ne compte
 * pas) ; une panne ou un chargement en cours rend le verdict « incomplet ».
 */
export function globalSearchOutcome(
  query: string,
  sections: readonly SectionState<unknown>[],
): GlobalSearchOutcome {
  if (!isSearchableQuery(query)) return 'idle';
  let pending = false;
  for (const section of sections) {
    if (section.status === 'ready' && section.slice.total > 0) return 'results';
    if (isPending(section)) pending = true;
  }
  return pending ? 'incomplete' : 'noResult';
}

/** Total affiché (« n résultat(s) ») : somme des sections prêtes. */
export function globalSearchTotal(sections: readonly SectionState<unknown>[]): number {
  return sections.reduce(
    (sum, section) => sum + (section.status === 'ready' ? section.slice.total : 0),
    0,
  );
}
