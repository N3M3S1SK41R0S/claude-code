#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PLAN_SCRIPT="$SCRIPT_DIR/migration-plan.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/valid"
touch \
  "$TMP_DIR/valid/0003_market.sql" \
  "$TMP_DIR/valid/0001_init.sql" \
  "$TMP_DIR/valid/20260715090000_alerts.sql" \
  "$TMP_DIR/valid/0002_cron.sql"

actual=$(bash "$PLAN_SCRIPT" "$TMP_DIR/valid")
expected=$(printf 'apply\t%s\nskip\t%s\napply\t%s\napply\t%s' \
  "$TMP_DIR/valid/0001_init.sql" \
  "$TMP_DIR/valid/0002_cron.sql" \
  "$TMP_DIR/valid/0003_market.sql" \
  "$TMP_DIR/valid/20260715090000_alerts.sql")

if [[ "$actual" != "$expected" ]]; then
  echo "Plan de migrations inattendu" >&2
  diff -u <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
  exit 1
fi

mkdir -p "$TMP_DIR/duplicate"
touch "$TMP_DIR/duplicate/0007_first.sql" "$TMP_DIR/duplicate/0007_second.sql"
if bash "$PLAN_SCRIPT" "$TMP_DIR/duplicate" >"$TMP_DIR/duplicate.out" 2>"$TMP_DIR/duplicate.err"; then
  echo "Une version dupliquée a été acceptée" >&2
  exit 1
fi
grep -F "Version de migration dupliquée 0007" "$TMP_DIR/duplicate.err" >/dev/null

mkdir -p "$TMP_DIR/invalid-name"
touch "$TMP_DIR/invalid-name/not_a_version.sql"
if bash "$PLAN_SCRIPT" "$TMP_DIR/invalid-name" >"$TMP_DIR/invalid-name.out" 2>"$TMP_DIR/invalid-name.err"; then
  echo "Un nom sans version a été accepté" >&2
  exit 1
fi
grep -F "version sur 4 ou 14 chiffres requise" "$TMP_DIR/invalid-name.err" >/dev/null

mkdir -p "$TMP_DIR/invalid-width"
touch "$TMP_DIR/invalid-width/010_short.sql"
if bash "$PLAN_SCRIPT" "$TMP_DIR/invalid-width" >"$TMP_DIR/invalid-width.out" 2>"$TMP_DIR/invalid-width.err"; then
  echo "Une version de largeur ambiguë a été acceptée" >&2
  exit 1
fi
grep -F "version sur 4 ou 14 chiffres requise" "$TMP_DIR/invalid-width.err" >/dev/null

mkdir -p "$TMP_DIR/empty"
if bash "$PLAN_SCRIPT" "$TMP_DIR/empty" >"$TMP_DIR/empty.out" 2>"$TMP_DIR/empty.err"; then
  echo "Un répertoire vide a été accepté" >&2
  exit 1
fi
grep -F "Aucune migration SQL trouvée" "$TMP_DIR/empty.err" >/dev/null

echo "MIGRATION PLAN TESTS : PASS"
