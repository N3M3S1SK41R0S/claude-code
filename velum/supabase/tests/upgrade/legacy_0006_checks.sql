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
--      normalisés ; l'expédition exige alors un suivi conforme.
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

drop function public._upg_expect_error(text, text);

select 'LEGACY 0006 UPGRADE CHECKS PASSED' as result;
