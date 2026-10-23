/**
 * Plateformes d'échange et de vente — logique PURE des formulaires (mise en
 * vente / à l'échange, proposition d'échange) : saisie de montants à la
 * française, aperçus en direct (commission, certification, net vendeur),
 * aperçu du masquage des coordonnées. Les RÈGLES viennent de @velum/config
 * (source de vérité, répliquée côté SQL) et les bornes / transporteurs de
 * @velum/api-client ; le TAUX de commission vient du serveur
 * (lib/marketCommission, repli sur le taux maximal) : rien n'est recalculé ici.
 */
import {
  certificationRequirement,
  estimateCertificationFee,
  redactContactInfo,
  roundCents,
  splitCertificationFee,
  type CertificationRequirement,
  type ExchangeCommission,
  type SaleBreakdown,
} from '@velum/config';
import {
  MARKET_CARRIERS,
  MARKET_MAX_AMOUNT,
  MARKET_MIN_ASK_PRICE,
  normalizeTrackingNumber as normalizeServerTracking,
  type MarketCarrier,
} from '@velum/api-client';
import type { ListingKind, ValuationRecord, VelumDomain, VelumItem } from '@velum/core';

import {
  exchangeCommissionAt,
  nextCommissionTier,
  nextTierOf,
  saleBreakdownAt,
  type CommissionBasis,
  type NextCommissionTier,
} from './marketCommission';
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

/**
 * Motif de refus d'un montant saisi : illisible, sous le minimum
 * (MARKET_MIN_ASK_PRICE, 1 €), au-delà du plus grand montant représentable
 * côté serveur (MARKET_MAX_AMOUNT, numeric(14, 2)).
 */
export type AmountProblem = 'invalid' | 'belowMin' | 'aboveMax';

export type AmountCheck = { ok: true; value: number } | { ok: false; problem: AmountProblem };

/**
 * Prix demandé ou valeur déclarée saisi → montant accepté par le serveur
 * (bornes de @velum/api-client : market_min_ask_price_eur() et numeric(14, 2)),
 * ou le motif du refus pour un message clair.
 */
export function checkMarketAmount(raw: string): AmountCheck {
  const value = parseFrenchAmount(raw);
  if (value === null) return { ok: false, problem: 'invalid' };
  if (value < MARKET_MIN_ASK_PRICE) return { ok: false, problem: 'belowMin' };
  if (value > MARKET_MAX_AMOUNT) return { ok: false, problem: 'aboveMax' };
  return { ok: true, value };
}

/**
 * Prix ou valeur déclarée valide (≥ MARKET_MIN_ASK_PRICE, ≤ MARKET_MAX_AMOUNT),
 * ou null — le motif s'obtient par `checkMarketAmount`.
 */
export function parsePositiveAmount(raw: string): number | null {
  const check = checkMarketAmount(raw);
  return check.ok ? check.value : null;
}

/** Message (clé i18n + paramètres) d'un montant refusé — minimum et maximum chiffrés. */
export function amountProblemMessage(
  problem: AmountProblem,
  locale: string,
): { key: string; params?: Record<string, string> } {
  switch (problem) {
    case 'belowMin':
      return { key: 'community.amountBelowMin', params: { min: formatPrice(MARKET_MIN_ASK_PRICE, locale) } };
    case 'aboveMax':
      return { key: 'community.amountAboveMax', params: { max: formatPrice(MARKET_MAX_AMOUNT, locale) } };
    default:
      return { key: 'community.invalidAmount' };
  }
}

/** Valeur pré-remplie dans un champ (entier si possible, virgule décimale). */
export function amountToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
  const rounded = roundCents(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace('.', ',');
}

/**
 * Fenêtre des estimations VELUM retenues pour le seuil de certification, en
 * mois — réplique de market_valuation_window() (relue par les tests).
 */
export const MARKET_VALUATION_WINDOW_MONTHS = 18;

type EstimatePoint = Pick<ValuationRecord, 'central' | 'valuedAt'>;

/** `date` moins `months` mois civils (jour borné à la fin du mois, comme `- interval` en SQL). */
function minusMonths(date: Date, months: number): Date {
  const target = new Date(date.getTime());
  const day = date.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInMonth));
  return target;
}

/** Estimations valides de la fenêtre : montant > 0, datées ni dans le futur ni trop anciennes. */
function estimatesInWindow(history: readonly EstimatePoint[], now: string | Date): { central: number; at: number }[] {
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) return [];
  const floor = minusMonths(nowDate, MARKET_VALUATION_WINDOW_MONTHS).getTime();
  const points: { central: number; at: number }[] = [];
  for (const v of history) {
    const at = Date.parse(v.valuedAt);
    if (!Number.isFinite(v.central) || v.central <= 0 || !Number.isFinite(at)) continue;
    // Date future (invalide) ou hors fenêtre : ignorée, comme _market_reference_value.
    if (at > nowMs || at <= floor) continue;
    points.push({ central: v.central, at });
  }
  return points;
}

/**
 * Estimation de RÉFÉRENCE pour le seuil de certification : la PLUS HAUTE des
 * estimations VELUM des 18 derniers mois (dates futures ignorées) — même
 * règle que _market_reference_value côté serveur : une estimation basse
 * postérieure ne masque pas une estimation haute récente. null si aucune.
 */
export function referenceEstimate(history: readonly EstimatePoint[], now: string | Date): number | null {
  const points = estimatesInWindow(history, now);
  if (points.length === 0) return null;
  // Non arrondie : comparée telle quelle au seuil, comme côté serveur.
  return Math.max(...points.map((p) => p.central));
}

/**
 * Estimation VELUM la plus RÉCENTE de la fenêtre (pré-remplissage et rappel
 * sous le champ), dates futures ignorées ; null si aucune.
 */
export function latestEstimate(history: readonly EstimatePoint[], now: string | Date): number | null {
  const points = estimatesInWindow(history, now);
  let latest: { central: number; at: number } | null = null;
  for (const p of points) if (latest === null || p.at > latest.at) latest = p;
  return latest === null ? null : roundCents(latest.central);
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

/**
 * Commission d'une vente au taux FIGÉ de la commande : exactement l'écriture
 * du registre (ledger_on_order_release : round(greatest(montant, 0) × taux, 2)),
 * roundCents de @velum/config étant aligné sur round(numeric, 2).
 */
export function orderCommission(order: { amount: number; commissionRate: number }): number {
  return roundCents(Math.max(0, order.amount) * order.commissionRate);
}

/** Palier suivant : voir lib/marketCommission (base serveur des aperçus). */
export { nextCommissionTier, type NextCommissionTier };

// ── Mise en vente / à l'échange ──────────────────────────────────────────────

/** 'already' : objet déjà certifié — la certification le suit, l'annonce naît authentifiée. */
export type SellCertification = 'required' | 'voluntary' | 'none' | 'already';

export interface SellPreview {
  /** Prix demandé / valeur déclarée saisi (null si invalide). */
  value: number | null;
  /** Motif du refus de la saisie (null si valide). */
  valueProblem: AmountProblem | null;
  /** Taux appliqué : celui du serveur, ou le taux maximal en repli (`commission.source`). */
  commissionRate: number;
  /** Palier suivant (null si inconnu — taux en repli — ou minimum atteint). */
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
  /**
   * Base de commission (lib/marketCommission) : taux ACTUEL du serveur
   * (figé à la publication), ou le taux maximal si indisponible.
   */
  commission: CommissionBasis;
  estimatedValue: number | null;
  voluntaryCertification: boolean;
  /** Objet déjà certifié par un expert (lib/marketState `itemCertifiedByExpert`). */
  alreadyCertified?: boolean;
}): SellPreview {
  const check = checkMarketAmount(input.priceInput);
  const value = check.ok ? check.value : null;
  const rule = certificationRequirement({
    value: value ?? 0,
    estimatedValue: input.estimatedValue,
  });
  // Certification déjà obtenue : elle suit l'objet, l'annonce n'est pas retenue.
  const requirement: CertificationRequirement =
    input.alreadyCertified === true ? { required: false, reason: null, referenceValue: rule.referenceValue } : rule;
  const certification: SellCertification =
    input.alreadyCertified === true
      ? 'already'
      : requirement.required
        ? 'required'
        : input.voluntaryCertification
          ? 'voluntary'
          : 'none';
  const certificationFee =
    (certification !== 'required' && certification !== 'voluntary') || requirement.referenceValue <= 0
      ? 0
      : estimateCertificationFee(requirement.referenceValue);
  return {
    value,
    valueProblem: check.ok ? null : check.problem,
    commissionRate: input.commission.rate,
    nextTier: nextTierOf(input.commission),
    sale:
      value !== null && isForSale(input.kind)
        ? saleBreakdownAt(value, input.commission, certificationFee)
        : null,
    exchange:
      value !== null && isOpenToExchange(input.kind)
        ? exchangeCommissionAt(value, input.commission)
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
  // Au-delà de numeric(14, 2) : refus local (jamais présenté comme une panne).
  if (amount === null || amount > MARKET_MAX_AMOUNT) return null;
  if (amount === 0) return 0;
  return direction === 'add' ? amount : -amount;
}

export interface ExchangePreview {
  offeredValue: number | null;
  /** Motif du refus de la valeur déclarée saisie (null si valide). */
  offeredValueProblem: AmountProblem | null;
  cashAdjustment: number | null;
  /** Ma commission (sur la valeur de l'objet que je cède), figée à l'acceptation. */
  myCommission: ExchangeCommission | null;
  /** Expertise : obligatoire au-delà du seuil (un des objets), ou convenue. */
  requirement: CertificationRequirement;
  /**
   * Expertise de seuil objet par objet (miroir de _exchange_threshold_targets) :
   * le mien (frais à ma charge) et celui de l'annonce (à la charge de son propriétaire).
   */
  thresholdItems: { mine: boolean; theirs: boolean };
  /**
   * Frais d'expertise INDICATIFS à MA charge : seuil de MON objet, ou total
   * d'un accord mutuel (partagé, voir myCertificationShare) ; 0 sinon.
   */
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
  /** Annonce déjà authentifiée par un expert : pas d'expertise de seuil pour elle. */
  listingCertified?: boolean;
  offeredValueInput: string;
  /** Estimation VELUM de MON objet : on ne contourne pas le seuil en sous-déclarant. */
  offeredEstimate?: number | null;
  /** Mon objet déjà certifié (la certification le suit). */
  offeredCertified?: boolean;
  cashDirection: CashDirection;
  cashInput: string;
  /** Base de commission (lib/marketCommission) : taux serveur, ou le maximum en repli. */
  commission: CommissionBasis;
  mutualCertification?: boolean;
}): ExchangePreview {
  const offeredCheck = checkMarketAmount(input.offeredValueInput);
  const offeredValue = offeredCheck.ok ? offeredCheck.value : null;
  const cashAdjustment = signedCashAdjustment(input.cashDirection, input.cashInput);
  // Objet par objet, comme le serveur : mon objet = max(valeur déclarée,
  // estimation) ; l'objet de l'annonce = sa valeur déclarée ; un objet déjà
  // certifié ne repasse pas en expertise.
  const mineRule = certificationRequirement({ value: offeredValue ?? 0, estimatedValue: input.offeredEstimate ?? null });
  const theirsRule = certificationRequirement({ value: input.listingValue });
  const mine = mineRule.required && input.offeredCertified !== true;
  const theirs = theirsRule.required && input.listingCertified !== true;
  const mutual = input.mutualCertification === true;
  const requirement: CertificationRequirement =
    mine || theirs
      ? {
          required: true,
          reason: 'threshold',
          referenceValue: Math.max(mine ? mineRule.referenceValue : 0, theirs ? theirsRule.referenceValue : 0),
        }
      : {
          required: mutual,
          reason: mutual ? 'mutual_agreement' : null,
          referenceValue: Math.max(mineRule.referenceValue, theirsRule.referenceValue),
        };
  const certificationFee = mine
    ? estimateCertificationFee(mineRule.referenceValue)
    : requirement.reason === 'mutual_agreement'
      ? estimateCertificationFee(requirement.referenceValue)
      : 0;
  const myCertificationShare =
    requirement.reason === 'mutual_agreement'
      ? splitCertificationFee(certificationFee, 'split').buyer
      : 0;
  return {
    offeredValue,
    offeredValueProblem: offeredCheck.ok ? null : offeredCheck.problem,
    cashAdjustment,
    myCommission: offeredValue !== null ? exchangeCommissionAt(offeredValue, input.commission) : null,
    requirement,
    thresholdItems: { mine, theirs },
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

// ── Expédition ───────────────────────────────────────────────────────────────

/**
 * Transporteurs proposés à l'expédition : la liste FERMÉE de @velum/api-client,
 * réplique testée de market_carriers() (SQL) — une seule liste pour l'UI, le
 * dépôt et le serveur ; pas de texte libre, donc aucun canal de coordonnées.
 */
export { MARKET_CARRIERS, type MarketCarrier };

/**
 * Numéro de suivi saisi → forme normalisée (blancs retirés, majuscules), ou
 * null s'il ne ressemble pas à un numéro de suivi. Règle du dépôt et du
 * serveur (normalizeTrackingNumber de @velum/api-client : lettres, chiffres
 * et tirets, 4 à 40 caractères, ^[A-Z0-9][A-Z0-9-]{3,39}$), plus STRICTE
 * ici : au moins un chiffre — sous-ensemble du format serveur, jamais plus
 * permissive. Une phrase, un e-mail ou un lien ne passent pas.
 */
export function normalizeTrackingNumber(raw: string): string | null {
  let value: string;
  try {
    value = normalizeServerTracking(raw);
  } catch {
    return null;
  }
  return /[0-9]/.test(value) ? value : null;
}

/**
 * Données envoyées au serveur pour déclarer une expédition : le suivi et le
 * transporteur choisi, RIEN d'autre. Jamais de date de livraison : le serveur
 * (guard_order_terms) la refuse au vendeur — seule la livraison attestée par
 * l'acheteur ou le transporteur compte. null si le suivi est invalide.
 */
export function shipmentInput(
  trackingInput: string,
  carrier: MarketCarrier | null,
): { trackingNumber: string; carrier?: MarketCarrier } | null {
  const trackingNumber = normalizeTrackingNumber(trackingInput);
  if (trackingNumber === null) return null;
  return carrier !== null ? { trackingNumber, carrier } : { trackingNumber };
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
