/**
 * Détection de variétés numismatiques — Pari #6.
 *
 * Les variétés (doubled die, repunched mint mark, surfrappe de date, erreurs
 * de frappe) peuvent multiplier le prix par 10 et sont ÉCRASÉES par tous les
 * scanners généralistes. On confronte les indices détectés par la vision aux
 * variétés connues et cotées d'un type de pièce, et on renvoie un multiplicateur
 * indicatif — jamais une certitude (attribution à confirmer par un expert).
 *
 * Pur et testable, sans réseau.
 */
export type VarietyKind =
  | 'doubled_die'
  | 'repunched_mint_mark'
  | 'over_date'
  | 'mint_error'
  | 'die_crack'
  | 'mule';

/** Une variété connue et cotée pour un type de pièce (catalogue Numista…). */
export interface KnownVariety {
  id: string;
  kind: VarietyKind;
  label: string;
  /** Fourchette de multiplicateur de valeur vs pièce de base. */
  valueMultiplier: [number, number];
  /** Indices visuels distinctifs (langage naturel, pour matcher la vision). */
  cues: string[];
}

export interface VarietyMatch {
  variety: KnownVariety;
  /** Fraction des indices de la variété retrouvés dans la détection (0..1). */
  confidence: number;
  matchedCues: string[];
}

export interface VarietyAssessment {
  matches: VarietyMatch[];
  /** Meilleur multiplicateur applicable (variété la mieux appariée). */
  topMultiplier?: [number, number];
  notes: string[];
  caveat: string;
}

/** Synonymes → type de variété canonique. */
const KIND_SYNONYMS: { kind: VarietyKind; keywords: string[] }[] = [
  { kind: 'doubled_die', keywords: ['doubled die', 'double die', 'ddo', 'ddr', 'doublage', 'doublure'] },
  { kind: 'repunched_mint_mark', keywords: ['repunched mint mark', 'rpm', 'lettre d’atelier redoublée', 'marque d’atelier redoublée'] },
  { kind: 'over_date', keywords: ['overdate', 'over date', 'surfrappe', 'surdate', 'date refrappée'] },
  { kind: 'mint_error', keywords: ['error', 'erreur', 'flan', 'planchet', 'off-center', 'décentré', 'clip'] },
  { kind: 'die_crack', keywords: ['die crack', 'cassure de coin', 'fêlure de coin', 'cud'] },
  { kind: 'mule', keywords: ['mule', 'mulet'] },
];

const CAVEAT =
  'Attribution de variété INDICATIVE — à confirmer par un spécialiste (les variétés majeures ' +
  'exigent un examen sous loupe). Une fourchette de multiplicateur n’est pas une cote ferme.';

/** Classe un indice libre en type de variété canonique (ou null). */
export function classifyVarietyHint(hint: string): VarietyKind | null {
  const h = hint.toLowerCase();
  for (const { kind, keywords } of KIND_SYNONYMS) {
    if (keywords.some((k) => h.includes(k))) return kind;
  }
  return null;
}

export interface VarietyDetectionInput {
  /** Indices détectés par la vision (texte libre). */
  hints: string[];
  /** Variétés connues et cotées pour ce type de pièce. */
  known: KnownVariety[];
  /** Seuil de confiance minimal pour retenir un match (défaut 0.5). */
  minConfidence?: number;
}

function cueMatches(cue: string, hints: string[]): boolean {
  const c = cue.toLowerCase();
  return hints.some((h) => {
    const hl = h.toLowerCase();
    return hl.includes(c) || c.includes(hl);
  });
}

/**
 * Confronte les indices détectés aux variétés connues et retourne les
 * appariements plausibles, triés par (confiance × valeur), avec le meilleur
 * multiplicateur applicable.
 */
export function assessVarieties(input: VarietyDetectionInput): VarietyAssessment {
  const minConfidence = input.minConfidence ?? 0.5;
  const hintKinds = new Set(input.hints.map(classifyVarietyHint).filter((k): k is VarietyKind => k !== null));

  const matches: VarietyMatch[] = [];
  for (const variety of input.known) {
    const matchedCues = variety.cues.filter((cue) => cueMatches(cue, input.hints));
    let confidence = variety.cues.length > 0 ? matchedCues.length / variety.cues.length : 0;
    // Bonus si le TYPE de variété est explicitement reconnu dans les indices.
    if (hintKinds.has(variety.kind)) confidence = Math.min(1, confidence + 0.25);
    confidence = Number(confidence.toFixed(3));
    if (confidence >= minConfidence) matches.push({ variety, confidence, matchedCues });
  }

  // Tri par espérance de valeur = confiance × borne haute du multiplicateur.
  matches.sort(
    (a, b) => b.confidence * b.variety.valueMultiplier[1] - a.confidence * a.variety.valueMultiplier[1],
  );

  const best = matches[0];
  const notes: string[] = [];
  if (best) {
    notes.push(
      `Variété la plus probable : ${best.variety.label} (confiance ${Math.round(best.confidence * 100)} %, ` +
        `×${best.variety.valueMultiplier[0]}–${best.variety.valueMultiplier[1]} vs pièce de base).`,
    );
  } else {
    notes.push('Aucune variété cotée reconnue avec une confiance suffisante — pièce traitée comme courante.');
  }

  return {
    matches,
    ...(best ? { topMultiplier: best.variety.valueMultiplier } : {}),
    notes,
    caveat: CAVEAT,
  };
}
