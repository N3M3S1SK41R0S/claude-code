-- ============================================================================
-- VELUM — paliers de commission dégressive : ventes RÉELLES uniquement.
-- ----------------------------------------------------------------------------
-- 0004 comptait toute annonce 'sold', quel qu'en soit le montant : des ventes
-- fictives à 0 € entre comptes complices faisaient descendre le taux (5 % →
-- 2 %). Désormais (mêmes paliers que COMMISSION_TIERS, @velum/config) :
--   - seules comptent les commandes LIBÉRÉES (séquestre 'released') d'au
--     moins commission_min_qualifying_sale_eur() (20 €) ;
--   - chaque acheteur compte pour commission_max_sales_per_buyer() (3)
--     ventes au plus : un complice unique ne suffit plus.
-- Le prix plancher d'une annonce (1 €, enforce_listing_rules) complète la
-- garde. my_commission_summary.completedSales suit la MÊME définition (base
-- du palier affiché au membre).
-- ============================================================================

create or replace function public.commission_min_qualifying_sale_eur()
returns numeric language sql immutable as $$ select 20::numeric $$;

create or replace function public.commission_max_sales_per_buyer()
returns integer language sql immutable as $$ select 3 $$;

-- Ventes retenues pour le palier d'un vendeur.
create or replace function public.commission_qualifying_sales(p_seller uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(least(per_buyer.sales, public.commission_max_sales_per_buyer())), 0)::integer
  from (
    select o.buyer_id, count(*) as sales
    from public.orders o
    where o.seller_id = p_seller
      and o.escrow_state = 'released'
      and o.amount >= public.commission_min_qualifying_sale_eur()
    group by o.buyer_id
  ) per_buyer
$$;
revoke all on function public.commission_qualifying_sales(uuid) from public, anon, authenticated;
grant execute on function public.commission_qualifying_sales(uuid) to service_role;

-- Taux applicable à un vendeur (privilèges de 0004 conservés).
create or replace function public.commission_rate_for(p_seller uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.sales >= 50 then 0.02
    when s.sales >= 25 then 0.03
    when s.sales >= 10 then 0.04
    else 0.05
  end
  from (select public.commission_qualifying_sales(p_seller) as sales) s
$$;

-- Synthèse du commissionnement (écran « Mes frais ») : même définition des
-- ventes retenues que le palier.
create or replace function public.my_commission_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Session requise' using errcode = 'VL401';
  end if;
  return jsonb_build_object(
    'currency', 'EUR',
    'currentRate', public.commission_rate_for(v_uid),
    'completedSales', public.commission_qualifying_sales(v_uid),
    'commissions', coalesce((
      select sum(amount) from public.platform_ledger
      where member_id = v_uid and kind = 'commission'), 0),
    'certificationFees', coalesce((
      select sum(amount) from public.platform_ledger
      where member_id = v_uid and kind = 'certification_fee'), 0),
    'payouts', coalesce((
      select sum(amount) from public.platform_ledger
      where member_id = v_uid and kind = 'payout'), 0),
    'entries', (select count(*) from public.platform_ledger where member_id = v_uid)
  );
end;
$$;
