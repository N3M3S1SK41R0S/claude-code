/**
 * Mappers snake_case (colonnes Postgres, migration 0001) ↔ camelCase
 * (types @velum/core items.ts). Aucune logique métier ici : uniquement
 * du renommage de clés et des coercitions sûres (numeric → number).
 */
import type {
  AlertRecord,
  AlertType,
  PriceObservation,
  Profile,
  ValuationRecord,
  VelumDomain,
  VelumItem,
} from '@velum/core';

// ── Helpers de coercition ────────────────────────────────────────────────────

/** PostgREST peut sérialiser `numeric` en chaîne selon la config — on coerce. */
function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : toNumber(value);
}

// ── items ────────────────────────────────────────────────────────────────────

/** Ligne brute de la table `items`. */
export interface ItemRow {
  id: string;
  owner_id: string;
  domain: VelumDomain;
  title: string | null;
  attributes: Record<string, unknown>;
  confidence: number | null;
  acquired_at: string | null;
  acquired_price: number | string | null;
  condition: string | null;
  notes: string | null;
  storage_location: string | null;
  created_at: string;
  updated_at: string;
}

/** Champs requis/optionnels pour la création d'un item (repo `items.insert`). */
export interface NewItem {
  ownerId: string;
  domain: VelumDomain;
  /** Id client optionnel (uuid généré hors-ligne) — sinon généré par Postgres. */
  id?: string;
  title?: string | null;
  attributes?: Record<string, unknown>;
  confidence?: number | null;
  acquiredAt?: string | null;
  acquiredPrice?: number | null;
  condition?: string | null;
  notes?: string | null;
  storageLocation?: string | null;
}

export function rowToItem(row: ItemRow): VelumItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    domain: row.domain,
    title: row.title,
    attributes: row.attributes ?? {},
    confidence: toNullableNumber(row.confidence),
    acquiredAt: row.acquired_at,
    acquiredPrice: toNullableNumber(row.acquired_price),
    condition: row.condition,
    notes: row.notes,
    storageLocation: row.storage_location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function itemToRow(item: VelumItem): ItemRow {
  return {
    id: item.id,
    owner_id: item.ownerId,
    domain: item.domain,
    title: item.title,
    attributes: item.attributes,
    confidence: item.confidence,
    acquired_at: item.acquiredAt,
    acquired_price: item.acquiredPrice,
    condition: item.condition,
    notes: item.notes,
    storage_location: item.storageLocation,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

/** Correspondance clé camelCase → colonne snake_case de la table `items`. */
const ITEM_COLUMN_BY_KEY: Record<string, string> = {
  id: 'id',
  ownerId: 'owner_id',
  domain: 'domain',
  title: 'title',
  attributes: 'attributes',
  confidence: 'confidence',
  acquiredAt: 'acquired_at',
  acquiredPrice: 'acquired_price',
  condition: 'condition',
  notes: 'notes',
  storageLocation: 'storage_location',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Convertit un payload camelCase partiel (patch, mutation en file) en ligne
 * partielle snake_case. Les clés inconnues et les valeurs `undefined` sont
 * ignorées — sûr pour rejouer des payloads sérialisés.
 */
export function itemPayloadToRow(payload: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const column = ITEM_COLUMN_BY_KEY[key];
    if (column !== undefined && value !== undefined) row[column] = value;
  }
  return row;
}

/** Patch camelCase de VelumItem → ligne partielle snake_case. */
export function itemPatchToRow(patch: Partial<VelumItem>): Record<string, unknown> {
  return itemPayloadToRow(patch);
}

/** Entrée de création → ligne d'insertion (les champs omis gardent les défauts SQL). */
export function newItemToRow(input: NewItem): Record<string, unknown> {
  return itemPayloadToRow(input as unknown as Record<string, unknown>);
}

// ── valuations ───────────────────────────────────────────────────────────────

/** Ligne brute de la table `valuations`. */
export interface ValuationRow {
  id: string;
  item_id: string;
  central: number | string;
  ci80_low: number | string;
  ci80_high: number | string;
  ci95_low: number | string;
  ci95_high: number | string;
  reliability: number;
  sources: PriceObservation[];
  valued_at: string;
}

export function rowToValuation(row: ValuationRow): ValuationRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    central: toNumber(row.central),
    ci80Low: toNumber(row.ci80_low),
    ci80High: toNumber(row.ci80_high),
    ci95Low: toNumber(row.ci95_low),
    ci95High: toNumber(row.ci95_high),
    reliability: row.reliability,
    sources: row.sources ?? [],
    valuedAt: row.valued_at,
  };
}

// ── alerts ───────────────────────────────────────────────────────────────────

/** Ligne brute de la table `alerts`. */
export interface AlertRow {
  id: string;
  item_id: string;
  type: AlertType;
  config: Record<string, unknown>;
  active: boolean;
}

/** Alerte à créer ou mettre à jour — `id` absent → insertion. */
export type NewAlert = Omit<AlertRecord, 'id'> & { id?: string };

export function rowToAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    config: row.config ?? {},
    active: row.active,
  };
}

export function alertToRow(alert: NewAlert): Record<string, unknown> {
  const row: Record<string, unknown> = {
    item_id: alert.itemId,
    type: alert.type,
    config: alert.config,
    active: alert.active,
  };
  if (alert.id !== undefined) row['id'] = alert.id;
  return row;
}

// ── profiles ─────────────────────────────────────────────────────────────────

/** Ligne brute de la table `profiles` (colonnes exposées au client). */
export interface ProfileRow {
  id: string;
  display_name: string | null;
  locale: string;
  a11y_mode: boolean;
  plan: string;
  created_at: string;
}

/** Patch de profil accepté par `profile.update`. */
export interface ProfilePatch {
  displayName?: string | null;
  locale?: string;
  a11yMode?: boolean;
  /** Jeton de notification push Expo (colonne expo_push_token). */
  expoPushToken?: string | null;
}

const PLAN_TIERS: ReadonlySet<string> = new Set(['free', 'premium', 'gold', 'platine']);

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    locale: row.locale,
    a11yMode: row.a11y_mode,
    // Valeur inattendue (migration en cours…) → repli prudent sur 'free'.
    plan: (PLAN_TIERS.has(row.plan) ? row.plan : 'free') as Profile['plan'],
    createdAt: row.created_at,
  };
}

export function profilePatchToRow(patch: ProfilePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row['display_name'] = patch.displayName;
  if (patch.locale !== undefined) row['locale'] = patch.locale;
  if (patch.a11yMode !== undefined) row['a11y_mode'] = patch.a11yMode;
  if (patch.expoPushToken !== undefined) row['expo_push_token'] = patch.expoPushToken;
  return row;
}
