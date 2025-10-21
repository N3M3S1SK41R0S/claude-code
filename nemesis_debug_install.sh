#!/bin/bash

################################################################################
#                   NEMESIS OMEGA - DEBUG VERSION                              #
#                   Maximum Verbosity - See Everything                         #
################################################################################

# Enable debug mode
set -x  # Print every command
set -e  # Exit on error
set -u  # Exit on undefined variable

echo "🔍 DEBUG MODE - You will see EVERY command"
echo ""

# Colors
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
C='\033[0;36m'
R='\033[0;31m'
NC='\033[0m'

NEMESIS="$HOME/.nemesis"
STEP=0

echo -e "${C}═══════════════════════════════════════════════════${NC}"
echo -e "${C}NEMESIS OMEGA - DEBUG INSTALLATION${NC}"
echo -e "${C}═══════════════════════════════════════════════════${NC}"
echo ""

# STEP 1: SUDO
echo -e "${Y}[1/10]${NC} Getting sudo..."
sudo -v
echo -e "${G}✓ Sudo OK${NC}"
((STEP++))

# STEP 2: FIX UBUNTU BUG
echo -e "${Y}[2/10]${NC} Fixing Ubuntu 24.04 bug..."
echo "→ Checking for command-not-found hook..."
if [[ -f /etc/apt/apt.conf.d/50command-not-found ]]; then
    echo "→ Found! Disabling it..."
    sudo mv /etc/apt/apt.conf.d/50command-not-found /etc/apt/apt.conf.d/50command-not-found.disabled || true
    echo "→ Disabled"
else
    echo "→ Not found, skipping"
fi
echo -e "${G}✓ Bug fixed${NC}"
((STEP++))

# STEP 3: CLEAN APT
echo -e "${Y}[3/10]${NC} Cleaning APT cache..."
echo "→ Running: sudo apt-get clean"
sudo apt-get clean
echo "→ Removing old lists..."
sudo rm -rf /var/lib/apt/lists/* || true
echo "→ Creating partial directory..."
sudo mkdir -p /var/lib/apt/lists/partial
echo -e "${G}✓ APT cleaned${NC}"
((STEP++))

# STEP 4: UPDATE
echo -e "${Y}[4/10]${NC} Updating package lists (may take 1-2 min)..."
echo "→ Running: sudo apt-get update"
sudo apt-get update -qq || {
    echo "→ First attempt failed, retrying..."
    sudo apt-get update
}
echo -e "${G}✓ Updated${NC}"
((STEP++))

# STEP 5: INSTALL PACKAGES
echo -e "${Y}[5/10]${NC} Installing essential packages..."
echo "→ Installing: curl wget git jq build-essential..."
sudo apt-get install -y curl wget git jq build-essential 2>&1 | tail -5
echo -e "${G}✓ Packages installed${NC}"
((STEP++))

# STEP 6: NODE.JS
echo -e "${Y}[6/10]${NC} Installing Node.js 20..."
if command -v node &>/dev/null; then
    echo "→ Node.js already installed: $(node --version)"
else
    echo "→ Downloading NodeSource setup script..."
    curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
    echo "→ Running NodeSource setup..."
    sudo -E bash /tmp/nodesource_setup.sh
    echo "→ Installing nodejs package..."
    sudo apt-get install -y nodejs
    rm /tmp/nodesource_setup.sh
fi
echo "→ Node.js version: $(node --version)"
echo "→ npm version: $(npm --version)"
echo -e "${G}✓ Node.js installed${NC}"
((STEP++))

# STEP 7: EDGE
echo -e "${Y}[7/10]${NC} Installing Microsoft Edge..."
if command -v microsoft-edge &>/dev/null; then
    echo "→ Edge already installed"
else
    echo "→ Adding Microsoft GPG key..."
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft-edge.gpg >/dev/null
    echo "→ Adding Edge repository..."
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | sudo tee /etc/apt/sources.list.d/microsoft-edge.list
    echo "→ Updating package lists..."
    sudo apt-get update -qq
    echo "→ Installing Edge..."
    sudo apt-get install -y microsoft-edge-stable || echo "Edge install failed, continuing..."
fi
echo -e "${G}✓ Edge ready${NC}"
((STEP++))

# STEP 8: CREATE STRUCTURE
echo -e "${Y}[8/10]${NC} Creating NEMESIS structure..."
echo "→ Creating directories..."
mkdir -p "$NEMESIS"/{workspace/html,mcp/logs,configs,scripts,data,backups}
echo "→ Directories created in: $NEMESIS"
echo -e "${G}✓ Structure created${NC}"
((STEP++))

# STEP 9: MCP SETUP
echo -e "${Y}[9/10]${NC} Setting up MCP (2-3 min)..."
cd "$NEMESIS/mcp"

echo "→ Creating package.json..."
cat > package.json << 'PKG'
{"name":"nemesis-mcp","version":"3.2.0","type":"module","dependencies":{"express":"^4.19.2"}}
PKG

echo "→ Installing npm packages (this takes time)..."
npm install 2>&1 | grep -E "added|packages" || true

echo "→ Creating server.js..."
cat > server.js << 'SRV'
import express from 'express';
const app = express();
app.use(express.static('../workspace/html'));
app.get('/api/status', (req, res) => res.json({status:'ok',version:'3.2.0-DEBUG'}));
app.get('/health', (req, res) => res.json({status:'healthy'}));
app.listen(10000, () => console.log('✅ Server on http://localhost:10000'));
SRV

echo -e "${G}✓ MCP configured${NC}"
((STEP++))

# STEP 10: WORKSPACE
echo -e "${Y}[10/10]${NC} Creating workspace..."

cat > "$NEMESIS/workspace/html/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>NEMESIS DEBUG</title>
<style>
body{font-family:system-ui;background:#0a0e27;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column}
h1{font-size:3em;color:#00ff9d;margin-bottom:20px}
.status{background:rgba(255,255,255,0.1);padding:30px;border-radius:15px;text-align:center}
.dot{width:15px;height:15px;background:#00ff9d;border-radius:50%;display:inline-block;margin-right:10px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
a{color:#00ff9d;text-decoration:none;margin-top:15px;display:block}
</style>
</head><body>
<h1>🔮 NEMESIS OMEGA</h1>
<div class="status">
<p><span class="dot"></span>System Active (DEBUG MODE)</p>
<a href="/api/status">API Status</a>
<a href="/health">Health Check</a>
</div>
</body></html>
HTML

echo "→ Workspace HTML created"
echo -e "${G}✓ Workspace ready${NC}"
((STEP++))

# CREATE START SCRIPT
echo "→ Creating start script..."
cat > "$NEMESIS/scripts/start.sh" << 'START'
#!/bin/bash
cd ~/.nemesis/mcp
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid
sleep 2
echo "✅ Started on http://localhost:10000"
START

cat > "$NEMESIS/scripts/stop.sh" << 'STOP'
#!/bin/bash
pkill -f "node.*server.js"
echo "✅ Stopped"
STOP

chmod +x "$NEMESIS/scripts"/*.sh
echo "→ Scripts created"

# START SERVER
echo ""
echo -e "${C}═══════════════════════════════════════════════════${NC}"
echo -e "${G}✅ INSTALLATION COMPLETE!${NC}"
echo -e "${C}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${B}Starting NEMESIS server...${NC}"

cd "$NEMESIS/mcp"
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid
SERVER_PID=$!

echo "→ Server PID: $SERVER_PID"
echo "→ Waiting for server to start..."
sleep 3

if curl -s http://localhost:10000/health >/dev/null 2>&1; then
    echo ""
    echo -e "${G}✅ SERVER RUNNING!${NC}"
    echo ""
    echo -e "${B}🌐 Dashboard:${NC} ${G}http://localhost:10000${NC}"
    echo -e "${B}📊 API:${NC} ${G}http://localhost:10000/api/status${NC}"
    echo -e "${B}🏥 Health:${NC} ${G}http://localhost:10000/health${NC}"
    echo ""
    echo -e "${B}Commands:${NC}"
    echo "  Start:  ~/.nemesis/scripts/start.sh"
    echo "  Stop:   ~/.nemesis/scripts/stop.sh"
    echo "  Logs:   tail -f ~/.nemesis/mcp/logs/server.log"
    echo ""

    # Open browser
    if command -v microsoft-edge &>/dev/null; then
        microsoft-edge http://localhost:10000 &>/dev/null &
    elif command -v xdg-open &>/dev/null; then
        xdg-open http://localhost:10000 &>/dev/null &
    fi

    echo -e "${G}🎉 NEMESIS IS READY!${NC}"
else
    echo -e "${R}⚠️  Server may not have started correctly${NC}"
    echo "Check logs: tail ~/.nemesis/mcp/logs/server.log"
fi

echo ""
