/**
 * Accès rapides (onglet Collection et accueil) — registre PUR des raccourcis
 * vers les espaces de l'app : destination (toujours via `routes`), icône et
 * clé i18n. Aucune dépendance React Native : testé sous Vitest.
 *
 * Les libellés vivent dans `collection.quick.<id>` / `accueil.quick.<id>`
 * (+ `…Hint` pour l'aide d'accessibilité).
 */
import type { VelumDomain } from '@velum/core';

import { routes } from './routes';

/** Icônes Ionicons utilisées par les accès rapides (noms vérifiés). */
export type QuickAccessIcon =
  | 'albums'
  | 'book'
  | 'camera'
  | 'eye-off'
  | 'heart'
  | 'hourglass'
  | 'layers'
  | 'people'
  | 'restaurant'
  | 'search'
  | 'swap-horizontal'
  | 'trending-up';

export interface QuickAccessEntry<Id extends string> {
  id: Id;
  href: string;
  icon: QuickAccessIcon;
  /** Mise en avant (liseré doré) : action principale de la grille. */
  gilded?: boolean;
}

/** Ordre de préférence du domaine ouvert par le « mode classeur ». */
const BATCH_DOMAIN_PREFERENCE: readonly VelumDomain[] = ['stamp', 'coin'];

/**
 * Domaine du mode classeur : timbres d'abord (classeurs), puis pièces, sinon
 * le premier domaine actif ; null si aucun domaine n'est actif.
 */
export function batchCaptureDomain(activeDomains: readonly VelumDomain[]): VelumDomain | null {
  for (const preferred of BATCH_DOMAIN_PREFERENCE) {
    if (activeDomains.includes(preferred)) return preferred;
  }
  return activeDomains[0] ?? null;
}

export type CollectionQuickAccessId =
  | 'carnet'
  | 'wishlist'
  | 'cellarPeak'
  | 'sommelier'
  | 'community'
  | 'batch'
  | 'eventSommelier'
  | 'blindTasting';

export interface CollectionQuickAccessInput {
  /** La collection contient au moins un vin. */
  hasWine: boolean;
  activeDomains: readonly VelumDomain[];
  /**
   * Échanges & ventes ouverts (drapeau produit enableMarketplace, cf.
   * marketplaceEnabled) : coupé, aucune tuile n'y mène.
   */
  marketplace: boolean;
}

/**
 * Grille d'accès rapide de l'onglet Collection (2 colonnes). Les outils de
 * cave qui exigent des bouteilles (apogée, sommelier d'événement,
 * dégustation à l'aveugle) n'apparaissent que si la cave contient du vin ;
 * le sommelier « plat → vin » reste toujours accessible (conseil d'achat).
 */
export function collectionQuickAccess(
  input: CollectionQuickAccessInput,
): QuickAccessEntry<CollectionQuickAccessId>[] {
  const entries: QuickAccessEntry<CollectionQuickAccessId>[] = [
    { id: 'carnet', href: routes.carnet(), icon: 'book', gilded: true },
    { id: 'wishlist', href: routes.wishlist(), icon: 'heart' },
  ];
  if (input.hasWine) {
    entries.push({ id: 'cellarPeak', href: routes.cellarPeak(), icon: 'hourglass' });
  }
  entries.push({ id: 'sommelier', href: routes.cellarSommelier(), icon: 'restaurant' });
  if (input.marketplace) {
    entries.push({ id: 'community', href: routes.community(), icon: 'swap-horizontal' });
  }
  const batchDomain = batchCaptureDomain(input.activeDomains);
  if (batchDomain !== null) {
    entries.push({ id: 'batch', href: routes.captureBatch(batchDomain), icon: 'layers' });
  }
  if (input.hasWine) {
    entries.push(
      { id: 'eventSommelier', href: routes.eventSommelier(), icon: 'people' },
      { id: 'blindTasting', href: routes.blindTasting(), icon: 'eye-off' },
    );
  }
  return entries;
}

export type HomeQuickAccessId =
  | 'capture'
  | 'batch'
  | 'collection'
  | 'wishlist'
  | 'community'
  | 'cellarPeak'
  | 'market';

/**
 * Accès rapides de l'accueil, organisés autour des espaces : capturer (scan
 * éclair / mode classeur), ma collection, mes envies, échanges & ventes, vins
 * à l'apogée, marché & alertes. La recherche globale a son propre champ en
 * tête d'écran. Échanges & ventes : seulement si le drapeau produit est actif.
 */
export function homeQuickAccess(
  activeDomains: readonly VelumDomain[],
  options: { marketplace: boolean },
): QuickAccessEntry<HomeQuickAccessId>[] {
  const entries: QuickAccessEntry<HomeQuickAccessId>[] = [
    { id: 'capture', href: routes.captureTab(), icon: 'camera', gilded: true },
  ];
  const batchDomain = batchCaptureDomain(activeDomains);
  if (batchDomain !== null) {
    entries.push({ id: 'batch', href: routes.captureBatch(batchDomain), icon: 'layers' });
  }
  entries.push(
    { id: 'collection', href: routes.collection(), icon: 'albums' },
    { id: 'wishlist', href: routes.wishlist(), icon: 'heart' },
  );
  if (options.marketplace) {
    entries.push({ id: 'community', href: routes.community(), icon: 'swap-horizontal' });
  }
  if (activeDomains.includes('wine')) {
    entries.push({ id: 'cellarPeak', href: routes.cellarPeak(), icon: 'hourglass' });
  }
  entries.push({ id: 'market', href: routes.market(), icon: 'trending-up' });
  return entries;
}
