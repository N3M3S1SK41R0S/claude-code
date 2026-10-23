-- ============================================================================
-- VELUM — plateformes d'échange et de vente (5/5) : tâches planifiées.
-- ----------------------------------------------------------------------------
-- pg_cron exécute directement les fonctions SQL de confiance (pas d'appel
-- HTTP, donc pas de pg_net ni de secret vault) :
--   - toutes les heures, à la minute 7 :
--       expire_stale_exchanges()  — propositions d'échange sans réponse ;
--       complete_due_exchanges()  — auto-confirmation J+X après livraison des
--                                   deux colis, sans litige ;
--       release_due_orders()      — auto-libération du séquestre des ventes
--                                   (fonction de 0006, jusqu'ici non planifiée).
--
-- CONTRAT CI : comme 20260716120000_calibration_cron.sql, migration REJOUABLE
-- sur PostgreSQL nu — tout est gardé par la disponibilité de pg_cron : absent
-- (CI), elle ne fait rien et le journal l'indique ; présent (production
-- Supabase), le job est (re)planifié de façon idempotente.
-- ============================================================================

do $migration$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'velum-market-cron') then
      perform cron.unschedule('velum-market-cron');
    end if;

    perform cron.schedule(
      'velum-market-cron',
      '7 * * * *',
      $job$
      select public.expire_stale_exchanges();
      select public.complete_due_exchanges();
      select public.release_due_orders();
      $job$
    );
  else
    raise notice 'pg_cron indisponible — job des plateformes d''échange non planifié (environnement de test).';
  end if;
end
$migration$;

-- Pour dé-planifier : select cron.unschedule('velum-market-cron');
-- Pour inspecter : select * from cron.job_run_details order by start_time desc limit 20;
