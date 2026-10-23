/**
 * Plateformes d'échange et de vente — implémentation DÉMO en mémoire du
 * contrat MarketplaceRepo (@velum/api-client). Reproduit les règles serveur
 * essentielles (anonymat par pseudonyme, états légaux) sans backend.
 */
import type { MarketplaceRepo, NewListing } from '@velum/api-client';
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
  type SellerReputation,
  type VelumItem,
} from '@velum/core';

import { DEMO_OWNER, nowIso } from './demoData';

/** Pseudonymes démo des autres collectionneurs (jamais d'identité réelle). */
const DEMO_ALIASES: Record<string, string> = {
  'demo-seller-a': 'Collectionneur 7F3A',
  'demo-seller-b': 'Collectionneuse B21C',
  [DEMO_OWNER]: 'Vous',
};

function aliasOf(memberId: string): string {
  return DEMO_ALIASES[memberId] ?? 'Membre VELUM';
}

/** Masquage minimal des coordonnées (le serveur applique la règle complète). */
function redact(text: string): { body: string; redacted: boolean } {
  const masked = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[coordonnées masquées]')
    .replace(/(?:\+?\d[\s.-]?){8,}/g, '[coordonnées masquées]')
    .replace(/https?:\/\/\S+/g, '[coordonnées masquées]');
  return { body: masked, redacted: masked !== text };
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 250));
}

function seedListings(): ListingRecord[] {
  const base = {
    currency: 'EUR',
    status: 'active' as const,
    description: null,
    exchangeWishes: null,
    commissionRate: 0.05,
    certificationRequired: false,
    certified: false,
  };
  return [
    {
      ...base,
      id: 'demo-listing-1',
      itemId: 'demo-mkt-1',
      sellerId: 'demo-seller-a',
      askPrice: 320,
      kind: 'sale_or_exchange',
      title: 'Napoléon III 20 Francs Or 1868',
      domain: 'coin',
      exchangeWishes: 'Pièces or Second Empire, ou 10 Francs Coq',
      createdAt: '2026-07-08T00:00:00Z',
    },
    {
      ...base,
      id: 'demo-listing-2',
      itemId: 'demo-mkt-2',
      sellerId: 'demo-seller-b',
      askPrice: 780,
      kind: 'sale',
      title: 'Bloc CITEX 1949 neuf — authentifié',
      domain: 'stamp',
      certificationRequired: true,
      certified: true,
      createdAt: '2026-07-03T00:00:00Z',
    },
  ];
}

export function createDemoMarketplaceRepo(
  findItem: (id: string) => VelumItem | null,
): MarketplaceRepo {
  const listings: ListingRecord[] = seedListings();
  const orders: (MarketOrder & { buyerId: string; sellerId: string })[] = [];
  const disputes: DisputeRecord[] = [];
  const exchanges: ExchangeProposal[] = [];
  const certifications: CertificationRequest[] = [];
  const messages: MarketMessage[] = [];

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

  const matches = (l: ListingRecord, q: CatalogueQuery): boolean => {
    if (l.status !== 'active') return false;
    if (!q.includeMine && l.sellerId === DEMO_OWNER) return false;
    if (q.domain && l.domain !== q.domain) return false;
    if (q.mode === 'sale' && l.kind === 'exchange') return false;
    if (q.mode === 'exchange' && l.kind === 'sale') return false;
    if (q.certifiedOnly && !l.certified) return false;
    if (q.minPrice !== undefined && l.askPrice < q.minPrice) return false;
    if (q.maxPrice !== undefined && l.askPrice > q.maxPrice) return false;
    if (q.text) {
      const needle = q.text.toLowerCase();
      const hay = `${l.title ?? ''} ${l.description ?? ''} ${l.exchangeWishes ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };

  const findExchange = (id: string): ExchangeProposal => {
    const ex = exchanges.find((e) => e.id === id);
    if (!ex) throw new VelumError('INVALID_INPUT', 'Échange introuvable (démo)');
    return ex;
  };

  const findCertification = (id: string): CertificationRequest => {
    const c = certifications.find((x) => x.id === id);
    if (!c) throw new VelumError('INVALID_INPUT', 'Certification introuvable (démo)');
    return c;
  };

  return {
    async browseActive() {
      await tick();
      return listings.filter((l) => l.status === 'active' && l.sellerId !== DEMO_OWNER);
    },

    async catalogue(query = {}) {
      await tick();
      const found = listings.filter((l) => matches(l, query)).map(toCatalogue);
      const sort = query.sort ?? 'recent';
      found.sort((a, b) =>
        sort === 'price_asc'
          ? a.askPrice - b.askPrice
          : sort === 'price_desc'
            ? b.askPrice - a.askPrice
            : b.createdAt.localeCompare(a.createdAt),
      );
      return query.limit !== undefined ? found.slice(0, query.limit) : found;
    },

    async myListings() {
      return listings.filter((l) => l.sellerId === DEMO_OWNER);
    },

    async createListing(input: NewListing) {
      const item = findItem(input.itemId);
      const rec: ListingRecord = {
        id: uid('list'),
        itemId: input.itemId,
        sellerId: DEMO_OWNER,
        askPrice: input.askPrice,
        currency: input.currency ?? 'EUR',
        status: 'active',
        title: item?.title ?? null,
        domain: item?.domain ?? null,
        kind: input.kind ?? 'sale',
        description: input.description ? redact(input.description).body : null,
        exchangeWishes: input.exchangeWishes ? redact(input.exchangeWishes).body : null,
        commissionRate: 0.05,
        certificationRequired: false,
        certified: false,
        createdAt: nowIso(),
      };
      listings.unshift(rec);
      return rec;
    },

    async withdrawListing(listingId: string) {
      const l = listings.find((x) => x.id === listingId && x.sellerId === DEMO_OWNER);
      if (!l) throw new VelumError('INVALID_INPUT', 'Annonce introuvable (démo)');
      l.status = 'withdrawn';
      return l;
    },

    async myOrders() {
      return orders.filter((o) => o.buyerId === DEMO_OWNER || o.sellerId === DEMO_OWNER);
    },

    async buy(listingId: string) {
      await tick();
      const l = listings.find((x) => x.id === listingId);
      if (!l) throw new VelumError('INVALID_INPUT', 'Annonce introuvable (démo)');
      const rec = {
        id: uid('ord'),
        listingId,
        buyerId: DEMO_OWNER,
        sellerId: l.sellerId,
        amount: l.askPrice,
        currency: l.currency,
        commissionRate: l.commissionRate,
        escrowState: 'pending_payment' as EscrowState,
        carrier: null,
        trackingNumber: null,
        deliveredAt: null,
        releasedAt: null,
        createdAt: nowIso(),
        role: 'buyer' as const,
        counterpartyAlias: aliasOf(l.sellerId),
        listingTitle: l.title,
        certificationRequired: l.certificationRequired,
      };
      orders.unshift(rec);
      return rec;
    },

    async advanceOrder(orderId: string, escrowState: EscrowState, patch) {
      const o = orders.find((x) => x.id === orderId);
      if (!o) throw new VelumError('INVALID_INPUT', 'Commande introuvable (démo)');
      o.escrowState = escrowState;
      if (patch?.carrier !== undefined) o.carrier = patch.carrier;
      if (patch?.trackingNumber !== undefined) o.trackingNumber = patch.trackingNumber;
      if (patch?.deliveredAt !== undefined) o.deliveredAt = patch.deliveredAt;
      if (escrowState === 'released') o.releasedAt = nowIso();
      return o;
    },

    async openDispute(orderId: string, reason: string) {
      const o = orders.find((x) => x.id === orderId);
      if (o) o.escrowState = 'disputed';
      const rec: DisputeRecord = {
        id: uid('disp'),
        orderId,
        openedBy: DEMO_OWNER,
        reason,
        status: 'open',
        resolutionNote: null,
        createdAt: nowIso(),
        resolvedAt: null,
      };
      disputes.push(rec);
      return rec;
    },

    async reputation(sellerId: string): Promise<SellerReputation> {
      const mine = orders.filter((o) => o.sellerId === sellerId);
      return {
        completedSales: mine.filter((o) => o.escrowState === 'released').length,
        refunded: mine.filter((o) => o.escrowState === 'refunded').length,
        disputes: disputes.filter((d) => mine.some((o) => o.id === d.orderId)).length,
        disputeRate: 0,
        memberSince: '2024-01-01T00:00:00Z',
      };
    },

    async reputationByAlias(): Promise<SellerReputation> {
      return {
        completedSales: 12,
        refunded: 0,
        disputes: 0,
        disputeRate: 0,
        memberSince: '2024-01-01T00:00:00Z',
      };
    },

    async proposeExchange(input) {
      await tick();
      const l = listings.find((x) => x.id === input.listingId);
      if (!l || l.kind === 'sale') {
        throw new VelumError('INVALID_INPUT', 'Annonce non ouverte à l’échange (démo)');
      }
      const offered = findItem(input.offeredItemId);
      const rec: ExchangeProposal = {
        id: uid('exch'),
        listingId: l.id,
        role: 'proposer',
        counterpartyAlias: aliasOf(l.sellerId),
        listingTitle: l.title,
        listingDomain: l.domain,
        listingValue: l.askPrice,
        offeredTitle: offered?.title ?? null,
        offeredDomain: offered?.domain ?? null,
        offeredValue: input.offeredValue,
        cashAdjustment: input.cashAdjustment ?? 0,
        currency: 'EUR',
        message: input.message ? redact(input.message).body : null,
        state: 'proposed',
        myCommission: null,
        certificationRequired: false,
        proposerTracking: null,
        recipientTracking: null,
        proposerReceived: false,
        recipientReceived: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      exchanges.unshift(rec);
      return rec;
    },

    async myExchanges() {
      return [...exchanges];
    },

    async respondExchange(id: string, accept: boolean) {
      const ex = findExchange(id);
      ex.state = accept ? 'shipping' : 'declined';
      ex.updatedAt = nowIso();
      return ex;
    },

    async withdrawExchange(id: string) {
      const ex = findExchange(id);
      ex.state = 'withdrawn';
      ex.updatedAt = nowIso();
      return ex;
    },

    async cancelExchange(id: string) {
      const ex = findExchange(id);
      ex.state = 'cancelled';
      ex.updatedAt = nowIso();
      return ex;
    },

    async shipExchange(id: string, trackingNumber: string) {
      const ex = findExchange(id);
      if (ex.role === 'proposer') ex.proposerTracking = trackingNumber;
      else ex.recipientTracking = trackingNumber;
      ex.updatedAt = nowIso();
      return ex;
    },

    async confirmExchangeReceipt(id: string) {
      const ex = findExchange(id);
      if (ex.role === 'proposer') ex.proposerReceived = true;
      else ex.recipientReceived = true;
      if (ex.proposerReceived && ex.recipientReceived) ex.state = 'completed';
      ex.updatedAt = nowIso();
      return ex;
    },

    async disputeExchange(id: string) {
      const ex = findExchange(id);
      ex.state = 'disputed';
      ex.updatedAt = nowIso();
      return ex;
    },

    async myCertifications() {
      return [...certifications];
    },

    async requestCertification(input) {
      const listing = input.listingId ? listings.find((l) => l.id === input.listingId) : undefined;
      const rec: CertificationRequest = {
        id: uid('cert'),
        listingId: input.listingId ?? null,
        orderId: input.orderId ?? null,
        exchangeId: input.exchangeId ?? null,
        itemTitle: listing?.title ?? null,
        domain: listing?.domain ?? null,
        reason: input.reason,
        status: input.reason === 'mutual_agreement' ? 'awaiting_agreement' : 'requested',
        feePayer: input.feePayer ?? 'seller',
        feeAmount: null,
        requestedByMe: true,
        counterpartyAgreed: input.reason !== 'mutual_agreement',
        reportRef: null,
        expertNote: null,
        createdAt: nowIso(),
        decidedAt: null,
      };
      certifications.unshift(rec);
      return rec;
    },

    async respondCertification(id: string, agree: boolean) {
      const c = findCertification(id);
      c.counterpartyAgreed = agree;
      c.status = agree ? 'requested' : 'cancelled';
      return c;
    },

    async cancelCertification(id: string) {
      const c = findCertification(id);
      c.status = 'cancelled';
      return c;
    },

    async messages(threadKind, threadId) {
      return messages.filter((m) => m.threadKind === threadKind && m.threadId === threadId);
    },

    async sendMessage(threadKind, threadId, body) {
      const { body: safe, redacted } = redact(body);
      const rec: MarketMessage = {
        id: uid('msg'),
        threadKind,
        threadId,
        mine: true,
        authorAlias: aliasOf(DEMO_OWNER),
        body: safe,
        redacted,
        createdAt: nowIso(),
      };
      messages.push(rec);
      return rec;
    },
  };
}
