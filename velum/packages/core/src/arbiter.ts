/** Verdict indicatif de l’arbitre patrimonial. */
export type ArbiterVerdict = 'drink' | 'hold' | 'sell' | 'watch';

/** Lecture prudente de la trajectoire de valeur. */
export type ValueTrend = 'rising' | 'falling' | 'flat' | 'unknown';

/**
 * Signal retourné par l’Edge Function `arbiter`.
 *
 * Ce contrat ne constitue jamais un ordre de vente ni un conseil en
 * investissement. Les raisons doivent rester affichées avec les disclaimers
 * généraux de la fiche objet.
 */
export interface ArbiterSignal {
  verdict: ArbiterVerdict;
  /** Confiance du signal, bornée entre 0 et 1. */
  confidence: number;
  trend: ValueTrend;
  /**
   * true uniquement lorsque la fenêtre d’usage se referme bientôt ET que la
   * trajectoire est statistiquement séparée de plat.
   */
  sellWindow: boolean;
  /** Justifications françaises prêtes à afficher. */
  reasons: string[];
}
