/**
 * Mappers snake_case (colonnes Postgres, migration 0001) ↔ camelCase
 * (types @velum/core items.ts). Aucune logique métier ici : uniquement
 * du renommage de clés et des coercitions sûres (numeric → number).
 */
import type {
  AlertRecord,
  AlertType,
  CatalogueListing,
  CatalogueQuery,
  CertificationFeePayer,
  CertificationReason,
  CertificationRequest,
  CertificationStatus,
  DisputeRecord,
  DisputeStatus,
  EscrowState,
  ExchangeProposal,
  ExchangeState,
  ListingKind,
  ListingRecord,
  ListingStatus,
  MarketMessage,
  MarketOrder,
  MarketThreadKind,
  Profile,
  PriceObservation,
  ProvenanceEntry,
  SellerReputation,
  TastingNote,
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

// ── tasting_notes ─────────────────────────────────────────────────────────────

export interface TastingNoteRow {
  id: string;
  item_id: string;
  rating: number | string | null;
  note: string | null;
  tasted_at: string;
  created_at: string;
}

export interface NewTastingNote {
  itemId: string;
  rating?: number | null;
  note?: string | null;
  tastedAt?: string;
}

export function rowToTastingNote(row: TastingNoteRow): TastingNote {
  return {
    id: row.id,
    itemId: row.item_id,
    rating: toNullableNumber(row.rating),
    note: row.note,
    tastedAt: row.tasted_at,
    createdAt: row.created_at,
  };
}

export function newTastingNoteToRow(input: NewTastingNote): Record<string, unknown> {
  const row: Record<string, unknown> = { item_id: input.itemId };
  if (input.rating !== undefined) row['rating'] = input.rating;
  if (input.note !== undefined) row['note'] = input.note;
  if (input.tastedAt !== undefined) row['tasted_at'] = input.tastedAt;
  return row;
}

// ── provenance_entries ────────────────────────────────────────────────────────

export interface ProvenanceRow {
  id: string;
  item_id: string;
  owner_label: string | null;
  acquired_from: string | null;
  note: string | null;
  event_date: string | null;
  created_at: string;
}

export interface NewProvenanceEntry {
  itemId: string;
  ownerLabel?: string | null;
  acquiredFrom?: string | null;
  note?: string | null;
  eventDate?: string | null;
}

export function rowToProvenance(row: ProvenanceRow): ProvenanceEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    ownerLabel: row.owner_label,
    acquiredFrom: row.acquired_from,
    note: row.note,
    eventDate: row.event_date,
    createdAt: row.created_at,
  };
}

export function newProvenanceToRow(input: NewProvenanceEntry): Record<string, unknown> {
  const row: Record<string, unknown> = { item_id: input.itemId };
  if (input.ownerLabel !== undefined) row['owner_label'] = input.ownerLabel;
  if (input.acquiredFrom !== undefined) row['acquired_from'] = input.acquiredFrom;
  if (input.note !== undefined) row['note'] = input.note;
  if (input.eventDate !== undefined) row['event_date'] = input.eventDate;
  return row;
}

// ── marketplace : listings / orders / disputes / réputation ───────────────────

export interface ListingRow {
  id: string;
  /** null si l'objet a été supprimé depuis (annonce détachée, historique conservé). */
  item_id: string | null;
  seller_id: string;
  ask_price: number | string;
  currency: string;
  status: ListingStatus;
  title: string | null;
  domain: VelumDomain | null;
  commission_rate: number | string;
  expert_appraisal_required: boolean;
  expert_appraisal_ref: string | null;
  created_at: string;
  /** Colonnes « plateformes par catégorie » — absentes des schémas antérieurs. */
  kind?: ListingKind | null;
  description?: string | null;
  exchange_wishes?: string | null;
}

export interface NewListing {
  itemId: string;
  /** Prix demandé (vente) ou valeur déclarée (échange). */
  askPrice: number;
  currency?: string;
  /** Défaut : 'sale'. */
  kind?: ListingKind;
  description?: string;
  exchangeWishes?: string;
}

/** `itemId` vaut '' pour une annonce détachée de son objet (objet supprimé). */
export function rowToListing(row: ListingRow): ListingRecord {
  return {
    id: row.id,
    itemId: row.item_id ?? '',
    sellerId: row.seller_id,
    askPrice: toNumber(row.ask_price),
    currency: row.currency,
    status: row.status,
    title: row.title ?? null,
    domain: row.domain ?? null,
    kind: row.kind ?? 'sale',
    description: row.description ?? null,
    exchangeWishes: row.exchange_wishes ?? null,
    commissionRate: toNumber(row.commission_rate),
    certificationRequired: row.expert_appraisal_required === true,
    certified: row.expert_appraisal_ref !== null && row.expert_appraisal_ref !== undefined,
    createdAt: row.created_at,
  };
}

export function newListingToRow(input: NewListing, sellerId: string): Record<string, unknown> {
  return {
    item_id: input.itemId,
    seller_id: sellerId,
    ask_price: input.askPrice,
    currency: input.currency ?? 'EUR',
    kind: input.kind ?? 'sale',
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.exchangeWishes !== undefined ? { exchange_wishes: input.exchangeWishes } : {}),
  };
}

export interface OrderRow {
  id: string;
  listing_id: string;
  /**
   * Identifiants des parties. La vue anonymisée `my_market_orders()` ne
   * renseigne QUE celui de l'utilisateur courant (null pour l'autre partie).
   */
  buyer_id: string | null;
  seller_id: string | null;
  amount: number | string;
  currency: string;
  commission_rate: number | string;
  escrow_state: EscrowState;
  carrier: string | null;
  tracking_number: string | null;
  delivered_at: string | null;
  released_at: string | null;
  created_at: string;
  /** Colonnes de la vue anonymisée des commandes (absentes de la table brute). */
  role?: 'buyer' | 'seller' | null;
  counterparty_alias?: string | null;
  listing_title?: string | null;
  listing_domain?: VelumDomain | null;
  certification_required?: boolean | null;
}

/** Pseudonyme affiché quand le serveur n'en fournit pas (schéma antérieur). */
export const FALLBACK_MEMBER_ALIAS = 'Membre VELUM';

/**
 * Rôle : celui calculé par le serveur (vue anonymisée) ; à défaut, déduit de
 * `viewerId` (uid courant), « acheteur » sans lui (compatibilité).
 * L'identifiant de l'autre partie, masqué par le serveur, vaut ''.
 */
export function rowToOrder(row: OrderRow, viewerId?: string): MarketOrder {
  const role: MarketOrder['role'] =
    row.role === 'buyer' || row.role === 'seller'
      ? row.role
      : viewerId !== undefined && viewerId === row.seller_id
        ? 'seller'
        : 'buyer';
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id ?? '',
    sellerId: row.seller_id ?? '',
    amount: toNumber(row.amount),
    currency: row.currency,
    commissionRate: toNumber(row.commission_rate),
    escrowState: row.escrow_state,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    deliveredAt: row.delivered_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    role,
    counterpartyAlias: row.counterparty_alias ?? FALLBACK_MEMBER_ALIAS,
    listingTitle: row.listing_title ?? null,
    certificationRequired: row.certification_required === true,
  };
}

export interface DisputeRow {
  id: string;
  order_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function rowToDispute(row: DisputeRow): DisputeRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    openedBy: row.opened_by,
    reason: row.reason,
    status: row.status,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/** Parse le jsonb renvoyé par `seller_reputation()` en type sûr. */
export function jsonToReputation(json: Record<string, unknown> | null): SellerReputation {
  const j = json ?? {};
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  return {
    completedSales: num(j['completedSales']),
    refunded: num(j['refunded']),
    disputes: num(j['disputes']),
    disputeRate: num(j['disputeRate']),
    memberSince: typeof j['memberSince'] === 'string' ? (j['memberSince'] as string) : null,
  };
}

// ── plateformes par catégorie : vues ANONYMISÉES des RPC ──────────────────────
// Lignes renvoyées par les fonctions SQL (migration 20261023100300_market_rpcs) :
// jamais d'identifiant de membre ni d'objet d'autrui, uniquement des pseudonymes.

/** Ligne de `market_catalogue()`. */
export interface CatalogueRow {
  id: string;
  kind: ListingKind | null;
  domain: VelumDomain | null;
  title: string | null;
  description: string | null;
  ask_price: number | string;
  currency: string | null;
  exchange_wishes: string | null;
  seller_alias: string | null;
  certified: boolean | null;
  /** Certification exigée (seuil) — sert l'API dépréciée browseActive(). */
  certification_required?: boolean | null;
  is_mine: boolean | null;
  created_at: string;
}

export function rowToCatalogueListing(row: CatalogueRow): CatalogueListing {
  return {
    id: row.id,
    kind: row.kind ?? 'sale',
    domain: row.domain ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    askPrice: toNumber(row.ask_price),
    currency: row.currency ?? 'EUR',
    exchangeWishes: row.exchange_wishes ?? null,
    sellerAlias: row.seller_alias ?? FALLBACK_MEMBER_ALIAS,
    certified: row.certified === true,
    isMine: row.is_mine === true,
    createdAt: row.created_at,
  };
}

/**
 * Projection d'une ligne du catalogue vers l'ancien `ListingRecord`
 * (API dépréciée `browseActive`). Les identifiants du vendeur et de l'objet ne
 * sont plus exposés (''), le taux de commission d'autrui non plus (0).
 */
export function catalogueRowToListing(row: CatalogueRow): ListingRecord {
  return {
    id: row.id,
    itemId: '',
    sellerId: '',
    askPrice: toNumber(row.ask_price),
    currency: row.currency ?? 'EUR',
    status: 'active',
    title: row.title ?? null,
    domain: row.domain ?? null,
    kind: row.kind ?? 'sale',
    description: row.description ?? null,
    exchangeWishes: row.exchange_wishes ?? null,
    commissionRate: 0,
    certificationRequired: row.certification_required === true,
    certified: row.certified === true,
    createdAt: row.created_at,
  };
}

/** Nombre fini, ou null (filtres optionnels). */
function finiteOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Arguments nommés de la RPC `market_catalogue` (null = filtre absent). */
export function catalogueQueryToArgs(query: CatalogueQuery = {}): Record<string, unknown> {
  const text = query.text?.trim() ?? '';
  const limit = finiteOrNull(query.limit);
  return {
    p_domain: query.domain ?? null,
    p_mode: query.mode ?? null,
    p_text: text === '' ? null : text,
    p_min_price: finiteOrNull(query.minPrice),
    p_max_price: finiteOrNull(query.maxPrice),
    p_certified_only: query.certifiedOnly === true,
    p_include_mine: query.includeMine === true,
    p_sort: query.sort ?? 'recent',
    // Borné côté serveur (1..100, défaut 50).
    p_limit: limit === null ? null : Math.trunc(limit),
  };
}

/** Ligne de `my_exchanges()` (et des RPC d'action sur les échanges). */
export interface ExchangeRow {
  id: string;
  listing_id: string;
  role: 'proposer' | 'recipient';
  counterparty_alias: string | null;
  listing_title: string | null;
  listing_domain: VelumDomain | null;
  listing_value: number | string;
  offered_title: string | null;
  offered_domain: VelumDomain | null;
  offered_value: number | string;
  cash_adjustment: number | string | null;
  currency: string | null;
  message: string | null;
  state: ExchangeState;
  my_commission: number | string | null;
  certification_required: boolean | null;
  proposer_tracking: string | null;
  recipient_tracking: string | null;
  proposer_received: boolean | null;
  recipient_received: boolean | null;
  /** Échéance d'une proposition sans réponse (non exposée par le contrat core). */
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToExchangeProposal(row: ExchangeRow): ExchangeProposal {
  return {
    id: row.id,
    listingId: row.listing_id,
    role: row.role === 'recipient' ? 'recipient' : 'proposer',
    counterpartyAlias: row.counterparty_alias ?? FALLBACK_MEMBER_ALIAS,
    listingTitle: row.listing_title ?? null,
    listingDomain: row.listing_domain ?? null,
    listingValue: toNumber(row.listing_value),
    offeredTitle: row.offered_title ?? null,
    offeredDomain: row.offered_domain ?? null,
    offeredValue: toNumber(row.offered_value),
    cashAdjustment: row.cash_adjustment === null ? 0 : toNumber(row.cash_adjustment),
    currency: row.currency ?? 'EUR',
    message: row.message ?? null,
    state: row.state,
    myCommission: toNullableNumber(row.my_commission),
    certificationRequired: row.certification_required === true,
    proposerTracking: row.proposer_tracking ?? null,
    recipientTracking: row.recipient_tracking ?? null,
    proposerReceived: row.proposer_received === true,
    recipientReceived: row.recipient_received === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Ligne de `my_certifications()` (et des RPC d'action sur les certifications). */
export interface CertificationRow {
  id: string;
  listing_id: string | null;
  order_id: string | null;
  exchange_id: string | null;
  item_title: string | null;
  domain: VelumDomain | null;
  reason: CertificationReason;
  status: CertificationStatus;
  fee_payer: CertificationFeePayer;
  fee_amount: number | string | null;
  requested_by_me: boolean | null;
  counterparty_agreed: boolean | null;
  report_ref: string | null;
  expert_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export function rowToCertificationRequest(row: CertificationRow): CertificationRequest {
  return {
    id: row.id,
    listingId: row.listing_id ?? null,
    orderId: row.order_id ?? null,
    exchangeId: row.exchange_id ?? null,
    itemTitle: row.item_title ?? null,
    domain: row.domain ?? null,
    reason: row.reason,
    status: row.status,
    feePayer: row.fee_payer,
    feeAmount: toNullableNumber(row.fee_amount),
    requestedByMe: row.requested_by_me === true,
    counterpartyAgreed: row.counterparty_agreed === true,
    reportRef: row.report_ref ?? null,
    expertNote: row.expert_note ?? null,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? null,
  };
}

/** Ligne de `thread_messages()` / `send_market_message()`. */
export interface MarketMessageRow {
  id: string;
  thread_kind: MarketThreadKind;
  thread_id: string;
  mine: boolean | null;
  author_alias: string | null;
  body: string;
  redacted: boolean | null;
  created_at: string;
}

export function rowToMarketMessage(row: MarketMessageRow): MarketMessage {
  return {
    id: row.id,
    threadKind: row.thread_kind,
    threadId: row.thread_id,
    mine: row.mine === true,
    authorAlias: row.author_alias ?? FALLBACK_MEMBER_ALIAS,
    body: row.body,
    redacted: row.redacted === true,
    createdAt: row.created_at,
  };
}

/** Synthèse du commissionnement de l'utilisateur courant (`my_commission_summary()`). */
export interface CommissionSummary {
  currency: string;
  /** Taux dégressif actuel (appliqué aux prochaines annonces / acceptations). */
  currentRate: number;
  /** Ventes conclues (palier du taux). */
  completedSales: number;
  /** Totaux du registre de la plateforme (EUR). */
  commissions: number;
  certificationFees: number;
  payouts: number;
  /** Nombre d'écritures au registre. */
  entries: number;
}

/** Parse le jsonb de `my_commission_summary()` (défensif : jsonb = unknown). */
export function jsonToCommissionSummary(json: unknown): CommissionSummary {
  const j: Record<string, unknown> =
    json !== null && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    currency: typeof j['currency'] === 'string' ? (j['currency'] as string) : 'EUR',
    currentRate: num(j['currentRate']),
    completedSales: num(j['completedSales']),
    commissions: num(j['commissions']),
    certificationFees: num(j['certificationFees']),
    payouts: num(j['payouts']),
    entries: num(j['entries']),
  };
}
