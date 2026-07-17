/**
 * Edge Function `calibration` — score de calibration auditable (pari #1).
 *
 * Trois usages :
 *   • GET                     → dernier score publié par domaine (lecture
 *     publique, table calibration_runs, RLS « authenticated »).
 *   • POST {"mode":"seed"}    → backtest leave-one-out sur les références de
 *     marché (benchmarks.ts, ventes publiques) : remplace les lignes
 *     'public_backtest' de calibration_outcomes (les 'real_sale' sont
 *     intouchées), puis enchaîne le recalcul ci-dessous.
 *   • POST (défaut)           → recalcule la calibration depuis
 *     calibration_outcomes et publie un run par domaine.
 *   Les POST sont réservés au cron : en-tête secret CRON_SECRET
 *   (service-role, bypass RLS) — jamais déclenchables par un client.
 *
 * La douve : une métrique reproductible de « à quelle fréquence le prix réalisé
 * tombe dans l'IC annoncé » qu'aucun scanner one-shot ne peut afficher.
 */
import type { PriceObservation, VelumDomain } from '@velum/core';
import { calibrate } from '@velum/valuation';
import { createAdminClient, createUserClient } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { buildSources } from '../_shared/domains.ts';
import { getFxRates } from '../_shared/fx.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';
import { serverTransport } from '../_shared/transport.ts';
import { BENCHMARK_QUERIES } from './benchmarks.ts';
import { parseCalibrationOutcomes } from './outcomes.ts';
import { buildSeedRows } from './seed.ts';

const DOMAINS: VelumDomain[] = ['wine', 'coin', 'art', 'stamp', 'watch'];

interface CalibrationRunInsert {
  domain: VelumDomain;
  n: number;
  coverage80: number;
  coverage95: number;
  status: string;
}

function logFailure(event: string, domain: VelumDomain | null, cause: unknown): void {
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      event,
      domain,
      message: cause instanceof Error ? cause.message : String(cause),
    }),
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    // ── Lecture publique du dernier score par domaine ──
    if (req.method === 'GET') {
      const supabase = createUserClient(req);
      const results: Record<string, unknown> = {};
      for (const domain of DOMAINS) {
        const { data, error: readError } = await supabase
          .from('calibration_runs')
          .select('domain, n, coverage80, coverage95, status, computed_at')
          .eq('domain', domain)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (readError) {
          logFailure('calibration.read_failed', domain, readError.message);
          return error('SOURCE_UNAVAILABLE', 'Lecture de la calibration impossible', 503);
        }
        results[domain] = data ?? { domain, status: 'calibrating', n: 0 };
      }
      return json({ runs: results });
    }

    // ── Seed backtest + recalcul (cron only) ──
    if (req.method === 'POST') {
      const secret = req.headers.get('x-cron-secret');
      if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
        return error('UNAUTHORIZED', 'Recalcul réservé au cron', 401);
      }
      const admin = createAdminClient();

      // Mode 'seed' : rejoue le backtest leave-one-out sur les références de
      // marché (ventes publiques) et REMPLACE les lignes 'public_backtest'
      // (les ventes réelles 'real_sale' ne sont jamais touchées), puis
      // enchaîne sur le recalcul ci-dessous.
      let body: { mode?: unknown } = {};
      try {
        body = (await req.json()) as { mode?: unknown };
      } catch {
        // Corps vide toléré : mode par défaut 'recompute'.
      }
      const mode = body.mode === 'seed' ? 'seed' : 'recompute';

      if (mode === 'seed') {
        let report;
        try {
          report = await buildSeedRows(BENCHMARK_QUERIES, {
            fetchObservations: async (domain, query) => {
              // Même sémantique que les plugins : une source en panne se
              // dégrade (allSettled), elle ne casse jamais le lot.
              const sources = buildSources(domain, serverTransport);
              const settled = await Promise.allSettled(sources.map((s) => s.fetch(query)));
              return settled
                .filter(
                  (r): r is PromiseFulfilledResult<PriceObservation[]> => r.status === 'fulfilled',
                )
                .flatMap((r) => r.value);
            },
            fx: await getFxRates(),
            now: () => new Date(),
          });
        } catch (seedError) {
          // Configuration cassée (FX manquant…) : visible, jamais avalée.
          logFailure('calibration.seed_failed', null, seedError);
          return error('SOURCE_UNAVAILABLE', 'Seed du backtest impossible', 503);
        }

        // Remplacement atomique par domaine : compute d'abord (fait), écrit ensuite.
        for (const domain of DOMAINS) {
          const { error: deleteError } = await admin
            .from('calibration_outcomes')
            .delete()
            .eq('domain', domain)
            .eq('origin', 'public_backtest');
          if (deleteError) {
            logFailure('calibration.seed_replace_failed', domain, deleteError.message);
            return error('SOURCE_UNAVAILABLE', 'Remplacement du backtest impossible', 503);
          }
          const domainRows = report.rows.filter((r) => r.domain === domain);
          if (domainRows.length > 0) {
            const { error: insertError } = await admin
              .from('calibration_outcomes')
              .insert(domainRows);
            if (insertError) {
              logFailure('calibration.seed_insert_failed', domain, insertError.message);
              return error('SOURCE_UNAVAILABLE', 'Insertion du backtest impossible', 503);
            }
          }
        }
        console.info(JSON.stringify({ event: 'calibration.seeded', perDomain: report.perDomain }));
      }
      const published: Record<string, unknown> = {};
      const runs: CalibrationRunInsert[] = [];

      // On calcule les cinq domaines AVANT toute écriture. Une donnée invalide
      // ne doit jamais laisser un sous-ensemble de runs plus récent que les autres.
      for (const domain of DOMAINS) {
        const { data: rows, error: readError } = await admin
          .from('calibration_outcomes')
          .select('central, ci80_low, ci80_high, ci95_low, ci95_high, realized')
          .eq('domain', domain)
          .limit(5000);
        if (readError) {
          logFailure('calibration.outcomes_read_failed', domain, readError.message);
          return error('SOURCE_UNAVAILABLE', 'Recalcul de la calibration impossible', 503);
        }

        let outcomes: ReturnType<typeof parseCalibrationOutcomes>;
        try {
          outcomes = parseCalibrationOutcomes(rows ?? [], domain);
        } catch (parseError) {
          logFailure('calibration.outcomes_invalid', domain, parseError);
          return error('SOURCE_UNAVAILABLE', 'Données de calibration invalides', 503);
        }

        const calibration = calibrate(outcomes);
        runs.push({
          domain,
          n: calibration.n,
          coverage80: calibration.coverage80,
          coverage95: calibration.coverage95,
          status: calibration.status,
        });
        published[domain] = {
          n: calibration.n,
          coverage80: calibration.coverage80,
          coverage95: calibration.coverage95,
          status: calibration.status,
        };
      }

      // Une seule instruction INSERT : PostgreSQL publie les cinq domaines ou
      // aucun. Le client ne peut plus observer un run partiellement renouvelé.
      const { error: insertError } = await admin.from('calibration_runs').insert(runs);
      if (insertError) {
        logFailure('calibration.publish_failed', null, insertError.message);
        return error('SOURCE_UNAVAILABLE', 'Publication de la calibration impossible', 503);
      }

      return json({ published });
    }

    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  } catch (err) {
    return errorFromException(err);
  }
});
