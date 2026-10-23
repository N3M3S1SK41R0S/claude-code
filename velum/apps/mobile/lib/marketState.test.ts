import { describe, expect, it } from 'vitest';
import { VelumError, type EscrowState, type ExchangeProposal, type ExchangeState } from '@velum/core';

import {
  CERTIFICATION_TONE,
  ESCROW_TONE,
  EXCHANGE_TONE,
  LISTING_STATUS_TONE,
  canTransitionOrder,
  canWithdrawListing,
  certificationActions,
  certificationNeedsMe,
  completedSalesCount,
  exchangeActions,
  exchangeNeedsMe,
  exchangeTimeline,
  isClosed,
  isForSale,
  isNotYetAvailable,
  isOpenToExchange,
  marketLabelKeys,
  marketRetry,
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
  it('accord mutuel : l’autre partie accepte/refuse, l’auteur annule', () => {
    expect(certificationActions({ status: 'awaiting_agreement', requestedByMe: false })).toEqual([
      'agree',
      'refuse',
    ]);
    expect(certificationActions({ status: 'awaiting_agreement', requestedByMe: true })).toEqual(['cancel']);
    expect(certificationActions({ status: 'in_review', requestedByMe: true })).toEqual(['cancel']);
    expect(certificationActions({ status: 'in_review', requestedByMe: false })).toEqual([]);
    expect(certificationActions({ status: 'certified', requestedByMe: true })).toEqual([]);
  });

  it('retrait possible tant que l’annonce n’est ni vendue ni échangée', () => {
    expect(canWithdrawListing('active')).toBe(true);
    expect(canWithdrawListing('pending_certification')).toBe(true);
    expect(canWithdrawListing('sold')).toBe(false);
    expect(canWithdrawListing('exchanged')).toBe(false);
    expect(canWithdrawListing('withdrawn')).toBe(false);
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
