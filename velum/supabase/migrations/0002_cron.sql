-- ============================================================================
-- VELUM — migration 0002 : re-valorisation quotidienne planifiée (price-cron)
-- ----------------------------------------------------------------------------
-- pg_cron déclenche chaque nuit à 03h00 UTC un POST (pg_net) vers l'Edge
-- Function `price-cron`, qui re-valorise les items éligibles et évalue les
-- alertes (voir supabase/functions/price-cron/index.ts).
--
-- ⚠️ CONFIGURATION REQUISE AVANT QUE LE JOB NE FONCTIONNE (une seule fois,
--    via le SQL editor du dashboard — jamais dans une migration versionnée,
--    car ce sont des secrets) :
--
--   -- 1. URL du projet (ex. https://abcdefgh.supabase.co) :
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--
--   -- 2. Secret partagé avec l'Edge Function (le même que
--   --    `supabase secrets set CRON_SECRET=...`) :
--   select vault.create_secret('<valeur-aleatoire-forte>', 'cron_secret');
--
-- Ces secrets sont lus à CHAQUE exécution du job (sous-requêtes dans la
-- commande), donc une rotation via vault.update_secret() est prise en compte
-- sans re-planifier le job.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Planification : tous les jours à 03:00 UTC.
select cron.schedule(
  'velum-price-cron',
  '0 3 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/price-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb,
    -- La re-valorisation par lots peut être longue : timeout large.
    timeout_milliseconds := 300000
  );
  $$
);

-- Pour dé-planifier : select cron.unschedule('velum-price-cron');
-- Pour inspecter les exécutions : select * from cron.job_run_details
--   order by start_time desc limit 20;
