/**
 * Arbitre boire / garder / vendre (§7 étendu) — Pari #3.
 *
 * Croise une FENÊTRE D'USAGE (apogée ZAPPA pour le vin) avec une TRAJECTOIRE
 * DE VALEUR (suite d'instantanés §7 datés). Garde-fou anti-market-timing,
 * exigé par le jury adverse :
 *
 *   → un signal « fenêtre de sortie » (sellWindow) ne se déclenche QUE si
 *     l'apogée se referme sous `horizonYears` ET si la tendance de valeur est
 *     STATISTIQUEMENT SÉPARÉE de plat — c.-à-d. IC 80 % disjoints entre le
 *     premier et le dernier instantané, sur au moins 3 points. Sinon : silence
 *     (verdict prudent), jamais de faux signal (principe #1).
 *
 * Fonction PURE : aucune horloge interne, `currentYear` est fourni.
 * Toujours indicatif — l'utilisateur reste seul décideur (disclaimers en aval).
 */

export type ArbiterVerdict = 'drink' | 'hold' | 'sell' | 'watch';
export type ValueTrend = 'rising' | 'falling' | 'flat' | 'unknown';

/** Un point de la trajectoire de valeur (instantané §7 daté). */
export interface TrajectoryPoint {
  /** Horodatage ISO (chronologie ; l'appelant fournit des points triés). */
  at: string;
  central: number;
  ci80: [number, number];
}

export interface ArbiterInput {
  /** Année courante (fournie, jamais Date.now()). */
  currentYear: number;
  /** Fenêtre d'apogée [from, to] (vin) ; absente pour les actifs non périssables. */
  usageWindow?: { from: number; to: number };
  /** Instantanés §7 datés, du plus ancien au plus récent. */
  trajectory: TrajectoryPoint[];
  /** Horizon d'urgence : apogée se refermant sous N ans (défaut 3). */
  horizonYears?: number;
}

export interface ArbiterSignal {
  verdict: ArbiterVerdict;
  /** Confiance du signal 0..1 (croît avec le nombre de points et la marge). */
  confidence: number;
  trend: ValueTrend;
  /** Garde-fou : true seulement si apogée proche ET tendance séparée de plat. */
  sellWindow: boolean;
  /** Justifications en français, prêtes à afficher. */
  reasons: string[];
}

export const DEFAULT_HORIZON_YEARS = 3;
/** Nombre minimal d'instantanés pour oser une lecture directionnelle. */
export const MIN_TRAJECTORY_POINTS = 3;

/**
 * Tendance de valeur avec garde statistique : on ne déclare une direction
 * que si les IC 80 % du premier et du dernier point sont DISJOINTS et qu'on
 * dispose d'au moins `MIN_TRAJECTORY_POINTS` points. Sinon 'flat' (≥ points
 * mais IC qui se chevauchent) ou 'unknown' (pas assez de points).
 */
export function valueTrend(trajectory: TrajectoryPoint[]): ValueTrend {
  if (trajectory.length < MIN_TRAJECTORY_POINTS) return 'unknown';
  const first = trajectory[0] as TrajectoryPoint;
  const last = trajectory[trajectory.length - 1] as TrajectoryPoint;
  // Disjonction des IC 80 % = séparation statistique (§7 bootstrap seedé).
  if (last.ci80[0] > first.ci80[1]) return 'rising';
  if (last.ci80[1] < first.ci80[0]) return 'falling';
  return 'flat';
}

/** Marge de disjonction relative des IC (0 si chevauchement) — nourrit la confiance. */
function separationMargin(trajectory: TrajectoryPoint[]): number {
  if (trajectory.length < MIN_TRAJECTORY_POINTS) return 0;
  const first = trajectory[0] as TrajectoryPoint;
  const last = trajectory[trajectory.length - 1] as TrajectoryPoint;
  const base = Math.max(1, first.central);
  if (last.ci80[0] > first.ci80[1]) return (last.ci80[0] - first.ci80[1]) / base;
  if (last.ci80[1] < first.ci80[0]) return (first.ci80[0] - last.ci80[1]) / base;
  return 0;
}

export function arbitrate(input: ArbiterInput): ArbiterSignal {
  const horizon = input.horizonYears ?? DEFAULT_HORIZON_YEARS;
  const trend = valueTrend(input.trajectory);
  const nPoints = input.trajectory.length;
  const margin = separationMargin(input.trajectory);
  const reasons: string[] = [];

  // Confiance de base : nombre de points (saturation à 6) + marge de séparation.
  const pointScore = Math.min(1, nPoints / 6);
  const directional = trend === 'rising' || trend === 'falling';
  const confidence = Number(
    Math.min(1, 0.4 * pointScore + (directional ? 0.6 * Math.min(1, margin / 0.15) : 0)).toFixed(2),
  );

  const w = input.usageWindow;

  // ── Actif NON périssable (pièce, timbre, tableau) : pas de fenêtre d'usage ──
  if (!w) {
    if (trend === 'falling') {
      reasons.push('Valeur en repli statistiquement établi (IC 80 % disjoints) — envisager une sortie.');
      return { verdict: 'sell', confidence, trend, sellWindow: false, reasons };
    }
    if (trend === 'rising') {
      reasons.push('Valeur en hausse établie — conserver, la trajectoire joue en votre faveur.');
      return { verdict: 'hold', confidence, trend, sellWindow: false, reasons };
    }
    reasons.push(
      trend === 'unknown'
        ? `Historique insuffisant (${nPoints} instantané${nPoints > 1 ? 's' : ''}, minimum ${MIN_TRAJECTORY_POINTS}) — aucun signal, on observe.`
        : 'Tendance non séparée de plat — aucun mouvement recommandé, on observe.',
    );
    return { verdict: 'watch', confidence, trend, sellWindow: false, reasons };
  }

  // ── Actif à fenêtre d'usage (vin) : croiser apogée × trajectoire ──
  const { from, to } = w;
  const beforeWindow = input.currentYear < from;
  const inWindow = input.currentYear >= from && input.currentYear <= to;
  const pastWindow = input.currentYear > to;
  const apogeeClosingSoon = input.currentYear <= to && to - input.currentYear <= horizon;

  // Garde-fou central : fenêtre de sortie seulement si apogée proche ET tendance séparée.
  const sellWindow = apogeeClosingSoon && directional;

  if (pastWindow) {
    reasons.push(`Apogée dépassée (fenêtre ${from}–${to}) — à boire sans tarder, la valeur d'usage décline.`);
    if (trend === 'rising') reasons.push('La valeur marchande grimpe encore : une vente reste défendable.');
    return { verdict: 'drink', confidence, trend, sellWindow: false, reasons };
  }

  if (beforeWindow) {
    if (trend === 'falling') {
      reasons.push(`Encore trop jeune (apogée ${from}–${to}) mais valeur en repli établi — surveiller de près.`);
      return { verdict: 'watch', confidence, trend, sellWindow: false, reasons };
    }
    reasons.push(`Pas encore à l'apogée (fenêtre ${from}–${to}) — garder.`);
    return { verdict: 'hold', confidence, trend, sellWindow: false, reasons };
  }

  // inWindow
  if (sellWindow) {
    reasons.push(
      `Apogée se referme d'ici ${to - input.currentYear} an(s) ET tendance de valeur ${trend === 'rising' ? 'haussière' : 'baissière'} établie (IC 80 % disjoints) — fenêtre de sortie.`,
    );
    return { verdict: 'sell', confidence, trend, sellWindow: true, reasons };
  }

  reasons.push(`À son apogée (fenêtre ${from}–${to}) — à boire.`);
  if (apogeeClosingSoon && !directional) {
    reasons.push('Apogée proche mais aucune tendance de valeur séparée de plat : pas de signal de vente (anti-faux-signal).');
  }
  return { verdict: 'drink', confidence, trend, sellWindow: false, reasons };
}
