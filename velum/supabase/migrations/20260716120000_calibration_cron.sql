-- ============================================================================
-- VELUM — migration : calibration quotidienne planifiée (pari #1)
-- ----------------------------------------------------------------------------
-- pg_cron déclenche chaque nuit à 04:15 UTC (après price-cron, 03:00) un POST
-- (pg_net) vers l'Edge Function `calibration` en mode 'seed' :
--   1. backtest leave-one-out sur les références de marché (ventes publiques)
--      → remplace les lignes calibration_outcomes 'public_backtest' ;
--   2. recalcul et publication des runs (calibration_runs) pour les 5 domaines.
--
-- Réutilise les secrets vault déjà requis par 0002 (price-cron) :
--   'project_url' et 'cron_secret' — voir l'en-tête de 0002_cron.sql pour la
--   configuration une fois via le SQL editor. L'Edge Function exige le même
--   CRON_SECRET (`supabase secrets set CRON_SECRET=...`).
--
-- CONTRAT CI : contrairement à 0002 (exclue du rejeu), cette migration est
-- REJOUABLE sur PostgreSQL nu — tout est gardé par la disponibilité des
-- extensions pg_cron/pg_net : absentes (CI), elle ne fait rien et le journal
-- l'indique ; présentes (production Supabase), le job est (re)planifié.
-- ============================================================================

do $migration$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then

    create extension if not exists pg_cron;
    create extension if not exists pg_net;

    -- Re-planification idempotente : on retire un éventuel job existant.
    if exists (select 1 from cron.job where jobname = 'velum-calibration-cron') then
      perform cron.unschedule('velum-calibration-cron');
    end if;

    perform cron.schedule(
      'velum-calibration-cron',
      '15 4 * * *',
      $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'project_url'
        ) || '/functions/v1/calibration',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'cron_secret'
          )
        ),
        body := '{"mode":"seed"}'::jsonb,
        -- Fan-out sources + backtest 5 domaines : timeout large.
        timeout_milliseconds := 300000
      );
      $job$
    );
  else
    raise notice 'pg_cron/pg_net indisponibles — job de calibration non planifié (environnement de test).';
  end if;
end
$migration$;

-- Pour dé-planifier : select cron.unschedule('velum-calibration-cron');
-- Pour inspecter : select * from cron.job_run_details order by start_time desc limit 20;
