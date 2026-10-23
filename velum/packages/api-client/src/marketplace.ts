/**
 * Plateformes d'échange et de vente par catégorie (Platine) — dépôt PostgREST.
 * Spécification : docs/COMMUNITY_MARKETPLACE.md ; contrats : @velum/core
 * (`market.ts`, `items.ts`) ; schéma : migrations 20261023100000…100400.
 *
 * Anonymat : le catalogue, les commandes, les échanges, les certifications et
 * les messages passent par des RPC qui n'exposent qu'un PSEUDONYME de l'autre
 * partie (jamais son identifiant, ni celui de son objet). Les transitions
 * d'état sont validées côté serveur (triggers / fonctions SECURITY DEFINER) :
 * le client ne fait que PROPOSER des actions, jamais imposer un état.
 *
 * Erreurs : une règle métier refusée par le serveur devient `INVALID_INPUT`
 * (message serveur en français dans `message`), l'offre Platine manquante
 * `PLAN_REQUIRED`, une session ou une partie invalide `UNAUTHORIZED` ; seule
 * une vraie panne (réseau, service) reste `SOURCE_UNAVAILABLE` — l'interface
 * ne présente donc jamais un refus comme une panne, ni l'inverse.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VelumError,
  type CatalogueListing,
  type CatalogueQuery,
  type CertificationRequest,
  type DisputeRecord,
  type EscrowState,
  type ExchangeProposal,
  type ListingRecord,
  type MarketMessage,
  type MarketOrder,
  type MarketThreadKind,
  type NewCertificationRequest,
  type NewExchangeProposal,
  type SellerReputation,
  type VelumErrorCode,
} from '@velum/core';
import {
  catalogueQueryToArgs,
  catalogueRowToListing,
  jsonToCommissionSummary,
  jsonToReputation,
  newListingToRow,
  rowToCatalogueListing,
  rowToCertificationRequest,
  rowToDispute,
  rowToExchangeProposal,
  rowToListing,
  rowToMarketMessage,
  rowToOrder,
  type CatalogueRow,
  type CertificationRow,
  type CommissionSummary,
  type DisputeRow,
  type ExchangeRow,
  type ListingRow,
  type MarketMessageRow,
  type NewListing,
  type OrderRow,
} from './mappers';

/** Longueur maximale d'un message (contrainte SQL market_messages.body). */
export const MARKET_MESSAGE_MAX_LENGTH = 2000;

/** Erreur PostgREST minimale (supabase-js : message, code SQLSTATE ou PGRST…). */
interface PostgrestLikeError {
  message: string;
  code?: string | null;
}

/** SQLSTATE / codes PostgREST → code métier VELUM. */
function codeFor(sqlstate: string | null | undefined): VelumErrorCode {
  switch (sqlstate) {
    // Offre Platine requise (fonctions SQL des plateformes).
    case 'VL402':
      return 'PLAN_REQUIRED';
    // Session absente, partie étrangère à la transaction, droit insuffisant, JWT.
    case 'VL401':
    case '42501':
    case 'PGRST301':
    case 'PGRST302':
      return 'UNAUTHORIZED';
    // Règle métier (raise exception), contrainte, valeur invalide, ligne absente.
    case 'P0001':
    case '23505':
    case '23514':
    case '23503':
    case '23502':
    case '22P02':
    case '22023':
    case 'PGRST116':
      return 'INVALID_INPUT';
    default:
      return 'SOURCE_UNAVAILABLE';
  }
}

/** Convertit une erreur PostgREST en VelumError au code stable. */
export function toMarketplaceError(context: string, error: PostgrestLikeError): VelumError {
  const code = codeFor(error.code);
  return new VelumError(code, `${context} : ${error.message}`, {
    ...(error.code ? { sqlstate: error.code } : {}),
  });
}

/** Uid de la session courante, ou lève UNAUTHORIZED. */
async function requireUid(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new VelumError('UNAUTHORIZED', 'Session requise pour la communauté');
  return uid;
}

/** Texte obligatoire (trim) — refus local avant tout appel réseau. */
function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new VelumError('INVALID_INPUT', `${label} requis`);
  return trimmed;
}

/** Montant fini (et strictement positif si demandé) — refus local sinon. */
function requireAmount(value: number, label: string, strictlyPositive: boolean): number {
  if (!Number.isFinite(value) || value < 0 || (strictlyPositive && value === 0)) {
    throw new VelumError('INVALID_INPUT', `${label} invalide : ${String(value)}`);
  }
  return value;
}

export interface MarketplaceRepo {
  /**
   * @deprecated Préférer `catalogue()` (anonymisé, filtrable par catégorie).
   * Annonces publiées d'autres membres, projetées en `ListingRecord` :
   * `sellerId` / `itemId` ne sont plus exposés ('') ni le taux d'autrui (0).
   */
  browseActive(): Promise<ListingRecord[]>;
  /** Catalogue ANONYMISÉ, filtrable par catégorie, mode (vente/échange), texte, prix. */
  catalogue(query?: CatalogueQuery): Promise<CatalogueListing[]>;
  /** Mes annonces (tous statuts). */
  myListings(): Promise<ListingRecord[]>;
  /**
   * Met un objet en vente et/ou à l'échange (titre/domaine/commission remplis
   * serveur). Si une certification est exigée, l'annonce naît en
   * `pending_certification` et une demande de certification est ouverte.
   */
  createListing(input: NewListing): Promise<ListingRecord>;
  /** Retire une de mes annonces (statut `withdrawn`). */
  withdrawListing(listingId: string): Promise<ListingRecord>;
  /** Mes commandes (en tant qu'acheteur OU vendeur). */
  myOrders(): Promise<MarketOrder[]>;
  /** Achète une annonce → crée la commande (séquestre `pending_payment`). */
  buy(listingId: string): Promise<MarketOrder>;
  /** Fait avancer l'état de séquestre (transition validée par trigger serveur). */
  advanceOrder(
    orderId: string,
    escrowState: EscrowState,
    patch?: { carrier?: string; trackingNumber?: string; deliveredAt?: string },
  ): Promise<MarketOrder>;
  /** Ouvre un litige : passe la commande en `disputed` puis enregistre le motif. */
  openDispute(orderId: string, reason: string): Promise<DisputeRecord>;
  /**
   * @deprecated Préférer `reputationByAlias()` (jamais d'identifiant de membre).
   * Réputation d'un vendeur (signaux objectifs dérivés).
   */
  reputation(sellerId: string): Promise<SellerReputation>;
  /** Réputation d'un membre à partir de son pseudonyme. */
  reputationByAlias(alias: string): Promise<SellerReputation>;

  // ── Échanges ──
  /** Propose un de mes objets (+ soulte éventuelle) contre une annonce. */
  proposeExchange(input: NewExchangeProposal): Promise<ExchangeProposal>;
  /** Mes propositions d'échange (émises ET reçues). */
  myExchanges(): Promise<ExchangeProposal[]>;
  /** Le destinataire accepte ou refuse une proposition `proposed`. */
  respondExchange(exchangeId: string, accept: boolean): Promise<ExchangeProposal>;
  /** L'auteur retire sa proposition tant qu'elle n'est pas acceptée. */
  withdrawExchange(exchangeId: string): Promise<ExchangeProposal>;
  /** Annule un échange accepté avant toute expédition (l'une ou l'autre partie). */
  cancelExchange(exchangeId: string): Promise<ExchangeProposal>;
  /** Déclare MON expédition (numéro de suivi requis). */
  shipExchange(exchangeId: string, trackingNumber: string, carrier?: string): Promise<ExchangeProposal>;
  /** Confirme la réception de l'objet de l'autre partie. */
  confirmExchangeReceipt(exchangeId: string): Promise<ExchangeProposal>;
  /** Ouvre un litige sur un échange en cours d'expédition. */
  disputeExchange(exchangeId: string, reason: string): Promise<ExchangeProposal>;

  // ── Certification par un expert ──
  /** Mes demandes de certification (émises ou me concernant). */
  myCertifications(): Promise<CertificationRequest[]>;
  /** Ouvre une demande (seuil, accord mutuel, ou démarche volontaire). */
  requestCertification(input: NewCertificationRequest): Promise<CertificationRequest>;
  /** L'autre partie accepte ou refuse une demande `awaiting_agreement`. */
  respondCertification(certificationId: string, agree: boolean): Promise<CertificationRequest>;
  /** Annule une demande avant la décision de l'expert. */
  cancelCertification(certificationId: string): Promise<CertificationRequest>;

  // ── Messagerie anonymisée ──
  /** Messages d'un fil (commande ou échange), du plus ancien au plus récent. */
  messages(threadKind: MarketThreadKind, threadId: string): Promise<MarketMessage[]>;
  /** Envoie un message — le serveur masque toute coordonnée avant stockage. */
  sendMessage(threadKind: MarketThreadKind, threadId: string, body: string): Promise<MarketMessage>;
}

export function createMarketplaceRepo(supabase: SupabaseClient): MarketplaceRepo {
  /** Appel RPC → lignes (une fonction `setof` renvoie un tableau). */
  const rpcRows = async <Row>(
    fn: string,
    args: Record<string, unknown>,
    context: string,
  ): Promise<Row[]> => {
    await requireUid(supabase);
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw toMarketplaceError(context, error as PostgrestLikeError);
    if (data === null || data === undefined) return [];
    return (Array.isArray(data) ? data : [data]) as Row[];
  };

  /** Appel RPC d'action → la ligne mise à jour (toujours renvoyée par le serveur). */
  const rpcOne = async <Row>(
    fn: string,
    args: Record<string, unknown>,
    context: string,
  ): Promise<Row> => {
    const first = (await rpcRows<Row>(fn, args, context))[0];
    if (first === undefined) {
      throw new VelumError('SOURCE_UNAVAILABLE', `${context} : réponse vide du serveur`);
    }
    return first;
  };

  const exchangeAction = async (
    fn: string,
    args: Record<string, unknown>,
    context: string,
  ): Promise<ExchangeProposal> => rowToExchangeProposal(await rpcOne<ExchangeRow>(fn, args, context));

  const certificationAction = async (
    fn: string,
    args: Record<string, unknown>,
    context: string,
  ): Promise<CertificationRequest> =>
    rowToCertificationRequest(await rpcOne<CertificationRow>(fn, args, context));

  return {
    async browseActive() {
      const rows = await rpcRows<CatalogueRow>(
        'market_catalogue',
        catalogueQueryToArgs({}),
        'Lecture du catalogue impossible',
      );
      return rows.map(catalogueRowToListing);
    },

    async catalogue(query = {}) {
      const rows = await rpcRows<CatalogueRow>(
        'market_catalogue',
        catalogueQueryToArgs(query),
        'Lecture du catalogue impossible',
      );
      return rows.map(rowToCatalogueListing);
    },

    async myListings() {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw toMarketplaceError('Lecture de mes annonces impossible', error);
      return ((data ?? []) as ListingRow[]).map(rowToListing);
    },

    async createListing(input) {
      requireAmount(input.askPrice, 'Prix ou valeur déclarée', false);
      const uid = await requireUid(supabase);
      // Aucun statut imposé : le serveur publie ('active') ou retient
      // l'annonce ('pending_certification') selon le seuil de certification.
      const { data, error } = await supabase
        .from('listings')
        .insert(newListingToRow(input, uid))
        .select('*')
        .single();
      if (error || data === null) {
        throw toMarketplaceError('Mise en vente impossible', error ?? { message: 'réponse vide' });
      }
      return rowToListing(data as ListingRow);
    },

    async withdrawListing(listingId) {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('listings')
        .update({ status: 'withdrawn' })
        .eq('id', listingId)
        .eq('seller_id', uid)
        .select('*')
        .single();
      if (error) throw toMarketplaceError("Retrait de l'annonce impossible", error);
      if (data === null) {
        throw new VelumError('INVALID_INPUT', "Retrait de l'annonce impossible : annonce introuvable");
      }
      return rowToListing(data as ListingRow);
    },

    async myOrders() {
      const uid = await requireUid(supabase);
      const rows = await rpcRows<OrderRow>('my_market_orders', {}, 'Lecture des commandes impossible');
      return rows.map((row) => rowToOrder(row, uid));
    },

    async buy(listingId) {
      const uid = await requireUid(supabase);
      const row = await rpcOne<OrderRow>('market_buy', { p_listing: listingId }, 'Achat impossible');
      return rowToOrder(row, uid);
    },

    async advanceOrder(orderId, escrowState, patch) {
      const uid = await requireUid(supabase);
      const row = await rpcOne<OrderRow>(
        'advance_market_order',
        {
          p_order: orderId,
          p_state: escrowState,
          p_carrier: patch?.carrier ?? null,
          p_tracking: patch?.trackingNumber ?? null,
          p_delivered_at: patch?.deliveredAt ?? null,
        },
        'Transition de commande impossible',
      );
      return rowToOrder(row, uid);
    },

    async openDispute(orderId, reason) {
      const motive = requireText(reason, 'Motif du litige');
      const row = await rpcOne<DisputeRow>(
        'open_order_dispute',
        { p_order: orderId, p_reason: motive },
        'Ouverture du litige impossible',
      );
      return rowToDispute(row);
    },

    async reputation(sellerId) {
      const { data, error } = await supabase.rpc('seller_reputation', { p_seller: sellerId });
      if (error) throw toMarketplaceError('Lecture de la réputation impossible', error);
      return jsonToReputation((data ?? null) as Record<string, unknown> | null);
    },

    async reputationByAlias(alias) {
      const pseudonym = requireText(alias, 'Pseudonyme');
      await requireUid(supabase);
      const { data, error } = await supabase.rpc('member_reputation', { p_alias: pseudonym });
      if (error) throw toMarketplaceError('Lecture de la réputation impossible', error);
      if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
        // Pseudonyme inconnu : jamais de « 0 vente » trompeur.
        throw new VelumError('INVALID_INPUT', `Membre introuvable : ${pseudonym}`);
      }
      return jsonToReputation(data as Record<string, unknown>);
    },

    async proposeExchange(input) {
      requireAmount(input.offeredValue, 'Valeur déclarée de votre objet', true);
      const cash = input.cashAdjustment ?? 0;
      if (!Number.isFinite(cash)) {
        throw new VelumError('INVALID_INPUT', `Soulte invalide : ${String(cash)}`);
      }
      const message = input.message?.trim() ?? '';
      return exchangeAction(
        'propose_exchange',
        {
          p_listing: input.listingId,
          p_offered_item: input.offeredItemId,
          p_offered_value: input.offeredValue,
          p_cash_adjustment: cash,
          p_message: message === '' ? null : message,
        },
        "Proposition d'échange impossible",
      );
    },

    async myExchanges() {
      const rows = await rpcRows<ExchangeRow>('my_exchanges', {}, 'Lecture des échanges impossible');
      return rows.map(rowToExchangeProposal);
    },

    async respondExchange(exchangeId, accept) {
      return exchangeAction(
        'respond_exchange',
        { p_exchange: exchangeId, p_accept: accept },
        "Réponse à la proposition d'échange impossible",
      );
    },

    async withdrawExchange(exchangeId) {
      return exchangeAction(
        'withdraw_exchange',
        { p_exchange: exchangeId },
        'Retrait de la proposition impossible',
      );
    },

    async cancelExchange(exchangeId) {
      return exchangeAction('cancel_exchange', { p_exchange: exchangeId }, "Annulation de l'échange impossible");
    },

    async shipExchange(exchangeId, trackingNumber, carrier) {
      const tracking = requireText(trackingNumber, 'Numéro de suivi');
      const carrierName = carrier?.trim() ?? '';
      return exchangeAction(
        'ship_exchange',
        {
          p_exchange: exchangeId,
          p_tracking: tracking,
          p_carrier: carrierName === '' ? null : carrierName,
        },
        "Déclaration d'expédition impossible",
      );
    },

    async confirmExchangeReceipt(exchangeId) {
      return exchangeAction(
        'confirm_exchange_receipt',
        { p_exchange: exchangeId },
        'Confirmation de réception impossible',
      );
    },

    async disputeExchange(exchangeId, reason) {
      const motive = requireText(reason, 'Motif du litige');
      return exchangeAction(
        'dispute_exchange',
        { p_exchange: exchangeId, p_reason: motive },
        'Ouverture du litige impossible',
      );
    },

    async myCertifications() {
      const rows = await rpcRows<CertificationRow>(
        'my_certifications',
        {},
        'Lecture des certifications impossible',
      );
      return rows.map(rowToCertificationRequest);
    },

    async requestCertification(input) {
      const contexts = [input.listingId, input.orderId, input.exchangeId].filter(
        (id): id is string => typeof id === 'string' && id !== '',
      );
      if (contexts.length !== 1) {
        throw new VelumError(
          'INVALID_INPUT',
          'Demande de certification : préciser un seul contexte (annonce, commande ou échange)',
        );
      }
      return certificationAction(
        'request_certification',
        {
          p_reason: input.reason,
          p_listing: input.listingId ?? null,
          p_order: input.orderId ?? null,
          p_exchange: input.exchangeId ?? null,
          p_fee_payer: input.feePayer ?? null,
        },
        'Demande de certification impossible',
      );
    },

    async respondCertification(certificationId, agree) {
      return certificationAction(
        'respond_certification',
        { p_certification: certificationId, p_agree: agree },
        'Réponse à la demande de certification impossible',
      );
    },

    async cancelCertification(certificationId) {
      return certificationAction(
        'cancel_certification',
        { p_certification: certificationId },
        'Annulation de la certification impossible',
      );
    },

    async messages(threadKind, threadId) {
      const rows = await rpcRows<MarketMessageRow>(
        'thread_messages',
        { p_kind: threadKind, p_thread: threadId },
        'Lecture des messages impossible',
      );
      return rows.map(rowToMarketMessage);
    },

    async sendMessage(threadKind, threadId, body) {
      const text = requireText(body, 'Message');
      if (text.length > MARKET_MESSAGE_MAX_LENGTH) {
        throw new VelumError(
          'INVALID_INPUT',
          `Message trop long (${text.length} caractères, ${MARKET_MESSAGE_MAX_LENGTH} au plus)`,
        );
      }
      const row = await rpcOne<MarketMessageRow>(
        'send_market_message',
        { p_kind: threadKind, p_thread: threadId, p_body: text },
        "Envoi du message impossible",
      );
      return rowToMarketMessage(row);
    },
  };
}

/**
 * Synthèse du commissionnement de l'utilisateur courant (registre de la
 * plateforme : commissions, frais d'expertise, versements). Hors
 * `MarketplaceRepo` (contrat figé) : appel direct sur le client Supabase.
 */
export async function fetchCommissionSummary(supabase: SupabaseClient): Promise<CommissionSummary> {
  await requireUid(supabase);
  const { data, error } = await supabase.rpc('my_commission_summary', {});
  if (error) throw toMarketplaceError('Lecture du commissionnement impossible', error as PostgrestLikeError);
  return jsonToCommissionSummary(data ?? null);
}
