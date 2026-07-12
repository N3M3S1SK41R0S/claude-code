-- ─────────────────────────────────────────────────────────────────────────────
-- 0006 — Communauté marchande à SÉQUESTRE (Platine). Spec affûtée (grill-me) :
--   docs/COMMUNITY_MARKETPLACE.md.
--
--  - `orders`   : une transaction acheteur/vendeur avec sa machine à états de
--                 séquestre. Le taux de commission est FIGÉ à l'achat.
--  - `disputes` : litige rattaché à une commande.
--  - Transitions validées par TRIGGER (le client ne peut pas sauter un état).
--    Les transitions « système » (arbitrage, auto-libération, remboursement)
--    passent par des fonctions de confiance qui posent le drapeau
--    `velum.system_action` — jamais atteignables directement par le client.
--  - Réputation vendeur dérivée (ventes conclues, litiges, ancienneté).
--  - Libération automatique à J+X après livraison (fonction appelée par cron).
--  - La capture/libération réelle des fonds (Stripe Connect) se branche aux
--    points marqués STRIPE.
--
-- Authentification « avant publication » (objets ≥ 500 €) : déjà couverte par
-- 0003 (une annonce ne passe 'active' qu'avec expert_appraisal_ref). Le badge
-- « authentifié VELUM » = expert_appraisal_ref renseigné.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fenêtre d'auto-libération : jours après livraison prouvée, sans litige.
create or replace function public.escrow_release_days()
returns integer language sql immutable as $$ select 5 $$;

-- true si l'appel provient d'une fonction système de confiance (drapeau posé).
create or replace function public.is_escrow_system_action()
returns boolean language sql stable as $$
  select coalesce(current_setting('velum.system_action', true), '') = '1'
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  -- Taux figé à l'achat (contrat affiché au vendeur) ; jamais recalculé après.
  commission_rate numeric(5, 4) not null check (commission_rate >= 0 and commission_rate <= 1),
  escrow_state text not null default 'pending_payment'
    check (escrow_state in
      ('pending_payment','funds_held','shipped','released','refunded','disputed','cancelled')),
  carrier text,
  tracking_number text,
  delivered_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_state_idx on public.orders (escrow_state);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open'
    check (status in ('open','resolved_release','resolved_refund')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_order_idx on public.disputes (order_id);

-- ── Création d'une commande : achat réservé Platine, taux figé, annonce active ──
create or replace function public.set_order_defaults()
returns trigger language plpgsql as $$
declare
  v_listing public.listings%rowtype;
begin
  select * into v_listing from public.listings where id = new.listing_id;
  if not found then
    raise exception 'Annonce introuvable' using errcode = 'P0001';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'Annonce non disponible (statut %)', v_listing.status using errcode = 'P0001';
  end if;
  if not public.can_list_on_marketplace(new.buyer_id) then
    raise exception 'La communauté est réservée à l''offre Platine' using errcode = 'P0001';
  end if;
  if new.buyer_id = v_listing.seller_id then
    raise exception 'On ne peut pas acheter sa propre annonce' using errcode = 'P0001';
  end if;
  -- Vendeur, montant et commission proviennent de l'annonce (non du client).
  new.seller_id := v_listing.seller_id;
  new.amount := v_listing.ask_price;
  new.currency := v_listing.currency;
  new.commission_rate := v_listing.commission_rate;
  new.escrow_state := 'pending_payment';
  return new;
end;
$$;
create trigger orders_set_defaults
  before insert on public.orders
  for each row execute function public.set_order_defaults();

-- ── Machine à états : seules les transitions LÉGALES par le BON acteur ───────
-- pending_payment → funds_held (acheteur : STRIPE capture)
-- pending_payment → cancelled  (acheteur ou vendeur)
-- funds_held      → shipped    (vendeur, tracking requis)
-- funds_held      → cancelled  (acheteur ou vendeur : remboursement avant envoi)
-- funds_held      → disputed   (acheteur)
-- shipped         → released   (acheteur, ou système : auto-libération / STRIPE payout)
-- shipped         → disputed   (acheteur)
-- disputed        → released | refunded (système : arbitrage)
create or replace function public.enforce_escrow_transition()
returns trigger language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_buyer boolean := v_uid is not null and v_uid = old.buyer_id;
  v_seller boolean := v_uid is not null and v_uid = old.seller_id;
  v_sys boolean := public.is_escrow_system_action();
  v_from text := old.escrow_state;
  v_to text := new.escrow_state;
  v_ok boolean := false;
begin
  if v_from = v_to then
    return new; -- pas de changement d'état : autres colonnes libres
  end if;
  if v_from = 'pending_payment' and v_to = 'funds_held' then
    v_ok := v_buyer or v_sys;
  elsif v_from = 'pending_payment' and v_to = 'cancelled' then
    v_ok := v_buyer or v_seller or v_sys;
  elsif v_from = 'funds_held' and v_to = 'shipped' then
    v_ok := (v_seller or v_sys) and new.tracking_number is not null;
  elsif v_from = 'funds_held' and v_to = 'cancelled' then
    v_ok := v_buyer or v_seller or v_sys;
  elsif v_from = 'funds_held' and v_to = 'disputed' then
    v_ok := v_buyer or v_sys;
  elsif v_from = 'shipped' and v_to = 'released' then
    v_ok := v_buyer or v_sys;
  elsif v_from = 'shipped' and v_to = 'disputed' then
    v_ok := v_buyer or v_sys;
  elsif v_from = 'disputed' and v_to in ('released','refunded') then
    v_ok := v_sys;
  end if;

  if not v_ok then
    raise exception 'Transition de séquestre interdite (% → % par cet acteur)', v_from, v_to
      using errcode = 'P0001';
  end if;
  if v_to = 'released' and new.released_at is null then
    new.released_at := now();
  end if;
  return new;
end;
$$;
create trigger orders_enforce_transition
  before update on public.orders
  for each row execute function public.enforce_escrow_transition();

-- Commande releasée ⇒ annonce vendue ('sold' : alimente commission & réputation).
-- SECURITY DEFINER : la libération peut être déclenchée par l'ACHETEUR, qui
-- n'a pas le droit RLS de modifier l'annonce du vendeur.
create or replace function public.mark_listing_sold()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.escrow_state = 'released' and old.escrow_state <> 'released' then
    update public.listings set status = 'sold' where id = new.listing_id;
  end if;
  return new;
end;
$$;
create trigger orders_mark_sold
  after update on public.orders
  for each row execute function public.mark_listing_sold();

-- ── Arbitrage d'un litige (plateforme) : pose le drapeau système ────────────
create or replace function public.resolve_dispute(p_order uuid, p_release boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('velum.system_action', '1', true);
  update public.orders
    set escrow_state = case when p_release then 'released' else 'refunded' end
    where id = p_order and escrow_state = 'disputed';
  update public.disputes
    set status = case when p_release then 'resolved_release' else 'resolved_refund' end,
        resolution_note = p_note, resolved_at = now()
    where order_id = p_order and status = 'open';
end;
$$;
revoke all on function public.resolve_dispute(uuid, boolean, text) from public;
grant execute on function public.resolve_dispute(uuid, boolean, text) to service_role;

-- ── Réputation vendeur (dérivée, objective) ─────────────────────────────────
create or replace function public.seller_reputation(p_seller uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (select * from public.orders where seller_id = p_seller)
  select jsonb_build_object(
    'completedSales', (select count(*) from o where escrow_state = 'released'),
    'refunded',       (select count(*) from o where escrow_state = 'refunded'),
    'disputes',       (select count(distinct d.order_id)
                         from public.disputes d join o on o.id = d.order_id),
    'disputeRate',    coalesce(round(
                         (select count(distinct d.order_id)::numeric
                            from public.disputes d join o on o.id = d.order_id)
                         / nullif((select count(*) from o where escrow_state in ('released','refunded')), 0),
                       3), 0),
    'memberSince',    (select created_at from public.profiles where id = p_seller)
  );
$$;
revoke all on function public.seller_reputation(uuid) from public;
grant execute on function public.seller_reputation(uuid) to authenticated, service_role;

-- ── Libération automatique à J+X après livraison (cron plateforme) ──────────
create or replace function public.release_due_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  perform set_config('velum.system_action', '1', true);
  with due as (
    update public.orders o
      set escrow_state = 'released', released_at = now()
    where o.escrow_state = 'shipped'
      and o.delivered_at is not null
      and o.delivered_at < now() - (public.escrow_release_days() || ' days')::interval
      and not exists (
        select 1 from public.disputes d where d.order_id = o.id and d.status = 'open'
      )
    returning o.id
  )
  select count(*) into v_count from due;
  return v_count;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Catalogue communauté : les annonces ACTIVES sont visibles de tous les membres
-- (0003 ne montrait une annonce qu'à son vendeur/propriétaire — un acheteur ne
-- pouvait pas parcourir le marché). Les brouillons/retirées restent privés.
create policy "listings_select_active" on public.listings
  for select using (status = 'active');

alter table public.orders enable row level security;
alter table public.disputes enable row level security;

create policy "orders_select_party" on public.orders
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "orders_insert_buyer" on public.orders
  for insert with check (buyer_id = auth.uid());
create policy "orders_update_party" on public.orders
  for update using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "disputes_select_party" on public.disputes
  for select using (exists (
    select 1 from public.orders o
    where o.id = disputes.order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));
create policy "disputes_insert_party" on public.disputes
  for insert with check (opened_by = auth.uid() and exists (
    select 1 from public.orders o
    where o.id = disputes.order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));
