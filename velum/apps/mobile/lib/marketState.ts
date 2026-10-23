/**
 * Plateformes d'échange et de vente — logique PURE des états (testée sans
 * React Native) : libellés i18n, tonalités de badge, actions LÉGALES selon le
 * rôle × l'état, frise d'un échange, compteurs « à traiter ».
 *
 * Miroir de la machine serveur : commandes (trigger `enforce_escrow_transition`,
 * migration 0006) et échanges / certifications (`@velum/core` market.ts). Le
 * serveur reste l'arbitre : l'UI ne fait que PROPOSER les actions légales ;
 * une transition refusée côté serveur remonte en erreur lisible.
 */
import {
  isVelumError,
  type CertificationFeePayer,
  type CertificationReason,
  type CertificationRequest,
  type CertificationStatus,
  type EscrowState,
  type ExchangeProposal,
  type ExchangeState,
  type ListingKind,
  type ListingStatus,
  type MarketOrder,
} from '@velum/core';

/** Tonalités de badge (structurellement identiques à `VBadgeTone` de @velum/ui). */
export type MarketTone = 'gold' | 'success' | 'warning' | 'danger' | 'neutral';

// ── Libellés et tonalités ────────────────────────────────────────────────────

export const ESCROW_TONE: Record<EscrowState, MarketTone> = {
  pending_payment: 'warning',
  funds_held: 'gold',
  shipped: 'gold',
  released: 'success',
  refunded: 'neutral',
  disputed: 'danger',
  cancelled: 'neutral',
};

export const EXCHANGE_TONE: Record<ExchangeState, MarketTone> = {
  proposed: 'warning',
  accepted: 'gold',
  declined: 'neutral',
  withdrawn: 'neutral',
  expired: 'neutral',
  awaiting_certification: 'warning',
  shipping: 'gold',
  completed: 'success',
  disputed: 'danger',
  cancelled: 'neutral',
};

export const CERTIFICATION_TONE: Record<CertificationStatus, MarketTone> = {
  awaiting_agreement: 'warning',
  requested: 'gold',
  in_review: 'gold',
  certified: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

export const LISTING_STATUS_TONE: Record<ListingStatus, MarketTone> = {
  draft: 'neutral',
  pending_certification: 'warning',
  active: 'success',
  sold: 'gold',
  exchanged: 'gold',
  withdrawn: 'neutral',
};

export const LISTING_KIND_TONE: Record<ListingKind, MarketTone> = {
  sale: 'gold',
  exchange: 'neutral',
  sale_or_exchange: 'gold',
};

/** Clés i18n (namespace `community`). */
export const marketLabelKeys = {
  escrow: (state: EscrowState) => `community.state.${state}`,
  exchange: (state: ExchangeState) => `community.exchangeState.${state}`,
  certification: (status: CertificationStatus) => `community.certStatus.${status}`,
  certificationReason: (reason: CertificationReason) => `community.certReason.${reason}`,
  feePayer: (payer: CertificationFeePayer) => `community.feePayer.${payer}`,
  listingStatus: (status: ListingStatus) => `community.listingStatus.${status}`,
  listingKind: (kind: ListingKind) => `community.kind.${kind}`,
} as const;

/** true si l'annonce porte un prix de VENTE (sinon : valeur déclarée d'échange). */
export function isForSale(kind: ListingKind): boolean {
  return kind === 'sale' || kind === 'sale_or_exchange';
}

/** true si l'annonce est ouverte aux propositions d'échange. */
export function isOpenToExchange(kind: ListingKind): boolean {
  return kind === 'exchange' || kind === 'sale_or_exchange';
}

// ── Commandes (séquestre) ────────────────────────────────────────────────────

export type MarketRole = MarketOrder['role'];
export type OrderAction = 'pay' | 'ship' | 'confirm_receipt' | 'dispute' | 'cancel';

interface OrderRule {
  from: EscrowState;
  action: OrderAction;
  to: EscrowState;
  actors: readonly MarketRole[];
}

/**
 * Transitions LÉGALES par acteur — miroir exact de `enforce_escrow_transition`
 * (migration 0006), hors transitions « système » (arbitrage, auto-libération).
 * L'ordre fixe la priorité d'affichage (action principale d'abord).
 */
const ORDER_RULES: readonly OrderRule[] = [
  { from: 'pending_payment', action: 'pay', to: 'funds_held', actors: ['buyer'] },
  { from: 'pending_payment', action: 'cancel', to: 'cancelled', actors: ['buyer', 'seller'] },
  { from: 'funds_held', action: 'ship', to: 'shipped', actors: ['seller'] },
  { from: 'funds_held', action: 'dispute', to: 'disputed', actors: ['buyer'] },
  { from: 'funds_held', action: 'cancel', to: 'cancelled', actors: ['buyer', 'seller'] },
  { from: 'shipped', action: 'confirm_receipt', to: 'released', actors: ['buyer'] },
  { from: 'shipped', action: 'dispute', to: 'disputed', actors: ['buyer'] },
];

/** Actions proposées à l'utilisateur courant pour une commande. */
export function orderActions(order: Pick<MarketOrder, 'role' | 'escrowState'>): OrderAction[] {
  return ORDER_RULES.filter(
    (rule) => rule.from === order.escrowState && rule.actors.includes(order.role),
  ).map((rule) => rule.action);
}

/** État visé par une action depuis un état donné (null si illégale). */
export function orderActionTarget(from: EscrowState, action: OrderAction): EscrowState | null {
  return ORDER_RULES.find((rule) => rule.from === from && rule.action === action)?.to ?? null;
}

/** true si `role` peut faire passer la commande de `from` à `to`. */
export function canTransitionOrder(role: MarketRole, from: EscrowState, to: EscrowState): boolean {
  return ORDER_RULES.some((rule) => rule.from === from && rule.to === to && rule.actors.includes(role));
}

/** Actions « principales » (qui font avancer la transaction), par opposition à litige/annulation. */
export const PRIMARY_ORDER_ACTIONS: ReadonlySet<OrderAction> = new Set(['pay', 'ship', 'confirm_receipt']);

/** Nombre de ventes CONCLUES de l'utilisateur (base du taux dégressif). */
export function completedSalesCount(
  orders: readonly Pick<MarketOrder, 'role' | 'escrowState'>[],
): number {
  return orders.filter((o) => o.role === 'seller' && o.escrowState === 'released').length;
}

// ── Échanges ─────────────────────────────────────────────────────────────────

export type ExchangeAction =
  | 'accept'
  | 'decline'
  | 'withdraw'
  | 'ship'
  | 'confirm_receipt'
  | 'dispute'
  | 'cancel';

type ExchangeView = Pick<
  ExchangeProposal,
  | 'role'
  | 'state'
  | 'certificationRequired'
  | 'proposerTracking'
  | 'recipientTracking'
  | 'proposerReceived'
  | 'recipientReceived'
>;

/** Mon numéro de suivi (null si je n'ai pas encore expédié). */
export function myTracking(ex: Pick<ExchangeProposal, 'role' | 'proposerTracking' | 'recipientTracking'>): string | null {
  return ex.role === 'proposer' ? ex.proposerTracking : ex.recipientTracking;
}

/** Numéro de suivi de l'autre partie. */
export function theirTracking(ex: Pick<ExchangeProposal, 'role' | 'proposerTracking' | 'recipientTracking'>): string | null {
  return ex.role === 'proposer' ? ex.recipientTracking : ex.proposerTracking;
}

/** true si j'ai confirmé la réception de l'objet de l'autre partie. */
export function myReceived(ex: Pick<ExchangeProposal, 'role' | 'proposerReceived' | 'recipientReceived'>): boolean {
  return ex.role === 'proposer' ? ex.proposerReceived : ex.recipientReceived;
}

/** true si l'autre partie a confirmé la réception de MON objet. */
export function theirReceived(ex: Pick<ExchangeProposal, 'role' | 'proposerReceived' | 'recipientReceived'>): boolean {
  return ex.role === 'proposer' ? ex.recipientReceived : ex.proposerReceived;
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

/**
 * Actions légales sur un échange pour l'utilisateur courant (rôle × état) :
 *  - proposed : le destinataire accepte/refuse, l'auteur peut retirer ;
 *  - accepted : expédier (si aucune expertise n'est exigée) ou annuler ;
 *  - awaiting_certification : annuler seulement (expédition après l'expert) ;
 *  - shipping : expédier mon objet, confirmer la réception de celui de l'autre
 *    (une fois qu'il l'a expédié) ; litige dès qu'un envoi a eu lieu, sinon
 *    annulation (« avant toute expédition ») ;
 *  - états terminaux et litige (arbitrage plateforme) : aucune action.
 */
export function exchangeActions(ex: ExchangeView): ExchangeAction[] {
  const mine = hasText(myTracking(ex));
  const theirs = hasText(theirTracking(ex));
  switch (ex.state) {
    case 'proposed':
      return ex.role === 'recipient' ? ['accept', 'decline'] : ['withdraw'];
    case 'accepted':
      return !ex.certificationRequired && !mine ? ['ship', 'cancel'] : ['cancel'];
    case 'awaiting_certification':
      return ['cancel'];
    case 'shipping': {
      const actions: ExchangeAction[] = [];
      if (!mine) actions.push('ship');
      if (theirs && !myReceived(ex)) actions.push('confirm_receipt');
      actions.push(mine || theirs ? 'dispute' : 'cancel');
      return actions;
    }
    default:
      return [];
  }
}

export const PRIMARY_EXCHANGE_ACTIONS: ReadonlySet<ExchangeAction> = new Set([
  'accept',
  'ship',
  'confirm_receipt',
]);

/** Montant que JE verse (> 0) ou reçois (< 0) au titre de la soulte. */
export function myCashPayment(ex: Pick<ExchangeProposal, 'role' | 'cashAdjustment'>): number {
  return ex.role === 'proposer' ? ex.cashAdjustment : -ex.cashAdjustment;
}

/** Valeur déclarée de l'objet que JE cède (base de ma commission). */
export function myCededValue(ex: Pick<ExchangeProposal, 'role' | 'offeredValue' | 'listingValue'>): number {
  return ex.role === 'proposer' ? ex.offeredValue : ex.listingValue;
}

export type TimelineStepStatus = 'done' | 'current' | 'upcoming' | 'skipped';

export interface TimelineStep {
  state: ExchangeState;
  status: TimelineStepStatus;
}

export interface ExchangeTimeline {
  steps: TimelineStep[];
  /** Issue hors du chemin nominal (refus, retrait, expiration, annulation, litige). */
  outcome: ExchangeState | null;
}

const OFF_PATH: ReadonlySet<ExchangeState> = new Set([
  'declined',
  'withdrawn',
  'expired',
  'cancelled',
  'disputed',
]);

/**
 * Frise d'un échange : chemin nominal proposed → accepted →
 * (awaiting_certification si expertise) → shipping → completed. Une issue hors
 * chemin marque les étapes atteintes « faites » et les suivantes « sautées ».
 */
export function exchangeTimeline(
  ex: Pick<ExchangeProposal, 'state' | 'certificationRequired' | 'proposerTracking' | 'recipientTracking'>,
): ExchangeTimeline {
  const path: ExchangeState[] = ['proposed', 'accepted'];
  if (ex.certificationRequired || ex.state === 'awaiting_certification') {
    path.push('awaiting_certification');
  }
  path.push('shipping', 'completed');

  if (!OFF_PATH.has(ex.state)) {
    const at = path.indexOf(ex.state);
    return {
      steps: path.map((state, index) => ({
        state,
        status:
          index < at || (index === at && state === 'completed')
            ? 'done'
            : index === at
              ? 'current'
              : 'upcoming',
      })),
      outcome: null,
    };
  }

  // Dernière étape nominale atteinte avant l'issue.
  const shipped = hasText(ex.proposerTracking) || hasText(ex.recipientTracking);
  let reached: ExchangeState;
  if (ex.state === 'declined' || ex.state === 'withdrawn' || ex.state === 'expired') {
    reached = 'proposed';
  } else if (ex.state === 'disputed' || shipped) {
    reached = 'shipping';
  } else {
    reached = 'accepted';
  }
  const last = path.indexOf(reached);
  return {
    steps: path.map((state, index) => ({ state, status: index <= last ? 'done' : 'skipped' })),
    outcome: ex.state,
  };
}

// ── Certifications ───────────────────────────────────────────────────────────

export type CertificationAction = 'agree' | 'refuse' | 'cancel';

/**
 * Actions sur une demande de certification : l'autre partie accepte/refuse
 * une demande d'accord mutuel ; l'auteur peut annuler tant que l'expert n'a
 * pas rendu sa décision.
 */
export function certificationActions(
  c: Pick<CertificationRequest, 'status' | 'requestedByMe'>,
): CertificationAction[] {
  switch (c.status) {
    case 'awaiting_agreement':
      return c.requestedByMe ? ['cancel'] : ['agree', 'refuse'];
    case 'requested':
    case 'in_review':
      return c.requestedByMe ? ['cancel'] : [];
    default:
      return [];
  }
}

// ── Annonces ─────────────────────────────────────────────────────────────────

/** Commande qui réserve l'annonce (paiement capturé) ou l'a conclue. */
const ORDER_HOLDS_LISTING: ReadonlySet<EscrowState> = new Set(['funds_held', 'shipped', 'disputed', 'released']);
/** Échange qui réserve l'annonce (accepté, en cours) ou l'a conclue. */
const EXCHANGE_HOLDS_LISTING: ReadonlySet<ExchangeState> = new Set([
  'accepted',
  'awaiting_certification',
  'shipping',
  'disputed',
  'completed',
]);

export interface ListingAvailability {
  canBuy: boolean;
  canPropose: boolean;
  /** Ma transaction en cours ou conclue sur cette annonce (lien vers elle), sinon null. */
  mine: { kind: 'order' | 'exchange'; id: string } | null;
}

/**
 * Actions sur l'annonce d'AUTRUI d'après MES transactions — miroir des refus
 * serveur : annonce réservée (listing_is_engaged) ou conclue → plus rien ;
 * une seule commande non payée par acheteur (orders_one_pending_per_buyer)
 * et une seule proposition en attente par membre (exchange_proposals_one_pending).
 * Une annonce retrouvée hors catalogue pour une transaction à laquelle je ne
 * participe pas n'est pas connue ici : le serveur reste l'arbitre.
 */
export function listingAvailability(
  listing: { id: string; kind: ListingKind; isMine: boolean },
  orders: readonly Pick<MarketOrder, 'id' | 'listingId' | 'role' | 'escrowState'>[],
  exchanges: readonly Pick<ExchangeProposal, 'id' | 'listingId' | 'role' | 'state'>[],
): ListingAvailability {
  if (listing.isMine) return { canBuy: false, canPropose: false, mine: null };
  const myOrders = orders.filter((o) => o.listingId === listing.id && o.role === 'buyer');
  const myProposals = exchanges.filter((e) => e.listingId === listing.id && e.role === 'proposer');
  const holdingOrder = myOrders.find((o) => ORDER_HOLDS_LISTING.has(o.escrowState));
  const holdingExchange = myProposals.find((e) => EXCHANGE_HOLDS_LISTING.has(e.state));
  const unpaid = myOrders.find((o) => o.escrowState === 'pending_payment');
  const pending = myProposals.find((e) => e.state === 'proposed');
  const held = holdingOrder !== undefined || holdingExchange !== undefined;
  const mine = holdingOrder
    ? { kind: 'order' as const, id: holdingOrder.id }
    : holdingExchange
      ? { kind: 'exchange' as const, id: holdingExchange.id }
      : unpaid
        ? { kind: 'order' as const, id: unpaid.id }
        : pending
          ? { kind: 'exchange' as const, id: pending.id }
          : null;
  return {
    canBuy: isForSale(listing.kind) && !held && unpaid === undefined,
    canPropose: isOpenToExchange(listing.kind) && !held && pending === undefined,
    mine,
  };
}

/** Une annonce peut être retirée tant qu'elle n'est pas vendue / échangée. */
export function canWithdrawListing(status: ListingStatus): boolean {
  return status === 'draft' || status === 'pending_certification' || status === 'active';
}

// ── Compteur « à traiter » ───────────────────────────────────────────────────

/** Nombre d'éléments qui attendent une action de MA part (badge « Mon activité »). */
export function pendingActionCount(input: {
  orders?: readonly Pick<MarketOrder, 'role' | 'escrowState'>[];
  exchanges?: readonly ExchangeView[];
  certifications?: readonly Pick<CertificationRequest, 'status' | 'requestedByMe'>[];
}): number {
  const orders = (input.orders ?? []).filter(orderNeedsMe).length;
  const exchanges = (input.exchanges ?? []).filter(exchangeNeedsMe).length;
  const certifications = (input.certifications ?? []).filter(certificationNeedsMe).length;
  return orders + exchanges + certifications;
}

// ── Erreurs ──────────────────────────────────────────────────────────────────

/**
 * true si l'erreur signale une fonction serveur PAS ENCORE câblée (dépôt
 * MarketplaceRepo : VelumError SOURCE_UNAVAILABLE « pas encore disponible »).
 * Permet un message honnête (« bientôt disponible ») plutôt qu'une panne.
 */
export function isNotYetAvailable(error: unknown): boolean {
  return (
    isVelumError(error) &&
    error.code === 'SOURCE_UNAVAILABLE' &&
    /pas encore disponible/i.test(error.message)
  );
}

/**
 * Politique de relance des lectures React Query : inutile d'insister (et de
 * faire patienter) sur une fonction serveur pas encore câblée ; 2 relances
 * sinon (défaut de l'app).
 */
export function marketRetry(failureCount: number, error: unknown): boolean {
  return !isNotYetAvailable(error) && failureCount < 2;
}

// ── Historique (éléments clos) ───────────────────────────────────────────────

const CLOSED_ESCROW: ReadonlySet<EscrowState> = new Set(['released', 'refunded', 'cancelled']);
const CLOSED_EXCHANGE: ReadonlySet<ExchangeState> = new Set([
  'declined',
  'withdrawn',
  'expired',
  'completed',
  'cancelled',
]);
const CLOSED_CERTIFICATION: ReadonlySet<CertificationStatus> = new Set(['certified', 'rejected', 'cancelled']);
const CLOSED_LISTING: ReadonlySet<ListingStatus> = new Set(['sold', 'exchanged', 'withdrawn']);

export const isClosed = {
  order: (o: Pick<MarketOrder, 'escrowState'>) => CLOSED_ESCROW.has(o.escrowState),
  exchange: (e: Pick<ExchangeProposal, 'state'>) => CLOSED_EXCHANGE.has(e.state),
  certification: (c: Pick<CertificationRequest, 'status'>) => CLOSED_CERTIFICATION.has(c.status),
  listing: (l: { status: ListingStatus }) => CLOSED_LISTING.has(l.status),
} as const;

/**
 * Sépare les éléments EN COURS (ceux qui attendent mon action d'abord, ordre
 * conservé sinon) de l'HISTORIQUE (éléments clos) — moins de défilement.
 */
export function partitionActivity<T>(
  entries: readonly T[],
  closed: (entry: T) => boolean,
  needsMe: (entry: T) => boolean = () => false,
): { current: T[]; history: T[] } {
  const current = entries.filter((e) => !closed(e));
  return {
    current: [...current.filter(needsMe), ...current.filter((e) => !needsMe(e))],
    history: entries.filter(closed),
  };
}

/** true si la commande attend une action principale de ma part. */
export function orderNeedsMe(o: Pick<MarketOrder, 'role' | 'escrowState'>): boolean {
  return orderActions(o).some((a) => PRIMARY_ORDER_ACTIONS.has(a));
}

/** true si l'échange attend une action principale de ma part. */
export function exchangeNeedsMe(e: ExchangeView): boolean {
  return exchangeActions(e).some((a) => PRIMARY_EXCHANGE_ACTIONS.has(a));
}

/** true si la certification attend MON accord. */
export function certificationNeedsMe(c: Pick<CertificationRequest, 'status' | 'requestedByMe'>): boolean {
  return certificationActions(c).includes('agree');
}
