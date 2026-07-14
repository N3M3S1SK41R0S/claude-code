/**
 * Edge Function `calibration` — score de calibration auditable (pari #1).
 *
 * Deux usages :
 *   • GET            → renvoie le dernier score publié par domaine (lecture
 *     publique, table calibration_runs, RLS « authenticated »).
 *   • POST (cron)    → recalcule la calibration depuis calibration_outcomes
 *     (backtest de ventes publiques + ventes réelles) et publie un run par
 *     domaine. Réservé au cron : exige l'en-tête secret CRON_SECRET
 *     (service-role, bypass RLS) — jamais déclenchable par un client.
 *
 * La douve : une métrique reproductible de « à quelle fréquence le prix réalisé
 * tombe dans l'IC annoncé » qu'aucun scanner one-shot ne peut afficher.
 */
import type { VelumDomain } from '@velum/core';
import { calibrate, type PriceOutcome } from '@velum/valuation';
import { createAdminClient, createUserClient } from '../_shared/auth.ts';
import { handleOptions } from '../_shared/cors.ts';
import { error, errorFromException, json } from '../_shared/respond.ts';

const DOMAINS: VelumDomain[] = ['wine', 'coin', 'art', 'stamp'];

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    // ── Lecture publique du dernier score par domaine ──
    if (req.method === 'GET') {
      const supabase = createUserClient(req);
      const results: Record<string, unknown> = {};
      for (const domain of DOMAINS) {
        const { data } = await supabase
          .from('calibration_runs')
          .select('domain, n, coverage80, coverage95, status, computed_at')
          .eq('domain', domain)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        results[domain] = data ?? { domain, status: 'calibrating', n: 0 };
      }
      return json({ runs: results });
    }

    // ── Recalcul (cron only) ──
    if (req.method === 'POST') {
      const secret = req.headers.get('x-cron-secret');
      if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
        return error('UNAUTHORIZED', 'Recalcul réservé au cron', 401);
      }
      const admin = createAdminClient();
      const published: Record<string, unknown> = {};

      for (const domain of DOMAINS) {
        const { data: rows, error: readError } = await admin
          .from('calibration_outcomes')
          .select('central, ci80_low, ci80_high, ci95_low, ci95_high, realized')
          .eq('domain', domain)
          .limit(5000);
        if (readError) continue;

        const outcomes: PriceOutcome[] = (rows ?? []).map((r) => ({
          central: Number(r.central),
          ci80: [Number(r.ci80_low), Number(r.ci80_high)],
          ci95: [Number(r.ci95_low), Number(r.ci95_high)],
          realized: Number(r.realized),
          domain,
        }));

        const c = calibrate(outcomes);
        await admin.from('calibration_runs').insert({
          domain,
          n: c.n,
          coverage80: c.coverage80,
          coverage95: c.coverage95,
          status: c.status,
        });
        published[domain] = { n: c.n, coverage80: c.coverage80, status: c.status };
      }
      return json({ published });
    }

    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  } catch (err) {
    return errorFromException(err);
  }
});
