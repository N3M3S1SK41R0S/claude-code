-- ════════════════════════════════════════════════════════════════════════════
-- Garde-fous anti-abus sur les appels IA.
--
-- Deux failles réelles, constatées :
--
--   1. `consume_scan` n'est appelé QUE par `recognize`. Les fonctions
--      `analyze-*` et `cellar-pairing` n'ont AUCUN quota — alors qu'`analyze`
--      demande 4096 tokens de sortie, donc coûte plus cher qu'une
--      reconnaissance. Un seul compte gratuit pouvait les appeler en boucle.
--
--   2. Le quota de `consume_scan` est adossé au COMPTE, mais créer un compte est
--      libre, instantané et sans e-mail. Cent comptes = cinq cents scans.
--
-- On ajoute donc trois plafonds, indépendants du quota produit (inchangé) :
--   • un PLAFOND DE DÉPENSE quotidien global — la garantie que la facture ne
--     peut pas s'envoler, quel que soit le nombre de comptes créés ;
--   • un plafond d'appels IA par utilisateur et par jour ;
--   • un plafond d'appels IA par adresse IP et par jour.
--
-- Les comptes PAYANTS ne sont soumis à aucun des trois : on ne bride pas un
-- client qui paie.
-- ════════════════════════════════════════════════════════════════════════════

-- Réglages ajustables sans redéploiement — un plafond que l'on ne peut pas
-- desserrer en urgence est un plafond qui finit par être supprimé.
create table if not exists public.app_settings (
  key   text primary key,
  value numeric not null,
  note  text
);

alter table public.app_settings enable row level security; -- service-role uniquement

insert into public.app_settings (key, value, note) values
  ('daily_cost_cap_usd',  5.00, 'Dépense IA maximale par jour, tous utilisateurs gratuits confondus. Au-delà : les appels gratuits sont refusés (503), les payants passent toujours.'),
  ('user_calls_per_day',  40,   'Appels IA maximum par utilisateur gratuit et par jour.'),
  ('ip_calls_per_day',    60,   'Appels IA maximum par adresse IP et par jour (parade au multi-comptes).')
on conflict (key) do nothing;

-- Compteur par IP. Volontairement grossier : l''IP n''identifie personne, elle
-- sert seulement à rendre le multi-comptes coûteux.
create table if not exists public.ip_usage (
  ip    text not null,
  day   date not null default current_date,
  calls integer not null default 0,
  primary key (ip, day)
);

alter table public.ip_usage enable row level security; -- service-role uniquement

create index if not exists ip_usage_day_idx on public.ip_usage (day);

-- ── Le garde-fou ────────────────────────────────────────────────────────────
-- Retourne : 'ok' | 'budget' | 'user' | 'ip' | 'unauthorized'
-- security definer : doit lire `profiles`, `vision_calls` et `app_settings`,
-- toutes protégées par RLS.
create or replace function public.guard_ai_call(p_ip text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_plan       text;
  v_cost_cap   numeric;
  v_user_cap   numeric;
  v_ip_cap     numeric;
  v_spend      numeric;
  v_user_calls integer;
  v_ip_calls   integer;
begin
  if v_uid is null then
    return 'unauthorized';
  end if;

  select plan into v_plan from public.profiles where id = v_uid;
  if v_plan is null then
    return 'unauthorized';
  end if;

  -- Un client payant n'est jamais bridé par ces garde-fous.
  if v_plan <> 'free' then
    return 'ok';
  end if;

  select value into v_cost_cap from public.app_settings where key = 'daily_cost_cap_usd';
  select value into v_user_cap from public.app_settings where key = 'user_calls_per_day';
  select value into v_ip_cap   from public.app_settings where key = 'ip_calls_per_day';

  -- 1. Plafond de dépense global. C'est LE garde-fou qui compte : il borne la
  --    facture quel que soit le nombre de comptes ou d'IP mobilisés.
  --    Les tarifs viennent de vision_prices ; un modèle sans tarif connu compte
  --    pour 0 — mieux vaut un plafond permissif qu'un service bloqué à tort.
  select coalesce(sum(
           coalesce(c.input_tokens, 0)::numeric  / 1e6 * p.input_usd_per_mtok
         + coalesce(c.output_tokens, 0)::numeric / 1e6 * p.output_usd_per_mtok
         ), 0)
    into v_spend
    from public.vision_calls c
    left join public.vision_prices p
      on p.provider = c.provider and p.model = c.model
   where c.created_at >= date_trunc('day', now());

  if v_spend >= v_cost_cap then
    return 'budget';
  end if;

  -- 2. Plafond par utilisateur (jour glissant : minuit UTC).
  select count(*) into v_user_calls
    from public.vision_calls
   where user_id = v_uid
     and created_at >= date_trunc('day', now());

  if v_user_calls >= v_user_cap then
    return 'user';
  end if;

  -- 3. Plafond par IP — incrémenté ici, donc AVANT l'appel IA. Un appel qui
  --    échoue consomme quand même son jeton : c'est voulu, sinon une boucle
  --    d'échecs contournerait le plafond.
  insert into public.ip_usage (ip, day, calls)
  values (coalesce(nullif(p_ip, ''), 'inconnue'), current_date, 1)
  on conflict (ip, day) do update
    set calls = public.ip_usage.calls + 1
  returning calls into v_ip_calls;

  if v_ip_calls > v_ip_cap then
    return 'ip';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.guard_ai_call(text) from public;
grant execute on function public.guard_ai_call(text) to authenticated;
