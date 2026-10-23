/**
 * Liste d'envies et d'idées PAR CATÉGORIE — ex. « les vins que j'ai aimés et
 * que je voudrais acheter plus tard ». Une entrée n'est PAS un objet de la
 * collection : elle ne crée ni item, ni valorisation, ni quota de scan.
 */
import type { VelumDomain } from './domain.ts';

/** Envie (à acquérir) ou simple idée (inspiration, à creuser). */
export type WishlistKind = 'wish' | 'idea';

/** Origine de l'entrée — sert au retour vers la source et aux statistiques. */
export type WishlistSource =
  /** Saisie manuelle. */
  | 'manual'
  /** Depuis la fiche d'un objet de la collection (« en racheter »). */
  | 'item'
  /** Depuis un scan non ajouté à la collection (ex. vin goûté au restaurant). */
  | 'scan'
  /** Depuis une note de dégustation. */
  | 'tasting'
  /** Depuis une annonce de la communauté. */
  | 'market';

export type WishlistPriority = 'low' | 'medium' | 'high';

export interface WishlistEntry {
  id: string;
  ownerId: string;
  domain: VelumDomain;
  kind: WishlistKind;
  title: string;
  notes: string | null;
  /** Attributs d'identification (mêmes clés que items.attributes du domaine). */
  attributes: Record<string, unknown>;
  source: WishlistSource;
  /** Objet de la collection à l'origine de l'entrée (source 'item'), sinon null. */
  sourceItemId: string | null;
  /** Prix cible (EUR) au-delà duquel l'utilisateur ne souhaite pas acheter. */
  targetPrice: number | null;
  priority: WishlistPriority;
  /** Coché quand l'envie est satisfaite (achetée / obtenue). */
  acquired: boolean;
  acquiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Création d'une entrée (les champs omis prennent des défauts neutres). */
export interface NewWishlistEntry {
  domain: VelumDomain;
  title: string;
  kind?: WishlistKind;
  notes?: string | null;
  attributes?: Record<string, unknown>;
  source?: WishlistSource;
  sourceItemId?: string | null;
  targetPrice?: number | null;
  priority?: WishlistPriority;
}

/** Modification partielle d'une entrée. */
export type WishlistPatch = Partial<
  Pick<
    WishlistEntry,
    'kind' | 'title' | 'notes' | 'attributes' | 'targetPrice' | 'priority' | 'acquired' | 'domain'
  >
>;
