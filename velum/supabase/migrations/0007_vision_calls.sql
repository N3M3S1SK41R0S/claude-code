-- ════════════════════════════════════════════════════════════════════════════
-- Suivi des appels au modèle de vision : observabilité ET coût.
--
-- Sans ça, VELUM dépense de l'argent en aveugle : une boucle qui rappelle l'IA,
-- un utilisateur qui abuse, un modèle qui se met à réfléchir trois fois plus —
-- on ne le découvre que sur la facture, un mois plus tard.
--
-- Une ligne par TENTATIVE (pas par photo) : un repli Gemini→OpenAI produit donc
-- deux lignes, ce qui permet de mesurer le taux de repli réel.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.vision_calls (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- `set null` : on garde la ligne de coût même si le compte est supprimé (RGPD),
  -- car la dépense, elle, a bien eu lieu.
  user_id       uuid references auth.users (id) on delete set null,
  operation     text not null,               -- recognize | analyze | cellar-pairing
  domain        text,                        -- wine | coin | art | stamp | null
  provider      text not null,               -- google | openai | anthropic
  model         text not null,
  attempt       smallint not null default 1, -- rang dans la cascade (1 = primaire)
  used_fallback boolean not null default false,
  ok            boolean not null,
  error_code    text,                        -- VelumError code si échec
  duration_ms   integer not null,
  input_tokens  integer,
  -- ATTENTION : chez Google, les tokens de RÉFLEXION sont facturés en sortie.
  -- `output_tokens` les inclut donc — c'est bien ce qui est facturé.
  output_tokens integer
);

create index if not exists vision_calls_created_at_idx on public.vision_calls (created_at desc);
create index if not exists vision_calls_user_idx on public.vision_calls (user_id, created_at desc);

-- RLS active SANS aucune policy : personne (ni anon, ni authenticated) ne peut
-- lire ni écrire. Seul le service-role (les Edge Functions) y accède, en
-- contournant la RLS. Un utilisateur ne doit ni voir les coûts, ni forger des
-- lignes.
alter table public.vision_calls enable row level security;

-- ── Tarifs ──────────────────────────────────────────────────────────────────
-- Séparés de la table d'appels : les prix changent, les appels passés non.
create table if not exists public.vision_prices (
  provider            text not null,
  model               text not null,
  input_usd_per_mtok  numeric(10, 4) not null,
  output_usd_per_mtok numeric(10, 4) not null,
  source              text,
  updated_at          timestamptz not null default now(),
  primary key (provider, model)
);

alter table public.vision_prices enable row level security;

-- Tarifs relevés le 2026-07-14 sur les pages officielles. À réactualiser :
-- ils bougent, et une facture surprise vient souvent de là.
insert into public.vision_prices (provider, model, input_usd_per_mtok, output_usd_per_mtok, source)
values
  ('google',    'gemini-3.5-flash', 1.50, 9.00,  'ai.google.dev/gemini-api/docs/pricing (2026-07-14)'),
  ('openai',    'gpt-5.5',          5.00, 30.00, 'developers.openai.com/api/docs/pricing (2026-07-14)'),
  ('openai',    'gpt-4o',           2.50, 10.00, 'developers.openai.com/api/docs/pricing (2026-07-14)'),
  ('anthropic', 'claude-sonnet-5',  3.00, 15.00, 'platform.claude.com/docs/en/pricing (2026-07-14)')
on conflict (provider, model) do update
  set input_usd_per_mtok  = excluded.input_usd_per_mtok,
      output_usd_per_mtok = excluded.output_usd_per_mtok,
      source              = excluded.source,
      updated_at          = now();

-- ── Vues de lecture ─────────────────────────────────────────────────────────
-- `security_invoker` : la vue applique la RLS de l'appelant, elle ne sert pas de
-- porte dérobée vers une table protégée.

-- Coût de chaque appel. Un modèle sans tarif connu donne NULL — visible, plutôt
-- que faussement gratuit.
create or replace view public.vision_call_costs
with (security_invoker = on) as
select
  c.*,
  round(
    coalesce(c.input_tokens, 0)::numeric / 1e6 * p.input_usd_per_mtok
      + coalesce(c.output_tokens, 0)::numeric / 1e6 * p.output_usd_per_mtok,
    6
  ) as cost_usd
from public.vision_calls c
left join public.vision_prices p
  on p.provider = c.provider and p.model = c.model;

-- Le tableau de bord : dépense et santé, par jour et par fournisseur.
create or replace view public.vision_costs_daily
with (security_invoker = on) as
select
  date_trunc('day', created_at) as day,
  provider,
  model,
  count(*)                                        as calls,
  count(*) filter (where not ok)                  as failures,
  count(*) filter (where used_fallback)           as fallbacks,
  sum(input_tokens)                               as input_tokens,
  sum(output_tokens)                              as output_tokens,
  round(sum(cost_usd), 4)                         as cost_usd,
  round(avg(duration_ms))                         as avg_ms
from public.vision_call_costs
group by 1, 2, 3
order by 1 desc, cost_usd desc nulls last;
