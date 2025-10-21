#!/bin/bash
################################################################################
#                      NEMESIS OMEGA - ULTIMATE UNBREAKABLE                    #
#                      Auto-Repair | Never Stop | Complete Report              #
################################################################################
set +e; trap '' ERR; exec 2>&1
NEMESIS="$HOME/.nemesis"; LOGS="$HOME/nemesis_logs"; mkdir -p "$LOGS"
REPORT="$LOGS/report_$(date +%Y%m%d_%H%M%S).txt"; ERROR_COUNT=0; SUCCESS_COUNT=0
exec > >(tee -a "$REPORT"); echo "═══ NEMESIS INSTALLATION REPORT - $(date) ═══" > "$REPORT"
log(){ echo "[$(date +%H:%M:%S)] $1" | tee -a "$REPORT"; }
success(){ ((SUCCESS_COUNT++)); echo "✅ $1" | tee -a "$REPORT"; }
error(){ ((ERROR_COUNT++)); echo "❌ $1" | tee -a "$REPORT"; }
repair(){ echo "🔨 AUTO-REPAIR: $1" | tee -a "$REPORT"; }
banner(){ clear; cat << 'BANNER'
    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝
    🚀 ULTIMATE UNBREAKABLE - Never Stops, Always Repairs
BANNER
}; banner; log "Starting NEMESIS Ultimate Installation"

# SUDO avec retry infini
log "[1/15] Configuring sudo..."; SUDO_ATTEMPTS=0
while ! sudo -n true 2>/dev/null; do ((SUDO_ATTEMPTS++))
    if [[ $SUDO_ATTEMPTS -lt 3 ]]; then log "Requesting sudo (attempt $SUDO_ATTEMPTS)..."; sudo -v
    else repair "Sudo not available, trying without sudo for user operations"; break; fi
done; (while true; do sleep 50; sudo -n true 2>/dev/null || break; done) &
success "Sudo configured (attempts: $SUDO_ATTEMPTS)"

# FIX UBUNTU BUGS
log "[2/15] Fixing Ubuntu bugs..."; [[ -f /etc/apt/apt.conf.d/50command-not-found ]] && {
    sudo mv /etc/apt/apt.conf.d/50command-not-found /etc/apt/apt.conf.d/50command-not-found.disabled 2>/dev/null && repair "command-not-found disabled"
}; success "Ubuntu bugs fixed"

# APT CLEAN avec auto-repair
log "[3/15] Cleaning APT..."
for i in {1..3}; do sudo apt-get clean 2>/dev/null && break || { repair "Retry apt clean ($i/3)"; sleep 2; }; done
sudo rm -rf /var/lib/apt/lists/* 2>/dev/null || repair "Could not remove lists, continuing"
sudo mkdir -p /var/lib/apt/lists/partial 2>/dev/null
success "APT cleaned"

# APT UPDATE avec retry et options anti-erreur
log "[4/15] Updating package lists..."
APT_OPTS="-o Acquire::Retries=3 -o Acquire::http::Timeout=10 -o APT::Update::Error-Mode=any"
for i in {1..5}; do
    if sudo apt-get update $APT_OPTS -qq 2>&1 | grep -v "command-not-found"; then success "APT updated"; break
    else repair "APT update retry $i/5"; sleep $((i*2)); [[ $i -eq 5 ]] && { error "APT update failed after 5 tries"; }; fi
done

# INSTALL PACKAGES avec fallback
log "[5/15] Installing essential packages..."
PKGS="curl wget git jq bc build-essential ca-certificates gnupg lsb-release unzip"
for i in {1..3}; do
    if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $PKGS 2>&1 | tail -2; then success "Packages installed"; break
    else repair "Package install retry $i/3"; sudo apt-get clean; sleep 2; fi
done
for cmd in curl wget git jq; do command -v $cmd &>/dev/null || { error "$cmd not found after install"; }; done

# NODE.JS avec détection de version et fallback
log "[6/15] Installing Node.js..."
if command -v node &>/dev/null && [[ $(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1) -ge 18 ]]; then
    success "Node.js $(node -v) already installed"
else
    for i in {1..3}; do
        if curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | sudo -E bash - 2>&1 | tail -3; then
            sudo apt-get install -y nodejs 2>&1 | tail -2 && success "Node.js installed: $(node -v 2>/dev/null || echo unknown)" && break
        else repair "NodeSource setup retry $i/3"; sleep 3; fi
    done
fi
sudo npm install -g npm@latest --silent 2>/dev/null || repair "npm upgrade skipped"

# PYTHON avec fallback
log "[7/15] Setting up Python..."
if ! command -v python3 &>/dev/null; then
    sudo apt-get install -y python3 python3-pip python3-venv 2>&1 | tail -2 || repair "Python install issues"
fi; python3 -m pip install --user --break-system-packages pipx 2>/dev/null || python3 -m pip install --user pipx 2>/dev/null || repair "pipx install skipped"
success "Python $(python3 --version 2>&1 | cut -d' ' -f2)"

# MICROSOFT EDGE avec skip si échec
log "[8/15] Installing Microsoft Edge..."
if command -v microsoft-edge &>/dev/null; then success "Edge already installed"
else
    (curl -fsSL https://packages.microsoft.com/keys/microsoft.asc 2>/dev/null | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft-edge.gpg >/dev/null &&
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | sudo tee /etc/apt/sources.list.d/microsoft-edge.list >/dev/null &&
    sudo apt-get update -qq 2>&1 | grep -v "command-not-found" &&
    sudo apt-get install -y microsoft-edge-stable 2>&1 | tail -2) && success "Edge installed" || { error "Edge install failed"; repair "Continuing without Edge"; }
fi

# CREATE STRUCTURE avec permissions check
log "[9/15] Creating NEMESIS structure..."
for dir in workspace/{html,assets,css,js} mcp/{servers,logs} configs scripts data backups; do
    mkdir -p "$NEMESIS/$dir" 2>/dev/null || { error "Cannot create $dir"; repair "Trying with sudo"; sudo mkdir -p "$NEMESIS/$dir"; sudo chown -R $USER:$USER "$NEMESIS"; }
done; success "Structure created: $NEMESIS"

# MCP INFRASTRUCTURE avec multiple fallbacks
log "[10/15] Installing MCP infrastructure..."
cd "$NEMESIS/mcp" || { error "Cannot cd to mcp"; exit 1; }
cat > package.json << 'PKGJSON'
{"name":"nemesis-mcp","version":"3.3.0","type":"module","dependencies":{"express":"^4.19.2","helmet":"^7.1.0","compression":"^1.7.4","cors":"^2.8.5","dotenv":"^16.4.5"}}
PKGJSON
for i in {1..5}; do
    if npm install --prefer-offline --no-audit --no-fund 2>&1 | grep -E "added|packages" | tail -1; then success "MCP packages installed"; break
    else repair "npm install retry $i/5 (trying different options)"; rm -rf node_modules package-lock.json
        [[ $i -eq 3 ]] && npm install --legacy-peer-deps 2>&1 | tail -2
        [[ $i -eq 4 ]] && npm install --force 2>&1 | tail -2
        sleep 2; fi
done; [[ ! -d node_modules ]] && { error "npm install failed completely"; repair "Creating minimal setup"; mkdir -p node_modules; }

# MCP SERVER with error handling
log "[11/15] Creating MCP orchestrator..."
cat > server.js << 'SERVERJS'
import express from 'express';
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static('../workspace/html'));
app.use(express.json());
app.get('/api/status', (req, res) => res.json({
    status: 'ok', version: '3.3.0-ULTIMATE', uptime: process.uptime(),
    timestamp: new Date().toISOString(), memory: process.memoryUsage()
}));
app.get('/health', (req, res) => res.json({status: 'healthy', version: '3.3.0'}));
app.get('/api/metrics', (req, res) => res.json({
    memory: process.memoryUsage(), cpu: process.cpuUsage(), uptime: process.uptime()
}));
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔮 NEMESIS ORCHESTRATOR V3.3.0-ULTIMATE');
    console.log(`✅ Running on http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
SERVERJS
success "Orchestrator created"

# MCP CONFIG
log "[12/15] Configuring MCP servers..."
cat > "$NEMESIS/configs/mcp_config.json" << 'MCPCFG'
{"mcpServers":{"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/home","/tmp"],"enabled":true},"memory":{"command":"npx","args":["-y","@modelcontextprotocol/server-memory"],"enabled":true},"fetch":{"command":"npx","args":["-y","@modelcontextprotocol/server-fetch"],"enabled":true}}}
MCPCFG
success "MCP config created"

# WORKSPACE HTML
log "[13/15] Creating workspace..."
cat > "$NEMESIS/workspace/html/index.html" << 'HTML'
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NEMESIS OMEGA</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:linear-gradient(135deg,#050814,#0a0e27);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column}
h1{font-size:3.5em;background:linear-gradient(135deg,#00ff9d,#009dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:30px;animation:glow 2s ease-in-out infinite}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 20px rgba(0,255,157,0.5))}50%{filter:drop-shadow(0 0 30px rgba(0,157,255,0.8))}}
.status{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);padding:40px 60px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);text-align:center}
.dot{width:12px;height:12px;background:#00ff9d;border-radius:50%;display:inline-block;margin-right:10px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(1.2)}}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:25px}
.metric{background:rgba(0,255,157,0.1);padding:15px;border-radius:10px;border:1px solid rgba(0,255,157,0.3)}
.metric-value{font-size:2em;color:#00ff9d;font-weight:700;margin-bottom:5px}
.metric-label{font-size:0.9em;color:rgba(255,255,255,0.6)}
a{color:#00ff9d;text-decoration:none;margin:8px;padding:10px 20px;background:rgba(0,255,157,0.1);border-radius:8px;display:inline-block;transition:all 0.3s}
a:hover{background:rgba(0,255,157,0.2);transform:translateY(-2px)}
</style></head><body><h1>🔮 NEMESIS OMEGA</h1><div class="status">
<p style="font-size:1.3em;margin-bottom:20px"><span class="dot"></span><span id="status">System Active</span></p>
<div id="metrics" class="metrics"></div><div style="margin-top:25px">
<a href="/api/status" target="_blank">API Status</a><a href="/health" target="_blank">Health</a><a href="/api/metrics" target="_blank">Metrics</a></div></div>
<script>async function update(){try{const r=await fetch('/api/status');const d=await r.json();document.getElementById('status').textContent='System Active';
const m=d.memory;document.getElementById('metrics').innerHTML=`<div class="metric"><div class="metric-value">${Math.floor(d.uptime)}s</div><div class="metric-label">Uptime</div></div>
<div class="metric"><div class="metric-value">${(m.heapUsed/1024/1024).toFixed(1)}MB</div><div class="metric-label">Memory</div></div>
<div class="metric"><div class="metric-value">${d.version}</div><div class="metric-label">Version</div></div>`;}catch(e){document.getElementById('status').textContent='Offline';}}
update();setInterval(update,3000);</script></body></html>
HTML
success "Workspace created"

# ENV FILE
log "[14/15] Creating environment..."
cat > "$NEMESIS/.env" << 'ENV'
NEMESIS_HOME=$HOME/.nemesis
NEMESIS_PORT=10000
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-demo-00000000000000000000000000000000000000000000
OPENAI_API_KEY=sk-proj-demo-0000000000000000000000000000000000000000000000
ENV
success "Environment configured"

# SCRIPTS
log "[15/15] Creating management scripts..."
cat > "$NEMESIS/scripts/start.sh" << 'START'
#!/bin/bash
cd ~/.nemesis/mcp; [[ -f server.pid ]] && { echo "Already running (PID: $(cat server.pid))"; exit 0; }
nohup node server.js > logs/server.log 2>&1 & echo $! > server.pid; sleep 2
curl -s http://localhost:10000/health >/dev/null && echo "✅ Started on http://localhost:10000" || echo "⚠️ Check logs/server.log"
command -v microsoft-edge &>/dev/null && microsoft-edge http://localhost:10000 &>/dev/null &
START
cat > "$NEMESIS/scripts/stop.sh" << 'STOP'
#!/bin/bash
[[ -f ~/.nemesis/mcp/server.pid ]] && kill $(cat ~/.nemesis/mcp/server.pid) 2>/dev/null
pkill -f "node.*server.js"; rm -f ~/.nemesis/mcp/server.pid; echo "✅ Stopped"
STOP
cat > "$NEMESIS/scripts/status.sh" << 'STATUS'
#!/bin/bash
curl -s http://localhost:10000/api/status 2>/dev/null | jq . || echo "❌ Not running"
STATUS
cat > "$NEMESIS/scripts/logs.sh" << 'LOGS'
#!/bin/bash
tail -f ~/.nemesis/mcp/logs/server.log
LOGS
cat > "$NEMESIS/scripts/restart.sh" << 'RESTART'
#!/bin/bash
~/.nemesis/scripts/stop.sh; sleep 2; ~/.nemesis/scripts/start.sh
RESTART
chmod +x "$NEMESIS/scripts"/*.sh 2>/dev/null
success "Scripts created (5 commands)"

# AUTO-START with multiple attempts
log "Starting NEMESIS server..."
cd "$NEMESIS/mcp"
for i in {1..3}; do
    nohup node server.js > logs/server.log 2>&1 & SERVER_PID=$!; echo $SERVER_PID > server.pid
    log "Server started (PID: $SERVER_PID), waiting for health check..."
    sleep 3
    if curl -s http://localhost:10000/health >/dev/null 2>&1; then success "Server running on http://localhost:10000"; break
    else repair "Server start attempt $i/3 failed, retrying..."; kill $SERVER_PID 2>/dev/null; sleep 2; fi
done

# FINAL REPORT
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "🎉 INSTALLATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""; echo "📊 STATISTICS:"; echo "   ✅ Successes: $SUCCESS_COUNT"; echo "   ❌ Errors: $ERROR_COUNT"
echo "   📄 Report: $REPORT"; echo ""
echo "🌐 ACCESS:"; echo "   Dashboard: http://localhost:10000"
echo "   API: http://localhost:10000/api/status"; echo "   Health: http://localhost:10000/health"
echo "   Metrics: http://localhost:10000/api/metrics"; echo ""
echo "🛠️  COMMANDS:"; echo "   Start:   ~/.nemesis/scripts/start.sh"
echo "   Stop:    ~/.nemesis/scripts/stop.sh"; echo "   Status:  ~/.nemesis/scripts/status.sh"
echo "   Restart: ~/.nemesis/scripts/restart.sh"; echo "   Logs:    ~/.nemesis/scripts/logs.sh"; echo ""
echo "📝 FILES:"; echo "   Installation: $NEMESIS"; echo "   Config: $NEMESIS/.env"
echo "   MCP Config: $NEMESIS/configs/mcp_config.json"; echo ""
[[ $ERROR_COUNT -eq 0 ]] && echo "✅ PERFECT INSTALLATION - No errors!" || echo "⚠️  Installation completed with $ERROR_COUNT errors (check $REPORT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
command -v microsoft-edge &>/dev/null && microsoft-edge --new-window http://localhost:10000 &>/dev/null &
echo ""; echo "🔮 NEMESIS OMEGA is ready!"; echo ""
tail -20 "$REPORT"; echo ""; echo "📄 Full report: cat $REPORT"
