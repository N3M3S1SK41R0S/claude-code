-- ─────────────────────────────────────────────────────────────────────────────
-- Tests de comportement SQL — exécutés sur Postgres nu via supabase_stub.sql
-- après les migrations. Chaque bloc lève une exception si l'attendu n'est pas
-- respecté ; la dernière ligne affiche ALL CHECKS PASSED.
-- Couverture : isolation RLS, quota hebdo par module, plan Platine
-- (marketplace + expertise > 500 €), policies storage, cascade RGPD.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Deux utilisateurs de test (le trigger on_auth_user_created crée les profils).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@test.dev', '{"display_name":"Alice"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@test.dev', '{"display_name":"Bob"}')
on conflict (id) do nothing;

-- ── 1. Isolation RLS des items ───────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  insert into public.items (id, owner_id, domain, title)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'wine', 'Vin d''Alice');

  select count(*) into v_count from public.items;
  if v_count <> 1 then
    raise exception 'RLS items : Alice devrait voir exactement 1 item, vu %', v_count;
  end if;

  -- Bob ne voit rien.
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  select count(*) into v_count from public.items;
  if v_count <> 0 then
    raise exception 'RLS items : Bob ne devrait rien voir, vu %', v_count;
  end if;

  -- Bob ne peut pas s'approprier un insert chez Alice.
  begin
    insert into public.items (owner_id, domain, title)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'coin', 'intrusion');
    raise exception 'RLS items : insert de Bob chez Alice aurait dû être refusé';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  raise notice 'OK 1 — isolation RLS items';
end
$$;

-- ── 2. Isolation RLS des profils ─────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  set local role authenticated;
  select count(*) into v_count from public.profiles;
  if v_count <> 1 then
    raise exception 'RLS profiles : Bob devrait voir 1 profil (le sien), vu %', v_count;
  end if;
  raise notice 'OK 2 — isolation RLS profils';
end
$$;

-- ── 3. Quota freemium : 5 scans / semaine / MODULE ──────────────────────────
do $$
declare
  i integer;
  v_allowed boolean;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  for i in 1..5 loop
    select public.consume_scan('wine') into v_allowed;
    if not v_allowed then
      raise exception 'consume_scan : le scan wine n°% aurait dû passer', i;
    end if;
  end loop;

  select public.consume_scan('wine') into v_allowed;
  if v_allowed then
    raise exception 'consume_scan : le 6e scan wine de la semaine aurait dû être refusé';
  end if;

  -- Le quota est PAR module : coin doit encore passer.
  select public.consume_scan('coin') into v_allowed;
  if not v_allowed then
    raise exception 'consume_scan : le quota doit être compté par module (coin refusé à tort)';
  end if;

  raise notice 'OK 3 — quota 5 scans/semaine/module';
end
$$;

-- Premium : illimité.
update public.profiles set plan = 'premium'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
  v_allowed boolean;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;
  select public.consume_scan('wine') into v_allowed;
  if not v_allowed then
    raise exception 'consume_scan : premium doit être illimité';
  end if;
  raise notice 'OK 4 — premium illimité';
end
$$;

-- ── 5. Valorisations : uniquement via la propriété de l'item ─────────────────
do $$
begin
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  set local role authenticated;
  begin
    insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 100, 90, 110, 80, 120, 50, '[]'::jsonb);
    raise exception 'RLS valuations : Bob a valorisé l''item d''Alice';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;
  raise notice 'OK 5 — valuations protégées par la propriété de l''item';
end
$$;

-- ── 6. Marketplace Platine : policy d'insertion + expertise > 500 € ─────────
do $$
begin
  -- Alice est premium : la création d'annonce doit être refusée.
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;
  begin
    insert into public.listings (item_id, seller_id, ask_price)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100);
    raise exception 'listings : un plan premium a pu créer une annonce (réservé Platine)';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;
  raise notice 'OK 6a — annonce refusée hors Platine';
end
$$;

update public.profiles set plan = 'platine'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
  v_rate numeric;
  v_required boolean;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  -- Brouillon à 600 € : accepté, commission 5 %, expertise marquée requise.
  insert into public.listings (id, item_id, seller_id, ask_price)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddd01',
          'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 600);

  select commission_rate, expert_appraisal_required into v_rate, v_required
  from public.listings where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  if v_rate <> 0.05 then
    raise exception 'listings : commission attendue 5 %%, vu %', v_rate;
  end if;
  if not v_required then
    raise exception 'listings : expertise requise attendue pour 600 €';
  end if;

  -- Activation sans rapport d'expertise : refusée par le trigger.
  begin
    update public.listings set status = 'active'
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
    raise exception 'listings : activation à 600 € sans expertise aurait dû échouer';
  exception
    when raise_exception or others then
      if sqlerrm not like '%Expertise obligatoire%' then raise; end if;
  end;

  -- Avec le rapport d'expertise (à la charge du vendeur) : activation OK.
  update public.listings
  set expert_appraisal_ref = 'expertises/aaaa/rapport-600.pdf', status = 'active'
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';

  -- Petite annonce (≤ 500 €) : activable sans expertise.
  insert into public.listings (item_id, seller_id, ask_price, status)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100, 'active');

  raise notice 'OK 6b — Platine : commission 5 %%, expertise imposée > 500 € puis levée';
end
$$;

-- ── 7. Storage : chacun son préfixe uid/ ─────────────────────────────────────
do $$
declare
  v_count integer;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  insert into storage.objects (bucket_id, name)
  values ('item-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/item1/label.jpg');

  -- Bob ne voit pas l'objet d'Alice, et ne peut pas écrire chez elle.
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  select count(*) into v_count from storage.objects;
  if v_count <> 0 then
    raise exception 'storage : Bob voit % objet(s) d''Alice', v_count;
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('item-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/item1/intrus.jpg');
    raise exception 'storage : Bob a écrit dans le préfixe d''Alice';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  raise notice 'OK 7 — storage cloisonné par préfixe uid/';
end
$$;

-- ── 7bis. Commission dégressive : 5 % → 2 % selon les ventes conclues ────────
do $$
declare
  v_rate numeric;
  v_id uuid;
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  -- Nouveau vendeur : 5 % — et le client ne peut PAS choisir son taux.
  insert into public.listings (id, item_id, seller_id, ask_price, commission_rate)
  values (gen_random_uuid(), 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100, 0.001)
  returning id, commission_rate into v_id, v_rate;
  if v_rate <> 0.05 then
    raise exception 'commission : attendu 5 %% pour un nouveau vendeur, vu %', v_rate;
  end if;

  reset role;
  -- 10 ventes conclues (petites, sous le seuil d''expertise) → palier 4 %.
  insert into public.listings (item_id, seller_id, ask_price, status)
  select 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 50, 'sold'
  from generate_series(1, 10);

  set local role authenticated;
  insert into public.listings (item_id, seller_id, ask_price)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100)
  returning commission_rate into v_rate;
  if v_rate <> 0.04 then
    raise exception 'commission : attendu 4 %% après 10 ventes, vu %', v_rate;
  end if;

  reset role;
  -- Jusqu''à 50 ventes conclues → plancher 2 %.
  insert into public.listings (item_id, seller_id, ask_price, status)
  select 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 50, 'sold'
  from generate_series(1, 40);

  set local role authenticated;
  insert into public.listings (item_id, seller_id, ask_price)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100)
  returning commission_rate into v_rate;
  if v_rate <> 0.02 then
    raise exception 'commission : attendu 2 %% (plancher) après 50 ventes, vu %', v_rate;
  end if;

  raise notice 'OK 7bis — commission dégressive 5 %% → 4 %% → 2 %%, non choisie par le client';
end
$$;

-- ── 7ter. Journal de dégustation & provenance : RLS via propriété de l'item ──
do $$
declare
  v_count integer;
begin
  -- Alice ajoute une note et une étape de provenance à SON item.
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;
  insert into public.tasting_notes (item_id, rating, note)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 92, 'Superbe, garrigue');
  insert into public.provenance_entries (item_id, owner_label, acquired_from)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'Alice', 'Drouot');

  select count(*) into v_count from public.tasting_notes;
  if v_count <> 1 then
    raise exception 'RLS notes : Alice devrait voir 1 note, vu %', v_count;
  end if;

  -- Bob ne voit ni les notes ni la provenance de l'item d'Alice.
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  select count(*) into v_count from public.tasting_notes;
  if v_count <> 0 then
    raise exception 'RLS notes : Bob ne devrait voir aucune note, vu %', v_count;
  end if;
  select count(*) into v_count from public.provenance_entries;
  if v_count <> 0 then
    raise exception 'RLS provenance : Bob ne devrait voir aucune étape, vu %', v_count;
  end if;

  -- Bob ne peut pas greffer une note sur l'item d'Alice (with check).
  begin
    insert into public.tasting_notes (item_id, note)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'intrusion');
    raise exception 'RLS notes : insert de Bob sur l''item d''Alice aurait dû être refusé';
  exception
    when insufficient_privilege or check_violation then null; -- attendu
  end;

  raise notice 'OK 7ter — journal & provenance isolés par la propriété de l''item';
end
$$;

-- ── 7quater. Communauté à séquestre : achat Platine, machine à états, litige ─
-- Alice (Platine) vend ; Bob doit passer Platine pour acheter.
update public.profiles set plan = 'platine'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Deux annonces actives d'Alice pour litige & auto-libération (≤ 500 € : sans
-- expertise). dddd…01 (600 €, active, expertisée) sert au parcours nominal.
insert into public.listings (id, item_id, seller_id, ask_price, status)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd02',
   'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 120, 'active'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd03',
   'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 90, 'active');

do $$
declare
  v_state text;
  v_rate numeric;
  v_seller uuid;
begin
  -- Bob n'est pas encore reconnu Platine dans CETTE transaction ? Il l'est
  -- (mise à jour ci-dessus, hors transaction). Un non-Platine serait refusé
  -- par can_list_on_marketplace (déjà prouvé en 6a). On teste ici le parcours.
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  set local role authenticated;

  -- Achat de l'annonce nominale (600 €, expertisée) : taux FIGÉ = 5 %
  -- (Alice avait 0 vente conclue quand dddd…01 a été créée), seller/amount
  -- proviennent de l'annonce.
  insert into public.orders (id, listing_id, buyer_id)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
          'dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  select escrow_state, commission_rate, seller_id into v_state, v_rate, v_seller
  from public.orders where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
  if v_state <> 'pending_payment' then raise exception 'ordre : état initial %', v_state; end if;
  if v_rate <> 0.05 then raise exception 'ordre : commission figée attendue 5 %%, vue %', v_rate; end if;
  if v_seller <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then raise exception 'ordre : mauvais vendeur'; end if;

  -- Transition ILLÉGALE (l'acheteur saute la capture) : refusée.
  begin
    update public.orders set escrow_state = 'shipped'
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
    raise exception 'séquestre : pending_payment → shipped aurait dû être refusé';
  exception when raise_exception then
    if sqlerrm not like '%Transition de séquestre interdite%' then raise; end if;
  end;

  -- Capture (acheteur) : pending_payment → funds_held.
  update public.orders set escrow_state = 'funds_held'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';

  -- Commandes pour litige (02) et auto-libération (03) : achat + capture.
  insert into public.orders (id, listing_id, buyer_id)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
          'dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
         ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
          'dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  update public.orders set escrow_state = 'funds_held'
  where id in ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02','eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03');

  -- Litige ouvert par l'acheteur sur la commande 02.
  update public.orders set escrow_state = 'disputed'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02';
  insert into public.disputes (order_id, opened_by, reason)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'objet non conforme');
end
$$;

-- Vendeur (Alice) : expédition des commandes 01 et 03 (tracking requis).
do $$
begin
  perform set_config('velum.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  set local role authenticated;

  -- Sans tracking : refusé.
  begin
    update public.orders set escrow_state = 'shipped'
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
    raise exception 'séquestre : expédition sans tracking aurait dû échouer';
  exception when raise_exception then
    if sqlerrm not like '%Transition de séquestre interdite%' then raise; end if;
  end;

  update public.orders set escrow_state = 'shipped', carrier = 'Chronopost', tracking_number = 'XY01'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
  update public.orders set escrow_state = 'shipped', tracking_number = 'XY03',
         delivered_at = now() - interval '10 days'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03';
end
$$;

-- Acheteur (Bob) : confirme la réception de la commande 01 → libération.
do $$
begin
  perform set_config('velum.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  set local role authenticated;
  update public.orders set escrow_state = 'released'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
end
$$;

-- Arbitrage du litige (plateforme) : remboursement de la commande 02.
select public.resolve_dispute('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02', false, 'contrefaçon avérée');

-- Auto-libération : la commande 03 (livrée il y a 10 j, sans litige) part.
select public.release_due_orders();

do $$
declare
  v01 text; v02 text; v03 text; v_sold text; v_rep jsonb; v_other integer;
begin
  select escrow_state into v01 from public.orders where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
  select escrow_state into v02 from public.orders where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02';
  select escrow_state into v03 from public.orders where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03';
  if v01 <> 'released' then raise exception 'ordre 01 : attendu released, vu %', v01; end if;
  if v02 <> 'refunded' then raise exception 'ordre 02 : attendu refunded, vu %', v02; end if;
  if v03 <> 'released' then raise exception 'ordre 03 (auto) : attendu released, vu %', v03; end if;

  -- L'annonce nominale est passée 'sold' via la libération.
  select status into v_sold from public.listings where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  if v_sold <> 'sold' then raise exception 'annonce 01 : attendue sold, vue %', v_sold; end if;

  -- Réputation d'Alice : 2 ventes conclues (01 + 03), 1 remboursement (02).
  v_rep := public.seller_reputation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if (v_rep->>'completedSales')::int <> 2 then
    raise exception 'réputation : ventes conclues attendues 2, vues %', v_rep->>'completedSales';
  end if;
  if (v_rep->>'refunded')::int <> 1 then
    raise exception 'réputation : remboursements attendus 1, vus %', v_rep->>'refunded';
  end if;

  -- RLS : un tiers (ni acheteur ni vendeur) ne voit aucune commande.
  perform set_config('velum.uid', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
  set local role authenticated;
  select count(*) into v_other from public.orders;
  if v_other <> 0 then raise exception 'RLS orders : un tiers voit % commande(s)', v_other; end if;

  raise notice 'OK 7quater — séquestre : achat Platine, transitions gardées, litige & auto-libération, réputation, RLS';
end
$$;

-- ── 8. Purge RGPD : suppression auth.users → cascade complète ────────────────
do $$
declare
  v_count integer;
begin
  delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select count(*) into v_count from public.items
  where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 0 then
    raise exception 'cascade : % item(s) orphelin(s) après suppression du compte', v_count;
  end if;
  select count(*) into v_count from public.listings
  where seller_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 0 then
    raise exception 'cascade : % annonce(s) orpheline(s)', v_count;
  end if;
  -- Notes de dégustation et provenance de l'item d'Alice : purgées en cascade.
  select count(*) into v_count from public.tasting_notes
  where item_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
  if v_count <> 0 then
    raise exception 'cascade : % note(s) de dégustation orpheline(s)', v_count;
  end if;
  select count(*) into v_count from public.provenance_entries
  where item_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
  if v_count <> 0 then
    raise exception 'cascade : % étape(s) de provenance orpheline(s)', v_count;
  end if;
  -- Commandes où Alice était vendeuse : purgées en cascade (profiles → orders).
  select count(*) into v_count from public.orders
  where seller_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 0 then
    raise exception 'cascade : % commande(s) orpheline(s) après suppression du vendeur', v_count;
  end if;
  raise notice 'OK 8 — purge RGPD en cascade';
end
$$;

select 'ALL CHECKS PASSED' as result;
