-- Tests transactionnels de `record_alert_evaluation`.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values (
  '91919191-9191-4919-8919-919191919191',
  'alert-idempotency@test.dev',
  '{"display_name":"Alert Test"}'
);

insert into public.items (id, owner_id, domain, title)
values (
  '92929292-9292-4929-8929-929292929292',
  '91919191-9191-4919-8919-919191919191',
  'wine',
  'Vin test idempotence'
);

insert into public.alerts (id, item_id, type, config, active)
values (
  '93939393-9393-4939-8939-939393939393',
  '92929292-9292-4929-8929-929292929292',
  'price_threshold',
  '{"direction":"above","threshold":100}'::jsonb,
  true
);

set role service_role;

do $$
declare
  v_first uuid;
  v_duplicate uuid;
  v_rearmed uuid;
  v_reconfigured uuid;
  v_reactivated uuid;
  v_count integer;
  v_condition boolean;
begin
  -- Premier franchissement : une notification est créée.
  select public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte de prix',
    'Le seuil est franchi.'
  ) into v_first;
  if v_first is null then
    raise exception 'idempotence : le premier franchissement devait notifier';
  end if;

  -- Même condition toujours vraie : aucune seconde notification.
  select public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte de prix',
    'Le seuil est toujours franchi.'
  ) into v_duplicate;
  if v_duplicate is not null then
    raise exception 'idempotence : un état vrai répété a produit un doublon';
  end if;

  select count(*) into v_count
  from public.notifications
  where owner_id = '91919191-9191-4919-8919-919191919191';
  if v_count <> 1 then
    raise exception 'idempotence : attendu 1 notification, vu %', v_count;
  end if;

  -- Retour sous le seuil : l'alerte se réarme sans notification.
  perform public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    false,
    'Alerte de prix',
    'Le seuil n’est plus franchi.'
  );
  select condition_met into v_condition
  from public.alert_delivery_state
  where alert_id = '93939393-9393-4939-8939-939393939393';
  if v_condition then
    raise exception 'idempotence : la condition fausse devait réarmer l’alerte';
  end if;

  -- Nouveau franchissement après réarmement : nouvelle notification légitime.
  select public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte de prix',
    'Le seuil est franchi à nouveau.'
  ) into v_rearmed;
  if v_rearmed is null then
    raise exception 'idempotence : le nouveau franchissement devait notifier';
  end if;

  -- Une nouvelle configuration constitue une nouvelle alerte logique.
  update public.alerts
  set config = '{"direction":"above","threshold":200}'::jsonb
  where id = '93939393-9393-4939-8939-939393939393';
  select public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte de prix',
    'Le nouveau seuil est franchi.'
  ) into v_reconfigured;
  if v_reconfigured is null then
    raise exception 'idempotence : une configuration modifiée devait réarmer';
  end if;

  -- Une alerte inactive ne notifie jamais.
  update public.alerts set active = false
  where id = '93939393-9393-4939-8939-939393939393';
  if public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte inactive',
    'Ne doit pas être créée.'
  ) is not null then
    raise exception 'idempotence : une alerte inactive a notifié';
  end if;

  -- La réactivation explicite supprime l'état précédent et réarme.
  update public.alerts set active = true
  where id = '93939393-9393-4939-8939-939393939393';
  select count(*) into v_count
  from public.alert_delivery_state
  where alert_id = '93939393-9393-4939-8939-939393939393';
  if v_count <> 0 then
    raise exception 'idempotence : la réactivation devait purger l’état';
  end if;

  select public.record_alert_evaluation(
    '93939393-9393-4939-8939-939393939393',
    true,
    'Alerte réactivée',
    'La notification est de nouveau autorisée.'
  ) into v_reactivated;
  if v_reactivated is null then
    raise exception 'idempotence : une alerte réactivée devait notifier';
  end if;

  select count(*) into v_count
  from public.notifications
  where owner_id = '91919191-9191-4919-8919-919191919191';
  if v_count <> 4 then
    raise exception 'idempotence : attendu 4 notifications légitimes, vu %', v_count;
  end if;

  raise notice 'OK alertes — franchissement unique, réarmement, reconfiguration et réactivation';
end
$$;

reset role;

-- Ni la table d'état ni la fonction d'écriture ne sont accessibles au client.
do $$
begin
  perform set_config('velum.uid', '91919191-9191-4919-8919-919191919191', true);
  set local role authenticated;

  begin
    perform 1 from public.alert_delivery_state;
    raise exception 'RLS alert_delivery_state : lecture client autorisée à tort';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.record_alert_evaluation(
      '93939393-9393-4939-8939-939393939393',
      true,
      'Intrusion',
      'Appel client interdit'
    );
    raise exception 'record_alert_evaluation : exécution client autorisée à tort';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
delete from auth.users where id = '91919191-9191-4919-8919-919191919191';

select 'ALERT IDEMPOTENCY CHECKS PASSED' as result;
