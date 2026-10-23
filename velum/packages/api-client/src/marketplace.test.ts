import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError, type VelumErrorCode } from '@velum/core';
import {
  createMarketplaceRepo,
  fetchCommissionSummary,
  MARKET_CARRIERS,
  MARKET_MAX_AMOUNT,
  MARKET_MESSAGE_MAX_LENGTH,
  normalizeCarrier,
  normalizeTrackingNumber,
  toMarketplaceError,
  type MarketplaceRepo,
} from './marketplace';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

const ME = 'usr-1';

/** Échec attendu avec un code VelumError précis. */
async function expectCode(promise: Promise<unknown>, code: VelumErrorCode): Promise<Error> {
  const error = await promise.then(
    () => {
      throw new Error(`échec attendu (${code}) mais succès`);
    },
    (e: unknown) => e,
  );
  expect(isVelumError(error)).toBe(true);
  expect((error as { code: string }).code).toBe(code);
  return error as Error;
}

function catalogueRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'l1',
    kind: 'sale_or_exchange',
    domain: 'coin',
    title: 'Napoléon III 20 Francs Or 1868',
    description: 'Très bel exemplaire, appelez-moi au [coordonnées masquées]',
    ask_price: '320.00',
    currency: 'EUR',
    exchange_wishes: 'Pièces or Second Empire',
    seller_alias: 'Collectionneur 7F3A',
    certified: false,
    certification_required: false,
    is_mine: false,
    created_at: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

function orderView(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'o1',
    listing_id: 'l4',
    buyer_id: ME,
    seller_id: null,
    amount: '200.00',
    currency: 'EUR',
    commission_rate: '0.0500',
    escrow_state: 'pending_payment',
    carrier: null,
    tracking_number: null,
    delivered_at: null,
    released_at: null,
    created_at: '2026-10-21T08:00:00Z',
    role: 'buyer',
    counterparty_alias: 'Collectionneur 7F3A',
    listing_title: 'Écu Louis XV 1726',
    listing_domain: 'coin',
    certification_required: false,
    listing_certified: false,
    ...overrides,
  };
}

function exchangeView(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x1',
    listing_id: 'l1',
    role: 'proposer',
    counterparty_alias: 'Collectionneur 7F3A',
    listing_title: 'Napoléon III 20 Francs Or 1868',
    listing_domain: 'coin',
    listing_value: '320.00',
    offered_title: 'Marianne 10 Francs or 1907',
    offered_domain: 'coin',
    offered_value: '300.00',
    cash_adjustment: '20.00',
    currency: 'EUR',
    message: 'Bonjour, écrivez-moi à [coordonnées masquées]',
    state: 'proposed',
    my_commission: null,
    certification_required: false,
    listing_certified: false,
    offered_item_id: 'i5',
    offered_item_certified: false,
    proposer_tracking: null,
    recipient_tracking: null,
    proposer_received: false,
    recipient_received: false,
    expires_at: '2026-10-28T08:00:00Z',
    created_at: '2026-10-21T08:00:00Z',
    updated_at: '2026-10-21T08:00:00Z',
    ...overrides,
  };
}

function certificationView(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c1',
    listing_id: 'l4',
    order_id: 'o1',
    exchange_id: null,
    item_title: 'Écu Louis XV 1726',
    domain: 'coin',
    reason: 'mutual_agreement',
    status: 'awaiting_agreement',
    fee_payer: 'split',
    fee_amount: null,
    requested_by_me: true,
    counterparty_agreed: false,
    report_ref: null,
    expert_note: null,
    created_at: '2026-10-21T09:00:00Z',
    decided_at: null,
    ...overrides,
  };
}

describe('marketplace repo — annonces', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase(() => '2026-10-23T12:00:00.000Z');
    fake.session = { user: { id: ME } };
    fake.tables['listings'] = [
      { id: 'l2', item_id: 'i2', seller_id: ME, ask_price: 80, currency: 'EUR', status: 'draft', title: 'Timbre', domain: 'stamp', commission_rate: 0.05, expert_appraisal_required: false, expert_appraisal_ref: null, kind: 'sale', created_at: '2026-07-02T00:00:00Z' },
      { id: 'l3', item_id: 'i3', seller_id: ME, ask_price: 780, currency: 'EUR', status: 'pending_certification', title: 'Bloc CITEX', domain: 'stamp', commission_rate: 0.05, expert_appraisal_required: true, expert_appraisal_ref: null, kind: 'sale_or_exchange', created_at: '2026-07-03T00:00:00Z' },
      { id: 'l9', item_id: 'i9', seller_id: 'usr-2', ask_price: 300, currency: 'EUR', status: 'active', title: 'Pièce or', domain: 'coin', commission_rate: 0.05, expert_appraisal_required: false, expert_appraisal_ref: null, created_at: '2026-07-01T00:00:00Z' },
    ];
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('catalogue appelle market_catalogue avec des filtres explicites et mappe la vue anonymisée', async () => {
    fake.rpcResponses['market_catalogue'] = { data: [catalogueRow(), catalogueRow({ id: 'l2', certified: true, is_mine: true, kind: null, seller_alias: null })] };
    const rows = await repo.catalogue({ domain: 'coin', mode: 'exchange', text: '  napoléon ', maxPrice: 400, certifiedOnly: true, sort: 'price_asc', limit: 12.7 });
    expect(fake.rpcCalls).toEqual([
      {
        fn: 'market_catalogue',
        args: {
          p_domain: 'coin',
          p_mode: 'exchange',
          p_text: 'napoléon',
          p_min_price: null,
          p_max_price: 400,
          p_certified_only: true,
          p_include_mine: false,
          p_sort: 'price_asc',
          p_limit: 12,
        },
      },
    ]);
    expect(rows[0]).toEqual({
      id: 'l1',
      kind: 'sale_or_exchange',
      domain: 'coin',
      title: 'Napoléon III 20 Francs Or 1868',
      description: 'Très bel exemplaire, appelez-moi au [coordonnées masquées]',
      askPrice: 320,
      currency: 'EUR',
      exchangeWishes: 'Pièces or Second Empire',
      sellerAlias: 'Collectionneur 7F3A',
      certified: false,
      isMine: false,
      createdAt: '2026-10-20T10:00:00Z',
    });
    // Valeurs absentes : repli prudent, jamais d'identifiant de membre.
    expect(rows[1]).toMatchObject({ kind: 'sale', sellerAlias: 'Membre VELUM', certified: true, isMine: true });
    expect(Object.keys(rows[0] ?? {})).not.toContain('sellerId');
  });

  it('catalogue sans filtre : valeurs par défaut (texte vide ⇒ null, tri récent)', async () => {
    fake.rpcResponses['market_catalogue'] = { data: [] };
    await expect(repo.catalogue({ text: '   ' })).resolves.toEqual([]);
    expect(fake.rpcCalls[0]?.args).toMatchObject({ p_text: null, p_sort: 'recent', p_limit: null, p_domain: null, p_mode: null });
  });

  it('catalogue hors Platine ⇒ PLAN_REQUIRED (jamais une liste vide)', async () => {
    fake.rpcResponses['market_catalogue'] = { error: { message: 'réservé Platine', code: 'VL402' } };
    await expectCode(repo.catalogue(), 'PLAN_REQUIRED');
  });

  it('catalogue en panne ⇒ SOURCE_UNAVAILABLE (distinct du vide)', async () => {
    fake.offline = true;
    await expectCode(repo.catalogue(), 'SOURCE_UNAVAILABLE');
  });

  it('browseActive (déprécié) s’appuie sur le catalogue, sans identifiants exposés', async () => {
    fake.rpcResponses['market_catalogue'] = { data: [catalogueRow({ certified: true, certification_required: true })] };
    const listings = await repo.browseActive();
    expect(fake.rpcCalls[0]?.fn).toBe('market_catalogue');
    expect(listings).toEqual([
      expect.objectContaining({ id: 'l1', itemId: '', sellerId: '', status: 'active', askPrice: 320, commissionRate: 0, certified: true, certificationRequired: true }),
    ]);
  });

  it('myListings filtre sur le vendeur de la session (tous statuts)', async () => {
    const mine = await repo.myListings();
    expect(mine.map((l) => l.id).sort()).toEqual(['l2', 'l3']);
    expect(mine.find((l) => l.id === 'l3')).toMatchObject({ status: 'pending_certification', certificationRequired: true, certified: false, kind: 'sale_or_exchange' });
  });

  it('createListing n’impose aucun statut : le serveur décide', async () => {
    await repo.createListing({ itemId: 'i8', askPrice: 250, kind: 'exchange', exchangeWishes: 'Timbres classiques' });
    const inserted = (fake.tables['listings'] ?? []).find((r) => r['item_id'] === 'i8');
    expect(inserted).toMatchObject({ seller_id: ME, ask_price: 250, currency: 'EUR', kind: 'exchange', exchange_wishes: 'Timbres classiques' });
    expect(inserted).not.toHaveProperty('status');
  });

  it('createListing refuse localement un prix invalide (aucun appel)', async () => {
    await expectCode(repo.createListing({ itemId: 'i8', askPrice: Number.NaN }), 'INVALID_INPUT');
    await expectCode(repo.createListing({ itemId: 'i8', askPrice: -1 }), 'INVALID_INPUT');
    expect((fake.tables['listings'] ?? []).length).toBe(3);
  });

  it('withdrawListing retire MON annonce, refuse celle d’autrui', async () => {
    const withdrawn = await repo.withdrawListing('l2');
    expect(withdrawn.status).toBe('withdrawn');
    expect(fake.row('listings', 'l2')?.['status']).toBe('withdrawn');
    await expectCode(repo.withdrawListing('l9'), 'INVALID_INPUT');
    expect(fake.row('listings', 'l9')?.['status']).toBe('active');
  });

  it('exige une session', async () => {
    fake.session = null;
    await expectCode(repo.myListings(), 'UNAUTHORIZED');
    await expectCode(repo.catalogue(), 'UNAUTHORIZED');
    expect(fake.rpcCalls).toEqual([]);
  });
});

describe('marketplace repo — commandes', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.session = { user: { id: ME } };
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('myOrders lit la vue anonymisée : rôle et pseudonyme, identifiant d’autrui masqué', async () => {
    fake.rpcResponses['my_market_orders'] = {
      data: [
        orderView(),
        orderView({ id: 'o2', role: 'seller', buyer_id: null, seller_id: ME, counterparty_alias: 'Collectionneur B21C', certification_required: true }),
        // Annonce déjà certifiée : aucune demande d'expertise recevable sur la commande.
        orderView({ id: 'o3', listing_certified: true }),
      ],
    };
    const orders = await repo.myOrders();
    expect(fake.rpcCalls[0]).toEqual({ fn: 'my_market_orders', args: {} });
    expect(orders[0]).toEqual({
      id: 'o1',
      listingId: 'l4',
      buyerId: ME,
      sellerId: '',
      amount: 200,
      currency: 'EUR',
      commissionRate: 0.05,
      escrowState: 'pending_payment',
      carrier: null,
      trackingNumber: null,
      deliveredAt: null,
      releasedAt: null,
      createdAt: '2026-10-21T08:00:00Z',
      role: 'buyer',
      counterpartyAlias: 'Collectionneur 7F3A',
      listingTitle: 'Écu Louis XV 1726',
      certificationRequired: false,
      listingCertified: false,
    });
    expect(orders[1]).toMatchObject({ role: 'seller', buyerId: '', sellerId: ME, certificationRequired: true });
    expect(orders[2]).toMatchObject({ certificationRequired: false, listingCertified: true });
  });

  it('buy passe par market_buy ; un refus métier devient INVALID_INPUT avec le motif serveur', async () => {
    fake.rpcResponses['market_buy'] = (args) =>
      args['p_listing'] === 'l4'
        ? { data: [orderView()] }
        : { error: { message: 'Annonce déjà réservée par un autre membre', code: 'P0001' } };
    await expect(repo.buy('l4')).resolves.toMatchObject({ id: 'o1', role: 'buyer' });
    const error = await expectCode(repo.buy('l6'), 'INVALID_INPUT');
    expect(error.message).toBe('Achat impossible : Annonce déjà réservée par un autre membre');
  });

  it('advanceOrder transmet l’état et le suivi (null si absents)', async () => {
    fake.rpcResponses['advance_market_order'] = { data: [orderView({ escrow_state: 'shipped', role: 'seller' })] };
    const order = await repo.advanceOrder('o1', 'shipped', { carrier: ' chronopost ', trackingNumber: ' xy 1234 5678 9fr ' });
    expect(fake.rpcCalls[0]).toEqual({
      fn: 'advance_market_order',
      args: { p_order: 'o1', p_state: 'shipped', p_carrier: 'Chronopost', p_tracking: 'XY123456789FR', p_delivered_at: null },
    });
    expect(order.escrowState).toBe('shipped');
    await repo.advanceOrder('o1', 'released');
    expect(fake.rpcCalls[1]?.args).toMatchObject({ p_carrier: null, p_tracking: null, p_delivered_at: null });
  });

  it('advanceOrder : une transition refusée par le serveur n’est pas une panne', async () => {
    fake.rpcResponses['advance_market_order'] = {
      error: { message: 'Expédition bloquée : une certification d’expert est en cours sur cette commande', code: 'P0001' },
    };
    await expectCode(repo.advanceOrder('o1', 'shipped', { trackingNumber: 'XY01' }), 'INVALID_INPUT');
  });

  it('advanceOrder : suivi et transporteur au format contrôlé, refus local (aucun appel)', async () => {
    // Le suivi est lu par l'autre partie : ni e-mail, ni phrase, ni transporteur libre.
    const email = await expectCode(
      repo.advanceOrder('o1', 'shipped', { trackingNumber: 'alice.martin@gmail.com' }),
      'INVALID_INPUT',
    );
    expect(email.message).toContain('Numéro de suivi invalide');
    await expectCode(repo.advanceOrder('o1', 'shipped', { trackingNumber: 'XY1' }), 'INVALID_INPUT');
    const carrier = await expectCode(
      repo.advanceOrder('o1', 'shipped', { carrier: 'Alice Martin, 06 12 34 56 78', trackingNumber: '6A12345678901' }),
      'INVALID_INPUT',
    );
    expect(carrier.message).toContain('Transporteur non reconnu');
    expect(fake.rpcCalls).toEqual([]);
  });

  it('montant hors numeric(14, 2) (SQLSTATE 22003) ⇒ INVALID_INPUT, jamais une panne', async () => {
    fake.rpcResponses['market_buy'] = { error: { message: 'numeric field overflow', code: '22003' } };
    await expectCode(repo.buy('l4'), 'INVALID_INPUT');
    expect(toMarketplaceError('Mise en vente impossible', { message: 'value too long', code: '22001' }).code).toBe(
      'INVALID_INPUT',
    );
  });

  it('openDispute : appel atomique, motif obligatoire', async () => {
    fake.rpcResponses['open_order_dispute'] = {
      data: [{ id: 'd1', order_id: 'o1', opened_by: ME, reason: 'non conforme', status: 'open', resolution_note: null, created_at: '2026-10-22T00:00:00Z', resolved_at: null }],
    };
    const dispute = await repo.openDispute('o1', '  non conforme ');
    expect(fake.rpcCalls[0]).toEqual({ fn: 'open_order_dispute', args: { p_order: 'o1', p_reason: 'non conforme' } });
    expect(dispute).toMatchObject({ id: 'd1', orderId: 'o1', reason: 'non conforme', status: 'open' });
    await expectCode(repo.openDispute('o1', '   '), 'INVALID_INPUT');
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it('reputation (dépréciée) lit seller_reputation', async () => {
    fake.rpcResponses['seller_reputation'] = { data: { completedSales: 3, refunded: 1, disputes: 1, disputeRate: 0.25, memberSince: '2025-01-01T00:00:00Z' } };
    await expect(repo.reputation('usr-2')).resolves.toEqual({ completedSales: 3, refunded: 1, disputes: 1, disputeRate: 0.25, memberSince: '2025-01-01T00:00:00Z' });
    expect(fake.rpcCalls[0]).toEqual({ fn: 'seller_reputation', args: { p_seller: 'usr-2' } });
  });

  it('reputationByAlias : par pseudonyme ; inconnu ⇒ erreur, jamais « 0 vente »', async () => {
    fake.rpcResponses['member_reputation'] = (args) =>
      args['p_alias'] === 'Collectionneur 7F3A'
        ? { data: { completedSales: 12, refunded: 0, disputes: 0, disputeRate: 0, memberSince: '2024-01-01T00:00:00Z', completedExchanges: 2 } }
        : { data: null };
    await expect(repo.reputationByAlias(' Collectionneur 7F3A ')).resolves.toMatchObject({ completedSales: 12 });
    await expectCode(repo.reputationByAlias('Collectionneur ZZZZ'), 'INVALID_INPUT');
    await expectCode(repo.reputationByAlias('  '), 'INVALID_INPUT');
  });
});

describe('marketplace repo — échanges', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.session = { user: { id: ME } };
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('proposeExchange : arguments nommés, soulte 0 par défaut, message vide ⇒ null', async () => {
    fake.rpcResponses['propose_exchange'] = { data: [exchangeView()] };
    const proposal = await repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 300, message: '   ' });
    expect(fake.rpcCalls[0]).toEqual({
      fn: 'propose_exchange',
      args: { p_listing: 'l1', p_offered_item: 'i5', p_offered_value: 300, p_cash_adjustment: 0, p_message: null },
    });
    expect(proposal).toEqual({
      id: 'x1',
      listingId: 'l1',
      role: 'proposer',
      counterpartyAlias: 'Collectionneur 7F3A',
      listingTitle: 'Napoléon III 20 Francs Or 1868',
      listingDomain: 'coin',
      listingValue: 320,
      offeredTitle: 'Marianne 10 Francs or 1907',
      offeredDomain: 'coin',
      offeredValue: 300,
      cashAdjustment: 20,
      currency: 'EUR',
      message: 'Bonjour, écrivez-moi à [coordonnées masquées]',
      state: 'proposed',
      myCommission: null,
      certificationRequired: false,
      listingCertified: false,
      offeredItemId: 'i5',
      offeredItemCertified: false,
      proposerTracking: null,
      recipientTracking: null,
      proposerReceived: false,
      recipientReceived: false,
      expiresAt: '2026-10-28T08:00:00Z',
      createdAt: '2026-10-21T08:00:00Z',
      updatedAt: '2026-10-21T08:00:00Z',
    });
  });

  it('proposeExchange refuse localement une valeur nulle ou une soulte invalide', async () => {
    await expectCode(repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 0 }), 'INVALID_INPUT');
    await expectCode(repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 10, cashAdjustment: Number.POSITIVE_INFINITY }), 'INVALID_INPUT');
    expect(fake.rpcCalls).toEqual([]);
  });

  it('proposeExchange hors Platine ⇒ PLAN_REQUIRED', async () => {
    fake.rpcResponses['propose_exchange'] = { error: { message: 'La communauté est réservée à l’offre Platine', code: 'VL402' } };
    await expectCode(repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 10 }), 'PLAN_REQUIRED');
  });

  it('myExchanges : propositions émises et reçues, commission figée', async () => {
    fake.rpcResponses['my_exchanges'] = {
      data: [
        exchangeView({
          role: 'recipient',
          state: 'shipping',
          my_commission: '16.00',
          recipient_tracking: 'SO-1',
          recipient_received: true,
          offered_item_id: null,
          offered_item_certified: true,
        }),
        exchangeView({ id: 'x2', listing_certified: true }),
      ],
    };
    const [exchange, onCertified] = await repo.myExchanges();
    expect(exchange).toMatchObject({ role: 'recipient', state: 'shipping', myCommission: 16, recipientTracking: 'SO-1', recipientReceived: true, proposerReceived: false, listingCertified: false });
    // Destinataire : l'objet offert n'est jamais identifié ; déjà certifié ⇒ plus d'expertise à en demander.
    expect(exchange).toMatchObject({ offeredItemId: null, offeredItemCertified: true });
    // Annonce visée déjà certifiée : l'auteur ne peut plus en demander l'expertise.
    expect(onCertified).toMatchObject({ role: 'proposer', listingCertified: true, offeredItemId: 'i5' });
    // Échéance relue de my_exchanges (expires_at) : l'interface masque « Accepter » une fois échue.
    expect(exchange?.expiresAt).toBe('2026-10-28T08:00:00Z');
  });

  it('chaque action appelle sa RPC et renvoie l’échange à jour', async () => {
    const states: Record<string, string> = {
      respond_exchange: 'shipping',
      withdraw_exchange: 'withdrawn',
      cancel_exchange: 'cancelled',
      ship_exchange: 'shipping',
      confirm_exchange_receipt: 'completed',
      dispute_exchange: 'disputed',
    };
    for (const [fn, state] of Object.entries(states)) {
      fake.rpcResponses[fn] = { data: [exchangeView({ state })] };
    }
    expect((await repo.respondExchange('x1', true)).state).toBe('shipping');
    expect((await repo.withdrawExchange('x1')).state).toBe('withdrawn');
    expect((await repo.cancelExchange('x1')).state).toBe('cancelled');
    expect((await repo.shipExchange('x1', ' pa-1 ', '  ')).state).toBe('shipping');
    expect((await repo.confirmExchangeReceipt('x1')).state).toBe('completed');
    expect((await repo.disputeExchange('x1', ' objet abîmé ')).state).toBe('disputed');
    expect(fake.rpcCalls).toEqual([
      { fn: 'respond_exchange', args: { p_exchange: 'x1', p_accept: true } },
      { fn: 'withdraw_exchange', args: { p_exchange: 'x1' } },
      { fn: 'cancel_exchange', args: { p_exchange: 'x1' } },
      { fn: 'ship_exchange', args: { p_exchange: 'x1', p_tracking: 'PA-1', p_carrier: null } },
      { fn: 'confirm_exchange_receipt', args: { p_exchange: 'x1' } },
      { fn: 'dispute_exchange', args: { p_exchange: 'x1', p_reason: 'objet abîmé' } },
    ]);
  });

  it('transition interdite par le serveur ⇒ INVALID_INPUT ; tiers ⇒ UNAUTHORIZED', async () => {
    fake.rpcResponses['cancel_exchange'] = { error: { message: 'Transition d’échange interdite (shipping → cancelled par cet acteur)', code: 'P0001' } };
    await expectCode(repo.cancelExchange('x1'), 'INVALID_INPUT');
    fake.rpcResponses['respond_exchange'] = { error: { message: 'Réservé aux parties de l’échange', code: '42501' } };
    await expectCode(repo.respondExchange('x1', false), 'UNAUTHORIZED');
  });

  it('suivi et motif obligatoires (refus local)', async () => {
    await expectCode(repo.shipExchange('x1', '  '), 'INVALID_INPUT');
    await expectCode(repo.disputeExchange('x1', ''), 'INVALID_INPUT');
    expect(fake.rpcCalls).toEqual([]);
  });

  it('réponse vide du serveur ⇒ SOURCE_UNAVAILABLE (jamais un faux succès)', async () => {
    fake.rpcResponses['withdraw_exchange'] = { data: [] };
    await expectCode(repo.withdrawExchange('x1'), 'SOURCE_UNAVAILABLE');
  });
});

describe('marketplace repo — certification et messagerie', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.session = { user: { id: ME } };
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('requestCertification : un seul contexte, payeur transmis', async () => {
    fake.rpcResponses['request_certification'] = { data: [certificationView()] };
    const request = await repo.requestCertification({ reason: 'mutual_agreement', orderId: 'o1', feePayer: 'split' });
    expect(fake.rpcCalls[0]).toEqual({
      fn: 'request_certification',
      args: { p_reason: 'mutual_agreement', p_listing: null, p_order: 'o1', p_exchange: null, p_fee_payer: 'split' },
    });
    expect(request).toEqual({
      id: 'c1',
      listingId: 'l4',
      orderId: 'o1',
      exchangeId: null,
      itemTitle: 'Écu Louis XV 1726',
      domain: 'coin',
      reason: 'mutual_agreement',
      status: 'awaiting_agreement',
      feePayer: 'split',
      feeAmount: null,
      requestedByMe: true,
      counterpartyAgreed: false,
      reportRef: null,
      expertNote: null,
      createdAt: '2026-10-21T09:00:00Z',
      decidedAt: null,
    });
    await expectCode(repo.requestCertification({ reason: 'voluntary' }), 'INVALID_INPUT');
    await expectCode(repo.requestCertification({ reason: 'voluntary', listingId: 'l1', orderId: 'o1' }), 'INVALID_INPUT');
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it('myCertifications / respond / cancel', async () => {
    fake.rpcResponses['my_certifications'] = {
      data: [certificationView({ status: 'certified', fee_amount: '30.00', report_ref: 'expertises/ecu.pdf', requested_by_me: false, counterparty_agreed: true, decided_at: '2026-10-22T00:00:00Z' })],
    };
    fake.rpcResponses['respond_certification'] = { data: [certificationView({ status: 'requested', counterparty_agreed: true, requested_by_me: false })] };
    fake.rpcResponses['cancel_certification'] = { data: [certificationView({ status: 'cancelled' })] };
    const [certified] = await repo.myCertifications();
    expect(certified).toMatchObject({ status: 'certified', feeAmount: 30, reportRef: 'expertises/ecu.pdf', requestedByMe: false, counterpartyAgreed: true });
    expect(await repo.respondCertification('c1', true)).toMatchObject({ status: 'requested', counterpartyAgreed: true });
    expect(await repo.cancelCertification('c1')).toMatchObject({ status: 'cancelled' });
    expect(fake.rpcCalls.slice(1)).toEqual([
      { fn: 'respond_certification', args: { p_certification: 'c1', p_agree: true } },
      { fn: 'cancel_certification', args: { p_certification: 'c1' } },
    ]);
  });

  it('messages : fil anonymisé (mine, pseudonyme, corps expurgé)', async () => {
    fake.rpcResponses['thread_messages'] = {
      data: [
        { id: 'm1', thread_kind: 'order', thread_id: 'o1', mine: false, author_alias: 'Collectionneur 7F3A', body: 'Joignable au [coordonnées masquées]', redacted: true, created_at: '2026-10-22T08:00:00Z' },
        { id: 'm2', thread_kind: 'order', thread_id: 'o1', mine: true, author_alias: null, body: 'Merci', redacted: null, created_at: '2026-10-22T09:00:00Z' },
      ],
    };
    const messages = await repo.messages('order', 'o1');
    expect(fake.rpcCalls[0]).toEqual({ fn: 'thread_messages', args: { p_kind: 'order', p_thread: 'o1' } });
    expect(messages).toEqual([
      { id: 'm1', threadKind: 'order', threadId: 'o1', mine: false, authorAlias: 'Collectionneur 7F3A', body: 'Joignable au [coordonnées masquées]', redacted: true, createdAt: '2026-10-22T08:00:00Z' },
      { id: 'm2', threadKind: 'order', threadId: 'o1', mine: true, authorAlias: 'Membre VELUM', body: 'Merci', redacted: false, createdAt: '2026-10-22T09:00:00Z' },
    ]);
  });

  it('messages d’un fil étranger ⇒ UNAUTHORIZED', async () => {
    fake.rpcResponses['thread_messages'] = { error: { message: 'Fil de discussion inaccessible', code: 'VL401' } };
    await expectCode(repo.messages('exchange', 'x9'), 'UNAUTHORIZED');
  });

  it('sendMessage : corps rogné, vide ou trop long refusé localement', async () => {
    fake.rpcResponses['send_market_message'] = (args) => ({
      data: [{ id: 'm3', thread_kind: args['p_kind'], thread_id: args['p_thread'], mine: true, author_alias: 'Collectionneur 1A2B', body: args['p_body'], redacted: false, created_at: '2026-10-22T10:00:00Z' }],
    });
    const sent = await repo.sendMessage('exchange', 'x1', '  Bonjour  ');
    expect(fake.rpcCalls[0]).toEqual({ fn: 'send_market_message', args: { p_kind: 'exchange', p_thread: 'x1', p_body: 'Bonjour' } });
    expect(sent).toMatchObject({ mine: true, body: 'Bonjour', threadKind: 'exchange' });
    await expectCode(repo.sendMessage('exchange', 'x1', '   '), 'INVALID_INPUT');
    await expectCode(repo.sendMessage('exchange', 'x1', 'a'.repeat(MARKET_MESSAGE_MAX_LENGTH + 1)), 'INVALID_INPUT');
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it('fetchCommissionSummary : synthèse du registre, jsonb défensif', async () => {
    fake.rpcResponses['my_commission_summary'] = {
      data: { currency: 'EUR', currentRate: 0.05, completedSales: 1, commissions: '38.50', certificationFees: 65, payouts: 210, entries: 'x' },
    };
    await expect(fetchCommissionSummary(asSupabase(fake))).resolves.toEqual({
      currency: 'EUR',
      currentRate: 0.05,
      completedSales: 1,
      commissions: 38.5,
      certificationFees: 65,
      payouts: 210,
      entries: 0,
    });
    fake.rpcResponses['my_commission_summary'] = { error: { message: 'Session requise', code: 'VL401' } };
    await expectCode(fetchCommissionSummary(asSupabase(fake)), 'UNAUTHORIZED');
  });

  it('commissionSummary (contrat MarketplaceRepo) : même RPC que fetchCommissionSummary', async () => {
    fake.rpcResponses['my_commission_summary'] = {
      data: { currency: 'EUR', currentRate: 0.04, completedSales: 12, commissions: 80, certificationFees: 0, payouts: 1520, entries: 24 },
    };
    expect(repo.commissionSummary).toBeTypeOf('function');
    await expect(repo.commissionSummary?.()).resolves.toEqual({
      currency: 'EUR',
      currentRate: 0.04,
      completedSales: 12,
      commissions: 80,
      certificationFees: 0,
      payouts: 1520,
      entries: 24,
    });
    expect(fake.rpcCalls).toEqual([{ fn: 'my_commission_summary', args: {} }]);
    // Panne réseau ≠ refus : jamais présentée comme un taux connu.
    fake.rpcResponses['my_commission_summary'] = { error: { message: 'fetch failed' } };
    await expectCode(repo.commissionSummary?.() ?? Promise.resolve(), 'SOURCE_UNAVAILABLE');
  });
});

describe('marketplace repo — annonce par identifiant (market_listing)', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.session = { user: { id: ME } };
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('getListing lit la vue anonymisée, même hors catalogue (vendue, réservée…)', async () => {
    fake.rpcResponses['market_listing'] = (args) =>
      args['p_id'] === 'l1' ? { data: [catalogueRow({ is_mine: true })] } : { data: [] };
    const listing = await repo.getListing?.(' l1 ');
    expect(fake.rpcCalls[0]).toEqual({ fn: 'market_listing', args: { p_id: 'l1' } });
    expect(listing).toEqual({
      id: 'l1',
      kind: 'sale_or_exchange',
      domain: 'coin',
      title: 'Napoléon III 20 Francs Or 1868',
      description: 'Très bel exemplaire, appelez-moi au [coordonnées masquées]',
      askPrice: 320,
      currency: 'EUR',
      exchangeWishes: 'Pièces or Second Empire',
      sellerAlias: 'Collectionneur 7F3A',
      certified: false,
      isMine: true,
      createdAt: '2026-10-20T10:00:00Z',
    });
    expect(Object.keys(listing ?? {})).not.toContain('sellerId');
  });

  it('getListing : annonce absente ou invisible ⇒ null (jamais une erreur trompeuse)', async () => {
    fake.rpcResponses['market_listing'] = { data: [] };
    await expect(repo.getListing?.('l404')).resolves.toBeNull();
    fake.rpcResponses['market_listing'] = { data: null };
    await expect(repo.getListing?.('l404')).resolves.toBeNull();
  });

  it('getListing : refus et pannes distingués du « introuvable »', async () => {
    fake.rpcResponses['market_listing'] = { error: { message: 'réservé Platine', code: 'VL402' } };
    await expectCode(repo.getListing?.('l1') ?? Promise.resolve(), 'PLAN_REQUIRED');
    fake.rpcResponses['market_listing'] = { error: { message: 'invalid input syntax for type uuid', code: '22P02' } };
    await expectCode(repo.getListing?.('pas-un-uuid') ?? Promise.resolve(), 'INVALID_INPUT');
    fake.offline = true;
    await expectCode(repo.getListing?.('l1') ?? Promise.resolve(), 'SOURCE_UNAVAILABLE');
    fake.offline = false;
    fake.session = null;
    await expectCode(repo.getListing?.('l1') ?? Promise.resolve(), 'UNAUTHORIZED');
    await expectCode(repo.getListing?.('   ') ?? Promise.resolve(), 'INVALID_INPUT');
  });
});

describe('marketplace repo — garde-fous locaux (miroir des règles serveur)', () => {
  let fake: FakeSupabase;
  let repo: MarketplaceRepo;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.session = { user: { id: ME } };
    repo = createMarketplaceRepo(asSupabase(fake));
  });

  it('createListing : euro seulement, prix plancher 1 €, montant représentable', async () => {
    const currency = await expectCode(repo.createListing({ itemId: 'i8', askPrice: 450, currency: 'BTC' }), 'INVALID_INPUT');
    expect(currency.message).toContain('euro');
    await expectCode(repo.createListing({ itemId: 'i8', askPrice: 0 }), 'INVALID_INPUT');
    await expectCode(repo.createListing({ itemId: 'i8', askPrice: 0.5 }), 'INVALID_INPUT');
    await expectCode(repo.createListing({ itemId: 'i8', askPrice: 1e15 }), 'INVALID_INPUT');
    expect(fake.tables['listings'] ?? []).toEqual([]);
    await repo.createListing({ itemId: 'i8', askPrice: MARKET_MAX_AMOUNT, currency: 'EUR' });
    expect(fake.tables['listings']?.[0]).toMatchObject({ ask_price: MARKET_MAX_AMOUNT, currency: 'EUR' });
  });

  it('proposeExchange : valeur ou soulte hors numeric(14, 2) refusée localement', async () => {
    await expectCode(repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 1e15 }), 'INVALID_INPUT');
    await expectCode(
      repo.proposeExchange({ listingId: 'l1', offeredItemId: 'i5', offeredValue: 10, cashAdjustment: -1e15 }),
      'INVALID_INPUT',
    );
    expect(fake.rpcCalls).toEqual([]);
  });

  it('shipExchange : suivi normalisé, transporteur canonique, texte libre refusé', async () => {
    fake.rpcResponses['ship_exchange'] = { data: [exchangeView({ state: 'shipping' })] };
    await repo.shipExchange('x1', ' 6a 1234 5678 901 ', 'colis prive');
    expect(fake.rpcCalls[0]).toEqual({
      fn: 'ship_exchange',
      args: { p_exchange: 'x1', p_tracking: '6A12345678901', p_carrier: 'Colis Privé' },
    });
    await expectCode(repo.shipExchange('x1', 'alice.martin@gmail.com'), 'INVALID_INPUT');
    await expectCode(repo.shipExchange('x1', 'PA-11', 'Bob : bob@yahoo.fr'), 'INVALID_INPUT');
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it('normalizeCarrier / normalizeTrackingNumber', () => {
    expect(normalizeCarrier(undefined)).toBeUndefined();
    expect(normalizeCarrier('   ')).toBeUndefined();
    expect(normalizeCarrier(' MONDIAL relay ')).toBe('Mondial Relay');
    expect(() => normalizeCarrier('Royal Mail')).toThrow(/Transporteur non reconnu/);
    expect(normalizeTrackingNumber(' ab-1234 ')).toBe('AB-1234');
    expect(() => normalizeTrackingNumber('-ABCD')).toThrow(/invalide/);
    expect(() => normalizeTrackingNumber('A'.repeat(41))).toThrow(/invalide/);
    expect(() => normalizeTrackingNumber('écrivez-moi')).toThrow(/invalide/);
  });

  it('MARKET_CARRIERS est la réplique exacte de market_carriers() (SQL)', () => {
    const path = fileURLToPath(
      new URL('../../../supabase/migrations/20261023100100_market_exchanges_certification.sql', import.meta.url),
    );
    const sql = readFileSync(path, 'utf8');
    const start = sql.indexOf('create or replace function public.market_carriers()');
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(sql.indexOf('array[', start), sql.indexOf(']', sql.indexOf('array[', start)));
    const names = [...body.matchAll(/'((?:[^']|'')*)'/g)].map((m) => (m[1] ?? '').replace(/''/g, "'"));
    expect(names).toEqual([...MARKET_CARRIERS]);
  });
});

describe('toMarketplaceError', () => {
  it.each([
    ['VL402', 'PLAN_REQUIRED'],
    ['VL401', 'UNAUTHORIZED'],
    ['42501', 'UNAUTHORIZED'],
    ['PGRST301', 'UNAUTHORIZED'],
    ['P0001', 'INVALID_INPUT'],
    ['23505', 'INVALID_INPUT'],
    ['23514', 'INVALID_INPUT'],
    ['22P02', 'INVALID_INPUT'],
    ['22003', 'INVALID_INPUT'],
    ['22001', 'INVALID_INPUT'],
    ['PGRST116', 'INVALID_INPUT'],
    ['PGRST202', 'SOURCE_UNAVAILABLE'],
    ['57014', 'SOURCE_UNAVAILABLE'],
  ] as const)('%s → %s', (sqlstate, code) => {
    const error = toMarketplaceError('Contexte', { message: 'détail', code: sqlstate });
    expect(error.code).toBe(code);
    expect(error.message).toBe('Contexte : détail');
    expect(error.details).toEqual({ sqlstate });
  });

  it('sans code (réseau) ⇒ SOURCE_UNAVAILABLE', () => {
    expect(toMarketplaceError('Contexte', { message: 'fetch failed' }).code).toBe('SOURCE_UNAVAILABLE');
  });
});
