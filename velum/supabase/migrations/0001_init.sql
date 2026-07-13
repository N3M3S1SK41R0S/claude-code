-- ============================================================================
-- VELUM — migration 0001 : schéma initial (CDC §8.1) + freemium + RLS + storage
-- ----------------------------------------------------------------------------
-- Contenu :
--   1. Extensions et types
--   2. Tables : profiles, items, item_media, analyses, valuations, alerts,
--      listings, notifications, usage_counters
--   3. Index
--   4. Triggers : création automatique du profil, updated_at
--   5. Fonction consume_scan() (quota freemium)
--   6. Row Level Security sur TOUTES les tables
--   7. Bucket Storage privé 'item-media' + policies par préfixe uid/
-- ============================================================================

-- ── 1. Extensions et types ──────────────────────────────────────────────────

create extension if not exists pgcrypto; -- gen_random_uuid()

-- Les 4 modules VELUM — tout module futur est additif (alter type ... add value).
create type velum_domain as enum ('wine', 'coin', 'art', 'stamp');

-- ── 2. Tables ────────────────────────────────────────────────────────────────

-- Profil utilisateur (1:1 avec auth.users).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'fr',
  -- Mode senior : gros boutons, contraste renforcé, police majorée (§11.2).
  a11y_mode boolean not null default false,
  -- Offre : free / premium / gold / platine (quota géré par consume_scan()).
  -- free = 5 scans/semaine PAR module ; premium+ = illimité ;
  -- gold+ = carnet virtuel ; platine = valorisation continue + communauté.
  plan text not null default 'free' check (plan in ('free', 'premium', 'gold', 'platine')),
  -- Jeton de notification push Expo (nullable tant que l'app n'a pas enregistré l'appareil).
  expo_push_token text,
  created_at timestamptz not null default now()
);

-- Objet de collection (bouteille, pièce, tableau, timbre).
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  domain velum_domain not null,
  title text,
  -- Attributs structurés spécifiques au domaine (millésime, atelier, artiste…).
  attributes jsonb not null default '{}'::jsonb,
  -- Confiance d'identification 0..1 — TOUJOURS affichée (§3.3).
  confidence real check (confidence >= 0 and confidence <= 1),
  acquired_at date,
  acquired_price numeric(12, 2),
  condition text,
  notes text,
  storage_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Médias d'un objet (photos par rôle : étiquette, avers, revers, signature…).
create table public.item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  kind text not null,
  -- Chemin dans le bucket 'item-media' (jamais d'URL signée persistée).
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Fiches d'analyse produites par les moteurs (zappa_vini, numis_v1, art_v1, phila_v1).
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  engine text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Valorisations (moteur §7) : valeur centrale + intervalles de confiance.
create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  central numeric(14, 2) not null,
  ci80_low numeric(14, 2) not null,
  ci80_high numeric(14, 2) not null,
  ci95_low numeric(14, 2) not null,
  ci95_high numeric(14, 2) not null,
  -- Score de fiabilité 0..100 (§7.2-5).
  reliability integer not null check (reliability >= 0 and reliability <= 100),
  -- Observations conservées (traçabilité affichée à l'utilisateur).
  sources jsonb not null default '[]'::jsonb,
  valued_at timestamptz not null default now()
);

-- Alertes : seuil de prix, fenêtre de consommation (vin), opportunité.
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  type text not null check (type in ('price_threshold', 'drink_window', 'opportunity')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Annonces de vente (marketplace interne).
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  ask_price numeric(14, 2) not null check (ask_price >= 0),
  currency text not null default 'EUR',
  status text not null default 'draft' check (status in ('draft', 'active', 'sold', 'withdrawn')),
  created_at timestamptz not null default now()
);

-- Notifications in-app (générées par price-cron et les alertes).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Compteurs d'usage hebdomadaires PAR MODULE
-- (quota freemium : 5 scans/semaine et par module en plan 'free').
create table public.usage_counters (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  domain public.velum_domain not null,
  -- Semaine ISO au format 'IYYY-IW' (to_char(now(), 'IYYY-IW')).
  week text not null,
  scans integer not null default 0,
  primary key (owner_id, domain, week)
);

-- ── 3. Index ─────────────────────────────────────────────────────────────────

create index items_owner_id_idx on public.items (owner_id);
create index items_domain_idx on public.items (domain);
create index items_attributes_gin_idx on public.items using gin (attributes);
create index item_media_item_id_idx on public.item_media (item_id);
create index analyses_item_id_idx on public.analyses (item_id);
create index valuations_item_id_valued_at_idx on public.valuations (item_id, valued_at desc);
create index alerts_item_id_idx on public.alerts (item_id) where active;
create index listings_item_id_idx on public.listings (item_id);
create index listings_status_idx on public.listings (status);
create index notifications_owner_id_idx on public.notifications (owner_id, read, created_at desc);

-- ── 4. Triggers ──────────────────────────────────────────────────────────────

-- Création automatique du profil à l'inscription (pattern Supabase standard).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    coalesce(new.raw_user_meta_data ->> 'locale', 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at = now() à chaque modification d'un item.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ── 5. Quota freemium : consume_scan(p_domain) ───────────────────────────────

-- Incrémente le compteur de scans de la semaine ISO courante pour le module
-- demandé. Retourne false (sans incrémenter) si plan = 'free' et que le quota
-- hebdomadaire de 5 scans est atteint POUR CE MODULE ; true sinon
-- (premium/gold/platine : illimité). SECURITY DEFINER : la table
-- usage_counters n'est jamais écrite directement par le client.
create or replace function public.consume_scan(p_domain public.velum_domain)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week text := to_char(now(), 'IYYY-IW');
  v_plan text;
  v_scans integer;
begin
  if v_uid is null then
    return false; -- appel non authentifié : jamais de scan gratuit
  end if;

  select plan into v_plan from public.profiles where id = v_uid;
  if v_plan is null then
    return false; -- profil manquant (ne devrait pas arriver grâce au trigger)
  end if;

  -- Ligne de la semaine courante, créée à la volée puis verrouillée (concurrence).
  insert into public.usage_counters (owner_id, domain, week, scans)
  values (v_uid, p_domain, v_week, 0)
  on conflict (owner_id, domain, week) do nothing;

  select scans into v_scans
  from public.usage_counters
  where owner_id = v_uid and domain = p_domain and week = v_week
  for update;

  if v_plan = 'free' and v_scans >= 5 then
    return false; -- quota freemium hebdomadaire atteint pour ce module
  end if;

  update public.usage_counters
  set scans = scans + 1
  where owner_id = v_uid and domain = p_domain and week = v_week;

  return true;
end;
$$;

revoke all on function public.consume_scan(public.velum_domain) from public;
grant execute on function public.consume_scan(public.velum_domain) to authenticated;

-- ── 6. Row Level Security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.item_media enable row level security;
alter table public.analyses enable row level security;
alter table public.valuations enable row level security;
alter table public.alerts enable row level security;
alter table public.listings enable row level security;
alter table public.notifications enable row level security;
alter table public.usage_counters enable row level security;

-- profiles : chacun ne voit et ne modifie que son propre profil.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- items : propriété directe.
create policy "items_all_own" on public.items
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Tables filles : accès via la propriété de l'item parent.
create policy "item_media_all_via_item" on public.item_media
  for all
  using (exists (
    select 1 from public.items
    where items.id = item_media.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = item_media.item_id and items.owner_id = auth.uid()
  ));

create policy "analyses_all_via_item" on public.analyses
  for all
  using (exists (
    select 1 from public.items
    where items.id = analyses.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = analyses.item_id and items.owner_id = auth.uid()
  ));

create policy "valuations_all_via_item" on public.valuations
  for all
  using (exists (
    select 1 from public.items
    where items.id = valuations.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = valuations.item_id and items.owner_id = auth.uid()
  ));

create policy "alerts_all_via_item" on public.alerts
  for all
  using (exists (
    select 1 from public.items
    where items.id = alerts.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = alerts.item_id and items.owner_id = auth.uid()
  ));

create policy "listings_all_via_item" on public.listings
  for all
  using (exists (
    select 1 from public.items
    where items.id = listings.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = listings.item_id and items.owner_id = auth.uid()
  ));

-- notifications : lecture + marquage lu/non-lu par le destinataire.
-- L'insertion est réservée au service-role (price-cron) qui bypasse la RLS.
create policy "notifications_select_own" on public.notifications
  for select using (owner_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "notifications_delete_own" on public.notifications
  for delete using (owner_id = auth.uid());

-- usage_counters : lecture seule par le propriétaire (affichage du quota).
-- L'écriture passe exclusivement par consume_scan() (security definer).
create policy "usage_counters_select_own" on public.usage_counters
  for select using (owner_id = auth.uid());

-- ── 7. Storage : bucket privé 'item-media' ──────────────────────────────────

-- Bucket privé : les médias ne sont servis que via URL signée éphémère.
insert into storage.buckets (id, name, public)
values ('item-media', 'item-media', false)
on conflict (id) do nothing;

-- Chaque utilisateur ne touche que son préfixe : item-media/<uid>/...
-- (storage.foldername(name))[1] = premier segment du chemin.
create policy "item_media_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'item-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "item_media_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'item-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "item_media_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'item-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'item-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "item_media_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'item-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
