/**
 * Routes de l'app (Expo Router, liens profonds) — source unique des chemins
 * partagés entre écrans. Toute nouvelle destination transverse est ajoutée ici.
 */
import type { VelumDomain } from '@velum/core';

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query.length > 0 ? `${path}?${query}` : path;
}

export const routes = {
  home: () => '/accueil',
  collection: () => '/(tabs)/collection',
  captureTab: () => '/(tabs)/capture',
  market: () => '/(tabs)/market',
  profile: () => '/(tabs)/profile',
  /** Capture d'un objet (modal) — `mode` : 'quick' (scan éclair) | 'full'. */
  capture: (domain: VelumDomain, mode?: 'quick' | 'full') => withQuery(`/capture/${domain}`, { mode }),
  /** Mode classeur : scan en série / planche multi-objets (timbres, pièces…). */
  captureBatch: (domain: VelumDomain) => withQuery('/capture/batch', { domain }),
  candidates: () => '/capture/candidates',
  item: (id: string) => `/item/${encodeURIComponent(id)}`,
  carnet: () => '/carnet',
  /**
   * Liste d'envies et d'idées, filtrée sur une catégorie si fournie ; `query`
   * pré-remplit sa recherche (« Ouvrir mes envies » de la recherche globale).
   */
  wishlist: (domain?: VelumDomain | null, query?: string) =>
    withQuery('/wishlist', { domain: domain ?? undefined, q: query?.trim() || undefined }),
  /** Vins de MA cave à leur apogée, avec leur emplacement. */
  cellarPeak: () => '/cellar-peak',
  /** Plat → vins (de ma cave d'abord) ; `dish` pré-remplit la recherche. */
  cellarSommelier: (dish?: string) => withQuery('/cellar-sommelier', { dish }),
  /** Plateformes d'échange et de vente, filtrées par catégorie / mode / texte. */
  community: (domain?: VelumDomain | null, mode?: 'sale' | 'exchange', text?: string) =>
    withQuery('/community', { domain: domain ?? undefined, mode, text }),
  /** Hub ouvert sur « Mon activité » (annonces, transactions, échanges, certifications). */
  communityActivity: () => '/community?tab=activity',
  listing: (id: string) => `/community/listing/${encodeURIComponent(id)}`,
  /** Mise en vente / à l'échange d'un objet de ma collection. */
  sell: (itemId: string) => withQuery('/community/sell', { itemId }),
  /** Mise en vente SANS objet présélectionné : choix parmi mes objets. */
  sellPicker: (domain?: VelumDomain | null) =>
    withQuery('/community/sell', { domain: domain ?? undefined }),
  exchange: (id: string) => `/community/exchange/${encodeURIComponent(id)}`,
  wishlistEntry: (id: string) => `/wishlist/${encodeURIComponent(id)}`,
  wishlistNew: (domain?: VelumDomain | null) =>
    withQuery('/wishlist/new', { domain: domain ?? undefined }),
  /** Recherche globale (collection, envies, échanges & ventes). */
  search: (query?: string) => withQuery('/search', { q: query?.trim() || undefined }),
  arbiter: (itemId: string) => `/arbiter/${encodeURIComponent(itemId)}`,
  eventSommelier: () => '/event-sommelier',
  blindTasting: () => '/blind-tasting',
  privacy: () => '/privacy',
  paywall: () => '/paywall',
} as const;
