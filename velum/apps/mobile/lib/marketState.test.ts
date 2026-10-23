import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VelumError,
  type CertificationRequest,
  type EscrowState,
  type ExchangeProposal,
  type ExchangeState,
  type ListingRecord,
  type ListingStatus,
} from '@velum/core';

import {
  CERTIFICATION_TONE,
  ESCROW_TONE,
  EXCHANGE_PROPOSAL_TTL_DAYS,
  EXCHANGE_TONE,
  LISTING_STATUS_TONE,
  canRequestExchangeCertification,
  canRequestOrderCertification,
  canTransitionOrder,
  canWithdrawListing,
  certificationActions,
  certificationNeedsMe,
  completedSalesCount,
  exchangeActions,
  exchangeNeedsMe,
  exchangeTimeline,
  hasOpenCertificationOn,
  isClosed,
  isExchangeExpired,
  isForSale,
  isNotYetAvailable,
  isOpenToExchange,
  itemCertifiedByExpert,
  listingAvailability,
  marketLabelKeys,
  marketRetry,
  myListingEngaged,
  myCashPayment,
  myCededValue,
  myTracking,
  orderActionTarget,
  orderActions,
  orderNeedsMe,
  partitionActivity,
  pendingActionCount,
  theirTracking,
} from './marketState';

function exchange(patch: Partial<ExchangeProposal> = {}): ExchangeProposal {
  return {
    id: 'ex-1',
    listingId: 'l-1',
    role: 'recipient',
    counterpartyAlias: 'Collectionneur 7F3A',
    listingTitle: 'Annonce',
    listingDomain: 'coin',
    listingValue: 300,
    offeredTitle: 'Objet proposé',
    offeredDomain: 'coin',
    offeredValue: 250,
    cashAdjustment: 50,
    currency: 'EUR',
    message: null,
    state: 'proposed',
    myCommission: null,
    certificationRequired: false,
    proposerTracking: null,
    recipientTracking: null,
    proposerReceived: false,
    recipientReceived: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...patch,
  };
}

describe('libellés et tonalités', () => {
  it('couvre chaque état avec une tonalité', () => {
    expect(ESCROW_TONE.disputed).toBe('danger');
    expect(ESCROW_TONE.released).toBe('success');
    expect(EXCHANGE_TONE.completed).toBe('success');
    expect(EXCHANGE_TONE.proposed).toBe('warning');
    expect(CERTIFICATION_TONE.rejected).toBe('danger');
    expect(LISTING_STATUS_TONE.pending_certification).toBe('warning');
  });

  it('produit des clés i18n du namespace community', () => {
    expect(marketLabelKeys.escrow('funds_held')).toBe('community.state.funds_held');
    expect(marketLabelKeys.exchange('shipping')).toBe('community.exchangeState.shipping');
    expect(marketLabelKeys.certification('in_review')).toBe('community.certStatus.in_review');
    expect(marketLabelKeys.listingKind('sale_or_exchange')).toBe('community.kind.sale_or_exchange');
    expect(marketLabelKeys.listingStatus('withdrawn')).toBe('community.listingStatus.withdrawn');
    expect(marketLabelKeys.certificationReason('threshold')).toBe('community.certReason.threshold');
    expect(marketLabelKeys.feePayer('split')).toBe('community.feePayer.split');
  });

  it('distingue vente et échange selon la nature', () => {
    expect(isForSale('sale')).toBe(true);
    expect(isForSale('sale_or_exchange')).toBe(true);
    expect(isForSale('exchange')).toBe(false);
    expect(isOpenToExchange('exchange')).toBe(true);
    expect(isOpenToExchange('sale_or_exchange')).toBe(true);
    expect(isOpenToExchange('sale')).toBe(false);
  });
});

describe('commandes : actions par rôle × état (miroir migration 0006)', () => {
  const cases: [EscrowState, 'buyer' | 'seller', string[]][] = [
    ['pending_payment', 'buyer', ['pay', 'cancel']],
    ['pending_payment', 'seller', ['cancel']],
    ['funds_held', 'buyer', ['dispute', 'cancel']],
    ['funds_held', 'seller', ['ship', 'cancel']],
    ['shipped', 'buyer', ['confirm_receipt', 'dispute']],
    ['shipped', 'seller', []],
    ['released', 'buyer', []],
    ['disputed', 'buyer', []],
    ['disputed', 'seller', []],
    ['refunded', 'seller', []],
    ['cancelled', 'buyer', []],
  ];
  it.each(cases)('%s / %s → %j', (escrowState, role, expected) => {
    expect(orderActions({ escrowState, role })).toEqual(expected);
  });

  it('donne l’état visé et refuse les transitions illégales', () => {
    expect(orderActionTarget('pending_payment', 'pay')).toBe('funds_held');
    expect(orderActionTarget('funds_held', 'ship')).toBe('shipped');
    expect(orderActionTarget('shipped', 'confirm_receipt')).toBe('released');
    expect(orderActionTarget('shipped', 'pay')).toBeNull();
    expect(canTransitionOrder('seller', 'shipped', 'released')).toBe(false);
    expect(canTransitionOrder('buyer', 'shipped', 'released')).toBe(true);
    expect(canTransitionOrder('buyer', 'disputed', 'refunded')).toBe(false);
  });

  it('expédition bloquée tant qu’une expertise est ouverte (has_open_certification)', () => {
    expect(orderActions({ escrowState: 'funds_held', role: 'seller' }, { hasOpenCertification: true })).toEqual([
      'cancel',
    ]);
    expect(orderNeedsMe({ escrowState: 'funds_held', role: 'seller' }, { hasOpenCertification: true })).toBe(false);
    expect(orderActions({ escrowState: 'funds_held', role: 'seller' }, { hasOpenCertification: false })).toEqual([
      'ship',
      'cancel',
    ]);
  });

  it('compte les ventes conclues (vendeur + fonds libérés)', () => {
    expect(
      completedSalesCount([
        { role: 'seller', escrowState: 'released' },
        { role: 'seller', escrowState: 'released' },
        { role: 'seller', escrowState: 'shipped' },
        { role: 'buyer', escrowState: 'released' },
      ]),
    ).toBe(2);
  });
});

describe('échanges : actions par rôle × état', () => {
  it('proposition : le destinataire accepte/refuse, l’auteur retire', () => {
    expect(exchangeActions(exchange({ role: 'recipient' }))).toEqual(['accept', 'decline']);
    expect(exchangeActions(exchange({ role: 'proposer' }))).toEqual(['withdraw']);
  });

  it('acceptée : expédier sauf si une expertise est exigée', () => {
    expect(exchangeActions(exchange({ state: 'accepted' }))).toEqual(['ship', 'cancel']);
    expect(exchangeActions(exchange({ state: 'accepted', certificationRequired: true }))).toEqual([
      'cancel',
    ]);
    expect(exchangeActions(exchange({ state: 'awaiting_certification' }))).toEqual(['cancel']);
  });

  it('expédition : envoi, réception après envoi adverse, litige dès un envoi', () => {
    expect(exchangeActions(exchange({ state: 'shipping' }))).toEqual(['ship', 'cancel']);
    // Le proposeur a expédié ; je suis destinataire.
    expect(
      exchangeActions(exchange({ state: 'shipping', proposerTracking: 'XY1' })),
    ).toEqual(['ship', 'confirm_receipt', 'dispute']);
    // Les deux ont expédié, j'ai confirmé la réception.
    expect(
      exchangeActions(
        exchange({
          state: 'shipping',
          proposerTracking: 'XY1',
          recipientTracking: 'XY2',
          recipientReceived: true,
        }),
      ),
    ).toEqual(['dispute']);
    // Un numéro vide ne compte pas comme une expédition.
    expect(exchangeActions(exchange({ state: 'shipping', proposerTracking: '  ' }))).toEqual([
      'ship',
      'cancel',
    ]);
  });

  it('expertise ouverte (même un accord attendu) : pas d’expédition proposée', () => {
    expect(exchangeActions(exchange({ state: 'shipping' }), { hasOpenCertification: true })).toEqual(['cancel']);
    expect(
      exchangeActions(exchange({ state: 'shipping', proposerTracking: 'XY1' }), { hasOpenCertification: true }),
    ).toEqual(['confirm_receipt', 'dispute']);
  });

  it('proposition expirée (avant le passage du cron) : plus d’acceptation, refus et retrait restent', () => {
    const expired = { ...exchange(), expiresAt: '2026-10-20T00:00:00Z' };
    const now = '2026-10-23T10:00:00Z';
    expect(exchangeActions(expired, { now })).toEqual(['decline']);
    expect(exchangeActions({ ...expired, role: 'proposer' }, { now })).toEqual(['withdraw']);
    expect(exchangeActions({ ...expired, expiresAt: '2026-10-30T00:00:00Z' }, { now })).toEqual(['accept', 'decline']);
    // Échéance inconnue : le serveur tranche.
    expect(exchangeActions(exchange(), { now })).toEqual(['accept', 'decline']);
  });

  it('isExchangeExpired : échéance atteinte d’une proposition seulement, illisible ⇒ le serveur tranche', () => {
    const now = '2026-10-23T10:00:00Z';
    expect(isExchangeExpired({ state: 'proposed', expiresAt: '2026-10-23T10:00:00Z' }, now)).toBe(true);
    expect(isExchangeExpired({ state: 'proposed', expiresAt: '2026-10-23T10:00:01Z' }, now)).toBe(false);
    expect(isExchangeExpired({ state: 'shipping', expiresAt: '2026-10-01T00:00:00Z' }, now)).toBe(false);
    expect(isExchangeExpired({ state: 'proposed', expiresAt: null }, now)).toBe(false);
    expect(isExchangeExpired({ state: 'proposed', expiresAt: 'pas une date' }, now)).toBe(false);
    expect(isExchangeExpired({ state: 'proposed', expiresAt: '2026-10-01T00:00:00Z' }, undefined)).toBe(false);
  });

  it('EXCHANGE_PROPOSAL_TTL_DAYS est la réplique de exchange_proposal_ttl_days() (SQL)', () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../supabase/migrations/20261023100100_market_exchanges_certification.sql',
      ),
      'utf8',
    );
    const match = /function public\.exchange_proposal_ttl_days\(\)[\s\S]*?select (\d+)/.exec(sql);
    expect(Number(match?.[1])).toBe(EXCHANGE_PROPOSAL_TTL_DAYS);
  });

  it('aucune action sur les états terminaux et en litige', () => {
    const terminal: ExchangeState[] = ['declined', 'withdrawn', 'expired', 'completed', 'cancelled', 'disputed'];
    for (const state of terminal) {
      expect(exchangeActions(exchange({ state, role: 'proposer' }))).toEqual([]);
      expect(exchangeActions(exchange({ state, role: 'recipient' }))).toEqual([]);
    }
  });

  it('lit le suivi, la soulte et la valeur cédée selon MON rôle', () => {
    const asRecipient = exchange({ proposerTracking: 'A', recipientTracking: 'B' });
    expect(myTracking(asRecipient)).toBe('B');
    expect(theirTracking(asRecipient)).toBe('A');
    expect(myCashPayment(asRecipient)).toBe(-50); // je reçois la soulte
    expect(myCededValue(asRecipient)).toBe(300);
    const asProposer = exchange({ role: 'proposer' });
    expect(myCashPayment(asProposer)).toBe(50);
    expect(myCededValue(asProposer)).toBe(250);
  });
});

describe('frise d’un échange', () => {
  it('chemin nominal avec étape courante', () => {
    const { steps, outcome } = exchangeTimeline(exchange({ state: 'accepted' }));
    expect(outcome).toBeNull();
    expect(steps).toEqual([
      { state: 'proposed', status: 'done' },
      { state: 'accepted', status: 'current' },
      { state: 'shipping', status: 'upcoming' },
      { state: 'completed', status: 'upcoming' },
    ]);
  });

  it('insère l’étape d’expertise si exigée et clôt l’échange conclu', () => {
    const { steps } = exchangeTimeline(exchange({ state: 'completed', certificationRequired: true }));
    expect(steps.map((s) => s.state)).toEqual([
      'proposed',
      'accepted',
      'awaiting_certification',
      'shipping',
      'completed',
    ]);
    expect(steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('issue hors chemin : étapes atteintes faites, suivantes sautées', () => {
    const declined = exchangeTimeline(exchange({ state: 'declined' }));
    expect(declined.outcome).toBe('declined');
    expect(declined.steps.map((s) => s.status)).toEqual(['done', 'skipped', 'skipped', 'skipped']);

    const disputed = exchangeTimeline(exchange({ state: 'disputed', proposerTracking: 'X' }));
    expect(disputed.steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'skipped']);

    const cancelled = exchangeTimeline(exchange({ state: 'cancelled' }));
    expect(cancelled.steps.map((s) => s.status)).toEqual(['done', 'done', 'skipped', 'skipped']);
  });
});

describe('certifications et annonces', () => {
  type CertView = Parameters<typeof certificationActions>[0];
  const certView = (patch: Partial<CertView>): CertView => ({
    status: 'requested',
    requestedByMe: true,
    reason: 'mutual_agreement',
    orderId: null,
    exchangeId: null,
    ...patch,
  });

  it('accord mutuel : l’autre partie accepte/refuse, l’auteur annule', () => {
    expect(certificationActions(certView({ status: 'awaiting_agreement', requestedByMe: false }))).toEqual([
      'agree',
      'refuse',
    ]);
    expect(certificationActions(certView({ status: 'awaiting_agreement', requestedByMe: true }))).toEqual(['cancel']);
    expect(certificationActions(certView({ status: 'in_review', requestedByMe: true }))).toEqual(['cancel']);
    expect(certificationActions(certView({ status: 'in_review', requestedByMe: false }))).toEqual([]);
    expect(certificationActions(certView({ status: 'certified', requestedByMe: true }))).toEqual([]);
  });

  it('annulation selon le motif et le contexte (enforce_certification_transition)', () => {
    // Démarche volontaire : son auteur l'annule.
    expect(certificationActions(certView({ reason: 'voluntary' }))).toEqual(['cancel']);
    // Seuil d'une annonce seule : son propriétaire l'annule (l'annonce repasse en brouillon).
    expect(certificationActions(certView({ reason: 'threshold' }))).toEqual(['cancel']);
    // Seuil d'un échange ou d'une commande : on n'annule qu'en annulant la transaction.
    expect(certificationActions(certView({ reason: 'threshold', exchangeId: 'e-1' }))).toEqual([]);
    expect(certificationActions(certView({ reason: 'threshold', orderId: 'o-1' }))).toEqual([]);
    expect(certificationActions(certView({ reason: 'threshold', exchangeId: 'e-1', status: 'in_review' }))).toEqual([]);
  });

  it('retrait possible tant que l’annonce n’est ni vendue, ni échangée, ni réservée', () => {
    expect(canWithdrawListing('active')).toBe(true);
    expect(canWithdrawListing('pending_certification')).toBe(true);
    expect(canWithdrawListing('draft')).toBe(true);
    expect(canWithdrawListing('sold')).toBe(false);
    expect(canWithdrawListing('exchanged')).toBe(false);
    expect(canWithdrawListing('withdrawn')).toBe(false);
    // Réservée (paiement capturé ou échange accepté) : statut figé côté serveur.
    expect(canWithdrawListing('active', true)).toBe(false);
  });

  it('reconnaît MON annonce réservée par une transaction en cours', () => {
    const order = (escrowState: EscrowState) => ({ listingId: 'l-1', escrowState });
    const ex = (state: ExchangeState) => ({ listingId: 'l-1', state });
    expect(myListingEngaged('l-1', [order('funds_held')], [])).toBe(true);
    expect(myListingEngaged('l-1', [order('disputed')], [])).toBe(true);
    expect(myListingEngaged('l-1', [], [ex('shipping')])).toBe(true);
    // Commande non payée, échange proposé ou clos : pas de réservation.
    expect(myListingEngaged('l-1', [order('pending_payment'), order('cancelled')], [ex('proposed'), ex('completed')])).toBe(
      false,
    );
    expect(myListingEngaged('l-2', [order('funds_held')], [ex('shipping')])).toBe(false);
  });

  it('compte les éléments qui attendent MON action', () => {
    expect(
      pendingActionCount({
        orders: [
          { role: 'buyer', escrowState: 'shipped' }, // confirmer
          { role: 'seller', escrowState: 'shipped' }, // rien
        ],
        exchanges: [exchange(), exchange({ role: 'proposer' })], // accepter / (retirer : non principal)
        certifications: [{ status: 'awaiting_agreement', requestedByMe: false }],
      }),
    ).toBe(3);
    expect(pendingActionCount({})).toBe(0);
  });

  it('une expédition bloquée par une expertise ouverte n’attend pas mon action', () => {
    const certifications = [
      { status: 'awaiting_agreement' as const, requestedByMe: true, orderId: 'o-1', exchangeId: null },
      { status: 'requested' as const, requestedByMe: false, orderId: null, exchangeId: 'ex-1' },
    ];
    expect(hasOpenCertificationOn(certifications, { orderId: 'o-1' })).toBe(true);
    expect(hasOpenCertificationOn(certifications, { exchangeId: 'ex-1' })).toBe(true);
    expect(hasOpenCertificationOn(certifications, { orderId: 'o-2' })).toBe(false);
    expect(
      pendingActionCount({
        orders: [{ id: 'o-1', role: 'seller', escrowState: 'funds_held' }],
        exchanges: [exchange({ state: 'shipping' })],
        certifications,
      }),
    ).toBe(0);
  });
});

describe('expertise d’un commun accord : demandée sur la transaction (miroir de request_certification)', () => {
  type Cert = Parameters<typeof canRequestExchangeCertification>[1][number];
  const cert = (patch: Partial<Cert>): Cert => ({
    reason: 'mutual_agreement',
    status: 'awaiting_agreement',
    requestedByMe: true,
    ...patch,
  });

  it('échange : seulement accepté et AVANT toute expédition (jamais sur une simple proposition)', () => {
    expect(canRequestExchangeCertification(exchange({ state: 'proposed' }), [])).toBe(false);
    expect(canRequestExchangeCertification(exchange({ state: 'shipping' }), [])).toBe(true);
    expect(canRequestExchangeCertification(exchange({ state: 'awaiting_certification' }), [])).toBe(true);
    expect(canRequestExchangeCertification(exchange({ state: 'shipping', recipientTracking: 'LL1FR' }), [])).toBe(false);
    expect(canRequestExchangeCertification(exchange({ state: 'shipping', proposerTracking: 'LL1FR' }), [])).toBe(false);
    expect(canRequestExchangeCertification(exchange({ state: 'completed' }), [])).toBe(false);
  });

  it('échange : porte sur l’objet que je REÇOIS — pas de doublon, l’expertise de mon objet n’empêche rien', () => {
    const shipping = exchange({ state: 'awaiting_certification' });
    // Expertise de seuil de MON objet (demandée par moi, propriétaire) : sans effet.
    expect(canRequestExchangeCertification(shipping, [cert({ reason: 'threshold', status: 'requested' })])).toBe(true);
    // Expertise de seuil de l'objet que je reçois (demandée par l'autre partie) : déjà prévue.
    expect(
      canRequestExchangeCertification(shipping, [cert({ reason: 'threshold', status: 'in_review', requestedByMe: false })]),
    ).toBe(false);
    // Ma demande en cours ou déjà certifiée : pas de seconde ; refusée/annulée : renouvelable.
    expect(canRequestExchangeCertification(shipping, [cert({})])).toBe(false);
    expect(canRequestExchangeCertification(shipping, [cert({ status: 'certified' })])).toBe(false);
    expect(canRequestExchangeCertification(shipping, [cert({ status: 'cancelled' })])).toBe(true);
    // Demande de l'autre partie (elle porte sur MON objet) : sans effet.
    expect(canRequestExchangeCertification(shipping, [cert({ requestedByMe: false })])).toBe(true);
  });

  it('commande : avant expédition, une seule demande ouverte, rien après certification', () => {
    const order = (escrowState: EscrowState) => ({ escrowState });
    expect(canRequestOrderCertification(order('pending_payment'), [])).toBe(true);
    expect(canRequestOrderCertification(order('funds_held'), [])).toBe(true);
    expect(canRequestOrderCertification(order('shipped'), [])).toBe(false);
    expect(canRequestOrderCertification(order('released'), [])).toBe(false);
    expect(canRequestOrderCertification(order('funds_held'), [{ status: 'awaiting_agreement' }])).toBe(false);
    expect(canRequestOrderCertification(order('funds_held'), [{ status: 'certified' }])).toBe(false);
    expect(canRequestOrderCertification(order('funds_held'), [{ status: 'cancelled' }])).toBe(true);
  });
});

describe('objet déjà certifié (la certification suit l’objet)', () => {
  const listing = (patch: Partial<Pick<ListingRecord, 'id' | 'itemId' | 'status' | 'certified'>>) => ({
    id: 'l-1',
    itemId: 'it-1',
    status: 'withdrawn' as ListingStatus,
    certified: false,
    ...patch,
  });
  const cert = (patch: Partial<Pick<CertificationRequest, 'listingId' | 'orderId' | 'exchangeId' | 'reason' | 'status' | 'requestedByMe'>>) => ({
    listingId: null,
    orderId: null,
    exchangeId: null,
    reason: 'voluntary' as const,
    status: 'certified' as const,
    requestedByMe: true,
    ...patch,
  });

  it('badge d’une de mes annonces de l’objet, ou certification obtenue sur elle', () => {
    expect(itemCertifiedByExpert('it-1', [listing({ certified: true })], [])).toBe(true);
    expect(itemCertifiedByExpert('it-1', [listing({})], [cert({ listingId: 'l-1' })])).toBe(true);
    // Expertise d'un commun accord sur une commande de mon annonce (j'en suis le propriétaire).
    expect(
      itemCertifiedByExpert('it-1', [listing({})], [cert({ listingId: 'l-1', orderId: 'o-1', reason: 'mutual_agreement', requestedByMe: false })]),
    ).toBe(true);
  });

  it('échange sur mon annonce : seule l’expertise de MON objet compte', () => {
    const exchanges = [{ id: 'e-1', listingId: 'l-1', role: 'recipient' as const }];
    const onMine = cert({ exchangeId: 'e-1', reason: 'threshold', requestedByMe: true });
    const onTheirs = cert({ exchangeId: 'e-1', reason: 'mutual_agreement', requestedByMe: true });
    expect(itemCertifiedByExpert('it-1', [listing({})], [onMine], exchanges)).toBe(true);
    expect(itemCertifiedByExpert('it-1', [listing({})], [onTheirs], exchanges)).toBe(false);
  });

  it('prudent : autre objet, demande non aboutie, objet déjà cédé → non', () => {
    expect(itemCertifiedByExpert('it-2', [listing({ certified: true })], [])).toBe(false);
    expect(itemCertifiedByExpert('it-1', [listing({})], [cert({ listingId: 'l-1', status: 'in_review' })])).toBe(false);
    expect(itemCertifiedByExpert('it-1', [listing({ certified: true, status: 'sold' })], [])).toBe(false);
  });
});

describe('annonce d’autrui : actions selon MES transactions (miroir des refus serveur)', () => {
  const listing = { id: 'l-1', kind: 'sale_or_exchange', isMine: false } as const;
  const order = (escrowState: EscrowState, listingId = 'l-1') =>
    ({ id: `o-${escrowState}`, listingId, role: 'buyer', escrowState }) as const;
  const ex = (state: ExchangeState, listingId = 'l-1') =>
    ({ id: `e-${state}`, listingId, role: 'proposer', state }) as const;

  it('sans transaction : acheter et proposer selon la nature de l’annonce', () => {
    expect(listingAvailability(listing, [], [])).toEqual({ canBuy: true, canPropose: true, mine: null });
    expect(listingAvailability({ ...listing, kind: 'sale' }, [], []).canPropose).toBe(false);
    expect(listingAvailability({ ...listing, kind: 'exchange' }, [], []).canBuy).toBe(false);
    // Transactions sur une AUTRE annonce, ou closes sans suite : sans effet.
    expect(listingAvailability(listing, [order('funds_held', 'l-2'), order('cancelled')], [ex('declined')])).toEqual({
      canBuy: true,
      canPropose: true,
      mine: null,
    });
  });

  it('commande en attente de paiement : pas de seconde commande, l’échange reste possible', () => {
    expect(listingAvailability(listing, [order('pending_payment')], [])).toEqual({
      canBuy: false,
      canPropose: true,
      mine: { kind: 'order', id: 'o-pending_payment' },
    });
  });

  it('annonce réservée ou conclue par MA transaction : plus aucune action, lien vers elle', () => {
    for (const state of ['funds_held', 'shipped', 'disputed', 'released'] as const) {
      expect(listingAvailability(listing, [order(state)], [])).toEqual({
        canBuy: false,
        canPropose: false,
        mine: { kind: 'order', id: `o-${state}` },
      });
    }
    for (const state of ['accepted', 'awaiting_certification', 'shipping', 'disputed', 'completed'] as const) {
      expect(listingAvailability(listing, [], [ex(state)])).toEqual({
        canBuy: false,
        canPropose: false,
        mine: { kind: 'exchange', id: `e-${state}` },
      });
    }
  });

  it('proposition en attente : pas de seconde proposition, l’achat reste possible', () => {
    expect(listingAvailability(listing, [], [ex('proposed')])).toEqual({
      canBuy: true,
      canPropose: false,
      mine: { kind: 'exchange', id: 'e-proposed' },
    });
  });

  it('ma propre annonce : aucune action d’achat ni d’échange', () => {
    expect(listingAvailability({ ...listing, isMine: true }, [], [])).toEqual({
      canBuy: false,
      canPropose: false,
      mine: null,
    });
  });
});

describe('historique de « Mon activité »', () => {
  it('reconnaît les éléments clos', () => {
    expect(isClosed.order({ escrowState: 'released' })).toBe(true);
    expect(isClosed.order({ escrowState: 'disputed' })).toBe(false);
    expect(isClosed.exchange({ state: 'completed' })).toBe(true);
    expect(isClosed.exchange({ state: 'awaiting_certification' })).toBe(false);
    expect(isClosed.certification({ status: 'certified' })).toBe(true);
    expect(isClosed.certification({ status: 'in_review' })).toBe(false);
    expect(isClosed.listing({ status: 'withdrawn' })).toBe(true);
    expect(isClosed.listing({ status: 'pending_certification' })).toBe(false);
  });

  it('place d’abord ce qui attend mon action, l’historique à part', () => {
    const orders = [
      { id: 'a', role: 'seller' as const, escrowState: 'shipped' as const },
      { id: 'b', role: 'seller' as const, escrowState: 'released' as const },
      { id: 'c', role: 'buyer' as const, escrowState: 'shipped' as const },
    ];
    const { current, history } = partitionActivity(orders, isClosed.order, orderNeedsMe);
    expect(current.map((o) => o.id)).toEqual(['c', 'a']);
    expect(history.map((o) => o.id)).toEqual(['b']);
    expect(exchangeNeedsMe(exchange())).toBe(true);
    expect(exchangeNeedsMe(exchange({ role: 'proposer' }))).toBe(false);
    expect(certificationNeedsMe({ status: 'awaiting_agreement', requestedByMe: false })).toBe(true);
    expect(certificationNeedsMe({ status: 'awaiting_agreement', requestedByMe: true })).toBe(false);
  });
});

describe('isNotYetAvailable', () => {
  it('reconnaît une fonction serveur pas encore câblée, pas une panne', () => {
    expect(
      isNotYetAvailable(new VelumError('SOURCE_UNAVAILABLE', 'Mes échanges : fonction pas encore disponible')),
    ).toBe(true);
    expect(isNotYetAvailable(new VelumError('SOURCE_UNAVAILABLE', 'Lecture impossible : timeout'))).toBe(false);
    expect(isNotYetAvailable(new Error('pas encore disponible'))).toBe(false);
  });

  it('ne relance pas une fonction pas encore câblée, relance 2 fois une panne', () => {
    const notYet = new VelumError('SOURCE_UNAVAILABLE', 'Messagerie : fonction pas encore disponible');
    const outage = new VelumError('SOURCE_UNAVAILABLE', 'timeout');
    expect(marketRetry(0, notYet)).toBe(false);
    expect(marketRetry(0, outage)).toBe(true);
    expect(marketRetry(1, outage)).toBe(true);
    expect(marketRetry(2, outage)).toBe(false);
  });
});
