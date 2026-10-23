-- ─────────────────────────────────────────────────────────────────────────────
-- Plateformes d'échange et de vente — tests de DURCISSEMENT (revue adversariale).
-- Rejouable sur base fraîche, indépendant des autres fichiers (utilisateurs
-- propres). Chaque bloc rejoue un contournement constaté et exige son refus :
--   X1  paiement : l'annonce est revalidée à la capture (statut, prix, nature) ;
--   X2  refus d'expert : annonce dépubliée, refus mémorisé sur l'objet ;
--   X2b refus (même volontaire) : toute transaction non expédiée sur l'objet
--       annulée, parties prévenues ; ni achat ni capture d'un objet refusé ;
--   X2c republication après refus : certification recalculée, pas de badge ;
--   X3  une seule annonce ouverte par objet ;
--   X4  objet cédé (vente ou échange conclu) : plus de remise en vente ;
--   X5  certification liée au CONTENU certifié (titre, catégorie),
--       recalculée à la republication ;
--   X6  suivi et transporteur : vendeur seul, à l'expédition, format contrôlé ;
--       expédition SANS date de livraison (posée par l'acheteur / le transporteur) ;
--   X7  litiges : écriture via la RPC uniquement ;
--   X8  devise : euro uniquement ;
--   X9  seuil : max des estimations VELUM récentes (à défaut, la dernière
--       estimation passée), dates futures ignorées ;
--   X10 prix plancher et paliers de commission (commandes libérées réelles) ;
--   X11 date de publication posée par le serveur ;
--   X12 annonce certifiée : suppression interdite (historique d'expertise) ;
--   X13 fin d'abonnement Platine : annonces retirées, actions refusées ;
--   X14 market_listing() : annonce par identifiant, anonymisée, hors catalogue ;
--   X16 expédition du vendeur avec date de livraison : P0001 ; sans date, elle passe.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

create or replace function public._mkh_expect_error(p_sql text, p_like text)
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
grant execute on function public._mkh_expect_error(text, text) to authenticated;

-- ── 0. Jeu de données ────────────────────────────────────────────────────────
-- Alice (vendeuse), Bruno (acheteur), Chloé (tiers), Denis (rétrogradé) :
-- Platine ; Fanny : gratuit.
insert into auth.users (id, email, raw_user_meta_data) values
  ('81000000-0000-4000-8000-000000000001', 'alice@harden.test', '{"display_name":"Alice"}'),
  ('82000000-0000-4000-8000-000000000002', 'bruno@harden.test', '{"display_name":"Bruno"}'),
  ('83000000-0000-4000-8000-000000000003', 'chloe@harden.test', '{"display_name":"Chloé"}'),
  ('84000000-0000-4000-8000-000000000004', 'fanny@harden.test', '{"display_name":"Fanny"}'),
  ('85000000-0000-4000-8000-000000000005', 'denis@harden.test', '{"display_name":"Denis"}');

update public.profiles set plan = 'platine' where id in (
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000003',
  '85000000-0000-4000-8000-000000000005');

insert into public.items (id, owner_id, domain, title) values
  ('91000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'coin', 'Écu Louis XVI 1784'),
  ('91000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'art', 'Médaille Lalique'),
  ('91000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000001', 'coin', '5 Francs Hercule 1873'),
  ('91000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000001', 'art', 'Vase Daum'),
  ('91000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', 'coin', 'Napoléon 20 Francs 1811'),
  ('91000000-0000-4000-8000-000000000006', '81000000-0000-4000-8000-000000000001', 'coin', 'Sou Louis XV 1770'),
  ('91000000-0000-4000-8000-000000000007', '81000000-0000-4000-8000-000000000001', 'coin', '10 Francs Coq 1907'),
  ('91000000-0000-4000-8000-000000000008', '81000000-0000-4000-8000-000000000001', 'watch', 'Montre Lip Nautic'),
  ('91000000-0000-4000-8000-000000000009', '81000000-0000-4000-8000-000000000001', 'stamp', 'Cérès 40 c orange'),
  ('91000000-0000-4000-8000-000000000010', '81000000-0000-4000-8000-000000000001', 'coin', 'Thaler 1765'),
  ('91000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000001', 'art', 'Vase Gallé aux libellules'),
  ('91000000-0000-4000-8000-000000000012', '81000000-0000-4000-8000-000000000001', 'art', 'Pâte de verre Argy-Rousseau'),
  ('91000000-0000-4000-8000-000000000013', '81000000-0000-4000-8000-000000000001', 'art', 'Bronze de Barye'),
  ('91000000-0000-4000-8000-000000000014', '81000000-0000-4000-8000-000000000001', 'stamp', 'Marianne d''Alger'),
  ('91000000-0000-4000-8000-000000000015', '81000000-0000-4000-8000-000000000001', 'stamp', 'Sabine de Gandon'),
  ('92000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 'coin', 'Écu Henri IV'),
  ('92000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', 'coin', 'Franc à cheval'),
  ('93000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 'coin', 'Thaler Marie-Thérèse'),
  ('93000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000003', 'coin', 'Louis d''or 1720'),
  ('95000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000005', 'stamp', 'Bloc Philexfrance'),
  ('95000000-0000-4000-8000-000000000002', '85000000-0000-4000-8000-000000000005', 'stamp', 'Paire de Semeuses'),
  ('95000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000005', 'coin', 'Piastre indochinoise'),
  ('95000000-0000-4000-8000-000000000004', '85000000-0000-4000-8000-000000000005', 'coin', 'Douzain de Charles IX'),
  ('95000000-0000-4000-8000-000000000005', '85000000-0000-4000-8000-000000000005', 'coin', 'Liard de France');

-- ── X1. Paiement : l'annonce est revalidée à la capture ─────────────────────
do $$
declare
  v_order uuid;
  v_state text;
  v_status text;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
     '81000000-0000-4000-8000-000000000001', 400),
    ('a1000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002',
     '81000000-0000-4000-8000-000000000001', 100);

  -- Commande non payée, puis estimation VELUM (service) à 2 000 € : l'annonce
  -- est suspendue ET la commande non payée tombe (jamais de paiement sans
  -- certification).
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a1000000-0000-4000-8000-000000000001');
  reset role;
  perform set_config('velum.uid', '', true);
  insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources)
  values ('91000000-0000-4000-8000-000000000001', 2000, 1800, 2200, 1700, 2300, 70, '[]');
  select status into v_status from public.listings where id = 'a1000000-0000-4000-8000-000000000001';
  if v_status <> 'pending_certification' then
    raise exception 'X1 : estimation 2 000 € ⇒ pending_certification attendu, vu %', v_status;
  end if;
  select escrow_state into v_state from public.orders where id = v_order;
  if v_state <> 'cancelled' then
    raise exception 'X1 : annonce suspendue ⇒ commande non payée annulée attendue, vu %', v_state;
  end if;
  set local role authenticated;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''funds_held'')', v_order),
    '%Transition de séquestre interdite%');

  -- Hausse de prix pendant l'attente du paiement : commande annulée.
  select id into v_order from public.market_buy('a1000000-0000-4000-8000-000000000002');
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set ask_price = 150 where id = 'a1000000-0000-4000-8000-000000000002';
  reset role;
  select escrow_state into v_state from public.orders where id = v_order;
  if v_state <> 'cancelled' then
    raise exception 'X1 : prix modifié ⇒ commande non payée annulée attendue, vu %', v_state;
  end if;
  set local role authenticated;

  -- Passage à l'échange seul : commande non payée annulée.
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a1000000-0000-4000-8000-000000000002');
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set kind = 'exchange' where id = 'a1000000-0000-4000-8000-000000000002';
  reset role;
  select escrow_state into v_state from public.orders where id = v_order;
  if v_state <> 'cancelled' then
    raise exception 'X1 : annonce passée à l''échange ⇒ commande annulée attendue, vu %', v_state;
  end if;

  -- Garde de la capture elle-même : annonce modifiée sans effet de bord
  -- (triggers neutralisés) ⇒ la capture est refusée.
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set kind = 'sale' where id = 'a1000000-0000-4000-8000-000000000002';
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a1000000-0000-4000-8000-000000000002');
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set ask_price = 999 where id = 'a1000000-0000-4000-8000-000000000002';
  perform set_config('session_replication_role', 'origin', true);
  set local role authenticated;
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''funds_held'')', v_order),
    '%Annonce modifiée ou suspendue%');
  raise notice 'OK X1 — capture revalidée : statut, prix et nature de l''annonce ; commandes non payées annulées';
end
$$;

-- ── X2. Refus d'expert : annonce dépubliée, refus mémorisé ─────────────────
do $$
declare
  v_order uuid;
  v_cert uuid;
  v_state text;
  v_status text;
  v_required boolean;
  v_count integer;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a2000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003',
     '81000000-0000-4000-8000-000000000001', 120),
    ('a2000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000004',
     '81000000-0000-4000-8000-000000000001', 300);
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  insert into public.listings (id, item_id, seller_id, ask_price, kind) values
    ('a2000000-0000-4000-8000-000000000005', '93000000-0000-4000-8000-000000000001',
     '83000000-0000-4000-8000-000000000003', 250, 'exchange');

  -- Commande : accord mutuel, paiement, refus de l'expert.
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a2000000-0000-4000-8000-000000000003');
  select c.id into v_cert from public.request_certification('mutual_agreement', p_order => v_order) c;
  perform public.advance_market_order(v_order, 'funds_held');
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public.respond_certification(v_cert, true);
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, false, null, 'Faux : refrappe moderne', 80);
  select escrow_state into v_state from public.orders where id = v_order;
  select status into v_status from public.listings where id = 'a2000000-0000-4000-8000-000000000003';
  if v_state <> 'cancelled' or v_status <> 'draft' then
    raise exception 'X2 : refus ⇒ commande annulée et annonce en brouillon attendues (% / %)', v_state, v_status;
  end if;

  -- L'objet jugé faux n'est plus au catalogue ni achetable.
  set local role authenticated;
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.market_catalogue()
  where id = 'a2000000-0000-4000-8000-000000000003';
  if v_count <> 0 then raise exception 'X2 : objet refusé encore au catalogue'; end if;
  perform public._mkh_expect_error(
    $q$select * from public.market_buy('a2000000-0000-4000-8000-000000000003')$q$, '%non disponible%');

  -- Refus mémorisé : republier sous le seuil exige une nouvelle certification.
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'active' where id = 'a2000000-0000-4000-8000-000000000003';
  select status, expert_appraisal_required into v_status, v_required
  from public.listings where id = 'a2000000-0000-4000-8000-000000000003';
  if v_status <> 'pending_certification' or not v_required then
    raise exception 'X2 : republication après refus ⇒ pending_certification attendu (% / %)', v_status, v_required;
  end if;
  select c.id into v_cert from public.my_certifications() c
  where c.listing_id = 'a2000000-0000-4000-8000-000000000003' and c.status = 'requested';
  perform public.cancel_certification(v_cert);

  -- Certification volontaire refusée sur une annonce publiée : dépubliée.
  select c.id into v_cert
  from public.request_certification('voluntary', p_listing => 'a2000000-0000-4000-8000-000000000004') c;
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, false, null, 'Copie moderne');
  select status into v_status from public.listings where id = 'a2000000-0000-4000-8000-000000000004';
  if v_status <> 'draft' then
    raise exception 'X2 : refus volontaire ⇒ annonce en brouillon attendue, vu %', v_status;
  end if;

  -- L'objet refusé ne se propose pas non plus à l'échange.
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$select * from public.propose_exchange('a2000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000004', 250)$q$,
    '%refusé par un expert%');
  raise notice 'OK X2 — refus d''expert : annonce dépubliée quel que soit le contexte, refus mémorisé sur l''objet';
end
$$;

-- ── X2b. Refus VOLONTAIRE pendant une transaction en cours ──────────────────
-- La demande ne porte que sur l'annonce, mais le refus annule toute
-- transaction NON EXPÉDIÉE sur l'objet : commande payée (acheteur prévenu),
-- échange accepté (les deux parties prévenues) ; l'annonce repasse en
-- brouillon. Défense en profondeur : ni achat ni capture d'un objet refusé.
insert into public.items (id, owner_id, domain, title) values
  ('91000000-0000-4000-8000-000000000018', '81000000-0000-4000-8000-000000000001', 'coin', 'Denier carolingien'),
  ('91000000-0000-4000-8000-000000000019', '81000000-0000-4000-8000-000000000001', 'art', 'Statuette Chiparus'),
  ('91000000-0000-4000-8000-000000000020', '81000000-0000-4000-8000-000000000001', 'art', 'Bronze animalier'),
  ('93000000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000003', 'coin', 'Teston Henri II');

do $$
declare
  v_order uuid;
  v_cert uuid;
  v_ex uuid;
  v_state text;
  v_status text;
  v_count integer;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price, kind) values
    ('a2b00000-0000-4000-8000-000000000018', '91000000-0000-4000-8000-000000000018',
     '81000000-0000-4000-8000-000000000001', 100, 'sale'),
    ('a2b00000-0000-4000-8000-000000000019', '91000000-0000-4000-8000-000000000019',
     '81000000-0000-4000-8000-000000000001', 200, 'sale_or_exchange');
  select c.id into v_cert
  from public.request_certification('voluntary', p_listing => 'a2b00000-0000-4000-8000-000000000018') c;

  -- Commande payée pendant l'expertise volontaire, puis refus : annulée.
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a2b00000-0000-4000-8000-000000000018');
  perform public.advance_market_order(v_order, 'funds_held');
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, false, null, 'Refrappe moderne');
  select escrow_state into v_state from public.orders where id = v_order;
  select status into v_status from public.listings where id = 'a2b00000-0000-4000-8000-000000000018';
  if v_state <> 'cancelled' or v_status <> 'draft' then
    raise exception 'X2b : refus volontaire ⇒ commande payée annulée et annonce en brouillon attendues (% / %)',
      v_state, v_status;
  end if;
  select count(*) into v_count from public.notifications
  where owner_id = '82000000-0000-4000-8000-000000000002'
    and title = 'Commande annulée' and body like '%Denier carolingien%';
  if v_count <> 1 then
    raise exception 'X2b : acheteur prévenu de l''annulation attendu (% notification(s))', v_count;
  end if;
  set local role authenticated;
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.market_catalogue()
  where id = 'a2b00000-0000-4000-8000-000000000018';
  if v_count <> 0 then raise exception 'X2b : objet refusé encore au catalogue'; end if;

  -- Défense en profondeur : annonce republiée et commande remise en attente
  -- de paiement sans effet de bord (triggers neutralisés) ⇒ ni achat ni capture.
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set status = 'active' where id = 'a2b00000-0000-4000-8000-000000000018';
  update public.orders set escrow_state = 'pending_payment' where id = v_order;
  perform set_config('session_replication_role', 'origin', true);
  set local role authenticated;
  perform public._mkh_expect_error(
    $q$select * from public.market_buy('a2b00000-0000-4000-8000-000000000018')$q$, '%refusé par un expert%');
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''funds_held'')', v_order), '%refusé par un expert%');
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set status = 'draft' where id = 'a2b00000-0000-4000-8000-000000000018';
  update public.orders set escrow_state = 'cancelled' where id = v_order;
  perform set_config('session_replication_role', 'origin', true);

  -- Échange accepté (phase d'expédition, rien d'expédié), puis refus de
  -- l'expertise volontaire de l'annonce visée : échange annulé.
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  select c.id into v_cert
  from public.request_certification('voluntary', p_listing => 'a2b00000-0000-4000-8000-000000000019') c;
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select id into v_ex from public.propose_exchange(
    'a2b00000-0000-4000-8000-000000000019', '93000000-0000-4000-8000-000000000003', 180);
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public.respond_exchange(v_ex, true);
  reset role;
  perform set_config('velum.uid', '', true);
  select state into v_state from public.exchange_proposals where id = v_ex;
  if v_state <> 'shipping' then
    raise exception 'X2b : échange accepté en phase d''expédition attendu, vu %', v_state;
  end if;
  perform public.decide_certification(v_cert, false, null, 'Fonte posthume');
  select state into v_state from public.exchange_proposals where id = v_ex;
  select status into v_status from public.listings where id = 'a2b00000-0000-4000-8000-000000000019';
  if v_state <> 'cancelled' or v_status <> 'draft' then
    raise exception 'X2b : refus volontaire ⇒ échange non expédié annulé et annonce en brouillon attendus (% / %)',
      v_state, v_status;
  end if;
  select count(*) into v_count from public.notifications
  where owner_id in ('81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003')
    and title = 'Échange annulé' and body like '%Statuette Chiparus%';
  if v_count <> 2 then
    raise exception 'X2b : les deux parties prévenues de l''annulation attendues (% notification(s))', v_count;
  end if;
  raise notice 'OK X2b — refus volontaire : commande payée et échange non expédié annulés, parties prévenues, objet ni vendable ni payable';
end
$$;

-- ── X2c. Republication après un refus : la certification est RECALCULÉE ────
-- Trois transactions (horodatages de décision distincts). L1 est certifiée,
-- puis retirée ; l'objet renommé est refusé sur L2 ; enfin l'objet reprend
-- son titre certifié. La dernière décision est un refus : ni retirée →
-- publiée, ni retirée → brouillon → publiée ne ressuscite le badge, même si
-- une référence subsistait sur L1 (donnée antérieure au correctif).
do $$
declare
  v_cert uuid;
  v_status text;
  v_ref text;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a2c00000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000020',
     '81000000-0000-4000-8000-000000000001', 800);
  reset role;
  perform set_config('velum.uid', '', true);
  select id into v_cert from public.certification_requests
  where listing_id = 'a2c00000-0000-4000-8000-000000000001' and status = 'requested';
  perform public.decide_certification(v_cert, true, 'expertises/alice/bronze-r1.pdf', 'Authentique');
  select status, expert_appraisal_ref into v_status, v_ref
  from public.listings where id = 'a2c00000-0000-4000-8000-000000000001';
  if v_status <> 'active' or v_ref is null then
    raise exception 'X2c : L1 certifiée et publiée attendue (% / %)', v_status, v_ref;
  end if;
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'withdrawn' where id = 'a2c00000-0000-4000-8000-000000000001';
end
$$;

do $$
declare
  v_cert uuid;
  v_status text;
  v_ref text;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.items set title = 'Bronze animalier de Barye'
  where id = '91000000-0000-4000-8000-000000000020';
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a2c00000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000020',
     '81000000-0000-4000-8000-000000000001', 800)
  returning status into v_status;
  if v_status <> 'pending_certification' then
    raise exception 'X2c : objet renommé ⇒ L2 en attente de certification attendue, vu %', v_status;
  end if;
  reset role;
  perform set_config('velum.uid', '', true);
  select id into v_cert from public.certification_requests
  where listing_id = 'a2c00000-0000-4000-8000-000000000002' and status = 'requested';
  perform public.decide_certification(v_cert, false, null, 'Surmoulage');
  select status into v_status from public.listings where id = 'a2c00000-0000-4000-8000-000000000002';
  select expert_appraisal_ref into v_ref from public.listings where id = 'a2c00000-0000-4000-8000-000000000001';
  if v_status <> 'draft' or v_ref is not null then
    raise exception 'X2c : refus ⇒ L2 en brouillon et référence effacée de L1 retirée attendus (% / %)',
      v_status, v_ref;
  end if;
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'withdrawn' where id = 'a2c00000-0000-4000-8000-000000000002';
end
$$;

do $$
declare
  v_status text;
  v_ref text;
  v_count integer;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.items set title = 'Bronze animalier' where id = '91000000-0000-4000-8000-000000000020';
  -- Référence résiduelle simulée sur L1 (triggers neutralisés).
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set expert_appraisal_ref = 'expertises/alice/bronze-r1.pdf'
  where id = 'a2c00000-0000-4000-8000-000000000001';
  perform set_config('session_replication_role', 'origin', true);

  -- Retirée → publiée : référence recalculée (dernière décision = refus).
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'active' where id = 'a2c00000-0000-4000-8000-000000000001'
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'pending_certification' or v_ref is not null then
    raise exception 'X2c : retirée → publiée après refus ⇒ pending_certification sans badge attendu (% / %)',
      v_status, v_ref;
  end if;
  update public.listings set status = 'withdrawn' where id = 'a2c00000-0000-4000-8000-000000000001';

  -- Retirée → brouillon (référence résiduelle de nouveau), puis brouillon → publiée.
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set expert_appraisal_ref = 'expertises/alice/bronze-r1.pdf'
  where id = 'a2c00000-0000-4000-8000-000000000001';
  perform set_config('session_replication_role', 'origin', true);
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'draft' where id = 'a2c00000-0000-4000-8000-000000000001'
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'draft' or v_ref is not null then
    raise exception 'X2c : retirée → brouillon après refus ⇒ référence recalculée attendue (% / %)', v_status, v_ref;
  end if;
  update public.listings set status = 'active' where id = 'a2c00000-0000-4000-8000-000000000001'
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'pending_certification' or v_ref is not null then
    raise exception 'X2c : brouillon → publiée après refus ⇒ pending_certification sans badge attendu (% / %)',
      v_status, v_ref;
  end if;
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.market_catalogue(p_certified_only => true) c
  where c.title like 'Bronze animalier%';
  if v_count <> 0 then raise exception 'X2c : objet refusé présenté comme certifié'; end if;
  raise notice 'OK X2c — republication après refus : référence recalculée, ni badge ni publication sans nouvelle certification';
end
$$;

-- ── X3. Une seule annonce ouverte par objet ─────────────────────────────────
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from pg_indexes
  where schemaname = 'public' and indexname = 'listings_one_open_per_item_idx';
  if v_count <> 1 then raise exception 'X3 : index d''unicité des annonces ouvertes absent'; end if;

  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a3000000-0000-4000-8000-000000000006', '91000000-0000-4000-8000-000000000005',
     '81000000-0000-4000-8000-000000000001', 200);
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, kind)
       values ('91000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', 210, 'sale_or_exchange')$q$,
    '%déjà une annonce ouverte%');
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, status)
       values ('91000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', 210, 'draft')$q$,
    '%déjà une annonce ouverte%');
  -- Une fois l'annonce retirée, l'objet se réannonce.
  update public.listings set status = 'withdrawn' where id = 'a3000000-0000-4000-8000-000000000006';
  insert into public.listings (id, item_id, seller_id, ask_price, kind) values
    ('a3000000-0000-4000-8000-000000000007', '91000000-0000-4000-8000-000000000005',
     '81000000-0000-4000-8000-000000000001', 210, 'sale_or_exchange');
  -- …mais l'ancienne ne se republie pas à côté de la nouvelle.
  perform public._mkh_expect_error(
    $q$update public.listings set status = 'active' where id = 'a3000000-0000-4000-8000-000000000006'$q$,
    '%déjà une annonce ouverte%');

  -- Dernier recours (écritures concurrentes, code serveur) : l'index unique.
  reset role;
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('91000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', 10)$q$,
    '23505');
  raise notice 'OK X3 — une seule annonce ouverte par objet (trigger + index unique)';
end
$$;

-- ── X4. Objet cédé : plus de remise en vente ni d'offre d'échange ───────────
do $$
declare
  v_order uuid;
  v_ex uuid;
  v_row record;
  v_status text;
begin
  set local role authenticated;
  -- Vente conclue du Sou Louis XV.
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a4000000-0000-4000-8000-000000000008', '91000000-0000-4000-8000-000000000006',
     '81000000-0000-4000-8000-000000000001', 50);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a4000000-0000-4000-8000-000000000008');
  perform public.advance_market_order(v_order, 'funds_held');
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  -- Expédition : transporteur et suivi normalisés, AUCUNE date de livraison.
  select * into v_row from public.advance_market_order(v_order, 'shipped', 'colissimo', ' 6a 1234 5678 901 ');
  if v_row.escrow_state <> 'shipped' or v_row.carrier <> 'Colissimo'
     or v_row.tracking_number <> '6A12345678901' or v_row.delivered_at is not null then
    raise exception 'X4 : expédition normalisée sans livraison attendue (%)', row_to_json(v_row);
  end if;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public.advance_market_order(v_order, 'released');

  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('91000000-0000-4000-8000-000000000006', '81000000-0000-4000-8000-000000000001', 60)$q$,
    '%déjà cédé%');
  perform public._mkh_expect_error(
    $q$select * from public.propose_exchange('a2000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000006', 50)$q$,
    '%déjà cédé%');

  -- Échange conclu : Bruno cède l'Écu Henri IV (déjà en vente), Chloé son Thaler.
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a4000000-0000-4000-8000-000000000009', '92000000-0000-4000-8000-000000000001',
     '82000000-0000-4000-8000-000000000002', 240);
  select id into v_ex from public.propose_exchange(
    'a2000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000001', 240);
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  perform public.respond_exchange(v_ex, true);

  -- Suivi d'échange : format contrôlé, transporteur reconnu uniquement.
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    format('select * from public.ship_exchange(%L, ''alice.martin@gmail.com'')', v_ex), '%suivi invalide%');
  perform public._mkh_expect_error(
    format('select * from public.ship_exchange(%L, ''PA-11'', ''Bob : bob@yahoo.fr'')', v_ex), '%Transporteur non reconnu%');
  perform public.ship_exchange(v_ex, 'pa-11', 'mondial relay');
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  perform public.ship_exchange(v_ex, 'CH-11');
  perform public.confirm_exchange_receipt(v_ex);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.confirm_exchange_receipt(v_ex);
  if v_row.state <> 'completed' or v_row.proposer_tracking <> 'PA-11' then
    raise exception 'X4 : échange conclu attendu (%)', row_to_json(v_row);
  end if;
  reset role;
  if (select proposer_carrier from public.exchange_proposals where id = v_ex) <> 'Mondial Relay' then
    raise exception 'X4 : transporteur d''échange non normalisé';
  end if;
  select status into v_status from public.listings where id = 'a4000000-0000-4000-8000-000000000009';
  if v_status <> 'withdrawn' then raise exception 'X4 : annonce de l''objet cédé retirée attendue, vu %', v_status; end if;

  set local role authenticated;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    $q$update public.listings set status = 'active' where id = 'a4000000-0000-4000-8000-000000000009'$q$,
    '%déjà cédé%');
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('92000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 240)$q$,
    '%déjà cédé%');
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('93000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 250)$q$,
    '%déjà cédé%');
  raise notice 'OK X4 — objet cédé (vente ou échange) : ni republication, ni nouvelle annonce, ni offre d''échange';
end
$$;

-- ── X5. Certification liée au contenu certifié ──────────────────────────────
insert into public.items (id, owner_id, domain, title) values
  ('91000000-0000-4000-8000-000000000021', '81000000-0000-4000-8000-000000000001', 'art', 'Pendule Empire');

do $$
declare
  v_cert uuid;
  v_status text;
  v_ref text;
  v_count integer;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a5000000-0000-4000-8000-000000000010', '91000000-0000-4000-8000-000000000007',
     '81000000-0000-4000-8000-000000000001', 600);
  reset role;
  perform set_config('velum.uid', '', true);
  select id into v_cert from public.certification_requests
  where listing_id = 'a5000000-0000-4000-8000-000000000010' and status = 'requested';
  perform public.assign_certification_expert(v_cert, 45);
  perform public.decide_certification(v_cert, true, 'expertises/alice/coq-1907.pdf', 'Authentique');

  -- Objet inchangé : la certification suit l'objet (réannonce certifiée).
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'withdrawn' where id = 'a5000000-0000-4000-8000-000000000010';
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a5000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000007',
     '81000000-0000-4000-8000-000000000001', 650)
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'active' or v_ref is distinct from 'expertises/alice/coq-1907.pdf' then
    raise exception 'X5 : objet inchangé ⇒ certification réutilisée attendue (% / %)', v_status, v_ref;
  end if;
  update public.listings set status = 'withdrawn' where id = 'a5000000-0000-4000-8000-000000000011';

  -- Objet renommé : plus de badge hérité, seuil de nouveau exigé.
  update public.items set title = 'Rolex Daytona Paul Newman 6239', domain = 'watch'
  where id = '91000000-0000-4000-8000-000000000007';
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a5000000-0000-4000-8000-000000000012', '91000000-0000-4000-8000-000000000007',
     '81000000-0000-4000-8000-000000000001', 95000)
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'pending_certification' or v_ref is not null then
    raise exception 'X5 : objet modifié ⇒ pending_certification sans badge attendu (% / %)', v_status, v_ref;
  end if;
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.market_catalogue(p_certified_only => true) c
  where c.title like 'Rolex%';
  if v_count <> 0 then raise exception 'X5 : objet renommé présenté comme certifié'; end if;

  -- Annonce certifiée passée en brouillon, objet renommé : la republication
  -- recalcule la référence (plus de badge hérité, seuil de nouveau exigé).
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a5000000-0000-4000-8000-000000000021', '91000000-0000-4000-8000-000000000021',
     '81000000-0000-4000-8000-000000000001', 700);
  reset role;
  perform set_config('velum.uid', '', true);
  select id into v_cert from public.certification_requests
  where listing_id = 'a5000000-0000-4000-8000-000000000021' and status = 'requested';
  perform public.decide_certification(v_cert, true, 'expertises/alice/pendule.pdf', 'Authentique');
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'draft' where id = 'a5000000-0000-4000-8000-000000000021';
  update public.items set title = 'Pendule Empire de Thomire'
  where id = '91000000-0000-4000-8000-000000000021';
  update public.listings set status = 'active' where id = 'a5000000-0000-4000-8000-000000000021'
  returning status, expert_appraisal_ref into v_status, v_ref;
  if v_status <> 'pending_certification' or v_ref is not null then
    raise exception 'X5 : brouillon → publiée d''un objet renommé ⇒ pending_certification sans badge attendu (% / %)',
      v_status, v_ref;
  end if;
  raise notice 'OK X5 — certification liée au contenu certifié (titre, catégorie), recalculée à la republication';
end
$$;

-- ── X6. Suivi et transporteur : vendeur seul, à l'expédition, format contrôlé ─
do $$
declare
  v_order uuid;
  v_row record;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a6000000-0000-4000-8000-000000000013', '91000000-0000-4000-8000-000000000008',
     '81000000-0000-4000-8000-000000000001', 150);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a6000000-0000-4000-8000-000000000013');

  -- Avant expédition : aucun suivi écrit (canal de coordonnées).
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    format($q$update public.orders set carrier = 'Alice Martin, alice.martin@gmail.com',
              tracking_number = 'Appelle-moi 06 12 34 56 78' where id = %L$q$, v_order),
    '%vendeur, à l''expédition%');
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public.advance_market_order(v_order, 'funds_held');

  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''shipped'', ''Alice Martin, alice.martin@gmail.com'', ''6A12345678901'')', v_order),
    '%Transporteur non reconnu%');
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''shipped'', ''Colissimo'', ''alice.martin@gmail.com'')', v_order),
    '%suivi invalide%');
  -- Le vendeur n'atteste jamais la livraison, même à l'expédition.
  perform public._mkh_expect_error(
    format('select * from public.advance_market_order(%L, ''shipped'', ''Colissimo'', ''6A12345678901'', now())', v_order),
    '%atteste la livraison%');
  select * into v_row from public.advance_market_order(v_order, 'shipped', 'Chronopost', 'XY123456789FR');
  if v_row.escrow_state <> 'shipped' or v_row.delivered_at is not null or v_row.carrier <> 'Chronopost' then
    raise exception 'X6 : expédition sans date de livraison attendue (%)', row_to_json(v_row);
  end if;
  -- Suivi figé après l'expédition, pour le vendeur comme pour l'acheteur.
  perform public._mkh_expect_error(
    format('update public.orders set tracking_number = ''ZZ999'' where id = %L', v_order),
    '%vendeur, à l''expédition%');
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    format($q$update public.orders set carrier = 'Colissimo', tracking_number = 'XXXX-1' where id = %L$q$, v_order),
    '%vendeur, à l''expédition%');
  -- L'acheteur atteste la réception (date de livraison), puis libère.
  select * into v_row from public.advance_market_order(v_order, 'shipped', null, null, now());
  if v_row.delivered_at is null or v_row.tracking_number <> 'XY123456789FR' then
    raise exception 'X6 : livraison attestée par l''acheteur attendue (%)', row_to_json(v_row);
  end if;
  perform public.advance_market_order(v_order, 'released');
  raise notice 'OK X6 — suivi : vendeur seul, à l''expédition, format contrôlé ; expédition sans date de livraison';
end
$$;

-- ── X7. Litiges : écriture via la RPC uniquement ─────────────────────────────
do $$
declare
  v_order uuid;
  v_row record;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a7000000-0000-4000-8000-000000000014', '91000000-0000-4000-8000-000000000009',
     '81000000-0000-4000-8000-000000000001', 80);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a7000000-0000-4000-8000-000000000014');
  perform public.advance_market_order(v_order, 'funds_held');

  -- Litige « déjà arbitré » forgé en direct : refusé.
  perform public._mkh_expect_error(
    format($q$insert into public.disputes (order_id, opened_by, reason, status, resolution_note, resolved_at)
              values (%L, '82000000-0000-4000-8000-000000000002', 'x', 'resolved_refund',
                      'Arbitrage VELUM : contactez-moi bob.durand@gmail.com', now())$q$, v_order),
    '42501');
  select * into v_row from public.open_order_dispute(v_order, 'Colis vide — écrivez à bob.durand@gmail.com');
  if v_row.status <> 'open' or v_row.resolution_note is not null or v_row.resolved_at is not null
     or v_row.reason <> 'Colis vide — écrivez à [coordonnées masquées]' then
    raise exception 'X7 : litige ouvert par la RPC incorrect (%)', row_to_json(v_row);
  end if;
  perform public._mkh_expect_error(
    format('update public.disputes set status = ''resolved_refund'' where order_id = %L', v_order), '42501');
  perform public._mkh_expect_error(
    format('delete from public.disputes where order_id = %L', v_order), '42501');
  raise notice 'OK X7 — litiges : écriture via open_order_dispute uniquement';
end
$$;

-- ── X8. Devise : euro uniquement ─────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from pg_constraint where conname = 'exchange_proposals_currency_eur';
  if v_count <> 1 then raise exception 'X8 : contrainte de devise des échanges absente'; end if;

  -- Annonces historiques (0006) dans une autre devise (simulées, triggers
  -- neutralisés) : ni republiables, ni achetables.
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set currency = 'USD'
  where id in ('a3000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000007');
  perform set_config('session_replication_role', 'origin', true);
  set local role authenticated;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  perform public._mkh_expect_error(
    $q$select * from public.market_buy('a3000000-0000-4000-8000-000000000007')$q$, '%euro%');
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$update public.listings set status = 'active' where id = 'a3000000-0000-4000-8000-000000000006'$q$,
    '%euro%');
  reset role;
  perform set_config('session_replication_role', 'replica', true);
  update public.listings set currency = 'EUR'
  where id in ('a3000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000007');
  perform set_config('session_replication_role', 'origin', true);

  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, currency)
       values ('91000000-0000-4000-8000-000000000010', '81000000-0000-4000-8000-000000000001', 450, 'BTC')$q$,
    '%euro%');
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, currency)
       values ('91000000-0000-4000-8000-000000000010', '81000000-0000-4000-8000-000000000001', 45,
               'EUR — écrivez à alice.martin@gmail.com')$q$,
    '%euro%');
  perform public._mkh_expect_error(
    $q$update public.listings set currency = 'USD' where id = 'a3000000-0000-4000-8000-000000000007'$q$,
    '%euro%');
  raise notice 'OK X8 — devise : euro uniquement (annonces, commandes, échanges)';
end
$$;

-- ── X9. Seuil : max des estimations VELUM récentes, dates futures ignorées ───
-- Écritures « service » (valuate / price-cron) : une estimation basse
-- postérieure (candidat trompeur) ne masque pas l'estimation haute récente ;
-- sans estimation dans la fenêtre de 18 mois, la DERNIÈRE estimation passée
-- compte (quel que soit son âge) ; une estimation récente dans la fenêtre
-- l'emporte sur une ancienne.
insert into public.items (id, owner_id, domain, title) values
  ('91000000-0000-4000-8000-000000000017', '81000000-0000-4000-8000-000000000001', 'art', 'Plaque Lalique aux moineaux');
insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources, valued_at) values
  ('91000000-0000-4000-8000-000000000011', 5000, 4500, 5500, 4000, 6000, 70, '[]', now() - interval '2 days'),
  ('91000000-0000-4000-8000-000000000011', 100, 90, 110, 80, 120, 40, '[]', now() - interval '1 hour'),
  ('91000000-0000-4000-8000-000000000012', 5000, 4500, 5500, 4000, 6000, 70, '[]', now() + interval '1 year'),
  ('91000000-0000-4000-8000-000000000013', 5000, 4500, 5500, 4000, 6000, 70, '[]', now() - interval '2 years'),
  ('91000000-0000-4000-8000-000000000017', 5000, 4500, 5500, 4000, 6000, 70, '[]', now() - interval '2 years'),
  ('91000000-0000-4000-8000-000000000017', 100, 90, 110, 80, 120, 40, '[]', now() - interval '1 month');

do $$
declare
  v_status text;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  -- Le propriétaire n'écrit jamais d'estimation lui-même.
  perform public._mkh_expect_error(
    $q$insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources, valued_at)
       values ('91000000-0000-4000-8000-000000000011', 1, 1, 1, 1, 1, 10, '[]', now() + interval '50 years')$q$,
    '42501');
  perform public._mkh_expect_error(
    $q$delete from public.valuations where item_id = '91000000-0000-4000-8000-000000000011'$q$, '42501');

  insert into public.listings (item_id, seller_id, ask_price)
  values ('91000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000001', 400)
  returning status into v_status;
  if v_status <> 'pending_certification' then
    raise exception 'X9 : estimation haute récente ⇒ pending_certification attendu, vu %', v_status;
  end if;
  insert into public.listings (item_id, seller_id, ask_price)
  values ('91000000-0000-4000-8000-000000000012', '81000000-0000-4000-8000-000000000001', 400)
  returning status into v_status;
  if v_status <> 'active' then
    raise exception 'X9 : estimation datée dans le futur ignorée attendue, vu %', v_status;
  end if;
  -- Seule estimation : 5 000 € il y a 2 ans (hors fenêtre) ⇒ elle compte
  -- (price-cron n'écrit rien sans observation : pas de sous-déclaration).
  insert into public.listings (item_id, seller_id, ask_price)
  values ('91000000-0000-4000-8000-000000000013', '81000000-0000-4000-8000-000000000001', 400)
  returning status into v_status;
  if v_status <> 'pending_certification' then
    raise exception 'X9 : seule estimation (2 ans, 5 000 €) ⇒ pending_certification attendu, vu %', v_status;
  end if;
  -- Ancienne estimation haute, puis récente basse DANS la fenêtre ⇒ la
  -- récente seule compte : l'objet a perdu de sa valeur.
  insert into public.listings (item_id, seller_id, ask_price)
  values ('91000000-0000-4000-8000-000000000017', '81000000-0000-4000-8000-000000000001', 400)
  returning status into v_status;
  if v_status <> 'active' then
    raise exception 'X9 : estimation récente basse dans la fenêtre ⇒ active attendu, vu %', v_status;
  end if;
  -- Supprimer un objet efface toujours ses estimations (cascade référentielle).
  delete from public.items where id = '91000000-0000-4000-8000-000000000013';
  reset role;
  if exists (select 1 from public.valuations where item_id = '91000000-0000-4000-8000-000000000013') then
    raise exception 'X9 : estimations d''un objet supprimé conservées';
  end if;
  raise notice 'OK X9 — seuil : max des estimations VELUM récentes (à défaut, la dernière), écrites par le serveur seul';
end
$$;

-- ── X10. Prix plancher et paliers de commission ─────────────────────────────
do $$
declare
  v_summary jsonb;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('91000000-0000-4000-8000-000000000014', '81000000-0000-4000-8000-000000000001', 0)$q$,
    '%minimum%');
  perform public._mkh_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('91000000-0000-4000-8000-000000000014', '81000000-0000-4000-8000-000000000001', 0.5)$q$,
    '%minimum%');

  -- Historique de ventes (fixture, triggers neutralisés) d'un vendeur Platine :
  -- ventes < 20 € ignorées ; au plus 3 ventes comptées par acheteur.
  reset role;
  perform set_config('velum.uid', '', true);
  insert into auth.users (id, email)
  select ('86000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid,
         'acheteur' || g || '@harden.test'
  from generate_series(0, 5) g;
  update public.profiles set plan = 'platine'
  where id = '86000000-0000-4000-8000-000000000000';
  insert into public.items (id, owner_id, domain, title)
  values ('96000000-0000-4000-8000-000000000001', '86000000-0000-4000-8000-000000000000', 'coin', 'Lot de jetons');
  insert into public.listings (id, item_id, seller_id, ask_price, status)
  values ('a8000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001',
          '86000000-0000-4000-8000-000000000000', 50, 'sold');
  perform set_config('session_replication_role', 'replica', true);
  insert into public.orders (listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state, released_at)
  -- 10 ventes à 50 € au même acheteur (3 comptées) et 12 ventes à 5 € (aucune).
  select 'a8000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000001'::uuid,
         '86000000-0000-4000-8000-000000000000'::uuid, 50, 'EUR', 0.05, 'released', now()
  from generate_series(1, 10)
  union all
  select 'a8000000-0000-4000-8000-000000000001'::uuid, '86000000-0000-4000-8000-000000000002'::uuid,
         '86000000-0000-4000-8000-000000000000'::uuid, 5, 'EUR', 0.05, 'released', now()
  from generate_series(1, 12);
  perform set_config('session_replication_role', 'origin', true);
  if public.commission_rate_for('86000000-0000-4000-8000-000000000000') <> 0.05 then
    raise exception 'X10 : ventes complices ou à vil prix comptées dans le palier';
  end if;
  -- Trois autres acheteurs, trois ventes chacun : 3 + 9 = 12 ventes retenues ⇒ 4 %.
  perform set_config('session_replication_role', 'replica', true);
  insert into public.orders (listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state, released_at)
  select 'a8000000-0000-4000-8000-000000000001',
         ('86000000-0000-4000-8000-0000000000' || lpad(b::text, 2, '0'))::uuid,
         '86000000-0000-4000-8000-000000000000', 30, 'EUR', 0.05, 'released', now()
  from generate_series(3, 5) b, generate_series(1, 3);
  perform set_config('session_replication_role', 'origin', true);
  if public.commission_rate_for('86000000-0000-4000-8000-000000000000') <> 0.04 then
    raise exception 'X10 : palier 4 %% attendu après 12 ventes retenues';
  end if;
  set local role authenticated;
  perform set_config('velum.uid', '86000000-0000-4000-8000-000000000000', true);
  v_summary := public.my_commission_summary();
  if (v_summary ->> 'completedSales')::int <> 12 or (v_summary ->> 'currentRate')::numeric <> 0.04 then
    raise exception 'X10 : synthèse incohérente avec le palier (%)', v_summary;
  end if;
  raise notice 'OK X10 — prix plancher 1 € ; palier : ventes libérées ≥ 20 €, 3 au plus par acheteur';
end
$$;

-- ── X11. Date de publication posée par le serveur ───────────────────────────
do $$
declare
  v_created timestamptz;
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (item_id, seller_id, ask_price, created_at)
  values ('91000000-0000-4000-8000-000000000015', '81000000-0000-4000-8000-000000000001', 30, '2999-01-01')
  returning created_at into v_created;
  if v_created > now() then
    raise exception 'X11 : date de publication forgée acceptée (%)', v_created;
  end if;
  raise notice 'OK X11 — date de publication posée par le serveur';
end
$$;

-- ── X12. Annonce certifiée : suppression interdite ──────────────────────────
do $$
begin
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  perform public._mkh_expect_error(
    $q$delete from public.listings where id = 'a5000000-0000-4000-8000-000000000010'$q$, '%retirez-la%');
  raise notice 'OK X12 — certification décidée : annonce conservée (retrait seulement)';
end
$$;

-- ── X13. Fin d'abonnement Platine ───────────────────────────────────────────
do $$
declare
  v_order uuid;
  v_ex_on_mine uuid;
  v_ex_mine uuid;
  v_count integer;
  v_state text;
begin
  set local role authenticated;
  perform set_config('velum.uid', '85000000-0000-4000-8000-000000000005', true);
  insert into public.listings (id, item_id, seller_id, ask_price, status, kind) values
    ('a9000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000005', 100, 'active', 'sale'),
    ('a9000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002',
     '85000000-0000-4000-8000-000000000005', 100, 'draft', 'sale'),
    ('a9000000-0000-4000-8000-000000000005', '95000000-0000-4000-8000-000000000005',
     '85000000-0000-4000-8000-000000000005', 200, 'active', 'sale_or_exchange');
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  insert into public.listings (id, item_id, seller_id, ask_price, kind) values
    ('a9000000-0000-4000-8000-000000000013', '93000000-0000-4000-8000-000000000002',
     '83000000-0000-4000-8000-000000000003', 300, 'exchange');
  -- Denis propose un échange ; Bruno propose sur l'annonce de Denis ; Chloé
  -- paie cette annonce (réservée : elle ne sera pas retirée).
  perform set_config('velum.uid', '85000000-0000-4000-8000-000000000005', true);
  select id into v_ex_mine from public.propose_exchange(
    'a9000000-0000-4000-8000-000000000013', '95000000-0000-4000-8000-000000000004', 280);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_ex_on_mine from public.propose_exchange(
    'a9000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000003', 190);
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select id into v_order from public.market_buy('a9000000-0000-4000-8000-000000000005');
  perform public.advance_market_order(v_order, 'funds_held');

  -- Le membre ne se rétrograde ni ne se promeut lui-même : seul le service.
  perform set_config('velum.uid', '85000000-0000-4000-8000-000000000005', true);
  perform public._mkh_expect_error(
    $q$update public.profiles set plan = 'free' where id = '85000000-0000-4000-8000-000000000005'$q$, '42501');
  reset role;
  perform set_config('velum.uid', '', true);
  update public.profiles set plan = 'free' where id = '85000000-0000-4000-8000-000000000005';

  select status into v_state from public.listings where id = 'a9000000-0000-4000-8000-000000000001';
  if v_state <> 'withdrawn' then raise exception 'X13 : annonce publiée retirée attendue, vu %', v_state; end if;
  select status into v_state from public.listings where id = 'a9000000-0000-4000-8000-000000000002';
  if v_state <> 'draft' then raise exception 'X13 : brouillon conservé attendu, vu %', v_state; end if;
  select status into v_state from public.listings where id = 'a9000000-0000-4000-8000-000000000005';
  if v_state <> 'active' then raise exception 'X13 : annonce réservée conservée attendue, vu %', v_state; end if;
  select state into v_state from public.exchange_proposals where id = v_ex_mine;
  if v_state <> 'withdrawn' then raise exception 'X13 : proposition du membre retirée attendue, vu %', v_state; end if;

  -- Plus de (re)publication, d'acceptation ni de demande de certification.
  set local role authenticated;
  perform set_config('velum.uid', '85000000-0000-4000-8000-000000000005', true);
  perform public._mkh_expect_error(
    $q$update public.listings set status = 'active' where id = 'a9000000-0000-4000-8000-000000000001'$q$, 'VL402');
  perform public._mkh_expect_error(
    $q$update public.listings set status = 'active' where id = 'a9000000-0000-4000-8000-000000000002'$q$, 'VL402');
  perform public._mkh_expect_error(
    $q$select * from public.request_certification('voluntary', p_listing => 'a9000000-0000-4000-8000-000000000002')$q$,
    'VL402');
  -- La transaction en cours, elle, se poursuit : l'acheteuse annule ; l'annonce
  -- redevenue libre n'est plus proposée (vendeur hors Platine).
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  perform public.advance_market_order(v_order, 'cancelled');
  select count(*) into v_count from public.market_catalogue()
  where id = 'a9000000-0000-4000-8000-000000000005';
  if v_count <> 0 then raise exception 'X13 : annonce d''un membre hors Platine au catalogue'; end if;
  perform public._mkh_expect_error(
    $q$select * from public.market_buy('a9000000-0000-4000-8000-000000000005')$q$, '%hors offre Platine%');
  perform set_config('velum.uid', '85000000-0000-4000-8000-000000000005', true);
  perform public._mkh_expect_error(format('select * from public.respond_exchange(%L, true)', v_ex_on_mine), 'VL402');
  raise notice 'OK X13 — fin d''abonnement : annonces retirées, propositions retirées, actions refusées';
end
$$;

-- ── X14. market_listing() : annonce par identifiant, hors catalogue ─────────
do $$
declare
  v_row record;
  v_result text;
  v_count integer;
begin
  v_result := pg_get_function_result('public.market_listing(uuid)'::regprocedure);
  if v_result like '%seller_id%' or v_result like '%item_id%' or v_result like '%buyer_id%' then
    raise exception 'X14 : colonnes identifiantes exposées (%)', v_result;
  end if;
  if has_function_privilege('anon', 'public.market_listing(uuid)', 'execute') then
    raise exception 'X14 : market_listing exécutable sans session';
  end if;

  set local role authenticated;
  -- Annonce publiée : visible d'un membre Platine (même colonnes que le catalogue).
  perform set_config('velum.uid', '83000000-0000-4000-8000-000000000003', true);
  select * into v_row from public.market_listing('a3000000-0000-4000-8000-000000000007');
  if v_row.id is null or v_row.is_mine or v_row.seller_alias not like 'Collectionneur %'
     or v_row.kind <> 'sale_or_exchange' or v_row.ask_price <> 210 then
    raise exception 'X14 : annonce publiée incorrecte (%)', row_to_json(v_row);
  end if;
  -- Annonce vendue : visible de l'acheteur et du vendeur, pas d'un tiers.
  select count(*) into v_count from public.market_listing('a4000000-0000-4000-8000-000000000008');
  if v_count <> 0 then raise exception 'X14 : annonce vendue visible d''un tiers'; end if;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.market_listing('a4000000-0000-4000-8000-000000000008');
  if v_row.id is null or v_row.is_mine or v_row.title <> 'Sou Louis XV 1770' then
    raise exception 'X14 : annonce vendue invisible de l''acheteur (%)', row_to_json(v_row);
  end if;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  select * into v_row from public.market_listing('a4000000-0000-4000-8000-000000000008');
  if v_row.id is null or not v_row.is_mine then
    raise exception 'X14 : annonce vendue invisible du vendeur (%)', row_to_json(v_row);
  end if;
  -- Annonce échangée : visible des parties de l'échange seulement.
  select count(*) into v_count from public.market_listing('a2000000-0000-4000-8000-000000000005');
  if v_count <> 0 then raise exception 'X14 : annonce échangée visible d''un tiers'; end if;
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select count(*) into v_count from public.market_listing('a2000000-0000-4000-8000-000000000005');
  if v_count <> 1 then raise exception 'X14 : annonce échangée invisible du proposeur'; end if;
  -- Identifiant inconnu : aucune ligne (jamais d'erreur trompeuse).
  select count(*) into v_count from public.market_listing(gen_random_uuid());
  if v_count <> 0 then raise exception 'X14 : identifiant inconnu ⇒ aucune ligne attendue'; end if;
  -- Hors Platine : une annonce publiée exige l'offre ; sans session : refus.
  perform set_config('velum.uid', '84000000-0000-4000-8000-000000000004', true);
  perform public._mkh_expect_error(
    $q$select * from public.market_listing('a3000000-0000-4000-8000-000000000007')$q$, 'VL402');
  perform set_config('velum.uid', '', true);
  perform public._mkh_expect_error(
    $q$select * from public.market_listing('a3000000-0000-4000-8000-000000000007')$q$, 'VL401');
  raise notice 'OK X14 — market_listing : annonce par identifiant, anonymisée, visible des seules parties hors catalogue';
end
$$;

-- Arrondi monétaire : vecteurs partagés avec packages/config (roundCents).
do $$
begin
  if round(20.70 * 0.0500, 2) <> 1.04 or round(2.01 / 2, 2) <> 1.01 or round(2.01 - round(2.01 / 2, 2), 2) <> 1.00 then
    raise exception 'arrondi : demi-centime arrondi au supérieur attendu';
  end if;
  raise notice 'OK X15 — arrondi au centime (demi supérieur), vecteurs partagés avec roundCents';
end
$$;

-- ── X16. Expédition par le vendeur : date de livraison refusée (P0001 exact) ─
-- Le vendeur qui expédie avec un suivi VALIDE et un transporteur reconnu,
-- mais en posant delivered_at, reçoit P0001 (refus métier, jamais une panne :
-- le client ne le met pas en file hors-ligne) ; sans date, l'expédition passe.
do $$
declare
  v_order uuid;
  v_row record;
  v_refused boolean := false;
  v_delivered timestamptz;
begin
  insert into public.items (id, owner_id, domain, title) values
    ('91000000-0000-4000-8000-000000000016', '81000000-0000-4000-8000-000000000001', 'coin',
     'Liard de Louis XIV 1655');
  set local role authenticated;
  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  insert into public.listings (id, item_id, seller_id, ask_price) values
    ('a1600000-0000-4000-8000-000000000016', '91000000-0000-4000-8000-000000000016',
     '81000000-0000-4000-8000-000000000001', 90);
  perform set_config('velum.uid', '82000000-0000-4000-8000-000000000002', true);
  select id into v_order from public.market_buy('a1600000-0000-4000-8000-000000000016');
  perform public.advance_market_order(v_order, 'funds_held');

  perform set_config('velum.uid', '81000000-0000-4000-8000-000000000001', true);
  begin
    perform public.advance_market_order(v_order, 'shipped', 'Colissimo', '6A12345678901', now());
  exception when others then
    if sqlstate <> 'P0001' or sqlerrm not like '%atteste la livraison%' then
      raise exception 'X16 : refus inattendu (% — %)', sqlstate, sqlerrm;
    end if;
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'X16 : expédition du vendeur avec date de livraison acceptée';
  end if;

  -- Même expédition, delivered_at null : elle passe, sans date de livraison.
  select * into v_row from public.advance_market_order(v_order, 'shipped', 'Colissimo', '6A12345678901', null);
  if v_row.escrow_state <> 'shipped' or v_row.delivered_at is not null
     or v_row.carrier <> 'Colissimo' or v_row.tracking_number <> '6A12345678901' then
    raise exception 'X16 : expédition sans date de livraison attendue (%)', row_to_json(v_row);
  end if;
  reset role;
  select delivered_at into v_delivered from public.orders where id = v_order;
  if v_delivered is not null then
    raise exception 'X16 : aucune date de livraison ne doit être enregistrée (%)', v_delivered;
  end if;
  raise notice 'OK X16 — vendeur : date de livraison à l''expédition ⇒ P0001 ; sans date, l''expédition passe';
end
$$;

drop function public._mkh_expect_error(text, text);

select 'MARKETPLACE HARDENING CHECKS PASSED' as result;
