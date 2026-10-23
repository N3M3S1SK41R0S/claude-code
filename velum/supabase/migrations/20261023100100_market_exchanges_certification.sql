-- ============================================================================
-- VELUM — plateformes d'échange et de vente (2/5) : ÉCHANGES et CERTIFICATION.
-- ----------------------------------------------------------------------------
-- Règles métier (source : packages/config/src/marketplace.ts) :
--  - CERTIFICATION obligatoire quand la valeur de référence
--    max(prix demandé ou valeur déclarée, plus haute estimation VELUM récente
--    — à défaut, dernière estimation passée) DÉPASSE
--    listing_appraisal_threshold_eur() (500 €) : on ne contourne pas le seuil
--    en sous-déclarant. L'annonce naît (ou repasse) en 'pending_certification'
--    et une demande 'threshold' (frais : vendeur) est ouverte d'office ; elle
--    n'est JAMAIS 'active' sans certification obtenue. Sous le seuil :
--    certification sur accord des deux parties d'une commande ou d'un échange
--    (frais partagés), ou démarche volontaire du propriétaire.
--  - Tant qu'une certification est ouverte sur une commande ou un échange,
--    l'expédition est bloquée. Refus de l'expert (quel que soit le motif ou
--    le contexte) ⇒ toute transaction non expédiée sur l'objet annulée, toute
--    annonce ouverte de l'objet dépubliée et dépouillée d'une certification
--    antérieure, refus mémorisé (republication = nouvelle certification).
--    Une certification ne suit l'objet que si la DERNIÈRE décision d'expert
--    est une certification et que l'objet est resté celui qui a été certifié
--    (titre, catégorie) : toute (re)publication la recalcule.
--  - UNE SEULE annonce ouverte par objet ; un objet cédé (vente ou échange
--    conclu) ne se réannonce ni ne s'échange plus ; euro uniquement ; prix
--    plancher 1 € ; la capture d'un paiement revérifie l'annonce (statut,
--    prix, devise, nature) ; le suivi d'expédition n'est jamais un texte libre.
--  - ÉCHANGE : chaque partie paie SON taux dégressif sur la valeur déclarée de
--    l'objet qu'elle CÈDE, commissions FIGÉES à l'acceptation ; la soulte n'est
--    pas commissionnée.
--
-- Machine à états des échanges (trigger, acteur légal par transition — calquée
-- sur enforce_escrow_transition, 0006) :
--   proposed → accepted (destinataire) | declined (destinataire)
--            | withdrawn (auteur) | expired (système)
--   accepted → awaiting_certification | shipping (système, immédiat)
--   awaiting_certification → shipping (système : certifications obtenues)
--   shipping → awaiting_certification (système : accord mutuel conclu avant
--            toute expédition)
--   shipping → completed (une partie, quand les deux réceptions sont
--            confirmées ; ou système : auto-confirmation J+X)
--            | disputed (une partie)
--   accepted / awaiting_certification / shipping → cancelled (une partie,
--            AVANT toute expédition ; ou système : certification refusée)
--   disputed → completed | cancelled (système : arbitrage)
-- ============================================================================

-- ── 1. Paramètres ────────────────────────────────────────────────────────────
-- Durée de validité d'une proposition d'échange sans réponse (jours).
create or replace function public.exchange_proposal_ttl_days()
returns integer language sql immutable as $$ select 7 $$;

-- ── 2. Tables ────────────────────────────────────────────────────────────────
create table public.exchange_proposals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Identités des parties : JAMAIS exposées à l'autre partie (privilèges de
  -- colonnes + vues anonymisées my_exchanges()).
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- Objet de la collection du proposeur (jamais exposé au destinataire).
  offered_item_id uuid references public.items (id) on delete set null,
  -- Instantanés d'affichage (titres expurgés, domaines, valeurs déclarées EUR).
  listing_title text,
  listing_domain public.velum_domain,
  listing_value numeric(14, 2) not null check (listing_value > 0),
  offered_title text,
  offered_domain public.velum_domain,
  offered_value numeric(14, 2) not null check (offered_value > 0),
  -- Soulte versée par l'auteur au destinataire (> 0) ou demandée (< 0).
  cash_adjustment numeric(14, 2) not null default 0,
  -- Euro uniquement (seuil, commissions et registre sont exprimés en EUR).
  currency text not null default 'EUR' constraint exchange_proposals_currency_eur check (currency = 'EUR'),
  message text check (char_length(message) <= 2000),
  message_redacted boolean not null default false,
  state text not null default 'proposed' check (state in (
    'proposed', 'accepted', 'declined', 'withdrawn', 'expired',
    'awaiting_certification', 'shipping', 'completed', 'disputed', 'cancelled')),
  certification_required boolean not null default false,
  -- Commissions FIGÉES à l'acceptation (null avant).
  proposer_commission_rate numeric(5, 4)
    check (proposer_commission_rate >= 0 and proposer_commission_rate <= 1),
  proposer_commission numeric(14, 2) check (proposer_commission >= 0),
  recipient_commission_rate numeric(5, 4)
    check (recipient_commission_rate >= 0 and recipient_commission_rate <= 1),
  recipient_commission numeric(14, 2) check (recipient_commission >= 0),
  -- Expédition de chaque partie (étiquettes masquées côté transporteur).
  proposer_carrier text,
  proposer_tracking text,
  proposer_shipped_at timestamptz,
  proposer_delivered_at timestamptz,
  recipient_carrier text,
  recipient_tracking text,
  recipient_shipped_at timestamptz,
  recipient_delivered_at timestamptz,
  -- Réception confirmée PAR chaque partie (de l'objet de l'autre).
  proposer_received boolean not null default false,
  recipient_received boolean not null default false,
  dispute_reason text check (char_length(dispute_reason) <= 2000),
  disputed_by uuid references public.profiles (id) on delete set null,
  disputed_at timestamptz,
  resolution_note text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_id <> recipient_id)
);

create index exchange_proposals_proposer_idx on public.exchange_proposals (proposer_id, updated_at desc);
create index exchange_proposals_recipient_idx on public.exchange_proposals (recipient_id, updated_at desc);
create index exchange_proposals_listing_idx on public.exchange_proposals (listing_id, state);
create index exchange_proposals_offered_item_idx on public.exchange_proposals (offered_item_id, state);
create index exchange_proposals_expiry_idx on public.exchange_proposals (expires_at)
  where state = 'proposed';
-- Une seule proposition en attente par membre et par annonce (anti-spam).
create unique index exchange_proposals_one_pending_idx
  on public.exchange_proposals (listing_id, proposer_id) where state = 'proposed';

create table public.certification_requests (
  id uuid primary key default gen_random_uuid(),
  -- Contexte : annonce (seuil / volontaire), commande ou échange.
  listing_id uuid references public.listings (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  exchange_id uuid references public.exchange_proposals (id) on delete cascade,
  -- Objet à certifier (collection du propriétaire — jamais exposé à l'autre partie).
  item_id uuid references public.items (id) on delete set null,
  item_title text,
  domain public.velum_domain,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  -- Autre partie de la transaction (null pour une annonce seule).
  counterparty_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('threshold', 'mutual_agreement', 'voluntary')),
  status text not null default 'requested' check (status in (
    'awaiting_agreement', 'requested', 'in_review', 'certified', 'rejected', 'cancelled')),
  fee_payer text not null default 'seller' check (fee_payer in ('seller', 'buyer', 'split')),
  -- Frais d'expertise (EUR), fixés par l'expert partenaire à l'assignation.
  fee_amount numeric(10, 2) check (fee_amount >= 0),
  counterparty_agreed boolean not null default false,
  -- Rapport d'expert (chemin Storage privé) et avis.
  report_ref text,
  expert_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (num_nonnulls(listing_id, order_id, exchange_id) >= 1),
  check (reason <> 'mutual_agreement' or counterparty_id is not null),
  check (status <> 'certified' or report_ref is not null)
);

create index certification_requests_owner_idx on public.certification_requests (owner_id, created_at desc);
create index certification_requests_requested_by_idx on public.certification_requests (requested_by);
create index certification_requests_counterparty_idx on public.certification_requests (counterparty_id);
create index certification_requests_item_idx on public.certification_requests (item_id, owner_id)
  where status = 'certified';
-- Au plus UNE demande ouverte par annonce seule, par commande, par objet d'échange.
create unique index certification_requests_open_listing_idx
  on public.certification_requests (listing_id)
  where order_id is null and exchange_id is null
    and status in ('awaiting_agreement', 'requested', 'in_review');
create unique index certification_requests_open_order_idx
  on public.certification_requests (order_id)
  where order_id is not null and status in ('awaiting_agreement', 'requested', 'in_review');
create unique index certification_requests_open_exchange_idx
  on public.certification_requests (exchange_id, item_id)
  where exchange_id is not null and status in ('awaiting_agreement', 'requested', 'in_review');

-- ── 3. RLS et privilèges de colonnes ─────────────────────────────────────────
-- Écritures client : AUCUNE en direct — uniquement via les RPC SECURITY
-- DEFINER (migration 5/5), qui vérifient l'acteur. Lecture directe limitée
-- aux parties ET aux colonnes non identifiantes.
alter table public.exchange_proposals enable row level security;
alter table public.certification_requests enable row level security;

create policy "exchange_proposals_select_party" on public.exchange_proposals
  for select using (auth.uid() in (proposer_id, recipient_id));

create policy "certification_requests_select_party" on public.certification_requests
  for select using (auth.uid() in (owner_id, requested_by, counterparty_id));

revoke all on public.exchange_proposals from anon, authenticated;
grant select (
  id, listing_id, listing_title, listing_domain, listing_value, offered_title,
  offered_domain, offered_value, cash_adjustment, currency, message,
  message_redacted, state, certification_required, proposer_carrier,
  proposer_tracking, proposer_shipped_at, proposer_delivered_at,
  recipient_carrier, recipient_tracking, recipient_shipped_at,
  recipient_delivered_at, proposer_received, recipient_received, expires_at,
  accepted_at, completed_at, created_at, updated_at
) on public.exchange_proposals to authenticated;

revoke all on public.certification_requests from anon, authenticated;
grant select (
  id, listing_id, order_id, exchange_id, item_title, domain, reason, status,
  fee_payer, fee_amount, counterparty_agreed, report_ref, expert_note,
  created_at, decided_at
) on public.certification_requests to authenticated;

-- Commandes et litiges : l'identifiant de l'autre partie n'est plus lisible
-- (anonymat pair-à-pair) ; seules les colonnes d'action restent modifiables.
revoke all on public.orders from anon;
revoke select, insert, update on public.orders from authenticated;
grant select (
  id, listing_id, amount, currency, commission_rate, escrow_state, carrier,
  tracking_number, delivered_at, released_at, created_at
) on public.orders to authenticated;
grant insert (id, listing_id, buyer_id) on public.orders to authenticated;
grant update (escrow_state, carrier, tracking_number, delivered_at) on public.orders to authenticated;

-- Litiges : lecture des colonnes non identifiantes ; AUCUNE écriture directe
-- (un INSERT client forgeait un litige « déjà arbitré » ou un litige fantôme
-- bloquant l'auto-libération) — ouverture via open_order_dispute (5/5),
-- arbitrage via resolve_dispute (service_role).
revoke all on public.disputes from anon;
revoke select, insert, update, delete, truncate on public.disputes from authenticated;
grant select (id, order_id, reason, status, resolution_note, created_at, resolved_at)
  on public.disputes to authenticated;

-- Les policies de 0006 sur `disputes` lisaient orders.buyer_id/seller_id dans
-- une sous-requête (privilège de colonne désormais retiré) : appartenance
-- vérifiée par une fonction de confiance.
create or replace function public.is_order_party(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order and auth.uid() in (o.buyer_id, o.seller_id)
  )
$$;
revoke all on function public.is_order_party(uuid) from public, anon;
grant execute on function public.is_order_party(uuid) to authenticated, service_role;

drop policy "disputes_select_party" on public.disputes;
drop policy "disputes_insert_party" on public.disputes;
create policy "disputes_select_party" on public.disputes
  for select using (public.is_order_party(order_id));

-- Défense en profondeur : tout litige naît « ouvert », sans décision, sur une
-- commande effectivement passée en litige, par l'une de ses parties (seul
-- l'arbitrage — drapeau système — écrit statut, note et date de résolution).
create or replace function public.set_dispute_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_escrow_system_action() then
    return new;
  end if;
  if not exists (
    select 1 from public.orders o
    where o.id = new.order_id
      and o.escrow_state = 'disputed'
      and new.opened_by in (o.buyer_id, o.seller_id)
  ) then
    raise exception 'Litige possible uniquement par une partie d''une commande en litige'
      using errcode = 'P0001';
  end if;
  new.status := 'open';
  new.resolution_note := null;
  new.resolved_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger disputes_set_defaults
  before insert on public.disputes
  for each row execute function public.set_dispute_defaults();

-- ── 4. Fonctions de lecture privilégiée (internes) ───────────────────────────
-- Fenêtre des estimations VELUM retenues pour le seuil de certification.
create or replace function public.market_valuation_window()
returns interval language sql immutable as $$ select interval '18 months' $$;

-- Valeur de référence d'un objet : max(valeur déclarée, M), M = PLUS HAUTE
-- estimation VELUM récente (fenêtre ci-dessus). Les estimations sont écrites
-- par le serveur seul (valuate, price-cron — migration 20261023131000), mais
-- valuate estime un candidat fourni par le client : une estimation basse
-- postérieure (candidat trompeur) ne masque donc pas une estimation haute
-- récente. À DÉFAUT d'estimation dans la fenêtre, M = la dernière estimation
-- passée, quel que soit son âge (price-cron n'écrit rien sans observation :
-- une estimation ancienne n'est pas une raison de lever le seuil). Une date
-- future (invalide) est ignorée ; sans estimation, M = 0.
create or replace function public._market_reference_value(p_item uuid, p_value numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    coalesce(p_value, 0),
    coalesce(
      (
        select max(v.central) from public.valuations v
        where v.item_id = p_item
          and v.valued_at <= now()
          and v.valued_at > now() - public.market_valuation_window()
      ),
      (
        select v.central from public.valuations v
        where v.item_id = p_item
          and v.valued_at <= now()
        order by v.valued_at desc, v.central desc
        limit 1
      ),
      0)
  )
$$;

-- Rapport d'expert d'un objet déjà certifié pour ce propriétaire (réutilisé
-- par une nouvelle annonce du même objet : la certification suit l'objet).
-- Uniquement si (1) la DERNIÈRE décision d'expert sur l'objet est une
-- certification (un refus postérieur l'annule) et (2) l'objet est resté
-- celui qui a été certifié : même titre public, même catégorie — renommer un
-- objet certifié ne lui transmet jamais le badge « authentifié VELUM ».
-- « Dernière décision » : ordre DÉTERMINISTE, partagé avec
-- _market_item_rejected ; deux décisions ex aequo (même transaction) ⇒ le
-- refus l'emporte (jamais de badge par excès de confiance).
create or replace function public._market_item_certification_ref(p_item uuid, p_owner uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select d.report_ref
  from (
    select c.status, c.report_ref, c.item_title, c.domain
    from public.certification_requests c
    where p_item is not null
      and c.item_id = p_item
      and c.owner_id = p_owner
      and c.status in ('certified', 'rejected')
    order by c.decided_at desc nulls last, c.created_at desc, (c.status = 'rejected') desc, c.id
    limit 1
  ) d
  join public.items i on i.id = p_item
  where d.status = 'certified'
    and d.item_title is not distinct from public.redact_contact_info(i.title)
    and d.domain is not distinct from i.domain
$$;

-- Dernière décision d'expert sur l'objet = REFUS : l'objet ne se republie
-- (ni ne s'échange) plus sans nouvelle certification, quel que soit le prix.
-- Indépendant du titre : renommer un objet refusé ne lève pas le refus.
create or replace function public._market_item_rejected(p_item uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.status = 'rejected'
    from public.certification_requests c
    where p_item is not null
      and c.item_id = p_item
      and c.owner_id = p_owner
      and c.status in ('certified', 'rejected')
    order by c.decided_at desc nulls last, c.created_at desc, (c.status = 'rejected') desc, c.id
    limit 1
  ), false)
$$;

-- Objet déjà CÉDÉ par ce membre (vente conclue, ou échange conclu où il
-- l'a offert / où son annonce est partie) : il ne se remet plus en vente ni
-- ne s'offre à l'échange — il reste dans la collection du cédant (transfert
-- hors périmètre, spec §9), mais n'est plus à lui. Ne renseigne que le
-- membre lui-même (ou le code serveur).
create or replace function public._market_item_ceded(p_item uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_item is not null
    and (auth.uid() is null or auth.uid() = p_owner)
    and (
    exists (
      select 1 from public.listings l
      where l.item_id = p_item and l.seller_id = p_owner and l.status in ('sold', 'exchanged'))
    or exists (
      select 1 from public.exchange_proposals e
      where e.offered_item_id = p_item and e.proposer_id = p_owner and e.state = 'completed'))
$$;

revoke all on function public._market_reference_value(uuid, numeric) from public, anon, authenticated;
revoke all on function public._market_item_certification_ref(uuid, uuid) from public, anon, authenticated;
revoke all on function public._market_item_rejected(uuid, uuid) from public, anon, authenticated;
-- Appelée aussi par le trigger des annonces (identité du vendeur).
revoke all on function public._market_item_ceded(uuid, uuid) from public, anon;
grant execute on function public._market_item_ceded(uuid, uuid) to authenticated, service_role;

-- ── Suivi d'expédition : jamais un canal de coordonnées ─────────────────────
-- Transporteurs reconnus (le transporteur est facultatif : null = non
-- précisé). Liste reprise par MARKET_CARRIERS (@velum/api-client).
create or replace function public.market_carriers()
returns text[]
language sql
immutable
as $$
  select array[
    'Colissimo', 'Chronopost', 'La Poste', 'Lettre suivie', 'Mondial Relay',
    'Relais Colis', 'Colis Privé', 'DPD', 'GLS', 'UPS', 'DHL', 'FedEx', 'TNT'
  ]
$$;

-- Transporteur : nom canonique d'un transporteur reconnu (casse et accents
-- indifférents), null si vide ; tout autre texte est refusé (un texte libre
-- lisible par l'autre partie ferait fuiter nom, e-mail, téléphone…).
create or replace function public.market_normalize_carrier(p_carrier text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_input text := nullif(btrim(coalesce(p_carrier, '')), '');
  v_name text;
begin
  if v_input is null then
    return null;
  end if;
  select c into v_name
  from unnest(public.market_carriers()) as c
  where public.market_fold(c) = public.market_fold(v_input);
  if v_name is null then
    raise exception 'Transporteur non reconnu : choisissez parmi %',
      array_to_string(public.market_carriers(), ', ')
      using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;

-- Numéro de suivi : lettres et chiffres (tirets admis), 4 à 40 caractères,
-- majuscules ; les blancs saisis (copier-coller « 6A 123 456… ») sont
-- retirés. Ni @, ni point, ni ponctuation : plus d'e-mail, d'URL ni de phrase.
-- (Pas de masquage : redact_contact_info détruirait un numéro légitime.)
create or replace function public.market_normalize_tracking(p_tracking text)
returns text
language plpgsql
immutable
as $$
declare
  v text := upper(regexp_replace(coalesce(p_tracking, ''), '\s+', '', 'g'));
begin
  if v = '' then
    raise exception 'Numéro de suivi requis' using errcode = 'P0001';
  end if;
  if v !~ '^[A-Z0-9][A-Z0-9-]{3,39}$' then
    raise exception 'Numéro de suivi invalide : lettres, chiffres et tirets uniquement (4 à 40 caractères)'
      using errcode = 'P0001';
  end if;
  return v;
end;
$$;

revoke all on function public.market_normalize_carrier(text) from public, anon;
revoke all on function public.market_normalize_tracking(text) from public, anon;
grant execute on function public.market_carriers() to authenticated, service_role;
grant execute on function public.market_normalize_carrier(text) to authenticated, service_role;
grant execute on function public.market_normalize_tracking(text) to authenticated, service_role;

-- Rattrapage : suivis 0006 saisis en texte libre, lisibles par l'autre partie
-- (guard_order_terms ne contrôle un suivi que lorsqu'il CHANGE : l'expédition
-- reprendrait tel quel un texte ancien). Transporteur reconnu ⇒ nom canonique,
-- sinon null (facultatif). Numéro conforme ⇒ normalisé ; non conforme ⇒ null
-- tant que l'objet n'est pas expédié (le vendeur en fournira un conforme à
-- l'expédition), sinon masqué (trace de l'envoi conservée, sans coordonnées).
do $backfill_tracking$
declare
  v_prev text := public.market_system_begin();
begin
  update public.orders o
  set carrier = t.canonical
  from (
    select o2.id,
           (select c from unnest(public.market_carriers()) as c
            where public.market_fold(c) = public.market_fold(btrim(o2.carrier))
            limit 1) as canonical
    from public.orders o2
    where o2.carrier is not null
  ) t
  where t.id = o.id and o.carrier is distinct from t.canonical;

  update public.orders o
  set tracking_number = t.cleaned
  from (
    select o2.id,
           case
             when upper(regexp_replace(o2.tracking_number, '\s+', '', 'g')) ~ '^[A-Z0-9][A-Z0-9-]{3,39}$'
               then upper(regexp_replace(o2.tracking_number, '\s+', '', 'g'))
             when o2.escrow_state in ('pending_payment', 'funds_held') then null
             else public.redact_contact_info(o2.tracking_number)
           end as cleaned
    from public.orders o2
    where o2.tracking_number is not null
  ) t
  where t.id = o.id and o.tracking_number is distinct from t.cleaned;
  perform public.market_system_end(v_prev);
end
$backfill_tracking$;

-- Point d'entrée du trigger des annonces (exécuté avec l'identité du vendeur) :
-- certification exigée ? rapport déjà obtenu ? Réservé au vendeur lui-même
-- ou au code serveur (pas d'estimation d'autrui divulguée).
create or replace function public.listing_certification_snapshot(
  p_item uuid,
  p_seller uuid,
  p_ask numeric,
  out required boolean,
  out report_ref text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from p_seller then
    raise exception 'Évaluation de certification réservée au vendeur' using errcode = '42501';
  end if;
  -- Au-delà du seuil, ou objet refusé par un expert (refus mémorisé).
  required := public._market_reference_value(p_item, p_ask) > public.listing_appraisal_threshold_eur()
    or public._market_item_rejected(p_item, p_seller);
  report_ref := public._market_item_certification_ref(p_item, p_seller);
end;
$$;
revoke all on function public.listing_certification_snapshot(uuid, uuid, numeric) from public, anon;
grant execute on function public.listing_certification_snapshot(uuid, uuid, numeric)
  to authenticated, service_role;

-- Annonce RÉSERVÉE : paiement capturé (commande funds_held → litige) ou
-- échange accepté en cours — sur l'annonce elle-même, sur une AUTRE annonce
-- du même objet (défense en profondeur : une seule annonce ouverte par objet,
-- index listings_one_open_per_item_idx), ou sur l'objet de l'annonce proposé
-- ailleurs. Les commandes non payées ne réservent pas (pas de blocage par un
-- acheteur qui ne paie jamais).
create or replace function public.listing_is_engaged(
  p_listing uuid,
  p_except_order uuid default null,
  p_except_exchange uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.orders o
      where o.listing_id = p_listing
        and o.escrow_state in ('funds_held', 'shipped', 'disputed')
        and o.id is distinct from p_except_order)
    or exists (
      select 1 from public.exchange_proposals e
      where e.listing_id = p_listing
        and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed')
        and e.id is distinct from p_except_exchange)
    or exists (
      select 1
      from public.listings l
      join public.exchange_proposals e
        on e.offered_item_id = l.item_id and e.proposer_id = l.seller_id
      where l.id = p_listing
        and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed')
        and e.id is distinct from p_except_exchange)
    or exists (
      select 1
      from public.listings l
      join public.listings l2 on l2.item_id = l.item_id and l2.id <> l.id
      join public.orders o on o.listing_id = l2.id
      where l.id = p_listing
        and o.escrow_state in ('funds_held', 'shipped', 'disputed')
        and o.id is distinct from p_except_order)
    or exists (
      select 1
      from public.listings l
      join public.listings l2 on l2.item_id = l.item_id and l2.id <> l.id
      join public.exchange_proposals e on e.listing_id = l2.id
      where l.id = p_listing
        and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed')
        and e.id is distinct from p_except_exchange)
$$;
revoke all on function public.listing_is_engaged(uuid, uuid, uuid) from public, anon;
grant execute on function public.listing_is_engaged(uuid, uuid, uuid) to authenticated, service_role;

-- Objet engagé dans une transaction en cours (vente payée ou échange accepté).
-- Ne renseigne que le propriétaire de l'objet (ou le code serveur).
create or replace function public.item_is_engaged(p_item uuid, p_except_exchange uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.items i
      where i.id = p_item and (auth.uid() is null or i.owner_id = auth.uid()))
    and (
      exists (
        select 1 from public.listings l
        where l.item_id = p_item and public.listing_is_engaged(l.id, null, p_except_exchange))
      or exists (
        select 1 from public.exchange_proposals e
        where e.offered_item_id = p_item
          and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed')
          and e.id is distinct from p_except_exchange))
$$;
revoke all on function public.item_is_engaged(uuid, uuid) from public, anon;
grant execute on function public.item_is_engaged(uuid, uuid) to authenticated, service_role;

-- Certification OUVERTE (accord attendu, demandée, en cours d'expertise) sur
-- une commande ou un échange : l'expédition est bloquée.
create or replace function public.has_open_certification(p_order uuid, p_exchange uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.certification_requests c
    where c.status in ('awaiting_agreement', 'requested', 'in_review')
      and ((p_order is not null and c.order_id = p_order)
        or (p_exchange is not null and c.exchange_id = p_exchange))
  )
$$;
revoke all on function public.has_open_certification(uuid, uuid) from public, anon;
grant execute on function public.has_open_certification(uuid, uuid) to authenticated, service_role;

-- Verrou de réservation : sérialise les réservations concurrentes d'une même
-- annonce ou d'un même objet (deux captures de paiement, une capture et une
-- acceptation d'échange…). Annonce d'abord, puis objets dans l'ordre des
-- identifiants (pas d'interblocage entre réservations croisées).
create or replace function public.market_lock_for_reservation(
  p_listing uuid,
  p_extra_item uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
begin
  select l.item_id into v_item from public.listings l where l.id = p_listing for update;
  perform 1 from public.items i
  where i.id in (v_item, p_extra_item)
  order by i.id
  for update;
end;
$$;
revoke all on function public.market_lock_for_reservation(uuid, uuid) from public, anon;
grant execute on function public.market_lock_for_reservation(uuid, uuid) to authenticated, service_role;

-- Annonce ayant un historique (suppression interdite) : transactions, ou
-- expertise engagée ou décidée (une suppression effacerait en cascade la
-- certification payée, qui ne « suivrait » plus l'objet).
create or replace function public.listing_has_history(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.orders o where o.listing_id = p_listing)
      or exists (select 1 from public.exchange_proposals e where e.listing_id = p_listing)
      or exists (
        select 1 from public.certification_requests c
        where c.listing_id = p_listing and c.status in ('in_review', 'certified', 'rejected'))
$$;
revoke all on function public.listing_has_history(uuid) from public, anon;
grant execute on function public.listing_has_history(uuid) to authenticated, service_role;

-- Objets d'un échange dont la valeur de référence dépasse le seuil (ou déjà
-- refusés par un expert) et qui ne sont pas certifiés : 'listing' (objet du
-- destinataire) et/ou 'offered' (objet du proposeur).
create or replace function public._exchange_threshold_targets(p_exchange uuid)
returns table (
  side text,
  item_id uuid,
  item_title text,
  domain public.velum_domain,
  owner_id uuid,
  counterparty_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select 'listing', l.item_id, e.listing_title, e.listing_domain, e.recipient_id, e.proposer_id
  from public.exchange_proposals e
  join public.listings l on l.id = e.listing_id
  where e.id = p_exchange
    and l.expert_appraisal_ref is null
    and public._market_item_certification_ref(l.item_id, e.recipient_id) is null
    and (public._market_reference_value(l.item_id, e.listing_value) > public.listing_appraisal_threshold_eur()
      or public._market_item_rejected(l.item_id, e.recipient_id))
  union all
  select 'offered', e.offered_item_id, e.offered_title, e.offered_domain, e.proposer_id, e.recipient_id
  from public.exchange_proposals e
  where e.id = p_exchange
    and e.offered_item_id is not null
    and public._market_item_certification_ref(e.offered_item_id, e.proposer_id) is null
    and (public._market_reference_value(e.offered_item_id, e.offered_value) > public.listing_appraisal_threshold_eur()
      or public._market_item_rejected(e.offered_item_id, e.proposer_id))
$$;
revoke all on function public._exchange_threshold_targets(uuid) from public, anon, authenticated;

-- Point d'entrée du trigger des échanges (identité de la partie qui agit).
create or replace function public.exchange_acceptance_check(
  p_exchange uuid,
  out available boolean,
  out certification_required boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ex public.exchange_proposals%rowtype;
  v_listing public.listings%rowtype;
begin
  select * into v_ex from public.exchange_proposals where id = p_exchange;
  if not found then
    raise exception 'Proposition d''échange introuvable' using errcode = 'P0001';
  end if;
  if auth.uid() is not null and auth.uid() not in (v_ex.proposer_id, v_ex.recipient_id) then
    raise exception 'Réservé aux parties de l''échange' using errcode = '42501';
  end if;
  select * into v_listing from public.listings where id = v_ex.listing_id;
  available := found
    and v_listing.status = 'active'
    and v_listing.kind in ('exchange', 'sale_or_exchange')
    and not public.listing_is_engaged(v_listing.id, null, p_exchange)
    and v_ex.offered_item_id is not null
    and not exists (
      select 1 from public.listings l
      where l.item_id = v_ex.offered_item_id
        and public.listing_is_engaged(l.id, null, p_exchange))
    and not exists (
      select 1 from public.exchange_proposals e
      where e.offered_item_id = v_ex.offered_item_id
        and e.id <> p_exchange
        and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed'));
  certification_required := exists (select 1 from public._exchange_threshold_targets(p_exchange));
end;
$$;
revoke all on function public.exchange_acceptance_check(uuid) from public, anon;
grant execute on function public.exchange_acceptance_check(uuid) to authenticated, service_role;

-- ── 5. Annonces : publication décidée par le serveur ────────────────────────
-- Remplace le refus brutal de 0003 (exception à l'activation) par un flux :
-- au-delà du seuil, l'annonce est retenue en 'pending_certification' et une
-- demande de certification est ouverte automatiquement.
drop trigger listings_expert_appraisal on public.listings;
drop function public.enforce_expert_appraisal();

-- Historique préservé : supprimer un objet DÉTACHE ses annonces (item_id
-- null, annonce retirée si elle était encore ouverte) au lieu d'effacer en
-- cascade les commandes, échanges et certifications de l'autre partie.
alter table public.listings alter column item_id drop not null;
alter table public.listings drop constraint listings_item_id_fkey;
alter table public.listings add constraint listings_item_id_fkey
  foreign key (item_id) references public.items (id) on delete set null;

-- Prix plancher (EUR) d'une annonce : pas de vente fictive à 0 € (qui ferait
-- baisser le taux de commission dégressif).
create or replace function public.market_min_ask_price_eur()
returns numeric language sql immutable as $$ select 1::numeric $$;

-- Rattrapage avant les garde-fous ci-dessous (annonces 0006), dans cet ordre :
--  1. les annonces ouvertes dans une autre devise que l'euro, ou sous le prix
--     plancher, sont retirées (sauf transaction en cours, qui se poursuit) ;
--  2. une seule annonce OUVERTE par objet parmi les restantes — on garde, par
--     objet, la plus engagée : paiement capturé, puis commande en attente de
--     paiement, puis publiée, puis en attente de certification, puis la plus
--     récente ; les autres sont retirées ;
--  3. les commandes non payées d'une annonce qui n'est plus publiée sont
--     annulées (jamais capturables : enforce_escrow_transition).
-- Chaque vendeur (annonce retirée) et chaque acheteur (commande annulée) est
-- prévenu.
do $backfill$
declare
  v_prev text := public.market_system_begin();
  r record;
begin
  for r in
    update public.listings l set status = 'withdrawn'
    where l.status in ('draft', 'pending_certification', 'active')
      and (l.currency is distinct from 'EUR'
        or coalesce(l.ask_price, 0) < public.market_min_ask_price_eur())
      and not public.listing_is_engaged(l.id)
    returning l.seller_id, l.title, l.currency is distinct from 'EUR' as foreign_currency
  loop
    perform public.market_notify(r.seller_id, 'Annonce retirée',
      case when r.foreign_currency then
        format('Seul l’euro est désormais accepté : « %s » a été retirée ; republiez-la en euros.',
          coalesce(r.title, 'votre objet'))
      else
        format('Prix minimum de %s € : « %s » a été retirée ; republiez-la à un prix d’au moins %s €.',
          public.market_min_ask_price_eur(), coalesce(r.title, 'votre objet'),
          public.market_min_ask_price_eur())
      end);
  end loop;

  for r in
    with ranked as (
      select l.id,
             row_number() over (
               partition by l.item_id
               order by exists (
                          select 1 from public.orders o
                          where o.listing_id = l.id
                            and o.escrow_state in ('funds_held', 'shipped', 'disputed')) desc,
                        exists (
                          select 1 from public.orders o
                          where o.listing_id = l.id and o.escrow_state = 'pending_payment') desc,
                        (l.status = 'active') desc,
                        (l.status = 'pending_certification') desc,
                        l.created_at desc,
                        l.id) as rank
      from public.listings l
      where l.item_id is not null and l.status in ('draft', 'pending_certification', 'active')
    )
    update public.listings l set status = 'withdrawn'
    from ranked rk
    where rk.id = l.id and rk.rank > 1
    returning l.seller_id, l.title
  loop
    perform public.market_notify(r.seller_id, 'Annonce retirée',
      format('Une seule annonce ouverte par objet est désormais admise : « %s » a été retirée au profit de votre autre annonce de cet objet.',
        coalesce(r.title, 'votre objet')));
  end loop;

  for r in
    update public.orders o set escrow_state = 'cancelled'
    from public.listings l
    where l.id = o.listing_id and l.status <> 'active' and o.escrow_state = 'pending_payment'
    returning o.buyer_id, l.title
  loop
    perform public.market_notify(r.buyer_id, 'Commande annulée',
      format('L’annonce « %s » n’est plus publiée : votre commande en attente de paiement est annulée.',
        coalesce(r.title, 'objet')));
  end loop;
  perform public.market_system_end(v_prev);
end
$backfill$;

-- Une seule annonce ouverte par objet : un objet unique ne se paie pas deux
-- fois (deux séquestres) ni ne se paie et s'échange en même temps. Garantie
-- de dernier recours contre deux créations concurrentes (le trigger
-- enforce_listing_rules refuse d'abord avec un message explicite).
create unique index listings_one_open_per_item_idx on public.listings (item_id)
  where item_id is not null and status in ('draft', 'pending_certification', 'active');

-- Euro uniquement : le seuil de certification, la commission et le registre
-- sont exprimés en EUR ; une devise libre contournait le seuil (« 450 BTC »)
-- et servait de texte libre non masqué au catalogue. Garanti par trigger sur
-- toute création, publication ou changement de devise d'une annonce
-- (enforce_listing_rules) et à la création d'une commande (set_order_defaults),
-- qui copie la devise de l'annonce ; contrainte CHECK sur exchange_proposals
-- (table nouvelle). Pas de CHECK sur les tables historiques : une ligne 0006
-- dans une autre devise, engagée dans une transaction, bloquerait sinon
-- chaque mise à jour — dont l'auto-libération groupée (release_due_orders).
-- Une annonce 0006 épargnée par le rattrapage parce qu'engagée (autre devise,
-- prix sous le plancher) n'est jamais exposée aux autres membres
-- (market_catalogue, market_listing), et toute nouvelle transaction la
-- refuse (set_order_defaults, set_exchange_defaults).

-- Une autre annonce OUVERTE existe-t-elle pour cet objet ? (lecture hors RLS ;
-- ne renseigne que le propriétaire de l'objet, ou le code serveur).
create or replace function public._market_item_has_open_listing(p_item uuid, p_except uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_item is not null
    and exists (
      select 1 from public.items i
      where i.id = p_item and (auth.uid() is null or i.owner_id = auth.uid()))
    and exists (
      select 1 from public.listings l
      where l.item_id = p_item
        and l.id is distinct from p_except
        and l.status in ('draft', 'active', 'pending_certification'))
$$;
revoke all on function public._market_item_has_open_listing(uuid, uuid) from public, anon;
grant execute on function public._market_item_has_open_listing(uuid, uuid) to authenticated, service_role;

create or replace function public.enforce_listing_rules()
returns trigger
language plpgsql
as $$
declare
  v_trusted boolean := public.market_trusted_actor();
  v_required boolean;
  v_report_ref text;
  v_title text;
  v_domain public.velum_domain;
  -- Création, ou retour d'un statut clos (retirée) vers un statut ouvert.
  v_opening boolean := new.status in ('draft', 'active', 'pending_certification')
    and (tg_op = 'INSERT' or old.status not in ('draft', 'active', 'pending_certification'));
  -- Ouverture, ou passage d'un brouillon à la publication.
  v_publishing boolean;
begin
  if tg_op = 'INSERT' then
    if not v_trusted then
      -- Refus explicite (VL402 → PLAN_REQUIRED côté client) avant la policy
      -- RLS d'insertion, qui reste la garantie de dernier ressort.
      if not public.can_list_on_marketplace(new.seller_id) then
        raise exception 'Les plateformes d''échange et de vente sont réservées à l''offre Platine'
          using errcode = 'VL402';
      end if;
      if new.status not in ('draft', 'active', 'pending_certification') then
        raise exception 'Statut initial d''annonce interdit : %', new.status using errcode = 'P0001';
      end if;
      -- Date de publication posée par le serveur (tri « récent » du catalogue :
      -- une date future épinglerait l'annonce en tête).
      new.created_at := now();
    end if;
  else
    if not v_trusted then
      if old.status in ('sold', 'exchanged') then
        raise exception 'Annonce close : elle ne peut plus être modifiée' using errcode = 'P0001';
      end if;
      if new.item_id is distinct from old.item_id or new.seller_id is distinct from old.seller_id then
        raise exception 'L''objet et le vendeur d''une annonce ne se modifient pas'
          using errcode = 'P0001';
      end if;
      -- Colonnes calculées par le serveur : toute valeur client est ignorée
      -- (le badge « authentifié VELUM » ne se déclare pas, il vient d'un
      -- expert ; titre et catégorie sont recopiés de l'objet à la
      -- (re)publication, plus bas).
      new.commission_rate := old.commission_rate;
      new.title := old.title;
      new.domain := old.domain;
      new.expert_appraisal_ref := old.expert_appraisal_ref;
      new.expert_appraisal_required := old.expert_appraisal_required;
      new.created_at := old.created_at;
      if new.status is distinct from old.status and new.status in ('sold', 'exchanged') then
        raise exception 'Seule la plateforme conclut une vente ou un échange' using errcode = 'P0001';
      end if;
      -- (Re)publication réservée à l'offre Platine (abonnement expiré : refus).
      if new.status is distinct from old.status
         and new.status in ('active', 'pending_certification')
         and not public.can_list_on_marketplace(new.seller_id) then
        raise exception 'Les plateformes d''échange et de vente sont réservées à l''offre Platine'
          using errcode = 'VL402';
      end if;
      if (new.status is distinct from old.status
          or new.ask_price is distinct from old.ask_price
          or new.kind is distinct from old.kind
          or new.currency is distinct from old.currency)
         and public.listing_is_engaged(old.id) then
        raise exception 'Annonce engagée dans une transaction en cours : statut, prix et nature sont figés'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Objet supprimé : l'action référentielle retire l'annonce encore ouverte ;
  -- une annonce sans objet ne se (re)publie jamais.
  if new.item_id is null and new.status in ('draft', 'active', 'pending_certification') then
    if tg_op = 'UPDATE' and old.item_id is not null then
      new.status := 'withdrawn';
    else
      raise exception 'Annonce sans objet (objet supprimé) : publication impossible'
        using errcode = 'P0001';
    end if;
  end if;

  if new.kind in ('exchange', 'sale_or_exchange') and coalesce(new.ask_price, 0) <= 0 then
    raise exception 'Une annonce ouverte à l''échange exige une valeur déclarée positive'
      using errcode = 'P0001';
  end if;

  -- Prix plancher et euro, pour toute nature d'annonce : à la création, à
  -- chaque changement de prix ou de devise, et à toute (re)publication (une
  -- annonce historique ne se publie pas à 0 € ni dans une autre devise).
  v_publishing := v_opening
    or (new.status in ('active', 'pending_certification') and new.status is distinct from old.status);
  if (v_publishing or new.ask_price is distinct from old.ask_price)
     and coalesce(new.ask_price, 0) < public.market_min_ask_price_eur() then
    raise exception 'Prix ou valeur déclarée minimum : % €', public.market_min_ask_price_eur()
      using errcode = 'P0001';
  end if;
  if (v_publishing or new.currency is distinct from old.currency)
     and new.currency is distinct from 'EUR' then
    raise exception 'Seul l''euro (EUR) est accepté sur les plateformes d''échange et de vente'
      using errcode = 'P0001';
  end if;

  if not v_trusted and v_opening then
    -- Objet déjà vendu ou échangé par ce membre : il n'est plus à lui.
    if public._market_item_ceded(new.item_id, new.seller_id) then
      raise exception 'Objet déjà cédé (vente ou échange conclu) : il ne peut plus être mis en vente'
        using errcode = 'P0001';
    end if;
    -- Une seule annonce ouverte par objet (index unique en dernier recours).
    if public._market_item_has_open_listing(new.item_id, new.id) then
      raise exception 'Cet objet a déjà une annonce ouverte : retirez-la d''abord'
        using errcode = 'P0001';
    end if;
  end if;

  -- (Re)publication ou réouverture par le client : le contenu public de
  -- l'objet (titre expurgé, catégorie) est d'abord RECOPIÉ dans l'annonce,
  -- comme à la création (set_listing_display). L'annonce montre l'objet tel
  -- qu'il sera expertisé, et la demande « seuil » (listing_after_change)
  -- enregistre ce titre — celui que _market_item_certification_ref compare
  -- au titre actuel de l'objet. Lecture sous RLS (le vendeur possède l'objet) :
  -- objet illisible ⇒ affichage inchangé (jamais de titre effacé).
  if tg_op = 'UPDATE' and not v_trusted and v_publishing and new.item_id is not null then
    select public.redact_contact_info(i.title), i.domain into v_title, v_domain
    from public.items i where i.id = new.item_id;
    if found then
      new.title := v_title;
      new.domain := v_domain;
    end if;
  end if;

  -- Certification : à la création, à chaque (re)publication, et à la
  -- réouverture d'une annonce retirée (brouillon compris).
  if tg_op = 'INSERT' or new.status in ('active', 'pending_certification') or v_opening then
    select s.required, s.report_ref into v_required, v_report_ref
    from public.listing_certification_snapshot(new.item_id, new.seller_id, new.ask_price) s;
    new.expert_appraisal_required := v_required;
    if tg_op = 'INSERT' and (not v_trusted or new.expert_appraisal_ref is null) then
      -- Certification déjà obtenue pour cet objet : elle le suit.
      new.expert_appraisal_ref := v_report_ref;
    elsif tg_op = 'UPDATE' and not v_trusted and v_publishing then
      -- (Re)publication ou réouverture par le client (retirée → brouillon ou
      -- publiée, brouillon → publiée…) : la référence est RECALCULÉE, jamais
      -- reprise telle quelle — elle ne vaut que si la DERNIÈRE décision
      -- d'expert sur l'objet est une certification et que l'objet n'a changé
      -- ni de titre ni de catégorie depuis.
      new.expert_appraisal_ref := v_report_ref;
    end if;
    if new.status in ('active', 'pending_certification') then
      new.status := case
        when v_required and new.expert_appraisal_ref is null then 'pending_certification'
        else 'active'
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_enforce_rules
  before insert or update on public.listings
  for each row execute function public.enforce_listing_rules();

-- Effets de bord (SECURITY DEFINER : l'autre partie n'a aucun droit RLS sur
-- les commandes / propositions / certifications concernées).
create or replace function public.listing_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  -- Entrée en 'pending_certification' : demande « seuil » ouverte d'office,
  -- à la charge du vendeur (defaultCertificationFeePayer('threshold')).
  if new.status = 'pending_certification'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending_certification')
     and not exists (
       select 1 from public.certification_requests c
       where c.listing_id = new.id and c.order_id is null and c.exchange_id is null
         and c.status in ('awaiting_agreement', 'requested', 'in_review')) then
    insert into public.certification_requests (
      listing_id, item_id, item_title, domain, owner_id, requested_by,
      reason, status, fee_payer, counterparty_agreed)
    values (
      new.id, new.item_id, new.title, new.domain, new.seller_id, new.seller_id,
      'threshold', 'requested', 'seller', true);
  end if;

  if tg_op = 'UPDATE'
     and (new.status, new.ask_price, new.kind, new.currency)
         is distinct from (old.status, old.ask_price, old.kind, old.currency) then
    v_prev := public.market_system_begin();
    -- Commandes NON PAYÉES : elles portaient sur l'annonce publiée, à ce prix,
    -- ouverte à la vente. Annonce suspendue (certification exigée), dépubliée,
    -- close, ou termes modifiés (prix, devise, échange seul) ⇒ annulées : le
    -- paiement ne se capture jamais sur une annonce qui a changé (la capture
    -- le revérifie aussi, enforce_escrow_transition).
    if (old.status = 'active' and new.status is distinct from 'active')
       or new.status in ('withdrawn', 'sold', 'exchanged')
       or new.ask_price is distinct from old.ask_price
       or new.currency is distinct from old.currency
       or (new.kind = 'exchange' and old.kind is distinct from 'exchange') then
      update public.orders set escrow_state = 'cancelled'
        where listing_id = new.id and escrow_state = 'pending_payment';
    end if;
    if new.status is not distinct from old.status then
      null;
    elsif new.status in ('withdrawn', 'sold', 'exchanged') then
      -- Annonce close ou retirée : propositions en attente déclinées,
      -- certifications de l'annonce sans objet.
      update public.exchange_proposals set state = 'declined'
        where listing_id = new.id and state = 'proposed';
      update public.certification_requests set status = 'cancelled'
        where listing_id = new.id and order_id is null and exchange_id is null
          and status in ('awaiting_agreement', 'requested', 'in_review');
    elsif old.status = 'pending_certification' and new.expert_appraisal_ref is null then
      -- Sortie sans certification (prix et estimation repassés sous le seuil,
      -- ou dépublication) : la demande « seuil » devient sans objet.
      update public.certification_requests set status = 'cancelled'
        where listing_id = new.id and order_id is null and exchange_id is null
          and reason = 'threshold'
          and status in ('awaiting_agreement', 'requested', 'in_review');
    end if;
    perform public.market_system_end(v_prev);
  end if;
  return null;
end;
$$;

create trigger listings_after_change
  after insert or update on public.listings
  for each row execute function public.listing_after_change();

-- Suppression : interdite côté client dès qu'une transaction a existé (une
-- cascade effacerait l'historique de l'autre partie) — retirer l'annonce.
create or replace function public.guard_listing_delete()
returns trigger
language plpgsql
as $$
begin
  if not public.market_trusted_actor() and public.listing_has_history(old.id) then
    raise exception 'Annonce liée à des transactions : retirez-la plutôt que de la supprimer'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger listings_guard_delete
  before delete on public.listings
  for each row execute function public.guard_listing_delete();

-- Nouvelle estimation au-delà du seuil : une annonce publiée non certifiée
-- repasse en 'pending_certification' (le seuil porte sur max(prix, estimation)).
-- Les annonces engagées dans une transaction en cours ne sont pas touchées.
create or replace function public.recheck_listing_certification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.central <= public.listing_appraisal_threshold_eur() then
    return null;
  end if;
  for r in
    -- Ré-évaluation par le trigger des annonces (statut demandé : 'active').
    update public.listings l set status = 'active'
    where l.item_id = new.item_id
      and l.status = 'active'
      and l.expert_appraisal_ref is null
      and not public.listing_is_engaged(l.id)
    returning l.seller_id, l.title, l.status
  loop
    if r.status = 'pending_certification' then
      perform public.market_notify(
        r.seller_id,
        'Certification d’expert requise',
        format(
          'L’estimation de « %s » dépasse %s € : l’annonce est suspendue jusqu’à sa certification par un expert (frais à la charge du vendeur).',
          coalesce(r.title, 'votre objet'),
          public.listing_appraisal_threshold_eur()));
    end if;
  end loop;
  return null;
end;
$$;

create trigger valuations_recheck_listing_certification
  after insert on public.valuations
  for each row execute function public.recheck_listing_certification();

-- ── 6. Commandes : réservation, termes figés, expédition sous certification ──
create unique index orders_one_pending_per_buyer_idx
  on public.orders (listing_id, buyer_id) where escrow_state = 'pending_payment';

-- SECURITY DEFINER : l'acheteur ne peut plus lire l'annonce d'autrui en direct.
create or replace function public.set_order_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  if v_listing.kind = 'exchange' then
    raise exception 'Cette annonce est proposée uniquement à l''échange' using errcode = 'P0001';
  end if;
  if v_listing.currency is distinct from 'EUR' then
    raise exception 'Seul l''euro (EUR) est accepté sur les plateformes d''échange et de vente'
      using errcode = 'P0001';
  end if;
  -- Annonce 0006 sous le prix plancher (épargnée car engagée, puis libérée).
  if coalesce(v_listing.ask_price, 0) < public.market_min_ask_price_eur() then
    raise exception 'Annonce non disponible (prix inférieur au minimum de % €)',
      public.market_min_ask_price_eur() using errcode = 'P0001';
  end if;
  -- Défense en profondeur : objet dont la dernière décision d'expert est un
  -- refus (le refus dépublie déjà ses annonces ; jamais de vente sans
  -- nouvelle certification).
  if public._market_item_rejected(v_listing.item_id, v_listing.seller_id) then
    raise exception 'Objet refusé par un expert : il ne peut pas être vendu sans nouvelle certification'
      using errcode = 'P0001';
  end if;
  if not public.can_list_on_marketplace(new.buyer_id) then
    raise exception 'La communauté est réservée à l''offre Platine' using errcode = 'VL402';
  end if;
  if new.buyer_id = v_listing.seller_id then
    raise exception 'On ne peut pas acheter sa propre annonce' using errcode = 'P0001';
  end if;
  -- Abonnement du vendeur expiré : son annonce n'est plus proposée.
  if not public.can_list_on_marketplace(v_listing.seller_id) then
    raise exception 'Annonce non disponible (vendeur hors offre Platine)' using errcode = 'P0001';
  end if;
  if public.listing_is_engaged(v_listing.id) then
    raise exception 'Annonce déjà réservée par un autre membre' using errcode = 'P0001';
  end if;
  -- Vendeur, montant et commission proviennent de l'annonce (non du client).
  new.seller_id := v_listing.seller_id;
  new.amount := v_listing.ask_price;
  new.currency := v_listing.currency;
  new.commission_rate := v_listing.commission_rate;
  new.escrow_state := 'pending_payment';
  new.carrier := null;
  new.tracking_number := null;
  new.delivered_at := null;
  new.released_at := null;
  return new;
end;
$$;

-- Termes actuels d'une annonce, pour la revérification de la capture
-- (parties de la commande, ou code serveur) ; item_rejected : la dernière
-- décision d'expert sur l'objet est un refus.
create or replace function public.market_listing_terms(p_listing uuid)
returns table (status text, kind text, ask_price numeric, currency text, item_rejected boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.status, l.kind, l.ask_price, l.currency,
         public._market_item_rejected(l.item_id, l.seller_id)
  from public.listings l
  where l.id = p_listing
    and (auth.uid() is null
      or auth.uid() = l.seller_id
      or exists (
        select 1 from public.orders o
        where o.listing_id = l.id and o.buyer_id = auth.uid()))
$$;
revoke all on function public.market_listing_terms(uuid) from public, anon;
grant execute on function public.market_listing_terms(uuid) to authenticated, service_role;

-- Machine à états de 0006, complétée : expédition bloquée tant qu'une
-- certification est ouverte ; capture refusée si l'annonce a été réservée
-- entre-temps (premier payé, premier servi) ou si elle n'est plus celle qui a
-- été commandée (suspendue pour certification, dépubliée, prix, devise ou
-- nature modifiés).
create or replace function public.enforce_escrow_transition()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer boolean := v_uid is not null and v_uid = old.buyer_id;
  v_seller boolean := v_uid is not null and v_uid = old.seller_id;
  v_sys boolean := public.is_escrow_system_action();
  v_from text := old.escrow_state;
  v_to text := new.escrow_state;
  v_ok boolean := false;
  v_listing record;
begin
  if v_from = v_to then
    return new; -- pas de changement d'état : colonnes gardées par guard_order_terms
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
  elsif v_from = 'disputed' and v_to in ('released', 'refunded') then
    v_ok := v_sys;
  end if;

  if not v_ok then
    raise exception 'Transition de séquestre interdite (% → % par cet acteur)', v_from, v_to
      using errcode = 'P0001';
  end if;
  if v_to = 'shipped' and public.has_open_certification(old.id, null) then
    raise exception 'Expédition bloquée : une certification d''expert est en cours sur cette commande'
      using errcode = 'P0001';
  end if;
  if v_from = 'pending_payment' and v_to = 'funds_held' then
    -- Verrou puis contrôle (instantané frais) : premier payé, premier servi.
    perform public.market_lock_for_reservation(old.listing_id);
    if public.listing_is_engaged(old.listing_id, old.id) then
      raise exception 'Annonce déjà réservée par un autre membre' using errcode = 'P0001';
    end if;
    -- L'annonce est toujours celle qui a été commandée (lecture de confiance :
    -- l'acheteur n'a aucun droit de lecture sur l'annonce d'autrui).
    select l.status, l.kind, l.ask_price, l.currency, l.item_rejected into v_listing
    from public.market_listing_terms(old.listing_id) l;
    if v_listing.status is distinct from 'active'
       or v_listing.kind is not distinct from 'exchange'
       or v_listing.ask_price is distinct from old.amount
       or v_listing.currency is distinct from old.currency then
      raise exception 'Annonce modifiée ou suspendue depuis la commande : paiement impossible'
        using errcode = 'P0001';
    end if;
    -- Défense en profondeur : objet refusé par un expert, non recertifié.
    if v_listing.item_rejected then
      raise exception 'Objet refusé par un expert : paiement impossible sans nouvelle certification'
        using errcode = 'P0001';
    end if;
  end if;
  if v_to = 'released' and new.released_at is null then
    new.released_at := now();
  end if;
  return new;
end;
$$;

-- Termes figés : prix, commission, parties ; livraison attestée par l'acheteur
-- ou le transporteur (record_order_delivery) — jamais par le vendeur, qui
-- pourrait sinon déclencher l'auto-libération des fonds. Suivi (transporteur,
-- numéro) : lisible par l'autre partie, donc écrit par le SEUL vendeur, à
-- l'expédition (funds_held → shipped), au format contrôlé — jamais un canal
-- de coordonnées, jamais réécrit ensuite (preuve d'expédition).
create or replace function public.guard_order_terms()
returns trigger
language plpgsql
as $$
begin
  if public.market_trusted_actor() then
    return new;
  end if;
  if (new.carrier, new.tracking_number) is distinct from (old.carrier, old.tracking_number) then
    if auth.uid() is distinct from old.seller_id
       or old.escrow_state <> 'funds_held'
       or new.escrow_state <> 'shipped' then
      raise exception 'Le suivi est renseigné par le vendeur, à l''expédition' using errcode = 'P0001';
    end if;
    new.carrier := public.market_normalize_carrier(new.carrier);
    new.tracking_number := public.market_normalize_tracking(new.tracking_number);
  end if;
  if (new.listing_id, new.buyer_id, new.seller_id, new.amount, new.currency,
      new.commission_rate, new.created_at)
     is distinct from
     (old.listing_id, old.buyer_id, old.seller_id, old.amount, old.currency,
      old.commission_rate, old.created_at) then
    raise exception 'Les termes d''une commande sont figés (prix, commission, parties)'
      using errcode = 'P0001';
  end if;
  if new.delivered_at is distinct from old.delivered_at
     and auth.uid() is distinct from old.buyer_id then
    raise exception 'Seul l''acheteur (ou le transporteur) atteste la livraison'
      using errcode = 'P0001';
  end if;
  if new.released_at is distinct from old.released_at
     and new.escrow_state is not distinct from old.escrow_state then
    raise exception 'La date de libération est posée par la plateforme' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orders_guard_terms
  before update on public.orders
  for each row execute function public.guard_order_terms();

create or replace function public.order_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  if new.escrow_state is not distinct from old.escrow_state then
    return null;
  end if;
  v_prev := public.market_system_begin();
  if new.escrow_state = 'funds_held' then
    -- Paiement capturé : l'annonce est réservée, les autres commandes non
    -- payées tombent (STRIPE : annulation des autorisations) et le vendeur ne
    -- peut plus offrir ce même objet dans un échange.
    update public.orders set escrow_state = 'cancelled'
      where listing_id = new.listing_id and id <> new.id and escrow_state = 'pending_payment';
    update public.exchange_proposals e set state = 'withdrawn'
      from public.listings l
      where l.id = new.listing_id
        and e.offered_item_id = l.item_id and e.proposer_id = l.seller_id
        and e.state = 'proposed';
  elsif new.escrow_state in ('cancelled', 'refunded') then
    update public.certification_requests set status = 'cancelled'
      where order_id = new.id and status in ('awaiting_agreement', 'requested', 'in_review');
  end if;
  perform public.market_system_end(v_prev);
  return null;
end;
$$;

create trigger orders_after_change
  after update on public.orders
  for each row execute function public.order_after_change();

-- ── 7. Échanges : création, machine à états, effets ──────────────────────────
create or replace function public.set_exchange_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_item public.items%rowtype;
  v_message text;
begin
  if auth.uid() is not null and new.proposer_id is distinct from auth.uid() then
    raise exception 'On ne propose un échange qu''en son nom' using errcode = '42501';
  end if;
  select * into v_listing from public.listings where id = new.listing_id;
  if not found then
    raise exception 'Annonce introuvable' using errcode = 'P0001';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'Annonce non disponible (statut %)', v_listing.status using errcode = 'P0001';
  end if;
  if v_listing.kind not in ('exchange', 'sale_or_exchange') then
    raise exception 'Cette annonce n''est pas ouverte à l''échange' using errcode = 'P0001';
  end if;
  -- Annonce 0006 dans une autre devise : refus explicite (la contrainte CHECK
  -- exchange_proposals_currency_eur ne donnerait qu'une violation brute).
  if v_listing.currency is distinct from 'EUR' then
    raise exception 'Seul l''euro (EUR) est accepté sur les plateformes d''échange et de vente'
      using errcode = 'P0001';
  end if;
  if new.proposer_id = v_listing.seller_id then
    raise exception 'On ne peut pas proposer un échange sur sa propre annonce' using errcode = 'P0001';
  end if;
  if not public.can_list_on_marketplace(new.proposer_id) then
    raise exception 'La communauté est réservée à l''offre Platine' using errcode = 'VL402';
  end if;
  if not public.can_list_on_marketplace(v_listing.seller_id) then
    raise exception 'Annonce non disponible (vendeur hors offre Platine)' using errcode = 'P0001';
  end if;
  if public.listing_is_engaged(v_listing.id) then
    raise exception 'Annonce déjà réservée par un autre membre' using errcode = 'P0001';
  end if;

  select * into v_item from public.items where id = new.offered_item_id;
  if not found or v_item.owner_id <> new.proposer_id then
    raise exception 'L''objet proposé doit appartenir à votre collection' using errcode = 'P0001';
  end if;
  if public._market_item_ceded(v_item.id, new.proposer_id) then
    raise exception 'Objet déjà cédé (vente ou échange conclu) : il ne peut plus être proposé'
      using errcode = 'P0001';
  end if;
  if public._market_item_rejected(v_item.id, new.proposer_id) then
    raise exception 'Objet refusé par un expert : il ne peut pas être proposé sans nouvelle certification'
      using errcode = 'P0001';
  end if;
  if exists (
       select 1 from public.exchange_proposals e
       where e.offered_item_id = v_item.id
         and e.state in ('accepted', 'awaiting_certification', 'shipping', 'disputed'))
     or exists (
       select 1 from public.listings l
       where l.item_id = v_item.id and public.listing_is_engaged(l.id)) then
    raise exception 'Cet objet est déjà engagé dans une transaction en cours' using errcode = 'P0001';
  end if;

  if new.offered_value is null or new.offered_value <= 0 then
    raise exception 'Valeur déclarée de votre objet requise (strictement positive)'
      using errcode = 'P0001';
  end if;
  new.cash_adjustment := coalesce(new.cash_adjustment, 0);
  -- Un échange porte d'abord sur des biens : la soulte ne peut excéder la plus
  -- grande des deux valeurs déclarées (sinon : vente déguisée hors commission).
  if abs(new.cash_adjustment) > greatest(new.offered_value, v_listing.ask_price) then
    raise exception 'Soulte trop élevée : elle ne peut dépasser la valeur déclarée des objets'
      using errcode = 'P0001';
  end if;

  v_message := nullif(btrim(coalesce(new.message, '')), '');
  new.message := public.redact_contact_info(v_message);
  new.message_redacted := new.message is distinct from v_message;

  new.recipient_id := v_listing.seller_id;
  new.listing_title := v_listing.title;
  new.listing_domain := v_listing.domain;
  new.listing_value := v_listing.ask_price;
  new.currency := v_listing.currency;
  new.offered_title := public.redact_contact_info(v_item.title);
  new.offered_domain := v_item.domain;
  new.state := 'proposed';
  new.certification_required := false;
  new.proposer_commission_rate := null;
  new.proposer_commission := null;
  new.recipient_commission_rate := null;
  new.recipient_commission := null;
  new.proposer_carrier := null;
  new.proposer_tracking := null;
  new.proposer_shipped_at := null;
  new.proposer_delivered_at := null;
  new.recipient_carrier := null;
  new.recipient_tracking := null;
  new.recipient_shipped_at := null;
  new.recipient_delivered_at := null;
  new.proposer_received := false;
  new.recipient_received := false;
  new.dispute_reason := null;
  new.disputed_by := null;
  new.disputed_at := null;
  new.resolution_note := null;
  new.accepted_at := null;
  new.completed_at := null;
  new.expires_at := now() + make_interval(days => public.exchange_proposal_ttl_days());
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger exchange_proposals_set_defaults
  before insert on public.exchange_proposals
  for each row execute function public.set_exchange_defaults();

create or replace function public.enforce_exchange_transition()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_proposer boolean := v_uid is not null and v_uid = old.proposer_id;
  v_recipient boolean := v_uid is not null and v_uid = old.recipient_id;
  v_party boolean := v_proposer or v_recipient;
  v_sys boolean := public.is_escrow_system_action();
  v_from text := old.state;
  v_to text := new.state;
  v_no_shipment boolean := old.proposer_tracking is null and old.recipient_tracking is null;
  v_ok boolean := false;
  v_check record;
begin
  if not v_sys then
    -- Termes contractuels figés dès la proposition. Seule exception : le
    -- détachement (→ null) par une action référentielle ON DELETE SET NULL
    -- (objet ou membre supprimé) — aucun client n'écrit la table en direct.
    if (new.listing_id, new.proposer_id, new.recipient_id,
        new.offered_value, new.listing_value, new.cash_adjustment, new.currency, new.message)
       is distinct from
       (old.listing_id, old.proposer_id, old.recipient_id,
        old.offered_value, old.listing_value, old.cash_adjustment, old.currency, old.message)
       or (new.offered_item_id is distinct from old.offered_item_id and new.offered_item_id is not null) then
      raise exception 'Les termes d''une proposition d''échange sont figés' using errcode = 'P0001';
    end if;
    -- Colonnes calculées par le serveur : toute valeur client est ignorée.
    new.listing_title := old.listing_title;
    new.listing_domain := old.listing_domain;
    new.offered_title := old.offered_title;
    new.offered_domain := old.offered_domain;
    new.message_redacted := old.message_redacted;
    new.certification_required := old.certification_required;
    new.proposer_commission_rate := old.proposer_commission_rate;
    new.proposer_commission := old.proposer_commission;
    new.recipient_commission_rate := old.recipient_commission_rate;
    new.recipient_commission := old.recipient_commission;
    new.proposer_shipped_at := old.proposer_shipped_at;
    new.recipient_shipped_at := old.recipient_shipped_at;
    new.proposer_delivered_at := old.proposer_delivered_at;
    new.recipient_delivered_at := old.recipient_delivered_at;
    new.disputed_by := case when new.disputed_by is null then null else old.disputed_by end;
    new.disputed_at := old.disputed_at;
    new.resolution_note := old.resolution_note;
    new.expires_at := old.expires_at;
    new.accepted_at := old.accepted_at;
    new.completed_at := old.completed_at;
    new.created_at := old.created_at;
    if v_to is not distinct from v_from or v_to <> 'disputed' then
      new.dispute_reason := old.dispute_reason;
    end if;
  end if;

  -- ── Transition d'état : acteur légal ──
  if v_from <> v_to then
    if v_from = 'proposed' and v_to in ('accepted', 'declined') then
      v_ok := v_recipient or v_sys;
    elsif v_from = 'proposed' and v_to = 'withdrawn' then
      v_ok := v_proposer or v_sys;
    elsif v_from = 'proposed' and v_to = 'expired' then
      v_ok := v_sys;
    elsif v_from = 'accepted' and v_to in ('awaiting_certification', 'shipping') then
      v_ok := v_sys;
    elsif v_from in ('accepted', 'awaiting_certification') and v_to = 'cancelled' then
      v_ok := v_party or v_sys;
    elsif v_from = 'awaiting_certification' and v_to = 'shipping' then
      v_ok := v_sys;
    elsif v_from = 'shipping' and v_to = 'awaiting_certification' then
      v_ok := v_sys and v_no_shipment;
    elsif v_from = 'shipping' and v_to = 'cancelled' then
      -- Avant toute expédition seulement (sinon : litige).
      v_ok := (v_party and v_no_shipment) or v_sys;
    elsif v_from = 'shipping' and v_to = 'completed' then
      v_ok := v_sys or (v_party and new.proposer_received and new.recipient_received);
    elsif v_from = 'shipping' and v_to = 'disputed' then
      v_ok := v_party or v_sys;
    elsif v_from = 'disputed' and v_to in ('completed', 'cancelled') then
      v_ok := v_sys;
    end if;
    if not v_ok then
      raise exception 'Transition d''échange interdite (% → % par cet acteur)', v_from, v_to
        using errcode = 'P0001';
    end if;
  end if;

  -- ── Effets de la transition ──
  if v_from = 'proposed' and v_to = 'accepted' then
    if old.expires_at <= now() then
      raise exception 'Proposition expirée' using errcode = 'P0001';
    end if;
    -- Accepter engage une nouvelle transaction : offre Platine requise
    -- (abonnement expiré depuis la publication de l'annonce : refus).
    if not v_sys and not public.can_list_on_marketplace(v_uid) then
      raise exception 'Les plateformes d''échange et de vente sont réservées à l''offre Platine'
        using errcode = 'VL402';
    end if;
    -- Verrou puis contrôle (instantané frais) : l'annonce et les deux objets
    -- ne peuvent pas être réservés deux fois en parallèle.
    perform public.market_lock_for_reservation(old.listing_id, old.offered_item_id);
    select c.available, c.certification_required into v_check
    from public.exchange_acceptance_check(old.id) c;
    if not v_check.available then
      raise exception 'Annonce ou objet proposé plus disponible pour cet échange'
        using errcode = 'P0001';
    end if;
    -- Commissions FIGÉES : taux dégressif de chaque partie × valeur déclarée
    -- de l'objet qu'elle cède (exchangeCommission, @velum/config).
    new.proposer_commission_rate := public.commission_rate_for(old.proposer_id);
    new.proposer_commission := round(old.offered_value * new.proposer_commission_rate, 2);
    new.recipient_commission_rate := public.commission_rate_for(old.recipient_id);
    new.recipient_commission := round(old.listing_value * new.recipient_commission_rate, 2);
    new.certification_required := v_check.certification_required;
    new.accepted_at := now();
  elsif v_from <> v_to and v_to = 'disputed' then
    if nullif(btrim(coalesce(new.dispute_reason, '')), '') is null then
      raise exception 'Motif du litige requis' using errcode = 'P0001';
    end if;
    new.dispute_reason := btrim(new.dispute_reason);
    new.disputed_by := coalesce(v_uid, new.disputed_by);
    new.disputed_at := now();
  elsif v_from <> v_to and v_to = 'completed' then
    new.completed_at := now();
  end if;

  -- ── Expédition : chacun SON envoi, en phase d'expédition, hors certification ouverte ──
  if (new.proposer_tracking, new.proposer_carrier)
     is distinct from (old.proposer_tracking, old.proposer_carrier) then
    if not (v_sys or v_proposer) then
      raise exception 'Chaque partie ne renseigne que son propre envoi' using errcode = 'P0001';
    end if;
    if old.state <> 'shipping' or new.state <> 'shipping' then
      raise exception 'Envoi possible uniquement en phase d''expédition' using errcode = 'P0001';
    end if;
    if nullif(btrim(coalesce(new.proposer_tracking, '')), '') is null then
      raise exception 'Numéro de suivi requis' using errcode = 'P0001';
    end if;
    if old.recipient_received then
      raise exception 'Réception déjà confirmée : le suivi est figé' using errcode = 'P0001';
    end if;
    if public.has_open_certification(null, old.id) then
      raise exception 'Expédition bloquée : une certification d''expert est en cours'
        using errcode = 'P0001';
    end if;
    -- Lisible par l'autre partie : format contrôlé, jamais de texte libre.
    new.proposer_tracking := public.market_normalize_tracking(new.proposer_tracking);
    new.proposer_carrier := public.market_normalize_carrier(new.proposer_carrier);
    new.proposer_shipped_at := coalesce(old.proposer_shipped_at, now());
  end if;
  if (new.recipient_tracking, new.recipient_carrier)
     is distinct from (old.recipient_tracking, old.recipient_carrier) then
    if not (v_sys or v_recipient) then
      raise exception 'Chaque partie ne renseigne que son propre envoi' using errcode = 'P0001';
    end if;
    if old.state <> 'shipping' or new.state <> 'shipping' then
      raise exception 'Envoi possible uniquement en phase d''expédition' using errcode = 'P0001';
    end if;
    if nullif(btrim(coalesce(new.recipient_tracking, '')), '') is null then
      raise exception 'Numéro de suivi requis' using errcode = 'P0001';
    end if;
    if old.proposer_received then
      raise exception 'Réception déjà confirmée : le suivi est figé' using errcode = 'P0001';
    end if;
    if public.has_open_certification(null, old.id) then
      raise exception 'Expédition bloquée : une certification d''expert est en cours'
        using errcode = 'P0001';
    end if;
    new.recipient_tracking := public.market_normalize_tracking(new.recipient_tracking);
    new.recipient_carrier := public.market_normalize_carrier(new.recipient_carrier);
    new.recipient_shipped_at := coalesce(old.recipient_shipped_at, now());
  end if;

  -- ── Réception : chacun confirme celle de l'objet de l'AUTRE, une fois expédié ──
  if new.proposer_received is distinct from old.proposer_received then
    if not (v_sys or v_proposer) then
      raise exception 'Seul le destinataire d''un colis en confirme la réception' using errcode = 'P0001';
    end if;
    if old.proposer_received then
      raise exception 'Réception déjà confirmée' using errcode = 'P0001';
    end if;
    if old.state <> 'shipping' then
      raise exception 'Réception possible uniquement en phase d''expédition' using errcode = 'P0001';
    end if;
    if old.recipient_tracking is null then
      raise exception 'L''autre partie n''a pas encore expédié son objet' using errcode = 'P0001';
    end if;
  end if;
  if new.recipient_received is distinct from old.recipient_received then
    if not (v_sys or v_recipient) then
      raise exception 'Seul le destinataire d''un colis en confirme la réception' using errcode = 'P0001';
    end if;
    if old.recipient_received then
      raise exception 'Réception déjà confirmée' using errcode = 'P0001';
    end if;
    if old.state <> 'shipping' then
      raise exception 'Réception possible uniquement en phase d''expédition' using errcode = 'P0001';
    end if;
    if old.proposer_tracking is null then
      raise exception 'L''autre partie n''a pas encore expédié son objet' using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger exchange_proposals_enforce_transition
  before update on public.exchange_proposals
  for each row execute function public.enforce_exchange_transition();

-- Ouvre les certifications « seuil » d'un échange accepté (frais : le
-- propriétaire de chaque objet concerné, defaultCertificationFeePayer).
create or replace function public._open_exchange_threshold_certifications(p_exchange uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.certification_requests (
    exchange_id, item_id, item_title, domain, owner_id, requested_by,
    counterparty_id, reason, status, fee_payer, counterparty_agreed)
  select p_exchange, t.item_id, t.item_title, t.domain, t.owner_id, t.owner_id,
         t.counterparty_id, 'threshold', 'requested', 'seller', true
  from public._exchange_threshold_targets(p_exchange) t
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public._open_exchange_threshold_certifications(uuid)
  from public, anon, authenticated;

-- Reprise d'un échange en attente de certification : plus aucune expertise
-- en cours (demandée ou en revue) ⇒ phase d'expédition.
create or replace function public._exchange_resume_after_certification(p_exchange uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  if not exists (
    select 1 from public.certification_requests c
    where c.exchange_id = p_exchange and c.status in ('requested', 'in_review')
  ) then
    v_prev := public.market_system_begin();
    update public.exchange_proposals set state = 'shipping'
      where id = p_exchange and state = 'awaiting_certification';
    perform public.market_system_end(v_prev);
  end if;
end;
$$;
revoke all on function public._exchange_resume_after_certification(uuid)
  from public, anon, authenticated;

create or replace function public.exchange_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_uid uuid := auth.uid();
  v_label text;
begin
  if new.state is not distinct from old.state then
    return null;
  end if;
  v_label := format('« %s » ⇄ « %s »',
    coalesce(new.listing_title, 'objet'), coalesce(new.offered_title, 'objet'));
  v_prev := public.market_system_begin();

  if new.state = 'accepted' then
    -- Les autres propositions en attente sur l'annonce sont déclinées ; celles
    -- qui offrent le même objet ailleurs sont retirées ; l'annonce (et celle
    -- de l'objet offert, le cas échéant) est réservée.
    update public.exchange_proposals set state = 'declined'
      where listing_id = new.listing_id and id <> new.id and state = 'proposed';
    update public.exchange_proposals set state = 'withdrawn'
      where offered_item_id = new.offered_item_id and id <> new.id and state = 'proposed';
    -- Symétrique : le destinataire n'offre plus ailleurs l'objet de son annonce.
    update public.exchange_proposals e set state = 'withdrawn'
      from public.listings l
      where l.id = new.listing_id
        and e.offered_item_id = l.item_id and e.proposer_id = new.recipient_id
        and e.id <> new.id and e.state = 'proposed';
    update public.exchange_proposals e set state = 'declined'
      from public.listings l
      where l.item_id = new.offered_item_id and l.seller_id = new.proposer_id
        and e.listing_id = l.id and e.state = 'proposed';
    update public.orders set escrow_state = 'cancelled'
      where escrow_state = 'pending_payment'
        and listing_id in (
          select l.id from public.listings l
          where l.id = new.listing_id
             or (l.item_id = new.offered_item_id and l.seller_id = new.proposer_id));
    if new.certification_required then
      perform public._open_exchange_threshold_certifications(new.id);
      update public.exchange_proposals set state = 'awaiting_certification' where id = new.id;
    else
      update public.exchange_proposals set state = 'shipping' where id = new.id;
    end if;
    perform public.market_notify(new.proposer_id, 'Proposition d’échange acceptée', v_label);
  elsif new.state in ('declined', 'withdrawn', 'expired', 'cancelled') then
    update public.certification_requests set status = 'cancelled'
      where exchange_id = new.id and status in ('awaiting_agreement', 'requested', 'in_review');
    if new.state = 'declined' then
      perform public.market_notify(new.proposer_id, 'Proposition d’échange déclinée', v_label);
    elsif new.state = 'expired' then
      perform public.market_notify(new.proposer_id, 'Proposition d’échange expirée', v_label);
    elsif new.state = 'withdrawn' then
      perform public.market_notify(new.recipient_id, 'Proposition d’échange retirée', v_label);
    else
      if v_uid is distinct from new.proposer_id then
        perform public.market_notify(new.proposer_id, 'Échange annulé', v_label);
      end if;
      if v_uid is distinct from new.recipient_id then
        perform public.market_notify(new.recipient_id, 'Échange annulé', v_label);
      end if;
    end if;
  elsif new.state = 'completed' then
    -- Objet de l'annonce parti dans l'échange ; l'objet reçu en contrepartie
    -- n'est plus disponible ailleurs.
    update public.listings set status = 'exchanged'
      where id = new.listing_id and status <> 'exchanged';
    update public.listings set status = 'withdrawn'
      where item_id = new.offered_item_id and seller_id = new.proposer_id
        and status in ('draft', 'active', 'pending_certification');
  elsif new.state = 'disputed' then
    if v_uid is distinct from new.proposer_id then
      perform public.market_notify(new.proposer_id, 'Litige ouvert sur un échange', v_label);
    end if;
    if v_uid is distinct from new.recipient_id then
      perform public.market_notify(new.recipient_id, 'Litige ouvert sur un échange', v_label);
    end if;
  end if;

  perform public.market_system_end(v_prev);
  return null;
end;
$$;

create trigger exchange_proposals_after_change
  after update on public.exchange_proposals
  for each row execute function public.exchange_after_change();

-- Nouvelle proposition : le destinataire est prévenu (pseudonymes uniquement).
create or replace function public.exchange_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.market_notify(
    new.recipient_id,
    'Nouvelle proposition d’échange',
    format('%s propose « %s » contre « %s ».',
      public.market_alias_of(new.proposer_id),
      coalesce(new.offered_title, 'un objet'),
      coalesce(new.listing_title, 'votre annonce')));
  return null;
end;
$$;

create trigger exchange_proposals_after_insert
  after insert on public.exchange_proposals
  for each row execute function public.exchange_after_insert();

-- ── 8. Certifications : création, machine à états, effets ────────────────────
create or replace function public.set_certification_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('awaiting_agreement', 'requested') then
    raise exception 'Statut initial de certification invalide : %', new.status using errcode = 'P0001';
  end if;
  new.item_title := public.redact_contact_info(new.item_title);
  new.counterparty_agreed := new.reason <> 'mutual_agreement' or new.status = 'requested';
  new.fee_amount := null;
  new.report_ref := null;
  new.expert_note := null;
  new.decided_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger certification_requests_set_defaults
  before insert on public.certification_requests
  for each row execute function public.set_certification_defaults();

create or replace function public.enforce_certification_transition()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_sys boolean := public.is_escrow_system_action();
  v_requester boolean := v_uid is not null and v_uid = old.requested_by;
  v_counterparty boolean := v_uid is not null and v_uid = old.counterparty_id;
  v_owner boolean := v_uid is not null and v_uid = old.owner_id;
  v_listing_only boolean := old.order_id is null and old.exchange_id is null;
  v_from text := old.status;
  v_to text := new.status;
  v_ok boolean := false;
begin
  if not v_sys then
    -- Termes figés ; seul le détachement de l'objet supprimé (item_id → null,
    -- action référentielle) est admis.
    if (new.listing_id, new.order_id, new.exchange_id, new.owner_id,
        new.requested_by, new.counterparty_id, new.reason, new.fee_payer)
       is distinct from
       (old.listing_id, old.order_id, old.exchange_id, old.owner_id,
        old.requested_by, old.counterparty_id, old.reason, old.fee_payer)
       or (new.item_id is distinct from old.item_id and new.item_id is not null) then
      raise exception 'Les termes d''une demande de certification sont figés' using errcode = 'P0001';
    end if;
    -- Décision, frais et rapport : réservés à l'expert (fonctions système).
    new.fee_amount := old.fee_amount;
    new.report_ref := old.report_ref;
    new.expert_note := old.expert_note;
    new.decided_at := old.decided_at;
    new.created_at := old.created_at;
    new.item_title := old.item_title;
    new.domain := old.domain;
    new.counterparty_agreed := old.counterparty_agreed;
  end if;

  if v_from = v_to then
    return new;
  end if;

  if v_from = 'awaiting_agreement' and v_to = 'requested' then
    -- Accord de l'AUTRE partie (jamais de l'auteur de la demande).
    v_ok := v_counterparty or v_sys;
    new.counterparty_agreed := true;
  elsif v_from = 'awaiting_agreement' and v_to = 'cancelled' then
    -- Refus de l'autre partie, ou retrait par l'auteur.
    v_ok := v_requester or v_counterparty or v_sys;
  elsif v_from = 'requested' and v_to = 'in_review' then
    v_ok := v_sys;
  elsif v_from in ('requested', 'in_review') and v_to in ('certified', 'rejected') then
    v_ok := v_sys;
  elsif v_from in ('requested', 'in_review') and v_to = 'cancelled' then
    v_ok := v_sys
      or (old.reason = 'voluntary' and v_requester)
      or (old.reason = 'threshold' and v_listing_only and v_owner)
      or (old.reason = 'mutual_agreement' and v_requester);
  end if;
  if not v_ok then
    raise exception 'Transition de certification interdite (% → % par cet acteur)', v_from, v_to
      using errcode = 'P0001';
  end if;

  if v_to in ('certified', 'rejected') then
    if v_to = 'certified' and nullif(btrim(coalesce(new.report_ref, '')), '') is null then
      raise exception 'Rapport d''expert requis pour certifier' using errcode = 'P0001';
    end if;
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger certification_requests_enforce_transition
  before update on public.certification_requests
  for each row execute function public.enforce_certification_transition();

create or replace function public.certification_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_listing_only boolean := new.order_id is null and new.exchange_id is null;
  v_label text := coalesce(new.item_title, 'votre objet');
  -- Autre partie que le propriétaire (counterparty_id désigne celle qui doit
  -- ACCEPTER : quand l'acheteur demande, c'est le propriétaire lui-même).
  v_other uuid := case
    when new.requested_by = new.owner_id then new.counterparty_id
    else new.requested_by
  end;
  v_order record;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  v_prev := public.market_system_begin();

  if old.status = 'awaiting_agreement' and new.status = 'requested' then
    -- Accord mutuel conclu : la certification conditionne l'expédition.
    if new.exchange_id is not null then
      update public.exchange_proposals
        set certification_required = true,
            state = case when state = 'shipping' then 'awaiting_certification' else state end
        where id = new.exchange_id
          and state in ('accepted', 'awaiting_certification', 'shipping');
    end if;
    perform public.market_notify(new.requested_by, 'Certification acceptée',
      format('L’autre partie accepte l’expertise de « %s ».', v_label));
  elsif new.status = 'certified' then
    if v_listing_only and new.listing_id is not null then
      -- Badge « authentifié VELUM » : l'annonce en attente est publiée.
      update public.listings set expert_appraisal_ref = new.report_ref
        where id = new.listing_id and status not in ('sold', 'exchanged', 'withdrawn');
    end if;
    if new.exchange_id is not null then
      perform public._exchange_resume_after_certification(new.exchange_id);
    end if;
    perform public.market_notify(new.owner_id, 'Objet certifié par un expert', v_label);
    perform public.market_notify(v_other, 'Objet certifié par un expert', v_label);
  elsif new.status = 'rejected' then
    -- Refus de l'expert, QUEL QUE SOIT le motif (seuil, accord mutuel,
    -- volontaire) et le contexte (annonce, commande, échange) :
    --  1. toute transaction NON EXPÉDIÉE portant sur cet objet du propriétaire
    --     tombe (STRIPE : remboursement si les fonds étaient séquestrés) —
    --     commandes de ses annonces de l'objet (acheteur prévenu), échanges
    --     visant l'une d'elles ou offrant l'objet (les deux parties prévenues
    --     par exchange_after_change) ; une transaction déjà expédiée reste en
    --     place : elle relève du litige ;
    --  2. PUIS l'objet jugé non authentique quitte le catalogue : ses annonces
    --     ouvertes repassent en brouillon, ses propositions d'échange en
    --     attente sont retirées, et la référence d'une certification
    --     antérieure est effacée de ses annonces non closes (une réouverture
    --     ne ressuscite pas le badge).
    -- Le refus reste mémorisé sur l'objet (_market_item_rejected) : toute
    -- republication exige une nouvelle certification.
    for v_order in
      update public.orders o set escrow_state = 'cancelled'
      from public.listings l
      where l.id = o.listing_id
        and o.escrow_state in ('pending_payment', 'funds_held')
        and (o.id = new.order_id
          or (l.seller_id = new.owner_id
            and (l.id = new.listing_id or (new.item_id is not null and l.item_id = new.item_id))))
      returning o.id, o.buyer_id, l.title
    loop
      -- L'acheteur de la commande en cause est déjà prévenu du refus (v_other).
      if v_order.id is distinct from new.order_id then
        perform public.market_notify(v_order.buyer_id, 'Commande annulée',
          format('« %s » a été jugé non authentique par un expert : votre commande est annulée (paiement restitué s’il avait été versé).',
            coalesce(v_order.title, v_label)));
      end if;
    end loop;
    update public.exchange_proposals e set state = 'cancelled'
      where e.state in ('accepted', 'awaiting_certification', 'shipping')
        and (e.id = new.exchange_id
          or (e.proposer_tracking is null and e.recipient_tracking is null
            and ((new.item_id is not null and e.offered_item_id = new.item_id
                  and e.proposer_id = new.owner_id)
              or e.listing_id in (
                select l.id from public.listings l
                where l.seller_id = new.owner_id
                  and (l.id = new.listing_id
                    or (new.item_id is not null and l.item_id = new.item_id))))));
    update public.listings l set status = 'draft'
      where l.seller_id = new.owner_id
        and l.status in ('active', 'pending_certification')
        and (l.id = new.listing_id or (new.item_id is not null and l.item_id = new.item_id))
        and not public.listing_is_engaged(l.id);
    update public.listings l set expert_appraisal_ref = null
      where l.seller_id = new.owner_id
        and l.expert_appraisal_ref is not null
        and l.status not in ('sold', 'exchanged')
        and (l.id = new.listing_id or (new.item_id is not null and l.item_id = new.item_id));
    update public.exchange_proposals e set state = 'declined'
      from public.listings l
      where e.listing_id = l.id
        and e.state = 'proposed'
        and l.seller_id = new.owner_id
        and l.status = 'draft'
        and (l.id = new.listing_id or (new.item_id is not null and l.item_id = new.item_id));
    if new.item_id is not null then
      update public.exchange_proposals set state = 'withdrawn'
        where offered_item_id = new.item_id and proposer_id = new.owner_id and state = 'proposed';
    end if;
    perform public.market_notify(new.owner_id, 'Certification refusée par l’expert', v_label);
    perform public.market_notify(v_other, 'Certification refusée par l’expert', v_label);
  elsif new.status = 'cancelled' then
    if v_listing_only and new.reason = 'threshold' then
      -- Certification obligatoire abandonnée : l'annonce n'est pas publiée.
      update public.listings l set status = 'draft'
        where l.id = new.listing_id
          and l.status = 'pending_certification'
          and l.expert_appraisal_ref is null
          and not exists (
            select 1 from public.certification_requests c
            where c.listing_id = l.id and c.order_id is null and c.exchange_id is null
              and c.status in ('awaiting_agreement', 'requested', 'in_review'));
    end if;
    if new.exchange_id is not null then
      perform public._exchange_resume_after_certification(new.exchange_id);
    end if;
    if old.status = 'awaiting_agreement' and new.reason = 'mutual_agreement' then
      perform public.market_notify(new.requested_by, 'Certification non retenue',
        format('La demande d’expertise de « %s » est close sans accord.', v_label));
    end if;
  end if;

  perform public.market_system_end(v_prev);
  return null;
end;
$$;

create trigger certification_requests_after_change
  after update on public.certification_requests
  for each row execute function public.certification_after_change();

-- Demande d'accord : l'autre partie est prévenue.
create or replace function public.certification_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'awaiting_agreement' then
    perform public.market_notify(new.counterparty_id, 'Demande de certification par un expert',
      format('%s propose de faire expertiser « %s » (frais partagés par défaut).',
        public.market_alias_of(new.requested_by), coalesce(new.item_title, 'l’objet')));
  end if;
  return null;
end;
$$;

create trigger certification_requests_after_insert
  after insert on public.certification_requests
  for each row execute function public.certification_after_insert();

-- ── 9. Objets : suppression bloquée pendant une transaction en cours ─────────
-- (le détachement retirerait une annonce réservée et laisserait l'autre
-- partie sans objet). Hors transaction, supprimer un objet détache ses
-- annonces et propositions (historique conservé). Les cascades RGPD
-- (suppression de compte) restent permises.
create or replace function public.guard_item_market_delete()
returns trigger
language plpgsql
as $$
begin
  if not public.market_trusted_actor() and public.item_is_engaged(old.id) then
    raise exception 'Objet engagé dans une vente ou un échange en cours : suppression impossible'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger items_guard_market_engagement
  before delete on public.items
  for each row execute function public.guard_item_market_delete();

-- ── 10. Fonctions de confiance de 0006 : exécution réservée au service_role ──
-- Supabase accorde EXECUTE aux rôles anon/authenticated sur toute nouvelle
-- fonction (privilèges par défaut) : un membre pouvait arbitrer SON litige.
revoke all on function public.resolve_dispute(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.resolve_dispute(uuid, boolean, text) to service_role;
revoke all on function public.release_due_orders() from public, anon, authenticated;
grant execute on function public.release_due_orders() to service_role;
