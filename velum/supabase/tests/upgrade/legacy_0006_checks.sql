-- ─────────────────────────────────────────────────────────────────────────────
-- Contrôles des RATTRAPAGES 0006 (base intermédiaire de run-local.sh : données
-- legacy_0006_data.sql chargées avant 20261023100000, puis toutes les
-- migrations suivantes) :
--   U1 une annonce ouverte par objet : la plus engagée est gardée (publiée,
--      commande en attente) plutôt que le brouillon récent ; vendeur prévenu ;
--      choisie parmi les annonces encore recevables (euro, prix plancher) ;
--   U2 euro et prix plancher : annonces non engagées retirées (vendeur
--      prévenu), commandes non payées annulées (acheteur prévenu) ; annonces
--      épargnées car engagées jamais exposées ni achetables ensuite, et la
--      proposition d'échange est refusée explicitement (P0001) ;
--   U3 suivis en texte libre : transporteur hors liste effacé, numéro non
--      conforme effacé avant expédition et masqué après, numéros conformes
--      normalisés ; l'expédition exige alors un suivi conforme ;
--   U4 une seule commande en attente par acheteur et annonce (la plus
--      récente) : l'index unique se crée ;
--   U5 annonces épargnées (hors euro, sous le plancher) : commandes en attente
--      d'un tiers annulées (tiers prévenu), capture refusée ;
--   U8 une commande en attente ne fait primer qu'une annonce publiée (pas un
--      brouillon) ;
--   U9 un seul paiement capturé par objet : commande expédiée ou en litige,
--      sinon le plus ancien ; les autres annulés (remboursement), acheteurs
--      et vendeur prévenus.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

create or replace function public._upg_expect_error(p_sql text, p_like text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_like or sqlerrm like p_like then
      return;
    end if;
    raise exception 'Erreur inattendue pour « % » : % (%) — attendu %', p_sql, sqlerrm, sqlstate, p_like;
  end;
  raise exception 'Erreur attendue (%) mais « % » a réussi', p_like, p_sql;
end;
$$;
grant execute on function public._upg_expect_error(text, text) to authenticated;

-- ── U1. Une annonce ouverte par objet : la plus engagée est gardée ──────────
do $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000001a';
  if v_status <> 'active' then
    raise exception 'U1 : annonce publiée (commande en attente) conservée attendue, vu %', v_status;
  end if;
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000001b';
  if v_status <> 'withdrawn' then
    raise exception 'U1 : brouillon récent retiré attendu, vu %', v_status;
  end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000001';
  if v_status <> 'pending_payment' then
    raise exception 'U1 : commande en attente de l''annonce gardée intacte attendue, vu %', v_status;
  end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b1000000-0000-4000-8000-000000000001'
    and title = 'Annonce retirée' and body like '%seule annonce ouverte%Napoléon 20 Francs 1811%';
  if v_count <> 1 then
    raise exception 'U1 : vendeur prévenu du retrait attendu (% notification(s))', v_count;
  end if;
  -- Annonce publiée à 0 € retirée (prix plancher) : le brouillon valable de
  -- l'objet reste sa seule annonce ouverte (il n'est pas sacrifié pour elle).
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000009a';
  if v_status <> 'withdrawn' then
    raise exception 'U1 : annonce publiée à 0 € retirée attendue, vu %', v_status;
  end if;
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000009b';
  if v_status <> 'draft' then
    raise exception 'U1 : brouillon valable conservé attendu, vu %', v_status;
  end if;
  raise notice 'OK U1 — une annonce ouverte par objet : la plus engagée (et recevable) gardée, vendeur prévenu';
end
$$;

-- ── U2. Euro et prix plancher ────────────────────────────────────────────────
do $$
declare
  v_status text;
  v_count integer;
begin
  -- Non engagées : retirées, vendeur prévenu ; commande non payée annulée.
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-000000000002';
  if v_status <> 'withdrawn' then raise exception 'U2 : annonce à 0 € retirée attendue, vu %', v_status; end if;
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-000000000004';
  if v_status <> 'withdrawn' then raise exception 'U2 : annonce en USD retirée attendue, vu %', v_status; end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000002';
  if v_status <> 'cancelled' then raise exception 'U2 : commande à 0 € annulée attendue, vu %', v_status; end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b1000000-0000-4000-8000-000000000001' and title = 'Annonce retirée'
    and (body like '%Prix minimum%Jeton de présence%' or body like '%euro%Gros de Flandre%');
  if v_count <> 2 then raise exception 'U2 : vendeur prévenu des deux retraits attendu (%)', v_count; end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b2000000-0000-4000-8000-000000000002' and title = 'Commande annulée'
    and body like '%Jeton de présence%';
  if v_count <> 1 then raise exception 'U2 : acheteuse prévenue de l''annulation attendue (%)', v_count; end if;

  -- Engagées (paiement capturé) : conservées, la transaction se poursuit.
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-000000000003';
  if v_status <> 'active' then raise exception 'U2 : annonce USD engagée conservée attendue, vu %', v_status; end if;
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-000000000005';
  if v_status <> 'active' then raise exception 'U2 : annonce à 0,50 € engagée conservée attendue, vu %', v_status; end if;

  -- L'acheteuse annule ; les annonces redevenues libres ne sont ni exposées
  -- aux autres membres, ni achetables, ni ouvertes à l'échange.
  set local role authenticated;
  perform set_config('velum.uid', 'b2000000-0000-4000-8000-000000000002', true);
  perform public.advance_market_order('e1000000-0000-4000-8000-000000000003', 'cancelled');
  perform public.advance_market_order('e1000000-0000-4000-8000-000000000005', 'cancelled');
  perform set_config('velum.uid', 'b3000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.market_catalogue()
  where id in ('d1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000005');
  if v_count <> 0 then raise exception 'U2 : annonce hors euro ou sous le plancher au catalogue (%)', v_count; end if;
  select count(*) into v_count from public.market_listing('d1000000-0000-4000-8000-000000000003');
  if v_count <> 0 then raise exception 'U2 : annonce hors euro visible d''un tiers'; end if;
  select count(*) into v_count from public.market_listing('d1000000-0000-4000-8000-000000000005');
  if v_count <> 0 then raise exception 'U2 : annonce sous le plancher visible d''un tiers'; end if;
  perform public._upg_expect_error(
    $q$select * from public.market_buy('d1000000-0000-4000-8000-000000000003')$q$, '%euro%');
  perform public._upg_expect_error(
    $q$select * from public.market_buy('d1000000-0000-4000-8000-000000000005')$q$, '%minimum%');
  perform set_config('velum.uid', 'b1000000-0000-4000-8000-000000000001', true);
  update public.listings set kind = 'sale_or_exchange' where id = 'd1000000-0000-4000-8000-000000000003';
  perform set_config('velum.uid', 'b3000000-0000-4000-8000-000000000003', true);
  begin
    perform public.propose_exchange(
      'd1000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000001', 40);
    raise exception 'U2 : proposition d''échange sur une annonce en USD acceptée';
  exception when others then
    if sqlstate <> 'P0001' or sqlerrm not like '%euro%' then
      raise exception 'U2 : refus explicite (P0001, euro) attendu, vu % — %', sqlstate, sqlerrm;
    end if;
  end;
  raise notice 'OK U2 — euro et prix plancher : retraits prévenus, annonces épargnées jamais exposées ni achetables';
end
$$;

-- ── U3. Suivis en texte libre ────────────────────────────────────────────────
do $$
declare
  v_row record;
begin
  select carrier, tracking_number into v_row from public.orders where id = 'e1000000-0000-4000-8000-000000000006';
  if v_row.carrier is not null or v_row.tracking_number is not null then
    raise exception 'U3 : suivi libre d''une commande non expédiée effacé attendu (%)', row_to_json(v_row);
  end if;
  select carrier, tracking_number into v_row from public.orders where id = 'e1000000-0000-4000-8000-000000000007';
  if v_row.carrier is distinct from 'Colissimo' or v_row.tracking_number is distinct from '6A123456' then
    raise exception 'U3 : suivi conforme normalisé attendu (%)', row_to_json(v_row);
  end if;
  select carrier, tracking_number into v_row from public.orders where id = 'e1000000-0000-4000-8000-000000000008';
  if v_row.carrier is distinct from 'La Poste'
     or v_row.tracking_number is distinct from 'appelez-moi au [coordonnées masquées], merci' then
    raise exception 'U3 : suivi libre d''une commande expédiée masqué attendu (%)', row_to_json(v_row);
  end if;

  -- L'acheteuse ne lit plus de coordonnées ; le vendeur doit fournir un suivi conforme.
  set local role authenticated;
  perform set_config('velum.uid', 'b2000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.my_market_orders('e1000000-0000-4000-8000-000000000006');
  if v_row.carrier is not null or v_row.tracking_number is not null then
    raise exception 'U3 : coordonnées encore lisibles par l''acheteuse (%)', row_to_json(v_row);
  end if;
  perform set_config('velum.uid', 'b1000000-0000-4000-8000-000000000001', true);
  perform public._upg_expect_error(
    $q$select * from public.advance_market_order('e1000000-0000-4000-8000-000000000006', 'shipped')$q$,
    '%Transition de séquestre interdite%');
  select * into v_row from public.advance_market_order(
    'e1000000-0000-4000-8000-000000000006', 'shipped', 'chronopost', 'xy 123 456 789 fr');
  if v_row.escrow_state <> 'shipped' or v_row.carrier <> 'Chronopost' or v_row.tracking_number <> 'XY123456789FR' then
    raise exception 'U3 : expédition avec suivi conforme attendue (%)', row_to_json(v_row);
  end if;
  raise notice 'OK U3 — suivis 0006 : transporteur reconnu ou effacé, numéro normalisé, effacé ou masqué';
end
$$;

-- ── U4. Une seule commande en attente par acheteur et annonce ───────────────
do $$
declare
  v_status text;
  v_count integer;
begin
  select count(*) into v_count from public.orders
  where listing_id = 'd1000000-0000-4000-8000-00000000001a'
    and buyer_id = 'b2000000-0000-4000-8000-000000000002'
    and escrow_state = 'pending_payment';
  if v_count <> 1 then
    raise exception 'U4 : une seule commande en attente par acheteur et annonce attendue (%)', v_count;
  end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000011';
  if v_status <> 'cancelled' then
    raise exception 'U4 : doublon le plus ancien annulé attendu, vu %', v_status;
  end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000001';
  if v_status <> 'pending_payment' then
    raise exception 'U4 : commande la plus récente conservée attendue, vu %', v_status;
  end if;
  raise notice 'OK U4 — commandes en attente en double : la plus récente gardée, l''index unique se crée';
end
$$;

-- ── U5. Annonces épargnées (hors euro, sous le plancher) : jamais capturables ─
do $$
declare
  v_status text;
  v_count integer;
begin
  -- Commandes en attente d'un tiers sur ces annonces : annulées, tiers prévenu.
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000013';
  if v_status <> 'cancelled' then raise exception 'U5 : commande en USD annulée attendue, vu %', v_status; end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000014';
  if v_status <> 'cancelled' then raise exception 'U5 : commande à 0,50 € annulée attendue, vu %', v_status; end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b4000000-0000-4000-8000-000000000004' and title = 'Commande annulée'
    and (body like '%euro%Thaler de Bavière%' or body like '%minimum%Obole de Melle%');
  if v_count <> 2 then raise exception 'U5 : Dominique prévenu des deux annulations attendu (%)', v_count; end if;

  -- Défense en profondeur : une commande en attente qui aurait échappé au
  -- rattrapage (ligne reproduite telle quelle) ne se capture jamais, une fois
  -- l'annonce libérée (U2 : Bérénice a annulé).
  perform set_config('session_replication_role', 'replica', true);
  insert into public.orders (
    id, listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state)
  values
    ('e1000000-0000-4000-8000-000000000031', 'd1000000-0000-4000-8000-000000000003',
     'b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001',
     40, 'USD', 0.05, 'pending_payment'),
    ('e1000000-0000-4000-8000-000000000032', 'd1000000-0000-4000-8000-000000000005',
     'b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001',
     0.50, 'EUR', 0.05, 'pending_payment');
  perform set_config('session_replication_role', 'origin', true);
  set local role authenticated;
  perform set_config('velum.uid', 'b4000000-0000-4000-8000-000000000004', true);
  perform public._upg_expect_error(
    $q$select * from public.advance_market_order('e1000000-0000-4000-8000-000000000031', 'funds_held')$q$,
    '%euro%paiement impossible%');
  perform public._upg_expect_error(
    $q$select * from public.advance_market_order('e1000000-0000-4000-8000-000000000032', 'funds_held')$q$,
    '%minimum%paiement impossible%');
  raise notice 'OK U5 — annonces hors euro ou sous le plancher : commandes en attente annulées, capture refusée';
end
$$;

-- ── U8. Une commande en attente ne fait primer qu'une annonce PUBLIÉE ───────
do $$
declare
  v_status text;
  v_count integer;
begin
  -- Le brouillon portant une commande en attente (que le rattrapage annule de
  -- toute façon) ne l'emporte pas sur l'annonce publiée de l'objet.
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000010a';
  if v_status <> 'active' then
    raise exception 'U8 : annonce publiée sans commande conservée attendue, vu %', v_status;
  end if;
  select status into v_status from public.listings where id = 'd1000000-0000-4000-8000-00000000010b';
  if v_status <> 'withdrawn' then
    raise exception 'U8 : brouillon portant la commande retiré attendu, vu %', v_status;
  end if;
  select escrow_state into v_status from public.orders where id = 'e1000000-0000-4000-8000-000000000010';
  if v_status <> 'cancelled' then
    raise exception 'U8 : commande en attente du brouillon annulée attendue, vu %', v_status;
  end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b2000000-0000-4000-8000-000000000002' and title = 'Commande annulée'
    and body like '%Blanc à la couronne%n’est plus publiée%';
  if v_count <> 1 then raise exception 'U8 : acheteuse prévenue de l''annulation attendue (%)', v_count; end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b1000000-0000-4000-8000-000000000001' and title = 'Annonce retirée'
    and body like '%seule annonce ouverte%Blanc à la couronne%';
  if v_count <> 1 then raise exception 'U8 : vendeur prévenu du retrait du brouillon attendu (%)', v_count; end if;
  raise notice 'OK U8 — brouillon portant une commande en attente : l''annonce publiée de l''objet est gardée';
end
$$;

-- ── U9. Un seul paiement capturé par objet ───────────────────────────────────
do $$
declare
  v_row record;
  v_count integer;
begin
  -- Le paiement gardé (commande expédiée ou en litige, sinon le plus
  -- ancien) ; les autres paiements capturés de l'objet sont annulés
  -- (remboursement).
  for v_row in
    select o.id, o.escrow_state,
           case o.id
             when 'e1000000-0000-4000-8000-000000000021' then 'funds_held'
             when 'e1000000-0000-4000-8000-000000000022' then 'cancelled'
             when 'e1000000-0000-4000-8000-000000000023' then 'funds_held'
             when 'e1000000-0000-4000-8000-000000000024' then 'cancelled'
             when 'e1000000-0000-4000-8000-000000000025' then 'shipped'
             when 'e1000000-0000-4000-8000-000000000026' then 'cancelled'
           end as expected
    from public.orders o
    where o.id in (
      'e1000000-0000-4000-8000-000000000021', 'e1000000-0000-4000-8000-000000000022',
      'e1000000-0000-4000-8000-000000000023', 'e1000000-0000-4000-8000-000000000024',
      'e1000000-0000-4000-8000-000000000025', 'e1000000-0000-4000-8000-000000000026')
  loop
    if v_row.escrow_state <> v_row.expected then
      raise exception 'U9 : commande % : % attendu, vu %', v_row.id, v_row.expected, v_row.escrow_state;
    end if;
  end loop;
  select count(*) into v_count from public.notifications
  where owner_id = 'b3000000-0000-4000-8000-000000000003' and title = 'Commande annulée'
    and body like '%déjà été payé par un autre membre%remboursé%'
    and (body like '%Gros de Nesle%' or body like '%Double tournois%' or body like '%Franc à cheval%');
  if v_count <> 3 then raise exception 'U9 : acheteuse remboursée prévenue des trois annulations attendu (%)', v_count; end if;
  select count(*) into v_count from public.notifications
  where owner_id = 'b1000000-0000-4000-8000-000000000001' and title = 'Commande annulée'
    and body like '%ne se vend qu’une fois%seule la première vente se poursuit%'
    and (body like '%Gros de Nesle%' or body like '%Double tournois%' or body like '%Franc à cheval%');
  if v_count <> 3 then raise exception 'U9 : vendeur prévenu des trois annulations attendu (%)', v_count; end if;
  -- L'annonce gardée est celle du paiement restant.
  for v_row in
    select l.id, l.status,
           case l.id
             when 'd1000000-0000-4000-8000-00000000011a' then 'active'
             when 'd1000000-0000-4000-8000-00000000011b' then 'withdrawn'
             when 'd1000000-0000-4000-8000-000000000012' then 'active'
             when 'd1000000-0000-4000-8000-00000000013a' then 'active'
             when 'd1000000-0000-4000-8000-00000000013b' then 'withdrawn'
           end as expected
    from public.listings l
    where l.id in (
      'd1000000-0000-4000-8000-00000000011a', 'd1000000-0000-4000-8000-00000000011b',
      'd1000000-0000-4000-8000-000000000012',
      'd1000000-0000-4000-8000-00000000013a', 'd1000000-0000-4000-8000-00000000013b')
  loop
    if v_row.status <> v_row.expected then
      raise exception 'U9 : annonce % : % attendu, vu %', v_row.id, v_row.expected, v_row.status;
    end if;
  end loop;
  raise notice 'OK U9 — un seul paiement capturé par objet : les autres annulés (remboursement), acheteurs prévenus';
end
$$;

drop function public._upg_expect_error(text, text);

select 'LEGACY 0006 UPGRADE CHECKS PASSED' as result;
