#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Validation SQL locale sans Docker : rejoue TOUTES les migrations VELUM sur un
# PostgreSQL 16 nu (stub des schémas Supabase), puis le seed et les tests de
# comportement (RLS, quota, Platine, Storage, purge RGPD, alertes idempotentes).
# Enfin, une base intermédiaire (nom de la base suivi de « _upgrade ») éprouve
# les rattrapages des données historiques 0006 (supabase/tests/upgrade/).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

# Base temporaire ; surchargeable pour exécuter plusieurs validations en parallèle.
DB=${VELUM_SQL_DB:-velum_sql_check}
if [[ $(id -un) == 'postgres' ]]; then
  PG_RUN=()
else
  PG_RUN=(sudo -u postgres)
fi
PSQL=("${PG_RUN[@]}" psql -v ON_ERROR_STOP=1 -q -d "$DB")
DIAGNOSTIC_FILE=${VELUM_SQL_DIAGNOSTIC_FILE:-/tmp/velum-sql-diagnostics.log}
COMMAND_LOG=${VELUM_SQL_COMMAND_LOG:-/tmp/velum-sql-command.log}
PLAN_FILE=${VELUM_SQL_PLAN_FILE:-/tmp/velum-migration-plan.tsv}
: >"$DIAGNOSTIC_FILE"

record_failure() {
  local label=$1
  local output_file=$2
  {
    printf 'Étape en échec : %s\n\n' "$label"
    cat "$output_file"
  } >"$DIAGNOSTIC_FILE"
}

run_sql_file() {
  local label=$1
  local path=$2

  : >"$COMMAND_LOG"
  if ! "${PSQL[@]}" -f "$path" >"$COMMAND_LOG" 2>&1; then
    record_failure "$label ($path)" "$COMMAND_LOG"
    cat "$COMMAND_LOG" >&2
    return 1
  fi
  cat "$COMMAND_LOG"
}

: >"$COMMAND_LOG"
if ! bash supabase/tests/migration-plan-test.sh >"$COMMAND_LOG" 2>&1; then
  record_failure "tests du plan de migrations" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
cat "$COMMAND_LOG"

: >"$COMMAND_LOG"
if ! bash supabase/tests/migration-plan.sh supabase/migrations >"$PLAN_FILE" 2>"$COMMAND_LOG"; then
  record_failure "génération du plan de migrations" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
mapfile -t MIGRATION_PLAN <"$PLAN_FILE"

: >"$COMMAND_LOG"
if ! "${PG_RUN[@]}" dropdb --if-exists "$DB" >"$COMMAND_LOG" 2>&1; then
  record_failure "suppression de la base temporaire" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
if ! "${PG_RUN[@]}" createdb "$DB" >>"$COMMAND_LOG" 2>&1; then
  record_failure "création de la base temporaire" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
cat "$COMMAND_LOG"

echo "· stub Supabase (auth/storage/rôles)"
run_sql_file "stub Supabase" supabase/tests/supabase_stub.sql

for plan_entry in "${MIGRATION_PLAN[@]}"; do
  IFS=$'\t' read -r action migration_path <<<"$plan_entry"
  migration_name=${migration_path##*/}

  case "$action" in
    apply)
      echo "· migration $migration_name"
      run_sql_file "migration $migration_name" "$migration_path"
      ;;
    skip)
      echo "· migration $migration_name — SAUTÉE (pg_cron/pg_net = plateforme Supabase)"
      ;;
    *)
      printf 'Action de migration inconnue : %s\n' "$action" >"$COMMAND_LOG"
      record_failure "lecture du plan de migrations" "$COMMAND_LOG"
      cat "$COMMAND_LOG" >&2
      exit 1
      ;;
  esac
done

echo "· tests du remplacement atomique des preuves de calibration"
run_sql_file \
  "tests du remplacement atomique des preuves de calibration" \
  supabase/tests/calibration_backtest_checks.sql

echo "· tests des rôles média du module Montres"
run_sql_file \
  "tests des rôles média du module Montres" \
  supabase/tests/watch_media_roles_checks.sql

echo "· seed.sql (compte démo + collection)"
run_sql_file "seed" supabase/seed.sql

echo "· tests d'idempotence des alertes"
run_sql_file "tests d'idempotence des alertes" supabase/tests/alert_idempotency_checks.sql

echo "· tests de comportement (RLS, quota, Platine, storage, purge)"
run_sql_file "tests RLS et comportement" supabase/tests/rls_checks.sql

# Tests par fonctionnalité, découverts automatiquement (ordre alphabétique) :
# chaque chantier ajoute son fichier sans modifier ce script.
shopt -s nullglob
for feature_checks in supabase/tests/features/*.sql; do
  echo "· tests ${feature_checks##*/}"
  run_sql_file "tests ${feature_checks##*/}" "$feature_checks"
done
shopt -u nullglob

# Rattrapages des données historiques (0006) : ils ne s'exécutent qu'une fois,
# sur des lignes que la base fraîche ci-dessus n'a pas. Seconde base : les
# migrations jusqu'au niveau 0006 (UPGRADE_BASELINE), les données de
# supabase/tests/upgrade/legacy_0006_data.sql, puis les migrations suivantes
# et leurs contrôles (legacy_0006_checks.sql).
UPGRADE_DB="${DB}_upgrade"
UPGRADE_BASELINE=20260717161000
: >"$COMMAND_LOG"
if ! "${PG_RUN[@]}" dropdb --if-exists "$UPGRADE_DB" >"$COMMAND_LOG" 2>&1 \
   || ! "${PG_RUN[@]}" createdb "$UPGRADE_DB" >>"$COMMAND_LOG" 2>&1; then
  record_failure "création de la base intermédiaire (rattrapages 0006)" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
PSQL=("${PG_RUN[@]}" psql -v ON_ERROR_STOP=1 -q -d "$UPGRADE_DB")
echo "· base intermédiaire $UPGRADE_DB : stub Supabase"
run_sql_file "stub Supabase (base intermédiaire)" supabase/tests/supabase_stub.sql
legacy_loaded=false
for plan_entry in "${MIGRATION_PLAN[@]}"; do
  IFS=$'\t' read -r action migration_path <<<"$plan_entry"
  migration_name=${migration_path##*/}
  migration_version=${migration_name%%_*}
  if [[ $legacy_loaded == false && ${#migration_version} -eq 14 \
        && $migration_version > $UPGRADE_BASELINE ]]; then
    echo "· base intermédiaire : données 0006"
    run_sql_file "données 0006 (base intermédiaire)" supabase/tests/upgrade/legacy_0006_data.sql
    legacy_loaded=true
  fi
  if [[ $action == apply ]]; then
    echo "· base intermédiaire : migration $migration_name"
    run_sql_file "migration $migration_name (base intermédiaire)" "$migration_path"
  fi
done
if [[ $legacy_loaded == false ]]; then
  printf 'Aucune migration postérieure à %s : rattrapages 0006 non éprouvés\n' \
    "$UPGRADE_BASELINE" >"$COMMAND_LOG"
  record_failure "base intermédiaire (rattrapages 0006)" "$COMMAND_LOG"
  cat "$COMMAND_LOG" >&2
  exit 1
fi
echo "· tests des rattrapages 0006"
run_sql_file "tests des rattrapages 0006" supabase/tests/upgrade/legacy_0006_checks.sql

rm -f "$COMMAND_LOG" "$PLAN_FILE" "$DIAGNOSTIC_FILE"

echo
echo "VALIDATION SQL : PASS"
