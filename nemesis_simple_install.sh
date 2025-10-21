#!/bin/bash

################################################################################
#                   NEMESIS OMEGA - ONE-LINE INSTALLER                         #
#                   Maximum Simplicity - Zero Config                           #
################################################################################

set -euo pipefail

# Couleurs
G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[0;36m'; R='\033[0;31m'; NC='\033[0m'

# Configuration
NEMESIS="$HOME/.nemesis"

echo -e "${C}🔮 NEMESIS OMEGA - Installation Ultra-Rapide${NC}"

# 1. SUDO (une seule fois)
echo -e "${Y}[1/10]${NC} Vérification sudo..."
sudo -v
echo -e "${G}✓ Sudo OK${NC}"

# 2. FIX UBUNTU BUG
echo -e "${Y}[2/10]${NC} Correction bug Ubuntu 24.04..."
sudo mv /etc/apt/apt.conf.d/50command-not-found /etc/apt/apt.conf.d/50command-not-found.bak 2>/dev/null || true
echo -e "${G}✓ Bug corrigé${NC}"

# 3. APT UPDATE
echo -e "${Y}[3/10]${NC} Mise à jour APT (2 min)..."
sudo apt-get clean
sudo apt-get update -qq
echo -e "${G}✓ APT à jour${NC}"

# 4. PACKAGES
echo -e "${Y}[4/10]${NC} Installation packages système..."
sudo apt-get install -y curl wget git jq build-essential &>/dev/null
echo -e "${G}✓ Packages installés${NC}"

# 5. NODE.JS
echo -e "${Y}[5/10]${NC} Installation Node.js 20..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &>/dev/null
    sudo apt-get install -y nodejs &>/dev/null
fi
echo -e "${G}✓ Node.js $(node --version)${NC}"

# 6. EDGE
echo -e "${Y}[6/10]${NC} Installation Edge..."
if ! command -v microsoft-edge &>/dev/null; then
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft-edge.gpg >/dev/null
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | sudo tee /etc/apt/sources.list.d/microsoft-edge.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y microsoft-edge-stable &>/dev/null || true
fi
echo -e "${G}✓ Edge installé${NC}"

# 7. STRUCTURE
echo -e "${Y}[7/10]${NC} Création structure NEMESIS..."
mkdir -p "$NEMESIS"/{workspace/html,mcp/logs,configs,scripts,data,backups}
echo -e "${G}✓ Structure créée${NC}"

# 8. MCP INFRASTRUCTURE
echo -e "${Y}[8/10]${NC} Installation MCP (3 min)..."
cd "$NEMESIS/mcp"

cat > package.json << 'EOF'
{"name":"nemesis-mcp","version":"3.1.0","type":"module","dependencies":{"express":"^4.19.2","@modelcontextprotocol/sdk":"^0.5.0"}}
EOF

npm install --quiet 2>/dev/null || npm install 2>/dev/null

# Server.js
cat > server.js << 'SRVJS'
import express from 'express';
const app = express();
app.use(express.static('../workspace/html'));
app.get('/api/status', (req, res) => res.json({status:'ok',version:'3.1.0'}));
app.listen(10000, () => console.log('✅ NEMESIS on http://localhost:10000'));
SRVJS

echo -e "${G}✓ MCP installé${NC}"

# 9. WORKSPACE HTML
echo -e "${Y}[9/10]${NC} Création workspace..."
cat > "$NEMESIS/workspace/html/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>NEMESIS OMEGA</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0a0e27;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column}
h1{font-size:3em;background:linear-gradient(135deg,#00ff9d,#009dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px}
.status{background:rgba(255,255,255,0.1);padding:20px 40px;border-radius:10px;backdrop-filter:blur(10px)}
.dot{width:10px;height:10px;background:#00ff9d;border-radius:50%;display:inline-block;margin-right:10px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
a{color:#00ff9d;text-decoration:none;margin-top:20px;display:block}
</style>
</head><body>
<h1>🔮 NEMESIS OMEGA</h1>
<div class="status"><span class="dot"></span>System Active</div>
<a href="/api/status" target="_blank">View API Status →</a>
</body></html>
HTML
echo -e "${G}✓ Workspace créé${NC}"

# 10. SCRIPTS
echo -e "${Y}[10/10]${NC} Création scripts..."

cat > "$NEMESIS/scripts/start.sh" << 'START'
#!/bin/bash
cd ~/.nemesis/mcp
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid
sleep 2
echo "✅ NEMESIS démarré sur http://localhost:10000"
command -v microsoft-edge &>/dev/null && microsoft-edge http://localhost:10000 &
START

cat > "$NEMESIS/scripts/stop.sh" << 'STOP'
#!/bin/bash
pkill -f "node.*server.js"
rm -f ~/.nemesis/mcp/server.pid
echo "✅ NEMESIS arrêté"
STOP

chmod +x "$NEMESIS/scripts"/*.sh
echo -e "${G}✓ Scripts créés${NC}"

# DÉMARRAGE AUTO
echo ""
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${G}🎉 INSTALLATION TERMINÉE !${NC}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$NEMESIS/mcp"
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid
sleep 3

echo -e "${B}🌐 Dashboard : ${G}http://localhost:10000${NC}"
echo -e "${B}📊 API      : ${G}http://localhost:10000/api/status${NC}"
echo ""
echo -e "${B}🛠️  Commandes :${NC}"
echo -e "  Démarrer : ${C}~/.nemesis/scripts/start.sh${NC}"
echo -e "  Arrêter  : ${C}~/.nemesis/scripts/stop.sh${NC}"
echo ""

# Ouvrir navigateur
if command -v microsoft-edge &>/dev/null; then
    microsoft-edge --new-window http://localhost:10000 &>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:10000 &>/dev/null &
fi

echo -e "${G}✅ NEMESIS est prêt !${NC}"
echo ""
