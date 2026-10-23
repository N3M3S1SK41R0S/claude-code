/**
 * Plateformes d'échange et de vente PAR CATÉGORIE (offre Platine) — contrats.
 *
 * Spécification : docs/COMMUNITY_MARKETPLACE.md. Principes structurants :
 *  - ANONYMAT pair-à-pair : le catalogue et les fils de discussion n'exposent
 *    jamais l'identifiant d'un membre ni celui de son objet — uniquement un
 *    PSEUDONYME stable et non réversible (`sellerAlias`, `counterpartyAlias`).
 *    Les textes libres (description, souhaits d'échange, messages) sont
 *    expurgés côté serveur des coordonnées (e-mails, téléphones, liens…).
 *  - COMMISSION dégressive (5 % → 2 % selon l'activité) prélevée à la
 *    libération / à la conclusion de l'échange, jamais à la mise en ligne.
 *  - CERTIFICATION par un expert obligatoire au-delà du seuil
 *    (EXPERT_APPRAISAL_THRESHOLD_EUR, @velum/config) ou sur accord des deux
 *    parties en deçà.
 */
import type { VelumDomain } from './domain.ts';

/** Nature d'une annonce : vente, échange, ou les deux au choix du preneur. */
export type ListingKind = 'sale' | 'exchange' | 'sale_or_exchange';

/** Annonce telle que vue dans le CATALOGUE : anonymisée (aucun id membre ni objet). */
export interface CatalogueListing {
  id: string;
  kind: ListingKind;
  domain: VelumDomain | null;
  title: string | null;
  /** Description publique, expurgée des coordonnées. */
  description: string | null;
  /** Prix demandé (vente) ou valeur déclarée (échange), dans `currency`. */
  askPrice: number;
  currency: string;
  /** Ce que le vendeur recherche en échange (texte expurgé), si échange possible. */
  exchangeWishes: string | null;
  /** Pseudonyme stable et non réversible du vendeur (ex. « Collectionneur 7F3A »). */
  sellerAlias: string;
  /** Badge « authentifié VELUM » : certification d'expert obtenue. */
  certified: boolean;
  /** true si l'annonce appartient à l'utilisateur courant. */
  isMine: boolean;
  createdAt: string;
}

export type CatalogueSort = 'recent' | 'price_asc' | 'price_desc';

/** Filtres du catalogue (tous optionnels, combinés en ET). */
export interface CatalogueQuery {
  domain?: VelumDomain;
  /**
   * 'sale' → kind ∈ {sale, sale_or_exchange} ;
   * 'exchange' → kind ∈ {exchange, sale_or_exchange}.
   */
  mode?: 'sale' | 'exchange';
  /** Recherche plein texte (titre, description, souhaits d'échange). */
  text?: string;
  minPrice?: number;
  maxPrice?: number;
  certifiedOnly?: boolean;
  /** Inclure mes propres annonces (défaut : false). */
  includeMine?: boolean;
  sort?: CatalogueSort;
  limit?: number;
}

/**
 * États d'une proposition d'échange (machine validée côté serveur) :
 *
 *   proposed ─► accepted ─► (awaiting_certification) ─► shipping ─► completed
 *      │            │                 │                     │
 *      ├► declined  └► cancelled ◄────┘                     └► disputed
 *      ├► withdrawn                                             │ arbitrage
 *      └► expired                                    completed | cancelled
 */
export type ExchangeState =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'
  | 'awaiting_certification'
  | 'shipping'
  | 'completed'
  | 'disputed'
  | 'cancelled';

/** Proposition d'échange vue par l'une des deux parties (anonymisée). */
export interface ExchangeProposal {
  id: string;
  listingId: string;
  /** Rôle de l'utilisateur courant : auteur de la proposition ou destinataire. */
  role: 'proposer' | 'recipient';
  /** Pseudonyme de l'autre partie. */
  counterpartyAlias: string;
  /** Annonce visée (dénormalisée). */
  listingTitle: string | null;
  listingDomain: VelumDomain | null;
  /** Valeur déclarée de l'objet de l'annonce (EUR). */
  listingValue: number;
  /** Objet proposé en échange (dénormalisé — jamais l'id de l'objet d'autrui). */
  offeredTitle: string | null;
  offeredDomain: VelumDomain | null;
  /** Valeur déclarée de l'objet proposé (EUR). */
  offeredValue: number;
  /**
   * Soulte en EUR versée par l'AUTEUR de la proposition au destinataire
   * (> 0) ou demandée au destinataire (< 0). 0 = échange sec.
   */
  cashAdjustment: number;
  currency: string;
  /** Message d'accompagnement, expurgé des coordonnées. */
  message: string | null;
  state: ExchangeState;
  /** Commission due par l'utilisateur courant, FIGÉE à l'acceptation (null avant). */
  myCommission: number | null;
  /** true si une certification d'expert conditionne l'expédition. */
  certificationRequired: boolean;
  /** Suivi d'expédition de chaque partie. */
  proposerTracking: string | null;
  recipientTracking: string | null;
  /** Réception confirmée par chaque partie. */
  proposerReceived: boolean;
  recipientReceived: boolean;
  /**
   * Échéance d'une proposition sans réponse (ISO, `expires_at` serveur) :
   * passé ce délai, elle ne s'accepte plus. Optionnel (ajout additif) :
   * absent ou null quand le dépôt ne la fournit pas.
   */
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Création d'une proposition d'échange (par l'auteur). */
export interface NewExchangeProposal {
  listingId: string;
  /** Objet de MA collection proposé en échange. */
  offeredItemId: string;
  /** Valeur déclarée de mon objet (EUR, > 0). */
  offeredValue: number;
  /** Soulte (voir ExchangeProposal.cashAdjustment) — défaut 0. */
  cashAdjustment?: number;
  message?: string;
}

/** Motif d'une demande de certification par un expert. */
export type CertificationReason =
  /** Valeur au-delà du seuil (obligatoire). */
  | 'threshold'
  /** Demandée par une partie et acceptée par l'autre, sous le seuil. */
  | 'mutual_agreement'
  /** Démarche spontanée du propriétaire (badge « authentifié VELUM »). */
  | 'voluntary';

/**
 * Cycle d'une demande de certification :
 * awaiting_agreement (accord de l'autre partie attendu, motif mutual_agreement)
 *   → requested → in_review → certified | rejected ; cancelled à tout moment
 *   avant la décision de l'expert.
 */
export type CertificationStatus =
  | 'awaiting_agreement'
  | 'requested'
  | 'in_review'
  | 'certified'
  | 'rejected'
  | 'cancelled';

/** Qui règle les frais d'expertise. */
export type CertificationFeePayer = 'seller' | 'buyer' | 'split';

/** Demande de certification vue par une partie. */
export interface CertificationRequest {
  id: string;
  /** Contexte : annonce, commande ou échange (au moins un renseigné). */
  listingId: string | null;
  orderId: string | null;
  exchangeId: string | null;
  /** Titre/domaine de l'objet à certifier (dénormalisés). */
  itemTitle: string | null;
  domain: VelumDomain | null;
  reason: CertificationReason;
  status: CertificationStatus;
  feePayer: CertificationFeePayer;
  /** Frais d'expertise (EUR), connus à l'assignation de l'expert. */
  feeAmount: number | null;
  /** true si l'utilisateur courant est l'auteur de la demande. */
  requestedByMe: boolean;
  /** Accord de l'autre partie (motif mutual_agreement ; true sinon). */
  counterpartyAgreed: boolean;
  /** Référence du rapport d'expert (chemin Storage privé) une fois décidé. */
  reportRef: string | null;
  /** Avis de l'expert (motif de refus, réserves…). */
  expertNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** Création d'une demande de certification. */
export interface NewCertificationRequest {
  reason: CertificationReason;
  listingId?: string;
  orderId?: string;
  exchangeId?: string;
  feePayer?: CertificationFeePayer;
}

/** Fil de discussion anonymisé d'une transaction. */
export type MarketThreadKind = 'order' | 'exchange';

/** Message d'un fil (corps expurgé côté serveur). */
export interface MarketMessage {
  id: string;
  threadKind: MarketThreadKind;
  threadId: string;
  /** true si envoyé par l'utilisateur courant. */
  mine: boolean;
  authorAlias: string;
  /** Corps EXPURGÉ : coordonnées remplacées par « [coordonnées masquées] ». */
  body: string;
  /** true si des coordonnées ont été masquées. */
  redacted: boolean;
  createdAt: string;
}
