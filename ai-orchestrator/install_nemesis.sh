#!/bin/bash
# =============================================================================
# NEMESIS - Installation automatique complète (Linux/macOS)
# Neural Expert Multi-agent Efficient System for Integrated Solutions
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
NEMESIS_DIR="$HOME/claude-code/ai-orchestrator"
CONFIG_DIR="$HOME/.config/nemesis"
DATA_DIR="$HOME/.local/share/nemesis"
LOG_DIR="$HOME/.local/share/nemesis/logs"
RESULTS_DIR="$HOME/nemesis_results"

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)     INSTALL_DIR="/usr/local/bin"; SHELL_RC="$HOME/.bashrc";;
    Darwin*)    INSTALL_DIR="/usr/local/bin"; SHELL_RC="$HOME/.zshrc";;
    *)          echo "OS non supporté: $OS"; exit 1;;
esac

# Use zshrc if it exists
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║   🚀 NEMESIS v2.0 - Installation Automatique                    ║"
echo "║                                                                  ║"
echo "║   Neural Expert Multi-agent Efficient System                    ║"
echo "║   for Integrated Solutions                                       ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Vérifications préliminaires
# =============================================================================
echo -e "\n${YELLOW}[1/7] Vérifications préliminaires...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 non trouvé. Installe-le d'abord.${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "   ✅ Python $PYTHON_VERSION trouvé"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 non trouvé. Installe-le d'abord.${NC}"
    exit 1
fi
echo -e "   ✅ pip3 trouvé"

# Check NEMESIS directory
if [ ! -d "$NEMESIS_DIR" ]; then
    echo -e "${RED}❌ Répertoire NEMESIS non trouvé: $NEMESIS_DIR${NC}"
    echo -e "   Clone d'abord le repo: git clone https://github.com/N3M3S1SK41R0S/claude-code.git ~/claude-code"
    exit 1
fi
echo -e "   ✅ Répertoire NEMESIS trouvé"

# =============================================================================
# 2. Créer les répertoires
# =============================================================================
echo -e "\n${YELLOW}[2/7] Création des répertoires...${NC}"

mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$RESULTS_DIR"

echo -e "   ✅ $CONFIG_DIR"
echo -e "   ✅ $DATA_DIR"
echo -e "   ✅ $LOG_DIR"
echo -e "   ✅ $RESULTS_DIR"

# =============================================================================
# 3. Créer le fichier de configuration
# =============================================================================
echo -e "\n${YELLOW}[3/7] Création de la configuration...${NC}"

cat > "$CONFIG_DIR/config.yaml" << 'EOF'
# =============================================================================
# NEMESIS Configuration - Fichier utilisateur
# =============================================================================

nemesis:
  version: "2.0.0"
  environment: production

# Mode par défaut
defaults:
  mode: auto           # auto, semi-auto, manual
  rounds: 1            # Nombre de rounds d'analyse
  timeout: 300         # Timeout en secondes
  headless: false      # Mode sans interface

# Navigateur
browser:
  type: chrome         # chrome, firefox, edge
  profile: default     # Profil à utiliser

# Répertoires
paths:
  results: ~/nemesis_results
  cache: ~/.local/share/nemesis/cache
  logs: ~/.local/share/nemesis/logs

# Agents IA à utiliser
agents:
  enabled:
    - claude
    - chatgpt
    - gemini
    - mistral
    - perplexity
    - deepseek
    - grok

  urls:
    claude: https://claude.ai/new
    chatgpt: https://chat.openai.com/
    gemini: https://gemini.google.com/
    mistral: https://chat.mistral.ai/
    perplexity: https://www.perplexity.ai/
    deepseek: https://chat.deepseek.com/
    grok: https://grok.x.ai/

# Service HTTP local
server:
  enabled: true
  host: 127.0.0.1
  port: 8765

# MCP Server
mcp:
  enabled: true
  auto_start: false

# Logging
logging:
  level: INFO
  file: ~/.local/share/nemesis/logs/nemesis.log
  max_size_mb: 10
  backup_count: 5
EOF

echo -e "   ✅ Configuration créée: $CONFIG_DIR/config.yaml"

# =============================================================================
# 4. Créer le wrapper exécutable
# =============================================================================
echo -e "\n${YELLOW}[4/7] Création du wrapper exécutable...${NC}"

# Créer le script wrapper
cat > "/tmp/nemesis_wrapper" << EOF
#!/bin/bash
# NEMESIS CLI Wrapper
# Auto-generated by install_nemesis.sh

export NEMESIS_HOME="$NEMESIS_DIR"
export NEMESIS_CONFIG="$CONFIG_DIR/config.yaml"
export NEMESIS_DATA="$DATA_DIR"
export NEMESIS_RESULTS="$RESULTS_DIR"

python3 "\$NEMESIS_HOME/nemesis.py" "\$@"
EOF

# Installer avec sudo si nécessaire
if [ -w "$INSTALL_DIR" ]; then
    cp /tmp/nemesis_wrapper "$INSTALL_DIR/nemesis"
    chmod +x "$INSTALL_DIR/nemesis"
else
    echo -e "   ${YELLOW}Mot de passe sudo requis pour installer dans $INSTALL_DIR${NC}"
    sudo cp /tmp/nemesis_wrapper "$INSTALL_DIR/nemesis"
    sudo chmod +x "$INSTALL_DIR/nemesis"
fi

rm /tmp/nemesis_wrapper
echo -e "   ✅ Wrapper installé: $INSTALL_DIR/nemesis"

# =============================================================================
# 5. Ajouter les aliases au shell
# =============================================================================
echo -e "\n${YELLOW}[5/7] Configuration des aliases shell...${NC}"

if ! grep -q "NEMESIS aliases" "$SHELL_RC" 2>/dev/null; then
    cat >> "$SHELL_RC" << 'EOF'

# =============================================================================
# NEMESIS aliases and environment
# =============================================================================
export NEMESIS_CONFIG="$HOME/.config/nemesis/config.yaml"
export NEMESIS_RESULTS="$HOME/nemesis_results"

# Quick commands
alias nq='nemesis run --quick'           # Analyse rapide (1 round)
alias nr='nemesis run --rounds 3'        # Analyse approfondie (3 rounds)
alias ns='nemesis stats'                 # Statistiques
alias nh='nemesis history'               # Historique
alias nv='nemesis verify'                # Vérifier du code
alias nm='nemesis memory stats'          # Stats mémoire

# Raccourcis pratiques
alias nemesis-server='nemesis server start'
alias nemesis-stop='nemesis server stop'
alias nemesis-logs='tail -f ~/.local/share/nemesis/logs/nemesis.log'

# Fonction pour analyse rapide depuis pipe
nanalyze() {
    if [ -p /dev/stdin ]; then
        cat | nemesis run --stdin "$@"
    else
        nemesis run "$@"
    fi
}
EOF
    echo -e "   ✅ Aliases ajoutés à $SHELL_RC"
else
    echo -e "   ⏭️  Aliases déjà présents dans $SHELL_RC"
fi

# =============================================================================
# 6. Installer les dépendances Python
# =============================================================================
echo -e "\n${YELLOW}[6/7] Installation des dépendances Python...${NC}"

pip3 install --user --quiet \
    flask \
    flask-cors \
    pyyaml \
    pyperclip \
    requests \
    cryptography \
    2>/dev/null || true

echo -e "   ✅ Dépendances Python installées"

# =============================================================================
# 7. Configuration du service daemon (optionnel)
# =============================================================================
echo -e "\n${YELLOW}[7/7] Configuration du service daemon...${NC}"

if command -v systemctl &> /dev/null && [ "$OS" = "Linux" ]; then
    echo -e "   ${BLUE}Veux-tu installer le service daemon systemd ?${NC}"
    echo -e "   Cela permet de lancer NEMESIS au démarrage et d'utiliser l'API HTTP."
    read -p "   Installer le daemon (y/N)? " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Créer le fichier service
        sudo tee /etc/systemd/system/nemesis.service > /dev/null << EOF
[Unit]
Description=NEMESIS Multi-AI Orchestration Service
Documentation=https://github.com/N3M3S1SK41R0S/claude-code
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$NEMESIS_DIR
Environment="NEMESIS_CONFIG=$CONFIG_DIR/config.yaml"
Environment="NEMESIS_DATA=$DATA_DIR"
ExecStart=/usr/bin/python3 $NEMESIS_DIR/nemesis_server.py
Restart=on-failure
RestartSec=10
StandardOutput=append:$LOG_DIR/server.log
StandardError=append:$LOG_DIR/server.error.log

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable nemesis.service
        sudo systemctl start nemesis.service

        echo -e "   ✅ Service daemon installé et démarré"
        echo -e "   📡 API disponible sur http://localhost:8765"
    else
        echo -e "   ⏭️  Service daemon non installé"
    fi
elif [ "$OS" = "Darwin" ]; then
    echo -e "   ${BLUE}Veux-tu créer un LaunchAgent pour macOS ?${NC}"
    read -p "   Créer le LaunchAgent (y/N)? " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PLIST_DIR="$HOME/Library/LaunchAgents"
        mkdir -p "$PLIST_DIR"

        cat > "$PLIST_DIR/com.nemesis.server.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nemesis.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$NEMESIS_DIR/nemesis_server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$NEMESIS_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NEMESIS_CONFIG</key>
        <string>$CONFIG_DIR/config.yaml</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/server.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/server.error.log</string>
</dict>
</plist>
EOF

        launchctl load "$PLIST_DIR/com.nemesis.server.plist"
        echo -e "   ✅ LaunchAgent créé et chargé"
    fi
else
    echo -e "   ⏭️  Daemon non supporté sur ce système"
fi

# =============================================================================
# Fin de l'installation
# =============================================================================
echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║   ✅ INSTALLATION TERMINÉE !                                    ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📋 Utilisation:${NC}"
echo ""
echo "  # Analyse simple"
echo "  nemesis run \"Explique-moi les microservices\""
echo ""
echo "  # Analyse d'un fichier"
echo "  nemesis run --file architecture.md"
echo ""
echo "  # Analyse rapide (1 round)"
echo "  nq \"Question rapide\""
echo ""
echo "  # Analyse approfondie (3 rounds)"
echo "  nr \"Analyse complexe\""
echo ""
echo "  # Depuis un pipe"
echo "  cat code.py | nemesis run --stdin"
echo ""
echo "  # Vérifier du code"
echo "  nemesis verify --file script.py"
echo ""
echo "  # Statistiques"
echo "  nemesis stats"
echo ""

echo -e "${YELLOW}⚠️  N'oublie pas de recharger ton shell:${NC}"
echo "  source $SHELL_RC"
echo ""
echo -e "${GREEN}🎉 NEMESIS est prêt !${NC}"
