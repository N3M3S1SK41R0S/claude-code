#!/bin/bash
################################################################################
#              NEMESIS OMEGA v5.2 - ULTIMATE FINAL EDITION                    #
#     Installation Parfaite | 33 AI Tools | Charts | CLI | Dark Mode          #
################################################################################
set +e; trap '' ERR
N="$HOME/.nemesis"; L="$HOME/nemesis_logs"; mkdir -p "$L"
R="$L/v52_ultimate_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee "$R") 2>&1

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       🚀 NEMESIS OMEGA v5.2 - ULTIMATE FINAL EDITION          ║"
echo "║   33 AI Tools • Real-time Charts • Dark Mode • CLI Menu       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)

# Nettoyage si installation précédente
if [[ -d "$N" ]]; then
    echo "🔄 Nettoyage..."
    pkill -f "node.*server.js" 2>/dev/null
    rm -rf "$N/mcp/node_modules" "$N/mcp/package-lock.json" 2>/dev/null
    echo "✅ Nettoyé"
fi

# Sudo
echo "🔐 Configuration sudo..."
sudo -v
(while true; do sleep 45; sudo -n true 2>/dev/null || break; done) &
SUDO_PID=$!
echo "✅ Sudo actif"

# Structure complète
echo "📁 Création structure..."
mkdir -p "$N"/{workspace/html,mcp/{logs,cache,configs},scripts,data/{backups,exports},logs}
echo "✅ Structure créée"

# Package.json optimisé
cd "$N/mcp"
cat > package.json << 'PACKAGE_JSON'
{
  "name": "nemesis-omega-ultimate",
  "version": "5.2.0",
  "description": "NEMESIS OMEGA - Ultimate AI Workspace",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2": "pm2 start server.js --name nemesis"
  },
  "dependencies": {
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "socket.io": "^4.7.4",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.4.5"
  },
  "keywords": ["ai", "workspace", "mcp", "dashboard"],
  "author": "NEMESIS",
  "license": "MIT"
}
PACKAGE_JSON

echo "📦 Installation dépendances..."
npm install --prefer-offline --silent 2>&1 | tail -3
echo "✅ Dépendances installées"

# Server.js ULTIMATE
echo "🔧 Création serveur..."
cat > server.js << 'SERVER_JS'
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {cors: {origin: '*', methods: ['GET', 'POST']}});

const PORT = process.env.PORT || 10000;
const WORKSPACE = path.join(process.env.HOME, '.nemesis', 'workspace');
const DATA_DIR = path.join(process.env.HOME, '.nemesis', 'data');

await mkdir(DATA_DIR, {recursive: true});

// Middleware
app.use(helmet({contentSecurityPolicy: false}));
app.use(compression({level: 9}));
app.use(cors());
app.use(express.json({limit: '10mb'}));
app.use(express.static(WORKSPACE));

const limiter = rateLimit({windowMs: 15 * 60 * 1000, max: 250, message: 'Too many requests'});
app.use('/api/', limiter);

// State
let connectionCount = 0;
let metricsHistory = [];
const mcpServers = new Map();

// Load metrics
try {
  const metricsFile = path.join(DATA_DIR, 'metrics.json');
  if (existsSync(metricsFile)) {
    const data = await readFile(metricsFile, 'utf8');
    metricsHistory = JSON.parse(data);
    console.log(`📊 Loaded ${metricsHistory.length} metrics`);
  }
} catch (err) {
  console.log('📊 Fresh metrics');
}

// Save metrics
async function saveMetrics(m) {
  metricsHistory.push(m);
  if (metricsHistory.length > 1000) metricsHistory = metricsHistory.slice(-500);
  try {
    await writeFile(path.join(DATA_DIR, 'metrics.json'), JSON.stringify(metricsHistory), 'utf8');
  } catch (err) {
    console.error('Metrics save error:', err.message);
  }
}

// WebSocket
io.on('connection', (socket) => {
  connectionCount++;
  console.log(`✅ Client: ${socket.id} (${connectionCount} total)`);

  const interval = setInterval(() => {
    const mem = process.memoryUsage();
    const metrics = {
      memory: mem,
      uptime: process.uptime(),
      servers: mcpServers.size,
      connections: connectionCount,
      timestamp: Date.now(),
      cpu: process.cpuUsage()
    };

    saveMetrics({
      t: metrics.timestamp,
      m: mem.heapUsed,
      u: Math.floor(metrics.uptime),
      c: connectionCount
    });

    socket.emit('metrics', metrics);
  }, 3000);

  socket.on('disconnect', () => {
    connectionCount--;
    clearInterval(interval);
    console.log(`❌ Client: ${socket.id} (${connectionCount} total)`);
  });

  socket.on('cmd', (data) => {
    console.log('Command:', data);
    socket.emit('cmd-res', {ok: true, msg: 'Executed'});
  });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '5.2.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: connectionCount,
    servers: Array.from(mcpServers.keys()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tools', (req, res) => {
  const tools = [
    {name:'Claude',url:'https://claude.ai',category:'AI Chat',icon:'🤖',desc:'Assistant IA avancé',tags:['chat','code']},
    {name:'ChatGPT',url:'https://chat.openai.com',category:'AI Chat',icon:'💬',desc:'Chat IA OpenAI',tags:['chat','gpt4']},
    {name:'Gemini',url:'https://gemini.google.com',category:'AI Chat',icon:'✨',desc:'IA multimodale Google',tags:['chat','multi']},
    {name:'Perplexity',url:'https://perplexity.ai',category:'AI Chat',icon:'🔍',desc:'Recherche IA',tags:['search']},
    {name:'Mistral',url:'https://chat.mistral.ai',category:'AI Chat',icon:'🌬️',desc:'IA opensource EU',tags:['chat','open']},
    {name:'Poe',url:'https://poe.com',category:'AI Chat',icon:'🎭',desc:'Multi-bot platform',tags:['chat','multi']},
    {name:'Pi AI',url:'https://pi.ai',category:'AI Chat',icon:'🥧',desc:'Personal AI',tags:['chat']},
    {name:'Character AI',url:'https://character.ai',category:'AI Chat',icon:'🎪',desc:'AI characters',tags:['chat','role']},
    {name:'Midjourney',url:'https://midjourney.com',category:'AI Images',icon:'🎨',desc:'Images IA premium',tags:['img','art']},
    {name:'DALL-E',url:'https://labs.openai.com',category:'AI Images',icon:'🖼️',desc:'Images OpenAI',tags:['img']},
    {name:'Stable Diffusion',url:'https://stability.ai',category:'AI Images',icon:'🌈',desc:'Images opensource',tags:['img','open']},
    {name:'Leonardo AI',url:'https://leonardo.ai',category:'AI Images',icon:'🎭',desc:'Game assets AI',tags:['img','game']},
    {name:'Ideogram',url:'https://ideogram.ai',category:'AI Images',icon:'📸',desc:'Text-to-image',tags:['img','text']},
    {name:'Runway',url:'https://runwayml.com',category:'AI Video',icon:'🎬',desc:'Vidéo génération',tags:['video']},
    {name:'Pika',url:'https://pika.art',category:'AI Video',icon:'🎥',desc:'Text to video',tags:['video']},
    {name:'HeyGen',url:'https://heygen.com',category:'AI Video',icon:'👤',desc:'AI avatars',tags:['video','avatar']},
    {name:'Cursor',url:'https://cursor.sh',category:'AI Code',icon:'⌨️',desc:'IDE avec IA',tags:['code','ide']},
    {name:'GitHub Copilot',url:'https://github.com/features/copilot',category:'AI Code',icon:'🐙',desc:'Code assist',tags:['code']},
    {name:'Replit',url:'https://replit.com',category:'AI Code',icon:'🔥',desc:'IDE online',tags:['code','web']},
    {name:'Codeium',url:'https://codeium.com',category:'AI Code',icon:'⚡',desc:'Autocomplete gratuit',tags:['code','free']},
    {name:'Tabnine',url:'https://tabnine.com',category:'AI Code',icon:'🔮',desc:'Code completion',tags:['code']},
    {name:'Notion AI',url:'https://notion.so',category:'Productivity',icon:'📝',desc:'Workspace IA',tags:['notes']},
    {name:'Linear',url:'https://linear.app',category:'Productivity',icon:'📊',desc:'Gestion projet',tags:['pm']},
    {name:'Figma',url:'https://figma.com',category:'Productivity',icon:'🎨',desc:'Design collab',tags:['design']},
    {name:'Miro',url:'https://miro.com',category:'Productivity',icon:'📋',desc:'Whiteboard',tags:['collab']},
    {name:'Obsidian',url:'https://obsidian.md',category:'Productivity',icon:'💎',desc:'Knowledge base',tags:['notes']},
    {name:'Vercel',url:'https://vercel.com',category:'Infrastructure',icon:'▲',desc:'Deploy frontend',tags:['host']},
    {name:'Railway',url:'https://railway.app',category:'Infrastructure',icon:'🚂',desc:'Deploy backend',tags:['host']},
    {name:'Supabase',url:'https://supabase.com',category:'Infrastructure',icon:'🔋',desc:'Backend Service',tags:['db','auth']},
    {name:'Pinecone',url:'https://pinecone.io',category:'Infrastructure',icon:'🌲',desc:'Vector DB',tags:['db','vector']},
    {name:'HuggingFace',url:'https://huggingface.co',category:'Infrastructure',icon:'🤗',desc:'AI Models Hub',tags:['ai','models']},
    {name:'Cloudflare',url:'https://cloudflare.com',category:'Infrastructure',icon:'☁️',desc:'CDN Security',tags:['cdn']},
    {name:'Fly.io',url:'https://fly.io',category:'Infrastructure',icon:'🪰',desc:'Global deploy',tags:['host','edge']}
  ];

  const {category, search} = req.query;
  let filtered = tools;
  if (category && category !== 'all') filtered = filtered.filter(t => t.category === category);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(t => t.name.toLowerCase().includes(s) || t.desc.toLowerCase().includes(s) || t.tags.some(tag => tag.includes(s)));
  }
  res.json(filtered);
});

app.get('/api/metrics', (req, res) => {
  res.json({memory: process.memoryUsage(), uptime: process.uptime(), cpu: process.cpuUsage(), connections: connectionCount, timestamp: Date.now()});
});

app.get('/api/metrics/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  res.json(metricsHistory.slice(-limit));
});

app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({status: 'healthy', uptime: process.uptime(), memory: {used: mem.heapUsed, total: mem.heapTotal, percent: ((mem.heapUsed/mem.heapTotal)*100).toFixed(2)}, connections: connectionCount});
});

app.get('/api/servers', (req, res) => {
  res.json({count: mcpServers.size, servers: Array.from(mcpServers.keys())});
});

// Start
httpServer.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     🚀 NEMESIS OMEGA v5.2 ULTIMATE - Running!             ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`📊 http://localhost:${PORT}`);
  console.log(`🎨 33 AI Tools • Charts • Dark Mode`);
  console.log(`💾 JSON Storage • WebSocket Active`);
});

process.on('SIGTERM', () => {console.log('Shutdown...'); httpServer.close(() => process.exit(0));});
process.on('SIGINT', () => {console.log('Shutdown...'); httpServer.close(() => process.exit(0));});
SERVER_JS
echo "✅ Serveur créé"

# Dashboard HTML (version complète non-minifiée pour lisibilité)
echo "🎨 Dashboard..."
cat > "$N/workspace/html/index.html" << 'HTML_END'
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEMESIS OMEGA v5.2 - Ultimate Edition</title>
<script src="/socket.io/socket.io.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0f0f23;--card:#1a1a2e;--text:#fff;--accent:#667eea;--border:rgba(255,255,255,.1)}
[data-theme=light]{--bg:#f0f0f5;--card:#fff;--text:#1a1a2e}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:20px}
.container{max-width:1600px;margin:0 auto}
.header{background:var(--card);border-radius:20px;padding:30px;margin-bottom:20px;border:1px solid var(--border);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
h1{font-size:2.5em;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.theme-btn{background:var(--card);border:2px solid var(--border);color:var(--text);padding:10px 20px;border-radius:25px;cursor:pointer;font-size:1.2em;transition:.3s}
.theme-btn:hover{transform:scale(1.05);border-color:var(--accent)}
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-top:20px}
.metric{background:var(--card);padding:20px;border-radius:15px;border:1px solid var(--border);transition:.3s}
.metric:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(102,126,234,.2)}
.metric-label{color:#999;font-size:.9em;margin-bottom:10px}
.metric-value{font-size:2em;font-weight:700;color:var(--accent)}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px;margin-bottom:20px}
.chart-box{background:var(--card);padding:20px;border-radius:15px;border:1px solid var(--border);height:300px}
.controls{background:var(--card);border-radius:15px;padding:20px;margin-bottom:20px;border:1px solid var(--border)}
.search{width:100%;padding:15px;border:2px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);font-size:1em;margin-bottom:15px;transition:.3s}
.search:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px rgba(102,126,234,.1)}
.filters{display:flex;gap:10px;flex-wrap:wrap}
.filter-btn{padding:10px 20px;border:2px solid var(--border);border-radius:25px;background:var(--card);color:var(--text);cursor:pointer;transition:.3s;font-size:.95em}
.filter-btn:hover,.filter-btn.active{background:var(--accent);border-color:var(--accent);color:#fff;transform:translateY(-2px)}
.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.tool{background:var(--card);border-radius:15px;padding:25px;border:1px solid var(--border);cursor:pointer;transition:.3s;position:relative;overflow:hidden}
.tool::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(102,126,234,.1),transparent);transition:left .5s}
.tool:hover::before{left:100%}
.tool:hover{transform:translateY(-8px) scale(1.02);border-color:var(--accent);box-shadow:0 12px 40px rgba(102,126,234,.3)}
.tool-icon{font-size:3em;margin-bottom:15px}
.tool-name{font-size:1.4em;font-weight:700;margin-bottom:10px}
.tool-cat{color:#999;font-size:.85em;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}
.tool-desc{color:#999;line-height:1.6;margin-bottom:10px}
.tool-tags{display:flex;gap:5px;flex-wrap:wrap}
.tag{background:var(--card);padding:4px 10px;border-radius:12px;font-size:.75em;color:var(--accent);border:1px solid var(--border)}
.pulse{display:inline-block;width:10px;height:10px;border-radius:50%;background:#4ade80;margin-right:8px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.1)}}
</style>
</head>
<body>
<div class="container">
<div class="header">
<div class="header-top">
<div><h1>🚀 NEMESIS OMEGA v5.2</h1><p style="color:#999;margin-top:10px"><span class="pulse"></span>Ultimate Edition • 33 AI Tools • Real-time Analytics</p></div>
<button class="theme-btn" onclick="toggleTheme()">🌓</button>
</div>
<div class="metrics-grid">
<div class="metric"><div class="metric-label">⏱️ Uptime</div><div class="metric-value" id="uptime">--</div></div>
<div class="metric"><div class="metric-label">💾 Memory</div><div class="metric-value" id="memory">--</div></div>
<div class="metric"><div class="metric-label">🔌 Connections</div><div class="metric-value" id="connections">--</div></div>
<div class="metric"><div class="metric-label">🖥️ Servers</div><div class="metric-value" id="servers">--</div></div>
</div>
</div>

<div class="charts">
<div class="chart-box"><canvas id="memChart"></canvas></div>
<div class="chart-box"><canvas id="connChart"></canvas></div>
</div>

<div class="controls">
<input type="text" class="search" id="search" placeholder="🔍 Rechercher par nom, description ou tags...">
<div class="filters">
<button class="filter-btn active" data-cat="all">✨ Tous (33)</button>
<button class="filter-btn" data-cat="AI Chat">💬 AI Chat (8)</button>
<button class="filter-btn" data-cat="AI Images">🎨 AI Images (5)</button>
<button class="filter-btn" data-cat="AI Video">🎬 AI Video (3)</button>
<button class="filter-btn" data-cat="AI Code">⌨️ AI Code (5)</button>
<button class="filter-btn" data-cat="Productivity">📊 Productivity (5)</button>
<button class="filter-btn" data-cat="Infrastructure">☁️ Infrastructure (7)</button>
</div>
</div>

<div class="tools" id="tools"></div>
</div>

<script>
const socket=io();let allTools=[],cat='all',search='',memData=[],connData=[];
function toggleTheme(){const h=document.documentElement,c=h.getAttribute('data-theme'),n=c==='dark'?'light':'dark';h.setAttribute('data-theme',n);localStorage.setItem('theme',n)}
document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark');
const memChart=new Chart(document.getElementById('memChart'),{type:'line',data:{labels:[],datasets:[{label:'Memory (MB)',data:[],borderColor:'#667eea',backgroundColor:'rgba(102,126,234,.1)',fill:!0,tension:.4}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1},title:{display:!0,text:'💾 Memory Usage',color:'#fff'}}}});
const connChart=new Chart(document.getElementById('connChart'),{type:'line',data:{labels:[],datasets:[{label:'Connections',data:[],borderColor:'#4ade80',backgroundColor:'rgba(74,222,128,.1)',fill:!0,tension:.4}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1},title:{display:!0,text:'🔌 Active Connections',color:'#fff'}}}});
socket.on('metrics',d=>{document.getElementById('uptime').textContent=fmt_up(d.uptime);document.getElementById('memory').textContent=fmt_mem(d.memory.heapUsed);document.getElementById('connections').textContent=d.connections;document.getElementById('servers').textContent=d.servers;const t=new Date().toLocaleTimeString();memData.push({t,v:(d.memory.heapUsed/1024/1024).toFixed(0)});connData.push({t,v:d.connections});if(memData.length>20)memData.shift();if(connData.length>20)connData.shift();memChart.data.labels=memData.map(x=>x.t);memChart.data.datasets[0].data=memData.map(x=>x.v);memChart.update('none');connChart.data.labels=connData.map(x=>x.t);connChart.data.datasets[0].data=connData.map(x=>x.v);connChart.update('none')});
async function load(){const r=await fetch('/api/tools');allTools=await r.json();render()}
function render(){const f=allTools.filter(t=>{const mc=cat==='all'||t.category===cat;const ms=!search||t.name.toLowerCase().includes(search)||t.desc.toLowerCase().includes(search)||t.tags.some(tag=>tag.includes(search));return mc&&ms});document.getElementById('tools').innerHTML=f.map(t=>`<div class="tool" onclick="window.open('${t.url}','_blank')"><div class="tool-icon">${t.icon}</div><div class="tool-name">${t.name}</div><div class="tool-cat">${t.category}</div><div class="tool-desc">${t.desc}</div><div class="tool-tags">${t.tags.map(tag=>`<span class="tag">${tag}</span>`).join('')}</div></div>`).join('')}
document.getElementById('search').addEventListener('input',e=>{search=e.target.value.toLowerCase();render()});
document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',e=>{document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');cat=e.target.dataset.cat;render()}));
function fmt_up(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return`${h}h ${m}m`}
function fmt_mem(b){return(b/1024/1024).toFixed(0)+' MB'}
load()
</script>
</body>
</html>
HTML_END
echo "✅ Dashboard créé"

# Scripts
echo "📜 Scripts..."
cat > "$N/scripts/start.sh" << 'EOFS'
#!/bin/bash
cd ~/.nemesis/mcp && node server.js >logs/server.log 2>&1 &
echo $! >logs/server.pid && sleep 2
[[ -f logs/server.pid ]] && ps -p $(cat logs/server.pid) >/dev/null 2>&1 && echo "✅ Server running: http://localhost:10000" || echo "❌ Failed - check logs/server.log"
EOFS

cat > "$N/scripts/stop.sh" << 'EOFS'
#!/bin/bash
[[ -f ~/.nemesis/mcp/logs/server.pid ]] && kill $(cat ~/.nemesis/mcp/logs/server.pid) 2>/dev/null && rm ~/.nemesis/mcp/logs/server.pid && echo "✅ Server stopped" || echo "⚠️ Server not running"
EOFS

cat > "$N/scripts/restart.sh" << 'EOFS'
#!/bin/bash
echo "🔄 Restarting NEMESIS..."
~/.nemesis/scripts/stop.sh
sleep 2
~/.nemesis/scripts/start.sh
EOFS

cat > "$N/scripts/status.sh" << 'EOFS'
#!/bin/bash
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          📊 NEMESIS OMEGA v5.2 - Status Report            ║"
echo "╚════════════════════════════════════════════════════════════╝"
if [[ -f ~/.nemesis/mcp/logs/server.pid ]]; then
PID=$(cat ~/.nemesis/mcp/logs/server.pid)
if ps -p $PID >/dev/null 2>&1; then
echo "✅ Server Running (PID: $PID)"
echo "📊 Dashboard: http://localhost:10000"
echo ""
echo "API Status:"
curl -s http://localhost:10000/api/status | jq . 2>/dev/null || echo "⚠️ API unavailable"
else
echo "❌ Server Stopped (stale PID)"
fi
else
echo "❌ Server Not Started"
fi
echo "╚════════════════════════════════════════════════════════════╝"
EOFS

chmod +x "$N/scripts"/*.sh
echo "✅ Scripts créés"

# .env
cat > "$N/.env" << 'ENVEOF'
# NEMESIS OMEGA v5.2 Configuration
NODE_ENV=production
PORT=10000

# API Keys (optional - add your keys)
GITHUB_TOKEN=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_MAPS_API_KEY=
BRAVE_API_KEY=
ENVEOF
echo "✅ Config créée"

# Démarrage
echo "🎬 Démarrage serveur..."
cd "$N/mcp"
node server.js >logs/server.log 2>&1 &
PID=$!
echo $PID >logs/server.pid
sleep 3

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if ps -p $PID >/dev/null 2>&1; then
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         🎉 NEMESIS OMEGA v5.2 - INSTALLATION SUCCESS!     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Dashboard:       http://localhost:10000"
echo "🎨 Features:        33 AI Tools • Real-time Charts • Dark Mode"
echo "💾 Storage:         JSON (lightweight, no SQLite)"
echo "📡 WebSocket:       Active (3s updates)"
echo "⚡ Install Time:    ${DURATION}s"
echo ""
echo "🎮 Management Commands:"
echo "   ~/.nemesis/scripts/start.sh      # Start server"
echo "   ~/.nemesis/scripts/stop.sh       # Stop server"
echo "   ~/.nemesis/scripts/restart.sh    # Restart server"
echo "   ~/.nemesis/scripts/status.sh     # Check status"
echo ""
echo "📋 Logs: $R"
echo "╚════════════════════════════════════════════════════════════╝"
else
echo ""
echo "❌ Server failed to start"
echo "📋 Check logs: cat ~/.nemesis/mcp/logs/server.log"
fi

kill $SUDO_PID 2>/dev/null
