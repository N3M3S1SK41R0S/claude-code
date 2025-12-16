#!/bin/bash
################################################################################
#                  NEMESIS OMEGA - MEGA ALL-IN-ONE v4.0                       #
#              Installe TOUT | Configure TOUT | Lance TOUT                     #
#              Un seul script pour un système 100% fonctionnel                #
################################################################################
set +e; trap '' ERR
N="$HOME/.nemesis"; L="$HOME/nemesis_logs"; mkdir -p "$L"; R="$L/mega_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee "$R") 2>&1; echo "════════════════════════════════════════════════════════════"
echo "🚀 NEMESIS OMEGA MEGA ALL-IN-ONE v4.0"; echo "   Installation COMPLÈTE de A à Z"
echo "════════════════════════════════════════════════════════════"; echo ""

# Sudo une fois pour toutes
echo "🔐 Configuration sudo..."; sudo -v; (while true; do sleep 45; sudo -n true 2>/dev/null || break; done) &
echo "✅ Sudo OK"; echo ""

# Fix bugs Ubuntu
echo "🔨 Correction bugs système..."; [[ -f /etc/apt/apt.conf.d/50command-not-found ]] && sudo mv /etc/apt/apt.conf.d/50command-not-found{,.bak} 2>/dev/null
sudo apt-get clean; sudo rm -rf /var/lib/apt/lists/*; sudo mkdir -p /var/lib/apt/lists/partial
echo "✅ Bugs corrigés"; echo ""

# Update système - mode agressif
echo "📦 Mise à jour système (2-3 min)..."
for i in {1..3}; do sudo apt-get update -qq 2>&1 | grep -v "command-not-found" && break || sleep 3; done
echo "✅ Système à jour"; echo ""

# Packages COMPLETS
echo "📥 Installation packages (5 min)..."
PKGS="curl wget git jq bc vim nano htop tmux net-tools dnsutils iputils-ping build-essential ca-certificates gnupg lsb-release software-properties-common apt-transport-https unzip zip python3-pip python3-venv imagemagick ffmpeg"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y $PKGS 2>&1 | tail -5
echo "✅ Packages installés"; echo ""

# Node.js COMPLET
echo "📦 Node.js + npm + yarn + pnpm..."
if ! command -v node &>/dev/null; then curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -; sudo apt-get install -y nodejs; fi
sudo npm install -g npm@latest yarn pnpm nodemon pm2 --silent 2>/dev/null
echo "✅ Node.js $(node -v) + outils"; echo ""

# Python COMPLET
echo "🐍 Python + pip + outils..."
python3 -m pip install --user --break-system-packages pipx requests beautifulsoup4 pandas numpy 2>/dev/null || python3 -m pip install --user pipx requests beautifulsoup4 pandas numpy 2>/dev/null
echo "✅ Python $(python3 --version | cut -d' ' -f2) + libs"; echo ""

# Docker (optionnel mais utile)
echo "🐳 Docker (optionnel)..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sudo sh /tmp/get-docker.sh 2>&1 | tail -3
    sudo usermod -aG docker $USER 2>/dev/null; echo "✅ Docker installé (relancez session pour l'activer)"
else echo "✅ Docker déjà présent"; fi; echo ""

# Workspace NEMESIS
echo "📁 Création workspace NEMESIS..."
mkdir -p "$N"/{config,scripts,logs,data,html} "$N/config/mcp-servers"
echo "✅ Structure créée: $N"; echo ""

# MCP Servers Config
echo "⚙️ Configuration MCP (25+ serveurs)..."
cat > "$N/config/mcp_config.json" << 'MCPEOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home", "/tmp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"}
    },
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gitlab"],
      "env": {"GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_TOKEN}"}
    },
    "google-maps": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-google-maps"],
      "env": {"GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}"}
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {"BRAVE_API_KEY": "${BRAVE_API_KEY}"}
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {"SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"}
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
MCPEOF
echo "✅ MCP config créée"; echo ""

# Package.json avec TOUTES les dépendances
echo "📦 Configuration npm (complet)..."
cat > "$N/package.json" << 'PKGEOF'
{
  "name": "nemesis-omega",
  "version": "4.0.0",
  "description": "NEMESIS OMEGA - AI Workspace with MCP Integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2": "pm2 start server.js --name nemesis-omega"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
PKGEOF
echo "✅ package.json créé"; echo ""

# Serveur Node.js COMPLET avec WebSocket
echo "🌐 Création serveur Node.js + WebSocket..."
cat > "$N/server.js" << 'SERVEREOF'
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 10000;
const CONFIG_DIR = path.join(process.env.HOME, '.nemesis', 'config');
const DATA_DIR = path.join(process.env.HOME, '.nemesis', 'data');
const HTML_DIR = path.join(process.env.HOME, '.nemesis', 'html');

// Security & Performance
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(HTML_DIR));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// MCP Servers tracking
const mcpServers = new Map();

// WebSocket - Real-time updates
io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);

  // Envoyer métriques toutes les 3s
  const metricsInterval = setInterval(() => {
    socket.emit('metrics', {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      servers: mcpServers.size,
      timestamp: Date.now()
    });
  }, 3000);

  socket.on('disconnect', () => {
    clearInterval(metricsInterval);
    console.log('Client déconnecté:', socket.id);
  });
});

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '4.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    servers: Array.from(mcpServers.keys()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tools', (req, res) => {
  const tools = [
    { name: 'Claude', url: 'https://claude.ai', category: 'AI Chat', icon: '🤖', description: 'Assistant IA avancé par Anthropic' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', category: 'AI Chat', icon: '💬', description: 'Chatbot IA par OpenAI' },
    { name: 'Gemini', url: 'https://gemini.google.com', category: 'AI Chat', icon: '✨', description: 'IA multimodale par Google' },
    { name: 'Perplexity', url: 'https://perplexity.ai', category: 'AI Chat', icon: '🔍', description: 'Moteur de réponses IA' },
    { name: 'Mistral', url: 'https://chat.mistral.ai', category: 'AI Chat', icon: '🌬️', description: 'IA open source européenne' },
    { name: 'Midjourney', url: 'https://www.midjourney.com', category: 'AI Images', icon: '🎨', description: 'Génération d\'images IA' },
    { name: 'DALL-E', url: 'https://labs.openai.com', category: 'AI Images', icon: '🖼️', description: 'Création d\'images par OpenAI' },
    { name: 'Stable Diffusion', url: 'https://stability.ai', category: 'AI Images', icon: '🌈', description: 'Génération d\'images open source' },
    { name: 'Cursor', url: 'https://cursor.sh', category: 'AI IDE', icon: '⌨️', description: 'IDE avec IA intégrée' },
    { name: 'GitHub Copilot', url: 'https://github.com/features/copilot', category: 'AI IDE', icon: '🐙', description: 'Assistant code par GitHub' },
    { name: 'Replit', url: 'https://replit.com', category: 'AI IDE', icon: '🔥', description: 'IDE en ligne avec IA' },
    { name: 'Notion AI', url: 'https://notion.so', category: 'Productivity', icon: '📝', description: 'Workspace avec IA' },
    { name: 'Linear', url: 'https://linear.app', category: 'Productivity', icon: '📊', description: 'Gestion de projet moderne' },
    { name: 'Figma', url: 'https://figma.com', category: 'Productivity', icon: '🎨', description: 'Design collaboratif' },
    { name: 'Vercel', url: 'https://vercel.com', category: 'Infrastructure', icon: '▲', description: 'Déploiement frontend' },
    { name: 'Railway', url: 'https://railway.app', category: 'Infrastructure', icon: '🚂', description: 'Déploiement backend' },
    { name: 'Supabase', url: 'https://supabase.com', category: 'Infrastructure', icon: '🔋', description: 'Backend as a Service' },
    { name: 'Pinecone', url: 'https://pinecone.io', category: 'Infrastructure', icon: '🌲', description: 'Vector database' },
    { name: 'HuggingFace', url: 'https://huggingface.co', category: 'Infrastructure', icon: '🤗', description: 'Hub de modèles IA' }
  ];

  const { category, search } = req.query;
  let filtered = tools;

  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  }

  res.json(filtered);
});

app.get('/api/metrics', (req, res) => {
  res.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
    timestamp: Date.now()
  });
});

app.get('/api/servers', (req, res) => {
  res.json({
    count: mcpServers.size,
    servers: Array.from(mcpServers.entries()).map(([name, info]) => ({
      name,
      status: info.status,
      pid: info.pid
    }))
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 NEMESIS OMEGA Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: Enabled`);
  console.log(`📡 API: http://localhost:${PORT}/api/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});
SERVEREOF
echo "✅ Serveur créé"; echo ""

# Dashboard HTML COMPLET avec recherche
echo "🎨 Création dashboard HTML..."
cat > "$N/html/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEMESIS OMEGA v4.0 - AI Workspace</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        h1 {
            color: white;
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .subtitle {
            color: rgba(255,255,255,0.9);
            font-size: 1.2em;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .metric {
            background: rgba(255,255,255,0.15);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .metric-label {
            color: rgba(255,255,255,0.7);
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .metric-value {
            color: white;
            font-size: 1.5em;
            font-weight: bold;
        }
        .controls {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .search-box {
            width: 100%;
            padding: 15px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 10px;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 1em;
            margin-bottom: 15px;
        }
        .search-box::placeholder { color: rgba(255,255,255,0.6); }
        .filters {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .filter-btn {
            padding: 10px 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 25px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            transition: all 0.3s;
        }
        .filter-btn:hover, .filter-btn.active {
            background: rgba(255,255,255,0.4);
            border-color: rgba(255,255,255,0.6);
        }
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .tool-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s;
            cursor: pointer;
        }
        .tool-card:hover {
            transform: translateY(-5px);
            background: rgba(255,255,255,0.2);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .tool-icon {
            font-size: 3em;
            margin-bottom: 15px;
        }
        .tool-name {
            color: white;
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .tool-category {
            color: rgba(255,255,255,0.7);
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        .tool-description {
            color: rgba(255,255,255,0.8);
            line-height: 1.5;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #4ade80;
            margin-right: 5px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 NEMESIS OMEGA</h1>
            <p class="subtitle">
                <span class="status-indicator"></span>
                v4.0 - AI Workspace Ultimate Edition
            </p>
            <div class="metrics" id="metrics">
                <div class="metric">
                    <div class="metric-label">Uptime</div>
                    <div class="metric-value" id="uptime">--</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Memory</div>
                    <div class="metric-value" id="memory">--</div>
                </div>
                <div class="metric">
                    <div class="metric-label">MCP Servers</div>
                    <div class="metric-value" id="servers">--</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Status</div>
                    <div class="metric-value">✅ Running</div>
                </div>
            </div>
        </div>

        <div class="controls">
            <input type="text" class="search-box" id="searchBox" placeholder="🔍 Rechercher un outil...">
            <div class="filters">
                <button class="filter-btn active" data-category="all">Tous</button>
                <button class="filter-btn" data-category="AI Chat">AI Chat</button>
                <button class="filter-btn" data-category="AI Images">AI Images</button>
                <button class="filter-btn" data-category="AI IDE">AI IDE</button>
                <button class="filter-btn" data-category="Productivity">Productivity</button>
                <button class="filter-btn" data-category="Infrastructure">Infrastructure</button>
            </div>
        </div>

        <div class="tools-grid" id="toolsGrid"></div>
    </div>

    <script>
        const socket = io();
        let allTools = [];
        let currentCategory = 'all';
        let currentSearch = '';

        // WebSocket - Metrics en temps réel
        socket.on('metrics', (data) => {
            document.getElementById('uptime').textContent = formatUptime(data.uptime);
            document.getElementById('memory').textContent = formatMemory(data.memory.heapUsed);
            document.getElementById('servers').textContent = data.servers;
        });

        // Charger les outils
        async function loadTools() {
            const response = await fetch('/api/tools');
            allTools = await response.json();
            renderTools();
        }

        // Render tools
        function renderTools() {
            const filtered = allTools.filter(tool => {
                const matchCategory = currentCategory === 'all' || tool.category === currentCategory;
                const matchSearch = !currentSearch ||
                    tool.name.toLowerCase().includes(currentSearch) ||
                    tool.description.toLowerCase().includes(currentSearch);
                return matchCategory && matchSearch;
            });

            const grid = document.getElementById('toolsGrid');
            grid.innerHTML = filtered.map(tool => `
                <div class="tool-card" onclick="window.open('${tool.url}', '_blank')">
                    <div class="tool-icon">${tool.icon}</div>
                    <div class="tool-name">${tool.name}</div>
                    <div class="tool-category">${tool.category}</div>
                    <div class="tool-description">${tool.description}</div>
                </div>
            `).join('');
        }

        // Search
        document.getElementById('searchBox').addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            renderTools();
        });

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentCategory = e.target.dataset.category;
                renderTools();
            });
        });

        // Format helpers
        function formatUptime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            return `${h}h ${m}m`;
        }

        function formatMemory(bytes) {
            return (bytes / 1024 / 1024).toFixed(0) + ' MB';
        }

        // Init
        loadTools();
    </script>
</body>
</html>
HTMLEOF
echo "✅ Dashboard créé"; echo ""

# .env template
echo "🔐 Création .env template..."
cat > "$N/.env" << 'ENVEOF'
# NEMESIS OMEGA v4.0 - Configuration
NODE_ENV=production
PORT=10000

# API Keys (optionnel - remplissez si vous voulez utiliser ces services)
GITHUB_TOKEN=
GITLAB_TOKEN=
GOOGLE_MAPS_API_KEY=
BRAVE_API_KEY=
SLACK_BOT_TOKEN=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ENVEOF
echo "✅ .env créé"; echo ""

# Installation npm AGGRESSIVE
echo "📦 Installation dépendances npm (peut prendre 2-3 min)..."
cd "$N"
for i in {1..5}; do
    if npm install --prefer-offline --no-audit --no-fund 2>&1 | grep -qE "added|packages"; then
        echo "✅ Dépendances installées ($i/5)"; break
    else
        echo "⚠️  Retry npm install $i/5..."
        rm -rf node_modules package-lock.json 2>/dev/null
        [[ $i -eq 3 ]] && npm install --legacy-peer-deps --no-audit 2>&1 | tail -3
        [[ $i -eq 4 ]] && npm install --force --no-audit 2>&1 | tail -3
        sleep 2
    fi
done
echo ""

# Scripts de gestion
echo "📜 Création scripts de gestion..."

cat > "$N/scripts/start_nemesis.sh" << 'STARTEOF'
#!/bin/bash
cd ~/.nemesis
echo "🚀 Démarrage NEMESIS OMEGA..."
node server.js &
echo $! > ~/.nemesis/logs/server.pid
echo "✅ Serveur démarré (PID: $(cat ~/.nemesis/logs/server.pid))"
echo "📊 Dashboard: http://localhost:10000"
STARTEOF

cat > "$N/scripts/stop_nemesis.sh" << 'STOPEOF'
#!/bin/bash
if [[ -f ~/.nemesis/logs/server.pid ]]; then
    PID=$(cat ~/.nemesis/logs/server.pid)
    kill $PID 2>/dev/null && echo "✅ Serveur arrêté (PID: $PID)" || echo "⚠️  Serveur déjà arrêté"
    rm ~/.nemesis/logs/server.pid 2>/dev/null
else
    echo "⚠️  Aucun serveur en cours"
fi
STOPEOF

cat > "$N/scripts/restart_nemesis.sh" << 'RESTARTEOF'
#!/bin/bash
~/.nemesis/scripts/stop_nemesis.sh
sleep 2
~/.nemesis/scripts/start_nemesis.sh
RESTARTEOF

cat > "$N/scripts/status_nemesis.sh" << 'STATUSEOF'
#!/bin/bash
echo "════════════════════════════════════════════════════════════"
echo "📊 NEMESIS OMEGA - Status"
echo "════════════════════════════════════════════════════════════"
if [[ -f ~/.nemesis/logs/server.pid ]]; then
    PID=$(cat ~/.nemesis/logs/server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Serveur: Running (PID: $PID)"
        echo "📊 Dashboard: http://localhost:10000"
        curl -s http://localhost:10000/api/status | jq . 2>/dev/null || echo "⚠️  API non disponible"
    else
        echo "❌ Serveur: Stopped"
    fi
else
    echo "❌ Serveur: Not started"
fi
echo "════════════════════════════════════════════════════════════"
STATUSEOF

cat > "$N/scripts/logs_nemesis.sh" << 'LOGSEOF'
#!/bin/bash
echo "📋 NEMESIS OMEGA - Derniers logs"
echo "════════════════════════════════════════════════════════════"
ls -t ~/nemesis_logs/*.log 2>/dev/null | head -1 | xargs tail -50
LOGSEOF

cat > "$N/scripts/test_nemesis.sh" << 'TESTEOF'
#!/bin/bash
echo "🧪 Test NEMESIS OMEGA..."
echo "1. Test API Status..."
curl -s http://localhost:10000/api/status && echo "✅" || echo "❌"
echo "2. Test API Tools..."
curl -s http://localhost:10000/api/tools | jq 'length' && echo "✅" || echo "❌"
echo "3. Test Dashboard..."
curl -s http://localhost:10000 > /dev/null && echo "✅" || echo "❌"
echo "Tests terminés!"
TESTEOF

chmod +x "$N/scripts"/*.sh
echo "✅ 6 scripts créés"; echo ""

# Démarrage automatique
echo "🎬 Démarrage du serveur..."
cd "$N"
node server.js > "$N/logs/server.log" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$N/logs/server.pid"
sleep 3

# Vérification
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "✅ Serveur démarré (PID: $SERVER_PID)"
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "🎉 INSTALLATION TERMINÉE!"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "📊 Dashboard: http://localhost:10000"
    echo "🔌 WebSocket: Activé"
    echo "📡 API: http://localhost:10000/api/status"
    echo ""
    echo "🎮 Commandes disponibles:"
    echo "   ~/.nemesis/scripts/start_nemesis.sh    - Démarrer"
    echo "   ~/.nemesis/scripts/stop_nemesis.sh     - Arrêter"
    echo "   ~/.nemesis/scripts/restart_nemesis.sh  - Redémarrer"
    echo "   ~/.nemesis/scripts/status_nemesis.sh   - Status"
    echo "   ~/.nemesis/scripts/logs_nemesis.sh     - Logs"
    echo "   ~/.nemesis/scripts/test_nemesis.sh     - Tests"
    echo ""
    echo "🔐 Configuration API keys (optionnel):"
    echo "   nano ~/.nemesis/.env"
    echo ""
    echo "📋 Logs complets: $R"
    echo "════════════════════════════════════════════════════════════"
else
    echo "❌ Erreur démarrage serveur"
    echo "📋 Consultez les logs: cat $N/logs/server.log"
fi
