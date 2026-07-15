#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Validation SQL locale sans Docker : rejoue TOUTES les migrations VELUM sur un
# PostgreSQL 16 nu (stub des schémas Supabase), puis le seed et les tests de
# comportement (RLS, quota, Platine, Storage, purge RGPD, alertes idempotentes).
#
#   bash supabase/tests/run-local.sh
#
# Le shell reste sous l'utilisateur du checkout afin de lire les scripts Git ;
# seules les commandes PostgreSQL sont exécutées sous le rôle système postgres.
# La migration 0002 (pg_cron + pg_net) est la seule exception : ces extensions
# n'existent que sur la plateforme Supabase et sont validées au `db push`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=velum_sql_check
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

# Le plan est testé avant de toucher PostgreSQL : ordre stable, préfixes
# numériques obligatoires et aucune version dupliquée.
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

echo "· seed.sql (compte démo + collection)"
run_sql_file "seed" supabase/seed.sql

echo "· tests d'idempotence des alertes"
run_sql_file "tests d'idempotence des alertes" supabase/tests/alert_idempotency_checks.sql

echo "· tests de comportement (RLS, quota, Platine, storage, purge)"
run_sql_file "tests RLS et comportement" supabase/tests/rls_checks.sql

rm -f "$COMMAND_LOG" "$PLAN_FILE" "$DIAGNOSTIC_FILE"

echo
echo "VALIDATION SQL : PASS"
