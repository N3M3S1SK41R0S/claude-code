/**
 * Plateformes d'échange et de vente par catégorie (Platine) — dépôt PostgREST.
 * Spécification : docs/COMMUNITY_MARKETPLACE.md ; contrats : @velum/core
 * (`market.ts`, `items.ts`).
 *
 * Anonymat : le catalogue, les échanges, les certifications et les messages
 * n'exposent qu'un PSEUDONYME de l'autre partie. Les transitions d'état sont
 * validées côté serveur (triggers / fonctions SECURITY DEFINER) : le client ne
 * fait que PROPOSER des actions, jamais imposer un état.
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
} from '@velum/core';
import {
  jsonToReputation,
  newListingToRow,
  rowToDispute,
  rowToListing,
  rowToOrder,
  type DisputeRow,
  type ListingRow,
  type NewListing,
  type OrderRow,
} from './mappers';

/** Convertit une erreur PostgREST en VelumError lisible. */
function dbError(context: string, error: { message: string }): VelumError {
  return new VelumError('SOURCE_UNAVAILABLE', `${context} : ${error.message}`);
}

/** Uid de la session courante, ou lève UNAUTHORIZED. */
async function requireUid(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new VelumError('UNAUTHORIZED', 'Session requise pour la communauté');
  return uid;
}

/** Fonction pas encore câblée côté serveur : erreur explicite, jamais de faux succès. */
function notAvailable(feature: string): never {
  throw new VelumError('SOURCE_UNAVAILABLE', `${feature} : fonction pas encore disponible`);
}

export interface MarketplaceRepo {
  /**
   * @deprecated Préférer `catalogue()` (anonymisé, filtrable par catégorie).
   * Annonces ACTIVES (les brouillons/retirées ne sont pas visibles).
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
  const listOrdered = async (): Promise<ListingRecord[]> => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw dbError('Lecture du catalogue impossible', error);
    return ((data ?? []) as ListingRow[]).map(rowToListing);
  };

  return {
    browseActive: listOrdered,

    async catalogue() {
      return notAvailable('Catalogue par catégorie');
    },

    async myListings() {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw dbError('Lecture de mes annonces impossible', error);
      return ((data ?? []) as ListingRow[]).map(rowToListing);
    },

    async createListing(input) {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('listings')
        .insert({ ...newListingToRow(input, uid), status: 'active' })
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Mise en vente impossible', error ?? { message: 'réponse vide' });
      }
      return rowToListing(data as ListingRow);
    },

    async withdrawListing() {
      return notAvailable("Retrait d'annonce");
    },

    async myOrders() {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw dbError('Lecture des commandes impossible', error);
      return ((data ?? []) as OrderRow[]).map((row) => rowToOrder(row, uid));
    },

    async buy(listingId) {
      const uid = await requireUid(supabase);
      const { data, error } = await supabase
        .from('orders')
        .insert({ listing_id: listingId, buyer_id: uid })
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Achat impossible', error ?? { message: 'réponse vide' });
      }
      return rowToOrder(data as OrderRow, uid);
    },

    async advanceOrder(orderId, escrowState, patch) {
      const uid = await requireUid(supabase);
      const row: Record<string, unknown> = { escrow_state: escrowState };
      if (patch?.carrier !== undefined) row['carrier'] = patch.carrier;
      if (patch?.trackingNumber !== undefined) row['tracking_number'] = patch.trackingNumber;
      if (patch?.deliveredAt !== undefined) row['delivered_at'] = patch.deliveredAt;
      const { data, error } = await supabase
        .from('orders')
        .update(row)
        .eq('id', orderId)
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Transition de commande impossible', error ?? { message: 'refusée' });
      }
      return rowToOrder(data as OrderRow, uid);
    },

    async openDispute(orderId, reason) {
      const uid = await requireUid(supabase);
      const advance = await supabase.from('orders').update({ escrow_state: 'disputed' }).eq('id', orderId);
      if (advance.error) throw dbError('Ouverture du litige impossible', advance.error);
      const { data, error } = await supabase
        .from('disputes')
        .insert({ order_id: orderId, opened_by: uid, reason })
        .select('*')
        .single();
      if (error || data === null) {
        throw dbError('Enregistrement du litige impossible', error ?? { message: 'réponse vide' });
      }
      return rowToDispute(data as DisputeRow);
    },

    async reputation(sellerId) {
      const { data, error } = await supabase.rpc('seller_reputation', { p_seller: sellerId });
      if (error) throw dbError('Lecture de la réputation impossible', error);
      return jsonToReputation((data ?? null) as Record<string, unknown> | null);
    },

    async reputationByAlias() {
      return notAvailable('Réputation par pseudonyme');
    },

    async proposeExchange() {
      return notAvailable("Proposition d'échange");
    },
    async myExchanges() {
      return notAvailable('Mes échanges');
    },
    async respondExchange() {
      return notAvailable("Réponse à une proposition d'échange");
    },
    async withdrawExchange() {
      return notAvailable("Retrait d'une proposition d'échange");
    },
    async cancelExchange() {
      return notAvailable("Annulation d'un échange");
    },
    async shipExchange() {
      return notAvailable("Expédition d'un échange");
    },
    async confirmExchangeReceipt() {
      return notAvailable("Réception d'un échange");
    },
    async disputeExchange() {
      return notAvailable("Litige sur un échange");
    },

    async myCertifications() {
      return notAvailable('Mes certifications');
    },
    async requestCertification() {
      return notAvailable('Demande de certification');
    },
    async respondCertification() {
      return notAvailable('Accord de certification');
    },
    async cancelCertification() {
      return notAvailable('Annulation de certification');
    },

    async messages() {
      return notAvailable('Messagerie');
    },
    async sendMessage() {
      return notAvailable('Messagerie');
    },
  };
}
