/** Codes d'erreur métier VELUM — stables, utilisables côté client pour l'i18n des messages. */
export type VelumErrorCode =
  | 'NO_OBSERVATIONS'
  | 'RECOGNITION_FAILED'
  | 'ANALYSIS_FAILED'
  | 'SOURCE_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED';

export class VelumError extends Error {
  readonly code: VelumErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: VelumErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VelumError';
    this.code = code;
    this.details = details;
  }
}

export function isVelumError(e: unknown): e is VelumError {
  return e instanceof VelumError;
}
