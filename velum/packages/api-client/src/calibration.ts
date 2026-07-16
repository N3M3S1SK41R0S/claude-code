import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VelumError,
  type CalibrationRun,
  type CalibrationStatus,
  type VelumDomain,
} from '@velum/core';

export interface CalibrationRunRow {
  domain: unknown;
  n: unknown;
  coverage80: unknown;
  coverage95: unknown;
  status: unknown;
  computed_at: unknown;
}

const STATUSES: ReadonlySet<CalibrationStatus> = new Set([
  'calibrating',
  'well_calibrated',
  'overconfident',
  'underconfident',
]);

function isDomain(value: unknown): value is VelumDomain {
  return value === 'wine' || value === 'coin' || value === 'art' || value === 'stamp';
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function invalidRun(message: string): never {
  throw new VelumError('SOURCE_UNAVAILABLE', `Calibration publiée invalide : ${message}`);
}

/** Valide une ligne PostgREST avant de l'exposer à l'interface. */
export function rowToCalibrationRun(row: CalibrationRunRow): CalibrationRun {
  if (!isDomain(row.domain)) invalidRun('domaine inconnu');

  const n = finiteNumber(row.n);
  if (n === null || !Number.isInteger(n) || n < 0) invalidRun('taille d’échantillon invalide');

  const coverage80 = finiteNumber(row.coverage80);
  const coverage95 = finiteNumber(row.coverage95);
  if (coverage80 === null || coverage80 < 0 || coverage80 > 1) {
    invalidRun('couverture IC80 invalide');
  }
  if (coverage95 === null || coverage95 < 0 || coverage95 > 1) {
    invalidRun('couverture IC95 invalide');
  }

  if (typeof row.status !== 'string' || !STATUSES.has(row.status as CalibrationStatus)) {
    invalidRun('statut inconnu');
  }
  const computedAt = row.computed_at;
  if (typeof computedAt !== 'string' || !Number.isFinite(Date.parse(computedAt))) {
    invalidRun('date de calcul invalide');
  }

  return {
    domain: row.domain,
    n,
    coverage80,
    coverage95,
    status: row.status as CalibrationStatus,
    computedAt,
  };
}

export interface CalibrationRepo {
  /** Dernier run publié pour le domaine, ou null tant que le cron n'a rien publié. */
  latest(domain: VelumDomain): Promise<CalibrationRun | null>;
}

export function createCalibrationRepo(supabase: SupabaseClient): CalibrationRepo {
  return {
    async latest(domain) {
      const { data, error } = await supabase
        .from('calibration_runs')
        .select('domain, n, coverage80, coverage95, status, computed_at')
        .eq('domain', domain)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new VelumError('SOURCE_UNAVAILABLE', `Lecture de la calibration impossible : ${error.message}`);
      }
      if (data === null) return null;
      return rowToCalibrationRun(data as CalibrationRunRow);
    },
  };
}
