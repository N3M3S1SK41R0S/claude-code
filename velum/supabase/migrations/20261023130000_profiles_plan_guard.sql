-- ============================================================================
-- VELUM — garde de l'offre d'abonnement (profiles.plan) et fin d'abonnement
-- Platine.
-- ----------------------------------------------------------------------------
-- Faille préexistante (0001) : la policy profiles_update_own ne restreignait
-- aucune colonne — un membre gratuit se passait lui-même en 'platine'
-- (update profiles set plan = 'platine'), ce qui annulait le quota de scans,
-- le carnet et toutes les gardes VL402 des plateformes d'échange et de vente.
-- L'offre n'est écrite QUE par le serveur : revenuecat-webhook (service_role)
-- et handle_new_user (création du profil, SECURITY DEFINER).
--
--  1. Privilèges de colonnes : le client ne modifie que display_name, locale,
--     a11y_mode et expo_push_token (seules colonnes écrites par
--     profilePatchToRow, @velum/api-client) ; ni INSERT (profil créé par
--     handle_new_user), ni DELETE (suppression de compte : Edge Function
--     delete-account).
--  2. Défense en profondeur : trigger refusant tout changement d'offre hors
--     acteur de confiance (service_role, fonctions serveur, migrations).
--  3. Fin d'abonnement Platine (EXPIRATION RevenueCat, ou tout passage hors
--     'platine') : annonces publiées ou en attente de certification RETIRÉES
--     (sauf celles engagées dans une transaction en cours, qui se poursuit),
--     propositions d'échange en attente retirées ; brouillons conservés (leur
--     republication exige de nouveau l'offre Platine, enforce_listing_rules).
-- ============================================================================

-- ── 1. Privilèges de colonnes ───────────────────────────────────────────────
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (display_name, locale, a11y_mode, expo_push_token) on public.profiles to authenticated;

-- ── 2. Offre écrite par le serveur seul ─────────────────────────────────────
create or replace function public.guard_profile_plan()
returns trigger
language plpgsql
as $$
begin
  if new.plan is distinct from old.plan and not public.market_trusted_actor() then
    raise exception 'L''offre d''abonnement est gérée par la plateforme (achat dans l''application)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_plan
  before update on public.profiles
  for each row execute function public.guard_profile_plan();

-- ── 3. Fin d'abonnement Platine ─────────────────────────────────────────────
create or replace function public.profile_after_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_withdrawn integer;
begin
  if old.plan = 'platine' and new.plan is distinct from 'platine' then
    v_prev := public.market_system_begin();
    update public.listings l set status = 'withdrawn'
      where l.seller_id = new.id
        and l.status in ('active', 'pending_certification')
        and not public.listing_is_engaged(l.id);
    get diagnostics v_withdrawn = row_count;
    update public.exchange_proposals set state = 'withdrawn'
      where proposer_id = new.id and state = 'proposed';
    if v_withdrawn > 0 then
      perform public.market_notify(
        new.id,
        'Annonces retirées',
        format(
          'Votre offre Platine a pris fin : %s annonce(s) ont été retirées des plateformes d’échange et de vente. Les transactions en cours se poursuivent.',
          v_withdrawn));
    end if;
    perform public.market_system_end(v_prev);
  end if;
  return null;
end;
$$;

create trigger profiles_after_plan_change
  after update of plan on public.profiles
  for each row execute function public.profile_after_plan_change();
