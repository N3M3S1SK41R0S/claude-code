/**
 * Seed du backtest de calibration (pari #1, cold-start J1).
 *
 * Pour chaque référence de marché (benchmarks.ts) : collecte les observations
 * disponibles, construit des cas point-in-time leave-one-out et rejoue le
 * moteur §7. Les lignes alimentent calibration_outcomes.
 *
 * Doctrine d'erreur : seul NO_OBSERVATIONS est un cas légitime à écarter ;
 * toute autre erreur remonte.
 */
import {
  isVelumError,
  type FxRates,
  type PriceObservation,
  type PriceQuery,
  type VelumDomain,
} from '@velum/core';
import { leaveOneOutCases, valuate } from '@velum/valuation';

export interface OutcomeRow {
  domain: VelumDomain;
  central: number;
  ci80_low: number;
  ci80_high: number;
  ci95_low: number;
  ci95_high: number;
  realized: number;
  origin: 'public_backtest';
  realized_at: string;
}

export interface SeedDeps {
  fetchObservations(domain: VelumDomain, query: PriceQuery): Promise<PriceObservation[]>;
  fx: FxRates;
  now: () => Date;
}

export interface SeedReport {
  rows: OutcomeRow[];
  perDomain: Record<string, { cases: number; kept: number; skipped: number }>;
}

function realizedAt(now: Date, ageDays: number | undefined): string {
  const days =
    typeof ageDays === 'number' && Number.isFinite(ageDays) ? Math.max(0, ageDays) : 0;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export async function buildSeedRows(
  benchmarks: Record<VelumDomain, PriceQuery[]>,
  deps: SeedDeps,
): Promise<SeedReport> {
  const rows: OutcomeRow[] = [];
  const perDomain: SeedReport['perDomain'] = {};
  const now = deps.now();

  for (const domain of Object.keys(benchmarks) as VelumDomain[]) {
    let cases = 0;
    let kept = 0;
    let skipped = 0;
    const queries = benchmarks[domain];
    if (!queries) continue;

    for (const query of queries) {
      const observations = await deps.fetchObservations(domain, query);
      const leaveOneOut = leaveOneOutCases(observations, deps.fx, { domain });
      cases += leaveOneOut.length;

      for (const backtestCase of leaveOneOut) {
        try {
          const result = valuate(backtestCase.observations, deps.fx);
          rows.push({
            domain,
            central: result.central,
            ci80_low: result.ci80[0],
            ci80_high: result.ci80[1],
            ci95_low: result.ci95[0],
            ci95_high: result.ci95[1],
            realized: backtestCase.realized,
            origin: 'public_backtest',
            realized_at: realizedAt(now, backtestCase.realizedAgeDays),
          });
          kept += 1;
        } catch (error) {
          if (isVelumError(error) && error.code === 'NO_OBSERVATIONS') {
            skipped += 1;
            continue;
          }
          throw error;
        }
      }
    }
    perDomain[domain] = { cases, kept, skipped };
  }

  return { rows, perDomain };
}
