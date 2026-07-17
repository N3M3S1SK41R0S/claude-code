-- ==========================================================================
-- VELUM — remplacement atomique des preuves de calibration publiques
-- --------------------------------------------------------------------------
-- Une collecte amont vide ne doit jamais effacer les preuves précédentes.
-- Lorsqu'un nouveau lot non vide existe, suppression et insertion vivent dans
-- la même transaction PostgreSQL : toute erreur restaure automatiquement le
-- lot antérieur.
-- ==========================================================================

create or replace function public.replace_calibration_backtest(
  p_domain public.velum_domain,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_expected integer;
  v_inserted integer;
begin
  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Le lot de backtest doit être un tableau JSON non vide.';
  end if;

  v_expected := jsonb_array_length(p_rows);

  -- Validation avant toute suppression. Les conversions JSON → numeric/timestamptz
  -- lèvent également ici, donc le lot existant reste intact.
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      central numeric,
      ci80_low numeric,
      ci80_high numeric,
      ci95_low numeric,
      ci95_high numeric,
      realized numeric,
      realized_at timestamptz
    )
    where row_data.central is null
       or row_data.central <= 0
       or row_data.realized is null
       or row_data.realized <= 0
       or row_data.ci80_low is null
       or row_data.ci80_high is null
       or row_data.ci95_low is null
       or row_data.ci95_high is null
       or row_data.realized_at is null
       or row_data.ci80_low > row_data.central
       or row_data.central > row_data.ci80_high
       or row_data.ci95_low > row_data.ci80_low
       or row_data.ci80_high > row_data.ci95_high
  ) then
    raise exception using
      errcode = '22023',
      message = 'Le lot de backtest contient une ligne invalide.';
  end if;

  delete from public.calibration_outcomes
  where domain = p_domain
    and origin = 'public_backtest';

  insert into public.calibration_outcomes (
    domain,
    central,
    ci80_low,
    ci80_high,
    ci95_low,
    ci95_high,
    realized,
    origin,
    realized_at
  )
  select
    p_domain,
    row_data.central,
    row_data.ci80_low,
    row_data.ci80_high,
    row_data.ci95_low,
    row_data.ci95_high,
    row_data.realized,
    'public_backtest',
    row_data.realized_at
  from jsonb_to_recordset(p_rows) as row_data(
    central numeric,
    ci80_low numeric,
    ci80_high numeric,
    ci95_low numeric,
    ci95_high numeric,
    realized numeric,
    realized_at timestamptz
  );

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_expected then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Remplacement incomplet du backtest : %s ligne(s) insérée(s) sur %s.',
        v_inserted,
        v_expected
      );
  end if;

  return v_inserted;
end
$function$;

revoke all on function public.replace_calibration_backtest(public.velum_domain, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_calibration_backtest(public.velum_domain, jsonb)
  to service_role;
