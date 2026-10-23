/**
 * Catalogue des plateformes d'échange et de vente — logique PURE : filtres de
 * l'interface → `CatalogueQuery` (@velum/core), paramètres de route du hub,
 * clés React Query et recherche d'une annonce dans le cache.
 */
import type {
  CatalogueListing,
  CatalogueQuery,
  CatalogueSort,
  ListingRecord,
  VelumDomain,
} from '@velum/core';

import { parseFrenchAmount } from './marketForms';
import { routes } from './routes';

/** Les catégories (une plateforme par catégorie), dans l'ordre d'affichage. */
const DOMAIN_SET: Record<VelumDomain, true> = {
  wine: true,
  coin: true,
  art: true,
  stamp: true,
  watch: true,
};
export const MARKET_DOMAINS: readonly VelumDomain[] = Object.keys(DOMAIN_SET) as VelumDomain[];

export function isVelumDomain(value: unknown): value is VelumDomain {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DOMAIN_SET, value);
}

/** Mode du catalogue : ventes, échanges, ou tout. */
export type CatalogueMode = 'all' | 'sale' | 'exchange';

/** Onglet du hub « Échanges & ventes ». */
export type CommunityTab = 'catalogue' | 'activity';

/** État des filtres de l'interface (montants en saisie brute). */
export interface CatalogueFilters {
  domain: VelumDomain | null;
  mode: CatalogueMode;
  text: string;
  minPrice: string;
  maxPrice: string;
  certifiedOnly: boolean;
  sort: CatalogueSort;
}

export const DEFAULT_CATALOGUE_FILTERS: CatalogueFilters = {
  domain: null,
  mode: 'all',
  text: '',
  minPrice: '',
  maxPrice: '',
  certifiedOnly: false,
  sort: 'recent',
};

/** Problème de saisie dans la fourchette de prix (null si tout va bien). */
export type PriceRangeIssue = 'invalid_min' | 'invalid_max' | 'min_above_max' | null;

export function priceRangeIssue(filters: Pick<CatalogueFilters, 'minPrice' | 'maxPrice'>): PriceRangeIssue {
  const min = filters.minPrice.trim().length > 0 ? parseFrenchAmount(filters.minPrice) : undefined;
  const max = filters.maxPrice.trim().length > 0 ? parseFrenchAmount(filters.maxPrice) : undefined;
  if (min === null) return 'invalid_min';
  if (max === null) return 'invalid_max';
  if (min !== undefined && max !== undefined && min > max) return 'min_above_max';
  return null;
}

/**
 * Filtres UI → requête catalogue. Montants invalides ignorés (signalés à part
 * par `priceRangeIssue`) ; fourchette inversée remise dans l'ordre ; texte
 * nettoyé ; seuls les critères actifs sont transmis.
 */
export function buildCatalogueQuery(filters: CatalogueFilters): CatalogueQuery {
  const query: CatalogueQuery = { sort: filters.sort };
  if (filters.domain !== null) query.domain = filters.domain;
  if (filters.mode !== 'all') query.mode = filters.mode;
  const text = filters.text.replace(/\s+/g, ' ').trim();
  if (text.length > 0) query.text = text;
  let min = parseFrenchAmount(filters.minPrice);
  let max = parseFrenchAmount(filters.maxPrice);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  if (min !== null && min > 0) query.minPrice = min;
  if (max !== null) query.maxPrice = max;
  if (filters.certifiedOnly) query.certifiedOnly = true;
  return query;
}

/** Nombre de filtres avancés actifs (pastille du bouton « Filtres »). */
export function activeFilterCount(filters: CatalogueFilters): number {
  let count = 0;
  if (filters.minPrice.trim().length > 0) count += 1;
  if (filters.maxPrice.trim().length > 0) count += 1;
  if (filters.certifiedOnly) count += 1;
  if (filters.sort !== 'recent') count += 1;
  return count;
}

// ── Paramètres de route ──────────────────────────────────────────────────────

type RouteParam = string | string[] | undefined;

function firstParam(value: RouteParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface CommunityParams {
  domain: VelumDomain | null;
  mode: CatalogueMode;
  text: string;
  tab: CommunityTab;
}

/** Lit (et valide) les paramètres de `routes.community(domain, mode, text)` + `tab`. */
export function parseCommunityParams(params: Record<string, RouteParam>): CommunityParams {
  const domain = firstParam(params['domain']);
  const mode = firstParam(params['mode']);
  const tab = firstParam(params['tab']);
  return {
    domain: isVelumDomain(domain) ? domain : null,
    mode: mode === 'sale' || mode === 'exchange' ? mode : 'all',
    text: (firstParam(params['text']) ?? '').slice(0, 120),
    tab: tab === 'activity' ? 'activity' : 'catalogue',
  };
}

/** Premier paramètre texte d'une route (ex. `id`, `itemId`), null si absent. */
export function stringParam(value: RouteParam): string | null {
  const v = firstParam(value);
  return v !== undefined && v.trim().length > 0 ? v : null;
}

/** Hub ouvert sur « Mon activité » — délègue au registre lib/routes.ts. */
export function communityActivityHref(): string {
  return routes.communityActivity();
}

/** Mise en vente SANS objet présélectionné — délègue au registre lib/routes.ts. */
export function sellPickerHref(domain?: VelumDomain | null): string {
  return routes.sellPicker(domain);
}

// ── React Query ──────────────────────────────────────────────────────────────

/** Racine de toutes les clés de la communauté (invalidation groupée). */
export const COMMUNITY_KEY = 'community' as const;

export const communityKeys = {
  all: [COMMUNITY_KEY] as const,
  catalogue: (query: CatalogueQuery) => [COMMUNITY_KEY, 'catalogue', query] as const,
  catalogueRoot: [COMMUNITY_KEY, 'catalogue'] as const,
  listing: (id: string) => [COMMUNITY_KEY, 'listing', id] as const,
  myListings: [COMMUNITY_KEY, 'myListings'] as const,
  orders: [COMMUNITY_KEY, 'orders'] as const,
  exchanges: [COMMUNITY_KEY, 'exchanges'] as const,
  certifications: [COMMUNITY_KEY, 'certifications'] as const,
  reputation: (alias: string) => [COMMUNITY_KEY, 'reputation', alias] as const,
  messages: (kind: 'order' | 'exchange', id: string) => [COMMUNITY_KEY, 'messages', kind, id] as const,
};

function isCatalogueListing(value: unknown): value is CatalogueListing {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['sellerAlias'] === 'string' &&
    typeof v['askPrice'] === 'number' &&
    typeof v['kind'] === 'string'
  );
}

/**
 * Cherche une annonce dans des pages de catalogue déjà en cache (données
 * `unknown` : on vérifie la forme avant usage). null si absente.
 */
export function findCatalogueListing(pages: readonly unknown[], id: string): CatalogueListing | null {
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const entry of page) {
      if (isCatalogueListing(entry) && entry.id === id) return entry;
    }
  }
  return null;
}

/** Ma propre annonce (dépôt `myListings`) vue comme une annonce du catalogue. */
export function catalogueViewOfMine(listing: ListingRecord, myAlias: string): CatalogueListing {
  return {
    id: listing.id,
    kind: listing.kind,
    domain: listing.domain,
    title: listing.title,
    description: listing.description,
    askPrice: listing.askPrice,
    currency: listing.currency,
    exchangeWishes: listing.exchangeWishes,
    sellerAlias: myAlias,
    certified: listing.certified,
    isMine: true,
    createdAt: listing.createdAt,
  };
}
