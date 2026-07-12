-- ─────────────────────────────────────────────────────────────────────────────
-- 0005 — Journal de dégustation & chaîne de provenance (enrichissements juillet 2026).
--
--  - tasting_notes : historique PERSONNEL de dégustation d'un objet (note /100
--    optionnelle, commentaire, date). Sert aussi au marquage « bouteille bue »
--    (côté app : attributes.consumedAt) — ici on garde la trace détaillée.
--  - provenance_entries : chaîne de possession (propriétaire précédent, source
--    d'acquisition, note, date) — utile assurance, succession, revente.
--
-- Les deux tables sont rattachées à un item (on delete cascade) et protégées
-- par RLS via la PROPRIÉTÉ de l'item (même patron que analyses/valuations).
-- La purge RGPD est donc automatique : supprimer le profil → items → ces lignes.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tasting_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  -- Note personnelle sur 100 (optionnelle) — INFORMATIVE, jamais un barème officiel.
  rating int check (rating >= 0 and rating <= 100),
  note text,
  tasted_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index tasting_notes_item_idx on public.tasting_notes (item_id, tasted_at desc);

create table public.provenance_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  -- Propriétaire (précédent ou soi-même) à cette étape de la chaîne.
  owner_label text,
  -- Source d'acquisition : maison de vente, galerie, don, héritage, particulier…
  acquired_from text,
  note text,
  event_date date,
  created_at timestamptz not null default now()
);

create index provenance_item_idx on public.provenance_entries (item_id, event_date);

alter table public.tasting_notes enable row level security;
alter table public.provenance_entries enable row level security;

create policy "tasting_notes_all_via_item" on public.tasting_notes
  for all
  using (exists (
    select 1 from public.items
    where items.id = tasting_notes.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = tasting_notes.item_id and items.owner_id = auth.uid()
  ));

create policy "provenance_all_via_item" on public.provenance_entries
  for all
  using (exists (
    select 1 from public.items
    where items.id = provenance_entries.item_id and items.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.items
    where items.id = provenance_entries.item_id and items.owner_id = auth.uid()
  ));
