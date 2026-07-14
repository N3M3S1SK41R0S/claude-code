/**
 * Rapport assurance / succession daté avec IC — Quick Win #4.
 *
 * Réutilise la sortie du moteur §7 (valeur centrale + IC rejouable) pour
 * produire un rapport patrimonial daté : total, IC agrégé (borne comonotone
 * honnête), ventilation par domaine, plus-value latente vs prix d'acquisition.
 * Germe de l'usage assurance/succession — argument de vente Gold/Platine.
 *
 * Pur : `generatedAt` est fourni (jamais Date.now()). Disclaimers obligatoires
 * (estimation indicative, jamais une expertise légale — principe #2).
 */
import type { VelumDomain } from '@velum/core';

export interface ReportItem {
  itemId: string;
  title: string;
  domain: VelumDomain;
  /** Valeur centrale §7 (EUR). */
  central: number;
  /** IC 80 % §7 (EUR). */
  ci80: [number, number];
  reliability: number;
  /** Prix d'acquisition (EUR), pour la plus-value latente. */
  acquiredPrice?: number;
  /** Empreinte du passeport de provenance, si présente. */
  provenanceHead?: string;
}

export interface ReportDomainLine {
  total: number;
  nItems: number;
}

export interface InsuranceReport {
  generatedAt: string;
  currency: 'EUR';
  totalCentral: number;
  /** IC 80 % agrégé (somme comonotone — borne large, honnête). */
  totalCi80: [number, number];
  nItems: number;
  byDomain: Partial<Record<VelumDomain, ReportDomainLine>>;
  items: ReportItem[];
  /** Fiabilité minimale du lot (le rapport n'est jamais plus sûr que ça). */
  minReliability: number;
  /** Somme des prix d'acquisition connus. */
  totalAcquired?: number;
  /** Plus-value latente (central − acquisition) sur les objets tracés. */
  totalUnrealizedGain?: number;
  disclaimers: string[];
}

export const REPORT_DISCLAIMERS: readonly string[] = [
  'Estimation indicative fondée sur des observations de marché — ce document n’est PAS une expertise légale ni un certificat d’assurance.',
  'Les valeurs sont assorties d’un intervalle de confiance à 80 % ; la valeur de réalisation effective peut différer.',
  'Pour toute couverture d’assurance ou déclaration de succession, faites établir une expertise professionnelle des pièces significatives.',
];

/**
 * Construit un rapport patrimonial daté à partir des valorisations §7.
 * @param generatedAt horodatage ISO fourni par l'appelant.
 */
export function buildInsuranceReport(items: ReportItem[], generatedAt: string): InsuranceReport {
  const byDomain: Partial<Record<VelumDomain, ReportDomainLine>> = {};
  let totalCentral = 0;
  let ci80Low = 0;
  let ci80High = 0;
  let minReliability = items.length > 0 ? 100 : 0;
  let totalAcquired = 0;
  let hasAcquired = false;
  let gain = 0;

  for (const it of items) {
    totalCentral += it.central;
    ci80Low += it.ci80[0];
    ci80High += it.ci80[1];
    minReliability = Math.min(minReliability, it.reliability);
    const line = byDomain[it.domain] ?? { total: 0, nItems: 0 };
    line.total += it.central;
    line.nItems += 1;
    byDomain[it.domain] = line;
    if (it.acquiredPrice !== undefined) {
      hasAcquired = true;
      totalAcquired += it.acquiredPrice;
      gain += it.central - it.acquiredPrice;
    }
  }

  return {
    generatedAt,
    currency: 'EUR',
    totalCentral: Math.round(totalCentral),
    totalCi80: [Math.round(ci80Low), Math.round(ci80High)],
    nItems: items.length,
    byDomain,
    items,
    minReliability,
    ...(hasAcquired ? { totalAcquired: Math.round(totalAcquired), totalUnrealizedGain: Math.round(gain) } : {}),
    disclaimers: [...REPORT_DISCLAIMERS],
  };
}
