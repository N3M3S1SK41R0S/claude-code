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

function setup(items: VelumItem[] = [item('it-coin'), item('it-watch', { domain: 'watch', title: 'Rolex Datejust' })]) {
  const repo = createDemoMarketplaceRepo((id) => items.find((i) => i.id === id) ?? null, {
    delayMs: 0,
    now: () => NOW,
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
    expect(mine.map((l) => l.id)).toEqual(['demo-mine-1']);
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

  it('le seuil tient compte de l’estimation VELUM (pas de sous-déclaration)', async () => {
    const repo = setup([item('it-under', { attributes: { quickEstimate: { central: 900 } } })]);
    const rec = await repo.createListing({ itemId: 'it-under', askPrice: 300 });
    expect(rec.status).toBe('pending_certification');
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

  it('annuler l’expertise obligatoire retire l’annonce en attente', async () => {
    const repo = setup();
    const cert = (await repo.myCertifications()).find((c) => c.listingId === 'demo-mine-2');
    expect(cert?.status).toBe('in_review');
    await repo.cancelCertification(cert?.id ?? '');
    const mine = await repo.myListings();
    expect(mine.find((l) => l.id === 'demo-mine-2')?.status).toBe('withdrawn');
  });
});

describe('démo marketplace — achat sous séquestre', () => {
  it('suit la machine à états et refuse les transitions illégales', async () => {
    const repo = setup();
    const order = await repo.buy('demo-listing-3');
    expect(order).toMatchObject({ role: 'buyer', escrowState: 'pending_payment', commissionRate: 0.04 });
    expect(order.counterpartyAlias).toBe('Cave 92B1');
    // Annonce réservée : hors catalogue.
    expect((await repo.catalogue()).some((l) => l.id === 'demo-listing-3')).toBe(false);
    // Le paiement place les fonds sous séquestre ; le vendeur (simulé) expédie.
    const paid = await repo.advanceOrder(order.id, 'funds_held');
    expect(paid.escrowState).toBe('shipped');
    expect(paid.trackingNumber).toMatch(/^DEMO/);
    await expectInvalid(repo.advanceOrder(order.id, 'refunded'));
    const released = await repo.advanceOrder(order.id, 'released');
    expect(released.escrowState).toBe('released');
    expect(released.releasedAt).toBe(NOW);
  });

  it('refuse l’achat de mes annonces, des annonces d’échange et indisponibles', async () => {
    const repo = setup();
    await expectInvalid(repo.buy('demo-mine-1'));
    await expectInvalid(repo.buy('demo-listing-4'));
    await expectInvalid(repo.buy('demo-listing-9'));
  });

  it('annulation avant expédition : l’annonce revient au catalogue', async () => {
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

  it('compte mes ventes conclues dans les commandes (rôle vendeur, fonds libérés)', async () => {
    const repo = setup();
    const orders = await repo.myOrders();
    expect(orders.filter((o) => o.role === 'seller' && o.escrowState === 'released')).toHaveLength(2);
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
    // Je cède ma Semeuse déclarée 45 € à 5 % (2 ventes conclues).
    expect(accepted).toMatchObject({ state: 'accepted', myCommission: 2.25 });
    const shipped = await repo.shipExchange('demo-exchange-1', 'LL000FR');
    expect(shipped.state).toBe('shipping');
    expect(shipped.recipientTracking).toBe('LL000FR');
    expect(shipped.proposerTracking).not.toBeNull(); // autre partie simulée
    const done = await repo.confirmExchangeReceipt('demo-exchange-1');
    expect(done.state).toBe('completed');
    const mine = await repo.myListings();
    expect(mine.find((l) => l.id === 'demo-mine-1')?.status).toBe('exchanged');
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
      certificationRequired: true,
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

  it('un échange accepté s’annule avant toute expédition, pas une proposition', async () => {
    const repo = setup();
    await expectInvalid(repo.cancelExchange('demo-exchange-1'));
    await repo.respondExchange('demo-exchange-1', true);
    const cancelled = await repo.cancelExchange('demo-exchange-1');
    expect(cancelled.state).toBe('cancelled');
    // L'expertise d'accord mutuel en attente sur cet échange est annulée avec lui.
    const cert = (await repo.myCertifications()).find((c) => c.exchangeId === 'demo-exchange-1');
    expect(cert?.status).toBe('cancelled');
  });
});

describe('démo marketplace — certifications et messages', () => {
  it('accord mutuel : j’accepte la demande reçue, l’expertise conditionne l’échange', async () => {
    const repo = setup();
    const pending = (await repo.myCertifications()).find((c) => c.status === 'awaiting_agreement');
    expect(pending).toMatchObject({ requestedByMe: false, feePayer: 'split', exchangeId: 'demo-exchange-1' });
    const agreed = await repo.respondCertification(pending?.id ?? '', true);
    expect(agreed).toMatchObject({ status: 'requested', counterpartyAgreed: true });
    const accepted = await repo.respondExchange('demo-exchange-1', true);
    expect(accepted.state).toBe('awaiting_certification');
    await expectInvalid(repo.shipExchange('demo-exchange-1', 'X'));
  });

  it('je demande une expertise d’accord mutuel sur une annonce (frais partagés)', async () => {
    const repo = setup();
    const req = await repo.requestCertification({ reason: 'mutual_agreement', listingId: 'demo-listing-3' });
    expect(req).toMatchObject({ status: 'awaiting_agreement', feePayer: 'split', requestedByMe: true, counterpartyAgreed: false });
    await expectInvalid(repo.requestCertification({ reason: 'mutual_agreement', listingId: 'demo-listing-3' }));
    await expectInvalid(repo.requestCertification({ reason: 'voluntary', listingId: 'demo-listing-3' }));
    await expectInvalid(repo.requestCertification({ reason: 'voluntary' }));
    await expectInvalid(repo.respondCertification(req.id, true)); // c'est ma demande
    const cancelled = await repo.cancelCertification(req.id);
    expect(cancelled.status).toBe('cancelled');
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
