/**
 * Règles PURES des plateformes d'échange et de vente (Platine) — source
 * applicative unique, répliquée côté SQL (triggers / fonctions) : toute
 * évolution ici impose la même évolution dans la migration correspondante,
 * avec des vecteurs de test partagés.
 *
 * Décisions produit (octobre 2026) :
 *  - VENTE : le vendeur paie son taux dégressif (5 % → 2 %) sur le prix,
 *    prélevé à la libération du séquestre ; l'acheteur paie le prix affiché.
 *  - ÉCHANGE : chaque partie paie SON taux dégressif sur la valeur déclarée
 *    de l'objet qu'elle CÈDE (symétrique d'une vente) ; la soulte n'est pas
 *    commissionnée (ce n'est pas une vente de bien).
 *  - CERTIFICATION : obligatoire quand la valeur de référence (max de la
 *    valeur déclarée et de l'estimation VELUM — on ne contourne pas le seuil
 *    en sous-déclarant) DÉPASSE le seuil ; sous le seuil, possible sur accord
 *    des deux parties. Frais : vendeur (seuil), partagés (accord mutuel).
 *  - ANONYMAT : toute coordonnée saisie dans un texte libre est masquée.
 */
import { EXPERT_APPRAISAL_THRESHOLD_EUR, commissionRateFor } from './index';

/**
 * Miroirs structurels de `CertificationReason` / `CertificationFeePayer`
 * (@velum/core market.ts) — @velum/config ne dépend d'aucun paquet.
 */
export type CertificationReasonId = 'threshold' | 'mutual_agreement' | 'voluntary';
export type CertificationFeePayerId = 'seller' | 'buyer' | 'split';

/** Arrondi monétaire au centime (évite les 12.000000001 €). */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Décomposition d'une vente, affichée au vendeur AVANT publication. */
export interface SaleBreakdown {
  /** Prix payé par l'acheteur (EUR). */
  price: number;
  /** Taux dégressif du vendeur, figé à la création de l'annonce. */
  commissionRate: number;
  commission: number;
  /** Frais d'expertise à la charge du vendeur (0 si non requise). */
  certificationFee: number;
  /** Montant net versé au vendeur à la libération. */
  sellerNet: number;
}

export function saleBreakdown(
  price: number,
  completedSales: number,
  certificationFee = 0,
): SaleBreakdown {
  const commissionRate = commissionRateFor(completedSales);
  const commission = roundCents(Math.max(0, price) * commissionRate);
  const fee = roundCents(Math.max(0, certificationFee));
  return {
    price: roundCents(price),
    commissionRate,
    commission,
    certificationFee: fee,
    sellerNet: roundCents(Math.max(0, price - commission - fee)),
  };
}

/** Commission d'UNE partie d'un échange (base : valeur de l'objet cédé). */
export interface ExchangeCommission {
  commissionRate: number;
  commission: number;
}

export function exchangeCommission(
  declaredValueCeded: number,
  completedSales: number,
): ExchangeCommission {
  const commissionRate = commissionRateFor(completedSales);
  return {
    commissionRate,
    commission: roundCents(Math.max(0, declaredValueCeded) * commissionRate),
  };
}

/** Décision de certification pour un objet mis en transaction. */
export interface CertificationRequirement {
  required: boolean;
  /** 'threshold' si imposée par le seuil, 'mutual_agreement' si convenue, sinon null. */
  reason: Exclude<CertificationReasonId, 'voluntary'> | null;
  /** Valeur retenue pour la comparaison au seuil (EUR). */
  referenceValue: number;
}

export function certificationRequirement(input: {
  /** Prix demandé ou valeur déclarée (EUR). */
  value: number;
  /** Estimation centrale VELUM (EUR), si connue. */
  estimatedValue?: number | null;
  /** Les deux parties ont demandé une expertise. */
  mutualAgreement?: boolean;
}): CertificationRequirement {
  const estimate =
    typeof input.estimatedValue === 'number' && Number.isFinite(input.estimatedValue)
      ? input.estimatedValue
      : 0;
  const referenceValue = Math.max(Number.isFinite(input.value) ? input.value : 0, estimate);
  if (referenceValue > EXPERT_APPRAISAL_THRESHOLD_EUR) {
    return { required: true, reason: 'threshold', referenceValue };
  }
  if (input.mutualAgreement === true) {
    return { required: true, reason: 'mutual_agreement', referenceValue };
  }
  return { required: false, reason: null, referenceValue };
}

/** Payeur par défaut des frais d'expertise selon le motif. */
export function defaultCertificationFeePayer(reason: CertificationReasonId): CertificationFeePayerId {
  return reason === 'mutual_agreement' ? 'split' : 'seller';
}

/**
 * Barème INDICATIF des frais d'expertise (le tarif définitif est fixé par
 * l'expert partenaire à l'assignation) : pourcentage borné.
 */
export const CERTIFICATION_FEE_SCHEDULE = { rate: 0.02, minEur: 30, maxEur: 400 } as const;

export function estimateCertificationFee(value: number): number {
  const { rate, minEur, maxEur } = CERTIFICATION_FEE_SCHEDULE;
  return roundCents(Math.min(maxEur, Math.max(minEur, Math.max(0, value) * rate)));
}

/** Répartition des frais d'expertise entre vendeur et acheteur. */
export function splitCertificationFee(
  fee: number,
  payer: CertificationFeePayerId,
): { seller: number; buyer: number } {
  if (payer === 'seller') return { seller: roundCents(fee), buyer: 0 };
  if (payer === 'buyer') return { seller: 0, buyer: roundCents(fee) };
  const half = roundCents(fee / 2);
  return { seller: half, buyer: roundCents(fee - half) };
}

/** Jeton de remplacement des coordonnées masquées. */
export const REDACTION_TOKEN = '[coordonnées masquées]';

/**
 * Motifs de coordonnées interdites dans les textes libres (anonymat
 * pair-à-pair, contournement de la commission). Ordre significatif : les
 * URL et e-mails avant les numéros (un e-mail peut contenir des chiffres).
 */
const CONTACT_PATTERNS: readonly RegExp[] = [
  // URL explicites et domaines nus (www.x.fr, x.com/…)
  /\bhttps?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b[\w-]+\.(?:com|fr|net|org|eu|be|ch|io|me|info|biz|co)\b(?:\/\S*)?/gi,
  // E-mails, y compris « arobase » / « (at) » écrits en toutes lettres
  /[\w.+-]+\s*(?:@|\(at\)|\[at\]|\barobase\b)\s*[\w-]+\s*(?:\.|\(dot\)|\bpoint\b)\s*[a-z]{2,}/gi,
  // IBAN (FR76 3000 6000 0112 3456 7890 189…)
  /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g,
  // Téléphones : 8 chiffres ou plus, séparés ou non (+33 6 12 34 56 78, 06.12.34.56.78)
  /(?:\+|00)?\d(?:[\s.-]?\(?\d\)?){7,}/g,
  // Pseudonymes de réseaux sociaux (@pseudo) — après les e-mails
  /(?<![\w.])@[a-z0-9_.]{3,}/gi,
  // Adresses postales : numéro + type de voie + nom
  /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.?|boulevard|bd|chemin|allée|allee|impasse|place|quai|route|cours)\s+[\p{L}' -]{2,40}/giu,
];

/**
 * Masque les coordonnées d'un texte libre. Pur et idempotent : le jeton de
 * remplacement ne correspond à aucun motif.
 */
export function redactContactInfo(text: string): { text: string; redacted: boolean } {
  let out = text;
  for (const pattern of CONTACT_PATTERNS) {
    out = out.replace(pattern, REDACTION_TOKEN);
  }
  return { text: out, redacted: out !== text };
}
