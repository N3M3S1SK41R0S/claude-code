/** Miroirs TypeScript du schéma Postgres (§8.1) — camelCase côté app. */
import type { MediaRole, VelumDomain } from './domain';
import type { PriceObservation } from './pricing';

/** Palier d'abonnement effectif (source de vérité : profiles.plan, synchronisé RevenueCat). */
export type PlanTier = 'free' | 'premium' | 'gold' | 'platine';

export interface Profile {
  id: string;
  displayName: string | null;
  locale: string;
  /** Mode senior : gros boutons, contraste renforcé, police majorée (§11.2). */
  a11yMode: boolean;
  /** Offre : free (5 scans/sem/module) / premium / gold (carnet) / platine (tout). */
  plan: PlanTier;
  createdAt: string;
}

export interface VelumItem {
  id: string;
  ownerId: string;
  domain: VelumDomain;
  title: string | null;
  attributes: Record<string, unknown>;
  /** Confiance d'identification 0..1. */
  confidence: number | null;
  acquiredAt: string | null;
  acquiredPrice: number | null;
  condition: string | null;
  notes: string | null;
  storageLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMedia {
  id: string;
  itemId: string;
  kind: MediaRole;
  storagePath: string;
  createdAt: string;
}

export interface AnalysisRecord {
  id: string;
  itemId: string;
  engine: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ValuationRecord {
  id: string;
  itemId: string;
  central: number;
  ci80Low: number;
  ci80High: number;
  ci95Low: number;
  ci95High: number;
  reliability: number;
  sources: PriceObservation[];
  valuedAt: string;
}

/** Note de dégustation PERSONNELLE (historique) — rating /100 INFORMATIF. */
export interface TastingNote {
  id: string;
  itemId: string;
  /** Appréciation personnelle sur 100 (optionnelle). */
  rating: number | null;
  note: string | null;
  /** Date de dégustation (AAAA-MM-JJ). */
  tastedAt: string;
  createdAt: string;
}

/** Une étape de la chaîne de possession (provenance) d'un objet. */
export interface ProvenanceEntry {
  id: string;
  itemId: string;
  /** Propriétaire à cette étape (précédent ou soi-même). */
  ownerLabel: string | null;
  /** Source d'acquisition : maison de vente, galerie, don, héritage… */
  acquiredFrom: string | null;
  note: string | null;
  /** Date de l'étape (AAAA-MM-JJ), si connue. */
  eventDate: string | null;
  createdAt: string;
}

export type AlertType = 'price_threshold' | 'drink_window' | 'opportunity';

export interface AlertRecord {
  id: string;
  itemId: string;
  type: AlertType;
  config: Record<string, unknown>;
  active: boolean;
}

export type ListingStatus = 'draft' | 'active' | 'sold' | 'withdrawn';

export interface ListingRecord {
  id: string;
  itemId: string;
  sellerId: string;
  askPrice: number;
  currency: string;
  status: ListingStatus;
  /** Titre dénormalisé (copié de l'item) — catalogue sans exposer l'item privé. */
  title: string | null;
  /** Domaine dénormalisé (copié de l'item). */
  domain: VelumDomain | null;
  createdAt: string;
}

/**
 * États de séquestre d'une commande communautaire (§ marketplace Platine).
 * pending_payment → funds_held → shipped → released (heureux) ; branches
 * disputed → released|refunded, et cancelled avant expédition.
 */
export type EscrowState =
  | 'pending_payment'
  | 'funds_held'
  | 'shipped'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

/** Transaction entre collectionneurs, sous séquestre plateforme. */
export interface MarketOrder {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  /** Taux de commission FIGÉ à l'achat (contrat affiché au vendeur). */
  commissionRate: number;
  escrowState: EscrowState;
  carrier: string | null;
  trackingNumber: string | null;
  deliveredAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export type DisputeStatus = 'open' | 'resolved_release' | 'resolved_refund';

export interface DisputeRecord {
  id: string;
  orderId: string;
  openedBy: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Réputation vendeur dérivée (signaux objectifs) — INFORMATIVE. */
export interface SellerReputation {
  completedSales: number;
  refunded: number;
  disputes: number;
  /** Taux de litige 0..1 (litiges / transactions conclues), 0 si aucune. */
  disputeRate: number;
  memberSince: string | null;
}
