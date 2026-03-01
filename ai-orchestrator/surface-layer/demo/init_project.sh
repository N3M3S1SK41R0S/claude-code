#!/bin/bash
# =============================================================================
# NEMESIS Surface Layer — Project Initializer
# Crée la structure d'un nouveau projet avec project.yaml + channel Slack
#
# Usage:
#   ./init_project.sh <project_id> <project_name> [slack_token]
#
# Exemple:
#   ./init_project.sh gachet "Restructuration Gachet" xoxb-xxx
# =============================================================================

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <project_id> <project_name> [slack_token]}"
PROJECT_NAME="${2:?Usage: $0 <project_id> <project_name> [slack_token]}"
SLACK_TOKEN="${3:-}"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SURFACE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECTS_DIR="${NEMESIS_PROJECTS_DIR:-/data/nemesis/projects}"
PROJECT_DIR="${PROJECTS_DIR}/${PROJECT_ID}"

echo "═══════════════════════════════════════════════════════"
echo "  NEMESIS Surface Layer — Initialisation Projet"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Project ID   : ${PROJECT_ID}"
echo "  Project Name : ${PROJECT_NAME}"
echo "  Directory    : ${PROJECT_DIR}"
echo ""

# 1. Create project directory
echo "[1/5] Création du répertoire projet..."
mkdir -p "${PROJECT_DIR}/output"
mkdir -p "${PROJECT_DIR}/documents"
mkdir -p "${PROJECT_DIR}/reports"

# 2. Copy and customize project.yaml template
echo "[2/5] Génération du project.yaml..."
TEMPLATE="${SURFACE_DIR}/memory/project_template.yaml"

if [ ! -f "$TEMPLATE" ]; then
    echo "ERREUR: Template non trouvé: $TEMPLATE"
    exit 1
fi

YAML_FILE="${PROJECT_DIR}/project.yaml"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Copy template and replace placeholders
cp "$TEMPLATE" "$YAML_FILE"

# Replace key fields using sed
sed -i "s|id: \"\"|id: \"PRJ-${PROJECT_ID^^}-$(date +%Y)\"|" "$YAML_FILE"
sed -i "s|name: \"\"|name: \"${PROJECT_NAME}\"|" "$YAML_FILE"
sed -i "s|created_at: \"\"|created_at: \"${TIMESTAMP}\"|" "$YAML_FILE"
sed -i "s|updated_at: \"\"|updated_at: \"${TIMESTAMP}\"|" "$YAML_FILE"
sed -i "s|channel_name: \"\"|channel_name: \"#projet-${PROJECT_ID}\"|" "$YAML_FILE"

echo "  → ${YAML_FILE}"

# 3. Initialize git tracking for the project
echo "[3/5] Initialisation Git..."
cd "$PROJECT_DIR"
if [ ! -d ".git" ]; then
    git init -q
    git add project.yaml
    git commit -q -m "init: Projet ${PROJECT_NAME} — NEMESIS Surface Layer"
    echo "  → Repo Git initialisé"
else
    echo "  → Repo Git existant"
fi

# 4. Create Slack channel (if token provided)
if [ -n "$SLACK_TOKEN" ]; then
    echo "[4/5] Création du channel Slack..."
    python3 "${SURFACE_DIR}/slack/init_channels.py" \
        --token "$SLACK_TOKEN" \
        --project "$PROJECT_ID" \
        --project-name "$PROJECT_NAME"
else
    echo "[4/5] Slack: ignoré (pas de token fourni)"
fi

# 5. Summary
echo ""
echo "[5/5] Projet initialisé avec succès!"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Structure créée:"
echo "  ├── ${PROJECT_DIR}/"
echo "  │   ├── project.yaml"
echo "  │   ├── output/"
echo "  │   ├── documents/"
echo "  │   ├── reports/"
echo "  │   └── .git/"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Prochaines étapes:"
echo "  1. Éditer project.yaml avec les infos client"
echo "  2. Configurer NEMESIS_CHANNEL_MAP dans .env N8N"
echo "  3. Importer les workflows N8N (surface-layer/n8n-workflows/)"
echo "  4. Lancer la démo: python demo/demo_workflow.py --project ${PROJECT_ID}"
echo ""
