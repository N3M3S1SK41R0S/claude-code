export {
  valuate,
  rejectOutliers,
  weightedMedian,
  median,
  recencyWeight,
  effectiveWeight,
  reliabilityScore,
  toEUR,
  mulberry32,
  HALF_LIFE_DAYS,
  MAD_K,
  BOOTSTRAP_ITERATIONS,
  type ValuateOptions,
} from './engine.ts';

// Pari #1 — explicabilité « pourquoi cette fourchette ».
export {
  explainValuation,
  explainFromResult,
  reliabilityFromExplanation,
  type ValuationExplanation,
  type ObservationBreakdown,
} from './explain.ts';

// Pari #1 — calibration auditable + backtest cold-start.
export {
  calibrate,
  calibrateByDomain,
  backtest,
  leaveOneOutCases,
  DEFAULT_REALIZED_KINDS,
  MIN_LOO_REMAINING,
  learnSourceWeights,
  MIN_CALIBRATION_SAMPLE,
  COVERAGE80_TARGET,
  COVERAGE95_TARGET,
  type PriceOutcome,
  type CalibrationResult,
  type CalibrationStatus,
  type BacktestCase,
  type LeaveOneOutOptions,
} from './calibration.ts';

// Pari #2 — valorisation de portefeuille patrimonial + mouvement.
export {
  aggregatePortfolio,
  portfolioMovement,
  toSnapshot,
  FLAT_MOVEMENT_THRESHOLD,
  type ItemValuation,
  type PortfolioValuation,
  type PortfolioSnapshot,
  type PortfolioMovement,
  type MovementDirection,
  type DomainBreakdown,
} from './portfolio.ts';

// Pari #3 — arbitre boire/garder/vendre (garde-fou anti-market-timing).
export {
  arbitrate,
  valueTrend,
  DEFAULT_HORIZON_YEARS,
  MIN_TRAJECTORY_POINTS,
  type ArbiterInput,
  type ArbiterSignal,
  type ArbiterVerdict,
  type ValueTrend,
  type TrajectoryPoint,
} from './arbiter.ts';
