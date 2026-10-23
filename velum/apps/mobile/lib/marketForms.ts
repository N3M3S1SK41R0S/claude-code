/**
 * Plateformes d'échange et de vente — logique PURE des formulaires (mise en
 * vente / à l'échange, proposition d'échange) : saisie de montants à la
 * française, aperçus en direct (commission, certification, net vendeur),
 * aperçu du masquage des coordonnées. Les RÈGLES viennent de @velum/config
 * (source de vérité, répliquée côté SQL) : rien n'est recalculé ici.
 */
import {
  COMMISSION_TIERS,
  certificationRequirement,
  commissionRateFor,
  estimateCertificationFee,
  exchangeCommission,
  redactContactInfo,
  roundCents,
  saleBreakdown,
  splitCertificationFee,
  type CertificationRequirement,
  type ExchangeCommission,
  type SaleBreakdown,
} from '@velum/config';
import type { ListingKind, ValuationRecord, VelumDomain, VelumItem } from '@velum/core';

import { isForSale, isOpenToExchange } from './marketState';

// ── Montants ─────────────────────────────────────────────────────────────────

/**
 * Montant saisi à la française → nombre (arrondi au centime), ou null si la
 * saisie est vide ou invalide. Accepte « 1 250,50 », « 1250.5 », « 1.250,50 »,
 * « 1 250 € », espaces insécables compris ; refuse les négatifs et le texte.
 */
export function parseFrenchAmount(raw: string): number | null {
  let s = raw
    .trim()
    .replace(/€|eur(?:os?)?/gi, '')
    .replace(/[\s  '’]/g, '');
  if (s.length === 0) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Les deux séparateurs : le DERNIER est décimal, l'autre groupe les milliers.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    if (s.split(decimal).length > 2) return null;
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    // Virgule seule : décimale (usage français) ; plusieurs virgules = invalide.
    if (s.split(',').length > 2) return null;
    s = s.replace(',', '.');
  } else if (s.split('.').length > 2) {
    // Plusieurs points (« 1.250.000 ») : séparateurs de milliers.
    s = s.split('.').join('');
  }

  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? roundCents(value) : null;
}

/** Montant strictement positif, ou null. */
export function parsePositiveAmount(raw: string): number | null {
  const value = parseFrenchAmount(raw);
  return value !== null && value > 0 ? value : null;
}

/** Valeur pré-remplie dans un champ (entier si possible, virgule décimale). */
export function amountToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
  const rounded = roundCents(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace('.', ',');
}

/** Estimation VELUM retenue depuis la dernière valorisation (null si absente). */
export function estimateFromValuation(valuation: Pick<ValuationRecord, 'central'> | null | undefined): number | null {
  if (!valuation || !Number.isFinite(valuation.central) || valuation.central <= 0) return null;
  return roundCents(valuation.central);
}

/**
 * Montant AU CENTIME (prix, commissions, frais) selon la locale, dans SA
 * devise : entier sans décimales, sinon deux décimales — jamais d'arrondi
 * trompeur d'un prix à 1 250,50 €. Devise inconnue → repli lisible.
 */
export function formatPrice(value: number, locale: string, currency = 'EUR'): string {
  const rounded = roundCents(value);
  try {
    return new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  } catch {
    return `${rounded} ${currency}`;
  }
}

/** Taux (0.05) → « 5 % » selon la locale. */
export function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'fr-FR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(rate);
}

// ── Commission dégressive ────────────────────────────────────────────────────

export interface NextCommissionTier {
  /** Taux du palier suivant. */
  rate: number;
  /** Ventes conclues requises pour l'atteindre. */
  minSales: number;
  /** Ventes conclues restant à réaliser. */
  salesNeeded: number;
}

/** Palier de commission suivant (null si le taux minimal est déjà atteint). */
export function nextCommissionTier(completedSales: number): NextCommissionTier | null {
  const sales = Math.max(0, Math.floor(completedSales));
  const current = commissionRateFor(sales);
  const next = [...COMMISSION_TIERS]
    .sort((a, b) => a.minSales - b.minSales)
    .find((tier) => tier.minSales > sales && tier.rate < current);
  return next ? { rate: next.rate, minSales: next.minSales, salesNeeded: next.minSales - sales } : null;
}

// ── Mise en vente / à l'échange ──────────────────────────────────────────────

export type SellCertification = 'required' | 'voluntary' | 'none';

export interface SellPreview {
  /** Prix demandé / valeur déclarée saisi (null si invalide). */
  value: number | null;
  commissionRate: number;
  nextTier: NextCommissionTier | null;
  /** Décomposition de la vente (null pour un échange seul ou un prix invalide). */
  sale: SaleBreakdown | null;
  /** Commission à la conclusion d'un échange (null pour une vente seule). */
  exchange: ExchangeCommission | null;
  requirement: CertificationRequirement;
  certification: SellCertification;
  /** Frais d'expertise INDICATIFS à la charge du vendeur (0 sans expertise). */
  certificationFee: number;
}

export function sellPreview(input: {
  kind: ListingKind;
  priceInput: string;
  completedSales: number;
  estimatedValue: number | null;
  voluntaryCertification: boolean;
}): SellPreview {
  const value = parsePositiveAmount(input.priceInput);
  const requirement = certificationRequirement({
    value: value ?? 0,
    estimatedValue: input.estimatedValue,
  });
  const certification: SellCertification = requirement.required
    ? 'required'
    : input.voluntaryCertification
      ? 'voluntary'
      : 'none';
  const certificationFee =
    certification === 'none' || requirement.referenceValue <= 0
      ? 0
      : estimateCertificationFee(requirement.referenceValue);
  return {
    value,
    commissionRate: commissionRateFor(input.completedSales),
    nextTier: nextCommissionTier(input.completedSales),
    sale:
      value !== null && isForSale(input.kind)
        ? saleBreakdown(value, input.completedSales, certificationFee)
        : null,
    exchange:
      value !== null && isOpenToExchange(input.kind)
        ? exchangeCommission(value, input.completedSales)
        : null,
    requirement,
    certification,
    certificationFee,
  };
}

// ── Proposition d'échange ────────────────────────────────────────────────────

export type CashDirection = 'add' | 'ask';

/**
 * Soulte signée (convention ExchangeProposal.cashAdjustment, vue de l'auteur) :
 * « j'ajoute » → positive, « je demande » → négative. Vide → 0 ; invalide → null.
 */
export function signedCashAdjustment(direction: CashDirection, amountInput: string): number | null {
  if (amountInput.trim().length === 0) return 0;
  const amount = parseFrenchAmount(amountInput);
  if (amount === null) return null;
  if (amount === 0) return 0;
  return direction === 'add' ? amount : -amount;
}

export interface ExchangePreview {
  offeredValue: number | null;
  cashAdjustment: number | null;
  /** Ma commission (sur la valeur de l'objet que je cède), figée à l'acceptation. */
  myCommission: ExchangeCommission | null;
  /** Expertise : obligatoire au-delà du seuil (objet le plus cher), ou convenue. */
  requirement: CertificationRequirement;
  /** Frais d'expertise indicatifs (0 sans expertise). */
  certificationFee: number;
  /** Ma part des frais en cas d'accord mutuel (partage par moitié). */
  myCertificationShare: number;
  /**
   * Équilibre de l'offre : (ma valeur + soulte) − valeur de l'annonce.
   * > 0 : mon offre dépasse ; < 0 : elle est en deçà.
   */
  balance: number | null;
}

export function exchangePreview(input: {
  listingValue: number;
  offeredValueInput: string;
  cashDirection: CashDirection;
  cashInput: string;
  completedSales: number;
  mutualCertification: boolean;
}): ExchangePreview {
  const offeredValue = parsePositiveAmount(input.offeredValueInput);
  const cashAdjustment = signedCashAdjustment(input.cashDirection, input.cashInput);
  const requirement = certificationRequirement({
    value: Math.max(input.listingValue, offeredValue ?? 0),
    mutualAgreement: input.mutualCertification,
  });
  const certificationFee = requirement.required
    ? estimateCertificationFee(requirement.referenceValue)
    : 0;
  const myCertificationShare =
    requirement.reason === 'mutual_agreement'
      ? splitCertificationFee(certificationFee, 'split').buyer
      : 0;
  return {
    offeredValue,
    cashAdjustment,
    myCommission: offeredValue !== null ? exchangeCommission(offeredValue, input.completedSales) : null,
    requirement,
    certificationFee,
    myCertificationShare,
    balance:
      offeredValue !== null && cashAdjustment !== null
        ? roundCents(offeredValue + cashAdjustment - input.listingValue)
        : null,
  };
}

/** Mes objets à proposer : même catégorie que l'annonce d'abord, ordre conservé sinon. */
export function sortItemsForExchange(
  items: readonly VelumItem[],
  domain: VelumDomain | null,
): VelumItem[] {
  if (domain === null) return [...items];
  return [...items.filter((i) => i.domain === domain), ...items.filter((i) => i.domain !== domain)];
}

// ── Anonymat ─────────────────────────────────────────────────────────────────

/**
 * Aperçu du texte tel qu'il sera publié si des coordonnées y figurent
 * (règle @velum/config, appliquée aussi côté serveur) ; null sinon.
 */
export function redactionPreview(text: string): string | null {
  if (text.trim().length === 0) return null;
  const result = redactContactInfo(text);
  return result.redacted ? result.text : null;
}
