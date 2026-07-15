-- ════════════════════════════════════════════════════════════════════════════
-- État privé de livraison des alertes.
--
-- Une alerte ne doit produire une notification qu'au PASSAGE de faux → vrai.
-- La fonction `record_alert_evaluation` verrouille la ligne d'alerte, insère la
-- notification et met à jour l'état dans UNE transaction PostgreSQL.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.alert_delivery_state (
  alert_id            uuid primary key references public.alerts (id) on delete cascade,
  config_fingerprint  text not null,
  condition_met       boolean not null default false,
  last_evaluated_at   timestamptz not null default now(),
  last_triggered_at   timestamptz
);

create index if not exists alert_delivery_state_triggered_idx
  on public.alert_delivery_state (last_triggered_at desc)
  where last_triggered_at is not null;

-- Aucun accès client : le service-role et la fonction SECURITY DEFINER sont les
-- seuls acteurs autorisés. Les utilisateurs continuent à lire leurs notifications
-- via la policy existante de `notifications`.
alter table public.alert_delivery_state enable row level security;

create or replace function public.record_alert_evaluation(
  p_alert_id uuid,
  p_condition_met boolean,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_active boolean;
  v_fingerprint text;
  v_previous_condition boolean;
  v_previous_fingerprint text;
  v_notification_id uuid;
begin
  if p_alert_id is null or p_condition_met is null then
    raise exception 'alert_id et condition_met sont requis';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 200 then
    raise exception 'Titre de notification invalide';
  end if;
  if nullif(btrim(p_body), '') is null or length(p_body) > 2000 then
    raise exception 'Corps de notification invalide';
  end if;

  -- Le verrou sur l'alerte sérialise deux exécutions concurrentes du cron.
  select i.owner_id,
         a.active,
         md5(a.type || ':' || a.config::text)
    into v_owner_id, v_active, v_fingerprint
    from public.alerts a
    join public.items i on i.id = a.item_id
   where a.id = p_alert_id
   for update of a;

  if not found or not v_active then
    return null;
  end if;

  insert into public.alert_delivery_state (
    alert_id,
    config_fingerprint,
    condition_met,
    last_evaluated_at
  ) values (
    p_alert_id,
    v_fingerprint,
    false,
    now()
  )
  on conflict (alert_id) do nothing;

  select condition_met, config_fingerprint
    into v_previous_condition, v_previous_fingerprint
    from public.alert_delivery_state
   where alert_id = p_alert_id
   for update;

  -- Une modification de type/configuration constitue une nouvelle alerte et la
  -- réarme, même si l'ancienne condition était encore vraie.
  if v_previous_fingerprint is distinct from v_fingerprint then
    v_previous_condition := false;
  end if;

  if p_condition_met and not v_previous_condition then
    insert into public.notifications (owner_id, title, body)
    values (v_owner_id, btrim(p_title), btrim(p_body))
    returning id into v_notification_id;

    update public.alert_delivery_state
       set config_fingerprint = v_fingerprint,
           condition_met = true,
           last_evaluated_at = now(),
           last_triggered_at = now()
     where alert_id = p_alert_id;

    return v_notification_id;
  end if;

  -- Une condition redevenue fausse réarme l'alerte pour le prochain franchissement.
  update public.alert_delivery_state
     set config_fingerprint = v_fingerprint,
         condition_met = p_condition_met,
         last_evaluated_at = now()
   where alert_id = p_alert_id;

  return null;
end;
$$;

-- Réactiver explicitement une alerte doit la réarmer, même si sa configuration
-- n'a pas changé depuis le déclenchement précédent.
create or replace function public.reset_alert_delivery_on_reactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not old.active and new.active then
    delete from public.alert_delivery_state where alert_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_alert_delivery_on_reactivate on public.alerts;
create trigger reset_alert_delivery_on_reactivate
  after update of active on public.alerts
  for each row
  execute function public.reset_alert_delivery_on_reactivate();

revoke all on table public.alert_delivery_state from public, anon, authenticated;
revoke all on function public.record_alert_evaluation(uuid, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.reset_alert_delivery_on_reactivate()
  from public, anon, authenticated;

grant execute on function public.record_alert_evaluation(uuid, boolean, text, text)
  to service_role;
