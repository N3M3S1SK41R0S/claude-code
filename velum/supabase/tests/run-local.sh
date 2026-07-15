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

# Le plan est testé avant de toucher PostgreSQL : ordre stable, préfixes
# numériques obligatoires et aucune version dupliquée.
bash supabase/tests/migration-plan-test.sh
mapfile -t MIGRATION_PLAN < <(bash supabase/tests/migration-plan.sh supabase/migrations)

dropdb --if-exists "$DB"
createdb "$DB"

echo "· stub Supabase (auth/storage/rôles)"
"${PSQL[@]}" -f supabase/tests/supabase_stub.sql

for plan_entry in "${MIGRATION_PLAN[@]}"; do
  IFS=$'\t' read -r action migration_path <<<"$plan_entry"
  migration_name=${migration_path##*/}

  case "$action" in
    apply)
      echo "· migration $migration_name"
      "${PSQL[@]}" -f "$migration_path"
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
"${PSQL[@]}" -f supabase/seed.sql

echo "· tests d'idempotence des alertes"
"${PSQL[@]}" -f supabase/tests/alert_idempotency_checks.sql

echo "· tests de comportement (RLS, quota, Platine, storage, purge)"
"${PSQL[@]}" -f supabase/tests/rls_checks.sql

echo
echo "VALIDATION SQL : PASS"
