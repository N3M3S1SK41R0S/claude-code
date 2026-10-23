-- ============================================================================
-- VELUM — plateformes d'échange et de vente (4/5) : RPC ANONYMISÉES.
-- ----------------------------------------------------------------------------
-- Surface client de @velum/api-client (packages/api-client/src/marketplace.ts) :
--  - lectures : market_catalogue (Platine), market_listing (annonce par
--    identifiant, hors catalogue pour ses parties), my_market_orders,
--    my_exchanges, my_certifications, thread_messages, member_reputation
--    (Platine) — jamais
--    d'identifiant de membre ni d'objet d'autrui, uniquement des pseudonymes ;
--  - actions : market_buy, advance_market_order, open_order_dispute,
--    propose_exchange, respond_exchange, withdraw_exchange, cancel_exchange,
--    ship_exchange, confirm_exchange_receipt, dispute_exchange,
--    request_certification, respond_certification, cancel_certification,
--    send_market_message — chaque action renvoie la vue anonymisée à jour ;
--    les règles (acteur légal, états) restent garanties par les triggers ;
--  - système (service_role : expert partenaire, transporteur, cron) :
--    assign_certification_expert, decide_certification, record_order_delivery,
--    record_exchange_delivery, resolve_exchange_dispute,
--    expire_stale_exchanges, complete_due_exchanges.
-- Codes d'erreur : P0001 règle métier, VL401 session/partie, VL402 offre
-- Platine requise, 42501 droit insuffisant.
-- ============================================================================

-- ── 1. Types de lignes anonymisées ───────────────────────────────────────────
create type public.market_order_view as (
  id uuid,
  listing_id uuid,
  -- Identifiant de l'utilisateur courant pour SON rôle ; null pour l'autre partie.
  buyer_id uuid,
  seller_id uuid,
  amount numeric,
  currency text,
  commission_rate numeric,
  escrow_state text,
  carrier text,
  tracking_number text,
  delivered_at timestamptz,
  released_at timestamptz,
  created_at timestamptz,
  role text,
  counterparty_alias text,
  listing_title text,
  listing_domain public.velum_domain,
  -- Certification demandée (ou obtenue) sur la commande elle-même.
  certification_required boolean,
  -- L'objet de l'annonce est déjà certifié : référence posée sur l'annonce,
  -- ou certification qui SUIT l'objet du vendeur (dernière décision d'expert
  -- = certification, contenu inchangé) — aucune nouvelle demande d'expertise
  -- n'est recevable sur la commande.
  listing_certified boolean
);

create type public.market_exchange_view as (
  id uuid,
  listing_id uuid,
  role text,
  counterparty_alias text,
  listing_title text,
  listing_domain public.velum_domain,
  listing_value numeric,
  offered_title text,
  offered_domain public.velum_domain,
  offered_value numeric,
  cash_adjustment numeric,
  currency text,
  message text,
  state text,
  my_commission numeric,
  certification_required boolean,
  -- L'objet de l'annonce visée est déjà certifié (référence posée sur
  -- l'annonce, ou certification qui suit l'objet du destinataire) : il n'est
  -- plus expertisable à la demande de l'auteur de la proposition.
  listing_certified boolean,
  -- MON objet offert : renseigné pour l'AUTEUR seulement (null pour le
  -- destinataire — jamais l'objet d'autrui).
  offered_item_id uuid,
  -- L'objet offert est déjà certifié (certification qui suit l'objet de
  -- l'auteur) : le destinataire ne peut plus en demander l'expertise.
  offered_item_certified boolean,
  proposer_tracking text,
  recipient_tracking text,
  proposer_received boolean,
  recipient_received boolean,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

create type public.market_certification_view as (
  id uuid,
  listing_id uuid,
  order_id uuid,
  exchange_id uuid,
  item_title text,
  domain public.velum_domain,
  reason text,
  status text,
  fee_payer text,
  fee_amount numeric,
  requested_by_me boolean,
  counterparty_agreed boolean,
  report_ref text,
  expert_note text,
  created_at timestamptz,
  decided_at timestamptz
);

create type public.market_message_view as (
  id uuid,
  thread_kind text,
  thread_id uuid,
  mine boolean,
  author_alias text,
  body text,
  redacted boolean,
  created_at timestamptz
);

-- Garde commune : session requise.
create or replace function public._market_require_uid()
returns uuid
language plpgsql
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Session requise' using errcode = 'VL401';
  end if;
  return v_uid;
end;
$$;

-- Garde commune : offre Platine requise pour parcourir les plateformes.
create or replace function public._market_require_platine()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  if not public.can_list_on_marketplace(v_uid) then
    raise exception 'Les plateformes d''échange et de vente sont réservées à l''offre Platine'
      using errcode = 'VL402';
  end if;
  return v_uid;
end;
$$;

-- ── 2. Catalogue anonymisé par catégorie ─────────────────────────────────────
create or replace function public.market_catalogue(
  p_domain public.velum_domain default null,
  p_mode text default null,
  p_text text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_certified_only boolean default false,
  p_include_mine boolean default false,
  p_sort text default 'recent',
  p_limit integer default 50
)
returns table (
  id uuid,
  kind text,
  domain public.velum_domain,
  title text,
  description text,
  ask_price numeric,
  currency text,
  exchange_wishes text,
  seller_alias text,
  certified boolean,
  certification_required boolean,
  is_mine boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := public._market_require_platine();
  v_sort text := coalesce(nullif(btrim(coalesce(p_sort, '')), ''), 'recent');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_tokens text[];
begin
  if p_mode is not null and p_mode not in ('sale', 'exchange') then
    raise exception 'Mode de catalogue inconnu : %', p_mode using errcode = 'P0001';
  end if;
  if v_sort not in ('recent', 'price_asc', 'price_desc') then
    raise exception 'Tri de catalogue inconnu : %', v_sort using errcode = 'P0001';
  end if;
  if p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then
    raise exception 'Fourchette de prix incohérente' using errcode = 'P0001';
  end if;

  -- Recherche : chaque mot (8 au plus) doit apparaître dans le titre, la
  -- description ou les souhaits d'échange — insensible à la casse et aux accents.
  select coalesce(array_agg(s.tok), '{}') into v_tokens
  from (
    select t.tok
    from unnest(regexp_split_to_array(public.market_fold(btrim(coalesce(p_text, ''))), '\s+')) as t(tok)
    where t.tok <> ''
    limit 8
  ) s;

  return query
  select
    l.id,
    l.kind,
    l.domain,
    l.title,
    l.description,
    l.ask_price,
    l.currency,
    l.exchange_wishes,
    public.market_alias_of(l.seller_id),
    l.expert_appraisal_ref is not null,
    l.expert_appraisal_required,
    l.seller_id = v_uid,
    l.created_at
  from public.listings l
  where l.status = 'active'
    -- Vendeur dont l'abonnement Platine a expiré : annonce plus proposée.
    and public.can_list_on_marketplace(l.seller_id)
    -- Annonce 0006 épargnée par le rattrapage (autre devise, prix sous le
    -- plancher) : jamais proposée (achat et échange la refusent).
    and l.currency = 'EUR'
    and l.ask_price >= public.market_min_ask_price_eur()
    and (coalesce(p_include_mine, false) or l.seller_id <> v_uid)
    and (p_domain is null or l.domain = p_domain)
    and (p_mode is null
      or (p_mode = 'sale' and l.kind in ('sale', 'sale_or_exchange'))
      or (p_mode = 'exchange' and l.kind in ('exchange', 'sale_or_exchange')))
    and (p_min_price is null or l.ask_price >= p_min_price)
    and (p_max_price is null or l.ask_price <= p_max_price)
    and (not coalesce(p_certified_only, false) or l.expert_appraisal_ref is not null)
    and not public.listing_is_engaged(l.id)
    and not exists (
      select 1 from unnest(v_tokens) as w(tok)
      where position(w.tok in public.market_fold(concat_ws(' ', l.title, l.description, l.exchange_wishes))) = 0)
  order by
    case when v_sort = 'price_asc' then l.ask_price end asc nulls last,
    case when v_sort = 'price_desc' then l.ask_price end desc nulls last,
    l.created_at desc,
    l.id
  limit v_limit;
end;
$$;

-- Une annonce par identifiant, mêmes colonnes (anonymisées) que le catalogue,
-- y compris HORS catalogue pour ses parties : réservée, suspendue, vendue,
-- échangée ou retirée, elle reste consultable par son vendeur, par l'acheteur
-- d'une de ses commandes et par les parties d'un échange qui la vise. Pour
-- les autres membres : mêmes règles que le catalogue — annonce publiée d'un
-- vendeur Platine, NON réservée (paiement capturé ou échange accepté par un
-- autre membre), en euros et au moins au prix plancher — et offre Platine
-- requise (VL402). Aucune ligne si l'annonce n'existe pas ou n'est pas
-- visible (jamais d'identifiant de membre ni d'objet).
create or replace function public.market_listing(p_id uuid)
returns table (
  id uuid,
  kind text,
  domain public.velum_domain,
  title text,
  description text,
  ask_price numeric,
  currency text,
  exchange_wishes text,
  seller_alias text,
  certified boolean,
  certification_required boolean,
  is_mine boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := public._market_require_uid();
  v_listing public.listings%rowtype;
  v_party boolean;
begin
  select * into v_listing from public.listings l where l.id = p_id;
  if not found then
    return;
  end if;
  v_party := v_listing.seller_id = v_uid
    or exists (
      select 1 from public.orders o
      where o.listing_id = v_listing.id and o.buyer_id = v_uid)
    or exists (
      select 1 from public.exchange_proposals e
      where e.listing_id = v_listing.id and v_uid in (e.proposer_id, e.recipient_id));
  if not v_party then
    if v_listing.status <> 'active'
       or not public.can_list_on_marketplace(v_listing.seller_id)
       or public.listing_is_engaged(v_listing.id)
       or v_listing.currency is distinct from 'EUR'
       or coalesce(v_listing.ask_price, 0) < public.market_min_ask_price_eur() then
      return;
    end if;
    perform public._market_require_platine();
  end if;

  return query
  select
    v_listing.id,
    v_listing.kind,
    v_listing.domain,
    v_listing.title,
    v_listing.description,
    v_listing.ask_price,
    v_listing.currency,
    v_listing.exchange_wishes,
    public.market_alias_of(v_listing.seller_id),
    v_listing.expert_appraisal_ref is not null,
    v_listing.expert_appraisal_required,
    v_listing.seller_id = v_uid,
    v_listing.created_at;
end;
$$;

-- Réputation d'un membre à partir de son PSEUDONYME (jamais d'identifiant).
create or replace function public.member_reputation(p_alias text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  perform public._market_require_platine();
  select a.member_id into v_member from public.market_aliases a where a.alias = btrim(p_alias);
  if not found then
    return null;
  end if;
  return public.seller_reputation(v_member) || jsonb_build_object(
    'completedExchanges', (
      select count(*) from public.exchange_proposals e
      where e.state = 'completed' and v_member in (e.proposer_id, e.recipient_id)));
end;
$$;

-- ── 3. Vues de l'utilisateur courant ─────────────────────────────────────────
create or replace function public.my_market_orders(p_order uuid default null)
returns setof public.market_order_view
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.listing_id,
    case when o.buyer_id = auth.uid() then o.buyer_id end,
    case when o.seller_id = auth.uid() then o.seller_id end,
    o.amount,
    o.currency,
    o.commission_rate,
    o.escrow_state,
    o.carrier,
    o.tracking_number,
    o.delivered_at,
    o.released_at,
    o.created_at,
    case when o.seller_id = auth.uid() then 'seller' else 'buyer' end,
    public.market_alias_of(case when o.seller_id = auth.uid() then o.buyer_id else o.seller_id end),
    l.title,
    l.domain,
    exists (
      select 1 from public.certification_requests c
      where c.order_id = o.id and c.status in ('requested', 'in_review', 'certified')),
    -- Même règle que request_certification (aide interne : SECURITY DEFINER).
    (l.expert_appraisal_ref is not null
      or public._market_item_certification_ref(l.item_id, o.seller_id) is not null)
  from public.orders o
  join public.listings l on l.id = o.listing_id
  where auth.uid() in (o.buyer_id, o.seller_id)
    and (p_order is null or o.id = p_order)
  order by o.created_at desc, o.id
$$;

create or replace function public.my_exchanges(p_exchange uuid default null)
returns setof public.market_exchange_view
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.listing_id,
    case when e.proposer_id = auth.uid() then 'proposer' else 'recipient' end,
    public.market_alias_of(case when e.proposer_id = auth.uid() then e.recipient_id else e.proposer_id end),
    e.listing_title,
    e.listing_domain,
    e.listing_value,
    e.offered_title,
    e.offered_domain,
    e.offered_value,
    e.cash_adjustment,
    e.currency,
    e.message,
    e.state,
    case when e.proposer_id = auth.uid() then e.proposer_commission else e.recipient_commission end,
    e.certification_required,
    -- Mêmes règles que request_certification (aides internes : SECURITY DEFINER).
    (l.expert_appraisal_ref is not null
      or public._market_item_certification_ref(l.item_id, e.recipient_id) is not null),
    case when e.proposer_id = auth.uid() then e.offered_item_id end,
    public._market_item_certification_ref(e.offered_item_id, e.proposer_id) is not null,
    e.proposer_tracking,
    e.recipient_tracking,
    e.proposer_received,
    e.recipient_received,
    e.expires_at,
    e.created_at,
    e.updated_at
  from public.exchange_proposals e
  left join public.listings l on l.id = e.listing_id
  where auth.uid() in (e.proposer_id, e.recipient_id)
    and (p_exchange is null or e.id = p_exchange)
  order by e.updated_at desc, e.id
$$;

create or replace function public.my_certifications(p_certification uuid default null)
returns setof public.market_certification_view
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.listing_id,
    c.order_id,
    c.exchange_id,
    c.item_title,
    c.domain,
    c.reason,
    c.status,
    c.fee_payer,
    c.fee_amount,
    c.requested_by = auth.uid(),
    c.counterparty_agreed,
    c.report_ref,
    c.expert_note,
    c.created_at,
    c.decided_at
  from public.certification_requests c
  where auth.uid() in (c.owner_id, c.requested_by, c.counterparty_id)
    and (p_certification is null or c.id = p_certification)
  order by c.created_at desc, c.id
$$;

create or replace function public.thread_messages(p_kind text, p_thread uuid)
returns setof public.market_message_view
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  if not public._market_thread_party(p_kind, p_thread, v_uid) then
    raise exception 'Fil de discussion inaccessible' using errcode = 'VL401';
  end if;
  return query
  select m.id, m.thread_kind, m.thread_id, m.author_id = v_uid,
         public.market_alias_of(m.author_id), m.body, m.redacted, m.created_at
  from public.market_messages m
  where m.thread_kind = p_kind and m.thread_id = p_thread
  order by m.created_at, m.id;
end;
$$;

-- ── 4. Actions : commandes ───────────────────────────────────────────────────
-- SECURITY INVOKER : l'insertion passe par la RLS et set_order_defaults.
create or replace function public.market_buy(p_listing uuid)
returns setof public.market_order_view
language plpgsql
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_id uuid;
begin
  begin
    insert into public.orders (listing_id, buyer_id) values (p_listing, v_uid)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Vous avez déjà une commande en attente de paiement pour cette annonce'
      using errcode = 'P0001';
  end;
  return query select * from public.my_market_orders(v_id);
end;
$$;

-- SECURITY INVOKER : RLS des parties + machine à états + termes figés.
create or replace function public.advance_market_order(
  p_order uuid,
  p_state text,
  p_carrier text default null,
  p_tracking text default null,
  p_delivered_at timestamptz default null
)
returns setof public.market_order_view
language plpgsql
as $$
declare
  v_count integer;
begin
  perform public._market_require_uid();
  update public.orders
     set escrow_state = p_state,
         carrier = coalesce(nullif(btrim(coalesce(p_carrier, '')), ''), carrier),
         tracking_number = coalesce(nullif(btrim(coalesce(p_tracking, '')), ''), tracking_number),
         delivered_at = coalesce(p_delivered_at, delivered_at)
   where id = p_order;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Commande introuvable' using errcode = 'P0001';
  end if;
  return query select * from public.my_market_orders(p_order);
end;
$$;

create or replace function public.open_order_dispute(p_order uuid, p_reason text)
returns setof public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_dispute public.disputes%rowtype;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Motif du litige requis' using errcode = 'P0001';
  end if;
  -- La machine à états (acteur = auth.uid()) n'autorise que l'acheteur.
  update public.orders set escrow_state = 'disputed'
   where id = p_order and v_uid in (buyer_id, seller_id);
  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0001';
  end if;
  insert into public.disputes (order_id, opened_by, reason)
  values (p_order, v_uid, p_reason)
  returning * into v_dispute;
  return next v_dispute;
end;
$$;

-- ── 5. Actions : échanges ────────────────────────────────────────────────────
create or replace function public.propose_exchange(
  p_listing uuid,
  p_offered_item uuid,
  p_offered_value numeric,
  p_cash_adjustment numeric default 0,
  p_message text default null
)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_id uuid;
begin
  begin
    insert into public.exchange_proposals (
      listing_id, proposer_id, offered_item_id, offered_value, cash_adjustment, message)
    values (
      p_listing, v_uid, p_offered_item, p_offered_value, coalesce(p_cash_adjustment, 0), p_message)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Vous avez déjà une proposition en attente sur cette annonce'
      using errcode = 'P0001';
  end;
  return query select * from public.my_exchanges(v_id);
end;
$$;

-- Mise à jour d'un échange par une partie (filtre explicite : les RPC
-- SECURITY DEFINER contournent la RLS) ; la machine à états vérifie l'acteur.
create or replace function public._exchange_party_update_done(p_found boolean)
returns void
language plpgsql
as $$
begin
  if not p_found then
    raise exception 'Échange introuvable parmi les vôtres' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.respond_exchange(p_exchange uuid, p_accept boolean)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  update public.exchange_proposals
     set state = case when p_accept then 'accepted' else 'declined' end
   where id = p_exchange and recipient_id = v_uid;
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

create or replace function public.withdraw_exchange(p_exchange uuid)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  update public.exchange_proposals set state = 'withdrawn'
   where id = p_exchange and proposer_id = v_uid;
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

create or replace function public.cancel_exchange(p_exchange uuid)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  update public.exchange_proposals set state = 'cancelled'
   where id = p_exchange and v_uid in (proposer_id, recipient_id);
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

create or replace function public.ship_exchange(
  p_exchange uuid,
  p_tracking text,
  p_carrier text default null
)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_tracking text := nullif(btrim(coalesce(p_tracking, '')), '');
  v_carrier text := nullif(btrim(coalesce(p_carrier, '')), '');
begin
  if v_tracking is null then
    raise exception 'Numéro de suivi requis' using errcode = 'P0001';
  end if;
  update public.exchange_proposals
     set proposer_tracking = case when proposer_id = v_uid then v_tracking else proposer_tracking end,
         proposer_carrier = case when proposer_id = v_uid then v_carrier else proposer_carrier end,
         recipient_tracking = case when recipient_id = v_uid then v_tracking else recipient_tracking end,
         recipient_carrier = case when recipient_id = v_uid then v_carrier else recipient_carrier end
   where id = p_exchange and v_uid in (proposer_id, recipient_id);
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

create or replace function public.confirm_exchange_receipt(p_exchange uuid)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  -- Seconde confirmation ⇒ échange conclu dans la même écriture.
  update public.exchange_proposals
     set proposer_received = case when proposer_id = v_uid then true else proposer_received end,
         recipient_received = case when recipient_id = v_uid then true else recipient_received end,
         state = case
           when state = 'shipping'
            and ((proposer_id = v_uid and recipient_received)
              or (recipient_id = v_uid and proposer_received))
           then 'completed'
           else state
         end
   where id = p_exchange and v_uid in (proposer_id, recipient_id);
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

create or replace function public.dispute_exchange(p_exchange uuid, p_reason text)
returns setof public.market_exchange_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Motif du litige requis' using errcode = 'P0001';
  end if;
  update public.exchange_proposals
     set state = 'disputed', dispute_reason = btrim(p_reason)
   where id = p_exchange and v_uid in (proposer_id, recipient_id);
  perform public._exchange_party_update_done(found);
  return query select * from public.my_exchanges(p_exchange);
end;
$$;

-- ── 6. Actions : certification par un expert ────────────────────────────────
-- Contextes :
--  - annonce (propriétaire) : 'voluntary' (badge), ou 'threshold' pour
--    relancer une certification obligatoire (après refus ou abandon) ;
--  - commande / échange (une partie) : 'mutual_agreement' — accord de l'autre
--    partie attendu ; sur un échange, l'objet certifié est celui que le
--    demandeur REÇOIT. Frais : vendeur (annonce), partagés par défaut (accord).
create or replace function public.request_certification(
  p_reason text,
  p_listing uuid default null,
  p_order uuid default null,
  p_exchange uuid default null,
  p_fee_payer text default null
)
returns setof public.market_certification_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_listing public.listings%rowtype;
  v_order public.orders%rowtype;
  v_ex public.exchange_proposals%rowtype;
  v_item uuid;
  v_title text;
  v_domain public.velum_domain;
  v_owner uuid;
  v_id uuid;
begin
  if p_reason is null or p_reason not in ('threshold', 'mutual_agreement', 'voluntary') then
    raise exception 'Motif de certification inconnu : %', p_reason using errcode = 'P0001';
  end if;
  if num_nonnulls(p_listing, p_order, p_exchange) <> 1 then
    raise exception 'Préciser un seul contexte : annonce, commande ou échange' using errcode = 'P0001';
  end if;
  if p_fee_payer is not null and p_fee_payer not in ('seller', 'buyer', 'split') then
    raise exception 'Payeur des frais inconnu : %', p_fee_payer using errcode = 'P0001';
  end if;

  begin
    if p_listing is not null then
      -- Démarche sur une annonce (badge, republication) : offre Platine requise.
      perform public._market_require_platine();
      select * into v_listing from public.listings where id = p_listing and seller_id = v_uid;
      if not found then
        raise exception 'Annonce introuvable parmi les vôtres' using errcode = 'P0001';
      end if;
      if p_reason = 'mutual_agreement' then
        raise exception 'L''accord mutuel se demande sur une commande ou un échange'
          using errcode = 'P0001';
      end if;
      if v_listing.status not in ('draft', 'active', 'pending_certification') then
        raise exception 'Annonce close ou retirée' using errcode = 'P0001';
      end if;
      if v_listing.expert_appraisal_ref is not null then
        raise exception 'Objet déjà authentifié par un expert' using errcode = 'P0001';
      end if;
      if p_reason = 'threshold' and not v_listing.expert_appraisal_required then
        raise exception 'Annonce sous le seuil : demandez une certification volontaire'
          using errcode = 'P0001';
      end if;
      if public.listing_is_engaged(v_listing.id) then
        raise exception 'Annonce engagée dans une transaction : demandez l''expertise sur la transaction'
          using errcode = 'P0001';
      end if;
      -- Contenu ACTUEL de l'objet (titre expurgé, catégorie), celui que
      -- _market_item_certification_ref compare : la certification suit
      -- l'objet même renommé depuis la publication (titre de l'annonce figé).
      -- Objet illisible : titre de l'annonce.
      select public.redact_contact_info(i.title), i.domain into v_title, v_domain
      from public.items i where i.id = v_listing.item_id;
      if not found then
        v_title := v_listing.title;
        v_domain := v_listing.domain;
      end if;
      insert into public.certification_requests (
        listing_id, item_id, item_title, domain, owner_id, requested_by,
        reason, status, fee_payer)
      values (
        v_listing.id, v_listing.item_id, v_title, v_domain, v_uid, v_uid,
        p_reason, 'requested', 'seller')
      returning id into v_id;

    elsif p_order is not null then
      select * into v_order from public.orders
       where id = p_order and v_uid in (buyer_id, seller_id);
      if not found then
        raise exception 'Commande introuvable' using errcode = 'P0001';
      end if;
      if p_reason <> 'mutual_agreement' then
        raise exception 'Sur une commande, la certification se décide d''un commun accord'
          using errcode = 'P0001';
      end if;
      if v_order.escrow_state not in ('pending_payment', 'funds_held') then
        raise exception 'Trop tard : l''objet est déjà expédié ou la commande est close'
          using errcode = 'P0001';
      end if;
      select * into v_listing from public.listings where id = v_order.listing_id;
      -- Annonce certifiée, ou objet du vendeur déjà certifié (la
      -- certification suit l'objet : commande antérieure annulée…).
      if v_listing.expert_appraisal_ref is not null
         or public._market_item_certification_ref(v_listing.item_id, v_order.seller_id) is not null then
        raise exception 'Objet déjà authentifié par un expert avant publication'
          using errcode = 'P0001';
      end if;
      insert into public.certification_requests (
        listing_id, order_id, item_id, item_title, domain, owner_id, requested_by,
        counterparty_id, reason, status, fee_payer)
      values (
        v_order.listing_id, v_order.id, v_listing.item_id, v_listing.title, v_listing.domain,
        v_order.seller_id, v_uid,
        case when v_uid = v_order.seller_id then v_order.buyer_id else v_order.seller_id end,
        'mutual_agreement', 'awaiting_agreement', coalesce(p_fee_payer, 'split'))
      returning id into v_id;

    else
      select * into v_ex from public.exchange_proposals
       where id = p_exchange and v_uid in (proposer_id, recipient_id);
      if not found then
        raise exception 'Échange introuvable parmi les vôtres' using errcode = 'P0001';
      end if;
      if p_reason <> 'mutual_agreement' then
        raise exception 'Sur un échange, la certification se décide d''un commun accord'
          using errcode = 'P0001';
      end if;
      if v_ex.state not in ('accepted', 'awaiting_certification', 'shipping')
         or v_ex.proposer_tracking is not null or v_ex.recipient_tracking is not null then
        raise exception 'Trop tard : un objet est déjà expédié, ou l''échange n''est pas en cours'
          using errcode = 'P0001';
      end if;
      if v_uid = v_ex.proposer_id then
        select * into v_listing from public.listings where id = v_ex.listing_id;
        if v_listing.expert_appraisal_ref is not null then
          raise exception 'Objet déjà authentifié par un expert' using errcode = 'P0001';
        end if;
        v_item := v_listing.item_id;
        v_title := v_ex.listing_title;
        v_domain := v_ex.listing_domain;
        v_owner := v_ex.recipient_id;
      else
        v_item := v_ex.offered_item_id;
        v_title := v_ex.offered_title;
        v_domain := v_ex.offered_domain;
        v_owner := v_ex.proposer_id;
      end if;
      if public._market_item_certification_ref(v_item, v_owner) is not null
         or exists (
           select 1 from public.certification_requests c
           where c.exchange_id = v_ex.id and c.item_id = v_item
             and c.status in ('awaiting_agreement', 'requested', 'in_review', 'certified')) then
        raise exception 'Certification déjà obtenue ou demandée pour cet objet' using errcode = 'P0001';
      end if;
      insert into public.certification_requests (
        exchange_id, item_id, item_title, domain, owner_id, requested_by,
        counterparty_id, reason, status, fee_payer)
      values (
        v_ex.id, v_item, v_title, v_domain, v_owner, v_uid, v_owner,
        'mutual_agreement', 'awaiting_agreement', coalesce(p_fee_payer, 'split'))
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Une demande de certification est déjà ouverte' using errcode = 'P0001';
  end;

  return query select * from public.my_certifications(v_id);
end;
$$;

create or replace function public.respond_certification(p_certification uuid, p_agree boolean)
returns setof public.market_certification_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  update public.certification_requests
     set status = case when p_agree then 'requested' else 'cancelled' end
   where id = p_certification and counterparty_id = v_uid and status = 'awaiting_agreement';
  if not found then
    raise exception 'Demande introuvable ou déjà traitée' using errcode = 'P0001';
  end if;
  return query select * from public.my_certifications(p_certification);
end;
$$;

create or replace function public.cancel_certification(p_certification uuid)
returns setof public.market_certification_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
begin
  update public.certification_requests set status = 'cancelled'
   where id = p_certification and v_uid in (owner_id, requested_by, counterparty_id);
  if not found then
    raise exception 'Demande introuvable' using errcode = 'P0001';
  end if;
  return query select * from public.my_certifications(p_certification);
end;
$$;

-- ── 7. Action : messagerie ───────────────────────────────────────────────────
create or replace function public.send_market_message(p_kind text, p_thread uuid, p_body text)
returns setof public.market_message_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._market_require_uid();
  v_id uuid;
begin
  if not public._market_thread_party(p_kind, p_thread, v_uid) then
    raise exception 'Fil de discussion inaccessible' using errcode = 'VL401';
  end if;
  insert into public.market_messages (thread_kind, thread_id, author_id, body)
  values (p_kind, p_thread, v_uid, p_body)
  returning id into v_id;
  return query
  select m.id, m.thread_kind, m.thread_id, true, public.market_alias_of(v_uid),
         m.body, m.redacted, m.created_at
  from public.market_messages m where m.id = v_id;
end;
$$;

-- ── 8. Fonctions SYSTÈME (service_role) ──────────────────────────────────────
-- Expert partenaire assigné : frais connus, expertise en cours.
create or replace function public.assign_certification_expert(
  p_certification uuid,
  p_fee_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
begin
  update public.certification_requests
     set status = 'in_review', fee_amount = coalesce(p_fee_amount, fee_amount)
   where id = p_certification and status = 'requested';
  if not found then
    raise exception 'Demande introuvable ou pas en attente d''expert' using errcode = 'P0001';
  end if;
  perform public.market_system_end(v_prev);
end;
$$;

-- Décision de l'expert (comme resolve_dispute) : certifiée ⇒ badge et
-- publication de l'annonce en attente ; refusée ⇒ annonce non publiée,
-- transaction annulée.
create or replace function public.decide_certification(
  p_certification uuid,
  p_certified boolean,
  p_report_ref text default null,
  p_expert_note text default null,
  p_fee_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
begin
  update public.certification_requests
     set status = case when p_certified then 'certified' else 'rejected' end,
         report_ref = nullif(btrim(coalesce(p_report_ref, '')), ''),
         expert_note = nullif(btrim(coalesce(p_expert_note, '')), ''),
         fee_amount = coalesce(p_fee_amount, fee_amount)
   where id = p_certification and status in ('requested', 'in_review');
  if not found then
    raise exception 'Demande introuvable ou non décidable' using errcode = 'P0001';
  end if;
  perform public.market_system_end(v_prev);
end;
$$;

-- Livraison attestée par le transporteur (point d'intégration du suivi).
create or replace function public.record_order_delivery(
  p_order uuid,
  p_delivered_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
begin
  update public.orders set delivered_at = coalesce(p_delivered_at, now())
   where id = p_order and escrow_state = 'shipped';
  if not found then
    raise exception 'Commande introuvable ou non expédiée' using errcode = 'P0001';
  end if;
  perform public.market_system_end(v_prev);
end;
$$;

-- p_side = partie dont le COLIS a été livré ('proposer' | 'recipient').
create or replace function public.record_exchange_delivery(
  p_exchange uuid,
  p_side text,
  p_delivered_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  if p_side is null or p_side not in ('proposer', 'recipient') then
    raise exception 'Partie inconnue : %', p_side using errcode = 'P0001';
  end if;
  v_prev := public.market_system_begin();
  update public.exchange_proposals
     set proposer_delivered_at = case when p_side = 'proposer'
           then coalesce(p_delivered_at, now()) else proposer_delivered_at end,
         recipient_delivered_at = case when p_side = 'recipient'
           then coalesce(p_delivered_at, now()) else recipient_delivered_at end
   where id = p_exchange
     and state = 'shipping'
     and (case when p_side = 'proposer' then proposer_tracking else recipient_tracking end) is not null;
  if not found then
    raise exception 'Échange introuvable, hors expédition ou colis non expédié' using errcode = 'P0001';
  end if;
  perform public.market_system_end(v_prev);
end;
$$;

-- Arbitrage d'un litige d'échange (plateforme).
create or replace function public.resolve_exchange_dispute(
  p_exchange uuid,
  p_complete boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
begin
  update public.exchange_proposals
     set state = case when p_complete then 'completed' else 'cancelled' end,
         resolution_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_exchange and state = 'disputed';
  if not found then
    raise exception 'Échange introuvable ou sans litige ouvert' using errcode = 'P0001';
  end if;
  perform public.market_system_end(v_prev);
end;
$$;

-- Propositions sans réponse au-delà de leur échéance (cron).
create or replace function public.expire_stale_exchanges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
  v_count integer;
begin
  update public.exchange_proposals set state = 'expired'
   where state = 'proposed' and expires_at <= now();
  get diagnostics v_count = row_count;
  perform public.market_system_end(v_prev);
  return v_count;
end;
$$;

-- Auto-confirmation : les deux colis livrés depuis plus de
-- escrow_release_days() jours, sans litige ⇒ échange conclu (cron).
create or replace function public.complete_due_exchanges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text := public.market_system_begin();
  v_count integer;
begin
  update public.exchange_proposals
     set state = 'completed'
   where state = 'shipping'
     and proposer_delivered_at is not null
     and recipient_delivered_at is not null
     and greatest(proposer_delivered_at, recipient_delivered_at)
         < now() - make_interval(days => public.escrow_release_days());
  get diagnostics v_count = row_count;
  perform public.market_system_end(v_prev);
  return v_count;
end;
$$;

-- ── 9. Droits d'exécution ────────────────────────────────────────────────────
-- Supabase accorde EXECUTE à anon/authenticated sur toute nouvelle fonction :
-- on retire explicitement, puis on accorde au juste rôle.
do $grants$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public._market_require_uid()',
    'public._market_require_platine()',
    'public.market_catalogue(public.velum_domain, text, text, numeric, numeric, boolean, boolean, text, integer)',
    'public.market_listing(uuid)',
    'public.member_reputation(text)',
    'public.my_market_orders(uuid)',
    'public.my_exchanges(uuid)',
    'public.my_certifications(uuid)',
    'public.thread_messages(text, uuid)',
    'public.market_buy(uuid)',
    'public.advance_market_order(uuid, text, text, text, timestamptz)',
    'public.open_order_dispute(uuid, text)',
    'public.propose_exchange(uuid, uuid, numeric, numeric, text)',
    'public._exchange_party_update_done(boolean)',
    'public.respond_exchange(uuid, boolean)',
    'public.withdraw_exchange(uuid)',
    'public.cancel_exchange(uuid)',
    'public.ship_exchange(uuid, text, text)',
    'public.confirm_exchange_receipt(uuid)',
    'public.dispute_exchange(uuid, text)',
    'public.request_certification(text, uuid, uuid, uuid, text)',
    'public.respond_certification(uuid, boolean)',
    'public.cancel_certification(uuid)',
    'public.send_market_message(text, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;

  foreach v_fn in array array[
    'public.assign_certification_expert(uuid, numeric)',
    'public.decide_certification(uuid, boolean, text, text, numeric)',
    'public.record_order_delivery(uuid, timestamptz)',
    'public.record_exchange_delivery(uuid, text, timestamptz)',
    'public.resolve_exchange_dispute(uuid, boolean, text)',
    'public.expire_stale_exchanges()',
    'public.complete_due_exchanges()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end
$grants$;
