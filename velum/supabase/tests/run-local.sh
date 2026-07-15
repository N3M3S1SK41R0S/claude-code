#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Validation SQL locale sans Docker : rejoue TOUTES les migrations VELUM sur un
# PostgreSQL 16 nu (stub des schémas Supabase), puis le seed et les tests de
# comportement (RLS, quota, Platine, Storage, purge RGPD, alertes idempotentes).
#
#   sudo -u postgres bash supabase/tests/run-local.sh
#
# La migration 0002 (pg_cron + pg_net) est la seule exception : ces extensions
# n'existent que sur la plateforme Supabase et sont validées au `db push`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=velum_sql_check
PSQL=(psql -v ON_ERROR_STOP=1 -q -d "$DB")
DIAGNOSTIC_FILE=${VELUM_SQL_DIAGNOSTIC_FILE:-/tmp/velum-sql-diagnostics.log}
COMMAND_LOG=${VELUM_SQL_COMMAND_LOG:-/tmp/velum-sql-command.log}
: >"$DIAGNOSTIC_FILE"

run_sql_file() {
  local label=$1
  local path=$2

  : >"$COMMAND_LOG"
  if ! "${PSQL[@]}" -f "$path" 2>&1 | tee "$COMMAND_LOG"; then
    {
      printf 'Étape SQL en échec : %s\n' "$label"
      printf 'Fichier : %s\n\n' "$path"
      cat "$COMMAND_LOG"
    } >"$DIAGNOSTIC_FILE"
    return 1
  fi
}

# Le plan est testé avant de toucher PostgreSQL : ordre stable, préfixes
# numériques obligatoires et aucune version dupliquée.
bash supabase/tests/migration-plan-test.sh
mapfile -t MIGRATION_PLAN < <(bash supabase/tests/migration-plan.sh supabase/migrations)

dropdb --if-exists "$DB"
createdb "$DB"

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
      echo "Action de migration inconnue : $action" >&2
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

rm -f "$COMMAND_LOG" "$DIAGNOSTIC_FILE"

echo
echo "VALIDATION SQL : PASS"
