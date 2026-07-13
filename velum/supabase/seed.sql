-- ─────────────────────────────────────────────────────────────────────────────
-- Seed de DÉVELOPPEMENT LOCAL — compte démo + collection d'exemple.
--
--   email : demo@velum.app · mot de passe : VelumDemo-2026! · plan : platine
--
-- ⚠ USAGE LOCAL UNIQUEMENT (`supabase db reset` l'applique automatiquement).
-- En PRODUCTION : ne jamais utiliser ce mot de passe commité — créer
-- l'utilisateur via l'API admin puis rejouer uniquement les sections 2 à 5
-- (collection/valorisations/alertes) avec l'uuid retourné. Procédure
-- complète : docs/DEMO_ACCOUNT.md. Ce seed est idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- 1) Utilisateur auth (mot de passe bcrypt) — le trigger on_auth_user_created
--    crée le profil ; on force ensuite le plan platine.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@velum.app',
  crypt('VelumDemo-2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Compte Démo VELUM","locale":"fr"}',
  now(),
  now()
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@velum.app","email_verified":true}',
  'email',
  '11111111-1111-4111-8111-111111111111',
  now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- Profil : plan platine (au cas où le trigger a déjà créé la ligne).
insert into public.profiles (id, display_name, locale, plan)
values ('11111111-1111-4111-8111-111111111111', 'Compte Démo VELUM', 'fr', 'platine')
on conflict (id) do update set plan = 'platine', display_name = excluded.display_name;

-- 2) Un objet par module, avec analyse persistée (items.attributes.analysis)
--    pour activer le sommelier de cave et le bandeau « à boire ».

-- Vin — apogée en cours → alimente le bandeau « à boire » + le sommelier.
insert into public.items (id, owner_id, domain, title, attributes, confidence, acquired_at, acquired_price, condition, storage_location)
values (
  '22222222-2222-4222-8222-222222222201',
  '11111111-1111-4111-8111-111111111111',
  'wine',
  'Bandol Domaine Tempier 2016',
  jsonb_build_object(
    'producer', 'Domaine Tempier', 'appellation', 'Bandol', 'vintage', 2016,
    'color', 'rouge', 'region', 'Provence', 'country', 'France',
    'analysis', jsonb_build_object(
      'identification', jsonb_build_object('producer', 'Domaine Tempier', 'appellation', 'Bandol', 'vintage', 2016, 'color', 'rouge', 'region', 'Provence', 'country', 'France'),
      'tasting', jsonb_build_object(
        'robe', 'grenat profond', 'nose', jsonb_build_array('garrigue', 'fruits noirs', 'épices'),
        'palate', jsonb_build_object('structure', 'ample', 'tannins', 'fondus', 'acidity', 'fraîche'),
        'length', 'longue', 'agingPotentialYears', jsonb_build_array(8, 20),
        'drinkWindow', jsonb_build_object('from', 2022, 'to', 2032)
      ),
      'ratings', jsonb_build_object('rvf', '16,5/20', 'positioning', 'classique'),
      'market', jsonb_build_object('assetClass', 'cave', 'marketTension', 'moyenne', 'speculativeScore', 6),
      'comparisons', jsonb_build_object(
        'foodPairings', jsonb_build_array('gigot d''agneau aux herbes', 'daube provençale', 'fromages affinés'),
        'regionalEquivalents', jsonb_build_array('Château Pradeaux', 'La Bastide Blanche')
      ),
      'uncertainties', jsonb_build_array('Niveau et conservation de la bouteille non vérifiés.')
    )
  ),
  0.94, '2019-06-15', 38, 'excellent', 'Cave — casier B3'
)
on conflict (id) do nothing;

-- Pièce
insert into public.items (id, owner_id, domain, title, attributes, confidence, acquired_at, acquired_price, condition, storage_location)
values (
  '22222222-2222-4222-8222-222222222202',
  '11111111-1111-4111-8111-111111111111',
  'coin',
  '5 Francs Semeuse argent 1960',
  jsonb_build_object('country', 'France', 'type', '5 Francs Semeuse', 'year', 1960, 'metal', 'argent 835‰', 'grade', 'SUP'),
  0.91, '2021-03-10', 12, 'SUP', 'Médaillier — plateau 2'
)
on conflict (id) do nothing;

-- Tableau
insert into public.items (id, owner_id, domain, title, attributes, confidence, acquired_at, acquired_price, condition, storage_location)
values (
  '22222222-2222-4222-8222-222222222203',
  '11111111-1111-4111-8111-111111111111',
  'art',
  'École provençale — Paysage aux oliviers',
  jsonb_build_object('attributionQualifier', 'ecole_de', 'technique', 'huile sur toile', 'estimatedPeriod', 'début XXe', 'school', 'École provençale'),
  0.62, '2020-09-01', 450, 'bon état', 'Salon'
)
on conflict (id) do nothing;

-- Timbre
insert into public.items (id, owner_id, domain, title, attributes, confidence, acquired_at, acquired_price, condition, storage_location)
values (
  '22222222-2222-4222-8222-222222222204',
  '11111111-1111-4111-8111-111111111111',
  'stamp',
  'Semeuse lignée 15c vert — YT 130',
  jsonb_build_object('country', 'France', 'catalog', 'yvert_tellier', 'catalogNumber', 'YT 130', 'year', 1903, 'condition', 'neuf_avec_charniere'),
  0.88, '2022-11-20', 8, 'neuf avec charnière', 'Album 1 — page 12'
)
on conflict (id) do nothing;

-- 3) Historique de valorisations (courbe de valeur sur la fiche vin).
insert into public.valuations (item_id, central, ci80_low, ci80_high, ci95_low, ci95_high, reliability, sources, valued_at)
values
  ('22222222-2222-4222-8222-222222222201', 42, 38, 47, 35, 52, 74, '[]'::jsonb, now() - interval '180 days'),
  ('22222222-2222-4222-8222-222222222201', 46, 41, 52, 38, 57, 78, '[]'::jsonb, now() - interval '90 days'),
  ('22222222-2222-4222-8222-222222222201', 51, 45, 58, 42, 63, 81, '[]'::jsonb, now() - interval '7 days'),
  ('22222222-2222-4222-8222-222222222202', 14, 11, 18, 9, 22, 55, '[]'::jsonb, now() - interval '30 days');

-- 4) Une alerte de seuil + une alerte d'apogée (démo de l'onglet Marché).
insert into public.alerts (item_id, type, config, active)
values
  ('22222222-2222-4222-8222-222222222201', 'drink_window', '{}'::jsonb, true),
  ('22222222-2222-4222-8222-222222222202', 'price_threshold', '{"direction":"above","threshold":20}'::jsonb, true);

-- 5) Notification d'exemple (centre de notifications).
insert into public.notifications (owner_id, title, body)
values (
  '11111111-1111-4111-8111-111111111111',
  'À boire — apogée atteinte',
  'Bandol Domaine Tempier 2016 est dans sa fenêtre de consommation optimale (jusqu''en 2032). Accord suggéré : gigot d''agneau aux herbes ou daube provençale.'
);
