#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Validation SQL locale sans Docker : rejoue les migrations VELUM sur un
# PostgreSQL 16 nu (stub des schémas Supabase), puis le seed et les tests de
# comportement (RLS, quota hebdo/module, Platine, storage, purge RGPD).
#
#   sudo -u postgres bash supabase/tests/run-local.sh
#
# NOTE : la migration 0002 (pg_cron + pg_net) est volontairement SAUTÉE ici —
# ces extensions n'existent que sur la plateforme Supabase. Elle est validée
# au déploiement (`supabase db push`).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=velum_sql_check
PSQL=(psql -v ON_ERROR_STOP=1 -q -d "$DB")

dropdb --if-exists "$DB"
createdb "$DB"

echo "· stub Supabase (auth/storage/rôles)"
"${PSQL[@]}" -f supabase/tests/supabase_stub.sql

echo "· migration 0001_init.sql"
"${PSQL[@]}" -f supabase/migrations/0001_init.sql

echo "· migration 0002_cron.sql — SAUTÉE (pg_cron/pg_net = plateforme Supabase)"

echo "· migration 0003_marketplace_platine.sql"
"${PSQL[@]}" -f supabase/migrations/0003_marketplace_platine.sql

echo "· seed.sql (compte démo + collection)"
"${PSQL[@]}" -f supabase/seed.sql

echo "· tests de comportement (RLS, quota, Platine, storage, purge)"
"${PSQL[@]}" -f supabase/tests/rls_checks.sql

echo
echo "VALIDATION SQL : PASS"
