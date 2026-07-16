/**
 * Seed du backtest de calibration (pari #1, cold-start J1).
 *
 * Pour chaque référence de marché (benchmarks.ts) : collecte les observations
 * de prix courantes chez les sources branchées, construit les cas
 * « leave-one-out » (chaque VENTE RÉELLE devient tour à tour la vérité-terrain)
 * et rejoue le moteur §7 sur le reste. Les lignes produites alimentent
 * `calibration_outcomes` (origin = 'public_backtest').
 *
 * Doctrine d'erreur (héritée de la PR #10) : seul NO_OBSERVATIONS est un cas
 * légitime à écarter ; toute autre erreur (taux de change manquant, source
 * mal configurée) REMONTE — une configuration cassée ne s'efface jamais.
 *
 * Dépendances injectées → testable en Deno sans réseau.
 */
import {
  isVelumError,
  type FxRates,
  type PriceObservation,
  type PriceQuery,
  type VelumDomain,
} from '@velum/core';
import { leaveOneOutCases, valuate } from '@velum/valuation';

/** Ligne prête pour l'insertion dans calibration_outcomes. */
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
  /** Fan-out sources d'un domaine pour une requête (adaptateurs §9). */
  fetchObservations(domain: VelumDomain, query: PriceQuery): Promise<PriceObservation[]>;
  fx: FxRates;
  /** Horloge injectée (réalisé daté = now − ageDays). */
  now: () => Date;
}

export interface SeedReport {
  rows: OutcomeRow[];
  /** Par domaine : cas construits / écartés (NO_OBSERVATIONS uniquement). */
  perDomain: Record<string, { cases: number; kept: number; skipped: number }>;
}

function realizedAt(now: Date, ageDays: number | undefined): string {
  const days = typeof ageDays === 'number' && Number.isFinite(ageDays) ? Math.max(0, ageDays) : 0;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/**
 * Construit les lignes de backtest pour un jeu de références par domaine.
 * N'écrit rien : l'appelant persiste (remplacement des `public_backtest`).
 */
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

    for (const query of benchmarks[domain]) {
      const observations = await deps.fetchObservations(domain, query);
      const looCases = leaveOneOutCases(observations, deps.fx, { domain });
      cases += looCases.length;

      for (const c of looCases) {
        try {
          const result = valuate(c.observations, deps.fx);
          rows.push({
            domain,
            central: result.central,
            ci80_low: result.ci80[0],
            ci80_high: result.ci80[1],
            ci95_low: result.ci95[0],
            ci95_high: result.ci95[1],
            realized: c.realized,
            origin: 'public_backtest',
            realized_at: realizedAt(now, c.realizedAgeDays),
          });
          kept++;
        } catch (err) {
          // Seul « aucun comparable » est légitime ; le reste remonte.
          if (isVelumError(err) && err.code === 'NO_OBSERVATIONS') {
            skipped++;
            continue;
          }
          throw err;
        }
      }
    }
    perDomain[domain] = { cases, kept, skipped };
  }

  return { rows, perDomain };
}
