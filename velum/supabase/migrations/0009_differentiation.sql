-- ============================================================================
-- VELUM — migration 0007 : calibration auditable (pari #1 de différenciation)
-- ----------------------------------------------------------------------------
-- N'ajoute QUE ce qui n'existe pas déjà : la trajectoire de valorisation
-- réutilise la table `valuations` (0001) et la chaîne de possession réutilise
-- `provenance_entries` (0005) — aucune table redondante n'est créée.
--
-- Tables (sous RLS) :
--   1. calibration_outcomes — prédit §7 vs prix réalisé (backtest de ventes
--        PUBLIQUES cold-start J1 + ventes réelles). Donnée de référence :
--        écriture service-role uniquement, jamais exposée au client.
--   2. calibration_runs     — score de calibration PUBLIÉ par domaine (la douve
--        auditable), lisible par tout utilisateur authentifié, écrit par le cron.
-- ============================================================================

-- ── 1. calibration_outcomes ──────────────────────────────────────────────────
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

-- ── 2. calibration_runs ──────────────────────────────────────────────────────
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

-- ── 3. Row Level Security ────────────────────────────────────────────────────
alter table public.calibration_outcomes enable row level security;
alter table public.calibration_runs enable row level security;

-- Score PUBLIC : lecture par tout utilisateur authentifié ; écriture réservée
-- au service-role (cron), qui bypasse la RLS.
create policy "calibration_runs_select_all" on public.calibration_runs
  for select using (auth.role() = 'authenticated');

-- Les outcomes bruts ne sont pas exposés au client (aucune policy de select) :
-- seul le service-role (bypass RLS) les lit pour recalculer les runs.
