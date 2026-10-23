import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CommissionSummary } from '@velum/api-client';

import {
  COMMISSION_MAX_SALES_PER_BUYER,
  COMMISSION_MIN_QUALIFYING_SALE_EUR,
  FALLBACK_COMMISSION_BASIS,
  commissionBasis,
  commissionBasisNoticeKey,
  commissionBasisState,
  commissionCardModel,
  exchangeCommissionAt,
  isBestTier,
  nextCommissionTier,
  nextTierOf,
  qualifyingSalesCount,
  saleBreakdownAt,
} from './marketCommission';

const MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20261023132000_commission_qualifying_sales.sql',
);

function summary(patch: Partial<CommissionSummary> = {}): CommissionSummary {
  return {
    currency: 'EUR',
    currentRate: 0.04,
    completedSales: 12,
    commissions: 84.5,
    certificationFees: 30,
    payouts: 1605.5,
    entries: 25,
    ...patch,
  };
}

describe('ventes retenues pour le palier (miroir de commission_qualifying_sales)', () => {
  it('constantes répliquées de la migration SQL', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const min = /function public\.commission_min_qualifying_sale_eur\(\)[\s\S]*?select (\d+)::numeric/.exec(sql);
    const perBuyer = /function public\.commission_max_sales_per_buyer\(\)[\s\S]*?select (\d+)/.exec(sql);
    expect(Number(min?.[1])).toBe(COMMISSION_MIN_QUALIFYING_SALE_EUR);
    expect(Number(perBuyer?.[1])).toBe(COMMISSION_MAX_SALES_PER_BUYER);
  });

  it('ventes d’au moins 20 €, 3 au plus par acheteur', () => {
    expect(
      qualifyingSalesCount([
        { buyerId: 'a', amount: 120 },
        { buyerId: 'a', amount: 60 },
        { buyerId: 'a', amount: 25 },
        { buyerId: 'a', amount: 300 }, // 4e vente au même acheteur : non retenue
        { buyerId: 'b', amount: 19.99 }, // sous 20 € : non retenue
        { buyerId: 'b', amount: 20 },
        { buyerId: 'c', amount: Number.NaN },
      ]),
    ).toBe(4);
    expect(qualifyingSalesCount([])).toBe(0);
  });
});

describe('base des aperçus', () => {
  it('taux serveur plausible → appliqué ; absent, nul ou hors grille → taux MAXIMAL', () => {
    expect(commissionBasis({ currentRate: 0.03, completedSales: 27.9 })).toEqual({
      rate: 0.03,
      completedSales: 27,
      source: 'server',
    });
    // jsonToCommissionSummary vaut 0 pour un taux manquant : jamais retenu (trop favorable).
    expect(commissionBasis({ currentRate: 0, completedSales: 0 })).toBe(FALLBACK_COMMISSION_BASIS);
    expect(commissionBasis({ currentRate: 0.01, completedSales: 80 })).toBe(FALLBACK_COMMISSION_BASIS);
    expect(commissionBasis({ currentRate: 0.2, completedSales: 0 })).toBe(FALLBACK_COMMISSION_BASIS);
    expect(commissionBasis({ currentRate: Number.NaN, completedSales: 0 })).toBe(FALLBACK_COMMISSION_BASIS);
    expect(commissionBasis(null)).toEqual({ rate: 0.05, completedSales: null, source: 'fallback' });
    expect(commissionBasis({ currentRate: 0.05, completedSales: -1 })).toEqual({
      rate: 0.05,
      completedSales: null,
      source: 'server',
    });
  });

  it('état de lecture : chargement, hors-ligne, panne, prêt — toujours une base utilisable', () => {
    expect(commissionBasisState({ data: undefined, isError: false, isPending: true, fetchStatus: 'fetching' })).toEqual({
      basis: FALLBACK_COMMISSION_BASIS,
      status: 'loading',
    });
    expect(commissionBasisState({ data: undefined, isError: false, isPending: true, fetchStatus: 'paused' }).status).toBe(
      'offline',
    );
    expect(commissionBasisState({ data: undefined, isError: true, isPending: false }).status).toBe('unavailable');
    expect(commissionBasisState({ data: summary({ currentRate: 0 }), isError: false, isPending: false }).status).toBe(
      'unavailable',
    );
    const ready = commissionBasisState({ data: summary(), isError: false, isPending: false });
    expect(ready).toEqual({ basis: { rate: 0.04, completedSales: 12, source: 'server' }, status: 'ready' });
    // Données en cache malgré une relecture en échec : le taux connu reste affiché.
    expect(commissionBasisState({ data: summary(), isError: true, isPending: false }).status).toBe('ready');
  });

  it('mention explicite sous l’aperçu dès que le taux n’est pas celui du serveur', () => {
    expect(commissionBasisNoticeKey('ready')).toBeNull();
    expect(commissionBasisNoticeKey('loading')).toBe('community.rateLoading');
    expect(commissionBasisNoticeKey('offline')).toBe('community.rateOffline');
    expect(commissionBasisNoticeKey('unavailable')).toBe('community.rateUnknown');
  });

  it('palier suivant depuis le taux et les ventes retenues du serveur', () => {
    expect(nextCommissionTier(0)).toEqual({ rate: 0.04, minSales: 10, salesNeeded: 10 });
    expect(nextCommissionTier(49)).toEqual({ rate: 0.02, minSales: 50, salesNeeded: 1 });
    expect(nextCommissionTier(50)).toBeNull();
    expect(nextTierOf(commissionBasis({ currentRate: 0.04, completedSales: 12 }))).toEqual({
      rate: 0.03,
      minSales: 25,
      salesNeeded: 13,
    });
    expect(nextTierOf(FALLBACK_COMMISSION_BASIS)).toBeNull();
  });

  it('« taux le plus bas » affirmé seulement par le serveur', () => {
    expect(isBestTier(commissionBasis({ currentRate: 0.02, completedSales: 60 }))).toBe(true);
    expect(isBestTier(commissionBasis({ currentRate: 0.03, completedSales: 30 }))).toBe(false);
    expect(isBestTier(FALLBACK_COMMISSION_BASIS)).toBe(false);
  });

  it('décomposition et commission d’échange au taux de la base, au centime', () => {
    const basis = commissionBasis({ currentRate: 0.05, completedSales: 0 });
    expect(saleBreakdownAt(20.7, basis)).toEqual({
      price: 20.7,
      commissionRate: 0.05,
      commission: 1.04,
      certificationFee: 0,
      sellerNet: 19.66,
    });
    expect(saleBreakdownAt(900, commissionBasis({ currentRate: 0.02, completedSales: 60 }), 30)).toEqual({
      price: 900,
      commissionRate: 0.02,
      commission: 18,
      certificationFee: 30,
      sellerNet: 852,
    });
    expect(exchangeCommissionAt(45, basis)).toEqual({ commissionRate: 0.05, commission: 2.25 });
  });
});

describe('carte « Mes commissions »', () => {
  it('taux actuel, palier suivant, totaux du registre', () => {
    expect(commissionCardModel(summary())).toEqual({
      currency: 'EUR',
      currentRate: 0.04,
      completedSales: 12,
      nextTier: { rate: 0.03, minSales: 25, salesNeeded: 13 },
      commissions: 84.5,
      certificationFees: 30,
      payouts: 1605.5,
      empty: false,
    });
  });

  it('registre vide ; taux illisible jamais inventé', () => {
    const empty = commissionCardModel(
      summary({ currentRate: 0.05, completedSales: 0, commissions: 0, certificationFees: 0, payouts: 0, entries: 0 }),
    );
    expect(empty).toMatchObject({ currentRate: 0.05, empty: true, nextTier: { salesNeeded: 10 } });
    const unreadable = commissionCardModel(summary({ currentRate: 0 }));
    expect(unreadable.currentRate).toBeNull();
    expect(unreadable.nextTier).toBeNull();
  });
});
