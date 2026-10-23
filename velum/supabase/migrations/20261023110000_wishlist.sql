-- ─────────────────────────────────────────────────────────────────────────────
-- Liste d'envies et d'idées PAR CATÉGORIE (octobre 2026).
--
-- « Les vins que j'ai aimés et que je voudrais acheter plus tard » : une entrée
-- n'est PAS un objet de la collection (ni valorisation, ni quota de scan). Le
-- miroir TypeScript est `WishlistEntry` (@velum/core) et la ligne PostgREST
-- `WishlistRow` (@velum/api-client) — les colonnes ci-dessous en sont l'exact
-- reflet (snake_case).
--
-- Sécurité :
--  - RLS : chacun ne voit, n'insère, ne modifie et ne supprime QUE ses lignes
--    (owner_id = auth.uid(), y compris en WITH CHECK) ; anon n'a aucun droit.
--  - source_item_id doit désigner un objet du MÊME propriétaire (trigger : la
--    vérification vaut aussi pour le service-role, qui contourne la RLS).
--  - acquired_at est posé / effacé par le trigger quand `acquired` change :
--    le client ne peut ni l'antidater ni le falsifier.
--
-- Purge RGPD : owner_id → profiles ON DELETE CASCADE. La suppression du compte
-- (auth.users → profiles) efface donc toutes les envies ; l'Edge Function
-- `delete-account` n'a rien de plus à faire (aucun média associé).
-- La suppression d'un objet de la collection n'efface pas l'envie qui en est
-- issue : source_item_id repasse simplement à NULL.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.wishlist_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  domain public.velum_domain not null,
  -- Envie (à acquérir) ou simple idée (inspiration, à creuser).
  kind text not null default 'wish' check (kind in ('wish', 'idea')),
  -- Titre lisible, non vide après suppression des espaces, borné.
  title text not null
    constraint wishlist_entries_title_check
    check (btrim(title) <> '' and char_length(title) <= 200),
  -- « Pourquoi je l'ai aimé » — texte libre borné.
  notes text
    constraint wishlist_entries_notes_check
    check (notes is null or char_length(notes) <= 2000),
  -- Attributs d'identification (mêmes clés que items.attributes du domaine).
  attributes jsonb not null default '{}'::jsonb
    constraint wishlist_entries_attributes_check
    check (jsonb_typeof(attributes) = 'object' and octet_length(attributes::text) <= 16384),
  -- Origine : saisie, fiche objet, scan, dégustation, communauté.
  source text not null default 'manual'
    check (source in ('manual', 'item', 'scan', 'tasting', 'market')),
  -- Objet de la collection à l'origine de l'entrée (même propriétaire, cf. trigger).
  source_item_id uuid references public.items (id) on delete set null,
  -- Prix cible (EUR) au-delà duquel l'utilisateur ne souhaite pas acheter.
  target_price numeric(14, 2) check (target_price is null or target_price >= 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  -- Coché quand l'envie est satisfaite ; acquired_at est géré par le trigger.
  acquired boolean not null default false,
  acquired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishlist_entries_acquired_at_check
    check ((acquired and acquired_at is not null) or (not acquired and acquired_at is null))
);

-- Écran « Mes envies » : listes par propriétaire, catégorie, puis segment.
create index wishlist_entries_owner_domain_idx
  on public.wishlist_entries (owner_id, domain, acquired);
-- ON DELETE SET NULL depuis items : évite un parcours séquentiel de la table.
create index wishlist_entries_source_item_idx
  on public.wishlist_entries (source_item_id)
  where source_item_id is not null;

-- ── Trigger de cohérence ─────────────────────────────────────────────────────
-- SECURITY INVOKER (défaut) : pour un utilisateur, la lecture de public.items
-- est elle-même filtrée par la RLS « items_all_own » — l'objet d'autrui est
-- donc invisible et refusé ; pour le service-role, la comparaison explicite
-- des propriétaires garde la même règle.
create or replace function public.wishlist_entries_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- Identité de la ligne immuable : ni changement de propriétaire, ni
    -- réécriture de la date de création.
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Le propriétaire d''une envie ne peut pas changer'
        using errcode = 'check_violation';
    end if;
    new.created_at := old.created_at;
  end if;

  -- acquired_at suit `acquired` : posé à l'instant où l'envie est obtenue,
  -- effacé si elle redevient une envie, jamais fourni par le client.
  if tg_op = 'INSERT' then
    new.acquired_at := case when new.acquired then now() else null end;
  elsif new.acquired is distinct from old.acquired then
    new.acquired_at := case when new.acquired then now() else null end;
  else
    new.acquired_at := old.acquired_at;
  end if;

  -- L'objet d'origine doit appartenir au même propriétaire.
  if new.source_item_id is not null
     and (tg_op = 'INSERT' or new.source_item_id is distinct from old.source_item_id)
     and not exists (
       select 1 from public.items
       where items.id = new.source_item_id and items.owner_id = new.owner_id
     ) then
    raise exception 'Objet d''origine introuvable dans votre collection'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger wishlist_entries_guard
  before insert or update on public.wishlist_entries
  for each row execute function public.wishlist_entries_guard();

-- updated_at = now() à chaque modification (fonction partagée de 0001).
create trigger set_updated_at
  before update on public.wishlist_entries
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.wishlist_entries enable row level security;

-- Aucun accès anonyme ; les utilisateurs connectés passent par la RLS.
revoke all on table public.wishlist_entries from anon;
grant select, insert, update, delete on table public.wishlist_entries to authenticated;

create policy "wishlist_entries_select_own" on public.wishlist_entries
  for select using (owner_id = auth.uid());

create policy "wishlist_entries_insert_own" on public.wishlist_entries
  for insert with check (owner_id = auth.uid());

create policy "wishlist_entries_update_own" on public.wishlist_entries
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "wishlist_entries_delete_own" on public.wishlist_entries
  for delete using (owner_id = auth.uid());
