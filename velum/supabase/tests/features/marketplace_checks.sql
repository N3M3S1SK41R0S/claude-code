-- ─────────────────────────────────────────────────────────────────────────────
-- Plateformes d'échange et de vente (Platine) — tests SQL de comportement.
-- Migrations 20261023100000…100400. Rejouable sur base fraîche, indépendant
-- des autres fichiers (utilisateurs propres).
--
-- Couverture : masquage des coordonnées (vecteurs partagés avec
-- packages/config/src/marketplace.test.ts, sortie IDENTIQUE au caractère près),
-- pseudonymes, anonymat (table ET RPC), Platine, seuil 500 € incluant
-- l'estimation, flux de certification (seuil, accord mutuel, volontaire,
-- décision d'expert), réservation, machine à états des échanges acteur par
-- acteur, commissions figées, messagerie restreinte aux parties, registre,
-- droits d'exécution des fonctions système.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Assertion d'erreur : exécute p_sql (avec le rôle courant) et exige un échec
-- dont le message contient p_like (motif LIKE) ou dont le SQLSTATE vaut p_like.
create or replace function public._mkt_expect_error(p_sql text, p_like text)
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
grant execute on function public._mkt_expect_error(text, text) to authenticated;

-- ── 0. Jeu de données ────────────────────────────────────────────────────────
-- Sophie (vendeuse), Paul (acheteur / proposeur), Tiers : Platine ; Nina : premium.
insert into auth.users (id, email, raw_user_meta_data) values
  ('51000000-0000-4000-8000-000000000001', 'sophie@market.test', '{"display_name":"Sophie Martin"}'),
  ('52000000-0000-4000-8000-000000000002', 'paul@market.test', '{"display_name":"Paul Durand"}'),
  ('53000000-0000-4000-8000-000000000003', 'tiers@market.test', '{"display_name":"Tiers"}'),
  ('54000000-0000-4000-8000-000000000004', 'nina@market.test', '{"display_name":"Nina"}');

update public.profiles set plan = 'platine' where id in (
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003');
update public.profiles set plan = 'premium' where id = '54000000-0000-4000-8000-000000000004';

insert into public.items (id, owner_id, domain, title) values
  ('61000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'coin', 'Napoléon III 20 Francs Or 1868'),
  ('61000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'stamp', 'Bloc CITEX 1949 neuf'),
  ('61000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 'wine', 'Château Margaux 2015'),
  ('61000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000001', 'coin', 'Écu Louis XV 1726'),
  ('61000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000001', 'art', 'Vase Gallé — appelez le 06 12 34 56 78'),
  ('61000000-0000-4000-8000-000000000006', '51000000-0000-4000-8000-000000000001', 'stamp', 'Marianne de Dulac'),
  ('61000000-0000-4000-8000-000000000007', '51000000-0000-4000-8000-000000000001', 'coin', '10 Francs Coq 1907'),
  ('61000000-0000-4000-8000-000000000008', '51000000-0000-4000-8000-000000000001', 'watch', 'Montre Lip Himalaya'),
  ('62000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'coin', 'Marianne 10 Francs or 1907'),
  ('62000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 'stamp', 'Cérès 1849 noir'),
  ('62000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000002', 'watch', 'Omega Speedmaster 1969'),
  ('63000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000003', 'coin', 'Louis d''or 1786'),
  ('63000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000003', 'coin', 'Thaler 1780'),
  ('64000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000004', 'coin', 'Sou de Nina');

-- Estimations VELUM (price-cron, service) : le Vase Gallé vaut 750 €, la
-- montre de Paul 800 € (au-delà du seuil malgré des valeurs déclarées basses).
insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources, valued_at) values
  ('61000000-0000-4000-8000-000000000005', 750, 650, 850, 600, 900, 70, '[]', now() - interval '1 day'),
  ('62000000-0000-4000-8000-000000000003', 800, 700, 900, 650, 950, 70, '[]', now() - interval '1 day');

-- ── 1. Masquage des coordonnées : réplique EXACTE de redactContactInfo ──────
-- Sorties attendues calculées par la fonction TypeScript de @velum/config
-- (les 11 vecteurs de marketplace.test.ts + cas limites).
do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select v.input, v.expected
    from (values
      ('Écrivez-moi à jean.dupont@gmail.com svp',
       'Écrivez-moi à jean.dupont@[coordonnées masquées] svp'),
      ('jean point dupont arobase gmail point com',
       'jean point [coordonnées masquées]'),
      ('Tel 06 12 34 56 78',
       'Tel [coordonnées masquées]'),
      ('+33612345678',
       '[coordonnées masquées]'),
      ('06.12.34.56.78',
       '[coordonnées masquées]'),
      ('voir https://exemple.fr/annonce',
       'voir [coordonnées masquées]'),
      ('mon site www.collection-pierre.fr',
       'mon site [coordonnées masquées]'),
      ('passez sur monshop.com',
       'passez sur [coordonnées masquées]'),
      ('IBAN FR76 3000 6000 0112 3456 7890 189',
       'IBAN [coordonnées masquées]'),
      ('insta @pierre_collect',
       'insta [coordonnées masquées]'),
      ('RDV au 12 rue de la Paix',
       'RDV au [coordonnées masquées]'),
      ('Château Margaux 2015, 75 cl, cote YT 1234, 20 Francs or 1868 — 320 €',
       'Château Margaux 2015, 75 cl, cote YT 1234, 20 Francs or 1868 — 320 €'),
      ('Contact : JEAN.DUPONT@GMAIL.COM',
       'Contact : JEAN.DUPONT@[coordonnées masquées]'),
      ('jérôme@exemple.fr',
       'jérôme@[coordonnées masquées]'),
      (E'Appelez le 06 12 34 56 78',
       'Appelez le [coordonnées masquées]'),
      ('Rendez-vous 3 bis, avenue Foch à Paris',
       'Rendez-vous [coordonnées masquées]'),
      ('mon insta: @Collect.Pierre',
       'mon insta: [coordonnées masquées]'),
      ('Visitez https://exemple.fr/a?b=1 puis www.test.org',
       'Visitez [coordonnées masquées] puis [coordonnées masquées]'),
      ('Lot de 3 pièces, 1868-1870, réf. 12345',
       'Lot de 3 pièces, [coordonnées masquées], réf. 12345'),
      ('tel: 0033 6 12 34 56 78',
       'tel: [coordonnées masquées]'),
      ('écrire à paul (at) mail (dot) fr',
       'écrire à [coordonnées masquées]'),
      ('ÉCRIRE À PAUL (AT) MAIL (DOT) FR',
       'ÉCRIRE À [coordonnées masquées]'),
      ('IBAN : DE89 3704 0044 0532 0130 00',
       'IBAN : [coordonnées masquées]'),
      ('iban fr76 3000 6000 0112 3456 7890 189',
       'iban fr[coordonnées masquées]'),
      ('adresse: 12, rue des Lilas 75011',
       'adresse: [coordonnées masquées]75011'),
      ('voir achat-vente.fr/annonce/12 ou site.co.uk',
       'voir [coordonnées masquées] ou [coordonnées masquées].uk'),
      ('Prix 1.250,00 € — échange possible contre un 10 Francs Coq',
       'Prix 1.250,00 € — échange possible contre un 10 Francs Coq'),
      ('appelez-moi au (06) 12 34 56 78 après 18h',
       'appelez-moi au ([coordonnées masquées] après 18h'),
      ('RDV 4 Allée des Érables, Lyon',
       'RDV [coordonnées masquées], Lyon'),
      ('écrivez à marie_l@orange.fr ou au 07 81 22 33 44',
       'écrivez à marie_l@[coordonnées masquées] ou au [coordonnées masquées]'),
      ('-abc.com et x-y.net/page',
       '-[coordonnées masquées] et [coordonnées masquées]'),
      ('Cote Yvert n° 33, état TB, 2 timbres',
       'Cote Yvert n° 33, état TB, 2 timbres')
    ) as v(input, expected)
  loop
    if public.redact_contact_info(r.input) is distinct from r.expected then
      raise exception 'masquage : « % » → « % », attendu « % »',
        r.input, public.redact_contact_info(r.input), r.expected;
    end if;
    -- Idempotence : le jeton ne correspond à aucun motif.
    if public.redact_contact_info(r.expected) is distinct from r.expected then
      raise exception 'masquage non idempotent pour « % »', r.expected;
    end if;
    v_count := v_count + 1;
  end loop;
  if v_count <> 32 then
    raise exception 'masquage : 32 vecteurs attendus, % rejoués', v_count;
  end if;
  if public.redact_contact_info(null) is not null then
    raise exception 'masquage : null doit rester null';
  end if;
  raise notice 'OK M1 — masquage SQL identique à redactContactInfo (32 vecteurs, idempotent)';
end
$$;

-- ── 2. Pseudonymes stables, aléatoires, privés ───────────────────────────────
do $$
declare
  v_alias text;
  v_again text;
  v_count integer;
begin
  select count(*) into v_count from public.profiles p
  where not exists (select 1 from public.market_aliases a where a.member_id = p.id);
  if v_count <> 0 then
    raise exception 'pseudonymes : % profil(s) sans pseudonyme', v_count;
  end if;
  select count(*) into v_count from public.market_aliases
  where alias !~ '^Collectionneur [0-9A-F]{4,8}$';
  if v_count <> 0 then
    raise exception 'pseudonymes : % pseudonyme(s) au format invalide', v_count;
  end if;
  -- Jamais dérivé de l'uuid : le suffixe ne reprend pas le début de l'identifiant.
  select alias into v_alias from public.market_aliases
  where member_id = '51000000-0000-4000-8000-000000000001';
  if v_alias = 'Collectionneur 5100' then
    raise exception 'pseudonymes : suffixe dérivé de l''uuid (%)', v_alias;
  end if;

  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  set local role authenticated;
  v_alias := public.my_market_alias();
  v_again := public.my_market_alias();
  if v_alias is distinct from v_again then
    raise exception 'pseudonymes : instable (% puis %)', v_alias, v_again;
  end if;
  -- La table de correspondance n'est jamais lisible au-delà de sa propre ligne.
  select count(*) into v_count from public.market_aliases;
  if v_count <> 1 then
    raise exception 'pseudonymes : Paul voit % ligne(s) de correspondance', v_count;
  end if;
  perform public._mkt_expect_error(
    'select public.market_alias_of(''51000000-0000-4000-8000-000000000001'')', '42501');
  perform public._mkt_expect_error(
    'select public.ensure_market_alias(''51000000-0000-4000-8000-000000000001'')', '42501');
  raise notice 'OK M2 — pseudonymes aléatoires, stables, correspondance privée';
end
$$;

-- ── 3. Annonces : Platine, publication décidée par le serveur, seuil 500 € ──
do $$
declare
  v_status text;
  v_required boolean;
  v_desc text;
  v_wishes text;
  v_title text;
  v_rate numeric;
  v_count integer;
begin
  set local role authenticated;

  -- Nina (premium) : création refusée.
  perform set_config('velum.uid', '54000000-0000-4000-8000-000000000004', true);
  perform public._mkt_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price)
       values ('64000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000004', 50)$q$,
    '42501');

  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);

  -- L1 : vente OU échange, 320 € — publiée ; textes publics expurgés.
  insert into public.listings (id, item_id, seller_id, ask_price, kind, description, exchange_wishes)
  values ('71000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001',
          '51000000-0000-4000-8000-000000000001', 320, 'sale_or_exchange',
          'Très bel exemplaire, appelez-moi au 06 12 34 56 78',
          'Pièces or Second Empire — écrivez à sophie.martin@gmail.com')
  returning status, description, exchange_wishes into v_status, v_desc, v_wishes;
  if v_status <> 'active' then
    raise exception 'L1 : publiée attendue, vu %', v_status;
  end if;
  if v_desc <> 'Très bel exemplaire, appelez-moi au [coordonnées masquées]'
     or v_wishes not like '%[coordonnées masquées]%' or v_wishes like '%gmail%' then
    raise exception 'L1 : textes non expurgés (« % » / « % »)', v_desc, v_wishes;
  end if;

  -- L2 : 780 € > seuil ⇒ retenue en 'pending_certification' (jamais active).
  insert into public.listings (id, item_id, seller_id, ask_price)
  values ('71000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002',
          '51000000-0000-4000-8000-000000000001', 780)
  returning status, expert_appraisal_required into v_status, v_required;
  if v_status <> 'pending_certification' or not v_required then
    raise exception 'L2 : pending_certification + requis attendus, vu % / %', v_status, v_required;
  end if;

  -- L3 : 150 €, vin — publiée.
  insert into public.listings (id, item_id, seller_id, ask_price)
  values ('71000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003',
          '51000000-0000-4000-8000-000000000001', 150)
  returning status into v_status;
  if v_status <> 'active' then raise exception 'L3 : publiée attendue, vu %', v_status; end if;

  -- L4 : 200 €, vente seule — publiée.
  insert into public.listings (id, item_id, seller_id, ask_price, kind)
  values ('71000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000004',
          '51000000-0000-4000-8000-000000000001', 200, 'sale');

  -- L5 : déclarée 300 € MAIS estimée 750 € ⇒ le seuil s'applique (pas de
  -- contournement par sous-déclaration). Titre public expurgé.
  insert into public.listings (id, item_id, seller_id, ask_price)
  values ('71000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000005',
          '51000000-0000-4000-8000-000000000001', 300)
  returning status, title into v_status, v_title;
  if v_status <> 'pending_certification' then
    raise exception 'L5 : estimation 750 € ⇒ pending_certification attendu, vu %', v_status;
  end if;
  if v_title <> 'Vase Gallé — appelez le [coordonnées masquées]' then
    raise exception 'L5 : titre public non expurgé (%)', v_title;
  end if;

  -- L6 : 120 € ; L7 : échange seul, 250 € ; L8 : échange seul, 400 €.
  insert into public.listings (id, item_id, seller_id, ask_price, kind) values
    ('71000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000006',
     '51000000-0000-4000-8000-000000000001', 120, 'sale'),
    ('71000000-0000-4000-8000-000000000007', '61000000-0000-4000-8000-000000000007',
     '51000000-0000-4000-8000-000000000001', 250, 'exchange'),
    ('71000000-0000-4000-8000-000000000008', '61000000-0000-4000-8000-000000000008',
     '51000000-0000-4000-8000-000000000001', 400, 'exchange');

  -- Une annonce d'échange exige une valeur déclarée positive.
  perform public._mkt_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, kind)
       values ('61000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 0, 'exchange')$q$,
    '%valeur déclarée positive%');

  -- Statuts réservés à la plateforme : ni création 'sold', ni passage à 'sold'.
  perform public._mkt_expect_error(
    $q$insert into public.listings (item_id, seller_id, ask_price, status)
       values ('61000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 10, 'sold')$q$,
    '%Statut initial d''annonce interdit%');
  perform public._mkt_expect_error(
    $q$update public.listings set status = 'sold' where id = '71000000-0000-4000-8000-000000000003'$q$,
    '%Seule la plateforme%');

  -- Colonnes serveur ignorées (taux, badge).
  update public.listings
     set commission_rate = 0.001, expert_appraisal_ref = 'faux.pdf', status = 'active'
   where id = '71000000-0000-4000-8000-000000000002';
  select status, commission_rate into v_status, v_rate
  from public.listings where id = '71000000-0000-4000-8000-000000000002';
  if v_status <> 'pending_certification' or v_rate <> 0.05 then
    raise exception 'L2 : colonnes serveur modifiées par le client (% / %)', v_status, v_rate;
  end if;

  -- Une demande « seuil » ouverte d'office pour L2 et L5, frais vendeur.
  select count(*) into v_count from public.certification_requests
  where listing_id in ('71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000005')
    and reason = 'threshold' and status = 'requested' and fee_payer = 'seller';
  if v_count <> 2 then
    raise exception 'certification seuil : 2 demandes attendues, vu %', v_count;
  end if;

  -- L'évaluation de certification d'un objet d'autrui est refusée.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public._mkt_expect_error(
    $q$select * from public.listing_certification_snapshot(
         '61000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000001', 0)$q$,
    '42501');
  raise notice 'OK M3 — annonces : Platine, publication serveur, seuil sur max(prix, estimation), textes expurgés';
end
$$;

-- Nouvelle estimation au-delà du seuil (price-cron, service) : L3 publiée
-- repasse en 'pending_certification', demande ouverte, vendeuse prévenue.
insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources)
values ('61000000-0000-4000-8000-000000000003', 900, 800, 1000, 750, 1100, 65, '[]');

do $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status from public.listings where id = '71000000-0000-4000-8000-000000000003';
  if v_status <> 'pending_certification' then
    raise exception 'L3 : estimation 900 € ⇒ pending_certification attendu, vu %', v_status;
  end if;
  select count(*) into v_count from public.certification_requests
  where listing_id = '71000000-0000-4000-8000-000000000003' and status = 'requested';
  if v_count <> 1 then raise exception 'L3 : demande de certification attendue, vu %', v_count; end if;
  select count(*) into v_count from public.notifications
  where owner_id = '51000000-0000-4000-8000-000000000001' and title like 'Certification%requise';
  if v_count <> 1 then raise exception 'L3 : notification vendeuse attendue, vu %', v_count; end if;
  raise notice 'OK M4 — estimation au-delà du seuil : annonce suspendue jusqu''à certification';
end
$$;

-- ── 4. Anonymat du catalogue, filtres, Platine ───────────────────────────────
do $$
declare
  v_count integer;
  v_alias text;
  v_row record;
  v_ids text;
  v_result text;
begin
  select alias into v_alias from public.market_aliases
  where member_id = '51000000-0000-4000-8000-000000000001';

  -- La signature de la RPC n'expose ni seller_id ni item_id.
  v_result := pg_get_function_result(
    'public.market_catalogue(public.velum_domain, text, text, numeric, numeric, boolean, boolean, text, integer)'::regprocedure);
  if v_result like '%seller_id%' or v_result like '%item_id%' then
    raise exception 'catalogue : colonnes identifiantes exposées (%)', v_result;
  end if;

  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);

  -- Plus de lecture directe des annonces d'autrui (policy 0006 supprimée).
  select count(*) into v_count from public.listings;
  if v_count <> 0 then
    raise exception 'anonymat : Paul lit % annonce(s) d''autrui en direct', v_count;
  end if;
  perform public._mkt_expect_error('select seller_id from public.market_catalogue()', '42703');

  -- Catalogue : seules les annonces publiées (L1, L4, L6, L7, L8), pseudonymisées.
  select string_agg(right(id::text, 2), ',' order by id) into v_ids from public.market_catalogue();
  if v_ids <> '01,04,06,07,08' then
    raise exception 'catalogue : annonces publiées attendues 01,04,06,07,08 — vu %', v_ids;
  end if;
  select * into v_row from public.market_catalogue() c where c.id = '71000000-0000-4000-8000-000000000001';
  if v_row.seller_alias <> v_alias or v_row.is_mine or v_row.certified then
    raise exception 'catalogue : ligne L1 incorrecte (alias %, mine %, certifiée %)',
      v_row.seller_alias, v_row.is_mine, v_row.certified;
  end if;

  -- Filtres combinés.
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_domain => 'coin');
  if v_ids <> '01,04,07' then raise exception 'filtre domaine : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_mode => 'exchange');
  if v_ids <> '01,07,08' then raise exception 'filtre échange : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_mode => 'sale');
  if v_ids <> '01,04,06' then raise exception 'filtre vente : vu %', v_ids; end if;
  -- Recherche insensible aux accents et à la casse, sur titre + souhaits.
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_text => 'NAPOLEON or');
  if v_ids <> '01' then raise exception 'recherche accents : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_text => 'second empire');
  if v_ids <> '01' then raise exception 'recherche souhaits : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_min_price => 200, p_max_price => 320);
  if v_ids <> '01,04,07' then raise exception 'filtre prix : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',') into v_ids
  from public.market_catalogue(p_sort => 'price_asc');
  if v_ids <> '06,04,07,01,08' then raise exception 'tri prix croissant : vu %', v_ids; end if;
  select string_agg(right(id::text, 2), ',') into v_ids
  from public.market_catalogue(p_sort => 'price_desc', p_limit => 2);
  if v_ids <> '08,01' then raise exception 'tri décroissant + limite : vu %', v_ids; end if;
  select count(*) into v_count from public.market_catalogue(p_limit => 0);
  if v_count <> 1 then raise exception 'limite bornée à 1 minimum : vu %', v_count; end if;
  perform public._mkt_expect_error('select * from public.market_catalogue(p_sort => ''hasard'')', '%Tri de catalogue inconnu%');
  perform public._mkt_expect_error('select * from public.market_catalogue(p_mode => ''don'')', '%Mode de catalogue inconnu%');

  -- Mes annonces exclues par défaut, incluses sur demande.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select count(*) into v_count from public.market_catalogue();
  if v_count <> 0 then raise exception 'catalogue : Sophie voit ses annonces par défaut (%)', v_count; end if;
  select count(*) into v_count from public.market_catalogue(p_include_mine => true) c where c.is_mine;
  if v_count <> 5 then raise exception 'catalogue : 5 annonces « miennes » attendues, vu %', v_count; end if;

  -- Réputation par pseudonyme ; pseudonyme inconnu ⇒ null.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  if (public.member_reputation(v_alias) ->> 'completedSales')::int <> 0 then
    raise exception 'réputation par pseudonyme incorrecte';
  end if;
  if public.member_reputation('Collectionneur ZZZZ') is not null then
    raise exception 'réputation : pseudonyme inconnu ⇒ null attendu';
  end if;

  -- Hors Platine : catalogue et réputation refusés (VL402).
  perform set_config('velum.uid', '54000000-0000-4000-8000-000000000004', true);
  perform public._mkt_expect_error('select * from public.market_catalogue()', 'VL402');
  perform public._mkt_expect_error(format('select public.member_reputation(%L)', v_alias), 'VL402');
  raise notice 'OK M5 — catalogue anonymisé (table et RPC), filtres par catégorie/mode/texte/prix, Platine';
end
$$;

-- ── 5. Décision de l'expert sur les annonces retenues ────────────────────────
select public.assign_certification_expert(
  (select id from public.certification_requests
   where listing_id = '71000000-0000-4000-8000-000000000002' and status = 'requested'), 40);
select public.decide_certification(
  (select id from public.certification_requests
   where listing_id = '71000000-0000-4000-8000-000000000002' and status = 'in_review'),
  true, 'expertises/sophie/citex.pdf', 'Bloc authentique, gomme d''origine');
select public.decide_certification(
  (select id from public.certification_requests
   where listing_id = '71000000-0000-4000-8000-000000000005' and status = 'requested'),
  false, null, 'Signature apocryphe');

do $$
declare
  v_status text;
  v_ref text;
  v_ids text;
  v_cert uuid;
  v_count integer;
begin
  select status, expert_appraisal_ref into v_status, v_ref
  from public.listings where id = '71000000-0000-4000-8000-000000000002';
  if v_status <> 'active' or v_ref <> 'expertises/sophie/citex.pdf' then
    raise exception 'L2 certifiée : active + rapport attendus (% / %)', v_status, v_ref;
  end if;
  select status into v_status from public.listings where id = '71000000-0000-4000-8000-000000000005';
  if v_status <> 'draft' then
    raise exception 'L5 refusée : annonce non publiée (draft) attendue, vu %', v_status;
  end if;

  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select string_agg(right(id::text, 2), ',' order by id) into v_ids
  from public.market_catalogue(p_certified_only => true);
  if v_ids <> '02' then raise exception 'filtre certifiées : vu %', v_ids; end if;

  -- Republier L5 sans certification : retenue de nouveau, nouvelle demande ;
  -- la vendeuse l'abandonne ⇒ annonce non publiée.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  update public.listings set status = 'active' where id = '71000000-0000-4000-8000-000000000005';
  select status into v_status from public.listings where id = '71000000-0000-4000-8000-000000000005';
  if v_status <> 'pending_certification' then
    raise exception 'L5 republiée : pending_certification attendu, vu %', v_status;
  end if;
  select c.id into v_cert from public.my_certifications() c
  where c.listing_id = '71000000-0000-4000-8000-000000000005' and c.status = 'requested';
  perform public.cancel_certification(v_cert);
  select status into v_status from public.listings where id = '71000000-0000-4000-8000-000000000005';
  if v_status <> 'draft' then
    raise exception 'L5 : certification abandonnée ⇒ draft attendu, vu %', v_status;
  end if;

  -- Certification volontaire sur sa propre annonce (badge), invisible des tiers.
  select c.id into v_cert
  from public.request_certification('voluntary', p_listing => '71000000-0000-4000-8000-000000000006') c;
  if v_cert is null then raise exception 'certification volontaire non créée'; end if;
  perform public._mkt_expect_error(
    $q$select * from public.request_certification('voluntary', p_listing => '71000000-0000-4000-8000-000000000006')$q$,
    '%déjà ouverte%');
  perform public._mkt_expect_error(
    $q$select * from public.request_certification('mutual_agreement', p_listing => '71000000-0000-4000-8000-000000000004')$q$,
    '%commande ou un échange%');
  perform public.cancel_certification(v_cert);
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select count(*) into v_count from public.my_certifications();
  if v_count <> 0 then raise exception 'certifications : Paul voit % demande(s) d''autrui', v_count; end if;
  select count(*) into v_count from public.certification_requests;
  if v_count <> 0 then raise exception 'certifications : Paul lit % ligne(s) en direct', v_count; end if;
  raise notice 'OK M6 — décision d''expert : badge et publication, refus ⇒ non publiée, volontaire';
end
$$;

-- ── 6. Ventes : anonymat des commandes, accord mutuel, réservation ───────────
do $$
declare
  v_order uuid;
  v_order6 uuid;
  v_order6b uuid;
  v_cert uuid;
  v_row record;
  v_alias_sophie text;
  v_alias_paul text;
  v_count integer;
  v_state text;
begin
  select alias into v_alias_sophie from public.market_aliases where member_id = '51000000-0000-4000-8000-000000000001';
  select alias into v_alias_paul from public.market_aliases where member_id = '52000000-0000-4000-8000-000000000002';
  set local role authenticated;

  -- Tiers ouvre L9 à l'échange ; Sophie y offre l'objet de son annonce L6.
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  insert into public.listings (id, item_id, seller_id, ask_price, kind)
  values ('71000000-0000-4000-8000-000000000009', '63000000-0000-4000-8000-000000000002',
          '53000000-0000-4000-8000-000000000003', 280, 'exchange');
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.propose_exchange(
    '71000000-0000-4000-8000-000000000009', '61000000-0000-4000-8000-000000000006', 120);

  -- Paul achète L4 (200 €) : vue anonymisée.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.market_buy('71000000-0000-4000-8000-000000000004');
  v_order := v_row.id;
  if v_row.role <> 'buyer' or v_row.counterparty_alias <> v_alias_sophie
     or v_row.seller_id is not null or v_row.buyer_id <> '52000000-0000-4000-8000-000000000002'
     or v_row.amount <> 200 or v_row.listing_title <> 'Écu Louis XV 1726'
     or v_row.escrow_state <> 'pending_payment' then
    raise exception 'commande : vue anonymisée incorrecte (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(
    format('select seller_id from public.orders where id = %L', v_order), '42501');
  perform public._mkt_expect_error(
    format('update public.orders set amount = 1 where id = %L', v_order), '42501');
  perform public._mkt_expect_error(
    $q$select * from public.market_buy('71000000-0000-4000-8000-000000000004')$q$, '%déjà une commande%');
  perform public._mkt_expect_error(
    $q$select * from public.market_buy('71000000-0000-4000-8000-000000000007')$q$, '%uniquement à l''échange%');

  -- Accord mutuel : Paul demande, ne peut pas s'auto-accorder.
  select c.id into v_cert from public.request_certification('mutual_agreement', p_order => v_order) c;
  select status into v_state from public.my_certifications(v_cert);
  if v_state <> 'awaiting_agreement' then raise exception 'accord mutuel : statut initial %', v_state; end if;
  perform public._mkt_expect_error(format('select * from public.respond_certification(%L, true)', v_cert),
    '%introuvable ou déjà traitée%');
  perform public.advance_market_order(v_order, 'funds_held');

  -- Sophie ne peut pas expédier tant que la certification est ouverte.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select * into v_row from public.my_market_orders(v_order);
  if v_row.role <> 'seller' or v_row.counterparty_alias <> v_alias_paul or v_row.buyer_id is not null then
    raise exception 'commande côté vendeuse : vue incorrecte (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(
    format('select * from public.advance_market_order(%L, ''shipped'', ''Colissimo'', ''CO-1'')', v_order),
    '%Expédition bloquée%');
  perform public.respond_certification(v_cert, true);
  select certification_required into v_row from public.my_market_orders(v_order);
  if not v_row.certification_required then raise exception 'commande : certification requise attendue'; end if;
  perform public._mkt_expect_error(
    format('select * from public.cancel_certification(%L)', v_cert), '%Transition de certification interdite%');

  -- Expert : certifié, frais 30 € partagés.
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, true, 'expertises/ecu.pdf', null, 30);
  set local role authenticated;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.advance_market_order(v_order, 'shipped', 'Colissimo', 'CO-1');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select escrow_state into v_state from public.advance_market_order(v_order, 'released');
  if v_state <> 'released' then raise exception 'commande : libération attendue, vu %', v_state; end if;

  -- Réservation : deux acheteurs pour L6 ; le premier qui paie l'emporte.
  select id into v_order6 from public.market_buy('71000000-0000-4000-8000-000000000006');
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  select id into v_order6b from public.market_buy('71000000-0000-4000-8000-000000000006');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public.advance_market_order(v_order6, 'funds_held');
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  select escrow_state into v_state from public.my_market_orders(v_order6b);
  if v_state <> 'cancelled' then raise exception 'réservation : commande concurrente annulée attendue, vu %', v_state; end if;
  perform public._mkt_expect_error(
    $q$select * from public.market_buy('71000000-0000-4000-8000-000000000006')$q$, '%déjà réservée%');
  select count(*) into v_count from public.market_catalogue() c where c.id = '71000000-0000-4000-8000-000000000006';
  if v_count <> 0 then raise exception 'réservation : annonce réservée encore au catalogue'; end if;
  -- Objet vendu (paiement capturé) : la proposition de Sophie qui l'offrait est retirée.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select e.state into v_state from public.my_exchanges() e
  where e.listing_id = '71000000-0000-4000-8000-000000000009';
  if v_state <> 'withdrawn' then
    raise exception 'réservation : proposition offrant l''objet vendu retirée attendue, vu %', v_state;
  end if;

  -- Accord mutuel sur L6 : refus d'abord, puis accord et refus de l'expert.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select c.id into v_cert from public.request_certification('mutual_agreement', p_order => v_order6) c;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select status into v_state from public.respond_certification(v_cert, false);
  if v_state <> 'cancelled' then raise exception 'accord refusé : cancelled attendu, vu %', v_state; end if;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select c.id into v_cert from public.request_certification('mutual_agreement', p_order => v_order6, p_fee_payer => 'split') c;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.respond_certification(v_cert, true);
  -- La vendeuse ne peut pas retirer une annonce engagée.
  perform public._mkt_expect_error(
    $q$update public.listings set status = 'withdrawn' where id = '71000000-0000-4000-8000-000000000006'$q$,
    '%engagée%');
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, false, null, 'Réimpression', 20);
  select escrow_state into v_state from public.orders where id = v_order6;
  if v_state <> 'cancelled' then raise exception 'refus d''expert : commande annulée attendue, vu %', v_state; end if;
  raise notice 'OK M7 — ventes : commandes anonymisées, accord mutuel (refus/accord), expédition bloquée, réservation';
end
$$;

-- ── 7. Échanges : machine à états acteur par acteur, commissions figées ─────
do $$
declare
  v_ex uuid;
  v_ex_tiers uuid;
  v_row record;
  v_alias_paul text;
  v_count integer;
  v_state text;
begin
  select alias into v_alias_paul from public.market_aliases where member_id = '52000000-0000-4000-8000-000000000002';
  set local role authenticated;

  -- Garde-fous de création.
  perform set_config('velum.uid', '54000000-0000-4000-8000-000000000004', true);
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 100)$q$,
    'VL402');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 100)$q$,
    '%pas ouverte à l''échange%');
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 100)$q$,
    '%appartenir à votre collection%');
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 0)$q$,
    '%strictement positive%');
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 300, 900)$q$,
    '%Soulte trop élevée%');
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 100)$q$,
    '%sa propre annonce%');

  -- Tiers puis Paul proposent sur L1 ; message de Paul expurgé.
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  select id into v_ex_tiers from public.propose_exchange(
    '71000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', 300);
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.propose_exchange(
    '71000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 300, 20,
    'Bonjour, écrivez-moi à paul.durand@free.fr');
  v_ex := v_row.id;
  if v_row.state <> 'proposed' or v_row.role <> 'proposer' or v_row.message like '%free.fr%'
     or v_row.my_commission is not null or v_row.listing_value <> 320 then
    raise exception 'proposition : vue incorrecte (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(
    $q$select * from public.propose_exchange('71000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', 50)$q$,
    '%déjà une proposition en attente%');
  -- Le proposeur ne peut ni accepter sa propre proposition, ni lire l'identité.
  perform public._mkt_expect_error(format('select * from public.respond_exchange(%L, true)', v_ex), '%introuvable%');
  perform public._mkt_expect_error(
    format('select recipient_id from public.exchange_proposals where id = %L', v_ex), '42501');

  -- Le destinataire : vue anonymisée, aucun identifiant de membre ni d'objet.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select * into v_row from public.my_exchanges(v_ex);
  if v_row.role <> 'recipient' or v_row.counterparty_alias <> v_alias_paul
     or v_row.offered_title <> 'Marianne 10 Francs or 1907' then
    raise exception 'proposition côté destinataire : vue incorrecte (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(
    format('select offered_item_id from public.exchange_proposals where id = %L', v_ex), '42501');
  perform public._mkt_expect_error(
    format('select proposer_id from public.exchange_proposals where id = %L', v_ex), '42501');
  perform public._mkt_expect_error(format('select * from public.withdraw_exchange(%L)', v_ex), '%introuvable%');
  perform public._mkt_expect_error(
    format('update public.exchange_proposals set state = ''accepted'' where id = %L', v_ex), '42501');

  -- Sur L1, un tiers ne voit que SA proposition (pas celle de Paul).
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  select count(*) into v_count from public.my_exchanges() e
  where e.listing_id = '71000000-0000-4000-8000-000000000001';
  if v_count <> 1 then raise exception 'échanges : Tiers voit % proposition(s) sur L1', v_count; end if;
  perform public._mkt_expect_error(format('select * from public.cancel_exchange(%L)', v_ex), '%introuvable%');

  -- Acceptation par Sophie : phase d'expédition directe (aucun objet > seuil),
  -- commissions FIGÉES (5 % × objet cédé), proposition concurrente déclinée,
  -- et la proposition où Sophie offrait ce même objet ailleurs est retirée.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.propose_exchange(
    '71000000-0000-4000-8000-000000000009', '61000000-0000-4000-8000-000000000001', 280);
  select * into v_row from public.respond_exchange(v_ex, true);
  if v_row.state <> 'shipping' or v_row.my_commission <> 16.00 or v_row.certification_required then
    raise exception 'acceptation : vue destinataire incorrecte (%)', row_to_json(v_row);
  end if;
  select e.state into v_state from public.my_exchanges() e
  where e.listing_id = '71000000-0000-4000-8000-000000000009' and e.offered_title like 'Napoléon%';
  if v_state <> 'withdrawn' then
    raise exception 'acceptation : offre du même objet ailleurs retirée attendue, vu %', v_state;
  end if;
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  select state into v_state from public.my_exchanges(v_ex_tiers);
  if v_state <> 'declined' then raise exception 'acceptation : proposition concurrente déclinée attendue, vu %', v_state; end if;
  perform public._mkt_expect_error(
    $q$select * from public.market_buy('71000000-0000-4000-8000-000000000001')$q$, '%réservée%');
  select count(*) into v_count from public.market_catalogue() c where c.id = '71000000-0000-4000-8000-000000000001';
  if v_count <> 0 then raise exception 'acceptation : annonce réservée encore au catalogue'; end if;

  -- Commission figée : Paul passe au palier 4 % après coup — sans effet.
  reset role;
  perform set_config('velum.uid', '', true);
  insert into public.listings (item_id, seller_id, ask_price, status)
  select '62000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 10, 'sold'
  from generate_series(1, 10);
  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select my_commission into v_row from public.my_exchanges(v_ex);
  if v_row.my_commission <> 15.00 then
    raise exception 'commission figée : 15,00 attendu (5 %% de 300), vu %', v_row.my_commission;
  end if;

  -- Expédition et réception, chacun pour soi.
  perform public._mkt_expect_error(
    format('select * from public.confirm_exchange_receipt(%L)', v_ex), '%pas encore expédié%');
  perform public._mkt_expect_error(format('select * from public.ship_exchange(%L, ''  '')', v_ex), '%suivi requis%');
  perform public.ship_exchange(v_ex, 'PA-1', 'Mondial Relay');
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  -- La vendeuse ne peut plus retirer l'annonce engagée.
  perform public._mkt_expect_error(
    $q$update public.listings set status = 'withdrawn' where id = '71000000-0000-4000-8000-000000000001'$q$,
    '%engagée%');
  perform public.ship_exchange(v_ex, 'SO-1');
  -- Après une expédition, plus d'annulation unilatérale (litige seulement).
  perform public._mkt_expect_error(format('select * from public.cancel_exchange(%L)', v_ex), '%Transition d''échange interdite%');
  select state, proposer_tracking, recipient_tracking into v_row from public.confirm_exchange_receipt(v_ex);
  if v_row.state <> 'shipping' or v_row.proposer_tracking <> 'PA-1' or v_row.recipient_tracking <> 'SO-1' then
    raise exception 'réception partielle : vue incorrecte (%)', row_to_json(v_row);
  end if;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select state into v_state from public.confirm_exchange_receipt(v_ex);
  if v_state <> 'completed' then raise exception 'échange : conclusion attendue, vu %', v_state; end if;

  reset role;
  select status into v_state from public.listings where id = '71000000-0000-4000-8000-000000000001';
  if v_state <> 'exchanged' then raise exception 'échange conclu : annonce exchanged attendue, vu %', v_state; end if;
  raise notice 'OK M8 — échange nominal : acteurs légaux, anonymat, réservation, commissions figées, conclusion';
end
$$;

-- Variantes du cycle de vie sur L7 (échange seul, 250 €).
do $$
declare
  v_ex uuid;
  v_state text;
  v_count integer;
begin
  set local role authenticated;

  -- Retrait par l'auteur ; le destinataire ne peut plus répondre.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  select state into v_state from public.withdraw_exchange(v_ex);
  if v_state <> 'withdrawn' then raise exception 'retrait : vu %', v_state; end if;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public._mkt_expect_error(format('select * from public.respond_exchange(%L, true)', v_ex), '%Transition d''échange interdite%');

  -- Refus par le destinataire.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select state into v_state from public.respond_exchange(v_ex, false);
  if v_state <> 'declined' then raise exception 'refus : vu %', v_state; end if;

  -- Expiration (système) : plus d'acceptation possible.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  reset role;
  perform set_config('velum.uid', '', true);
  -- Échéance antidatée (le client ne peut pas la modifier : drapeau système).
  perform set_config('velum.system_action', '1', true);
  update public.exchange_proposals set expires_at = now() - interval '1 minute' where id = v_ex;
  perform set_config('velum.system_action', '', true);
  if public.expire_stale_exchanges() <> 1 then raise exception 'expiration : 1 proposition attendue'; end if;
  set local role authenticated;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select state into v_state from public.my_exchanges(v_ex);
  if v_state <> 'expired' then raise exception 'expiration : vu %', v_state; end if;

  -- Acceptation puis annulation AVANT expédition par une partie : annonce libérée.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.respond_exchange(v_ex, true);
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select state into v_state from public.cancel_exchange(v_ex);
  if v_state <> 'cancelled' then raise exception 'annulation avant expédition : vu %', v_state; end if;
  select count(*) into v_count from public.market_catalogue() c where c.id = '71000000-0000-4000-8000-000000000007';
  if v_count <> 1 then raise exception 'annulation : annonce L7 de retour au catalogue attendue'; end if;

  -- Litige après expédition, arbitrage (annulation).
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.respond_exchange(v_ex, true);
  perform public.ship_exchange(v_ex, 'SO-2');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public._mkt_expect_error(format('select * from public.dispute_exchange(%L, '' '')', v_ex), '%Motif du litige requis%');
  select state into v_state from public.dispute_exchange(v_ex, 'Objet reçu abîmé');
  if v_state <> 'disputed' then raise exception 'litige : vu %', v_state; end if;
  perform public._mkt_expect_error(format('select * from public.cancel_exchange(%L)', v_ex), '%Transition d''échange interdite%');
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.resolve_exchange_dispute(v_ex, false, 'Remboursement des frais de port');
  select state into v_state from public.exchange_proposals where id = v_ex;
  if v_state <> 'cancelled' then raise exception 'arbitrage : vu %', v_state; end if;

  -- Auto-confirmation J+X après livraison des deux colis (cron).
  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000002', 240);
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public.respond_exchange(v_ex, true);
  perform public.ship_exchange(v_ex, 'SO-3');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public.ship_exchange(v_ex, 'PA-3');
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.record_exchange_delivery(v_ex, 'proposer', now() - interval '9 days');
  if public.complete_due_exchanges() <> 0 then raise exception 'auto-confirmation prématurée (un seul colis livré)'; end if;
  perform public.record_exchange_delivery(v_ex, 'recipient', now() - interval '8 days');
  if public.complete_due_exchanges() <> 1 then raise exception 'auto-confirmation : 1 échange attendu'; end if;
  select state into v_state from public.exchange_proposals where id = v_ex;
  if v_state <> 'completed' then raise exception 'auto-confirmation : vu %', v_state; end if;
  select status into v_state from public.listings where id = '71000000-0000-4000-8000-000000000007';
  if v_state <> 'exchanged' then raise exception 'auto-confirmation : annonce exchanged attendue, vu %', v_state; end if;
  raise notice 'OK M9 — cycle de vie : retrait, refus, expiration, annulation, litige, auto-confirmation';
end
$$;

-- ── 8. Certification dans un échange : seuil (estimation) puis accord mutuel ─
do $$
declare
  v_ex uuid;
  v_cert uuid;
  v_row record;
  v_state text;
  v_count integer;
begin
  set local role authenticated;
  -- Paul déclare 450 € une montre ESTIMÉE 800 € : certification obligatoire.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select id into v_ex from public.propose_exchange('71000000-0000-4000-8000-000000000008', '62000000-0000-4000-8000-000000000003', 450);
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select * into v_row from public.respond_exchange(v_ex, true);
  if v_row.state <> 'awaiting_certification' or not v_row.certification_required then
    raise exception 'échange > seuil : awaiting_certification attendu (%)', row_to_json(v_row);
  end if;
  select count(*) into v_count from public.my_certifications() c
  where c.exchange_id = v_ex and c.reason = 'threshold' and c.status = 'requested'
    and c.item_title = 'Omega Speedmaster 1969' and not c.requested_by_me;
  if v_count <> 1 then raise exception 'échange > seuil : 1 certification de la montre attendue, vu %', v_count; end if;

  -- Expédition impossible avant certification ; objet engagé non supprimable.
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public._mkt_expect_error(format('select * from public.ship_exchange(%L, ''PA-9'')', v_ex), '%phase d''expédition%');
  perform public._mkt_expect_error(
    $q$delete from public.items where id = '62000000-0000-4000-8000-000000000003'$q$, '%engagé%');
  select c.id into v_cert from public.my_certifications() c where c.exchange_id = v_ex;
  perform public._mkt_expect_error(format('select * from public.cancel_certification(%L)', v_cert), '%Transition de certification interdite%');

  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, true, 'expertises/omega.pdf', null, 60);
  select state into v_state from public.exchange_proposals where id = v_ex;
  if v_state <> 'shipping' then raise exception 'certification obtenue : shipping attendu, vu %', v_state; end if;

  -- Accord mutuel : Paul fait expertiser l'objet qu'il REÇOIT ; la montre
  -- déjà certifiée ne peut l'être de nouveau.
  set local role authenticated;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public._mkt_expect_error(
    format('select * from public.request_certification(''mutual_agreement'', p_exchange => %L)', v_ex),
    '%déjà obtenue ou demandée%');
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select c.id into v_cert from public.request_certification('mutual_agreement', p_exchange => v_ex) c;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public._mkt_expect_error(format('select * from public.ship_exchange(%L, ''SO-9'')', v_ex), '%Expédition bloquée%');
  perform public.respond_certification(v_cert, true);
  select state into v_state from public.my_exchanges(v_ex);
  if v_state <> 'awaiting_certification' then
    raise exception 'accord mutuel conclu avant expédition : awaiting_certification attendu, vu %', v_state;
  end if;

  -- Refus de l'expert : échange annulé.
  reset role;
  perform set_config('velum.uid', '', true);
  perform public.decide_certification(v_cert, false, null, 'Cadran refait');
  select state into v_state from public.exchange_proposals where id = v_ex;
  if v_state <> 'cancelled' then raise exception 'refus d''expert : échange annulé attendu, vu %', v_state; end if;
  raise notice 'OK M10 — certification dans un échange : seuil sur estimation, accord mutuel, refus ⇒ annulation';
end
$$;

-- ── 9. Messagerie anonymisée, restreinte aux parties ─────────────────────────
do $$
declare
  v_order uuid;
  v_row record;
  v_alias_paul text;
  v_count integer;
begin
  select alias into v_alias_paul from public.market_aliases where member_id = '52000000-0000-4000-8000-000000000002';
  select id into v_order from public.orders where listing_id = '71000000-0000-4000-8000-000000000004';
  set local role authenticated;

  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select * into v_row from public.send_market_message('order', v_order, '  Merci ! Joignable au 06 12 34 56 78  ');
  if not v_row.mine or not v_row.redacted or v_row.body <> 'Merci ! Joignable au [coordonnées masquées]' then
    raise exception 'message : envoi incorrect (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(format('select * from public.send_market_message(''order'', %L, ''   '')', v_order), '%Message vide%');

  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  select * into v_row from public.thread_messages('order', v_order);
  if v_row.mine or v_row.author_alias <> v_alias_paul or v_row.body like '%06 12%' then
    raise exception 'message : lecture par la vendeuse incorrecte (%)', row_to_json(v_row);
  end if;
  perform public._mkt_expect_error(
    format('select author_id from public.market_messages where thread_id = %L', v_order), '42501');
  perform public.send_market_message('order', v_order, 'Bonne réception !');

  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  perform public._mkt_expect_error(format('select * from public.thread_messages(''order'', %L)', v_order), 'VL401');
  perform public._mkt_expect_error(format('select * from public.send_market_message(''order'', %L, ''intrus'')', v_order), 'VL401');
  select count(*) into v_count from public.market_messages;
  if v_count <> 0 then raise exception 'messagerie : un tiers lit % message(s)', v_count; end if;

  reset role;
  select count(*) into v_count from public.notifications
  where owner_id = '51000000-0000-4000-8000-000000000001' and title = 'Nouveau message';
  if v_count <> 1 then raise exception 'messagerie : notification de la vendeuse attendue, vu %', v_count; end if;
  raise notice 'OK M11 — messagerie : parties seules, corps expurgé, auteur pseudonymisé';
end
$$;

-- ── 10. Registre de la plateforme et synthèse du commissionnement ───────────
do $$
declare
  v_amount numeric;
  v_count integer;
  v_summary jsonb;
begin
  -- Vente L4 (200 €, 5 %) : commission 10 €, versement net 190 €.
  select amount into v_amount from public.platform_ledger
  where member_id = '51000000-0000-4000-8000-000000000001' and kind = 'commission'
    and order_id = (select id from public.orders where listing_id = '71000000-0000-4000-8000-000000000004');
  if v_amount <> 10.00 then raise exception 'registre : commission de vente 10 attendue, vu %', v_amount; end if;
  select amount into v_amount from public.platform_ledger
  where member_id = '51000000-0000-4000-8000-000000000001' and kind = 'payout'
    and order_id = (select id from public.orders where listing_id = '71000000-0000-4000-8000-000000000004');
  if v_amount <> 190.00 then raise exception 'registre : versement net 190 attendu, vu %', v_amount; end if;

  -- Échange L1 : commissions figées (16 € / 15 €) et soulte de 20 € versée à Sophie.
  select sum(amount) into v_amount from public.platform_ledger l
  join public.exchange_proposals e on e.id = l.exchange_id
  where e.listing_id = '71000000-0000-4000-8000-000000000001' and e.state = 'completed' and l.kind = 'commission';
  if v_amount <> 31.00 then raise exception 'registre : commissions d''échange 31 attendues, vu %', v_amount; end if;
  select amount into v_amount from public.platform_ledger l
  join public.exchange_proposals e on e.id = l.exchange_id
  where e.listing_id = '71000000-0000-4000-8000-000000000001' and l.kind = 'payout'
    and l.member_id = '51000000-0000-4000-8000-000000000001';
  if v_amount <> 20.00 then raise exception 'registre : soulte 20 attendue, vu %', v_amount; end if;

  -- Frais d'expertise : 40 € vendeur (L2), 30 € partagés (L4), 20 € partagés
  -- (L6, refusée), 60 € propriétaire de la montre (Paul).
  select sum(amount) into v_amount from public.platform_ledger
  where member_id = '51000000-0000-4000-8000-000000000001' and kind = 'certification_fee';
  if v_amount <> 65.00 then raise exception 'registre : frais d''expertise Sophie 65 attendus, vu %', v_amount; end if;
  select sum(amount) into v_amount from public.platform_ledger
  where member_id = '52000000-0000-4000-8000-000000000002' and kind = 'certification_fee';
  if v_amount <> 85.00 then raise exception 'registre : frais d''expertise Paul 85 attendus, vu %', v_amount; end if;
  -- Décisions d'expert notifiées aux DEUX parties (écu demandé par Paul,
  -- montre de Paul) — y compris quand l'acheteur est le demandeur.
  select count(*) into v_count from public.notifications
  where owner_id = '52000000-0000-4000-8000-000000000002' and title = 'Objet certifié par un expert';
  if v_count <> 2 then raise exception 'notifications : 2 certifications attendues pour Paul, vu %', v_count; end if;

  -- Lecture limitée au membre concerné.
  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  select count(*) into v_count from public.platform_ledger
  where member_id <> '52000000-0000-4000-8000-000000000002';
  if v_count <> 0 then raise exception 'registre : Paul lit % écriture(s) d''autrui', v_count; end if;
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  v_summary := public.my_commission_summary();
  if (v_summary ->> 'completedSales')::int <> 1
     or (v_summary ->> 'currentRate')::numeric <> 0.05
     or (v_summary ->> 'commissions')::numeric <> 38.50
     or (v_summary ->> 'payouts')::numeric <> 210.00
     or (v_summary ->> 'certificationFees')::numeric <> 65.00 then
    raise exception 'synthèse de commissionnement incorrecte : %', v_summary;
  end if;
  raise notice 'OK M12 — registre : commission à la libération, commissions d''échange, soulte, frais partagés';
end
$$;

-- ── 11. Fonctions système et suppressions protégées ──────────────────────────
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.decide_certification(uuid, boolean, text, text, numeric)',
    'public.assign_certification_expert(uuid, numeric)',
    'public.record_order_delivery(uuid, timestamptz)',
    'public.record_exchange_delivery(uuid, text, timestamptz)',
    'public.resolve_exchange_dispute(uuid, boolean, text)',
    'public.expire_stale_exchanges()',
    'public.complete_due_exchanges()',
    'public.resolve_dispute(uuid, boolean, text)',
    'public.release_due_orders()',
    'public._market_reference_value(uuid, numeric)',
    'public._exchange_threshold_targets(uuid)'
  ] loop
    if has_function_privilege('authenticated', v_fn, 'execute')
       or has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'droits : % exécutable par un client', v_fn;
    end if;
  end loop;

  set local role authenticated;
  perform set_config('velum.uid', '52000000-0000-4000-8000-000000000002', true);
  perform public._mkt_expect_error(
    format('select public.resolve_dispute(%L, true)', gen_random_uuid()), '42501');
  -- Une annonce avec historique de transactions ne se supprime pas.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  perform public._mkt_expect_error(
    $q$delete from public.listings where id = '71000000-0000-4000-8000-000000000006'$q$, '%retirez-la%');
  raise notice 'OK M13 — fonctions système réservées au service_role, suppressions protégées';
end
$$;

-- ── 12. Suppressions : historique conservé, purge RGPD complète ──────────────
do $$
declare
  v_item uuid;
  v_status text;
  v_count integer;
begin
  set local role authenticated;
  -- Sophie supprime l'écu VENDU : l'annonce est détachée, la commande de
  -- l'acheteur et le registre restent intacts.
  perform set_config('velum.uid', '51000000-0000-4000-8000-000000000001', true);
  delete from public.items where id = '61000000-0000-4000-8000-000000000004';
  -- Objet d'une annonce ouverte (bloc certifié) : annonce retirée, certification détachée.
  delete from public.items where id = '61000000-0000-4000-8000-000000000002';
  -- Tiers supprime un objet déjà offert dans une proposition déclinée.
  perform set_config('velum.uid', '53000000-0000-4000-8000-000000000003', true);
  delete from public.items where id = '63000000-0000-4000-8000-000000000001';
  reset role;
  perform set_config('velum.uid', '', true);

  select item_id, status into v_item, v_status
  from public.listings where id = '71000000-0000-4000-8000-000000000004';
  if v_item is not null or v_status <> 'sold' then
    raise exception 'suppression : annonce vendue détachée attendue (% / %)', v_item, v_status;
  end if;
  select count(*) into v_count from public.orders where listing_id = '71000000-0000-4000-8000-000000000004';
  if v_count <> 1 then raise exception 'suppression : commande de l''acheteur perdue (%)', v_count; end if;

  select item_id, status into v_item, v_status
  from public.listings where id = '71000000-0000-4000-8000-000000000002';
  if v_item is not null or v_status <> 'withdrawn' then
    raise exception 'suppression : annonce ouverte retirée attendue (% / %)', v_item, v_status;
  end if;
  select count(*) into v_count from public.certification_requests
  where listing_id = '71000000-0000-4000-8000-000000000002' and status = 'certified' and item_id is null;
  if v_count <> 1 then raise exception 'suppression : certification détachée attendue, vu %', v_count; end if;

  select count(*) into v_count from public.exchange_proposals
  where offered_title = 'Louis d''or 1786' and offered_item_id is null and state = 'declined';
  if v_count <> 1 then raise exception 'suppression : proposition détachée attendue, vu %', v_count; end if;
  raise notice 'OK M14 — supprimer un objet détache ses annonces et propositions (historique conservé)';
end
$$;

-- Purge RGPD d'un membre très actif (commandes, échanges, certifications,
-- messages, registre) : tout disparaît, sans blocage par les garde-fous.
delete from auth.users where id = '52000000-0000-4000-8000-000000000002';

do $$
declare
  v_count integer;
begin
  select
    (select count(*) from public.exchange_proposals
      where '52000000-0000-4000-8000-000000000002' in (proposer_id, recipient_id))
    + (select count(*) from public.orders
      where '52000000-0000-4000-8000-000000000002' in (buyer_id, seller_id))
    + (select count(*) from public.certification_requests
      where '52000000-0000-4000-8000-000000000002' in (owner_id, requested_by, counterparty_id))
    + (select count(*) from public.market_messages
      where author_id = '52000000-0000-4000-8000-000000000002')
    + (select count(*) from public.platform_ledger
      where member_id = '52000000-0000-4000-8000-000000000002')
    + (select count(*) from public.market_aliases
      where member_id = '52000000-0000-4000-8000-000000000002')
    + (select count(*) from public.listings
      where seller_id = '52000000-0000-4000-8000-000000000002')
  into v_count;
  if v_count <> 0 then
    raise exception 'purge RGPD : % ligne(s) du membre subsistent', v_count;
  end if;
  -- Les écritures de l'autre partie (Sophie) restent, détachées de l'échange purgé.
  select count(*) into v_count from public.platform_ledger
  where member_id = '51000000-0000-4000-8000-000000000001' and kind = 'payout' and note like 'Soulte%';
  if v_count <> 1 then raise exception 'purge RGPD : registre de la vendeuse altéré (%)', v_count; end if;
  raise notice 'OK M15 — purge RGPD : cascades complètes malgré les garde-fous';
end
$$;

drop function public._mkt_expect_error(text, text);

select 'MARKETPLACE CHECKS PASSED' as result;
