/**
 * @velum/scan — qualité de capture & authenticité (paris #4, #5, QW #3).
 * Logique PURE et testable, sans dépendance native ni réseau.
 */
export {
  assessFrame,
  sequenceProgress,
  REQUIRED_ROLES,
  DEFAULT_CAPTURE_THRESHOLDS,
  type FrameMetrics,
  type CaptureDecision,
  type CaptureIssue,
  type CaptureThresholds,
  type SequenceProgress,
} from './capture';

export {
  parseCertScan,
  certVerifyUrl,
  detectSlabSwap,
  type CertScan,
  type GradingService,
} from './cert';

export {
  assessAuthenticity,
  KNOWN_FAKE_MATCH_THRESHOLD,
  type PhysicalReference,
  type PhysicalMeasurement,
  type AuthenticityFlag,
  type AuthenticitySignal,
  type AuthenticityOptions,
  type KnownFakeMatch,
  type RiskLevel,
  type SignalConfidence,
  type Tolerance,
} from './authenticity';
