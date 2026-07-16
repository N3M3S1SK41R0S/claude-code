#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
readonly TARGET="$SCRIPT_DIR/deploy-supabase.sh"
readonly PROJECT_REF="hbhfwfjdybvsoojvemdv"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/bin"

cat >"$TMP_DIR/bin/supabase" <<'FAKE'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"$FAKE_CALL_LOG"

if [[ "${1:-}" == "--version" ]]; then
  printf '2.109.1\n'
  exit 0
fi

if [[ "$*" == "--output json functions list --project-ref "* ]]; then
  cat "$FAKE_INVENTORY"
fi
FAKE
chmod +x "$TMP_DIR/bin/supabase"

python3 - "$ROOT_DIR" >"$TMP_DIR/inventory.json" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
names = sorted(path.parent.name for path in (root / "supabase" / "functions").glob("*/index.ts"))
if not names:
    raise SystemExit("aucune fonction détectée dans le fixture réel")
print(json.dumps([{"name": name} for name in names]))
PY

base_env=(
  "PATH=$TMP_DIR/bin:$PATH"
  "FAKE_INVENTORY=$TMP_DIR/inventory.json"
  "SUPABASE_ACCESS_TOKEN=test-access-token"
  "SUPABASE_DB_PASSWORD=test-db-password"
  "SUPABASE_PROJECT_REF=$PROJECT_REF"
  "DEPLOY_REF=test-sha"
)

assert_calls() {
  local file="$1"
  shift
  python3 - "$file" "$@" <<'PY'
import sys
from pathlib import Path

actual = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
expected = sys.argv[2:]
if actual != expected:
    raise SystemExit(f"appels inattendus\nattendu={expected!r}\nactuel={actual!r}")
PY
}

# Déploiement complet : dry-run DB, push DB, déploiement de toutes les fonctions,
# puis inventaire distant. Les secrets restent uniquement dans l'environnement.
full_calls="$TMP_DIR/full.calls"
: >"$full_calls"
env "${base_env[@]}" \
  "FAKE_CALL_LOG=$full_calls" \
  "GITHUB_STEP_SUMMARY=$TMP_DIR/summary.md" \
  DEPLOY_DATABASE=true DEPLOY_FUNCTIONS=true DRY_RUN=false \
  bash "$TARGET" >"$TMP_DIR/full.out"

assert_calls "$full_calls" \
  "--version" \
  "link --project-ref $PROJECT_REF" \
  "migration list --linked" \
  "db push --linked --dry-run" \
  "--yes db push --linked" \
  "migration list --linked" \
  "functions deploy --project-ref $PROJECT_REF" \
  "--output json functions list --project-ref $PROJECT_REF"

grep -Fq 'Inventaire distant validé' "$TMP_DIR/full.out"
grep -Fq 'Dry-run: `non`' "$TMP_DIR/summary.md"

# Dry-run : aucune mutation de base ni déploiement de fonction.
dry_calls="$TMP_DIR/dry.calls"
: >"$dry_calls"
env "${base_env[@]}" \
  "FAKE_CALL_LOG=$dry_calls" \
  DEPLOY_DATABASE=true DEPLOY_FUNCTIONS=true DRY_RUN=true \
  bash "$TARGET" >"$TMP_DIR/dry.out"

assert_calls "$dry_calls" \
  "--version" \
  "link --project-ref $PROJECT_REF" \
  "migration list --linked" \
  "db push --linked --dry-run"

grep -Fq 'dry-run: db push réel ignoré' "$TMP_DIR/dry.out"
grep -Fq 'dry-run: functions deploy ignoré' "$TMP_DIR/dry.out"

# Déploiement fonctions uniquement : aucun mot de passe DB requis.
functions_calls="$TMP_DIR/functions.calls"
: >"$functions_calls"
env \
  "PATH=$TMP_DIR/bin:$PATH" \
  "FAKE_INVENTORY=$TMP_DIR/inventory.json" \
  "FAKE_CALL_LOG=$functions_calls" \
  SUPABASE_ACCESS_TOKEN=test-access-token \
  SUPABASE_PROJECT_REF="$PROJECT_REF" \
  DEPLOY_DATABASE=false DEPLOY_FUNCTIONS=true DRY_RUN=false \
  bash "$TARGET" >"$TMP_DIR/functions.out"

assert_calls "$functions_calls" \
  "--version" \
  "functions deploy --project-ref $PROJECT_REF" \
  "--output json functions list --project-ref $PROJECT_REF"

# Inventaire incomplet : le déploiement est déclaré en échec.
python3 - "$TMP_DIR/inventory.json" >"$TMP_DIR/inventory-missing.json" <<'PY'
import json
import sys
from pathlib import Path

rows = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(json.dumps(rows[1:]))
PY
missing_calls="$TMP_DIR/missing.calls"
: >"$missing_calls"
if env \
  "PATH=$TMP_DIR/bin:$PATH" \
  "FAKE_INVENTORY=$TMP_DIR/inventory-missing.json" \
  "FAKE_CALL_LOG=$missing_calls" \
  SUPABASE_ACCESS_TOKEN=test-access-token \
  SUPABASE_PROJECT_REF="$PROJECT_REF" \
  DEPLOY_DATABASE=false DEPLOY_FUNCTIONS=true DRY_RUN=false \
  bash "$TARGET" >"$TMP_DIR/missing.out" 2>"$TMP_DIR/missing.err"; then
  printf 'un inventaire incomplet aurait dû échouer\n' >&2
  exit 1
fi
grep -Fq 'fonctions absentes après déploiement' "$TMP_DIR/missing.err"

# Secret absent : échec avant tout appel CLI.
secret_calls="$TMP_DIR/secret.calls"
: >"$secret_calls"
if env \
  "PATH=$TMP_DIR/bin:$PATH" \
  "FAKE_INVENTORY=$TMP_DIR/inventory.json" \
  "FAKE_CALL_LOG=$secret_calls" \
  SUPABASE_PROJECT_REF="$PROJECT_REF" \
  DEPLOY_DATABASE=false DEPLOY_FUNCTIONS=true DRY_RUN=false \
  bash "$TARGET" >"$TMP_DIR/secret.out" 2>"$TMP_DIR/secret.err"; then
  printf 'un access token absent aurait dû échouer\n' >&2
  exit 1
fi
[[ ! -s "$secret_calls" ]]
grep -Fq 'SUPABASE_ACCESS_TOKEN' "$TMP_DIR/secret.err"

printf 'TESTS DÉPLOIEMENT SUPABASE : PASS\n'
