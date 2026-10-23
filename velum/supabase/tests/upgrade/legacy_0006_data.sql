-- ─────────────────────────────────────────────────────────────────────────────
-- Données HISTORIQUES (schéma 0006, communauté à séquestre) chargées par
-- run-local.sh sur une base intermédiaire, APRÈS la dernière migration
-- antérieure aux plateformes d'échange et de vente et AVANT les suivantes :
-- les rattrapages de 20261023100100 (un paiement par objet, une annonce
-- ouverte par objet, une commande en attente par acheteur et annonce, euro,
-- prix plancher, suivis en texte libre, puis certification réévaluée en fin
-- de migration) s'exécutent alors sur de vraies lignes 0006. Contrôles :
-- legacy_0006_checks.sql.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Sacha (vendeur), Bérénice (acheteuse), Camille (tiers), Dominique
-- (acheteur d'annonces épargnées) : offre Platine.
insert into auth.users (id, email, raw_user_meta_data) values
  ('b1000000-0000-4000-8000-000000000001', 'sacha@legacy.test', '{"display_name":"Sacha"}'),
  ('b2000000-0000-4000-8000-000000000002', 'berenice@legacy.test', '{"display_name":"Bérénice"}'),
  ('b3000000-0000-4000-8000-000000000003', 'camille@legacy.test', '{"display_name":"Camille"}'),
  ('b4000000-0000-4000-8000-000000000004', 'dominique@legacy.test', '{"display_name":"Dominique"}');
update public.profiles set plan = 'platine' where id in (
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000003',
  'b4000000-0000-4000-8000-000000000004');

insert into public.items (id, owner_id, domain, title) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Napoléon 20 Francs 1811'),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Jeton de présence'),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Thaler de Bavière'),
  ('c1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Gros de Flandre'),
  ('c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Obole de Melle'),
  ('c1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Écu aux lauriers'),
  ('c1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Liard de France'),
  ('c1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Denier tournois'),
  ('c1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Teston de Charles IX'),
  ('c1000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Blanc à la couronne'),
  ('c1000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Gros de Nesle'),
  ('c1000000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Double tournois'),
  ('c1000000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Franc à cheval'),
  ('c1000000-0000-4000-8000-000000000014', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Ducat de Venise'),
  ('c1000000-0000-4000-8000-000000000015', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Florin de Florence'),
  ('c1000000-0000-4000-8000-000000000016', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Denier parisis'),
  ('c1000000-0000-4000-8000-000000000017', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Louis aux palmes'),
  ('c1000000-0000-4000-8000-000000000018', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Sol de Louis XV'),
  ('c1000000-0000-4000-8000-000000000019', 'b1000000-0000-4000-8000-000000000001', 'coin', 'Blanc guénar'),
  ('c3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003', 'coin', 'Sou de Louis XVI');

-- Estimations VELUM au-delà du seuil (500 €) d'objets annoncés en dessous :
-- récente (1 mois), ancienne (19 mois : repli « dernière estimation passée »),
-- et sur un objet dont l'annonce est engagée (paiement capturé).
insert into public.valuations (
  item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, valued_at)
select v.item_id::uuid, 5000, 4500, 5500, 4000, 6000, 70, now() - v.age
from (values
  ('c1000000-0000-4000-8000-000000000014', interval '1 month'),
  ('c1000000-0000-4000-8000-000000000015', interval '19 months'),
  ('c1000000-0000-4000-8000-000000000016', interval '1 month')
) as v(item_id, age);

-- Annonces 0006 (triggers de l'époque : commission, titre, expertise).
insert into public.listings (id, item_id, seller_id, ask_price, currency, status, created_at) values
  -- Un objet, deux annonces ouvertes : la PUBLIÉE (commande en attente de
  -- paiement) est l'ancienne, le brouillon est récent.
  ('d1000000-0000-4000-8000-00000000001a', 'c1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 300, 'EUR', 'active', now() - interval '30 days'),
  ('d1000000-0000-4000-8000-00000000001b', 'c1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 320, 'EUR', 'draft', now() - interval '1 day'),
  -- Publiée à 0 €, commande en attente de paiement.
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   'b1000000-0000-4000-8000-000000000001', 0, 'EUR', 'active', now() - interval '20 days'),
  -- En dollars, paiement capturé (épargnée), puis sans transaction (retirée).
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000001', 40, 'USD', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004',
   'b1000000-0000-4000-8000-000000000001', 30, 'USD', 'active', now() - interval '20 days'),
  -- Sous le prix plancher, paiement capturé (épargnée).
  ('d1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005',
   'b1000000-0000-4000-8000-000000000001', 0.50, 'EUR', 'active', now() - interval '20 days'),
  -- Suivis saisis en texte libre (payée ; expédiées).
  ('d1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000006',
   'b1000000-0000-4000-8000-000000000001', 120, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000007',
   'b1000000-0000-4000-8000-000000000001', 60, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000008',
   'b1000000-0000-4000-8000-000000000001', 70, 'EUR', 'active', now() - interval '20 days'),
  -- Un objet, une annonce publiée à 0 € (ancienne) et un brouillon valable
  -- (récent) : le brouillon est la seule annonce encore recevable.
  ('d1000000-0000-4000-8000-00000000009a', 'c1000000-0000-4000-8000-000000000009',
   'b1000000-0000-4000-8000-000000000001', 0, 'EUR', 'active', now() - interval '10 days'),
  ('d1000000-0000-4000-8000-00000000009b', 'c1000000-0000-4000-8000-000000000009',
   'b1000000-0000-4000-8000-000000000001', 25, 'EUR', 'draft', now() - interval '2 days'),
  -- Un objet, une annonce publiée sans commande (ancienne) et un brouillon
  -- récent portant une commande en attente (le vendeur l'a dépubliée sous
  -- 0006) : la publiée reste la seule annonce ouverte.
  ('d1000000-0000-4000-8000-00000000010a', 'c1000000-0000-4000-8000-000000000010',
   'b1000000-0000-4000-8000-000000000001', 300, 'EUR', 'active', now() - interval '30 days'),
  ('d1000000-0000-4000-8000-00000000010b', 'c1000000-0000-4000-8000-000000000010',
   'b1000000-0000-4000-8000-000000000001', 320, 'EUR', 'draft', now() - interval '1 day'),
  -- Objets payés deux fois (0006 : aucun verrou à la capture) : deux
  -- annonces de l'objet payées chacune ; une annonce payée deux fois ; une
  -- annonce expédiée et une autre payée (plus tôt) pour le même objet.
  ('d1000000-0000-4000-8000-00000000011a', 'c1000000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001', 100, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-00000000011b', 'c1000000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001', 110, 'EUR', 'active', now() - interval '10 days'),
  ('d1000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001', 200, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-00000000013a', 'c1000000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001', 150, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-00000000013b', 'c1000000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001', 160, 'EUR', 'active', now() - interval '10 days'),
  -- Publiées à 400 € (légal sous 0003, qui ne regardait que le prix) alors
  -- que l'objet est estimé 5 000 € : la seconde porte une commande en attente.
  ('d1000000-0000-4000-8000-000000000014', 'c1000000-0000-4000-8000-000000000014',
   'b1000000-0000-4000-8000-000000000001', 400, 'EUR', 'active', now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000015', 'c1000000-0000-4000-8000-000000000015',
   'b1000000-0000-4000-8000-000000000001', 400, 'EUR', 'active', now() - interval '20 days'),
  -- Même cas, mais paiement capturé : la transaction se poursuit.
  ('d1000000-0000-4000-8000-000000000016', 'c1000000-0000-4000-8000-000000000016',
   'b1000000-0000-4000-8000-000000000001', 300, 'EUR', 'active', now() - interval '20 days');

-- « Référence du rapport d'expertise fourni par le vendeur » (0003) : posée
-- par le vendeur lui-même, sans décision d'expert VELUM. Publiée au-delà du
-- seuil (0003 l'exigeait), publiée sous le seuil, brouillon.
insert into public.listings (
  id, item_id, seller_id, ask_price, currency, status, expert_appraisal_ref, created_at) values
  ('d1000000-0000-4000-8000-000000000017', 'c1000000-0000-4000-8000-000000000017',
   'b1000000-0000-4000-8000-000000000001', 800, 'EUR', 'active', 'moi/rapport.pdf',
   now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000018', 'c1000000-0000-4000-8000-000000000018',
   'b1000000-0000-4000-8000-000000000001', 200, 'EUR', 'active', 'moi/rapport-sol.pdf',
   now() - interval '20 days'),
  ('d1000000-0000-4000-8000-000000000019', 'c1000000-0000-4000-8000-000000000019',
   'b1000000-0000-4000-8000-000000000001', 900, 'EUR', 'draft', 'moi/rapport-blanc.pdf',
   now() - interval '20 days');

-- Objet renommé après la création de son annonce (0006 ne copiait le titre
-- qu'à la création) : le titre public de l'annonce est périmé.
update public.items set title = 'Ducat de Venise, doge Mocenigo'
where id = 'c1000000-0000-4000-8000-000000000014';

-- Commandes 0006 dans leur état courant (machine à états contournée : on
-- reproduit des lignes existantes, pas un parcours).
set session_replication_role = replica;
insert into public.orders (
  id, listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state,
  carrier, tracking_number)
select v.id::uuid, v.listing_id::uuid, 'b2000000-0000-4000-8000-000000000002',
       'b1000000-0000-4000-8000-000000000001', v.amount, v.currency, 0.05, v.state,
       v.carrier, v.tracking
from (values
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000001a', 300, 'EUR',
   'pending_payment', null, null),
  ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 0, 'EUR',
   'pending_payment', null, null),
  ('e1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', 40, 'USD',
   'funds_held', null, null),
  ('e1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', 0.50, 'EUR',
   'funds_held', null, null),
  ('e1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000006', 120, 'EUR',
   'funds_held', 'Mon cousin, tel 06 12 34 56 78', 'Écrivez à sacha.martin@gmail.com'),
  ('e1000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000007', 60, 'EUR',
   'shipped', 'colissimo', ' 6a 123 456 '),
  ('e1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000008', 70, 'EUR',
   'shipped', 'La Poste', 'appelez-moi au 06 12 34 56 78, merci'),
  -- Objet « Franc à cheval » : expédié (récent) alors qu'une autre annonce de
  -- l'objet est payée (plus tôt, ci-dessous).
  ('e1000000-0000-4000-8000-000000000025', 'd1000000-0000-4000-8000-00000000013a', 150, 'EUR',
   'shipped', 'Colissimo', '6A999999')
) as v(id, listing_id, amount, currency, state, carrier, tracking);

-- Commandes 0006 datées (l'ordre de création compte pour les rattrapages).
insert into public.orders (
  id, listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state, created_at)
select v.id::uuid, v.listing_id::uuid, v.buyer_id::uuid,
       'b1000000-0000-4000-8000-000000000001', v.amount, v.currency, 0.05, v.state,
       now() - v.age
from (values
  -- Double appui sur « Acheter » (0006 : aucune unicité) : une commande en
  -- attente plus ancienne de Bérénice sur l'annonce publiée d…1a.
  ('e1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-00000000001a',
   'b2000000-0000-4000-8000-000000000002', 300, 'EUR', 'pending_payment', interval '2 days'),
  -- Commandes en attente de Dominique sur les annonces épargnées car
  -- engagées (en dollars ; sous le prix plancher).
  ('e1000000-0000-4000-8000-000000000013', 'd1000000-0000-4000-8000-000000000003',
   'b4000000-0000-4000-8000-000000000004', 40, 'USD', 'pending_payment', interval '1 day'),
  ('e1000000-0000-4000-8000-000000000014', 'd1000000-0000-4000-8000-000000000005',
   'b4000000-0000-4000-8000-000000000004', 0.50, 'EUR', 'pending_payment', interval '1 day'),
  -- Objets payés deux fois : le premier paiement (le plus ancien) l'emporte,
  -- sauf envoi déjà parti.
  ('e1000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-00000000011a',
   'b2000000-0000-4000-8000-000000000002', 100, 'EUR', 'funds_held', interval '5 days'),
  ('e1000000-0000-4000-8000-000000000022', 'd1000000-0000-4000-8000-00000000011b',
   'b3000000-0000-4000-8000-000000000003', 110, 'EUR', 'funds_held', interval '3 days'),
  ('e1000000-0000-4000-8000-000000000023', 'd1000000-0000-4000-8000-000000000012',
   'b2000000-0000-4000-8000-000000000002', 200, 'EUR', 'funds_held', interval '5 days'),
  ('e1000000-0000-4000-8000-000000000024', 'd1000000-0000-4000-8000-000000000012',
   'b3000000-0000-4000-8000-000000000003', 200, 'EUR', 'funds_held', interval '3 days'),
  ('e1000000-0000-4000-8000-000000000026', 'd1000000-0000-4000-8000-00000000013b',
   'b3000000-0000-4000-8000-000000000003', 160, 'EUR', 'funds_held', interval '5 days'),
  -- Commande en attente d'un brouillon (annonce dépubliée sous 0006).
  ('e1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-00000000010b',
   'b2000000-0000-4000-8000-000000000002', 320, 'EUR', 'pending_payment', interval '1 day'),
  -- Annonces sous-déclarées (estimation 5 000 €) : commande en attente de
  -- Camille, paiement capturé de Bérénice.
  ('e1000000-0000-4000-8000-000000000027', 'd1000000-0000-4000-8000-000000000015',
   'b3000000-0000-4000-8000-000000000003', 400, 'EUR', 'pending_payment', interval '3 days'),
  ('e1000000-0000-4000-8000-000000000028', 'd1000000-0000-4000-8000-000000000016',
   'b2000000-0000-4000-8000-000000000002', 300, 'EUR', 'funds_held', interval '3 days')
) as v(id, listing_id, buyer_id, amount, currency, state, age);
set session_replication_role = origin;

-- Edmond : offre Platine EXPIRÉE sous 0006 (aucun retrait à l'époque), ses
-- annonces toujours publiées — référence d'expertise déclarée par le vendeur
-- au-delà du seuil, annonce sous-déclarée (estimation 5 000 €) portant une
-- commande en attente de Camille, et annonce sous-déclarée dont le paiement
-- de Bérénice est capturé (engagée).
insert into auth.users (id, email, raw_user_meta_data) values
  ('b5000000-0000-4000-8000-000000000005', 'edmond@legacy.test', '{"display_name":"Edmond"}');
update public.profiles set plan = 'platine' where id = 'b5000000-0000-4000-8000-000000000005';
insert into public.items (id, owner_id, domain, title) values
  ('c5000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000005', 'watch', 'Jaeger Reverso'),
  ('c5000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000005', 'watch', 'Omega Constellation'),
  ('c5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000005', 'watch', 'Longines Conquest');
insert into public.valuations (
  item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, valued_at)
select v.item_id::uuid, 5000, 4500, 5500, 4000, 6000, 70, now() - interval '1 month'
from (values
  ('c5000000-0000-4000-8000-000000000002'),
  ('c5000000-0000-4000-8000-000000000003')
) as v(item_id);
insert into public.listings (
  id, item_id, seller_id, ask_price, currency, status, expert_appraisal_ref, created_at) values
  ('d5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001',
   'b5000000-0000-4000-8000-000000000005', 800, 'EUR', 'active', 'moi/rapport-reverso.pdf',
   now() - interval '20 days'),
  ('d5000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000002',
   'b5000000-0000-4000-8000-000000000005', 300, 'EUR', 'active', null, now() - interval '20 days'),
  ('d5000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000003',
   'b5000000-0000-4000-8000-000000000005', 300, 'EUR', 'active', null, now() - interval '20 days');
-- Expiration RevenueCat sous 0006.
update public.profiles set plan = 'free' where id = 'b5000000-0000-4000-8000-000000000005';
set session_replication_role = replica;
insert into public.orders (
  id, listing_id, buyer_id, seller_id, amount, currency, commission_rate, escrow_state, created_at)
values
  ('e5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002',
   'b3000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000005',
   300, 'EUR', 0.05, 'pending_payment', now() - interval '2 days'),
  ('e5000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000003',
   'b2000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000005',
   300, 'EUR', 0.05, 'funds_held', now() - interval '2 days');
set session_replication_role = origin;

select 'LEGACY 0006 DATA LOADED' as result;
