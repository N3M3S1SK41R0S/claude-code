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
import { redactContactInfo } from '@velum/config';
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
  type ListingRecord,
  type ListingStatus,
  type MarketOrder,
  type VelumItem,
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

/** Contexte d'une transaction connu de l'interface (certifications, horloge). */
export interface ActionContext {
  /**
   * Une expertise est ouverte sur la transaction (accord attendu, demandée,
   * en cours) : le serveur bloque l'expédition (has_open_certification).
   */
  hasOpenCertification?: boolean;
  /** Horloge (ISO) : une proposition échue ne s'accepte plus. */
  now?: string;
}

/** Actions proposées à l'utilisateur courant pour une commande. */
export function orderActions(
  order: Pick<MarketOrder, 'role' | 'escrowState'>,
  context: ActionContext = {},
): OrderAction[] {
  return ORDER_RULES.filter(
    (rule) =>
      rule.from === order.escrowState &&
      rule.actors.includes(order.role) &&
      !(rule.action === 'ship' && context.hasOpenCertification === true),
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

/**
 * Nombre de ventes CONCLUES de l'utilisateur (fonds libérés), à titre
 * informatif : le palier de commission compte les ventes RETENUES (≥ 20 €,
 * 3 par acheteur) et se lit du serveur (lib/marketCommission).
 */
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
> & {
  /** Échéance d'une proposition (ExchangeProposal.expiresAt), si le dépôt la fournit. */
  expiresAt?: string | null;
};

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
 * Durée de validité d'une proposition sans réponse, en jours — réplique de
 * exchange_proposal_ttl_days() (migration 20261023100100, relue par les tests).
 */
export const EXCHANGE_PROPOSAL_TTL_DAYS = 7;

/**
 * true si la proposition `proposed` est ÉCHUE à `now` (échéance atteinte,
 * avant même le passage du cron qui la passe en « expirée ») : elle ne
 * s'accepte plus (« Proposition expirée » côté serveur). Échéance inconnue
 * ou illisible : false (le serveur tranche).
 */
export function isExchangeExpired(
  ex: Pick<ExchangeView, 'state' | 'expiresAt'>,
  now: string | undefined,
): boolean {
  if (ex.state !== 'proposed' || now === undefined || typeof ex.expiresAt !== 'string') return false;
  const expires = Date.parse(ex.expiresAt);
  const at = Date.parse(now);
  return Number.isFinite(expires) && Number.isFinite(at) && expires <= at;
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
 * Contexte : pas d'expédition tant qu'une expertise est ouverte, pas
 * d'acceptation d'une proposition échue (même avant le passage du cron).
 */
export function exchangeActions(ex: ExchangeView, context: ActionContext = {}): ExchangeAction[] {
  const mine = hasText(myTracking(ex));
  const theirs = hasText(theirTracking(ex));
  const shipBlocked = context.hasOpenCertification === true;
  switch (ex.state) {
    case 'proposed': {
      if (ex.role !== 'recipient') return ['withdraw'];
      return isExchangeExpired(ex, context.now) ? ['decline'] : ['accept', 'decline'];
    }
    case 'accepted':
      return !ex.certificationRequired && !mine && !shipBlocked ? ['ship', 'cancel'] : ['cancel'];
    case 'awaiting_certification':
      return ['cancel'];
    case 'shipping': {
      const actions: ExchangeAction[] = [];
      if (!mine && !shipBlocked) actions.push('ship');
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
 * Actions sur une demande de certification (miroir de
 * enforce_certification_transition) : l'autre partie accepte/refuse une
 * demande d'accord mutuel, son auteur la retire ; avant la décision de
 * l'expert, l'auteur annule une démarche volontaire ou un accord mutuel, et
 * le propriétaire une expertise de seuil d'ANNONCE SEULE — celle d'une
 * commande ou d'un échange ne tombe qu'avec la transaction.
 */
export function certificationActions(
  c: Pick<CertificationRequest, 'status' | 'requestedByMe' | 'reason' | 'orderId' | 'exchangeId'>,
): CertificationAction[] {
  switch (c.status) {
    case 'awaiting_agreement':
      return c.requestedByMe ? ['cancel'] : ['agree', 'refuse'];
    case 'requested':
    case 'in_review': {
      const listingOnly = c.orderId === null && c.exchangeId === null;
      const cancellable =
        c.requestedByMe && (c.reason !== 'threshold' || listingOnly);
      return cancellable ? ['cancel'] : [];
    }
    default:
      return [];
  }
}

/** Demande ouverte (accord attendu, demandée, en cours d'expertise). */
const OPEN_CERTIFICATION: ReadonlySet<CertificationStatus> = new Set(['awaiting_agreement', 'requested', 'in_review']);

/**
 * Expertise d'un commun accord sur un ÉCHANGE (miroir de request_certification) :
 * échange accepté (en attente d'expertise ou en expédition) et AUCUN envoi ;
 * elle porte sur l'objet que je REÇOIS — refusée s'il est déjà en expertise
 * ou certifié dans cet échange : seuil demandé par son propriétaire (l'autre
 * partie) ou accord mutuel que j'ai demandé — ou s'il est DÉJÀ certifié
 * (_market_item_certification_ref) : l'objet de l'annonce pour l'auteur
 * (`listingCertified`), l'objet offert pour le destinataire
 * (`offeredItemCertified`). Information absente : le serveur tranche.
 */
export function canRequestExchangeCertification(
  ex: Pick<
    ExchangeProposal,
    'role' | 'state' | 'proposerTracking' | 'recipientTracking' | 'listingCertified' | 'offeredItemCertified'
  >,
  related: readonly Pick<CertificationRequest, 'reason' | 'status' | 'requestedByMe'>[],
): boolean {
  const ongoing = ex.state === 'accepted' || ex.state === 'awaiting_certification' || ex.state === 'shipping';
  if (!ongoing || ex.proposerTracking !== null || ex.recipientTracking !== null) return false;
  const receivedCertified = ex.role === 'proposer' ? ex.listingCertified : ex.offeredItemCertified;
  if (receivedCertified === true) return false;
  const onReceivedItem = (c: Pick<CertificationRequest, 'reason' | 'requestedByMe'>) =>
    (c.reason === 'threshold' && !c.requestedByMe) || (c.reason === 'mutual_agreement' && c.requestedByMe);
  return !related.some((c) => onReceivedItem(c) && (OPEN_CERTIFICATION.has(c.status) || c.status === 'certified'));
}

/**
 * Expertise d'un commun accord sur une COMMANDE (l'une ou l'autre partie) :
 * avant expédition seulement, une seule demande ouverte, rien après
 * certification — ni sur une annonce déjà authentifiée avant la vente
 * (`listingCertified` ; absent : le serveur tranche, avec son motif).
 */
export function canRequestOrderCertification(
  order: Pick<MarketOrder, 'escrowState' | 'listingCertified'>,
  related: readonly Pick<CertificationRequest, 'status'>[],
): boolean {
  if (order.escrowState !== 'pending_payment' && order.escrowState !== 'funds_held') return false;
  if (order.listingCertified === true) return false;
  return !related.some((c) => OPEN_CERTIFICATION.has(c.status) || c.status === 'certified');
}

/** Décision d'expert lue par itemCertifiedByExpert. */
type CertificationDecision = Pick<
  CertificationRequest,
  | 'listingId'
  | 'orderId'
  | 'exchangeId'
  | 'reason'
  | 'status'
  | 'requestedByMe'
  | 'itemTitle'
  | 'domain'
  | 'createdAt'
  | 'decidedAt'
>;

/** Horodatage ISO → millisecondes ; absent ou illisible : -∞ (rangé en dernier, NULLS LAST). */
function decisionTime(iso: string | null): number {
  const at = iso === null ? Number.NaN : Date.parse(iso);
  return Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY;
}

/** Échange lu pour rattacher une décision d'expert à MON objet. */
type DecisionExchange = Pick<ExchangeProposal, 'id' | 'listingId' | 'role' | 'offeredItemId'>;

/** Titre public d'un objet tel que le serveur le mémorise (redact_contact_info). */
function publicTitleOf(item: Pick<VelumItem, 'title'>): string | null {
  return item.title === null ? null : redactContactInfo(item.title).text;
}

/**
 * Décisions d'expert (certifié / refusé) sur MON objet, de la plus récente à
 * la plus ancienne — même ordre que _market_item_certification_ref et
 * _market_item_rejected (decidedAt, puis createdAt, refus d'abord à égalité).
 * Établies (`sure`) : décisions de mes annonces de l'objet (annonce ou
 * commande), des échanges reçus sur elles, et des échanges où j'ai OFFERT
 * l'objet, identifié par `offeredItemId` (renseigné pour l'auteur seulement).
 * Dépôt qui ne fournit pas `offeredItemId` : une décision sur un objet que
 * j'ai offert n'est que POSSIBLE — un refus d'un objet de la même catégorie,
 * quel que soit son titre (le refus ne dépend jamais du titre), ou une
 * certification sous le titre public de l'objet.
 */
function myItemDecisions(
  item: Pick<VelumItem, 'id' | 'title' | 'domain'>,
  listings: readonly Pick<ListingRecord, 'id' | 'itemId' | 'status'>[],
  certifications: readonly CertificationDecision[],
  exchanges: readonly DecisionExchange[],
): { c: CertificationDecision; sure: boolean }[] {
  const ids = new Set(listings.filter((l) => l.itemId !== '' && l.itemId === item.id).map((l) => l.id));
  const publicTitle = publicTitleOf(item);
  const decisions: { c: CertificationDecision; sure: boolean }[] = [];
  for (const c of certifications) {
    if (c.status !== 'certified' && c.status !== 'rejected') continue;
    if (c.exchangeId === null) {
      if (c.listingId !== null && ids.has(c.listingId)) decisions.push({ c, sure: true });
      continue;
    }
    // Échange : seuil de mon objet (demandé par moi, son propriétaire) ou
    // accord mutuel demandé par l'autre partie (il le reçoit).
    const onMyItem =
      (c.reason === 'threshold' && c.requestedByMe) || (c.reason === 'mutual_agreement' && !c.requestedByMe);
    const ex = exchanges.find((e) => e.id === c.exchangeId);
    if (!onMyItem || ex === undefined) continue;
    if (ex.role === 'recipient') {
      if (ids.has(ex.listingId)) decisions.push({ c, sure: true });
    } else if (ex.offeredItemId !== undefined) {
      // Mon objet offert, identifié (null : objet supprimé depuis, ce n'est pas celui-ci).
      if (ex.offeredItemId !== null && ex.offeredItemId === item.id) decisions.push({ c, sure: true });
    } else if (c.domain === item.domain && (c.status === 'rejected' || c.itemTitle === publicTitle)) {
      decisions.push({ c, sure: false });
    }
  }
  return decisions.sort(
    (a, b) =>
      decisionTime(b.c.decidedAt) - decisionTime(a.c.decidedAt) ||
      decisionTime(b.c.createdAt) - decisionTime(a.c.createdAt) ||
      (a.c.status === 'rejected' ? -1 : 0) - (b.c.status === 'rejected' ? -1 : 0),
  );
}

/**
 * true si MON objet est déjà certifié par un expert — la certification le
 * suit, miroir de _market_item_certification_ref : parmi les décisions
 * d'expert sur MON objet (myItemDecisions), la PLUS RÉCENTE doit être une
 * certification établie, ET l'objet doit être resté celui qui a été
 * certifié — même titre public (expurgé des coordonnées) et même catégorie.
 * Prudent : false dès que ce n'est pas établi — un objet déjà cédé (annonce
 * vendue ou échangée) ne compte pas ; à décisions ex aequo, le refus
 * l'emporte ; une décision seulement possible (objet offert non identifié)
 * peut l'invalider, jamais l'établir.
 */
export function itemCertifiedByExpert(
  item: Pick<VelumItem, 'id' | 'title' | 'domain'>,
  listings: readonly Pick<ListingRecord, 'id' | 'itemId' | 'status'>[],
  certifications: readonly CertificationDecision[],
  exchanges: readonly DecisionExchange[] = [],
): boolean {
  const ofItem = listings.filter((l) => l.itemId !== '' && l.itemId === item.id);
  if (ofItem.some((l) => l.status === 'sold' || l.status === 'exchanged')) return false;
  const last = myItemDecisions(item, listings, certifications, exchanges)[0];
  const publicTitle = publicTitleOf(item);
  return (
    last !== undefined &&
    last.sure &&
    last.c.status === 'certified' &&
    last.c.itemTitle === publicTitle &&
    last.c.domain === item.domain
  );
}

/**
 * true si MON objet a été REFUSÉ par un expert — miroir de
 * _market_item_rejected : la plus récente des décisions ÉTABLIES sur l'objet
 * (myItemDecisions) est un refus, quel que soit son titre (renommer un objet
 * refusé ne lève pas le refus). Toute (re)mise en vente exige alors une
 * nouvelle expertise, quel que soit le prix, et l'objet ne s'offre plus à
 * l'échange (set_exchange_defaults). Une décision seulement possible (objet
 * offert non identifié) ne compte pas : on ne bloque jamais un objet sur une
 * supposition, le serveur reste l'arbitre.
 */
export function itemRejectedByExpert(
  item: Pick<VelumItem, 'id' | 'title' | 'domain'>,
  listings: readonly Pick<ListingRecord, 'id' | 'itemId' | 'status'>[],
  certifications: readonly CertificationDecision[],
  exchanges: readonly DecisionExchange[] = [],
): boolean {
  const last = myItemDecisions(item, listings, certifications, exchanges).find((d) => d.sure);
  return last !== undefined && last.c.status === 'rejected';
}

// ── Annonces ─────────────────────────────────────────────────────────────────

/** Commande qui RÉSERVE l'annonce (listing_is_engaged : paiement capturé, jusqu'au litige). */
const ORDER_ENGAGES_LISTING: ReadonlySet<EscrowState> = new Set(['funds_held', 'shipped', 'disputed']);
/** Échange qui RÉSERVE l'annonce (listing_is_engaged : accepté, en cours). */
const EXCHANGE_ENGAGES_LISTING: ReadonlySet<ExchangeState> = new Set([
  'accepted',
  'awaiting_certification',
  'shipping',
  'disputed',
]);
/** Commande qui réserve l'annonce ou l'a conclue (vendue). */
const ORDER_HOLDS_LISTING: ReadonlySet<EscrowState> = new Set([...ORDER_ENGAGES_LISTING, 'released']);
/** Échange qui réserve l'annonce ou l'a conclue (échangée). */
const EXCHANGE_HOLDS_LISTING: ReadonlySet<ExchangeState> = new Set([...EXCHANGE_ENGAGES_LISTING, 'completed']);

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

/** Annonce OUVERTE (une seule par objet : _market_item_has_open_listing). */
const OPEN_LISTING: ReadonlySet<ListingStatus> = new Set(['draft', 'pending_certification', 'active']);
/** Annonce conclue : l'objet est CÉDÉ (_market_item_ceded). */
const CEDED_LISTING: ReadonlySet<ListingStatus> = new Set(['sold', 'exchanged']);

export interface ItemMarketBlock {
  /** 'ceded' : déjà vendu ou échangé ; 'openListing' : une annonce est déjà en cours. */
  reason: 'ceded' | 'openListing';
  /** Annonce en cause (lien « Voir l'annonce »). */
  listingId: string;
}

/**
 * Objet de MA collection qui ne peut pas être (re)mis en vente — miroir des
 * refus d'enforce_listing_rules (_market_item_ceded) : déjà CÉDÉ (annonce
 * vendue ou échangée, ou échange conclu où je l'ai OFFERT — reconnu par
 * offeredItemId quand le dépôt le fournit) ou déjà une annonce OUVERTE
 * (brouillon, en attente d'expertise, publiée). Un objet cédé ne s'offre pas
 * non plus à l'échange. Le serveur reste l'arbitre.
 */
export function itemMarketBlock(
  itemId: string,
  listings: readonly Pick<ListingRecord, 'id' | 'itemId' | 'status'>[],
  exchanges: readonly Pick<ExchangeProposal, 'listingId' | 'role' | 'state' | 'offeredItemId'>[] = [],
): ItemMarketBlock | null {
  const ofItem = listings.filter((l) => l.itemId !== '' && l.itemId === itemId);
  const ceded = ofItem.find((l) => CEDED_LISTING.has(l.status));
  if (ceded) return { reason: 'ceded', listingId: ceded.id };
  const offeredAway = exchanges.find(
    (e) => e.role === 'proposer' && e.state === 'completed' && e.offeredItemId === itemId,
  );
  // Annonce visée par l'échange : consultable par les parties (market_listing).
  if (offeredAway) return { reason: 'ceded', listingId: offeredAway.listingId };
  const open = ofItem.find((l) => OPEN_LISTING.has(l.status));
  return open ? { reason: 'openListing', listingId: open.id } : null;
}

/**
 * Une annonce peut être retirée tant qu'elle n'est ni vendue, ni échangée,
 * ni RÉSERVÉE par une transaction en cours (statut figé côté serveur).
 */
export function canWithdrawListing(status: ListingStatus, engaged = false): boolean {
  return !engaged && (status === 'draft' || status === 'pending_certification' || status === 'active');
}

/**
 * MON annonce réservée (miroir partiel de listing_is_engaged, d'après mes
 * transactions) : commande au paiement capturé jusqu'au litige, ou échange
 * accepté en cours. (Le cas de l'objet de l'annonce proposé ailleurs n'est
 * pas visible ici : le serveur reste l'arbitre.)
 */
export function myListingEngaged(
  listingId: string,
  orders: readonly Pick<MarketOrder, 'listingId' | 'escrowState'>[],
  exchanges: readonly Pick<ExchangeProposal, 'listingId' | 'state'>[],
): boolean {
  return (
    orders.some((o) => o.listingId === listingId && ORDER_ENGAGES_LISTING.has(o.escrowState)) ||
    exchanges.some((e) => e.listingId === listingId && EXCHANGE_ENGAGES_LISTING.has(e.state))
  );
}

// ── Compteur « à traiter » ───────────────────────────────────────────────────

/** Nombre d'éléments qui attendent une action de MA part (badge « Mon activité »). */
export function pendingActionCount(input: {
  orders?: readonly (Pick<MarketOrder, 'role' | 'escrowState'> & { id?: string; listingId?: string })[];
  exchanges?: readonly (ExchangeView & Partial<Pick<ExchangeProposal, 'id' | 'listingId' | 'offeredItemId'>>)[];
  certifications?: readonly CertificationContext[];
  /** Mes annonces (annonces de mon objet offert, R7) ; absentes : seule l'annonce visée compte. */
  listings?: readonly Pick<ListingRecord, 'id' | 'itemId'>[];
  now?: string;
}): number {
  const certs = input.certifications ?? [];
  const orders = (input.orders ?? []).filter((o) =>
    orderNeedsMe(o, {
      hasOpenCertification:
        o.id !== undefined &&
        hasOpenCertificationOn(certs, {
          orderId: o.id,
          ...(o.listingId !== undefined ? { listingIds: shipmentListingIds({ listingId: o.listingId }) } : {}),
        }),
    }),
  ).length;
  const exchanges = (input.exchanges ?? []).filter((e) =>
    exchangeNeedsMe(e, {
      hasOpenCertification:
        e.id !== undefined &&
        hasOpenCertificationOn(certs, {
          exchangeId: e.id,
          ...(e.listingId !== undefined
            ? { listingIds: shipmentListingIds({ ...e, listingId: e.listingId }, input.listings) }
            : {}),
        }),
      ...(input.now !== undefined ? { now: input.now } : {}),
    }),
  ).length;
  const certifications = certs.filter((c) => certificationNeedsMe(c)).length;
  return orders + exchanges + certifications;
}

/** Certification vue avec son contexte (annonce / commande / échange), quand il est connu. */
type CertificationContext = Pick<CertificationRequest, 'status' | 'requestedByMe'> &
  Partial<Pick<CertificationRequest, 'listingId' | 'orderId' | 'exchangeId'>>;

/**
 * Annonces dont une expertise ouverte bloque l'expédition d'une transaction
 * (R7, has_open_certification) : celle de la commande ; pour un échange,
 * l'annonce visée et, pour l'AUTEUR, ses annonces de l'objet offert (lues
 * dans MES annonces grâce à `offeredItemId`). Les annonces de l'objet offert
 * par l'autre partie ne sont pas visibles ici : le serveur reste l'arbitre.
 */
export function shipmentListingIds(
  tx: { listingId: string } & Partial<Pick<ExchangeProposal, 'role' | 'offeredItemId'>>,
  myListings: readonly Pick<ListingRecord, 'id' | 'itemId'>[] = [],
): string[] {
  const offered = tx.role === 'proposer' && typeof tx.offeredItemId === 'string' ? tx.offeredItemId : null;
  const ofOffered = offered === null ? [] : myListings.filter((l) => l.itemId !== '' && l.itemId === offered);
  return [tx.listingId, ...ofOffered.map((l) => l.id).filter((id) => id !== tx.listingId)];
}

/**
 * Miroir de has_open_certification : une expertise ouverte (accord attendu,
 * demandée, en cours) sur la commande ou l'échange bloque l'expédition — de
 * même qu'une expertise de l'ANNONCE elle-même (ni commande ni échange :
 * démarche volontaire, seuil) sur l'une de `listingIds` (shipmentListingIds) :
 * un refus de l'expert trouve ainsi toujours la transaction non expédiée.
 */
export function hasOpenCertificationOn(
  certifications: readonly CertificationContext[],
  target: { orderId?: string; exchangeId?: string; listingIds?: readonly string[] },
): boolean {
  const listingIds = target.listingIds ?? [];
  return certifications.some(
    (c) =>
      OPEN_CERTIFICATION.has(c.status) &&
      ((target.orderId !== undefined && c.orderId === target.orderId) ||
        (target.exchangeId !== undefined && c.exchangeId === target.exchangeId) ||
        (c.orderId === null &&
          c.exchangeId === null &&
          typeof c.listingId === 'string' &&
          listingIds.includes(c.listingId))),
  );
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
    current: [...current.filter((e) => needsMe(e)), ...current.filter((e) => !needsMe(e))],
    history: entries.filter((e) => closed(e)),
  };
}

/** true si la commande attend une action principale de ma part. */
export function orderNeedsMe(o: Pick<MarketOrder, 'role' | 'escrowState'>, context: ActionContext = {}): boolean {
  return orderActions(o, context).some((a) => PRIMARY_ORDER_ACTIONS.has(a));
}

/** true si l'échange attend une action principale de ma part. */
export function exchangeNeedsMe(e: ExchangeView, context: ActionContext = {}): boolean {
  return exchangeActions(e, context).some((a) => PRIMARY_EXCHANGE_ACTIONS.has(a));
}

/** true si la certification attend MON accord. */
export function certificationNeedsMe(c: Pick<CertificationRequest, 'status' | 'requestedByMe'>): boolean {
  return c.status === 'awaiting_agreement' && !c.requestedByMe;
}
