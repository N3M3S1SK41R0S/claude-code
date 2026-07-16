#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly DEFAULT_ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
readonly DEFAULT_PROJECT_REF="hbhfwfjdybvsoojvemdv"

log() {
  printf '[velum-deploy] %s\n' "$*"
}

die() {
  printf '[velum-deploy] ERREUR: %s\n' "$*" >&2
  exit 1
}

normalize_bool() {
  case "${1,,}" in
    1|true|yes|on) printf '1' ;;
    0|false|no|off) printf '0' ;;
    *) die "booléen invalide: $1" ;;
  esac
}

require_env() {
  local name="$1"
  local value="${!name-}"
  [[ -n "$value" ]] || die "variable requise absente: $name"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "commande introuvable: $1"
}

start_group() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    printf '::group::%s\n' "$1"
  else
    log "$1"
  fi
}

end_group() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    printf '::endgroup::\n'
  fi
}

ROOT_DIR_INPUT="${VELUM_ROOT:-$DEFAULT_ROOT_DIR}"
[[ -d "$ROOT_DIR_INPUT" ]] || die "racine VELUM introuvable: $ROOT_DIR_INPUT"
readonly ROOT_DIR="$(cd -- "$ROOT_DIR_INPUT" && pwd)"
cd "$ROOT_DIR"
[[ -f supabase/config.toml ]] || die "supabase/config.toml absent de la racine VELUM"

PROJECT_REF="${SUPABASE_PROJECT_REF:-$DEFAULT_PROJECT_REF}"
DEPLOY_DATABASE_BOOL="$(normalize_bool "${DEPLOY_DATABASE:-true}")"
DEPLOY_FUNCTIONS_BOOL="$(normalize_bool "${DEPLOY_FUNCTIONS:-true}")"
DRY_RUN_BOOL="$(normalize_bool "${DRY_RUN:-false}")"
DEPLOY_REF_VALUE="${DEPLOY_REF:-$(git rev-parse HEAD 2>/dev/null || printf 'inconnu')}"

[[ "$PROJECT_REF" =~ ^[a-z0-9]{10,40}$ ]] || die "project ref Supabase invalide"
if [[ "$DEPLOY_DATABASE_BOOL" == "0" && "$DEPLOY_FUNCTIONS_BOOL" == "0" ]]; then
  die "aucune cible sélectionnée (base=false, fonctions=false)"
fi

require_command supabase
require_env SUPABASE_ACCESS_TOKEN
if [[ "$DEPLOY_DATABASE_BOOL" == "1" ]]; then
  require_env SUPABASE_DB_PASSWORD
fi

shopt -s nullglob
function_entrypoints=(supabase/functions/*/index.ts)
shopt -u nullglob
((${#function_entrypoints[@]} > 0)) || die "aucune Edge Function détectée"

expected_functions=()
for entrypoint in "${function_entrypoints[@]}"; do
  function_name="$(basename -- "$(dirname -- "$entrypoint")")"
  [[ "$function_name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "nom de fonction invalide: $function_name"
  expected_functions+=("$function_name")
done
mapfile -t expected_functions < <(printf '%s\n' "${expected_functions[@]}" | LC_ALL=C sort -u)

log "ref=$DEPLOY_REF_VALUE project=$PROJECT_REF database=$DEPLOY_DATABASE_BOOL functions=$DEPLOY_FUNCTIONS_BOOL dry_run=$DRY_RUN_BOOL"
log "Supabase CLI: $(supabase --version)"

if [[ "$DEPLOY_DATABASE_BOOL" == "1" ]]; then
  start_group "Préflight des migrations distantes"
  # SUPABASE_DB_PASSWORD est lu directement par la CLI : il n'apparaît jamais
  # dans la ligne de commande ni dans les journaux Actions.
  supabase link --project-ref "$PROJECT_REF"
  supabase migration list --linked
  supabase db push --linked --dry-run
  end_group

  if [[ "$DRY_RUN_BOOL" == "0" ]]; then
    start_group "Application des migrations"
    # Pas de --include-all, --include-seed ni migration repair automatique : un
    # historique divergent doit bloquer le déploiement et rester visible.
    supabase --yes db push --linked
    supabase migration list --linked
    end_group
  else
    log "dry-run: db push réel ignoré"
  fi
fi

if [[ "$DEPLOY_FUNCTIONS_BOOL" == "1" ]]; then
  start_group "Plan des Edge Functions"
  printf '  - %s\n' "${expected_functions[@]}"
  end_group

  if [[ "$DRY_RUN_BOOL" == "0" ]]; then
    require_command python3
    start_group "Déploiement des Edge Functions"
    # Sans nom explicite, la CLI déploie toutes les fonctions possédant un
    # entrypoint dans supabase/functions et applique leur config.toml.
    supabase functions deploy --project-ref "$PROJECT_REF"
    end_group

    start_group "Vérification de l'inventaire distant"
    inventory_file="$(mktemp)"
    trap 'rm -f "${inventory_file:-}"' EXIT
    supabase --output json functions list --project-ref "$PROJECT_REF" >"$inventory_file"
    python3 - "$inventory_file" "${expected_functions[@]}" <<'PY'
import json
import sys
from pathlib import Path

inventory_path = Path(sys.argv[1])
expected = set(sys.argv[2:])
payload = json.loads(inventory_path.read_text(encoding="utf-8"))

if isinstance(payload, list):
    rows = payload
elif isinstance(payload, dict):
    rows = []
    for key in ("functions", "data", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            rows = value
            break
    if not rows and payload and all(isinstance(value, dict) for value in payload.values()):
        rows = list(payload.values())
else:
    rows = []

remote: set[str] = set()
for row in rows:
    if not isinstance(row, dict):
        continue
    for key in ("name", "slug"):
        value = row.get(key)
        if isinstance(value, str) and value:
            remote.add(value)
            break

missing = sorted(expected - remote)
if missing:
    raise SystemExit("fonctions absentes après déploiement: " + ", ".join(missing))

print(f"Inventaire distant validé: {len(expected)} fonction(s) attendue(s).")
PY
    rm -f "$inventory_file"
    trap - EXIT
    end_group
  else
    log "dry-run: functions deploy ignoré"
  fi
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '## Déploiement Supabase VELUM\n\n'
    printf -- '- Référence: `%s`\n' "$DEPLOY_REF_VALUE"
    printf -- '- Projet: `%s`\n' "$PROJECT_REF"
    printf -- '- Base de données: `%s`\n' "$([[ "$DEPLOY_DATABASE_BOOL" == "1" ]] && printf 'oui' || printf 'non')"
    printf -- '- Edge Functions: `%s`\n' "$([[ "$DEPLOY_FUNCTIONS_BOOL" == "1" ]] && printf 'oui' || printf 'non')"
    printf -- '- Dry-run: `%s`\n' "$([[ "$DRY_RUN_BOOL" == "1" ]] && printf 'oui' || printf 'non')"
    if [[ "$DEPLOY_FUNCTIONS_BOOL" == "1" ]]; then
      printf '\nFonctions attendues: `%s`\n' "$(IFS=,; printf '%s' "${expected_functions[*]}")"
    fi
  } >>"$GITHUB_STEP_SUMMARY"
fi

log "déploiement terminé"
