/**
 * Plateformes d'échange et de vente — implémentation DÉMO en mémoire du
 * contrat MarketplaceRepo (@velum/api-client), sans backend.
 *
 * Elle applique les VRAIES règles métier :
 *  - @velum/config : masquage des coordonnées (`redactContactInfo`), taux
 *    dégressif (`commissionRateFor`) figé à la création de l'annonce,
 *    commission d'échange (`exchangeCommission`) figée à l'acceptation,
 *    certification obligatoire au-delà du seuil (`certificationRequirement`)
 *    → annonce `pending_certification` + demande ouverte ;
 *  - lib/marketState : actions légales par rôle × état (miroir serveur) ;
 *  - lib/search : recherche texte insensible aux accents.
 *
 * Les gestes de L'AUTRE partie (expédition, réception) sont SIMULÉS pour que
 * chaque parcours puisse être mené à son terme en démo — commentés sur place.
 * Chaque lecture renvoie des COPIES : React Query détecte ainsi les changements.
 */
import type { MarketplaceRepo, NewListing } from '@velum/api-client';
import {
  certificationRequirement,
  commissionRateFor,
  defaultCertificationFeePayer,
  exchangeCommission,
  redactContactInfo,
} from '@velum/config';
import {
  VelumError,
  type CatalogueListing,
  type CatalogueQuery,
  type CertificationFeePayer,
  type CertificationReason,
  type CertificationRequest,
  type CertificationStatus,
  type DisputeRecord,
  type EscrowState,
  type ExchangeProposal,
  type ExchangeState,
  type ListingRecord,
  type MarketMessage,
  type MarketOrder,
  type MarketThreadKind,
  type SellerReputation,
  type VelumDomain,
  type VelumItem,
} from '@velum/core';

import {
  canTransitionOrder,
  canWithdrawListing,
  certificationActions,
  exchangeActions,
  isForSale,
  isOpenToExchange,
  type ExchangeAction,
} from '../marketState';
import { scoreDocument, tokenize } from '../search';
import { DEMO_OWNER } from './demoData';

// ── Membres (pseudonymes uniquement) ─────────────────────────────────────────

/** Pseudonymes démo stables et non réversibles (jamais d'identité réelle). */
const DEMO_ALIASES: Record<string, string> = {
  'demo-seller-a': 'Collectionneur 7F3A',
  'demo-seller-b': 'Collectionneuse B21C',
  'demo-seller-c': 'Amateur 4D9E',
  'demo-seller-d': 'Cave 92B1',
  'demo-seller-e': 'Horloger 5C07',
  [DEMO_OWNER]: 'Collectionneur D3M0',
};

/** Réputations démo (signaux objectifs, informatifs). */
const DEMO_REPUTATION: Record<string, SellerReputation> = {
  'demo-seller-a': { completedSales: 34, refunded: 1, disputes: 1, disputeRate: 0.03, memberSince: '2023-03-12T00:00:00Z' },
  'demo-seller-b': { completedSales: 61, refunded: 0, disputes: 0, disputeRate: 0, memberSince: '2022-11-02T00:00:00Z' },
  'demo-seller-c': { completedSales: 4, refunded: 0, disputes: 0, disputeRate: 0, memberSince: '2025-06-20T00:00:00Z' },
  'demo-seller-d': { completedSales: 18, refunded: 1, disputes: 0, disputeRate: 0, memberSince: '2024-01-15T00:00:00Z' },
  'demo-seller-e': { completedSales: 9, refunded: 0, disputes: 1, disputeRate: 0.11, memberSince: '2024-09-01T00:00:00Z' },
};

function aliasOf(memberId: string): string {
  return DEMO_ALIASES[memberId] ?? 'Membre VELUM';
}

function memberOfAlias(alias: string): string | null {
  for (const [member, a] of Object.entries(DEMO_ALIASES)) {
    if (a === alias) return member;
  }
  return null;
}

// ── Modèle interne (avec identifiants de membres, jamais exposés) ────────────

interface DemoOrder {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  commissionRate: number;
  escrowState: EscrowState;
  carrier: string | null;
  trackingNumber: string | null;
  deliveredAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  listingTitle: string | null;
  certificationRequired: boolean;
}

interface DemoExchange {
  id: string;
  listingId: string;
  proposerId: string;
  recipientId: string;
  /** Objet proposé (collection de l'auteur — jamais exposé à l'autre partie). */
  offeredItemId: string | null;
  listingTitle: string | null;
  listingDomain: VelumDomain | null;
  listingValue: number;
  offeredTitle: string | null;
  offeredDomain: VelumDomain | null;
  offeredValue: number;
  cashAdjustment: number;
  message: string | null;
  state: ExchangeState;
  proposerCommission: number | null;
  recipientCommission: number | null;
  certificationRequired: boolean;
  proposerTracking: string | null;
  recipientTracking: string | null;
  proposerReceived: boolean;
  recipientReceived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DemoCertification {
  id: string;
  listingId: string | null;
  orderId: string | null;
  exchangeId: string | null;
  /** Échange : objet expertisé (celui de l'annonce ou celui proposé), sinon null. */
  side: 'listing' | 'offered' | null;
  itemTitle: string | null;
  domain: VelumDomain | null;
  reason: CertificationReason;
  status: CertificationStatus;
  feePayer: CertificationFeePayer;
  feeAmount: number | null;
  requesterId: string;
  /** Autre partie dont l'accord est requis (accord mutuel), sinon null. */
  counterpartyId: string | null;
  counterpartyAgreed: boolean;
  reportRef: string | null;
  expertNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface DemoMessage {
  id: string;
  threadKind: MarketThreadKind;
  threadId: string;
  authorId: string;
  body: string;
  redacted: boolean;
  createdAt: string;
}

// ── Données de départ : les 5 catégories ─────────────────────────────────────

function listing(
  patch: Partial<ListingRecord> & Pick<ListingRecord, 'id' | 'sellerId' | 'askPrice' | 'kind' | 'title' | 'domain' | 'createdAt'>,
): ListingRecord {
  return {
    itemId: `${patch.id}-item`,
    currency: 'EUR',
    status: 'active',
    description: null,
    exchangeWishes: null,
    commissionRate: 0.05,
    certificationRequired: false,
    certified: false,
    ...patch,
  };
}

function seedListings(): ListingRecord[] {
  return [
    listing({
      id: 'demo-listing-1',
      sellerId: 'demo-seller-a',
      askPrice: 320,
      kind: 'sale_or_exchange',
      title: 'Napoléon III 20 Francs Or 1868',
      domain: 'coin',
      description: 'TTB+, belle patine d’origine, conservée sous capsule.',
      exchangeWishes: 'Pièces or Second Empire, ou 10 Francs Coq',
      commissionRate: 0.03,
      createdAt: '2026-07-08T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-2',
      sellerId: 'demo-seller-b',
      askPrice: 780,
      kind: 'sale',
      title: 'Bloc CITEX 1949 neuf',
      domain: 'stamp',
      description: 'Neuf sans charnière, gomme intacte, certificat d’expert.',
      commissionRate: 0.02,
      certificationRequired: true,
      certified: true,
      createdAt: '2026-07-03T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-3',
      sellerId: 'demo-seller-d',
      askPrice: 180,
      kind: 'sale',
      title: 'Château Talbot 2010 — caisse de 3',
      domain: 'wine',
      description: 'Achat primeur, cave naturelle à 12 °C depuis l’origine.',
      commissionRate: 0.04,
      createdAt: '2026-09-20T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-4',
      sellerId: 'demo-seller-c',
      askPrice: 450,
      kind: 'exchange',
      title: 'Gravure — Paris, le Pont-Neuf (1960)',
      domain: 'art',
      description: 'Pointe sèche signée dans la planche, encadrée sous verre.',
      exchangeWishes: 'Lithographie d’après-guerre ou paysage provençal',
      createdAt: '2026-09-28T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-5',
      sellerId: 'demo-seller-e',
      askPrice: 1450,
      kind: 'sale',
      title: 'Longines Flagship automatique, années 1960',
      domain: 'watch',
      description: 'Révisée en 2025, boîte et papiers d’époque.',
      commissionRate: 0.05,
      certificationRequired: true,
      certified: true,
      createdAt: '2026-10-02T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-6',
      sellerId: 'demo-seller-a',
      askPrice: 95,
      kind: 'exchange',
      title: 'Cérès 20c noir 1849 — YT 3 oblitéré',
      domain: 'stamp',
      description: 'Oblitération grille, marges complètes.',
      exchangeWishes: 'Semeuses lignées ou Sage type II',
      commissionRate: 0.03,
      createdAt: '2026-10-10T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-7',
      sellerId: 'demo-seller-b',
      askPrice: 240,
      kind: 'sale_or_exchange',
      title: 'Bandol Château Pradeaux 2012 ×2',
      domain: 'wine',
      exchangeWishes: 'Rhône nord de garde (Hermitage, Côte-Rôtie)',
      commissionRate: 0.02,
      createdAt: '2026-10-12T09:00:00Z',
    }),
    listing({
      id: 'demo-listing-8',
      sellerId: 'demo-seller-c',
      askPrice: 28,
      kind: 'sale',
      title: 'Hercule 10 Francs argent 1965',
      domain: 'coin',
      createdAt: '2026-08-15T09:00:00Z',
    }),
    // Vendue (commande démo en cours de livraison vers moi).
    listing({
      id: 'demo-listing-9',
      sellerId: 'demo-seller-d',
      askPrice: 210,
      kind: 'sale',
      title: 'Pomerol Château Gazin 2008',
      domain: 'wine',
      status: 'sold',
      commissionRate: 0.04,
      createdAt: '2026-09-25T09:00:00Z',
    }),
    // ── Mes annonces ──
    listing({
      id: 'demo-mine-1',
      sellerId: DEMO_OWNER,
      askPrice: 45,
      kind: 'exchange',
      title: '5 Francs Semeuse argent 1960',
      domain: 'coin',
      description: 'SUP, sans rayure.',
      exchangeWishes: 'Hercule 10 Francs ou 50 Francs argent',
      createdAt: '2026-10-08T09:00:00Z',
    }),
    // > 500 € : publiée seulement après certification (en cours d'expertise).
    listing({
      id: 'demo-mine-2',
      sellerId: DEMO_OWNER,
      askPrice: 4200,
      kind: 'sale',
      title: 'Omega Speedmaster Professional 3570.50',
      domain: 'watch',
      description: 'Boîte et papiers, révision complète en 2024.',
      status: 'pending_certification',
      certificationRequired: true,
      createdAt: '2026-10-15T09:00:00Z',
    }),
    listing({
      id: 'demo-mine-3',
      sellerId: DEMO_OWNER,
      askPrice: 60,
      kind: 'sale',
      title: 'Lot de 10 Semeuses camées',
      domain: 'stamp',
      status: 'sold',
      createdAt: '2026-05-02T09:00:00Z',
    }),
    listing({
      id: 'demo-mine-4',
      sellerId: DEMO_OWNER,
      askPrice: 120,
      kind: 'sale',
      title: 'Marianne de Gandon — feuille de 50',
      domain: 'stamp',
      status: 'sold',
      createdAt: '2026-07-21T09:00:00Z',
    }),
    // Vendue, paiement sous séquestre : à moi d'expédier (commande demo-order-4).
    listing({
      id: 'demo-mine-5',
      sellerId: DEMO_OWNER,
      askPrice: 150,
      kind: 'sale',
      title: 'Château Lynch-Bages 2005',
      domain: 'wine',
      description: 'Cave enterrée, niveau haut épaule.',
      createdAt: '2026-10-16T09:00:00Z',
    }),
  ];
}

function seedOrders(): DemoOrder[] {
  const base = {
    currency: 'EUR',
    carrier: null,
    trackingNumber: null,
    deliveredAt: null,
    releasedAt: null,
    certificationRequired: false,
  };
  return [
    {
      ...base,
      id: 'demo-order-1',
      listingId: 'demo-listing-9',
      buyerId: DEMO_OWNER,
      sellerId: 'demo-seller-d',
      amount: 210,
      commissionRate: 0.04,
      escrowState: 'shipped',
      carrier: 'Colissimo',
      trackingNumber: '6A12345678901',
      createdAt: '2026-10-05T09:00:00Z',
      listingTitle: 'Pomerol Château Gazin 2008',
    },
    {
      ...base,
      id: 'demo-order-2',
      listingId: 'demo-mine-4',
      buyerId: 'demo-seller-b',
      sellerId: DEMO_OWNER,
      amount: 120,
      commissionRate: 0.05,
      escrowState: 'released',
      carrier: 'La Poste',
      trackingNumber: 'LL123456789FR',
      deliveredAt: '2026-07-28T09:00:00Z',
      releasedAt: '2026-08-02T09:00:00Z',
      createdAt: '2026-07-24T09:00:00Z',
      listingTitle: 'Marianne de Gandon — feuille de 50',
    },
    {
      ...base,
      id: 'demo-order-3',
      listingId: 'demo-mine-3',
      buyerId: 'demo-seller-a',
      sellerId: DEMO_OWNER,
      amount: 60,
      commissionRate: 0.05,
      escrowState: 'released',
      carrier: 'La Poste',
      trackingNumber: 'LL987654321FR',
      deliveredAt: '2026-05-09T09:00:00Z',
      releasedAt: '2026-05-14T09:00:00Z',
      createdAt: '2026-05-05T09:00:00Z',
      listingTitle: 'Lot de 10 Semeuses camées',
    },
    // VENTE en cours : l'acheteur a payé, j'expédie avec le numéro de suivi.
    {
      ...base,
      id: 'demo-order-4',
      listingId: 'demo-mine-5',
      buyerId: 'demo-seller-e',
      sellerId: DEMO_OWNER,
      amount: 150,
      commissionRate: 0.05,
      escrowState: 'funds_held',
      createdAt: '2026-10-20T09:00:00Z',
      listingTitle: 'Château Lynch-Bages 2005',
    },
  ];
}

function seedExchanges(): DemoExchange[] {
  const base = {
    currency: 'EUR',
    proposerCommission: null,
    recipientCommission: null,
    certificationRequired: false,
    proposerTracking: null,
    recipientTracking: null,
    proposerReceived: false,
    recipientReceived: false,
  };
  return [
    // REÇUE : on me propose un Hercule (+ soulte) contre ma Semeuse.
    {
      ...base,
      id: 'demo-exchange-1',
      listingId: 'demo-mine-1',
      proposerId: 'demo-seller-c',
      recipientId: DEMO_OWNER,
      offeredItemId: 'demo-exchange-1-offered',
      listingTitle: '5 Francs Semeuse argent 1960',
      listingDomain: 'coin',
      listingValue: 45,
      offeredTitle: 'Hercule 10 Francs argent 1967',
      offeredDomain: 'coin',
      offeredValue: 32,
      cashAdjustment: 15,
      message: redactContactInfo('Bonjour, l’Hercule est en SUP. Je complète de 15 €. Appelez-moi au 06 12 34 56 78.').text,
      state: 'proposed',
      createdAt: '2026-10-18T09:00:00Z',
      updatedAt: '2026-10-18T09:00:00Z',
    },
    // ÉMISE : je propose ma Semeuse lignée (+ soulte) contre un Cérès.
    {
      ...base,
      id: 'demo-exchange-2',
      listingId: 'demo-listing-6',
      proposerId: DEMO_OWNER,
      recipientId: 'demo-seller-a',
      offeredItemId: 'demo-exchange-2-offered',
      listingTitle: 'Cérès 20c noir 1849 — YT 3 oblitéré',
      listingDomain: 'stamp',
      listingValue: 95,
      offeredTitle: 'Semeuse lignée 15c vert — YT 130',
      offeredDomain: 'stamp',
      offeredValue: 12,
      cashAdjustment: 80,
      message: 'Bonjour, je complète par une soulte de 80 €.',
      state: 'proposed',
      createdAt: '2026-10-19T09:00:00Z',
      updatedAt: '2026-10-19T09:00:00Z',
    },
  ];
}

function seedCertifications(): DemoCertification[] {
  return [
    // EN COURS : expertise obligatoire de ma montre (> 500 €).
    {
      id: 'demo-cert-1',
      listingId: 'demo-mine-2',
      orderId: null,
      exchangeId: null,
      side: null,
      itemTitle: 'Omega Speedmaster Professional 3570.50',
      domain: 'watch',
      reason: 'threshold',
      status: 'in_review',
      feePayer: 'seller',
      feeAmount: 84,
      requesterId: DEMO_OWNER,
      counterpartyId: null,
      counterpartyAgreed: true,
      reportRef: null,
      expertNote: null,
      createdAt: '2026-10-15T09:05:00Z',
      decidedAt: null,
    },
    // ACCORD ATTENDU de ma part : l'acheteur de ma vente en cours souhaite une
    // expertise avant l'expédition (sur la commande, comme l'exige le serveur).
    {
      id: 'demo-cert-2',
      listingId: 'demo-mine-5',
      orderId: 'demo-order-4',
      exchangeId: null,
      side: null,
      itemTitle: 'Château Lynch-Bages 2005',
      domain: 'wine',
      reason: 'mutual_agreement',
      status: 'awaiting_agreement',
      feePayer: 'split',
      feeAmount: null,
      requesterId: 'demo-seller-e',
      counterpartyId: DEMO_OWNER,
      counterpartyAgreed: false,
      reportRef: null,
      expertNote: null,
      createdAt: '2026-10-20T09:10:00Z',
      decidedAt: null,
    },
  ];
}

type SeedMessage = Omit<DemoMessage, 'body' | 'redacted'> & { text: string };

function seedMessages(): DemoMessage[] {
  const raw: SeedMessage[] = [
    {
      id: 'demo-msg-1',
      threadKind: 'order',
      threadId: 'demo-order-1',
      authorId: 'demo-seller-d',
      text: 'Colis remis ce matin, bien calé dans une caisse bois. Bonne dégustation !',
      createdAt: '2026-10-06T09:00:00Z',
    },
    {
      id: 'demo-msg-2',
      threadKind: 'exchange',
      threadId: 'demo-exchange-1',
      authorId: 'demo-seller-c',
      text: 'D’autres photos sont sur mon site www.collection-jean.fr si besoin.',
      createdAt: '2026-10-18T09:20:00Z',
    },
    {
      id: 'demo-msg-3',
      threadKind: 'exchange',
      threadId: 'demo-exchange-2',
      authorId: DEMO_OWNER,
      text: 'Le Cérès a-t-il un aminci au verso ?',
      createdAt: '2026-10-19T09:15:00Z',
    },
  ];
  return raw.map(({ text, ...m }) => {
    const { text: body, redacted } = redactContactInfo(text);
    return { ...m, body, redacted };
  });
}

// ── Dépôt démo ───────────────────────────────────────────────────────────────

export interface DemoMarketplaceOptions {
  /** Latence simulée (ms) — 0 dans les tests. Défaut : 250. */
  delayMs?: number;
  /** Horloge injectable (ISO). */
  now?: () => string;
}

function invalid(message: string): never {
  throw new VelumError('INVALID_INPUT', `${message} (démo)`);
}

function cleanText(text: string | undefined): { text: string | null; redacted: boolean } {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return { text: null, redacted: false };
  return redactContactInfo(trimmed);
}

/** Estimation rapide éventuelle portée par l'objet (`attributes.quickEstimate`). */
function quickEstimateOf(item: VelumItem): number | null {
  const quick = item.attributes['quickEstimate'];
  if (typeof quick === 'number' && Number.isFinite(quick)) return quick;
  if (quick !== null && typeof quick === 'object' && !Array.isArray(quick)) {
    const central = (quick as Record<string, unknown>)['central'];
    if (typeof central === 'number' && Number.isFinite(central)) return central;
  }
  return null;
}

const OPEN_CERTIFICATION: ReadonlySet<CertificationStatus> = new Set([
  'awaiting_agreement',
  'requested',
  'in_review',
]);

/** Commande qui RÉSERVE l'annonce (paiement capturé, jusqu'au litige). */
const ENGAGING_ORDER: ReadonlySet<EscrowState> = new Set(['funds_held', 'shipped', 'disputed']);
/** Échange qui RÉSERVE l'annonce et l'objet proposé. */
const ENGAGING_EXCHANGE: ReadonlySet<ExchangeState> = new Set([
  'accepted',
  'awaiting_certification',
  'shipping',
  'disputed',
]);

export function createDemoMarketplaceRepo(
  findItem: (id: string) => VelumItem | null,
  options: DemoMarketplaceOptions = {},
): MarketplaceRepo {
  const delayMs = options.delayMs ?? 250;
  const now = options.now ?? (() => new Date().toISOString());
  let sequence = 0;
  // Préfixe distinct des données de départ : aucune collision d’identifiants.
  const newId = (prefix: string) => `demo-new-${prefix}-${++sequence}`;
  const tick = () =>
    delayMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();

  const listings = seedListings();
  const orders = seedOrders();
  const disputes: DisputeRecord[] = [];
  const exchanges = seedExchanges();
  const certifications = seedCertifications();
  const messages = seedMessages();

  // ── Vues anonymisées ──

  const toCatalogue = (l: ListingRecord): CatalogueListing => ({
    id: l.id,
    kind: l.kind,
    domain: l.domain,
    title: l.title,
    description: l.description,
    askPrice: l.askPrice,
    currency: l.currency,
    exchangeWishes: l.exchangeWishes,
    sellerAlias: aliasOf(l.sellerId),
    certified: l.certified,
    isMine: l.sellerId === DEMO_OWNER,
    createdAt: l.createdAt,
  });

  const orderView = (o: DemoOrder): MarketOrder => {
    const role = o.buyerId === DEMO_OWNER ? 'buyer' : 'seller';
    return {
      ...o,
      role,
      counterpartyAlias: aliasOf(role === 'buyer' ? o.sellerId : o.buyerId),
    };
  };

  const exchangeView = (e: DemoExchange): ExchangeProposal => {
    const role = e.proposerId === DEMO_OWNER ? 'proposer' : 'recipient';
    return {
      id: e.id,
      listingId: e.listingId,
      role,
      counterpartyAlias: aliasOf(role === 'proposer' ? e.recipientId : e.proposerId),
      listingTitle: e.listingTitle,
      listingDomain: e.listingDomain,
      listingValue: e.listingValue,
      offeredTitle: e.offeredTitle,
      offeredDomain: e.offeredDomain,
      offeredValue: e.offeredValue,
      cashAdjustment: e.cashAdjustment,
      currency: 'EUR',
      message: e.message,
      state: e.state,
      myCommission: role === 'proposer' ? e.proposerCommission : e.recipientCommission,
      certificationRequired: e.certificationRequired,
      proposerTracking: e.proposerTracking,
      recipientTracking: e.recipientTracking,
      proposerReceived: e.proposerReceived,
      recipientReceived: e.recipientReceived,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  };

  const certificationView = (c: DemoCertification): CertificationRequest => ({
    id: c.id,
    listingId: c.listingId,
    orderId: c.orderId,
    exchangeId: c.exchangeId,
    itemTitle: c.itemTitle,
    domain: c.domain,
    reason: c.reason,
    status: c.status,
    feePayer: c.feePayer,
    feeAmount: c.feeAmount,
    requestedByMe: c.requesterId === DEMO_OWNER,
    counterpartyAgreed: c.counterpartyAgreed,
    reportRef: c.reportRef,
    expertNote: c.expertNote,
    createdAt: c.createdAt,
    decidedAt: c.decidedAt,
  });

  const messageView = (m: DemoMessage): MarketMessage => ({
    id: m.id,
    threadKind: m.threadKind,
    threadId: m.threadId,
    mine: m.authorId === DEMO_OWNER,
    authorAlias: aliasOf(m.authorId),
    body: m.body,
    redacted: m.redacted,
    createdAt: m.createdAt,
  });

  // ── Accès internes ──

  const mySales = () =>
    orders.filter((o) => o.sellerId === DEMO_OWNER && o.escrowState === 'released').length;

  const salesOf = (memberId: string) =>
    memberId === DEMO_OWNER ? mySales() : (DEMO_REPUTATION[memberId]?.completedSales ?? 0);

  const findListing = (id: string): ListingRecord =>
    listings.find((l) => l.id === id) ?? invalid('Annonce introuvable');

  const findMyOrder = (id: string): DemoOrder => {
    const o = orders.find((x) => x.id === id);
    if (!o || (o.buyerId !== DEMO_OWNER && o.sellerId !== DEMO_OWNER)) invalid('Commande introuvable');
    return o;
  };

  const findMyExchange = (id: string): DemoExchange => {
    const e = exchanges.find((x) => x.id === id);
    if (!e || (e.proposerId !== DEMO_OWNER && e.recipientId !== DEMO_OWNER)) invalid('Échange introuvable');
    return e;
  };

  const requireExchangeAction = (e: DemoExchange, action: ExchangeAction) => {
    if (!exchangeActions(exchangeView(e)).includes(action)) {
      invalid(`Action « ${action} » impossible dans l’état ${e.state}`);
    }
  };

  const findMyCertification = (id: string): DemoCertification => {
    const c = certifications.find((x) => x.id === id);
    if (!c || (c.requesterId !== DEMO_OWNER && c.counterpartyId !== DEMO_OWNER)) {
      invalid('Certification introuvable');
    }
    return c;
  };

  const cancelOpenCertifications = (match: (c: DemoCertification) => boolean) => {
    for (const c of certifications) {
      if (match(c) && OPEN_CERTIFICATION.has(c.status)) {
        c.status = 'cancelled';
        c.decidedAt = now();
      }
    }
  };

  const touch = (e: DemoExchange) => {
    e.updatedAt = now();
  };

  /**
   * Miroir de listing_is_engaged : paiement capturé (commande funds_held →
   * litige) ou échange accepté en cours, sur l'annonce elle-même ou sur son
   * objet proposé ailleurs par le vendeur. Une commande non payée ne réserve pas.
   */
  const isEngaged = (listingId: string, except: { order?: string; exchange?: string } = {}): boolean => {
    const l = listings.find((x) => x.id === listingId);
    return (
      orders.some((o) => o.listingId === listingId && o.id !== except.order && ENGAGING_ORDER.has(o.escrowState)) ||
      exchanges.some(
        (e) =>
          e.id !== except.exchange &&
          ENGAGING_EXCHANGE.has(e.state) &&
          (e.listingId === listingId ||
            (l !== undefined && e.offeredItemId === l.itemId && e.proposerId === l.sellerId)),
      )
    );
  };

  /** Miroir de has_open_certification : l'expédition attend la décision de l'expert. */
  const hasOpenCertification = (ctx: { orderId?: string; exchangeId?: string }): boolean =>
    certifications.some(
      (c) =>
        OPEN_CERTIFICATION.has(c.status) &&
        ((ctx.orderId !== undefined && c.orderId === ctx.orderId) ||
          (ctx.exchangeId !== undefined && c.exchangeId === ctx.exchangeId)),
    );

  const threadInvolvesMe = (kind: MarketThreadKind, id: string): boolean => {
    if (kind === 'order') {
      const o = orders.find((x) => x.id === id);
      return o !== undefined && (o.buyerId === DEMO_OWNER || o.sellerId === DEMO_OWNER);
    }
    const e = exchanges.find((x) => x.id === id);
    return e !== undefined && (e.proposerId === DEMO_OWNER || e.recipientId === DEMO_OWNER);
  };

  const matches = (l: ListingRecord, q: CatalogueQuery, tokens: readonly string[]): boolean => {
    if (l.status !== 'active') return false;
    if (!q.includeMine && l.sellerId === DEMO_OWNER) return false;
    if (q.domain && l.domain !== q.domain) return false;
    if (q.mode === 'sale' && !isForSale(l.kind)) return false;
    if (q.mode === 'exchange' && !isOpenToExchange(l.kind)) return false;
    if (q.certifiedOnly && !l.certified) return false;
    if (q.minPrice !== undefined && l.askPrice < q.minPrice) return false;
    if (q.maxPrice !== undefined && l.askPrice > q.maxPrice) return false;
    if (tokens.length > 0) {
      const doc = { title: l.title ?? '', fields: [l.description, l.exchangeWishes] };
      if (scoreDocument(doc, tokens) === 0) return false;
    }
    return true;
  };

  return {
    async browseActive() {
      await tick();
      return listings
        .filter((l) => l.status === 'active' && l.sellerId !== DEMO_OWNER)
        .map((l) => ({ ...l }));
    },

    async catalogue(query = {}) {
      await tick();
      const tokens = tokenize(query.text ?? '');
      const found = listings.filter((l) => matches(l, query, tokens)).map(toCatalogue);
      const sort = query.sort ?? 'recent';
      found.sort((a, b) =>
        sort === 'price_asc'
          ? a.askPrice - b.askPrice
          : sort === 'price_desc'
            ? b.askPrice - a.askPrice
            : b.createdAt.localeCompare(a.createdAt),
      );
      return query.limit !== undefined ? found.slice(0, Math.max(0, query.limit)) : found;
    },

    async myListings() {
      await tick();
      return listings
        .filter((l) => l.sellerId === DEMO_OWNER)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => ({ ...l }));
    },

    async createListing(input: NewListing) {
      await tick();
      if (!Number.isFinite(input.askPrice) || input.askPrice <= 0) invalid('Prix invalide');
      const item = findItem(input.itemId) ?? invalid('Objet introuvable dans votre collection');
      const alreadyListed = listings.some(
        (l) =>
          l.itemId === input.itemId &&
          l.sellerId === DEMO_OWNER &&
          (l.status === 'active' || l.status === 'pending_certification'),
      );
      if (alreadyListed) invalid('Cet objet a déjà une annonce en cours');

      const kind = input.kind ?? 'sale';
      const requirement = certificationRequirement({
        value: input.askPrice,
        estimatedValue: quickEstimateOf(item),
      });
      const rec: ListingRecord = {
        id: newId('listing'),
        itemId: input.itemId,
        sellerId: DEMO_OWNER,
        askPrice: input.askPrice,
        currency: input.currency ?? 'EUR',
        status: requirement.required ? 'pending_certification' : 'active',
        title: item.title,
        domain: item.domain,
        kind,
        description: cleanText(input.description).text,
        exchangeWishes: isOpenToExchange(kind) ? cleanText(input.exchangeWishes).text : null,
        commissionRate: commissionRateFor(mySales()),
        certificationRequired: requirement.required,
        certified: false,
        createdAt: now(),
      };
      listings.unshift(rec);
      if (requirement.required) {
        certifications.unshift({
          id: newId('cert'),
          listingId: rec.id,
          orderId: null,
          exchangeId: null,
          side: null,
          itemTitle: rec.title,
          domain: rec.domain,
          reason: 'threshold',
          status: 'requested',
          feePayer: defaultCertificationFeePayer('threshold'),
          feeAmount: null,
          requesterId: DEMO_OWNER,
          counterpartyId: null,
          counterpartyAgreed: true,
          reportRef: null,
          expertNote: null,
          createdAt: now(),
          decidedAt: null,
        });
      }
      return { ...rec };
    },

    async withdrawListing(listingId: string) {
      await tick();
      const l = findListing(listingId);
      if (l.sellerId !== DEMO_OWNER) invalid('Annonce introuvable');
      if (!canWithdrawListing(l.status)) invalid('Annonce déjà vendue, échangée ou retirée');
      l.status = 'withdrawn';
      cancelOpenCertifications((c) => c.listingId === l.id);
      return { ...l };
    },

    async myOrders() {
      await tick();
      return orders
        .filter((o) => o.buyerId === DEMO_OWNER || o.sellerId === DEMO_OWNER)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(orderView);
    },

    async buy(listingId: string) {
      await tick();
      const l = findListing(listingId);
      if (l.status !== 'active') invalid('Annonce non disponible');
      if (!isForSale(l.kind)) invalid('Annonce ouverte à l’échange seulement');
      if (l.sellerId === DEMO_OWNER) invalid('On ne peut pas acheter sa propre annonce');
      const rec: DemoOrder = {
        id: newId('order'),
        listingId,
        buyerId: DEMO_OWNER,
        sellerId: l.sellerId,
        amount: l.askPrice,
        currency: l.currency,
        // Taux du vendeur FIGÉ à la création de l'annonce.
        commissionRate: l.commissionRate,
        escrowState: 'pending_payment',
        carrier: null,
        trackingNumber: null,
        deliveredAt: null,
        releasedAt: null,
        createdAt: now(),
        listingTitle: l.title,
        certificationRequired: l.certificationRequired,
      };
      orders.unshift(rec);
      // Annonce réservée : elle quitte le catalogue (rouverte si la commande est annulée).
      l.status = 'sold';
      return orderView(rec);
    },

    async advanceOrder(orderId: string, escrowState: EscrowState, patch) {
      await tick();
      const o = findMyOrder(orderId);
      const role = o.buyerId === DEMO_OWNER ? 'buyer' : 'seller';
      if (!canTransitionOrder(role, o.escrowState, escrowState)) {
        invalid(`Transition de séquestre interdite (${o.escrowState} → ${escrowState})`);
      }
      const tracking = patch?.trackingNumber?.trim() ?? '';
      if (escrowState === 'shipped' && tracking.length === 0) invalid('Numéro de suivi requis');
      // Miroir de guard_order_terms : la livraison est attestée par l'acheteur
      // (ou le transporteur), jamais par le vendeur — elle déclencherait sinon
      // l'auto-libération des fonds.
      if (patch?.deliveredAt !== undefined && role !== 'buyer') {
        invalid('Seul l’acheteur (ou le transporteur) atteste la livraison');
      }
      if (escrowState === 'shipped' && hasOpenCertification({ orderId: o.id })) {
        invalid('Expédition bloquée : une certification d’expert est en cours sur cette commande');
      }
      o.escrowState = escrowState;
      if (patch?.carrier !== undefined) o.carrier = patch.carrier;
      if (tracking.length > 0) o.trackingNumber = tracking;
      if (patch?.deliveredAt !== undefined) o.deliveredAt = patch.deliveredAt;
      if (escrowState === 'released') o.releasedAt = now();
      if (escrowState === 'cancelled') {
        const l = listings.find((x) => x.id === o.listingId);
        if (l && l.status === 'sold') l.status = 'active';
      }
      // SIMULATION démo : le vendeur expédie dès que les fonds sont sous séquestre.
      if (escrowState === 'funds_held' && role === 'buyer') {
        o.escrowState = 'shipped';
        o.carrier = 'Colissimo';
        o.trackingNumber = `DEMO${o.id.replace(/\D/g, '').padStart(9, '0')}FR`;
        o.deliveredAt = now();
      }
      return orderView(o);
    },

    async openDispute(orderId: string, reason: string) {
      await tick();
      const o = findMyOrder(orderId);
      const role = o.buyerId === DEMO_OWNER ? 'buyer' : 'seller';
      if (reason.trim().length === 0) invalid('Motif du litige requis');
      if (!canTransitionOrder(role, o.escrowState, 'disputed')) invalid('Litige impossible dans cet état');
      o.escrowState = 'disputed';
      const rec: DisputeRecord = {
        id: newId('dispute'),
        orderId,
        openedBy: DEMO_OWNER,
        reason: redactContactInfo(reason.trim()).text,
        status: 'open',
        resolutionNote: null,
        createdAt: now(),
        resolvedAt: null,
      };
      disputes.push(rec);
      return { ...rec };
    },

    async reputation(sellerId: string): Promise<SellerReputation> {
      await tick();
      const sold = orders.filter((o) => o.sellerId === sellerId);
      const completedSales = sold.filter((o) => o.escrowState === 'released').length;
      const disputesCount = disputes.filter((d) => sold.some((o) => o.id === d.orderId)).length;
      const closed = sold.filter((o) => o.escrowState === 'released' || o.escrowState === 'refunded').length;
      return {
        completedSales,
        refunded: sold.filter((o) => o.escrowState === 'refunded').length,
        disputes: disputesCount,
        disputeRate: closed > 0 ? disputesCount / closed : 0,
        memberSince: null,
      };
    },

    async getListing(listingId: string): Promise<CatalogueListing | null> {
      await tick();
      // Comme le serveur : une annonce active, la mienne, ou celle d'une de
      // mes transactions (réservée, vendue, échangée) reste consultable.
      const listing = listings.find((l) => l.id === listingId);
      if (!listing) return null;
      const visible =
        listing.status === 'active' ||
        listing.sellerId === DEMO_OWNER ||
        orders.some((o) => o.listingId === listing.id && o.buyerId === DEMO_OWNER) ||
        exchanges.some((e) => e.listingId === listing.id && e.proposerId === DEMO_OWNER);
      return visible ? toCatalogue(listing) : null;
    },

    async reputationByAlias(alias: string): Promise<SellerReputation> {
      await tick();
      const member = memberOfAlias(alias);
      if (member === DEMO_OWNER) {
        return { completedSales: mySales(), refunded: 0, disputes: 0, disputeRate: 0, memberSince: '2025-02-01T00:00:00Z' };
      }
      const rep = member !== null ? DEMO_REPUTATION[member] : undefined;
      return rep
        ? { ...rep }
        : { completedSales: 0, refunded: 0, disputes: 0, disputeRate: 0, memberSince: null };
    },

    // ── Échanges ──

    async proposeExchange(input) {
      await tick();
      const l = findListing(input.listingId);
      if (l.status !== 'active' || !isOpenToExchange(l.kind)) invalid('Annonce non ouverte à l’échange');
      if (l.sellerId === DEMO_OWNER) invalid('On ne peut pas proposer un échange sur sa propre annonce');
      if (!Number.isFinite(input.offeredValue) || input.offeredValue <= 0) invalid('Valeur déclarée invalide');
      const cash = input.cashAdjustment ?? 0;
      if (!Number.isFinite(cash)) invalid('Soulte invalide');
      const offered = findItem(input.offeredItemId) ?? invalid('Objet proposé introuvable dans votre collection');
      const pending = exchanges.some(
        (e) => e.listingId === l.id && e.proposerId === DEMO_OWNER && e.state === 'proposed',
      );
      if (pending) invalid('Une proposition est déjà en attente sur cette annonce');

      const requirement = certificationRequirement({ value: Math.max(l.askPrice, input.offeredValue) });
      const rec: DemoExchange = {
        id: newId('exchange'),
        listingId: l.id,
        proposerId: DEMO_OWNER,
        recipientId: l.sellerId,
        offeredItemId: offered.id,
        listingTitle: l.title,
        listingDomain: l.domain,
        listingValue: l.askPrice,
        offeredTitle: offered.title,
        offeredDomain: offered.domain,
        offeredValue: input.offeredValue,
        cashAdjustment: cash,
        message: cleanText(input.message).text,
        state: 'proposed',
        proposerCommission: null,
        recipientCommission: null,
        certificationRequired: requirement.required,
        proposerTracking: null,
        recipientTracking: null,
        proposerReceived: false,
        recipientReceived: false,
        createdAt: now(),
        updatedAt: now(),
      };
      exchanges.unshift(rec);
      return exchangeView(rec);
    },

    async myExchanges() {
      await tick();
      return exchanges
        .filter((e) => e.proposerId === DEMO_OWNER || e.recipientId === DEMO_OWNER)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(exchangeView);
    },

    async respondExchange(id: string, accept: boolean) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, accept ? 'accept' : 'decline');
      if (!accept) {
        e.state = 'declined';
        touch(e);
        return exchangeView(e);
      }
      // Commissions FIGÉES à l'acceptation : chacun sur la valeur de l'objet qu'il cède.
      e.proposerCommission = exchangeCommission(e.offeredValue, salesOf(e.proposerId)).commission;
      e.recipientCommission = exchangeCommission(e.listingValue, salesOf(e.recipientId)).commission;
      if (e.certificationRequired) {
        e.state = 'awaiting_certification';
        const thresholdOpen = certifications.some(
          (c) => c.exchangeId === e.id && OPEN_CERTIFICATION.has(c.status),
        );
        if (!thresholdOpen) {
          certifications.unshift({
            id: newId('cert'),
            listingId: null,
            orderId: null,
            exchangeId: e.id,
            side: 'listing',
            itemTitle: e.listingTitle,
            domain: e.listingDomain,
            reason: 'threshold',
            status: 'requested',
            feePayer: defaultCertificationFeePayer('threshold'),
            feeAmount: null,
            requesterId: DEMO_OWNER,
            counterpartyId: null,
            counterpartyAgreed: true,
            reportRef: null,
            expertNote: null,
            createdAt: now(),
            decidedAt: null,
          });
        }
      } else {
        // Comme exchange_after_change : l'état « accepté » n'est jamais
        // persisté, l'échange passe aussitôt en expédition.
        e.state = 'shipping';
      }
      touch(e);
      return exchangeView(e);
    },

    async withdrawExchange(id: string) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, 'withdraw');
      e.state = 'withdrawn';
      cancelOpenCertifications((c) => c.exchangeId === e.id);
      touch(e);
      return exchangeView(e);
    },

    async cancelExchange(id: string) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, 'cancel');
      e.state = 'cancelled';
      cancelOpenCertifications((c) => c.exchangeId === e.id);
      touch(e);
      return exchangeView(e);
    },

    async shipExchange(id: string, trackingNumber: string) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, 'ship');
      const tracking = trackingNumber.trim();
      if (tracking.length === 0) invalid('Numéro de suivi requis');
      if (e.proposerId === DEMO_OWNER) e.proposerTracking = tracking;
      else e.recipientTracking = tracking;
      e.state = 'shipping';
      // SIMULATION démo : l'autre partie expédie à son tour.
      const simulated = `DEMO${e.id.replace(/\D/g, '').padStart(9, '0')}FR`;
      if (e.proposerId === DEMO_OWNER) e.recipientTracking ??= simulated;
      else e.proposerTracking ??= simulated;
      touch(e);
      return exchangeView(e);
    },

    async confirmExchangeReceipt(id: string) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, 'confirm_receipt');
      const iAmProposer = e.proposerId === DEMO_OWNER;
      if (iAmProposer) e.proposerReceived = true;
      else e.recipientReceived = true;
      // SIMULATION démo : l'autre partie confirme aussi si j'ai expédié.
      const iShipped = (iAmProposer ? e.proposerTracking : e.recipientTracking) !== null;
      if (iShipped) {
        if (iAmProposer) e.recipientReceived = true;
        else e.proposerReceived = true;
      }
      if (e.proposerReceived && e.recipientReceived) {
        e.state = 'completed';
        const l = listings.find((x) => x.id === e.listingId);
        if (l) l.status = 'exchanged';
      }
      touch(e);
      return exchangeView(e);
    },

    async disputeExchange(id: string, reason: string) {
      await tick();
      const e = findMyExchange(id);
      requireExchangeAction(e, 'dispute');
      if (reason.trim().length === 0) invalid('Motif du litige requis');
      e.state = 'disputed';
      touch(e);
      return exchangeView(e);
    },

    // ── Certification ──

    async myCertifications() {
      await tick();
      return certifications
        .filter((c) => c.requesterId === DEMO_OWNER || c.counterpartyId === DEMO_OWNER)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(certificationView);
    },

    async requestCertification(input) {
      await tick();
      const contexts = [input.listingId, input.orderId, input.exchangeId].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
      if (contexts.length !== 1) invalid('Une annonce, une commande ou un échange doit être précisé');

      // Miroir de request_certification (contexte par contexte).
      const mutual = input.reason === 'mutual_agreement';
      const base = {
        id: newId('cert'),
        reason: input.reason,
        feeAmount: null,
        requesterId: DEMO_OWNER,
        reportRef: null,
        expertNote: null,
        createdAt: now(),
        decidedAt: null,
      };
      let rec: DemoCertification;
      if (input.listingId) {
        // Annonce : réservée à son vendeur (seuil ou démarche volontaire).
        const l =
          listings.find((x) => x.id === input.listingId && x.sellerId === DEMO_OWNER) ??
          invalid('Annonce introuvable parmi les vôtres');
        if (mutual) invalid('L’accord mutuel se demande sur une commande ou un échange');
        if (l.status !== 'draft' && l.status !== 'active' && l.status !== 'pending_certification') {
          invalid('Annonce close ou retirée');
        }
        if (l.certified) invalid('Objet déjà authentifié par un expert');
        if (input.reason === 'threshold' && !l.certificationRequired) {
          invalid('Annonce sous le seuil : demandez une certification volontaire');
        }
        if (isEngaged(l.id)) invalid('Annonce engagée dans une transaction : demandez l’expertise sur la transaction');
        const open = certifications.some(
          (c) => c.listingId === l.id && c.orderId === null && c.exchangeId === null && OPEN_CERTIFICATION.has(c.status),
        );
        if (open) invalid('Une demande de certification est déjà ouverte');
        rec = {
          ...base,
          listingId: l.id,
          orderId: null,
          exchangeId: null,
          side: null,
          itemTitle: l.title,
          domain: l.domain,
          status: 'requested',
          feePayer: 'seller',
          counterpartyId: null,
          counterpartyAgreed: true,
        };
      } else if (input.orderId) {
        // Commande : d'un commun accord, avant expédition.
        const o = findMyOrder(input.orderId);
        if (!mutual) invalid('Sur une commande, la certification se décide d’un commun accord');
        if (o.escrowState !== 'pending_payment' && o.escrowState !== 'funds_held') {
          invalid('Trop tard : l’objet est déjà expédié ou la commande est close');
        }
        const l = listings.find((x) => x.id === o.listingId);
        if (l?.certified) invalid('Objet déjà authentifié par un expert avant publication');
        if (hasOpenCertification({ orderId: o.id })) invalid('Une demande de certification est déjà ouverte');
        rec = {
          ...base,
          listingId: o.listingId,
          orderId: o.id,
          exchangeId: null,
          side: null,
          itemTitle: o.listingTitle,
          domain: l?.domain ?? null,
          status: 'awaiting_agreement',
          feePayer: input.feePayer ?? 'split',
          counterpartyId: o.buyerId === DEMO_OWNER ? o.sellerId : o.buyerId,
          counterpartyAgreed: false,
        };
      } else {
        // Échange : d'un commun accord, une fois accepté et avant tout envoi ;
        // l'objet expertisé est celui que je REÇOIS.
        const e = findMyExchange(input.exchangeId ?? '');
        if (!mutual) invalid('Sur un échange, la certification se décide d’un commun accord');
        const ongoing = e.state === 'accepted' || e.state === 'awaiting_certification' || e.state === 'shipping';
        if (!ongoing || e.proposerTracking !== null || e.recipientTracking !== null) {
          invalid('Trop tard : un objet est déjà expédié, ou l’échange n’est pas en cours');
        }
        const iAmProposer = e.proposerId === DEMO_OWNER;
        const side = iAmProposer ? 'listing' : 'offered';
        if (side === 'listing' && listings.find((x) => x.id === e.listingId)?.certified) {
          invalid('Objet déjà authentifié par un expert');
        }
        const already = certifications.some(
          (c) => c.exchangeId === e.id && c.side === side && (OPEN_CERTIFICATION.has(c.status) || c.status === 'certified'),
        );
        if (already) invalid('Certification déjà obtenue ou demandée pour cet objet');
        rec = {
          ...base,
          listingId: null,
          orderId: null,
          exchangeId: e.id,
          side,
          itemTitle: side === 'listing' ? e.listingTitle : e.offeredTitle,
          domain: side === 'listing' ? e.listingDomain : e.offeredDomain,
          status: 'awaiting_agreement',
          feePayer: input.feePayer ?? 'split',
          counterpartyId: iAmProposer ? e.recipientId : e.proposerId,
          counterpartyAgreed: false,
        };
      }
      certifications.unshift(rec);
      return certificationView(rec);
    },

    async respondCertification(id: string, agree: boolean) {
      await tick();
      const c = findMyCertification(id);
      if (!certificationActions(certificationView(c)).includes(agree ? 'agree' : 'refuse')) {
        invalid('Réponse impossible pour cette demande');
      }
      c.counterpartyAgreed = agree;
      if (!agree) {
        c.status = 'cancelled';
        c.decidedAt = now();
        return certificationView(c);
      }
      c.status = 'requested';
      // Expertise désormais convenue : elle conditionne l'expédition de
      // l'échange (certification_after_change : expédition → attente d'expertise).
      const e = c.exchangeId ? exchanges.find((x) => x.id === c.exchangeId) : undefined;
      if (e && (e.state === 'accepted' || e.state === 'awaiting_certification' || e.state === 'shipping')) {
        e.certificationRequired = true;
        if (e.state === 'shipping') e.state = 'awaiting_certification';
        touch(e);
      }
      const o = c.orderId ? orders.find((x) => x.id === c.orderId) : undefined;
      if (o) o.certificationRequired = true;
      return certificationView(c);
    },

    async cancelCertification(id: string) {
      await tick();
      const c = findMyCertification(id);
      if (!certificationActions(certificationView(c)).includes('cancel')) {
        invalid('Annulation impossible pour cette demande');
      }
      c.status = 'cancelled';
      c.decidedAt = now();
      // Plus aucune expertise demandée ou en cours : l'échange reprend son
      // expédition (_exchange_resume_after_certification).
      const e = c.exchangeId ? exchanges.find((x) => x.id === c.exchangeId) : undefined;
      const stillOpen = certifications.some(
        (x) => x.exchangeId === c.exchangeId && (x.status === 'requested' || x.status === 'in_review'),
      );
      if (e && e.state === 'awaiting_certification' && !stillOpen) {
        e.state = 'shipping';
        touch(e);
      }
      // Sans l'expertise obligatoire, l'annonce ne peut pas être publiée : retrait.
      if (c.reason === 'threshold' && c.listingId) {
        const l = listings.find((x) => x.id === c.listingId);
        if (l && l.status === 'pending_certification') l.status = 'withdrawn';
      }
      return certificationView(c);
    },

    // ── Messagerie anonymisée ──

    async messages(threadKind, threadId) {
      await tick();
      if (!threadInvolvesMe(threadKind, threadId)) invalid('Fil de discussion introuvable');
      return messages
        .filter((m) => m.threadKind === threadKind && m.threadId === threadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(messageView);
    },

    async sendMessage(threadKind, threadId, body) {
      await tick();
      if (!threadInvolvesMe(threadKind, threadId)) invalid('Fil de discussion introuvable');
      const trimmed = body.trim();
      if (trimmed.length === 0) invalid('Message vide');
      if (trimmed.length > 2000) invalid('Message trop long');
      const { text, redacted } = redactContactInfo(trimmed);
      const rec: DemoMessage = {
        id: newId('msg'),
        threadKind,
        threadId,
        authorId: DEMO_OWNER,
        body: text,
        redacted,
        createdAt: now(),
      };
      messages.push(rec);
      return messageView(rec);
    },
  };
}
