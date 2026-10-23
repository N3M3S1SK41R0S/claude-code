/**
 * État de la FICHE COMPLÈTE d'un objet (analyse experte, lente : plusieurs
 * secondes de génération). Le scan éclair enregistre l'objet SANS elle
 * (`analysisStatus: 'pending'`) ; la fiche objet propose alors de la charger
 * à la demande. Source unique de ces conventions pour la capture et la fiche.
 *
 * Conventions dans `items.attributes` :
 *  - `analysis`        : payload du moteur (présent ⇔ fiche complète chargée) ;
 *  - `analysisEngine`  : moteur ayant produit la fiche ;
 *  - `analysisStatus`  : 'pending' (à charger) | 'failed' (échec, réessayable) ;
 *  - `analyzedAt`      : horodatage ISO de la génération de la fiche ;
 *  - `corrections`     : historique des corrections d'identification ;
 *  - `quickEstimate` / `classification` : fourchette indicative et classement
 *    du scan éclair (avis du modèle, jamais transmis comme identité).
 */
import type { Candidate, VelumDomain, VelumItem } from '@velum/core';

import { identityAttributeKeys } from './identityFields';

export type AnalysisStatus = 'complete' | 'pending' | 'failed';

/**
 * Clés techniques de `attributes` qui ne décrivent pas l'identité de l'objet
 * (exclues des tableaux d'export). Pour COPIER une identité, utiliser
 * `identityAttributes` (liste d'inclusion), jamais cette liste.
 */
export const NON_IDENTITY_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'analysis',
  'analysisEngine',
  'analysisStatus',
  'analyzedAt',
  'disclaimers',
  'corrections',
  'quickEstimate',
  'classification',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** true si la fiche complète (analyse experte) est présente. */
export function hasFullAnalysis(item: Pick<VelumItem, 'attributes'>): boolean {
  return isRecord(item.attributes['analysis']);
}

/** État de la fiche complète. Sans marqueur ni analyse : 'pending'. */
export function analysisStatusOf(item: Pick<VelumItem, 'attributes'>): AnalysisStatus {
  if (hasFullAnalysis(item)) return 'complete';
  return item.attributes['analysisStatus'] === 'failed' ? 'failed' : 'pending';
}

const ALL_DOMAINS: readonly VelumDomain[] = ['wine', 'coin', 'art', 'stamp', 'watch'];

/** Clés d'identité d'un domaine, ou de tous les domaines si aucun n'est donné. */
function identityKeys(domain: VelumDomain | undefined): ReadonlySet<string> {
  const domains = domain === undefined ? ALL_DOMAINS : [domain];
  return new Set(domains.flatMap((d) => identityAttributeKeys(d)));
}

/**
 * Attributs d'IDENTITÉ seuls — liste d'INCLUSION fondée sur les champs
 * d'identité connus du domaine (identityAttributeKeys : champs éditables +
 * attributs structurés de @velum/core). Jamais la quantité, la « bouteille
 * bue », le prix payé ou l'emplacement d'un import CSV, ni la fiche, les
 * avertissements, l'historique ou l'avis du scan éclair. Valeurs nulles
 * omises. Sans domaine : clés d'identité de tous les domaines.
 */
export function identityAttributes(
  attributes: Record<string, unknown>,
  domain?: VelumDomain,
): Record<string, unknown> {
  const keys = identityKeys(domain);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (keys.has(key) && value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * État de l'EXEMPLAIRE possédé lu par les sources de prix (grade d'une pièce,
 * statut philatélique, état) : pas une identité, mais il pèse sur la cote de
 * l'objet estimé — transmis à analyze / valuate, jamais copié vers une envie.
 */
const EXEMPLAR_STATE_KEYS: readonly string[] = ['grade', 'status', 'condition', 'etat'];

/** Reconstruit le candidat d'un objet (pour analyze / valuate à la demande). */
export function itemToCandidate(item: VelumItem): Candidate {
  const attributes = identityAttributes(item.attributes, item.domain);
  for (const key of EXEMPLAR_STATE_KEYS) {
    const value = item.attributes[key];
    if (value !== null && value !== undefined) attributes[key] = value;
  }
  return {
    id: item.id,
    domain: item.domain,
    label: item.title ?? '',
    confidence: item.confidence ?? 0.5,
    attributes,
  };
}

/**
 * true si l'identité a été corrigée APRÈS la génération de la fiche : la fiche
 * décrit peut-être un autre objet → proposer de la régénérer.
 */
export function isAnalysisOutdated(item: Pick<VelumItem, 'attributes'>): boolean {
  if (!hasFullAnalysis(item)) return false;
  const analyzedAt = item.attributes['analyzedAt'];
  const corrections = item.attributes['corrections'];
  if (!Array.isArray(corrections) || corrections.length === 0) return false;
  const last = corrections.at(-1);
  const correctedAt = isRecord(last) && typeof last['at'] === 'string' ? last['at'] : null;
  if (correctedAt === null) return false;
  // Fiche antérieure à la convention `analyzedAt` : toute correction la périme.
  if (typeof analyzedAt !== 'string') return true;
  return correctedAt > analyzedAt;
}
