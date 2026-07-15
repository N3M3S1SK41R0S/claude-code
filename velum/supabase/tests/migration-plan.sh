#!/usr/bin/env bash
# Produit le plan de migrations SQL locales et refuse les versions ambiguës.
# Format de sortie : <apply|skip><TAB><chemin>.
set -euo pipefail

MIGRATIONS_DIR=${1:-supabase/migrations}
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Répertoire de migrations introuvable : $MIGRATIONS_DIR" >&2
  exit 1
fi

shopt -s nullglob
migration_files=("$MIGRATIONS_DIR"/*.sql)
if (( ${#migration_files[@]} == 0 )); then
  echo "Aucune migration SQL trouvée dans $MIGRATIONS_DIR" >&2
  exit 1
fi

mapfile -t migration_files < <(printf '%s\n' "${migration_files[@]}" | LC_ALL=C sort)
declare -A filename_by_version=()

for migration_path in "${migration_files[@]}"; do
  filename=${migration_path##*/}
  # VELUM historique : 0001, 0002… ; Supabase CLI moderne : timestamp 14 chiffres.
  # Toute autre largeur rendrait le tri lexical potentiellement différent de
  # l'ordre numérique et est donc refusée.
  if [[ ! "$filename" =~ ^([0-9]{4}|[0-9]{14})_.+\.sql$ ]]; then
    echo \
      "Nom de migration invalide (version sur 4 ou 14 chiffres requise) : $filename" \
      >&2
    exit 1
  fi

  version=${BASH_REMATCH[1]}
  if [[ -n ${filename_by_version[$version]+present} ]]; then
    echo \
      "Version de migration dupliquée $version : ${filename_by_version[$version]} et $filename" \
      >&2
    exit 1
  fi
  filename_by_version[$version]=$filename

  # 0002 dépend de pg_cron et pg_net, extensions disponibles uniquement sur la
  # plateforme Supabase. Toutes les autres migrations doivent tourner sur le
  # PostgreSQL nu de la CI ; un oubli n'est plus possible.
  if [[ "$version" == "0002" ]]; then
    printf 'skip\t%s\n' "$migration_path"
  else
    printf 'apply\t%s\n' "$migration_path"
  fi
done
