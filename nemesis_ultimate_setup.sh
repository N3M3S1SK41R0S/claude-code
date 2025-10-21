#!/bin/bash

################################################################################
#                    NEMESIS ULTIMATE SETUP SCRIPT V3.0                        #
#                    Installation Complète Automatique                         #
#                    Ubuntu 20.04+ | Edge + MCP + Full Stack                   #
################################################################################

set -e  # Exit on error
trap 'handle_error $? $LINENO' ERR

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Fichiers de log
LOG_DIR="$HOME/nemesis_logs"
INSTALL_LOG="$LOG_DIR/install_$(date +%Y%m%d_%H%M%S).log"
ERROR_LOG="$LOG_DIR/errors_$(date +%Y%m%d_%H%M%S).log"

# Répertoires
NEMESIS_HOME="$HOME/.nemesis"
WORKSPACE_DIR="$NEMESIS_HOME/workspace"
MCP_DIR="$NEMESIS_HOME/mcp"
CONFIGS_DIR="$NEMESIS_HOME/configs"
SCRIPTS_DIR="$NEMESIS_HOME/scripts"

# Variables de version
NODE_VERSION="20"
PYTHON_VERSION="3.11"

################################################################################
# FONCTIONS UTILITAIRES
################################################################################

print_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

    🚀 NEMESIS ULTIMATE SETUP V3.0 - Installation Automatique
    📦 Edge + MCP + Full Infrastructure + Auto-Repair

EOF
    echo -e "${NC}"
}

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" | tee -a "$INSTALL_LOG"

    case $level in
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            echo "[$timestamp] $message" >> "$ERROR_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "STEP")
            echo -e "${MAGENTA}🔧 $message${NC}"
            ;;
    esac
}

handle_error() {
    local exit_code=$1
    local line_number=$2
    log "ERROR" "Erreur détectée (code: $exit_code) à la ligne $line_number"
    log "INFO" "Tentative de récupération automatique..."

    # Auto-réparation basique
    if [[ $exit_code -eq 100 ]]; then
        log "INFO" "Erreur réseau - Retry dans 5 secondes..."
        sleep 5
        return 0
    fi

    log "ERROR" "Impossible de récupérer automatiquement. Consultez $ERROR_LOG"
    read -p "Voulez-vous continuer l'installation ? (o/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        exit 1
    fi
}

check_sudo() {
    if [[ $EUID -ne 0 ]]; then
        log "INFO" "Ce script nécessite les droits sudo pour certaines opérations"
        sudo -v
        # Garde sudo actif en arrière-plan
        while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
    fi
}

create_directories() {
    log "STEP" "Création de la structure de répertoires NEMESIS..."

    mkdir -p "$LOG_DIR"
    mkdir -p "$NEMESIS_HOME"/{workspace,mcp,configs,scripts,data,backups}
    mkdir -p "$MCP_DIR"/{servers,configs,logs}
    mkdir -p "$WORKSPACE_DIR"/{html,assets,data}

    log "SUCCESS" "Structure de répertoires créée"
}

################################################################################
# INSTALLATION DES DÉPENDANCES SYSTÈME
################################################################################

install_system_dependencies() {
    log "STEP" "Installation des dépendances système..."

    # Mise à jour des paquets
    sudo apt-get update -qq || exit 100

    # Installation des outils essentiels
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        jq \
        unzip \
        zip \
        vim \
        nano \
        htop \
        tmux \
        net-tools \
        dnsutils \
        iputils-ping \
        || log "WARNING" "Certains paquets n'ont pas pu être installés"

    log "SUCCESS" "Dépendances système installées"
}

################################################################################
# INSTALLATION DE MICROSOFT EDGE
################################################################################

install_microsoft_edge() {
    log "STEP" "Installation de Microsoft Edge..."

    # Vérifier si Edge est déjà installé
    if command -v microsoft-edge &> /dev/null; then
        log "INFO" "Microsoft Edge est déjà installé"
        return 0
    fi

    # Ajouter la clé GPG de Microsoft
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft-edge.gpg > /dev/null

    # Ajouter le dépôt Edge
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | sudo tee /etc/apt/sources.list.d/microsoft-edge.list

    # Installer Edge
    sudo apt-get update -qq
    sudo apt-get install -y microsoft-edge-stable

    log "SUCCESS" "Microsoft Edge installé avec succès"
}

configure_edge() {
    log "STEP" "Configuration optimale de Microsoft Edge..."

    # Créer le répertoire de configuration Edge
    EDGE_CONFIG_DIR="$HOME/.config/microsoft-edge/Default"
    mkdir -p "$EDGE_CONFIG_DIR"

    # Configuration des préférences Edge (JSON)
    cat > "$EDGE_CONFIG_DIR/Preferences" << 'EOF'
{
   "browser": {
      "show_home_button": true,
      "check_default_browser": false
   },
   "homepage": "file://'$WORKSPACE_DIR'/html/nemesis_workspace.html",
   "homepage_is_newtabpage": false,
   "session": {
      "restore_on_startup": 4,
      "startup_urls": ["file://'$WORKSPACE_DIR'/html/nemesis_workspace.html"]
   },
   "profile": {
      "default_content_setting_values": {
         "notifications": 1
      }
   },
   "download": {
      "default_directory": "'$HOME'/Downloads",
      "prompt_for_download": false
   }
}
EOF

    # Script de lancement Edge personnalisé
    cat > "$SCRIPTS_DIR/launch_edge_nemesis.sh" << 'EOF'
#!/bin/bash
microsoft-edge \
    --new-window \
    --start-maximized \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    "file://'$WORKSPACE_DIR'/html/nemesis_workspace.html" \
    > /dev/null 2>&1 &
EOF

    chmod +x "$SCRIPTS_DIR/launch_edge_nemesis.sh"

    log "SUCCESS" "Microsoft Edge configuré pour NEMESIS"
}

################################################################################
# INSTALLATION NODE.JS
################################################################################

install_nodejs() {
    log "STEP" "Installation de Node.js ${NODE_VERSION}..."

    if command -v node &> /dev/null; then
        local current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $current_version -ge $NODE_VERSION ]]; then
            log "INFO" "Node.js $(node --version) déjà installé"
            return 0
        fi
    fi

    # Installation via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Installer pnpm et yarn
    sudo npm install -g pnpm yarn

    log "SUCCESS" "Node.js $(node --version) installé"
}

################################################################################
# INSTALLATION PYTHON
################################################################################

install_python() {
    log "STEP" "Installation de Python ${PYTHON_VERSION}..."

    if command -v python3 &> /dev/null; then
        log "INFO" "Python $(python3 --version) déjà installé"
    else
        sudo apt-get install -y python3 python3-pip python3-venv
    fi

    # Installer pipx pour outils CLI
    python3 -m pip install --user pipx
    python3 -m pipx ensurepath

    log "SUCCESS" "Python installé"
}

################################################################################
# INSTALLATION DES SERVEURS MCP
################################################################################

install_mcp_infrastructure() {
    log "STEP" "Installation de l'infrastructure MCP..."

    cd "$MCP_DIR"

    # Créer package.json pour MCP
    cat > package.json << 'EOF'
{
  "name": "nemesis-mcp-servers",
  "version": "3.0.0",
  "description": "NEMESIS MCP Servers Infrastructure",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@modelcontextprotocol/sdk": "latest",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

    npm install

    log "SUCCESS" "Infrastructure MCP installée"
}

setup_mcp_servers() {
    log "STEP" "Configuration des serveurs MCP..."

    # Configuration MCP avec TOUS les serveurs disponibles
    cat > "$CONFIGS_DIR/mcp_config.json" << 'EOF'
{
  "mcpServers": {
    "canva": {
      "command": "npx",
      "args": ["-y", "@canva/mcp-server"],
      "env": {
        "CANVA_CLIENT_ID": "YOUR_CANVA_CLIENT_ID",
        "CANVA_CLIENT_SECRET": "YOUR_CANVA_CLIENT_SECRET"
      }
    },
    "asana": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-asana"],
      "env": {
        "ASANA_ACCESS_TOKEN": "YOUR_ASANA_TOKEN"
      }
    },
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/mcp-atlassian"],
      "env": {
        "ATLASSIAN_EMAIL": "your.email@domain.com",
        "ATLASSIAN_API_TOKEN": "YOUR_ATLASSIAN_TOKEN",
        "ATLASSIAN_SITE_URL": "https://yoursite.atlassian.net"
      }
    },
    "huggingface": {
      "command": "npx",
      "args": ["-y", "@huggingface/mcp"],
      "env": {
        "HF_TOKEN": "YOUR_HF_TOKEN"
      }
    },
    "coupler": {
      "command": "npx",
      "args": ["-y", "@coupler.io/mcp-server"],
      "env": {
        "COUPLER_API_KEY": "YOUR_COUPLER_KEY"
      }
    },
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp-server"],
      "env": {
        "STRIPE_API_KEY": "YOUR_STRIPE_KEY"
      }
    },
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "YOUR_CLOUDFLARE_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID": "YOUR_ACCOUNT_ID"
      }
    },
    "spotify": {
      "command": "npx",
      "args": ["-y", "@spotify/mcp-server"]
    },
    "pdf-tools": {
      "command": "npx",
      "args": ["-y", "@pdf-tools/mcp-server"]
    },
    "windows-mcp": {
      "command": "npx",
      "args": ["-y", "@windows/mcp-server"]
    },
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@kubernetes/mcp-server"],
      "env": {
        "KUBECONFIG": "$HOME/.kube/config"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home", "/tmp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    },
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "YOUR_GITLAB_TOKEN",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    },
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"]
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "YOUR_SLACK_TOKEN",
        "SLACK_TEAM_ID": "YOUR_TEAM_ID"
      }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notion/mcp-server"],
      "env": {
        "NOTION_API_KEY": "YOUR_NOTION_KEY"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost/db"
      }
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "$NEMESIS_HOME/data/nemesis.db"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_BRAVE_KEY"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
EOF

    log "SUCCESS" "Configuration MCP créée avec tous les serveurs"
}

create_mcp_orchestrator() {
    log "STEP" "Création de l'orchestrateur MCP..."

    cat > "$MCP_DIR/server.js" << 'EOF'
import express from 'express';
import { createServer } from 'http';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 10000;

// Serveurs MCP actifs
const mcpServers = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../workspace/html')));

// Charger la configuration MCP
async function loadMCPConfig() {
    const configPath = path.join(__dirname, '../configs/mcp_config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
}

// Démarrer un serveur MCP
function startMCPServer(name, config) {
    console.log(`🚀 Démarrage du serveur MCP: ${name}`);

    const process = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    process.stdout.on('data', (data) => {
        console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
        console.error(`[${name}] ERROR: ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
        console.log(`[${name}] Arrêté avec le code ${code}`);
        mcpServers.delete(name);
    });

    mcpServers.set(name, { process, config, status: 'running' });
    return process;
}

// Routes API
app.get('/api/status', (req, res) => {
    const status = {
        uptime: process.uptime(),
        servers: Array.from(mcpServers.entries()).map(([name, data]) => ({
            name,
            status: data.status,
            pid: data.process.pid
        }))
    };
    res.json(status);
});

app.get('/api/servers', (req, res) => {
    const servers = Array.from(mcpServers.keys());
    res.json({ servers, count: servers.length });
});

app.post('/api/servers/:name/restart', async (req, res) => {
    const { name } = req.params;
    const config = await loadMCPConfig();

    if (!config.mcpServers[name]) {
        return res.status(404).json({ error: 'Server not found' });
    }

    // Arrêter le serveur existant
    if (mcpServers.has(name)) {
        mcpServers.get(name).process.kill();
        mcpServers.delete(name);
    }

    // Redémarrer
    startMCPServer(name, config.mcpServers[name]);
    res.json({ message: `Server ${name} restarted` });
});

// Initialisation
async function initialize() {
    console.log('🔮 NEMESIS MCP ORCHESTRATOR V3.0');
    console.log('================================');

    const config = await loadMCPConfig();
    const serverNames = Object.keys(config.mcpServers);

    console.log(`📦 ${serverNames.length} serveurs MCP configurés`);

    // Démarrer tous les serveurs (optionnel - à activer si clés API présentes)
    // for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    //     startMCPServer(name, serverConfig);
    // }

    server.listen(PORT, () => {
        console.log(`✅ Orchestrateur MCP démarré sur http://localhost:${PORT}`);
        console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
        console.log(`🌐 Workspace: http://localhost:${PORT}/`);
    });
}

initialize().catch(console.error);
EOF

    log "SUCCESS" "Orchestrateur MCP créé"
}

################################################################################
# CRÉATION DU WORKSPACE HTML ULTIMATE
################################################################################

create_ultimate_workspace() {
    log "STEP" "Création du Workspace NEMESIS Ultimate V3..."

    cat > "$WORKSPACE_DIR/html/nemesis_workspace.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEMESIS OMEGA V3.0 - Ultimate Workspace</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #00ff9d;
            --secondary: #009dff;
            --tertiary: #ff0099;
            --dark: #0a0e27;
            --darker: #050814;
            --glass: rgba(255, 255, 255, 0.05);
            --glass-strong: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.15);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--darker);
            color: white;
            overflow-x: hidden;
        }

        .header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: var(--glass);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--glass-border);
            padding: 20px;
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .status-bar {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            font-size: 14px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--primary);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .container {
            max-width: 1400px;
            margin: 40px auto;
            padding: 0 20px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .card {
            background: var(--glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 25px;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            opacity: 0;
            transition: opacity 0.3s;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--primary);
            box-shadow: 0 20px 40px rgba(0, 255, 157, 0.3);
        }

        .card:hover::before {
            opacity: 0.08;
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
        }

        .card-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .card-title {
            font-size: 18px;
            font-weight: 700;
        }

        .card-description {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            line-height: 1.6;
            position: relative;
            z-index: 1;
        }

        .section-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .section-subtitle {
            color: rgba(255, 255, 255, 0.6);
            font-size: 16px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="logo">🔮 NEMESIS OMEGA V3.0</div>
            <div class="status-bar">
                <div class="status-item">
                    <span class="status-dot"></span>
                    <span id="mcp-status">MCP Ready</span>
                </div>
                <div class="status-item">
                    <span>🤖</span>
                    <span id="agents-count">47 Agents</span>
                </div>
                <div class="status-item">
                    <span>⚡</span>
                    <span id="tools-count">156 Outils</span>
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <h1 class="section-title">Outils IA Premium</h1>
        <p class="section-subtitle">Votre arsenal d'intelligence artificielle</p>

        <div class="grid" id="tools-grid">
            <!-- Les outils seront chargés dynamiquement -->
        </div>
    </div>

    <script>
        const tools = [
            { name: 'Claude', icon: '🤖', url: 'https://claude.ai', desc: 'Assistant IA avancé Anthropic' },
            { name: 'ChatGPT', icon: '💬', url: 'https://chat.openai.com', desc: 'Chat OpenAI GPT-4' },
            { name: 'Gemini', icon: '✨', url: 'https://gemini.google.com', desc: 'IA multimodale Google' },
            { name: 'Perplexity', icon: '🔍', url: 'https://perplexity.ai', desc: 'Recherche IA avec sources' },
            { name: 'Midjourney', icon: '🎨', url: 'https://midjourney.com', desc: 'Génération d\'images IA' },
            { name: 'GitHub Copilot', icon: '👨‍💻', url: 'https://github.com/features/copilot', desc: 'Assistant code IA' },
            { name: 'Cursor', icon: '⚡', url: 'https://cursor.sh', desc: 'IDE dopé à l\'IA' },
            { name: 'Make.com', icon: '🔄', url: 'https://make.com', desc: 'Automatisation NoCode' },
            { name: 'Dify', icon: '🧠', url: 'https://dify.ai', desc: 'Plateforme agents IA' },
            { name: 'Notion AI', icon: '📋', url: 'https://notion.so', desc: 'Workspace intelligent' },
            { name: 'Canva', icon: '🎨', url: 'https://canva.com', desc: 'Design graphique IA' },
            { name: 'HuggingFace', icon: '🤗', url: 'https://huggingface.co', desc: 'Hub ML open source' }
        ];

        function loadTools() {
            const grid = document.getElementById('tools-grid');
            grid.innerHTML = tools.map(tool => `
                <div class="card" onclick="window.open('${tool.url}', '_blank')">
                    <div class="card-header">
                        <div class="card-icon">${tool.icon}</div>
                        <div class="card-title">${tool.name}</div>
                    </div>
                    <div class="card-description">${tool.desc}</div>
                </div>
            `).join('');
        }

        async function checkMCPStatus() {
            try {
                const response = await fetch('http://localhost:10000/api/status');
                const data = await response.json();
                document.getElementById('mcp-status').textContent = `MCP Active (${data.servers.length})`;
            } catch (error) {
                document.getElementById('mcp-status').textContent = 'MCP Offline';
            }
        }

        loadTools();
        checkMCPStatus();
        setInterval(checkMCPStatus, 5000);

        console.log('%c🔮 NEMESIS OMEGA V3.0', 'font-size: 24px; font-weight: bold; color: #00ff9d;');
        console.log('%c156 Outils IA + 47 Agents + MCP Infrastructure', 'font-size: 14px; color: #009dff;');
    </script>
</body>
</html>
HTMLEOF

    log "SUCCESS" "Workspace HTML Ultimate créé"
}

################################################################################
# CRÉATION DES SCRIPTS DE GESTION
################################################################################

create_management_scripts() {
    log "STEP" "Création des scripts de gestion..."

    # Script de démarrage global
    cat > "$SCRIPTS_DIR/start_nemesis.sh" << 'EOF'
#!/bin/bash
echo "🚀 Démarrage de NEMESIS OMEGA V3.0..."

# Démarrer l'orchestrateur MCP
cd ~/.nemesis/mcp
node server.js &
MCP_PID=$!
echo "📦 Orchestrateur MCP démarré (PID: $MCP_PID)"

# Attendre que le serveur soit prêt
sleep 3

# Lancer Edge avec le workspace
~/.nemesis/scripts/launch_edge_nemesis.sh

echo "✅ NEMESIS démarré avec succès !"
echo "🌐 Workspace: http://localhost:10000"
echo "📊 API MCP: http://localhost:10000/api/status"
EOF

    # Script d'arrêt
    cat > "$SCRIPTS_DIR/stop_nemesis.sh" << 'EOF'
#!/bin/bash
echo "🛑 Arrêt de NEMESIS..."

# Tuer les processus MCP
pkill -f "node server.js"

echo "✅ NEMESIS arrêté"
EOF

    # Script de monitoring
    cat > "$SCRIPTS_DIR/monitor_nemesis.sh" << 'EOF'
#!/bin/bash
watch -n 2 'curl -s http://localhost:10000/api/status | jq .'
EOF

    # Script de backup
    cat > "$SCRIPTS_DIR/backup_nemesis.sh" << 'EOF'
#!/bin/bash
BACKUP_DIR=~/.nemesis/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nemesis_backup_${TIMESTAMP}.tar.gz"

echo "💾 Création du backup NEMESIS..."
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    ~/.nemesis/configs \
    ~/.nemesis/data \
    ~/.nemesis/workspace

echo "✅ Backup créé: $BACKUP_FILE"
EOF

    chmod +x "$SCRIPTS_DIR"/*.sh

    log "SUCCESS" "Scripts de gestion créés"
}

################################################################################
# FICHIER DE VARIABLES D'ENVIRONNEMENT
################################################################################

create_env_file() {
    log "STEP" "Création du fichier .env avec les clés API..."

    cat > "$NEMESIS_HOME/.env" << 'EOF'
# ============================================================================
# NEMESIS OMEGA V3.0 - Configuration des Clés API
# ============================================================================
#
# ⚠️ IMPORTANT: Remplacez toutes les valeurs YOUR_* par vos vraies clés API
#
# 📝 Instructions:
# 1. Ne committez JAMAIS ce fichier sur Git
# 2. Gardez une copie sécurisée de vos clés
# 3. Renouvelez régulièrement vos tokens
# ============================================================================

# ============================================================================
# ANTHROPIC / CLAUDE
# ============================================================================
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
# Obtenez votre clé: https://console.anthropic.com/settings/keys

# ============================================================================
# OPENAI / CHATGPT
# ============================================================================
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
# Obtenez votre clé: https://platform.openai.com/api-keys

# ============================================================================
# GOOGLE / GEMINI
# ============================================================================
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
# Obtenez votre clé: https://makersuite.google.com/app/apikey

# ============================================================================
# COLLABORATION & PRODUCTIVITY
# ============================================================================

# Notion
NOTION_API_KEY=YOUR_NOTION_KEY
# https://www.notion.so/my-integrations

# Slack
SLACK_BOT_TOKEN=YOUR_SLACK_TOKEN
SLACK_TEAM_ID=YOUR_TEAM_ID
# https://api.slack.com/apps

# Asana
ASANA_ACCESS_TOKEN=YOUR_ASANA_TOKEN
# https://app.asana.com/0/my-apps

# Atlassian (Jira/Confluence)
ATLASSIAN_EMAIL=your.email@domain.com
ATLASSIAN_API_TOKEN=YOUR_ATLASSIAN_TOKEN
ATLASSIAN_SITE_URL=https://yoursite.atlassian.net
# https://id.atlassian.com/manage-profile/security/api-tokens

# ============================================================================
# DEVELOPMENT & CODE
# ============================================================================

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=YOUR_GITHUB_TOKEN
# https://github.com/settings/tokens

# GitLab
GITLAB_PERSONAL_ACCESS_TOKEN=YOUR_GITLAB_TOKEN
GITLAB_API_URL=https://gitlab.com/api/v4
# https://gitlab.com/-/profile/personal_access_tokens

# ============================================================================
# DESIGN & CREATIVE
# ============================================================================

# Canva
CANVA_CLIENT_ID=YOUR_CANVA_CLIENT_ID
CANVA_CLIENT_SECRET=YOUR_CANVA_CLIENT_SECRET
# https://www.canva.com/developers/

# ============================================================================
# DATA & ANALYTICS
# ============================================================================

# Stripe
STRIPE_API_KEY=YOUR_STRIPE_KEY
# https://dashboard.stripe.com/apikeys

# Coupler.io
COUPLER_API_KEY=YOUR_COUPLER_KEY
# https://www.coupler.io/

# ============================================================================
# INFRASTRUCTURE & CLOUD
# ============================================================================

# Cloudflare
CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_TOKEN
CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID
# https://dash.cloudflare.com/profile/api-tokens

# Google Drive
GOOGLE_DRIVE_CLIENT_ID=YOUR_GDRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET=YOUR_GDRIVE_CLIENT_SECRET
# https://console.cloud.google.com/apis/credentials

# ============================================================================
# AI MODELS & SERVICES
# ============================================================================

# HuggingFace
HF_TOKEN=YOUR_HF_TOKEN
# https://huggingface.co/settings/tokens

# ============================================================================
# SEARCH & WEB
# ============================================================================

# Brave Search
BRAVE_API_KEY=YOUR_BRAVE_KEY
# https://brave.com/search/api/

# ============================================================================
# DATABASE
# ============================================================================

# PostgreSQL (si utilisé)
POSTGRES_CONNECTION_STRING=postgresql://user:pass@localhost:5432/nemesis

# ============================================================================
# KUBERNETES (si utilisé)
# ============================================================================
KUBECONFIG=$HOME/.kube/config

# ============================================================================
# NEMESIS CONFIGURATION
# ============================================================================
NEMESIS_HOME=$HOME/.nemesis
NEMESIS_PORT=10000
NODE_ENV=production

# ============================================================================
# FIN DE LA CONFIGURATION
# ============================================================================
EOF

    log "SUCCESS" "Fichier .env créé - N'OUBLIEZ PAS de remplir vos clés API !"
}

################################################################################
# POST-INSTALLATION
################################################################################

create_readme() {
    log "STEP" "Création de la documentation..."

    cat > "$NEMESIS_HOME/README.md" << 'EOF'
# 🔮 NEMESIS OMEGA V3.0 - Guide d'Utilisation

## 🚀 Démarrage Rapide

### 1. Configurer les Clés API
```bash
nano ~/.nemesis/.env
# Remplissez toutes les clés API nécessaires
```

### 2. Démarrer NEMESIS
```bash
~/.nemesis/scripts/start_nemesis.sh
```

### 3. Accéder au Workspace
- **Interface Web**: http://localhost:10000
- **API MCP**: http://localhost:10000/api/status

## 📁 Structure des Répertoires

```
~/.nemesis/
├── workspace/          # Interface web et assets
│   └── html/          # Workspace HTML
├── mcp/               # Infrastructure MCP
│   ├── server.js      # Orchestrateur principal
│   └── package.json   # Dépendances Node
├── configs/           # Configurations
│   └── mcp_config.json
├── scripts/           # Scripts de gestion
│   ├── start_nemesis.sh
│   ├── stop_nemesis.sh
│   ├── monitor_nemesis.sh
│   └── backup_nemesis.sh
├── data/              # Données et bases SQLite
├── backups/           # Sauvegardes automatiques
└── .env              # Variables d'environnement (CLÉS API)
```

## 🛠️ Commandes Utiles

### Gestion du Système
```bash
# Démarrer NEMESIS
~/.nemesis/scripts/start_nemesis.sh

# Arrêter NEMESIS
~/.nemesis/scripts/stop_nemesis.sh

# Monitorer en temps réel
~/.nemesis/scripts/monitor_nemesis.sh

# Créer un backup
~/.nemesis/scripts/backup_nemesis.sh
```

### Serveurs MCP

#### Lister les serveurs actifs
```bash
curl http://localhost:10000/api/servers | jq
```

#### Redémarrer un serveur spécifique
```bash
curl -X POST http://localhost:10000/api/servers/github/restart
```

#### Vérifier le status
```bash
curl http://localhost:10000/api/status | jq
```

## 🔑 Configuration des Clés API

### Étapes Essentielles

1. **Anthropic Claude**
   - Créez un compte: https://console.anthropic.com
   - Générez une clé API: Settings → API Keys
   - Ajoutez dans `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

2. **OpenAI ChatGPT**
   - Compte: https://platform.openai.com
   - Clé API: https://platform.openai.com/api-keys
   - `.env`: `OPENAI_API_KEY=sk-proj-...`

3. **GitHub**
   - Settings → Developer settings → Personal access tokens
   - Permissions: `repo`, `workflow`, `read:org`
   - `.env`: `GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...`

4. **Notion**
   - https://www.notion.so/my-integrations
   - Create new integration
   - `.env`: `NOTION_API_KEY=secret_...`

### Liste Complète des Services

Consultez le fichier `.env` pour la liste exhaustive des 25+ services intégrés.

## 🎨 Personnalisation

### Ajouter un Outil IA

Éditez `~/.nemesis/workspace/html/nemesis_workspace.html` :

```javascript
const tools = [
    // Vos outils existants...
    {
        name: 'Nouvel Outil',
        icon: '🆕',
        url: 'https://example.com',
        desc: 'Description de l\'outil'
    }
];
```

### Configurer un Nouveau Serveur MCP

1. Éditez `~/.nemesis/configs/mcp_config.json`
2. Ajoutez votre serveur dans `mcpServers`
3. Redémarrez: `~/.nemesis/scripts/stop_nemesis.sh && ~/.nemesis/scripts/start_nemesis.sh`

## 🔧 Dépannage

### MCP ne démarre pas
```bash
# Vérifier les logs
tail -f ~/nemesis_logs/install_*.log

# Vérifier les processus
ps aux | grep node

# Relancer proprement
~/.nemesis/scripts/stop_nemesis.sh
~/.nemesis/scripts/start_nemesis.sh
```

### Edge ne s'ouvre pas automatiquement
```bash
# Lancer manuellement
microsoft-edge --new-window "http://localhost:10000"
```

### Port 10000 déjà utilisé
```bash
# Trouver et tuer le processus
sudo lsof -i :10000
kill -9 <PID>
```

## 📊 Monitoring & Logs

### Logs d'Installation
```bash
cat ~/nemesis_logs/install_*.log
```

### Logs d'Erreurs
```bash
cat ~/nemesis_logs/errors_*.log
```

### Logs MCP en Temps Réel
```bash
tail -f ~/.nemesis/mcp/logs/*.log
```

## 🔐 Sécurité

- ⚠️ **Ne partagez JAMAIS votre fichier `.env`**
- 🔒 Utilisez `.gitignore` pour exclure `.env`
- 🔑 Renouvelez vos clés API tous les 3-6 mois
- 📝 Gardez une copie sécurisée de vos clés (gestionnaire de mots de passe)

## 🆘 Support

- **Documentation MCP**: https://modelcontextprotocol.io
- **Discord NEMESIS**: (À créer)
- **GitHub Issues**: (À créer)

## 📜 Licence

NEMESIS OMEGA V3.0 - Usage Personnel
Pierre Tagnard - SARL KAIROS

---

🔮 **Powered by ZAPPA Architecture**
✨ **47 Agents + 156 Outils IA + Infrastructure MCP**
EOF

    log "SUCCESS" "Documentation créée: $NEMESIS_HOME/README.md"
}

create_desktop_launcher() {
    log "STEP" "Création du lanceur desktop..."

    cat > "$HOME/.local/share/applications/nemesis.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NEMESIS OMEGA V3.0
Comment=AI Workspace Ultimate
Icon=$NEMESIS_HOME/workspace/assets/nemesis_icon.png
Exec=$SCRIPTS_DIR/start_nemesis.sh
Terminal=false
Categories=Development;AI;Utility;
Keywords=ai;workspace;mcp;automation;
EOF

    chmod +x "$HOME/.local/share/applications/nemesis.desktop"

    log "SUCCESS" "Lanceur desktop créé"
}

################################################################################
# FONCTION PRINCIPALE
################################################################################

main() {
    print_banner

    log "INFO" "🚀 Début de l'installation NEMESIS OMEGA V3.0"
    log "INFO" "📍 Répertoire d'installation: $NEMESIS_HOME"
    log "INFO" "📋 Logs: $LOG_DIR"

    # Vérifications préliminaires
    check_sudo
    create_directories

    # Installation des composants
    install_system_dependencies
    install_microsoft_edge
    configure_edge
    install_nodejs
    install_python

    # Infrastructure MCP
    install_mcp_infrastructure
    setup_mcp_servers
    create_mcp_orchestrator

    # Workspace et scripts
    create_ultimate_workspace
    create_management_scripts
    create_env_file
    create_readme
    create_desktop_launcher

    log "SUCCESS" "=========================================="
    log "SUCCESS" "🎉 NEMESIS OMEGA V3.0 INSTALLÉ AVEC SUCCÈS !"
    log "SUCCESS" "=========================================="
    echo ""
    log "INFO" "📍 Installation: $NEMESIS_HOME"
    log "INFO" "📚 Documentation: $NEMESIS_HOME/README.md"
    log "INFO" "🔑 Configuration API: $NEMESIS_HOME/.env"
    echo ""
    log "WARNING" "⚠️  ÉTAPES SUIVANTES ESSENTIELLES:"
    log "WARNING" "1. Éditez $NEMESIS_HOME/.env avec vos vraies clés API"
    log "WARNING" "2. Exécutez: ~/.nemesis/scripts/start_nemesis.sh"
    log "WARNING" "3. Accédez au workspace: http://localhost:10000"
    echo ""
    log "INFO" "📖 Lisez le README complet: cat $NEMESIS_HOME/README.md"
    echo ""

    read -p "Voulez-vous démarrer NEMESIS maintenant ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        log "INFO" "Démarrage de NEMESIS..."
        "$SCRIPTS_DIR/start_nemesis.sh"
    else
        log "INFO" "Pour démarrer plus tard: ~/.nemesis/scripts/start_nemesis.sh"
    fi
}

# Exécution
main "$@"
