-- ============================================================================
-- VELUM — migration 0004 : socle des paris de différenciation
-- ----------------------------------------------------------------------------
-- Tables ajoutées (toutes sous RLS) :
--   1. valuation_snapshots  — historique de valorisation daté par objet
--        (pari #2 carnet valorisé en continu, pari #3 trajectoire de l'arbitre).
--   2. provenance_events    — passeport de provenance à hash chaîné par objet
--        (pari #8 : DPP secondaire détenu par le collectionneur).
--   3. calibration_outcomes — prédit-vs-réalisé (pari #1, alimenté par le
--        backtest de ventes publiques ET les ventes réelles) — données de
--        référence gérées par le service-role.
--   4. calibration_runs     — score de calibration publié par domaine
--        (pari #1 : la douve auditable), lisible par tous, écrit par le cron.
--
-- Principe : aucune donnée utilisateur sans RLS par owner_id (directement ou
-- via l'item parent). Les tables de référence (calibration_*) sont en lecture
-- pour tout utilisateur authentifié, en écriture pour le seul service-role.
-- ============================================================================

-- ── 1. valuation_snapshots ───────────────────────────────────────────────────
-- Un instantané §7 daté par objet. Le carnet Gold/Platine en accumule la série ;
-- l'arbitre (boire/garder/vendre) lit cette trajectoire pour son garde-fou
-- statistique (IC 80 % disjoints sur ≥ 3 points).
create table public.valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  central numeric(14, 2) not null,
  ci80_low numeric(14, 2) not null,
  ci80_high numeric(14, 2) not null,
  reliability integer not null check (reliability >= 0 and reliability <= 100),
  captured_at timestamptz not null default now()
);
create index valuation_snapshots_item_idx on public.valuation_snapshots (item_id, captured_at);

-- ── 2. provenance_events ─────────────────────────────────────────────────────
-- Chaîne d'événements ancrée par hash (SHA-256 chaîné, cf. @velum/carnet).
-- `seq` ordonne la chaîne ; (prev_hash, hash) permettent la vérification
-- d'intégrité côté serveur comme côté client (rejouable).
create table public.provenance_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  seq integer not null,
  type text not null check (type in ('created', 'acquired', 'appraised', 'transferred', 'sold', 'exhibited')),
  occurred_at timestamptz not null,
  -- Acteur PSEUDONYMISÉ (id de propriétaire) — jamais de PII en clair.
  actor text,
  detail text,
  value_eur numeric(14, 2),
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null default now(),
  unique (item_id, seq)
);
create index provenance_events_item_idx on public.provenance_events (item_id, seq);

-- ── 3. calibration_outcomes ──────────────────────────────────────────────────
-- Prédiction §7 confrontée au prix réellement réalisé. Alimentée par le
-- backtest de ventes PUBLIQUES (cold-start J1) et par les ventes réelles.
-- Donnée de référence : écriture service-role uniquement.
create table public.calibration_outcomes (
  id uuid primary key default gen_random_uuid(),
  domain public.velum_domain not null,
  central numeric(14, 2) not null,
  ci80_low numeric(14, 2) not null,
  ci80_high numeric(14, 2) not null,
  ci95_low numeric(14, 2) not null,
  ci95_high numeric(14, 2) not null,
  realized numeric(14, 2) not null,
  -- 'public_backtest' (Heritage/Drouot/eBay sold/Delcampe/iDealwine) ou 'real_sale'.
  origin text not null default 'public_backtest' check (origin in ('public_backtest', 'real_sale')),
  realized_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index calibration_outcomes_domain_idx on public.calibration_outcomes (domain, realized_at);

-- ── 4. calibration_runs ──────────────────────────────────────────────────────
-- Score de calibration publié par domaine (la douve auditable, pari #1).
-- Statut honnêtement borné : 'calibrating' tant que n < seuil d'échantillon.
create table public.calibration_runs (
  id uuid primary key default gen_random_uuid(),
  domain public.velum_domain not null,
  n integer not null,
  coverage80 numeric(5, 4) not null,
  coverage95 numeric(5, 4) not null,
  status text not null check (status in ('calibrating', 'well_calibrated', 'overconfident', 'underconfident')),
  computed_at timestamptz not null default now()
);
create index calibration_runs_domain_idx on public.calibration_runs (domain, computed_at desc);

-- ── 5. Row Level Security ────────────────────────────────────────────────────

alter table public.valuation_snapshots enable row level security;
alter table public.provenance_events enable row level security;
alter table public.calibration_outcomes enable row level security;
alter table public.calibration_runs enable row level security;

-- Instantanés & provenance : accès via l'item possédé (comme analyses/valuations).
create policy "valuation_snapshots_all_via_item" on public.valuation_snapshots
  for all
  using (exists (
    select 1 from public.items
    where items.id = valuation_snapshots.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = valuation_snapshots.item_id and items.owner_id = auth.uid()
  ));

create policy "provenance_events_all_via_item" on public.provenance_events
  for all
  using (exists (
    select 1 from public.items
    where items.id = provenance_events.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = provenance_events.item_id and items.owner_id = auth.uid()
  ));

-- Calibration : score PUBLIC (lecture par tout utilisateur authentifié) ;
-- l'écriture passe exclusivement par le service-role (cron), qui bypasse la RLS.
create policy "calibration_runs_select_all" on public.calibration_runs
  for select using (auth.role() = 'authenticated');

-- Les outcomes bruts ne sont pas exposés au client (aucune policy de select) :
-- seul le service-role (bypass RLS) les lit pour recalculer les runs.
