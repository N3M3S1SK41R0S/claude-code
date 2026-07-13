-- ─────────────────────────────────────────────────────────────────────────────
-- 0003 — Marketplace communautaire (offre Platine) : commission & expertise.
--
-- Révision produit juillet 2026 :
--  - la communauté Platine met en relation les collectionneurs SANS échange
--    direct de coordonnées : toute transaction passe par la plateforme ;
--  - commission de 5 % sur les transactions conclues ;
--  - au-delà de 500 € (ask_price EUR), le recours à un analyste expert est
--    OBLIGATOIRE, à la charge du vendeur, avant activation de l'annonce.
-- Le flag applicatif enableMarketplace reste OFF au MVP : le schéma est prêt,
-- l'ouverture se fera sans migration supplémentaire.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.listings
  -- Taux de commission appliqué à la transaction (5 % par défaut).
  add column commission_rate numeric(5, 4) not null default 0.05
    check (commission_rate >= 0 and commission_rate <= 1),
  -- Expertise obligatoire (ask_price > seuil) — gérée par trigger ci-dessous.
  add column expert_appraisal_required boolean not null default false,
  -- Référence du rapport d'expertise fourni par le vendeur (storage path).
  add column expert_appraisal_ref text;

-- Seuil au-delà duquel l'expertise est exigée (EUR).
create or replace function public.listing_appraisal_threshold_eur()
returns numeric
language sql
immutable
as $$ select 500::numeric $$;

-- Impose l'expertise : marque le besoin à l'insert/update, et bloque le
-- passage en 'active' tant que le rapport d'expertise n'est pas fourni.
create or replace function public.enforce_expert_appraisal()
returns trigger
language plpgsql
as $$
begin
  new.expert_appraisal_required :=
    new.currency = 'EUR' and new.ask_price > public.listing_appraisal_threshold_eur();

  if new.status = 'active'
     and new.expert_appraisal_required
     and new.expert_appraisal_ref is null then
    raise exception
      'Expertise obligatoire au-delà de % EUR : fournir expert_appraisal_ref (à la charge du vendeur)',
      public.listing_appraisal_threshold_eur()
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger listings_expert_appraisal
  before insert or update on public.listings
  for each row execute function public.enforce_expert_appraisal();

-- La création d'annonces est réservée aux abonnés Platine (communauté).
create or replace function public.can_list_on_marketplace(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = p_user and plan = 'platine'
  );
$$;

-- Remplace la policy globale de 0001 par des policies granulaires :
-- les policies RLS étant combinées en OU, conserver un FOR ALL rendrait
-- la restriction Platine inopérante à l'insertion.
drop policy "listings_all_via_item" on public.listings;

create policy "listings_select_own" on public.listings
  for select using (
    seller_id = auth.uid()
    or exists (
      select 1 from public.items
      where items.id = listings.item_id and items.owner_id = auth.uid()
    )
  );

create policy "listings_insert_platine" on public.listings
  for insert with check (
    seller_id = auth.uid()
    and public.can_list_on_marketplace(auth.uid())
    and exists (
      select 1 from public.items
      where items.id = listings.item_id and items.owner_id = auth.uid()
    )
  );

create policy "listings_update_own" on public.listings
  for update using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "listings_delete_own" on public.listings
  for delete using (seller_id = auth.uid());
