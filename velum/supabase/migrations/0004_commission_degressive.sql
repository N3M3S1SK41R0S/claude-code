-- ─────────────────────────────────────────────────────────────────────────────
-- 0004 — Commission DÉGRESSIVE de la marketplace communautaire (Platine).
--
-- Révision produit juillet 2026 : la commission récompense l'activité du
-- vendeur — 5 % maximum (nouveau vendeur), 2 % minimum (les plus actifs).
-- Paliers identiques à COMMISSION_TIERS de @velum/config (source app) :
--   ≥ 50 ventes conclues → 2 %   ·   ≥ 25 → 3 %   ·   ≥ 10 → 4 %   ·   sinon 5 %
-- Le taux est FIGÉ sur l'annonce à sa création (pas rétroactif) : c'est le
-- contrat affiché au vendeur au moment de la mise en vente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Taux applicable à un vendeur, d'après ses ventes CONCLUES (status 'sold').
create or replace function public.commission_rate_for(p_seller uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) >= 50 then 0.02
    when count(*) >= 25 then 0.03
    when count(*) >= 10 then 0.04
    else 0.05
  end
  from public.listings
  where seller_id = p_seller and status = 'sold';
$$;

revoke all on function public.commission_rate_for(uuid) from public;
grant execute on function public.commission_rate_for(uuid) to authenticated, service_role;

-- À la création d'une annonce : fige le taux du vendeur du moment.
-- (Le client ne peut PAS choisir son taux : le trigger écrase toute valeur.)
create or replace function public.set_listing_commission()
returns trigger
language plpgsql
as $$
begin
  new.commission_rate := public.commission_rate_for(new.seller_id);
  return new;
end;
$$;

create trigger listings_set_commission
  before insert on public.listings
  for each row execute function public.set_listing_commission();
