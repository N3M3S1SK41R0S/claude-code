/**
 * Plateformes d'échange et de vente — commission dégressive, logique PURE
 * (testée sans React Native) : base des aperçus (mise en vente, proposition
 * et détail d'échange) et carte « Mes commissions » de « Mon activité ».
 *
 * Source de vérité : le SERVEUR (`my_commission_summary`, via
 * `MarketplaceRepo.commissionSummary()`) — taux actuel et ventes retenues
 * pour le palier (commandes libérées d'au moins 20 €, 3 au plus par
 * acheteur : migration 20261023132000). Synthèse indisponible (panne,
 * hors-ligne, dépôt sans la méthode, réponse illisible) : l'aperçu retombe
 * sur le taux MAXIMAL (5 %) et le dit — jamais un taux trop favorable.
 */
import type { CommissionSummary } from '@velum/api-client';
import {
  COMMISSION_TIERS,
  MARKETPLACE_COMMISSION_MAX,
  MARKETPLACE_COMMISSION_MIN,
  commissionRateFor,
  roundCents,
  type ExchangeCommission,
  type SaleBreakdown,
} from '@velum/config';

/**
 * Montant minimal d'une vente retenue pour le palier — réplique de
 * commission_min_qualifying_sale_eur() (relue par les tests).
 */
export const COMMISSION_MIN_QUALIFYING_SALE_EUR = 20;

/**
 * Ventes retenues au plus par acheteur — réplique de
 * commission_max_sales_per_buyer() (relue par les tests).
 */
export const COMMISSION_MAX_SALES_PER_BUYER = 3;

/**
 * Ventes retenues pour le palier d'un vendeur, miroir de
 * commission_qualifying_sales() : commandes LIBÉRÉES (à passer déjà filtrées)
 * d'au moins COMMISSION_MIN_QUALIFYING_SALE_EUR, chaque acheteur comptant
 * pour COMMISSION_MAX_SALES_PER_BUYER ventes au plus.
 */
export function qualifyingSalesCount(released: readonly { buyerId: string; amount: number }[]): number {
  const perBuyer = new Map<string, number>();
  for (const sale of released) {
    if (!Number.isFinite(sale.amount) || sale.amount < COMMISSION_MIN_QUALIFYING_SALE_EUR) continue;
    perBuyer.set(sale.buyerId, (perBuyer.get(sale.buyerId) ?? 0) + 1);
  }
  let total = 0;
  for (const count of perBuyer.values()) total += Math.min(count, COMMISSION_MAX_SALES_PER_BUYER);
  return total;
}

// ── Base des aperçus ─────────────────────────────────────────────────────────

/** Taux appliqué aux aperçus et son origine. */
export interface CommissionBasis {
  /** Taux appliqué (0.05 = 5 %). */
  rate: number;
  /** Ventes retenues pour le palier (serveur), null si inconnues. */
  completedSales: number | null;
  /** 'server' : taux lu du serveur ; 'fallback' : repli sur le taux maximal. */
  source: 'server' | 'fallback';
}

/** Repli : le taux le plus élevé, jamais un taux trop favorable. */
export const FALLBACK_COMMISSION_BASIS: CommissionBasis = {
  rate: MARKETPLACE_COMMISSION_MAX,
  completedSales: null,
  source: 'fallback',
};

/** Taux plausible : fini et dans la grille dégressive [2 %, 5 %]. */
function isPlausibleRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= MARKETPLACE_COMMISSION_MIN && rate <= MARKETPLACE_COMMISSION_MAX;
}

/**
 * Base des aperçus depuis la synthèse serveur. Synthèse absente ou taux
 * illisible (jsonb défensif : un taux manquant vaut 0, qui serait le plus
 * favorable) → repli sur le taux maximal.
 */
export function commissionBasis(
  summary: Pick<CommissionSummary, 'currentRate' | 'completedSales'> | null | undefined,
): CommissionBasis {
  if (summary === null || summary === undefined || !isPlausibleRate(summary.currentRate)) {
    return FALLBACK_COMMISSION_BASIS;
  }
  const sales = summary.completedSales;
  return {
    rate: summary.currentRate,
    completedSales: Number.isFinite(sales) && sales >= 0 ? Math.floor(sales) : null,
    source: 'server',
  };
}

/** État de la lecture du taux, pour la mention sous l'aperçu. */
export type CommissionBasisStatus = 'ready' | 'loading' | 'offline' | 'unavailable';

/**
 * Base + état depuis la lecture React Query de la synthèse : chargement,
 * hors-ligne (requête en attente du réseau), indisponible (panne, méthode
 * absente, taux illisible) ou prêt. Toujours une base utilisable : le taux
 * maximal tant que le serveur n'a pas répondu.
 */
export function commissionBasisState(query: {
  data: Pick<CommissionSummary, 'currentRate' | 'completedSales'> | undefined;
  isError: boolean;
  isPending: boolean;
  fetchStatus?: 'fetching' | 'paused' | 'idle';
}): { basis: CommissionBasis; status: CommissionBasisStatus } {
  if (query.data !== undefined) {
    const basis = commissionBasis(query.data);
    return { basis, status: basis.source === 'server' ? 'ready' : 'unavailable' };
  }
  if (query.isError) return { basis: FALLBACK_COMMISSION_BASIS, status: 'unavailable' };
  if (query.fetchStatus === 'paused') return { basis: FALLBACK_COMMISSION_BASIS, status: 'offline' };
  return { basis: FALLBACK_COMMISSION_BASIS, status: query.isPending ? 'loading' : 'unavailable' };
}

/** Clé i18n de la mention sous un aperçu (null si le taux vient du serveur). */
export function commissionBasisNoticeKey(status: CommissionBasisStatus): string | null {
  switch (status) {
    case 'ready':
      return null;
    case 'loading':
      return 'community.rateLoading';
    case 'offline':
      return 'community.rateOffline';
    default:
      return 'community.rateUnknown';
  }
}

export interface NextCommissionTier {
  /** Taux du palier suivant. */
  rate: number;
  /** Ventes retenues requises pour l'atteindre. */
  minSales: number;
  /** Ventes retenues restant à réaliser. */
  salesNeeded: number;
}

/**
 * Palier suivant pour `completedSales` ventes retenues, depuis le taux
 * `currentRate` (par défaut : celui de la grille) ; null si le taux minimal
 * est atteint.
 */
export function nextCommissionTier(completedSales: number, currentRate?: number): NextCommissionTier | null {
  const sales = Math.max(0, Math.floor(completedSales));
  const current = currentRate ?? commissionRateFor(sales);
  const next = [...COMMISSION_TIERS]
    .sort((a, b) => a.minSales - b.minSales)
    .find((tier) => tier.minSales > sales && tier.rate < current);
  return next ? { rate: next.rate, minSales: next.minSales, salesNeeded: next.minSales - sales } : null;
}

/** true si le serveur applique déjà le taux le plus bas (jamais affirmé en repli). */
export function isBestTier(basis: CommissionBasis): boolean {
  return basis.source === 'server' && basis.rate <= MARKETPLACE_COMMISSION_MIN;
}

/** Palier suivant d'une base (null si les ventes retenues sont inconnues ou le minimum atteint). */
export function nextTierOf(basis: CommissionBasis): NextCommissionTier | null {
  return basis.completedSales === null ? null : nextCommissionTier(basis.completedSales, basis.rate);
}

/** Commission d'un échange (sur la valeur de l'objet cédé) au taux de la base. */
export function exchangeCommissionAt(declaredValueCeded: number, basis: CommissionBasis): ExchangeCommission {
  return { commissionRate: basis.rate, commission: roundCents(Math.max(0, declaredValueCeded) * basis.rate) };
}

/**
 * Décomposition d'une vente au taux de la base (même calcul que
 * saleBreakdown de @velum/config, taux fourni par le serveur).
 */
export function saleBreakdownAt(price: number, basis: CommissionBasis, certificationFee = 0): SaleBreakdown {
  const commission = roundCents(Math.max(0, price) * basis.rate);
  const fee = roundCents(Math.max(0, certificationFee));
  return {
    price: roundCents(price),
    commissionRate: basis.rate,
    commission,
    certificationFee: fee,
    sellerNet: roundCents(Math.max(0, price - commission - fee)),
  };
}

// ── Carte « Mes commissions » ───────────────────────────────────────────────

export interface CommissionCardModel {
  currency: string;
  /** Taux actuel (null si illisible : la carte le dit, sans inventer). */
  currentRate: number | null;
  /** Ventes retenues pour le palier. */
  completedSales: number;
  nextTier: NextCommissionTier | null;
  /** Totaux du registre de la plateforme. */
  commissions: number;
  certificationFees: number;
  payouts: number;
  /** Aucune écriture au registre pour l'instant. */
  empty: boolean;
}

/** Modèle de la carte « Mes commissions » (registre transparent). */
export function commissionCardModel(summary: CommissionSummary): CommissionCardModel {
  const basis = commissionBasis(summary);
  const known = basis.source === 'server';
  const completedSales = basis.completedSales ?? 0;
  return {
    currency: summary.currency,
    currentRate: known ? basis.rate : null,
    completedSales,
    nextTier: known ? nextTierOf(basis) : null,
    commissions: roundCents(summary.commissions),
    certificationFees: roundCents(summary.certificationFees),
    payouts: roundCents(summary.payouts),
    empty: summary.entries <= 0,
  };
}
