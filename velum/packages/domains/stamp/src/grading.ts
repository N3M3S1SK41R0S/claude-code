/**
 * Grading philatélique fin — Pari #6.
 *
 * Ce qui FAIT le prix d'un timbre et qu'aucun scanner concurrent n'évalue :
 * l'état (gomme, charnière), le centrage, la dentelure et les défauts. On
 * traduit une `StampCondition` (sortie de `phila_v1`) en MULTIPLICATEUR de
 * valeur relatif à la cote de référence (neuf sans charnière, centrage
 * parfait = 1.0), avec explication et réserve.
 *
 * Pur et testable. Jamais une expertise ferme (Calves, Brun…) : indicatif.
 */
import type { StampCondition } from '@velum/core';

export interface StampGradeFactors {
  status: number;
  gum: number;
  centering: number;
  faults: number;
}

export interface StampGrade {
  /** Multiplicateur de valeur vs cote de référence (neuf** centrage parfait). */
  valueMultiplier: number;
  factors: StampGradeFactors;
  /** Cote estimée = cote catalogue × multiplicateur (si `catalogQuote` fourni). */
  estimatedValue?: number;
  confidence: number;
  /** Explications FR prêtes à afficher. */
  notes: string[];
  caveat: string;
  /** Signale un risque de regommage (gomme « refaite » vendue comme d'origine). */
  regummingRisk: boolean;
}

const STATUS_FACTOR: Record<StampCondition['status'], number> = {
  neuf_sans_charniere: 1.0,
  neuf_avec_charniere: 0.5, // la charnière ampute fortement la cote moderne
  oblitere: 0.35,
  sur_lettre: 0.5,
  inconnu: 0.5,
};

const GUM_FACTOR: Record<NonNullable<StampCondition['gum']>, number> = {
  intacte: 1.0,
  alteree: 0.7,
  sans_gomme: 0.45,
  inconnue: 0.85,
};

const CENTERING_FACTOR = {
  parfait: 1.15, // « superbe centrage » : prime
  bon: 1.0,
  decale: 0.8,
  tres_decale: 0.6,
} as const;

/** Mots-clés de défauts graves → forte décote. */
const SEVERE_FAULTS = ['aminci', 'amincis', 'pli', 'plis', 'dechirure', 'déchirure', 'trou', 'reparation', 'réparation', 'faux'];
/** Défauts mineurs → décote modérée. */
const MINOR_FAULTS = ['rousseur', 'rousseurs', 'dent courte', 'dents courtes', 'court', 'jauni', 'jaunissement', 'trace', 'clair'];

const CAVEAT =
  'Estimation visuelle de l’état — jamais une expertise philatélique ferme (Calves, Brun, Roumet…). ' +
  'La gomme, le centrage et les défauts doivent être confirmés par un expert pour toute valeur significative.';

function faultFactor(faults: string[]): { factor: number; severe: number; minor: number } {
  let factor = 1;
  let severe = 0;
  let minor = 0;
  for (const raw of faults) {
    const f = raw.toLowerCase();
    if (SEVERE_FAULTS.some((k) => f.includes(k))) {
      factor *= 0.4;
      severe++;
    } else if (MINOR_FAULTS.some((k) => f.includes(k))) {
      factor *= 0.75;
      minor++;
    } else {
      factor *= 0.85; // défaut non classé : décote prudente
      minor++;
    }
  }
  return { factor, severe, minor };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Traduit un état philatélique en multiplicateur de valeur + explication. */
export function gradeStamp(
  condition: StampCondition,
  options: { catalogQuote?: number } = {},
): StampGrade {
  const isNeuf =
    condition.status === 'neuf_sans_charniere' || condition.status === 'neuf_avec_charniere';

  const statusF = STATUS_FACTOR[condition.status];
  // La gomme ne compte que pour les neufs (un oblitéré n'a pas de gomme cotée).
  const gumF = isNeuf && condition.gum ? GUM_FACTOR[condition.gum] : 1;
  const centeringF = condition.centering ? CENTERING_FACTOR[condition.centering] : 1;
  const { factor: faultsF, severe, minor } = faultFactor(condition.faults ?? []);

  const valueMultiplier = Number(clamp(statusF * gumF * centeringF * faultsF, 0.05, 1.5).toFixed(3));

  const notes: string[] = [];
  notes.push(`État « ${condition.status} » → facteur ${statusF}.`);
  if (isNeuf && condition.gum) notes.push(`Gomme « ${condition.gum} » → facteur ${gumF}.`);
  if (condition.centering) notes.push(`Centrage « ${condition.centering} » → facteur ${centeringF}.`);
  if (severe > 0) notes.push(`${severe} défaut(s) grave(s) — forte décote.`);
  if (minor > 0) notes.push(`${minor} défaut(s) mineur(s).`);

  // Regommage : « neuf sans charnière » revendiqué mais gomme absente/altérée.
  const regummingRisk =
    condition.status === 'neuf_sans_charniere' &&
    (condition.gum === 'sans_gomme' || condition.gum === 'alteree');
  if (regummingRisk) {
    notes.push('Indice faible : gomme absente/altérée sur un « neuf sans charnière » — risque de regommage à faire vérifier.');
  }

  // Confiance : part de la confiance vision, réduite par le nb de défauts et l'inconnu.
  let confidence = condition.confidence;
  if (condition.status === 'inconnu') confidence *= 0.6;
  confidence *= Math.pow(0.92, severe + minor);
  confidence = Number(clamp(confidence, 0, 1).toFixed(3));

  return {
    valueMultiplier,
    factors: { status: statusF, gum: gumF, centering: centeringF, faults: Number(faultsF.toFixed(3)) },
    ...(options.catalogQuote !== undefined
      ? { estimatedValue: Math.round(options.catalogQuote * valueMultiplier) }
      : {}),
    confidence,
    notes,
    caveat: CAVEAT,
    regummingRisk,
  };
}
