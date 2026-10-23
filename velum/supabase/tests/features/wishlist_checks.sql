-- ─────────────────────────────────────────────────────────────────────────────
-- Tests SQL du chantier « Liste d'envies et d'idées » (wishlist_entries).
-- Rejouables sur base fraîche, indépendants des autres fichiers : utilisateurs
-- dédiés (Wanda, Xavier, Yann). Chaque bloc lève une exception si l'attendu
-- n'est pas respecté.
-- Couverture : défauts, contraintes CHECK, isolation RLS (lecture, écriture,
-- suppression), WITH CHECK, anon, acquired_at géré par trigger, updated_at,
-- objet d'origine du même propriétaire, ON DELETE SET NULL, purge RGPD.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  ('5a5a5a5a-1111-4111-8111-111111111111', 'wanda@wishlist.test', '{"display_name":"Wanda"}'),
  ('5b5b5b5b-2222-4222-8222-222222222222', 'xavier@wishlist.test', '{"display_name":"Xavier"}'),
  ('5c5c5c5c-3333-4333-8333-333333333333', 'yann@wishlist.test', '{"display_name":"Yann"}')
on conflict (id) do nothing;

-- Objets de collection : un pour Wanda, un pour Xavier.
insert into public.items (id, owner_id, domain, title)
values
  ('5a5a5a5a-0000-4000-8000-0000000000a1',
   '5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'Bandol de Wanda'),
  ('5b5b5b5b-0000-4000-8000-0000000000b1',
   '5b5b5b5b-2222-4222-8222-222222222222', 'coin', 'Napoléon de Xavier')
on conflict (id) do nothing;

-- ── W1. Création par le propriétaire : défauts neutres ──────────────────────
do $$
declare
  v_row public.wishlist_entries%rowtype;
begin
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  insert into public.wishlist_entries (id, owner_id, domain, title)
  values ('5a5a5a5a-0000-4000-8000-0000000000e1',
          '5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'Domaine Tempier Bandol 2019')
  returning * into v_row;

  if v_row.kind <> 'wish' or v_row.source <> 'manual' or v_row.priority <> 'medium' then
    raise exception 'W1 défauts : kind/source/priority inattendus (%, %, %)',
      v_row.kind, v_row.source, v_row.priority;
  end if;
  if v_row.attributes <> '{}'::jsonb then
    raise exception 'W1 défauts : attributes attendu {}, vu %', v_row.attributes;
  end if;
  if v_row.acquired or v_row.acquired_at is not null then
    raise exception 'W1 défauts : une envie neuve ne doit pas être obtenue';
  end if;
  if v_row.target_price is not null or v_row.notes is not null or v_row.source_item_id is not null then
    raise exception 'W1 défauts : colonnes facultatives attendues à NULL';
  end if;

  -- Entrée complète (idée, attributs, prix cible, objet d'origine à soi).
  insert into public.wishlist_entries
    (id, owner_id, domain, kind, title, notes, attributes, source, source_item_id, target_price, priority)
  values ('5a5a5a5a-0000-4000-8000-0000000000e2',
          '5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'idea', 'En racheter 6',
          'Superbe sur un gigot', '{"producer":"Domaine Tempier","vintage":2019}', 'item',
          '5a5a5a5a-0000-4000-8000-0000000000a1', 59.90, 'high');

  raise notice 'OK W1 — création et défauts';
end
$$;

-- ── W2. Contraintes CHECK ───────────────────────────────────────────────────
do $$
declare
  v_case text;
begin
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  foreach v_case in array array[
    'blank_title', 'long_title', 'negative_price', 'bad_kind', 'bad_priority',
    'bad_source', 'array_attributes', 'long_notes'
  ] loop
    begin
      insert into public.wishlist_entries
        (owner_id, domain, title, target_price, kind, priority, source, attributes, notes)
      values (
        '5a5a5a5a-1111-4111-8111-111111111111', 'wine',
        case v_case when 'blank_title' then '   ' when 'long_title' then repeat('x', 201) else 'Valide' end,
        case v_case when 'negative_price' then -1 else null end,
        case v_case when 'bad_kind' then 'reve' else 'wish' end,
        case v_case when 'bad_priority' then 'urgent' else 'medium' end,
        case v_case when 'bad_source' then 'inconnu' else 'manual' end,
        case v_case when 'array_attributes' then '[1,2]'::jsonb else '{}'::jsonb end,
        case v_case when 'long_notes' then repeat('n', 2001) else null end
      );
      raise exception 'W2 : le cas % aurait dû être refusé', v_case;
    exception
      when check_violation then null; -- attendu
    end;
  end loop;

  raise notice 'OK W2 — contraintes CHECK (titre, prix, kind, priorité, source, attributs, notes)';
end
$$;

-- ── W3. Isolation RLS : Xavier ne voit ni ne touche les envies de Wanda ─────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', '5b5b5b5b-2222-4222-8222-222222222222', true);
  set local role authenticated;

  select count(*) into v_count from public.wishlist_entries;
  if v_count <> 0 then
    raise exception 'W3 RLS : Xavier ne devrait voir aucune envie, vu %', v_count;
  end if;

  update public.wishlist_entries set title = 'piraté'
  where id = '5a5a5a5a-0000-4000-8000-0000000000e1';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'W3 RLS : Xavier a modifié % envie(s) de Wanda', v_count;
  end if;

  delete from public.wishlist_entries where id = '5a5a5a5a-0000-4000-8000-0000000000e1';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'W3 RLS : Xavier a supprimé % envie(s) de Wanda', v_count;
  end if;

  -- Wanda, elle, voit ses deux entrées.
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  select count(*) into v_count from public.wishlist_entries;
  if v_count <> 2 then
    raise exception 'W3 RLS : Wanda devrait voir 2 envies, vu %', v_count;
  end if;

  raise notice 'OK W3 — isolation RLS (lecture, modification, suppression)';
end
$$;

-- ── W4. WITH CHECK : pas d'insertion chez autrui, pas de transfert ──────────
do $$
begin
  perform set_config('velum.uid', '5b5b5b5b-2222-4222-8222-222222222222', true);
  set local role authenticated;

  begin
    insert into public.wishlist_entries (owner_id, domain, title)
    values ('5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'intrusion');
    raise exception 'W4 : insert de Xavier chez Wanda aurait dû être refusé';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  -- Wanda ne peut pas donner son envie à Xavier.
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  begin
    update public.wishlist_entries
    set owner_id = '5b5b5b5b-2222-4222-8222-222222222222'
    where id = '5a5a5a5a-0000-4000-8000-0000000000e1';
    raise exception 'W4 : transfert de propriété aurait dû être refusé';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  raise notice 'OK W4 — WITH CHECK (insertion et transfert refusés)';
end
$$;

-- ── W5. Anonyme : aucun accès ───────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', '', true);
  set local role anon;

  begin
    select count(*) into v_count from public.wishlist_entries;
    if v_count <> 0 then
      raise exception 'W5 : anon voit % envie(s)', v_count;
    end if;
  exception
    when insufficient_privilege then null; -- attendu (droits révoqués)
  end;

  begin
    insert into public.wishlist_entries (owner_id, domain, title)
    values ('5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'anonyme');
    raise exception 'W5 : insert anonyme aurait dû être refusé';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  raise notice 'OK W5 — aucun accès anonyme';
end
$$;

-- ── W6. acquired_at posé / conservé / effacé par le trigger ─────────────────
do $$
declare
  v_at timestamptz;
  v_acquired boolean;
begin
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  -- Obtenue : acquired_at posé par le serveur, même si le client en fournit un.
  update public.wishlist_entries
  set acquired = true, acquired_at = '1999-01-01T00:00:00Z'
  where id = '5a5a5a5a-0000-4000-8000-0000000000e1'
  returning acquired_at into v_at;
  if v_at is null or v_at < now() - interval '1 minute' then
    raise exception 'W6 : acquired_at attendu à maintenant, vu %', v_at;
  end if;

  -- Tentative d'antidater sans changer `acquired` : ignorée.
  update public.wishlist_entries
  set acquired_at = '1999-01-01T00:00:00Z', notes = 'achetée chez le caviste'
  where id = '5a5a5a5a-0000-4000-8000-0000000000e1'
  returning acquired_at into v_at;
  if v_at < now() - interval '1 minute' then
    raise exception 'W6 : acquired_at a pu être antidaté (%)', v_at;
  end if;

  -- Remise en envie : acquired_at effacé.
  update public.wishlist_entries set acquired = false
  where id = '5a5a5a5a-0000-4000-8000-0000000000e1'
  returning acquired_at into v_at;
  if v_at is not null then
    raise exception 'W6 : acquired_at aurait dû être effacé, vu %', v_at;
  end if;

  -- Création directement « obtenue » : acquired_at posé ; une date fournie
  -- sans `acquired` est ignorée.
  insert into public.wishlist_entries (owner_id, domain, title, acquired)
  values ('5a5a5a5a-1111-4111-8111-111111111111', 'coin', 'Déjà trouvée', true)
  returning acquired_at into v_at;
  if v_at is null then
    raise exception 'W6 : insertion obtenue sans acquired_at';
  end if;
  insert into public.wishlist_entries (owner_id, domain, title, acquired_at)
  values ('5a5a5a5a-1111-4111-8111-111111111111', 'coin', 'Pas encore', now())
  returning acquired, acquired_at into v_acquired, v_at;
  if v_acquired or v_at is not null then
    raise exception 'W6 : acquired_at forgé à l''insertion (%, %)', v_acquired, v_at;
  end if;

  raise notice 'OK W6 — acquired_at géré par trigger';
end
$$;

-- ── W7. updated_at rafraîchi, created_at immuable ───────────────────────────
-- Préparation : updated_at vieilli SANS déclencher le trigger qui le rafraîchit.
alter table public.wishlist_entries disable trigger set_updated_at;
update public.wishlist_entries
set updated_at = '2020-01-01T00:00:00Z'
where id = '5a5a5a5a-0000-4000-8000-0000000000e1';
alter table public.wishlist_entries enable trigger set_updated_at;

do $$
declare
  v_updated timestamptz;
  v_created timestamptz;
  v_created_before timestamptz;
begin
  select created_at into v_created_before
  from public.wishlist_entries where id = '5a5a5a5a-0000-4000-8000-0000000000e1';

  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  update public.wishlist_entries
  set priority = 'high', created_at = '2000-01-01T00:00:00Z'
  where id = '5a5a5a5a-0000-4000-8000-0000000000e1'
  returning updated_at, created_at into v_updated, v_created;
  if v_updated <= '2020-01-01T00:00:00Z'::timestamptz then
    raise exception 'W7 : updated_at non rafraîchi (%)', v_updated;
  end if;
  if v_created <> v_created_before then
    raise exception 'W7 : created_at réécrit (% → %)', v_created_before, v_created;
  end if;

  raise notice 'OK W7 — updated_at rafraîchi, created_at immuable';
end
$$;

-- ── W8. Objet d'origine : uniquement un objet de SA collection ──────────────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  -- Wanda ne peut pas rattacher une envie à l'objet de Xavier (insert)…
  begin
    insert into public.wishlist_entries (owner_id, domain, title, source, source_item_id)
    values ('5a5a5a5a-1111-4111-8111-111111111111', 'coin', 'Comme celle de Xavier', 'item',
            '5b5b5b5b-0000-4000-8000-0000000000b1');
    raise exception 'W8 : source_item_id d''autrui accepté à l''insertion';
  exception
    when check_violation or insufficient_privilege then null; -- attendu
  end;

  -- … ni par modification.
  begin
    update public.wishlist_entries
    set source_item_id = '5b5b5b5b-0000-4000-8000-0000000000b1'
    where id = '5a5a5a5a-0000-4000-8000-0000000000e1';
    raise exception 'W8 : source_item_id d''autrui accepté en modification';
  exception
    when check_violation or insufficient_privilege then null; -- attendu
  end;

  -- Un identifiant inexistant est refusé aussi.
  begin
    insert into public.wishlist_entries (owner_id, domain, title, source_item_id)
    values ('5a5a5a5a-1111-4111-8111-111111111111', 'wine', 'Fantôme',
            '5a5a5a5a-0000-4000-8000-0000000000ff');
    raise exception 'W8 : source_item_id inexistant accepté';
  exception
    when check_violation or foreign_key_violation then null; -- attendu
  end;

  select count(*) into v_count from public.wishlist_entries
  where source_item_id = '5b5b5b5b-0000-4000-8000-0000000000b1';
  if v_count <> 0 then
    raise exception 'W8 : % envie(s) rattachée(s) à l''objet de Xavier', v_count;
  end if;

  raise notice 'OK W8 — objet d''origine du même propriétaire uniquement';
end
$$;

-- Le service-role (qui contourne la RLS) est soumis à la même règle.
do $$
begin
  begin
    insert into public.wishlist_entries (owner_id, domain, title, source_item_id)
    values ('5a5a5a5a-1111-4111-8111-111111111111', 'coin', 'Par le service',
            '5b5b5b5b-0000-4000-8000-0000000000b1');
    raise exception 'W8bis : le service-role a rattaché l''objet de Xavier à Wanda';
  exception
    when check_violation then null; -- attendu
  end;
  raise notice 'OK W8bis — règle de propriété appliquée hors RLS';
end
$$;

-- ── W9. Suppression de l'objet d'origine : l'envie reste, lien à NULL ───────
do $$
declare
  v_source uuid;
  v_title text;
begin
  perform set_config('velum.uid', '5a5a5a5a-1111-4111-8111-111111111111', true);
  set local role authenticated;

  delete from public.items where id = '5a5a5a5a-0000-4000-8000-0000000000a1';

  select source_item_id, title into v_source, v_title
  from public.wishlist_entries where id = '5a5a5a5a-0000-4000-8000-0000000000e2';
  if v_title is null then
    raise exception 'W9 : l''envie a disparu avec son objet d''origine';
  end if;
  if v_source is not null then
    raise exception 'W9 : source_item_id aurait dû passer à NULL, vu %', v_source;
  end if;

  raise notice 'OK W9 — ON DELETE SET NULL sur l''objet d''origine';
end
$$;

-- ── W10. Purge RGPD : supprimer le compte efface toutes ses envies ──────────
do $$
declare
  v_count integer;
begin
  -- Yann a une envie : elle doit survivre à la purge de Wanda.
  perform set_config('velum.uid', '5c5c5c5c-3333-4333-8333-333333333333', true);
  set local role authenticated;
  insert into public.wishlist_entries (owner_id, domain, title)
  values ('5c5c5c5c-3333-4333-8333-333333333333', 'stamp', 'Cérès 1849');
  reset role;

  delete from auth.users where id = '5a5a5a5a-1111-4111-8111-111111111111';

  select count(*) into v_count from public.wishlist_entries
  where owner_id = '5a5a5a5a-1111-4111-8111-111111111111';
  if v_count <> 0 then
    raise exception 'W10 cascade : % envie(s) orpheline(s) après suppression du compte', v_count;
  end if;
  select count(*) into v_count from public.wishlist_entries
  where owner_id = '5c5c5c5c-3333-4333-8333-333333333333';
  if v_count <> 1 then
    raise exception 'W10 cascade : les envies d''un autre membre ont été touchées (%)', v_count;
  end if;

  raise notice 'OK W10 — purge RGPD en cascade';
end
$$;

-- Nettoyage : la base partagée par les fichiers de tests reste neutre.
delete from auth.users
where id in ('5b5b5b5b-2222-4222-8222-222222222222', '5c5c5c5c-3333-4333-8333-333333333333');

select 'WISHLIST CHECKS PASSED' as result;
