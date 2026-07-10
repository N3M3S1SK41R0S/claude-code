/** Miroirs TypeScript du schéma Postgres (§8.1) — camelCase côté app. */
import type { MediaRole, VelumDomain } from './domain';
import type { PriceObservation } from './pricing';

export interface Profile {
  id: string;
  displayName: string | null;
  locale: string;
  /** Mode senior : gros boutons, contraste renforcé, police majorée (§11.2). */
  a11yMode: boolean;
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
  createdAt: string;
}
