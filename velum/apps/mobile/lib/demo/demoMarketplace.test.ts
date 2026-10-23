import { describe, expect, it } from 'vitest';
import { REDACTION_TOKEN } from '@velum/config';
import { VelumError, type VelumItem } from '@velum/core';

import { createDemoMarketplaceRepo } from './demoMarketplace';

const NOW = '2026-10-23T10:00:00.000Z';

function item(id: string, patch: Partial<VelumItem> = {}): VelumItem {
  return {
    id,
    ownerId: 'demo-user',
    domain: 'coin',
    title: `Objet ${id}`,
    attributes: {},
    confidence: 0.9,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

function setup(
  items: VelumItem[] = [item('it-coin'), item('it-watch', { domain: 'watch', title: 'Rolex Datejust' })],
  valuations: Record<string, number> = {},
) {
  const repo = createDemoMarketplaceRepo((id) => items.find((i) => i.id === id) ?? null, {
    delayMs: 0,
    now: () => NOW,
    latestValuation: (id) => valuations[id] ?? null,
  });
  return repo;
}

async function expectInvalid(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(VelumError);
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_INPUT' });
}

describe('démo marketplace — catalogue', () => {
  it('couvre les 5 catégories avec ventes, échanges et annonces mixtes', async () => {
    const repo = setup();
    const all = await repo.catalogue();
    expect(new Set(all.map((l) => l.domain))).toEqual(new Set(['wine', 'coin', 'art', 'stamp', 'watch']));
    expect(new Set(all.map((l) => l.kind))).toEqual(new Set(['sale', 'exchange', 'sale_or_exchange']));
    expect(all.some((l) => l.certified)).toBe(true);
    // Anonymat : aucun identifiant de membre ni d'objet dans le catalogue.
    for (const l of all) {
      expect(l).not.toHaveProperty('sellerId');
      expect(l).not.toHaveProperty('itemId');
      expect(l.sellerAlias.length).toBeGreaterThan(0);
      expect(l.isMine).toBe(false);
    }
  });

  it('filtre par catégorie, mode, prix, certification et trie', async () => {
    const repo = setup();
    const coins = await repo.catalogue({ domain: 'coin' });
    expect(coins.every((l) => l.domain === 'coin')).toBe(true);
    const exchanges = await repo.catalogue({ mode: 'exchange' });
    expect(exchanges.every((l) => l.kind !== 'sale')).toBe(true);
    const sales = await repo.catalogue({ mode: 'sale' });
    expect(sales.every((l) => l.kind !== 'exchange')).toBe(true);
    const certified = await repo.catalogue({ certifiedOnly: true });
    expect(certified.length).toBeGreaterThan(0);
    expect(certified.every((l) => l.certified)).toBe(true);
    const range = await repo.catalogue({ minPrice: 100, maxPrice: 400, sort: 'price_asc' });
    expect(range.every((l) => l.askPrice >= 100 && l.askPrice <= 400)).toBe(true);
    expect(range.map((l) => l.askPrice)).toEqual([...range.map((l) => l.askPrice)].sort((a, b) => a - b));
    const desc = await repo.catalogue({ sort: 'price_desc', limit: 2 });
    expect(desc).toHaveLength(2);
    expect(desc[0]?.askPrice).toBeGreaterThanOrEqual(desc[1]?.askPrice ?? 0);
  });

  it('recherche texte insensible aux accents et à la casse (titre, description, souhaits)', async () => {
    const repo = setup();
    expect((await repo.catalogue({ text: 'NAPOLEON' })).map((l) => l.id)).toEqual(['demo-listing-1']);
    expect((await repo.catalogue({ text: 'ceres 1849' })).map((l) => l.id)).toEqual(['demo-listing-6']);
    // Souhaits d'échange indexés.
    expect((await repo.catalogue({ text: 'cote-rotie' })).map((l) => l.id)).toEqual(['demo-listing-7']);
    expect(await repo.catalogue({ text: 'introuvable xyz' })).toEqual([]);
  });

  it('n’affiche mes annonces qu’avec includeMine, et jamais celles en attente d’expertise', async () => {
    const repo = setup();
    const withMine = await repo.catalogue({ includeMine: true });
    const mine = withMine.filter((l) => l.isMine);
    // demo-mine-5 est réservée (paiement capturé) : hors catalogue, comme listing_is_engaged.
    expect(mine.map((l) => l.id)).toEqual(['demo-mine-1']);
  });

  it('lecture directe : annonce hors catalogue visible de ses parties seulement', async () => {
    const repo = setup();
    // Vendue (je suis l'acheteur de demo-order-1) : absente du catalogue, mais consultable.
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-9')).toBe(false);
    expect(await repo.getListing?.('demo-listing-9')).toMatchObject({ id: 'demo-listing-9', isMine: false });
    expect(await repo.getListing?.('demo-mine-3')).toMatchObject({ isMine: true });
    expect(await repo.getListing?.('absente')).toBeNull();
  });

  it('expose une réputation par pseudonyme sans identifiant', async () => {
    const repo = setup();
    const [first] = await repo.catalogue({ text: 'napoleon' });
    const rep = await repo.reputationByAlias(first?.sellerAlias ?? '');
    expect(rep.completedSales).toBe(34);
    expect((await repo.reputationByAlias('Inconnu 0000')).completedSales).toBe(0);
  });
});

describe('démo marketplace — mise en vente (règles @velum/config)', () => {
  it('sous le seuil : annonce active, taux dégressif figé, coordonnées masquées', async () => {
    const repo = setup();
    const rec = await repo.createListing({
      itemId: 'it-coin',
      askPrice: 120,
      kind: 'sale_or_exchange',
      description: 'Superbe, appelez le 06 12 34 56 78',
      exchangeWishes: 'Semeuses — voir www.collection.fr',
    });
    expect(rec.status).toBe('active');
    expect(rec.commissionRate).toBe(0.05); // 2 ventes conclues → 5 %
    expect(rec.title).toBe('Objet it-coin');
    expect(rec.description).toBe(`Superbe, appelez le ${REDACTION_TOKEN}`);
    expect(rec.exchangeWishes).toContain(REDACTION_TOKEN);
    expect(rec.certificationRequired).toBe(false);
    const catalogue = await repo.catalogue({ includeMine: true, text: 'it-coin' });
    expect(catalogue.map((l) => l.id)).toEqual([rec.id]);
  });

  it('au-delà de 500 € : pending_certification + demande d’expertise ouverte (vendeur)', async () => {
    const repo = setup();
    const rec = await repo.createListing({ itemId: 'it-watch', askPrice: 3500, kind: 'sale' });
    expect(rec.status).toBe('pending_certification');
    expect(rec.certificationRequired).toBe(true);
    expect((await repo.catalogue({ includeMine: true })).some((l) => l.id === rec.id)).toBe(false);
    const cert = (await repo.myCertifications()).find((c) => c.listingId === rec.id);
    expect(cert).toMatchObject({ reason: 'threshold', status: 'requested', feePayer: 'seller', requestedByMe: true });
  });

  it('le seuil tient compte de la dernière valorisation VELUM (pas de sous-déclaration)', async () => {
    // Comme _market_reference_value : max(prix, dernière valorisation) ; le
    // scan éclair ({low, high}) n'est pas une valorisation et n'est pas lu.
    const repo = setup(
      [item('it-under'), item('it-quick', { attributes: { quickEstimate: { low: 300, high: 900, currency: 'EUR' } } })],
      { 'it-under': 900 },
    );
    expect((await repo.createListing({ itemId: 'it-under', askPrice: 450 })).status).toBe('pending_certification');
    expect((await repo.createListing({ itemId: 'it-quick', askPrice: 450 })).status).toBe('active');
  });

  it('titre dénormalisé expurgé des coordonnées, comme en SQL', async () => {
    const repo = setup([item('it-phone', { title: 'Montre – appelez 06 12 34 56 78' })]);
    const rec = await repo.createListing({ itemId: 'it-phone', askPrice: 100 });
    expect(rec.title).toBe(`Montre – appelez ${REDACTION_TOKEN}`);
  });

  it('refuse un prix invalide, un objet inconnu, une double annonce ; retire une annonce', async () => {
    const repo = setup();
    await expectInvalid(repo.createListing({ itemId: 'it-coin', askPrice: 0 }));
    await expectInvalid(repo.createListing({ itemId: 'absent', askPrice: 10 }));
    const rec = await repo.createListing({ itemId: 'it-coin', askPrice: 10, kind: 'sale' });
    expect(rec.exchangeWishes).toBeNull();
    await expectInvalid(repo.createListing({ itemId: 'it-coin', askPrice: 12 }));
    const withdrawn = await repo.withdrawListing(rec.id);
    expect(withdrawn.status).toBe('withdrawn');
    await expectInvalid(repo.withdrawListing(rec.id));
    await expectInvalid(repo.withdrawListing('demo-listing-1')); // pas la mienne
  });

  it('annuler l’expertise obligatoire repasse l’annonce en brouillon (comme le serveur)', async () => {
    const repo = setup();
    const cert = (await repo.myCertifications()).find((c) => c.listingId === 'demo-mine-2');
    expect(cert?.status).toBe('in_review');
    await repo.cancelCertification(cert?.id ?? '');
    const mine = await repo.myListings();
    expect(mine.find((l) => l.id === 'demo-mine-2')?.status).toBe('draft');
  });

  it('une annonce réservée (paiement capturé) ne se retire pas', async () => {
    const repo = setup();
    // demo-mine-5 : commande demo-order-4 sous séquestre.
    await expectInvalid(repo.withdrawListing('demo-mine-5'));
  });
});

describe('démo marketplace — achat sous séquestre', () => {
  it('suit la machine à états et refuse les transitions illégales', async () => {
    const repo = setup();
    const order = await repo.buy('demo-listing-3');
    expect(order).toMatchObject({ role: 'buyer', escrowState: 'pending_payment', commissionRate: 0.04 });
    expect(order.counterpartyAlias).toBe('Cave 92B1');
    // Commande NON payée : elle ne réserve rien, l'annonce reste au catalogue.
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-3')).toBe(true);
    // Le paiement place les fonds sous séquestre (annonce réservée) ; le vendeur (simulé) expédie.
    const paid = await repo.advanceOrder(order.id, 'funds_held');
    expect(paid.escrowState).toBe('shipped');
    expect(paid.trackingNumber).toMatch(/^DEMO/);
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-3')).toBe(false);
    await expectInvalid(repo.advanceOrder(order.id, 'refunded'));
    const released = await repo.advanceOrder(order.id, 'released');
    expect(released.escrowState).toBe('released');
    expect(released.releasedAt).toBe(NOW);
    // Vendue à la libération : elle ne revient pas au catalogue, mais reste consultable par l'acheteur.
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-3')).toBe(false);
    expect(await repo.getListing?.('demo-listing-3')).toMatchObject({ id: 'demo-listing-3' });
    await expectInvalid(repo.buy('demo-listing-3'));
  });

  it('une seule commande non payée par acheteur et par annonce', async () => {
    const repo = setup();
    await repo.buy('demo-listing-3');
    await expectInvalid(repo.buy('demo-listing-3'));
  });

  it('refuse l’achat de mes annonces, des annonces d’échange et indisponibles', async () => {
    const repo = setup();
    await expectInvalid(repo.buy('demo-mine-1'));
    await expectInvalid(repo.buy('demo-listing-4'));
    await expectInvalid(repo.buy('demo-listing-9'));
  });

  it('annulation avant paiement : l’annonce reste au catalogue', async () => {
    const repo = setup();
    const order = await repo.buy('demo-listing-8');
    await repo.advanceOrder(order.id, 'cancelled');
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-8')).toBe(true);
  });

  it('litige sur une commande expédiée, motif requis', async () => {
    const repo = setup();
    await expectInvalid(repo.openDispute('demo-order-1', '  '));
    const dispute = await repo.openDispute('demo-order-1', 'Bouteille cassée');
    expect(dispute.status).toBe('open');
    const orders = await repo.myOrders();
    expect(orders.find((o) => o.id === 'demo-order-1')?.escrowState).toBe('disputed');
  });

  it('vente : j’expédie avec le seul suivi ; une date de livraison posée par le vendeur est refusée', async () => {
    const repo = setup();
    const sale = (await repo.myOrders()).find((o) => o.role === 'seller' && o.escrowState === 'funds_held');
    expect(sale).toBeDefined();
    const id = sale?.id ?? '';
    // L'acheteur a demandé une expertise : je la refuse, l'expédition est débloquée.
    const asked = (await repo.myCertifications()).find((c) => c.orderId === id && c.status === 'awaiting_agreement');
    await repo.respondCertification(asked?.id ?? '', false);
    // Miroir de guard_order_terms : seul l’acheteur (ou le transporteur) atteste la livraison.
    await expectInvalid(
      repo.advanceOrder(id, 'shipped', { trackingNumber: 'LL123456789FR', deliveredAt: NOW }),
    );
    const shipped = await repo.advanceOrder(id, 'shipped', { trackingNumber: 'LL123456789FR', carrier: 'La Poste' });
    expect(shipped).toMatchObject({ escrowState: 'shipped', trackingNumber: 'LL123456789FR', carrier: 'La Poste', deliveredAt: null });
  });

  it('compte mes ventes conclues dans les commandes (rôle vendeur, fonds libérés)', async () => {
    const repo = setup();
    const orders = await repo.myOrders();
    expect(orders.filter((o) => o.role === 'seller' && o.escrowState === 'released')).toHaveLength(2);
  });
});

describe('démo marketplace — commissionnement (miroir de my_commission_summary)', () => {
  it('taux actuel, ventes retenues et registre des ventes libérées', async () => {
    const repo = setup();
    // 2 ventes libérées (120 € et 60 € à deux acheteurs distincts, taux figé 5 %).
    await expect(repo.commissionSummary?.()).resolves.toEqual({
      currency: 'EUR',
      currentRate: 0.05,
      completedSales: 2,
      commissions: 9,
      certificationFees: 0,
      payouts: 171,
      entries: 4,
    });
  });

  it('échange conclu : ma commission figée et la soulte reçue entrent au registre', async () => {
    const repo = setup();
    await repo.respondExchange('demo-exchange-1', true);
    await repo.shipExchange('demo-exchange-1', 'LL000FR');
    await repo.confirmExchangeReceipt('demo-exchange-1');
    const summary = await repo.commissionSummary?.();
    // + 2,25 € de commission (45 € à 5 %), + 15 € de soulte versée par l’autre partie.
    expect(summary).toMatchObject({ commissions: 11.25, payouts: 186, entries: 6, completedSales: 2 });
  });
});

describe('démo marketplace — échanges', () => {
  it('contient une proposition reçue et une émise', async () => {
    const repo = setup();
    const list = await repo.myExchanges();
    const received = list.find((e) => e.role === 'recipient');
    const sent = list.find((e) => e.role === 'proposer');
    expect(received).toMatchObject({ state: 'proposed', counterpartyAlias: 'Amateur 4D9E' });
    expect(received?.message).toContain(REDACTION_TOKEN);
    expect(sent).toMatchObject({ state: 'proposed', counterpartyAlias: 'Collectionneur 7F3A' });
  });

  it('acceptation : commission figée sur l’objet que je cède, puis cycle complet', async () => {
    const repo = setup();
    const accepted = await repo.respondExchange('demo-exchange-1', true);
    // Je cède ma Semeuse déclarée 45 € à 5 % (2 ventes conclues). Comme le
    // serveur, l'acceptation passe aussitôt en expédition (sans expertise).
    expect(accepted).toMatchObject({ state: 'shipping', myCommission: 2.25 });
    const shipped = await repo.shipExchange('demo-exchange-1', 'LL000FR');
    expect(shipped.state).toBe('shipping');
    expect(shipped.recipientTracking).toBe('LL000FR');
    expect(shipped.proposerTracking).not.toBeNull(); // autre partie simulée
    const done = await repo.confirmExchangeReceipt('demo-exchange-1');
    expect(done.state).toBe('completed');
    const mine = await repo.myListings();
    expect(mine.find((l) => l.id === 'demo-mine-1')?.status).toBe('exchanged');
  });

  it('échéance : une proposition échue ne s’accepte plus (refus et retrait restent possibles)', async () => {
    let clock = NOW;
    const items = [item('it-coin')];
    const repo = createDemoMarketplaceRepo((id) => items.find((i) => i.id === id) ?? null, {
      delayMs: 0,
      now: () => clock,
    });
    const received = (await repo.myExchanges()).find((e) => e.id === 'demo-exchange-1');
    // Comme expires_at (exchange_proposal_ttl_days) : 7 jours, jamais déjà échue à l’ouverture.
    expect(received?.expiresAt).toBe('2026-10-30T10:00:00.000Z');
    const proposed = await repo.proposeExchange({ listingId: 'demo-listing-1', offeredItemId: 'it-coin', offeredValue: 300 });
    expect(proposed.expiresAt).toBe('2026-10-30T10:00:00.000Z');
    clock = '2026-10-30T10:00:00.000Z';
    await expect(repo.respondExchange('demo-exchange-1', true)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: expect.stringContaining('Proposition expirée'),
    });
    expect((await repo.respondExchange('demo-exchange-1', false)).state).toBe('declined');
    expect((await repo.withdrawExchange(proposed.id)).state).toBe('withdrawn');
  });

  it('refuse les actions illégales selon le rôle et l’état', async () => {
    const repo = setup();
    await expectInvalid(repo.respondExchange('demo-exchange-2', true)); // je suis l’auteur
    await expectInvalid(repo.withdrawExchange('demo-exchange-1')); // je suis destinataire
    await expectInvalid(repo.shipExchange('demo-exchange-1', 'X')); // pas encore acceptée
    await repo.respondExchange('demo-exchange-1', false);
    await expectInvalid(repo.respondExchange('demo-exchange-1', true));
    const withdrawn = await repo.withdrawExchange('demo-exchange-2');
    expect(withdrawn.state).toBe('withdrawn');
  });

  it('proposition : objet de ma collection, coordonnées masquées, expertise au-delà du seuil', async () => {
    const repo = setup();
    const ex = await repo.proposeExchange({
      listingId: 'demo-listing-1',
      offeredItemId: 'it-watch',
      offeredValue: 900,
      cashAdjustment: -100,
      message: 'Joignable au 06 12 34 56 78',
    });
    expect(ex).toMatchObject({
      role: 'proposer',
      state: 'proposed',
      offeredTitle: 'Rolex Datejust',
      cashAdjustment: -100,
      // Comme set_exchange_defaults : l'expertise se décide à l'acceptation.
      certificationRequired: false,
      myCommission: null,
    });
    expect(ex.message).toBe(`Joignable au ${REDACTION_TOKEN}`);
    await expectInvalid(
      repo.proposeExchange({ listingId: 'demo-listing-1', offeredItemId: 'it-coin', offeredValue: 50 }),
    ); // déjà une proposition en attente
    await expectInvalid(
      repo.proposeExchange({ listingId: 'demo-listing-3', offeredItemId: 'it-coin', offeredValue: 50 }),
    ); // vente seule
    await expectInvalid(
      repo.proposeExchange({ listingId: 'demo-listing-4', offeredItemId: 'absent', offeredValue: 50 }),
    );
    await expectInvalid(
      repo.proposeExchange({ listingId: 'demo-listing-4', offeredItemId: 'it-coin', offeredValue: 0 }),
    );
  });

  it('acceptation : l’annonce et l’objet sont réservés (hors catalogue), les autres propositions tombent', async () => {
    const repo = setup();
    await repo.respondExchange('demo-exchange-1', true);
    expect((await repo.catalogue({ includeMine: true })).some((l) => l.id === 'demo-mine-1')).toBe(false);
    await expectInvalid(repo.withdrawListing('demo-mine-1'));
  });

  it('expertise de seuil décidée à l’acceptation, objet par objet, à la charge de son propriétaire', async () => {
    // Ma Semeuse (annonce demo-mine-1) est valorisée 900 € : elle dépasse le seuil.
    const repo = setup(undefined, { 'demo-mine-1-item': 900 });
    const accepted = await repo.respondExchange('demo-exchange-1', true);
    expect(accepted).toMatchObject({ state: 'awaiting_certification', certificationRequired: true });
    const certs = (await repo.myCertifications()).filter((c) => c.exchangeId === 'demo-exchange-1');
    expect(certs).toHaveLength(1);
    expect(certs[0]).toMatchObject({
      reason: 'threshold',
      status: 'requested',
      feePayer: 'seller',
      requestedByMe: true,
      itemTitle: '5 Francs Semeuse argent 1960',
    });
    // Seuil d'échange : il ne s'annule qu'en annulant l'échange.
    await expectInvalid(repo.cancelCertification(certs[0]?.id ?? ''));
  });

  it('proposition : titre de l’objet offert expurgé des coordonnées', async () => {
    const repo = setup([item('it-phone', { title: 'Montre – appelez 06 12 34 56 78' })]);
    const ex = await repo.proposeExchange({ listingId: 'demo-listing-4', offeredItemId: 'it-phone', offeredValue: 300 });
    expect(ex.offeredTitle).toBe(`Montre – appelez ${REDACTION_TOKEN}`);
  });

  it('un échange accepté s’annule avant toute expédition, pas une proposition', async () => {
    const repo = setup();
    await expectInvalid(repo.cancelExchange('demo-exchange-1'));
    await repo.respondExchange('demo-exchange-1', true);
    await repo.requestCertification({ reason: 'mutual_agreement', exchangeId: 'demo-exchange-1' });
    const cancelled = await repo.cancelExchange('demo-exchange-1');
    expect(cancelled.state).toBe('cancelled');
    // L'expertise d'accord mutuel en attente sur cet échange est annulée avec lui.
    const cert = (await repo.myCertifications()).find((c) => c.exchangeId === 'demo-exchange-1');
    expect(cert?.status).toBe('cancelled');
  });
});

describe('démo marketplace — certifications et messages', () => {
  it('accord mutuel reçu sur ma vente : je l’accepte, l’expédition attend l’expert', async () => {
    const repo = setup();
    const pending = (await repo.myCertifications()).find((c) => c.status === 'awaiting_agreement');
    expect(pending).toMatchObject({ requestedByMe: false, feePayer: 'split', orderId: 'demo-order-4' });
    const agreed = await repo.respondCertification(pending?.id ?? '', true);
    expect(agreed).toMatchObject({ status: 'requested', counterpartyAgreed: true });
    const order = (await repo.myOrders()).find((o) => o.id === 'demo-order-4');
    expect(order?.certificationRequired).toBe(true);
    // Miroir de has_open_certification : expédition bloquée tant que l'expert n'a pas rendu sa décision.
    await expectInvalid(repo.advanceOrder('demo-order-4', 'shipped', { trackingNumber: 'LL123456789FR' }));
  });

  it('expertise ouverte sur un échange : pas d’expédition tant qu’elle n’est pas tranchée', async () => {
    const repo = setup();
    await repo.respondExchange('demo-exchange-1', true);
    await repo.requestCertification({ reason: 'mutual_agreement', exchangeId: 'demo-exchange-1' });
    // Accord attendu (awaiting_agreement) : has_open_certification bloque déjà l'envoi.
    await expectInvalid(repo.shipExchange('demo-exchange-1', 'LL123456789FR'));
  });

  it('échange : expertise d’un commun accord seulement une fois accepté, avant tout envoi', async () => {
    const repo = setup();
    // Simple proposition : refusé (le serveur répond « Trop tard… ou pas en cours »).
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', exchangeId: 'demo-exchange-2' }));
    await repo.respondExchange('demo-exchange-1', true);
    const req = await repo.requestCertification({ reason: 'mutual_agreement', exchangeId: 'demo-exchange-1' });
    // Elle porte sur l'objet que je REÇOIS (l'Hercule proposé).
    expect(req).toMatchObject({
      status: 'awaiting_agreement',
      feePayer: 'split',
      requestedByMe: true,
      itemTitle: 'Hercule 10 Francs argent 1967',
    });
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', exchangeId: 'demo-exchange-1' }));
    await expectInvalid(repo.requestCertification({ reason: 'voluntary', exchangeId: 'demo-exchange-1' }));
    await expectInvalid(repo.respondCertification(req.id, true)); // c'est ma demande
    expect((await repo.cancelCertification(req.id)).status).toBe('cancelled');
  });

  it('commande : je demande l’expertise avant expédition ; jamais sur l’annonce d’autrui', async () => {
    const repo = setup();
    // Annonce d'autrui : le contexte annonce est réservé au vendeur (« introuvable parmi les vôtres »).
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', listingId: 'demo-listing-3' }));
    await expectInvalid(repo.requestCertification({ reason: 'voluntary', listingId: 'demo-listing-3' }));
    await expectInvalid(repo.requestCertification({ reason: 'voluntary' }));
    // Commande déjà expédiée : trop tard.
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', orderId: 'demo-order-1' }));
    const order = await repo.buy('demo-listing-3');
    const req = await repo.requestCertification({ reason: 'mutual_agreement', orderId: order.id });
    expect(req).toMatchObject({ status: 'awaiting_agreement', feePayer: 'split', requestedByMe: true, counterpartyAgreed: false });
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', orderId: order.id }));
    // Expertise ouverte : après paiement, le vendeur (simulé) n'expédie pas.
    expect((await repo.advanceOrder(order.id, 'funds_held')).escrowState).toBe('funds_held');
    expect((await repo.cancelCertification(req.id)).status).toBe('cancelled');
  });

  it('fil anonymisé : pseudonymes, coordonnées masquées, fils d’autrui inaccessibles', async () => {
    const repo = setup();
    const thread = await repo.messages('exchange', 'demo-exchange-1');
    expect(thread[0]).toMatchObject({ mine: false, authorAlias: 'Amateur 4D9E', redacted: true });
    const sent = await repo.sendMessage('exchange', 'demo-exchange-1', 'Mon mail : moi@exemple.com');
    expect(sent.mine).toBe(true);
    expect(sent.redacted).toBe(true);
    expect(sent.body).toContain(REDACTION_TOKEN);
    expect((await repo.messages('exchange', 'demo-exchange-1')).at(-1)?.id).toBe(sent.id);
    await expectInvalid(repo.sendMessage('order', 'demo-order-1', '   '));
    await expectInvalid(repo.messages('order', 'inconnu'));
  });

  it('renvoie des copies (pas de mutation partagée avec le cache de l’app)', async () => {
    const repo = setup();
    const [first] = await repo.myExchanges();
    if (first) first.state = 'completed';
    const [again] = await repo.myExchanges();
    expect(again?.state).not.toBe('completed');
  });
});
