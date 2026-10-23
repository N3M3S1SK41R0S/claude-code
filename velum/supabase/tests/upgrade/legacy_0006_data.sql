-- ─────────────────────────────────────────────────────────────────────────────
-- Données HISTORIQUES (schéma 0006, communauté à séquestre) chargées par
-- run-local.sh sur une base intermédiaire, APRÈS la dernière migration
-- antérieure aux plateformes d'échange et de vente et AVANT les suivantes :
-- les rattrapages de 20261023100100 (une annonce ouverte par objet, euro,
-- prix plancher, suivis en texte libre) s'exécutent alors sur de vraies
-- lignes 0006. Contrôles : legacy_0006_checks.sql.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Sacha (vendeur), Bérénice (acheteuse), Camille (tiers) : offre Platine.
insert into auth.users (id, email, raw_user_meta_data) values
  ('b1000000-0000-4000-8000-000000000001', 'sacha@legacy.test', '{"display_name":"Sacha"}'),
  ('b2000000-0000-4000-8000-000000000002', 'berenice@legacy.test', '{"display_name":"Bérénice"}'),
  ('b3000000-0000-4000-8000-000000000003', 'camille@legacy.test', '{"display_name":"Camille"}');
update public.profiles set plan = 'platine' where id in (
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000003');

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
  ('c3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003', 'coin', 'Sou de Louis XVI');

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
   'b1000000-0000-4000-8000-000000000001', 25, 'EUR', 'draft', now() - interval '2 days');

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
   'shipped', 'La Poste', 'appelez-moi au 06 12 34 56 78, merci')
) as v(id, listing_id, amount, currency, state, carrier, tracking);
set session_replication_role = origin;

select 'LEGACY 0006 DATA LOADED' as result;
