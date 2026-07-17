-- Vérifie que le remplacement des preuves publiques est non vide, atomique,
-- limité à l'origine public_backtest et réservé au service-role.

begin;

do $checks$
declare
  v_count integer;
  v_inserted integer;
  v_central numeric;
begin
  if has_function_privilege(
    'authenticated',
    'public.replace_calibration_backtest(public.velum_domain,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated ne doit pas exécuter replace_calibration_backtest';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.replace_calibration_backtest(public.velum_domain,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role doit exécuter replace_calibration_backtest';
  end if;

  delete from public.calibration_outcomes where domain = 'watch';

  insert into public.calibration_outcomes (
    domain, central, ci80_low, ci80_high, ci95_low, ci95_high,
    realized, origin, realized_at
  ) values
    ('watch', 100, 90, 110, 80, 120, 105, 'public_backtest', '2026-01-01T00:00:00Z'),
    ('watch', 200, 180, 220, 160, 240, 205, 'real_sale', '2026-01-02T00:00:00Z');

  -- Un rafraîchissement vide est refusé avant toute suppression.
  begin
    perform public.replace_calibration_backtest('watch', '[]'::jsonb);
    raise exception 'un lot vide aurait dû être refusé';
  exception
    when sqlstate '22023' then null;
  end;

  select count(*) into v_count
  from public.calibration_outcomes
  where domain = 'watch' and origin = 'public_backtest';
  if v_count <> 1 then
    raise exception 'le lot public précédent a été altéré après un rafraîchissement vide';
  end if;

  -- Cette ligne passe la validation logique, puis déborde numeric(14,2) lors de
  -- l'INSERT. La suppression antérieure dans la fonction doit être rollbackée.
  begin
    perform public.replace_calibration_backtest(
      'watch',
      jsonb_build_array(
        jsonb_build_object(
          'central', 1000000000000000,
          'ci80_low', 999999999999999,
          'ci80_high', 1000000000000001,
          'ci95_low', 999999999999998,
          'ci95_high', 1000000000000002,
          'realized', 1000000000000000,
          'realized_at', '2026-02-01T00:00:00Z'
        )
      )
    );
    raise exception 'le débordement numeric aurait dû échouer';
  exception
    when numeric_value_out_of_range then null;
  end;

  select central into v_central
  from public.calibration_outcomes
  where domain = 'watch' and origin = 'public_backtest';
  if v_central <> 100 then
    raise exception 'le lot antérieur n''a pas été restauré après un INSERT en échec';
  end if;

  v_inserted := public.replace_calibration_backtest(
    'watch',
    jsonb_build_array(
      jsonb_build_object(
        'central', 120,
        'ci80_low', 110,
        'ci80_high', 130,
        'ci95_low', 100,
        'ci95_high', 140,
        'realized', 125,
        'realized_at', '2026-03-01T00:00:00Z'
      ),
      jsonb_build_object(
        'central', 150,
        'ci80_low', 140,
        'ci80_high', 160,
        'ci95_low', 130,
        'ci95_high', 170,
        'realized', 148,
        'realized_at', '2026-03-02T00:00:00Z'
      )
    )
  );

  if v_inserted <> 2 then
    raise exception 'nombre de lignes remplacées inattendu : %', v_inserted;
  end if;

  select count(*) into v_count
  from public.calibration_outcomes
  where domain = 'watch' and origin = 'public_backtest';
  if v_count <> 2 then
    raise exception 'le nouveau lot public n''a pas remplacé exactement l''ancien';
  end if;

  select count(*) into v_count
  from public.calibration_outcomes
  where domain = 'watch' and origin = 'real_sale';
  if v_count <> 1 then
    raise exception 'les ventes réelles ont été altérées par le remplacement public';
  end if;
end
$checks$;

rollback;
