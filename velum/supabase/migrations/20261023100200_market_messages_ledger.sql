-- ============================================================================
-- VELUM — plateformes d'échange et de vente (3/5) : MESSAGERIE et REGISTRE.
-- ----------------------------------------------------------------------------
--  1. market_messages : fil anonymisé d'une commande ou d'un échange, lisible
--     et alimenté par les SEULES parties ; corps expurgé des coordonnées à
--     l'écriture ; l'auteur n'est jamais exposé (pseudonyme via la RPC
--     thread_messages, migration 5/5).
--  2. platform_ledger : registre TRANSPARENT des montants (commission, frais
--     d'expertise, versement), alimenté par triggers à la libération d'une
--     commande, à la conclusion d'un échange et à la décision d'un expert ;
--     lisible par le seul membre concerné. Les mouvements de fonds réels
--     (Stripe Connect) se branchent aux points marqués STRIPE.
-- ============================================================================

-- ── 1. Messagerie anonymisée ─────────────────────────────────────────────────
create table public.market_messages (
  id uuid primary key default gen_random_uuid(),
  thread_kind text not null check (thread_kind in ('order', 'exchange')),
  thread_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  redacted boolean not null default false,
  created_at timestamptz not null default now()
);

create index market_messages_thread_idx
  on public.market_messages (thread_kind, thread_id, created_at);

-- Partie d'un fil (usage serveur).
create or replace function public._market_thread_party(p_kind text, p_thread uuid, p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_member is not null and case p_kind
    when 'order' then exists (
      select 1 from public.orders o
      where o.id = p_thread and p_member in (o.buyer_id, o.seller_id))
    when 'exchange' then exists (
      select 1 from public.exchange_proposals e
      where e.id = p_thread and p_member in (e.proposer_id, e.recipient_id))
    else false
  end
$$;
revoke all on function public._market_thread_party(text, uuid, uuid) from public, anon, authenticated;

-- L'utilisateur courant est-il partie du fil ? (policies RLS)
create or replace function public.is_market_thread_party(p_kind text, p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._market_thread_party(p_kind, p_thread, auth.uid())
$$;
revoke all on function public.is_market_thread_party(text, uuid) from public, anon;
grant execute on function public.is_market_thread_party(text, uuid) to authenticated, service_role;

alter table public.market_messages enable row level security;
create policy "market_messages_select_party" on public.market_messages
  for select using (public.is_market_thread_party(thread_kind, thread_id));

-- Écriture via la RPC send_market_message uniquement ; messages immuables ;
-- l'auteur (identifiant de membre) n'est jamais lisible en direct.
revoke all on public.market_messages from anon, authenticated;
grant select (id, thread_kind, thread_id, body, redacted, created_at)
  on public.market_messages to authenticated;

create or replace function public.set_market_message_defaults()
returns trigger
language plpgsql
as $$
declare
  v_body text := btrim(coalesce(new.body, ''));
begin
  if v_body = '' then
    raise exception 'Message vide' using errcode = 'P0001';
  end if;
  if not public._market_thread_party(new.thread_kind, new.thread_id, new.author_id) then
    raise exception 'Seules les parties de la transaction écrivent dans ce fil'
      using errcode = '42501';
  end if;
  new.body := public.redact_contact_info(v_body);
  new.redacted := new.body is distinct from v_body;
  new.created_at := now();
  return new;
end;
$$;

create trigger market_messages_set_defaults
  before insert on public.market_messages
  for each row execute function public.set_market_message_defaults();

-- L'autre partie est prévenue (pseudonyme de l'auteur uniquement).
create or replace function public.market_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
begin
  if new.thread_kind = 'order' then
    select case when o.buyer_id = new.author_id then o.seller_id else o.buyer_id end
      into v_other from public.orders o where o.id = new.thread_id;
  else
    select case when e.proposer_id = new.author_id then e.recipient_id else e.proposer_id end
      into v_other from public.exchange_proposals e where e.id = new.thread_id;
  end if;
  perform public.market_notify(
    v_other,
    'Nouveau message',
    format('%s vous a écrit.', public.market_alias_of(new.author_id)));
  return null;
end;
$$;

create trigger market_messages_after_insert
  after insert on public.market_messages
  for each row execute function public.market_message_after_insert();

-- Purge du fil à la suppression de la transaction (cascade RGPD).
create or replace function public.purge_market_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.market_messages
  where thread_kind = tg_argv[0] and thread_id = old.id;
  return null;
end;
$$;

create trigger orders_purge_market_thread
  after delete on public.orders
  for each row execute function public.purge_market_thread('order');

create trigger exchange_proposals_purge_market_thread
  after delete on public.exchange_proposals
  for each row execute function public.purge_market_thread('exchange');

-- Motif de litige d'une commande : lisible par l'autre partie ⇒ expurgé.
create or replace function public.redact_dispute_reason()
returns trigger
language plpgsql
as $$
begin
  new.reason := public.redact_contact_info(btrim(new.reason));
  if new.reason = '' then
    raise exception 'Motif du litige requis' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger disputes_redact_reason
  before insert or update of reason on public.disputes
  for each row execute function public.redact_dispute_reason();

-- Rattrapage : litiges existants (0006), motif et note lisibles par l'autre
-- partie — y compris les notes forgées par l'INSERT direct qu'autorisait 0006.
-- Seules les colonnes porteuses de coordonnées sont réécrites (un motif blanc
-- n'est pas touché : le trigger ci-dessus le refuserait).
update public.disputes
set reason = public.redact_contact_info(reason)
where reason is distinct from public.redact_contact_info(reason);
update public.disputes
set resolution_note = public.redact_contact_info(resolution_note)
where resolution_note is distinct from public.redact_contact_info(resolution_note);

-- ── 2. Registre de la plateforme ─────────────────────────────────────────────
create table public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  -- commission : due à VELUM ; certification_fee : frais d'expertise dus ;
  -- payout : versé au membre (net de vente, soulte reçue).
  kind text not null check (kind in ('commission', 'certification_fee', 'payout')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  -- Taux appliqué (commission) et assiette (prix, valeur déclarée, frais).
  rate numeric(5, 4),
  base_amount numeric(14, 2),
  order_id uuid references public.orders (id) on delete set null,
  exchange_id uuid references public.exchange_proposals (id) on delete set null,
  certification_id uuid references public.certification_requests (id) on delete set null,
  note text,
  -- Clé d'idempotence : une écriture par (membre, nature, événement source).
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (member_id, kind, source_key)
);

create index platform_ledger_member_idx on public.platform_ledger (member_id, created_at desc);

alter table public.platform_ledger enable row level security;
create policy "platform_ledger_select_own" on public.platform_ledger
  for select using (member_id = auth.uid());
-- Écriture exclusivement par triggers serveur.
revoke all on public.platform_ledger from anon, authenticated;
grant select on public.platform_ledger to authenticated;

-- Vente : commission (taux FIGÉ à l'achat) prélevée à la LIBÉRATION du
-- séquestre, versement net au vendeur (saleBreakdown, @velum/config).
-- STRIPE : capture → transfert Connect du net, application_fee = commission.
create or replace function public.ledger_on_order_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission numeric(14, 2);
begin
  if new.escrow_state = 'released' and old.escrow_state is distinct from 'released' then
    v_commission := round(greatest(new.amount, 0) * new.commission_rate, 2);
    insert into public.platform_ledger (
      member_id, kind, amount, currency, rate, base_amount, order_id, note, source_key)
    values
      (new.seller_id, 'commission', v_commission, new.currency, new.commission_rate,
       new.amount, new.id, 'Commission de vente (taux dégressif figé à l’achat)',
       'order:' || new.id),
      (new.seller_id, 'payout', greatest(new.amount - v_commission, 0), new.currency, null,
       new.amount, new.id, 'Versement net au vendeur à la libération du séquestre',
       'order:' || new.id)
    on conflict (member_id, kind, source_key) do nothing;
  end if;
  return null;
end;
$$;

create trigger orders_ledger_release
  after update on public.orders
  for each row execute function public.ledger_on_order_release();

-- Échange conclu : chaque partie paie la commission FIGÉE à l'acceptation
-- (son taux × valeur de l'objet qu'elle cède) ; la soulte, non commissionnée,
-- est versée à celui qui la reçoit. STRIPE : débit des commissions et
-- transfert de la soulte séquestrée.
create or replace function public.ledger_on_exchange_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := 'exchange:' || new.id;
begin
  if new.state = 'completed' and old.state is distinct from 'completed' then
    insert into public.platform_ledger (
      member_id, kind, amount, currency, rate, base_amount, exchange_id, note, source_key)
    values
      (new.proposer_id, 'commission', coalesce(new.proposer_commission, 0), new.currency,
       new.proposer_commission_rate, new.offered_value, new.id,
       'Commission d’échange (objet cédé, taux figé à l’acceptation)', v_key),
      (new.recipient_id, 'commission', coalesce(new.recipient_commission, 0), new.currency,
       new.recipient_commission_rate, new.listing_value, new.id,
       'Commission d’échange (objet cédé, taux figé à l’acceptation)', v_key)
    on conflict (member_id, kind, source_key) do nothing;
    if new.cash_adjustment <> 0 then
      insert into public.platform_ledger (
        member_id, kind, amount, currency, base_amount, exchange_id, note, source_key)
      values (
        case when new.cash_adjustment > 0 then new.recipient_id else new.proposer_id end,
        'payout', abs(new.cash_adjustment), new.currency, abs(new.cash_adjustment), new.id,
        'Soulte reçue (non commissionnée)', v_key)
      on conflict (member_id, kind, source_key) do nothing;
    end if;
  end if;
  return null;
end;
$$;

create trigger exchange_proposals_ledger_completion
  after update on public.exchange_proposals
  for each row execute function public.ledger_on_exchange_completion();

-- Expertise décidée (certifiée ou refusée) : frais dus selon le payeur —
-- 'seller' = propriétaire de l'objet, 'buyer' = autre partie de la
-- transaction, 'split' = moitié arrondie au centime pour le propriétaire, le
-- reste pour l'autre (splitCertificationFee, @velum/config). Sans autre
-- partie : propriétaire. NB : counterparty_id désigne la partie qui doit
-- ACCEPTER la demande ; quand l'acheteur demande, c'est le propriétaire —
-- l'« autre partie » est alors le demandeur.
create or replace function public.ledger_on_certification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric(14, 2) := coalesce(new.fee_amount, 0);
  v_other uuid := case
    when new.requested_by = new.owner_id then new.counterparty_id
    else new.requested_by
  end;
  v_owner_share numeric(14, 2);
  v_other_share numeric(14, 2);
  v_key text := 'certification:' || new.id;
begin
  if new.status in ('certified', 'rejected')
     and old.status is distinct from new.status
     and v_fee > 0 then
    if v_other is null or new.fee_payer = 'seller' then
      v_owner_share := v_fee;
    elsif new.fee_payer = 'buyer' then
      v_owner_share := 0;
    else
      v_owner_share := round(v_fee / 2, 2);
    end if;
    v_other_share := v_fee - v_owner_share;
    if v_owner_share > 0 then
      insert into public.platform_ledger (
        member_id, kind, amount, currency, base_amount, order_id, exchange_id,
        certification_id, note, source_key)
      values (
        new.owner_id, 'certification_fee', v_owner_share, 'EUR', v_fee, new.order_id,
        new.exchange_id, new.id, 'Frais d’expertise (part du propriétaire de l’objet)', v_key)
      on conflict (member_id, kind, source_key) do nothing;
    end if;
    if v_other_share > 0 and v_other is not null then
      insert into public.platform_ledger (
        member_id, kind, amount, currency, base_amount, order_id, exchange_id,
        certification_id, note, source_key)
      values (
        v_other, 'certification_fee', v_other_share, 'EUR', v_fee, new.order_id,
        new.exchange_id, new.id, 'Frais d’expertise (part de l’autre partie)', v_key)
      on conflict (member_id, kind, source_key) do nothing;
    end if;
  end if;
  return null;
end;
$$;

create trigger certification_requests_ledger_decision
  after update on public.certification_requests
  for each row execute function public.ledger_on_certification_decision();

-- Synthèse du commissionnement de l'utilisateur courant (écran « Mes frais »).
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
    'completedSales', (
      select count(*) from public.listings where seller_id = v_uid and status = 'sold'),
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
revoke all on function public.my_commission_summary() from public, anon;
grant execute on function public.my_commission_summary() to authenticated, service_role;
