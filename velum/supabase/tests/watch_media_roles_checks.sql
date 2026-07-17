-- Prouve que les quatre rôles Montres sont persistables et qu'un rôle inconnu
-- reste rejeté par le CHECK item_media_kind_check.

begin;

do $checks$
declare
  v_user uuid := '33333333-3333-4333-8333-333333333333';
  v_item uuid;
  v_count integer;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'watch-media-check@velum.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name)
  values (v_user, 'Watch media check')
  on conflict (id) do nothing;

  insert into public.items (owner_id, domain, title)
  values (v_user, 'watch', 'Montre de test')
  returning id into v_item;

  insert into public.item_media (item_id, kind, storage_path)
  values
    (v_item, 'dial', v_user::text || '/dial.jpg'),
    (v_item, 'caseback', v_user::text || '/caseback.jpg'),
    (v_item, 'movement', v_user::text || '/movement.jpg'),
    (v_item, 'clasp', v_user::text || '/clasp.jpg');

  select count(*) into v_count
  from public.item_media
  where item_id = v_item;

  if v_count <> 4 then
    raise exception 'rôles média montres persistés : % au lieu de 4', v_count;
  end if;

  begin
    insert into public.item_media (item_id, kind, storage_path)
    values (v_item, 'watch_unknown', v_user::text || '/invalid.jpg');
    raise exception 'un rôle média inconnu aurait dû être rejeté';
  exception
    when check_violation then null;
  end;
end
$checks$;

rollback;
