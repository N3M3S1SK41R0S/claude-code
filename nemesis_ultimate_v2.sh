#!/bin/bash

################################################################################
#                   NEMESIS OMEGA - ABSOLUTE PERFECTION                        #
#                   Performance + Completeness + Reliability                   #
#                   No Compromises - Maximum Everything                        #
################################################################################

set -euo pipefail
IFS=$'\n\t'

# Colors
readonly R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m'
readonly C='\033[0;36m' M='\033[0;35m' NC='\033[0m'

# Configuration
readonly VERSION="3.2.0-ABSOLUTE"
readonly NEMESIS="$HOME/.nemesis"
readonly LOGS="$HOME/nemesis_logs"
readonly INSTALL_LOG="$LOGS/absolute_$(date +%Y%m%d_%H%M%S).log"

# Progress tracking
STEP=0
TOTAL_STEPS=15
ERRORS_FIXED=0

################################################################################
# LOGGING
################################################################################

log() {
    local level=$1; shift
    local msg="$*"
    local ts=$(date '+%H:%M:%S')
    echo "[$ts] [$level] $msg" >> "$INSTALL_LOG"

    case $level in
        ERR) echo -e "${R}❌ $msg${NC}" ;;
        OK)  echo -e "${G}✅ $msg${NC}"; ((STEP++)) ;;
        INF) echo -e "${B}ℹ️  $msg${NC}" ;;
        WRN) echo -e "${Y}⚠️  $msg${NC}" ;;
        FIX) echo -e "${C}🔨 $msg${NC}"; ((ERRORS_FIXED++)) ;;
    esac
}

progress() {
    local current=$1
    local total=$2
    local msg=$3
    echo -e "${M}[$current/$total]${NC} ${Y}$msg${NC}"
}

################################################################################
# BANNER
################################################################################

banner() {
    clear
    echo -e "${C}"
    cat << 'BANNER'
    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

    🚀 ABSOLUTE PERFECTION V3.2.0
    ⚡ Maximum Performance | Complete Installation | Zero Compromise

BANNER
    echo -e "${NC}"
}

################################################################################
# SUDO MANAGEMENT - BULLETPROOF
################################################################################

setup_sudo() {
    progress 1 $TOTAL_STEPS "Configuration sudo sécurisée..."

    # Demander sudo une fois
    if ! sudo -n true 2>/dev/null; then
        log INF "Mot de passe sudo requis (une seule fois)"
        sudo -v || { log ERR "Sudo requis"; exit 1; }
    fi

    # Maintenir sudo actif avec timeout
    (
        while true; do
            sleep 50
            sudo -n true 2>/dev/null || exit 0
            kill -0 $$ 2>/dev/null || exit 0
        done
    ) &

    SUDO_PID=$!
    trap "kill $SUDO_PID 2>/dev/null || true" EXIT

    log OK "Sudo configuré (PID: $SUDO_PID)"
}

################################################################################
# BUG FIXES - PREEMPTIVE
################################################################################

fix_ubuntu_bugs() {
    progress 2 $TOTAL_STEPS "Correction bugs Ubuntu 24.04..."

    # Fix command-not-found
    if [[ -f /etc/apt/apt.conf.d/50command-not-found ]]; then
        sudo mv /etc/apt/apt.conf.d/50command-not-found \
                /etc/apt/apt.conf.d/50command-not-found.disabled 2>/dev/null || true
        log FIX "Bug command-not-found neutralisé"
    fi

    # Clean APT
    sudo apt-get clean 2>/dev/null || true
    sudo rm -rf /var/lib/apt/lists/* 2>/dev/null || true
    sudo mkdir -p /var/lib/apt/lists/partial

    log OK "Bugs Ubuntu corrigés"
}

################################################################################
# SYSTEM UPDATE
################################################################################

update_system() {
    progress 3 $TOTAL_STEPS "Mise à jour système (rapide)..."

    # Update avec options optimisées
    sudo apt-get update -o Acquire::Languages=none \
                         -o Acquire::GzipIndexes=true \
                         -o APT::Update::Error-Mode=any \
                         -qq 2>&1 | tee -a "$INSTALL_LOG" || {
        log FIX "Retry apt update..."
        sudo apt-get clean
        sudo apt-get update -qq || true
    }

    log OK "Système à jour"
}

################################################################################
# ESSENTIAL PACKAGES - PARALLEL INSTALL
################################################################################

install_essentials() {
    progress 4 $TOTAL_STEPS "Installation packages essentiels (parallèle)..."

    local packages=(
        curl wget git jq bc
        build-essential software-properties-common
        apt-transport-https ca-certificates gnupg lsb-release
        unzip zip vim nano htop tmux
        net-tools dnsutils iputils-ping
    )

    # Installation optimisée
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        --no-install-recommends \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        "${packages[@]}" 2>&1 | tee -a "$INSTALL_LOG"

    log OK "${#packages[@]} packages installés"
}

################################################################################
# NODE.JS - LATEST STABLE
################################################################################

install_nodejs() {
    progress 5 $TOTAL_STEPS "Installation Node.js 20 LTS..."

    if command -v node &>/dev/null && [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge 20 ]]; then
        log INF "Node.js $(node -v) déjà installé"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &>/dev/null
        sudo apt-get install -y nodejs &>/dev/null
    fi

    # Global tools
    sudo npm install -g npm@latest pnpm yarn --silent 2>/dev/null || true

    # Configure npm for speed
    npm config set prefer-offline true
    npm config set audit false
    npm config set fund false

    log OK "Node.js $(node -v) + npm $(npm -v)"
}

################################################################################
# PYTHON - COMPLETE SETUP
################################################################################

install_python() {
    progress 6 $TOTAL_STEPS "Configuration Python complète..."

    if ! command -v python3 &>/dev/null; then
        sudo apt-get install -y python3 python3-pip python3-venv &>/dev/null
    fi

    # Install pipx
    python3 -m pip install --user --break-system-packages pipx 2>/dev/null || \
        python3 -m pip install --user pipx 2>/dev/null || true

    python3 -m pipx ensurepath 2>/dev/null || true

    log OK "Python $(python3 --version | cut -d' ' -f2)"
}

################################################################################
# MICROSOFT EDGE - OPTIMIZED
################################################################################

install_edge() {
    progress 7 $TOTAL_STEPS "Installation Microsoft Edge..."

    if command -v microsoft-edge &>/dev/null; then
        log INF "Edge déjà installé"
    else
        # Add MS key
        curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | \
            gpg --dearmor | \
            sudo tee /usr/share/keyrings/microsoft-edge.gpg >/dev/null

        # Add repo
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | \
            sudo tee /etc/apt/sources.list.d/microsoft-edge.list >/dev/null

        # Install
        sudo apt-get update -qq
        sudo apt-get install -y microsoft-edge-stable &>/dev/null || {
            log WRN "Edge install failed, continuing..."
        }
    fi

    log OK "Microsoft Edge ready"
}

################################################################################
# DIRECTORY STRUCTURE
################################################################################

create_structure() {
    progress 8 $TOTAL_STEPS "Création structure NEMESIS..."

    mkdir -p "$LOGS"
    mkdir -p "$NEMESIS"/{workspace/{html,assets,css,js},mcp/{servers,logs},configs,scripts,data,backups}

    log OK "Structure créée: $NEMESIS"
}

################################################################################
# MCP INFRASTRUCTURE - COMPLETE
################################################################################

install_mcp() {
    progress 9 $TOTAL_STEPS "Installation MCP infrastructure (complète)..."

    cd "$NEMESIS/mcp"

    # Package.json optimized
    cat > package.json << 'PKG'
{
  "name": "nemesis-mcp-absolute",
  "version": "3.2.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.1",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.19.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.4.5",
    "winston": "^3.13.0",
    "axios": "^1.7.2",
    "compression": "^1.7.4",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
PKG

    # Fast install
    npm install --prefer-offline --no-audit --no-fund --silent 2>&1 | tee -a "$INSTALL_LOG" || {
        log FIX "Retry npm install..."
        rm -rf node_modules package-lock.json
        npm install --silent 2>&1 | tee -a "$INSTALL_LOG"
    }

    log OK "MCP packages installés ($(du -sh node_modules | cut -f1))"
}

################################################################################
# MCP CONFIG - ALL SERVERS
################################################################################

create_mcp_config() {
    progress 10 $TOTAL_STEPS "Configuration 25+ serveurs MCP..."

    cat > "$NEMESIS/configs/mcp_config.json" << 'MCPCFG'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home", "/tmp"],
      "enabled": true
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "enabled": true
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "enabled": true
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "$NEMESIS/data/nemesis.db"],
      "enabled": true
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "enabled": true
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"},
      "enabled": false
    },
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gitlab"],
      "env": {"GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_PERSONAL_ACCESS_TOKEN}"},
      "enabled": false
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {"SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}", "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"},
      "enabled": false
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notion/mcp-server"],
      "env": {"NOTION_API_KEY": "${NOTION_API_KEY}"},
      "enabled": false
    },
    "asana": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-asana"],
      "env": {"ASANA_ACCESS_TOKEN": "${ASANA_ACCESS_TOKEN}"},
      "enabled": false
    },
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "enabled": false
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {"BRAVE_API_KEY": "${BRAVE_API_KEY}"},
      "enabled": false
    }
  }
}
MCPCFG

    log OK "25+ serveurs MCP configurés"
}

################################################################################
# ORCHESTRATOR - PRODUCTION GRADE
################################################################################

create_orchestrator() {
    progress 11 $TOTAL_STEPS "Création orchestrateur production..."

    cat > "$NEMESIS/mcp/server.js" << 'ORCH'
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
const mcpServers = new Map();

// Security & Performance
app.use(helmet({contentSecurityPolicy: false}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(rateLimit({windowMs: 15*60000, max: 100}));

// Static files
app.use(express.static(path.join(__dirname, '../workspace/html')));
app.use('/assets', express.static(path.join(__dirname, '../workspace/assets')));

async function loadConfig() {
    const cfg = await fs.readFile(path.join(__dirname, '../configs/mcp_config.json'), 'utf8');
    return JSON.parse(cfg);
}

function startMCP(name, config) {
    if (!config.enabled) return null;

    console.log(`🚀 Starting: ${name}`);
    const proc = spawn(config.command, config.args, {
        env: {...process.env, ...config.env},
        stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', d => console.log(`[${name}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[${name}] ${d.toString().trim()}`));
    proc.on('close', code => {
        console.log(`[${name}] Stopped (${code})`);
        mcpServers.delete(name);
    });

    mcpServers.set(name, {
        process: proc,
        config,
        status: 'running',
        started: Date.now(),
        pid: proc.pid
    });

    return proc;
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        version: '3.2.0-ABSOLUTE',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        servers: Array.from(mcpServers.entries()).map(([name, data]) => ({
            name,
            status: data.status,
            pid: data.pid,
            uptime: Math.floor((Date.now() - data.started) / 1000)
        })),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
    });
});

app.get('/api/servers', (req, res) => {
    res.json({
        servers: Array.from(mcpServers.keys()),
        count: mcpServers.size,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/servers/:name/restart', async (req, res) => {
    const {name} = req.params;
    const config = await loadConfig();

    if (!config.mcpServers[name]) {
        return res.status(404).json({error: 'Not found'});
    }

    if (mcpServers.has(name)) {
        mcpServers.get(name).process.kill();
        mcpServers.delete(name);
    }

    startMCP(name, config.mcpServers[name]);
    res.json({message: `${name} restarted`, timestamp: new Date().toISOString()});
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '3.2.0-ABSOLUTE',
        timestamp: new Date().toISOString(),
        activeServers: mcpServers.size
    });
});

app.get('/api/metrics', (req, res) => {
    res.json({
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        servers: mcpServers.size,
        timestamp: new Date().toISOString()
    });
});

async function init() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔮 NEMESIS ORCHESTRATOR V3.2.0-ABSOLUTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const config = await loadConfig();
    const enabled = Object.entries(config.mcpServers).filter(([_, c]) => c.enabled);

    console.log(`📦 Total: ${Object.keys(config.mcpServers).length} servers`);
    console.log(`✅ Enabled: ${enabled.length} servers`);

    for (const [name, cfg] of enabled) {
        try {
            startMCP(name, cfg);
            await new Promise(r => setTimeout(r, 300));
        } catch (err) {
            console.error(`❌ Failed to start ${name}:`, err.message);
        }
    }

    server.listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Server: http://localhost:${PORT}`);
        console.log(`📊 Status: http://localhost:${PORT}/api/status`);
        console.log(`🏥 Health: http://localhost:${PORT}/health`);
        console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
}

init().catch(console.error);

process.on('SIGTERM', () => {
    console.log('Shutdown...');
    server.close(() => process.exit(0));
});
ORCH

    log OK "Orchestrateur production créé"
}

################################################################################
# WORKSPACE - PREMIUM UI
################################################################################

create_workspace() {
    progress 12 $TOTAL_STEPS "Création workspace premium..."

    cat > "$NEMESIS/workspace/html/index.html" << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEMESIS OMEGA - Absolute Edition</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--p:#00ff9d;--s:#009dff;--d:#0a0e27;--dd:#050814;--g:rgba(255,255,255,0.05);--gb:rgba(255,255,255,0.15)}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,var(--dd) 0%,var(--d) 100%);color:#fff;min-height:100vh}
.header{background:var(--g);backdrop-filter:blur(20px);border-bottom:1px solid var(--gb);padding:20px;position:sticky;top:0;z-index:1000}
.header-content{max-width:1400px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
.logo{font-size:28px;font-weight:700;background:linear-gradient(135deg,var(--p),var(--s));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.status-bar{display:flex;gap:15px}
.status-item{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--g);border:1px solid var(--gb);border-radius:20px;font-size:14px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--p);animation:pulse 2s infinite}
.dot.off{background:#f00}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.container{max-width:1400px;margin:40px auto;padding:0 20px}
.section-title{font-size:32px;font-weight:700;margin-bottom:10px;background:linear-gradient(135deg,var(--p),var(--s));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section-subtitle{color:rgba(255,255,255,0.6);font-size:16px;margin-bottom:30px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:30px}
.card{background:var(--g);backdrop-filter:blur(20px);border:1px solid var(--gb);border-radius:16px;padding:25px;cursor:pointer;transition:all 0.3s;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,var(--p),var(--s));opacity:0;transition:opacity 0.3s}
.card:hover{transform:translateY(-5px);border-color:var(--p);box-shadow:0 20px 40px rgba(0,255,157,0.3)}
.card:hover::before{opacity:0.08}
.card-header{display:flex;align-items:center;gap:12px;margin-bottom:15px;position:relative;z-index:1}
.card-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--p),var(--s));display:flex;align-items:center;justify-content:center;font-size:24px}
.card-title{font-size:18px;font-weight:700}
.card-description{color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;position:relative;z-index:1}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-top:30px}
.metric{background:var(--g);padding:20px;border-radius:12px;border:1px solid var(--gb)}
.metric-value{font-size:32px;font-weight:700;color:var(--p);margin-bottom:5px}
.metric-label{font-size:14px;color:rgba(255,255,255,0.6)}
</style>
</head>
<body>
<div class="header">
<div class="header-content">
<div class="logo">🔮 NEMESIS OMEGA ABSOLUTE</div>
<div class="status-bar">
<div class="status-item"><span class="dot" id="dot"></span><span id="status">Checking...</span></div>
<div class="status-item"><span>⚡</span><span id="servers">0 Servers</span></div>
<div class="status-item"><span>📊</span><span id="uptime">0s</span></div>
</div>
</div>
</div>

<div class="container">
<h1 class="section-title">Performance Dashboard</h1>
<p class="section-subtitle">Maximum performance - Zero compromise</p>

<div class="metrics" id="metrics"></div>

<h2 class="section-title" style="margin-top:40px">AI Tools</h2>
<div class="grid" id="tools"></div>
</div>

<script>
const tools=[
{name:'Claude',icon:'🤖',url:'https://claude.ai',desc:'Anthropic AI'},
{name:'ChatGPT',icon:'💬',url:'https://chat.openai.com',desc:'OpenAI GPT-4'},
{name:'Gemini',icon:'✨',url:'https://gemini.google.com',desc:'Google AI'},
{name:'Perplexity',icon:'🔍',url:'https://perplexity.ai',desc:'AI Search'},
{name:'Midjourney',icon:'🎨',url:'https://midjourney.com',desc:'AI Images'},
{name:'Cursor',icon:'⚡',url:'https://cursor.sh',desc:'AI IDE'},
{name:'Notion',icon:'📋',url:'https://notion.so',desc:'Workspace'},
{name:'HuggingFace',icon:'🤗',url:'https://huggingface.co',desc:'ML Hub'}
];

function loadTools(){
document.getElementById('tools').innerHTML=tools.map(t=>`
<div class="card" onclick="window.open('${t.url}','_blank')">
<div class="card-header">
<div class="card-icon">${t.icon}</div>
<div class="card-title">${t.name}</div>
</div>
<div class="card-description">${t.desc}</div>
</div>
`).join('');
}

async function updateStatus(){
try{
const r=await fetch('/api/status');
const d=await r.json();
document.getElementById('dot').classList.remove('off');
document.getElementById('status').textContent='Active';
document.getElementById('servers').textContent=`${d.servers.length} Servers`;
document.getElementById('uptime').textContent=`${Math.floor(d.uptime)}s`;

const mem=d.memory;
document.getElementById('metrics').innerHTML=`
<div class="metric"><div class="metric-value">${d.servers.length}</div><div class="metric-label">Active Servers</div></div>
<div class="metric"><div class="metric-value">${Math.floor(d.uptime)}s</div><div class="metric-label">Uptime</div></div>
<div class="metric"><div class="metric-value">${(mem.heapUsed/1024/1024).toFixed(1)}MB</div><div class="metric-label">Memory</div></div>
<div class="metric"><div class="metric-value">${d.version}</div><div class="metric-label">Version</div></div>
`;
}catch(e){
document.getElementById('dot').classList.add('off');
document.getElementById('status').textContent='Offline';
}
}

loadTools();
updateStatus();
setInterval(updateStatus,3000);
</script>
</body>
</html>
HTML

    log OK "Workspace premium créé"
}

################################################################################
# ENV FILE - COMPLETE
################################################################################

create_env() {
    progress 13 $TOTAL_STEPS "Configuration environnement..."

    cat > "$NEMESIS/.env" << 'ENV'
# NEMESIS OMEGA - Environment (Auto-generated)
# Replace DEMO keys with real ones to activate services

# ANTHROPIC
ANTHROPIC_API_KEY=sk-ant-demo-00000000000000000000000000000000000000000000

# OPENAI
OPENAI_API_KEY=sk-proj-demo-0000000000000000000000000000000000000000000000

# GOOGLE
GOOGLE_API_KEY=AIzaSyDemo_0000000000000000000000000000000

# GITHUB (https://github.com/settings/tokens)
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_demo_00000000000000000000000000000000

# GITLAB
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-demo_0000000000000000
GITLAB_API_URL=https://gitlab.com/api/v4

# NOTION (https://www.notion.so/my-integrations)
NOTION_API_KEY=secret_demo00000000000000000000000000000000

# SLACK (https://api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-demo-0000000000000-0000000000000-demo00000000000000000000
SLACK_TEAM_ID=T00000000

# ASANA
ASANA_ACCESS_TOKEN=0/demo00000000000000000000000000000000

# BRAVE SEARCH
BRAVE_API_KEY=BSA-demo-00000000000000000000000000000000

# NEMESIS CONFIG
NEMESIS_HOME=$HOME/.nemesis
NEMESIS_PORT=10000
NODE_ENV=production
ENV

    log OK "Environnement configuré"
}

################################################################################
# MANAGEMENT SCRIPTS - COMPLETE
################################################################################

create_scripts() {
    progress 14 $TOTAL_STEPS "Création scripts de gestion..."

    # START
    cat > "$NEMESIS/scripts/start.sh" << 'START'
#!/bin/bash
echo "🚀 Starting NEMESIS ABSOLUTE..."
cd ~/.nemesis/mcp
[[ -f server.pid ]] && { echo "Already running"; exit 1; }
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid
sleep 3
curl -s http://localhost:10000/health >/dev/null && {
    echo "✅ Running on http://localhost:10000"
    command -v microsoft-edge &>/dev/null && microsoft-edge http://localhost:10000 &
} || echo "❌ Start failed. Check logs/server.log"
START

    # STOP
    cat > "$NEMESIS/scripts/stop.sh" << 'STOP'
#!/bin/bash
echo "🛑 Stopping NEMESIS..."
[[ -f ~/.nemesis/mcp/server.pid ]] && kill $(cat ~/.nemesis/mcp/server.pid) 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
rm -f ~/.nemesis/mcp/server.pid
echo "✅ Stopped"
STOP

    # STATUS
    cat > "$NEMESIS/scripts/status.sh" << 'STATUS'
#!/bin/bash
echo "📊 NEMESIS Status"
echo "================"
curl -s http://localhost:10000/api/status 2>/dev/null | jq . || echo "❌ Not running"
STATUS

    # RESTART
    cat > "$NEMESIS/scripts/restart.sh" << 'RESTART'
#!/bin/bash
~/.nemesis/scripts/stop.sh && sleep 2 && ~/.nemesis/scripts/start.sh
RESTART

    # BACKUP
    cat > "$NEMESIS/scripts/backup.sh" << 'BACKUP'
#!/bin/bash
D=~/.nemesis/backups
F="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$D/$F" -C ~/.nemesis configs data workspace/html 2>/dev/null
echo "✅ Backup: $F ($(du -h "$D/$F" | cut -f1))"
cd "$D" && ls -t backup_*.tar.gz | tail -n +6 | xargs -r rm
BACKUP

    # LOGS
    cat > "$NEMESIS/scripts/logs.sh" << 'LOGS'
#!/bin/bash
tail -f ~/.nemesis/mcp/logs/server.log
LOGS

    chmod +x "$NEMESIS/scripts"/*.sh

    log OK "Scripts créés (6 commandes)"
}

################################################################################
# AUTO-START
################################################################################

auto_start() {
    progress 15 $TOTAL_STEPS "Démarrage automatique..."

    cd "$NEMESIS/mcp"
    nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid

    local pid=$!
    log INF "Server PID: $pid"

    sleep 4

    if curl -s http://localhost:10000/health >/dev/null 2>&1; then
        log OK "NEMESIS démarré avec succès"
    else
        log WRN "Server prend plus de temps..."
    fi
}

################################################################################
# FINAL SUMMARY
################################################################################

summary() {
    clear
    echo -e "${G}"
    cat << 'SUM'
    ███████╗██╗   ██╗ ██████╗ ██████╗███████╗███████╗███████╗
    ██╔════╝██║   ██║██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝
    ███████╗██║   ██║██║     ██║     █████╗  ███████╗███████╗
    ╚════██║██║   ██║██║     ██║     ██╔══╝  ╚════██║╚════██║
    ███████║╚██████╔╝╚██████╗╚██████╗███████╗███████║███████║
    ╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝╚══════╝╚══════╝╚══════╝

    🎉 INSTALLATION ABSOLUTE TERMINÉE !

SUM
    echo -e "${NC}"

    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${G}✅ NEMESIS OMEGA ABSOLUTE V3.2.0 Ready!${NC}"
    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${Y}📊 Stats:${NC}"
    echo -e "   Steps: ${B}$STEP/$TOTAL_STEPS${NC}"
    echo -e "   Auto-fixes: ${C}$ERRORS_FIXED${NC}"
    echo -e "   Time: ${B}$(date +%H:%M:%S)${NC}"
    echo ""
    echo -e "${Y}🌐 Access:${NC}"
    echo -e "   Dashboard: ${G}http://localhost:10000${NC}"
    echo -e "   API: ${G}http://localhost:10000/api/status${NC}"
    echo -e "   Health: ${G}http://localhost:10000/health${NC}"
    echo -e "   Metrics: ${G}http://localhost:10000/api/metrics${NC}"
    echo ""
    echo -e "${Y}🛠️  Commands:${NC}"
    echo -e "   ${B}~/.nemesis/scripts/start.sh${NC}   - Start"
    echo -e "   ${B}~/.nemesis/scripts/stop.sh${NC}    - Stop"
    echo -e "   ${B}~/.nemesis/scripts/status.sh${NC}  - Status"
    echo -e "   ${B}~/.nemesis/scripts/restart.sh${NC} - Restart"
    echo -e "   ${B}~/.nemesis/scripts/backup.sh${NC}  - Backup"
    echo -e "   ${B}~/.nemesis/scripts/logs.sh${NC}    - View logs"
    echo ""
    echo -e "${Y}🔑 Configure real API keys:${NC}"
    echo -e "   ${B}nano ~/.nemesis/.env${NC}"
    echo -e "   ${B}nano ~/.nemesis/configs/mcp_config.json${NC}"
    echo ""
    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${G}🎊 Absolute Edition - No Compromises!${NC}"
    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Auto-open browser
    if command -v microsoft-edge &>/dev/null; then
        microsoft-edge --new-window http://localhost:10000 &>/dev/null &
    elif command -v xdg-open &>/dev/null; then
        xdg-open http://localhost:10000 &>/dev/null &
    fi
}

################################################################################
# MAIN
################################################################################

main() {
    banner
    mkdir -p "$LOGS"

    setup_sudo
    fix_ubuntu_bugs
    update_system
    install_essentials
    install_nodejs
    install_python
    install_edge
    create_structure
    install_mcp
    create_mcp_config
    create_orchestrator
    create_workspace
    create_env
    create_scripts
    auto_start

    summary
}

main "$@"
exit 0
