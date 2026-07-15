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
expected=$(printf '%s\n' \
  "apply${IFS:0:1}$TMP_DIR/valid/0001_init.sql" \
  "skip${IFS:0:1}$TMP_DIR/valid/0002_cron.sql" \
  "apply${IFS:0:1}$TMP_DIR/valid/0003_market.sql" \
  "apply${IFS:0:1}$TMP_DIR/valid/20260715090000_alerts.sql")

# IFS n'est pas garanti de commencer par une tabulation ; reconstruire
# explicitement l'attendu au format du plan.
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

mkdir -p "$TMP_DIR/invalid"
touch "$TMP_DIR/invalid/not_a_version.sql"
if bash "$PLAN_SCRIPT" "$TMP_DIR/invalid" >"$TMP_DIR/invalid.out" 2>"$TMP_DIR/invalid.err"; then
  echo "Un nom sans préfixe numérique a été accepté" >&2
  exit 1
fi
grep -F "préfixe numérique requis" "$TMP_DIR/invalid.err" >/dev/null

mkdir -p "$TMP_DIR/empty"
if bash "$PLAN_SCRIPT" "$TMP_DIR/empty" >"$TMP_DIR/empty.out" 2>"$TMP_DIR/empty.err"; then
  echo "Un répertoire vide a été accepté" >&2
  exit 1
fi
grep -F "Aucune migration SQL trouvée" "$TMP_DIR/empty.err" >/dev/null

echo "MIGRATION PLAN TESTS : PASS"
