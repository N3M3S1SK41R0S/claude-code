/**
 * Vigie anti-faux — drapeau de risque HONNÊTE, jamais un verdict (Pari #4).
 *
 * Lancement sur le seul signal physiquement DÉTERMINISTE — cohérence
 * poids / diamètre / tranche / magnétisme vs référence catalogue — où le
 * faux-positif est quasi nul. Les signaux visuels mous (patine, brillance)
 * ne sont exposés qu'en « indice faible » explicitement étiqueté.
 *
 * Respect strict du principe #1 : on SIGNALE, on ne tranche pas. Toute
 * confirmation passe par une expertise physique (routage > seuil de valeur).
 * Le registre communautaire de faux (embeddings Qdrant) se branche via
 * `knownFakeMatch` — le cœur déterministe ci-dessous est pur et testable.
 */
import { EXPERT_APPRAISAL_THRESHOLD_EUR } from '@velum/config';

/** Tolérance ± autour d'une valeur physique attendue. */
export interface Tolerance {
  expected: number;
  tolerance: number;
}

/** Référence physique d'une pièce authentique (catalogue Numista, etc.). */
export interface PhysicalReference {
  weightGrams?: Tolerance;
  diameterMm?: Tolerance;
  /** Une pièce authentique en argent/or/cupronickel est NON magnétique. */
  magnetic?: boolean;
  /** Type de tranche attendu ('lisse', 'cannelée', 'inscrite'…). */
  edge?: string;
}

export interface PhysicalMeasurement {
  weightGrams?: number;
  diameterMm?: number;
  magnetic?: boolean;
  edge?: string;
}

export type RiskLevel = 'none' | 'low' | 'elevated' | 'high';
export type SignalConfidence = 'deterministic' | 'soft';

export interface AuthenticitySignal {
  attribute: string;
  ok: boolean;
  confidence: SignalConfidence;
  detail: string;
}

export interface KnownFakeMatch {
  /** Similarité 0..1 à un faux confirmé du registre. */
  score: number;
  note: string;
}

export interface AuthenticityFlag {
  risk: RiskLevel;
  signals: AuthenticitySignal[];
  /** Au moins un signal déterministe incohérent (haute confiance). */
  hardMismatch: boolean;
  /** Toujours présent — jamais un verdict d'authenticité. */
  disclaimer: string;
  expertiseRecommended: boolean;
  /** Rempli si le registre communautaire matche un faux connu (Qdrant). */
  knownFakeMatch?: KnownFakeMatch;
}

const DISCLAIMER =
  'Signal indicatif de cohérence physique — JAMAIS un verdict d’authenticité. ' +
  'Toute confirmation exige une expertise physique par un professionnel.';

/** Seuil de similarité au registre au-delà duquel on remonte le risque. */
export const KNOWN_FAKE_MATCH_THRESHOLD = 0.85;

function checkTolerance(
  attribute: string,
  measured: number | undefined,
  ref: Tolerance | undefined,
  unit: string,
): AuthenticitySignal | null {
  if (measured === undefined || ref === undefined) return null;
  const deviation = Math.abs(measured - ref.expected);
  const ok = deviation <= ref.tolerance;
  return {
    attribute,
    ok,
    confidence: 'deterministic',
    detail: ok
      ? `${attribute} cohérent (${measured}${unit} vs ${ref.expected}±${ref.tolerance}${unit}).`
      : `${attribute} hors tolérance (${measured}${unit} vs ${ref.expected}±${ref.tolerance}${unit}) — écart de ${deviation.toFixed(2)}${unit}.`,
  };
}

export interface AuthenticityOptions {
  /** Valeur estimée en EUR — au-delà du seuil, expertise recommandée. */
  valueEUR?: number;
  /** Résultat du registre communautaire (Qdrant), injecté. */
  knownFakeMatch?: KnownFakeMatch;
}

/**
 * Évalue la cohérence physique d'un objet vs sa référence catalogue et
 * produit un drapeau de risque gradué. Ne renvoie jamais de verdict.
 */
export function assessAuthenticity(
  measured: PhysicalMeasurement,
  reference: PhysicalReference,
  options: AuthenticityOptions = {},
): AuthenticityFlag {
  const signals: AuthenticitySignal[] = [];

  const weight = checkTolerance('Poids', measured.weightGrams, reference.weightGrams, ' g');
  if (weight) signals.push(weight);
  const diameter = checkTolerance('Diamètre', measured.diameterMm, reference.diameterMm, ' mm');
  if (diameter) signals.push(diameter);

  // Magnétisme : signal déterministe FORT (un faux en acier est magnétique).
  if (reference.magnetic !== undefined && measured.magnetic !== undefined) {
    const ok = reference.magnetic === measured.magnetic;
    signals.push({
      attribute: 'Magnétisme',
      ok,
      confidence: 'deterministic',
      detail: ok
        ? 'Comportement magnétique conforme au métal attendu.'
        : reference.magnetic === false && measured.magnetic === true
          ? 'La pièce est magnétique alors que le métal authentique ne l’est pas — signal fort de contrefaçon (âme en acier).'
          : 'Comportement magnétique incohérent avec le métal attendu.',
    });
  }

  // Tranche : structurelle, déterministe.
  if (reference.edge !== undefined && measured.edge !== undefined) {
    const ok = reference.edge.trim().toLowerCase() === measured.edge.trim().toLowerCase();
    signals.push({
      attribute: 'Tranche',
      ok,
      confidence: 'deterministic',
      detail: ok
        ? `Tranche conforme (${reference.edge}).`
        : `Tranche incohérente (observée « ${measured.edge} » vs attendue « ${reference.edge} »).`,
    });
  }

  const deterministicMismatches = signals.filter((s) => s.confidence === 'deterministic' && !s.ok).length;
  const hardMismatch = deterministicMismatches > 0;

  // Registre communautaire (Qdrant) : un faux connu resurgissant.
  const knownFakeMatch =
    options.knownFakeMatch && options.knownFakeMatch.score >= KNOWN_FAKE_MATCH_THRESHOLD
      ? options.knownFakeMatch
      : undefined;

  let risk: RiskLevel;
  if (knownFakeMatch || deterministicMismatches >= 2) risk = 'high';
  else if (deterministicMismatches === 1) risk = 'elevated';
  else risk = 'none';

  const overThreshold =
    options.valueEUR !== undefined && options.valueEUR > EXPERT_APPRAISAL_THRESHOLD_EUR;
  const expertiseRecommended = risk === 'high' || risk === 'elevated' || overThreshold;

  return {
    risk,
    signals,
    hardMismatch,
    disclaimer: DISCLAIMER,
    expertiseRecommended,
    ...(knownFakeMatch ? { knownFakeMatch } : {}),
  };
}
