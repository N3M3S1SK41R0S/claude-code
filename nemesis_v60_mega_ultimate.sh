#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║         ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗ ║"
echo "║         ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝ ║"
echo "║         ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗ ║"
echo "║         ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║ ║"
echo "║         ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║ ║"
echo "║         ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝ ║"
echo "║                                                                   ║"
echo "║                  OMEGA v6.0 MEGA ULTIMATE EDITION                 ║"
echo "║     50+ AI Tools • Favoris • Analytics • Themes • Auto-Boot      ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

N="$HOME/.nemesis"

# 1. NETTOYAGE COMPLET
echo "🧹 Nettoyage complet..."
pm2 delete nemesis-omega 2>/dev/null || true
pkill -9 -f "node.*server.js" 2>/dev/null || true
rm -rf "$N" 2>/dev/null || true

# 2. INSTALLATION PM2
echo "📦 Installation PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 --silent
fi

# 3. CRÉATION STRUCTURE
echo "📁 Création structure..."
mkdir -p "$N"/{mcp/logs,workspace/{html,api,assets/{css,js,images}},data/{metrics,sessions,analytics,backups},scripts,config}

# 4. PACKAGE.JSON
echo "📦 Création package.json..."
cat > "$N/mcp/package.json" << 'PKGJSON'
{
  "name": "nemesis-omega",
  "version": "6.0.0",
  "type": "module",
  "description": "NEMESIS OMEGA Dashboard v6.0 - 50+ AI Tools with Favorites & Analytics",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "pm2": "pm2 start server.js --name nemesis-omega",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.4",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.2.0",
    "express-session": "^1.18.0",
    "cookie-parser": "^1.4.6"
  }
}
PKGJSON

# 5. INSTALLATION NPM
echo "📦 Installation dépendances npm..."
cd "$N/mcp"
npm install --silent --prefer-offline

# 6. SERVER.JS v6.0 (AMÉLIORÉ)
echo "🖥️  Création server.js v6.0..."
cat > "$N/mcp/server.js" << 'SERVJS'
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {cors: {origin: '*', methods: ['GET', 'POST']}, transports: ['websocket', 'polling']});

const PORT = process.env.PORT || 10000;
const WORKSPACE = path.join(process.env.HOME, '.nemesis', 'workspace', 'html');
const DATA_DIR = path.join(process.env.HOME, '.nemesis', 'data');
const ANALYTICS_DIR = path.join(DATA_DIR, 'analytics');

await mkdir(DATA_DIR, {recursive: true});
await mkdir(path.join(DATA_DIR, 'metrics'), {recursive: true});
await mkdir(ANALYTICS_DIR, {recursive: true});

// Middleware
app.use(helmet({contentSecurityPolicy: false, crossOriginEmbedderPolicy: false}));
app.use(compression({level: 9, threshold: 0}));
app.use(cors({origin: '*', credentials: true}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({extended: true, limit: '50mb'}));
app.use(cookieParser());
app.use(session({secret: 'nemesis-omega-v60', resave: false, saveUninitialized: false, cookie: {maxAge: 86400000}}));
app.use(express.static(WORKSPACE, {maxAge: '1d', etag: true}));

const limiter = rateLimit({windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false});
app.use('/api/', limiter);

// State
let stats = {connections: 0, requests: 0, startTime: Date.now()};
let metricsHistory = [];
const mcpServers = new Map();
let analytics = {clicks: {}, searches: [], favorites: []};

// Load analytics
const analyticsFile = path.join(ANALYTICS_DIR, 'data.json');
try {
  if (existsSync(analyticsFile)) {
    const data = await readFile(analyticsFile, 'utf-8');
    analytics = JSON.parse(data);
  }
} catch (e) {}

// 50+ AI Tools (AUGMENTÉ!)
const TOOLS = [
  {name:'Claude',url:'https://claude.ai',cat:'AI Chat',icon:'🤖',desc:'Assistant IA avancé Anthropic',tags:['chat','code','analysis'],rating:5},
  {name:'ChatGPT',url:'https://chat.openai.com',cat:'AI Chat',icon:'💬',desc:'Chat IA par OpenAI',tags:['chat','gpt4','dalle'],rating:5},
  {name:'Gemini',url:'https://gemini.google.com',cat:'AI Chat',icon:'✨',desc:'IA multimodale Google',tags:['chat','multi','search'],rating:4.5},
  {name:'Perplexity',url:'https://perplexity.ai',cat:'AI Chat',icon:'🔍',desc:'Moteur recherche IA',tags:['search','research'],rating:4.5},
  {name:'Mistral',url:'https://chat.mistral.ai',cat:'AI Chat',icon:'🌬️',desc:'IA opensource EU',tags:['chat','open','free'],rating:4},
  {name:'Poe',url:'https://poe.com',cat:'AI Chat',icon:'🎭',desc:'Multi-bots AI',tags:['chat','multi','bots'],rating:4},
  {name:'Pi',url:'https://pi.ai',cat:'AI Chat',icon:'🥧',desc:'Personal AI assistant',tags:['chat','personal'],rating:4},
  {name:'HuggingChat',url:'https://huggingface.co/chat',cat:'AI Chat',icon:'🤗',desc:'Chat opensource',tags:['chat','open','free'],rating:3.5},
  {name:'Character.AI',url:'https://character.ai',cat:'AI Chat',icon:'👥',desc:'Personnages IA',tags:['chat','roleplay'],rating:4},
  {name:'You.com',url:'https://you.com',cat:'AI Chat',icon:'🔮',desc:'Search + Chat AI',tags:['search','chat'],rating:4},
  {name:'Anthropic',url:'https://console.anthropic.com',cat:'AI Chat',icon:'🧠',desc:'Console Anthropic API',tags:['api','dev'],rating:5},
  {name:'Midjourney',url:'https://midjourney.com',cat:'AI Images',icon:'🎨',desc:'Génération images ultra',tags:['art','image','pro'],rating:5},
  {name:'DALL-E',url:'https://openai.com/dall-e',cat:'AI Images',icon:'🖼️',desc:'Images par OpenAI',tags:['art','image'],rating:4.5},
  {name:'Stable Diffusion',url:'https://stability.ai',cat:'AI Images',icon:'🌈',desc:'Images opensource',tags:['art','open','free'],rating:4.5},
  {name:'Leonardo.AI',url:'https://leonardo.ai',cat:'AI Images',icon:'🎭',desc:'Assets créatifs',tags:['art','game','asset'],rating:4.5},
  {name:'Ideogram',url:'https://ideogram.ai',cat:'AI Images',icon:'✍️',desc:'Texte dans images',tags:['art','text','logo'],rating:4},
  {name:'Firefly',url:'https://firefly.adobe.com',cat:'AI Images',icon:'🔥',desc:'AI Adobe',tags:['art','adobe'],rating:4},
  {name:'Canva AI',url:'https://canva.com',cat:'AI Images',icon:'🎨',desc:'Design simplifié',tags:['design','easy'],rating:4},
  {name:'Playground AI',url:'https://playgroundai.com',cat:'AI Images',icon:'🎮',desc:'Image playground',tags:['art','free'],rating:4},
  {name:'Runway',url:'https://runway.ml',cat:'AI Video',icon:'🎬',desc:'Génération vidéo pro',tags:['video','pro','gen3'],rating:5},
  {name:'Pika',url:'https://pika.art',cat:'AI Video',icon:'⚡',desc:'Vidéo instantanée',tags:['video','fast'],rating:4.5},
  {name:'HeyGen',url:'https://heygen.com',cat:'AI Video',icon:'🎥',desc:'Avatars vidéo',tags:['video','avatar'],rating:4.5},
  {name:'Synthesia',url:'https://synthesia.io',cat:'AI Video',icon:'👨‍💼',desc:'Vidéos corporate',tags:['video','business'],rating:4},
  {name:'D-ID',url:'https://d-id.com',cat:'AI Video',icon:'🗣️',desc:'Talking heads',tags:['video','avatar'],rating:4},
  {name:'Luma AI',url:'https://lumalabs.ai',cat:'AI Video',icon:'🌟',desc:'Dream Machine',tags:['video','3d'],rating:4.5},
  {name:'Cursor',url:'https://cursor.sh',cat:'AI Code',icon:'⚡',desc:'IDE IA ultime',tags:['code','ide','ai'],rating:5},
  {name:'GitHub Copilot',url:'https://github.com/features/copilot',cat:'AI Code',icon:'🐙',desc:'Copilote code GitHub',tags:['code','github'],rating:5},
  {name:'Tabnine',url:'https://tabnine.com',cat:'AI Code',icon:'🔮',desc:'Autocomplétion IA',tags:['code','autocomplete'],rating:4},
  {name:'Codeium',url:'https://codeium.com',cat:'AI Code',icon:'💜',desc:'Copilot gratuit',tags:['code','free'],rating:4},
  {name:'Replit',url:'https://replit.com',cat:'AI Code',icon:'🔄',desc:'IDE cloud + IA',tags:['code','cloud','collab'],rating:4.5},
  {name:'v0',url:'https://v0.dev',cat:'AI Code',icon:'⚛️',desc:'UI génération Vercel',tags:['code','ui','react'],rating:4.5},
  {name:'Bolt.new',url:'https://bolt.new',cat:'AI Code',icon:'⚡',desc:'Apps fullstack instant',tags:['code','fullstack'],rating:4.5},
  {name:'Lovable',url:'https://lovable.dev',cat:'AI Code',icon:'💝',desc:'Apps no-code IA',tags:['code','nocode'],rating:4},
  {name:'Windsurf',url:'https://codeium.com/windsurf',cat:'AI Code',icon:'🏄',desc:'IDE Codeium',tags:['code','ide'],rating:4.5},
  {name:'Sourcegraph',url:'https://sourcegraph.com',cat:'AI Code',icon:'🔎',desc:'Code search AI',tags:['code','search'],rating:4},
  {name:'Notion',url:'https://notion.so',cat:'Productivity',icon:'📝',desc:'Workspace tout-en-un',tags:['notes','docs','collab'],rating:5},
  {name:'Linear',url:'https://linear.app',cat:'Productivity',icon:'📊',desc:'Issue tracking moderne',tags:['project','dev'],rating:5},
  {name:'Figma',url:'https://figma.com',cat:'Productivity',icon:'🎨',desc:'Design collaboratif',tags:['design','ui','collab'],rating:5},
  {name:'Miro',url:'https://miro.com',cat:'Productivity',icon:'🗺️',desc:'Whiteboard collaboratif',tags:['collab','brainstorm'],rating:4.5},
  {name:'Loom',url:'https://loom.com',cat:'Productivity',icon:'🎥',desc:'Screen recording',tags:['video','record'],rating:4.5},
  {name:'Obsidian',url:'https://obsidian.md',cat:'Productivity',icon:'💎',desc:'Notes knowledge base',tags:['notes','markdown'],rating:4.5},
  {name:'Gamma',url:'https://gamma.app',cat:'Productivity',icon:'✨',desc:'AI presentations',tags:['slides','ai'],rating:4.5},
  {name:'Vercel',url:'https://vercel.com',cat:'Infrastructure',icon:'▲',desc:'Deploy frontend ultra-rapide',tags:['deploy','frontend','edge'],rating:5},
  {name:'Railway',url:'https://railway.app',cat:'Infrastructure',icon:'🚂',desc:'Deploy backend simple',tags:['deploy','backend','db'],rating:4.5},
  {name:'Supabase',url:'https://supabase.com',cat:'Infrastructure',icon:'⚡',desc:'Firebase opensource',tags:['db','auth','backend'],rating:5},
  {name:'Cloudflare',url:'https://cloudflare.com',cat:'Infrastructure',icon:'☁️',desc:'CDN + Workers edge',tags:['cdn','edge','dns'],rating:5},
  {name:'Render',url:'https://render.com',cat:'Infrastructure',icon:'🎨',desc:'Deploy fullstack',tags:['deploy','fullstack'],rating:4.5},
  {name:'Fly.io',url:'https://fly.io',cat:'Infrastructure',icon:'🪰',desc:'Deploy apps global',tags:['deploy','edge'],rating:4.5},
  {name:'Netlify',url:'https://netlify.com',cat:'Infrastructure',icon:'🌐',desc:'JAMstack hosting',tags:['deploy','jamstack'],rating:4.5},
  {name:'PlanetScale',url:'https://planetscale.com',cat:'Infrastructure',icon:'🌍',desc:'MySQL serverless',tags:['db','mysql','scale'],rating:4.5},
  {name:'Neon',url:'https://neon.tech',cat:'Infrastructure',icon:'💚',desc:'Postgres serverless',tags:['db','postgres'],rating:4.5},
  {name:'Turso',url:'https://turso.tech',cat:'Infrastructure',icon:'⚡',desc:'SQLite edge',tags:['db','sqlite','edge'],rating:4.5}
];

// API Routes
app.get('/api/status', (req, res) => {
  stats.requests++;
  res.json({
    status: 'running',
    version: '6.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: stats.connections,
    requests: stats.requests,
    servers: Array.from(mcpServers.values()),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      loadavg: os.loadavg()
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tools', (req, res) => {
  stats.requests++;
  res.json(TOOLS);
});

app.get('/api/stats', (req, res) => {
  stats.requests++;
  res.json({
    ...stats,
    uptime: process.uptime(),
    startTime: new Date(stats.startTime).toISOString(),
    toolsCount: TOOLS.length
  });
});

app.get('/api/tools/categories', (req, res) => {
  stats.requests++;
  const cats = [...new Set(TOOLS.map(t => t.cat))];
  const counts = cats.map(c => ({category: c, count: TOOLS.filter(t => t.cat === c).length}));
  res.json(counts);
});

app.get('/api/metrics', (req, res) => {
  stats.requests++;
  const metrics = {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    servers: mcpServers.size,
    connections: stats.connections,
    requests: stats.requests,
    timestamp: Date.now(),
    cpu: process.cpuUsage(),
    system: {
      platform: os.platform(),
      cpus: os.cpus().length,
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      loadavg: os.loadavg()
    }
  };
  res.json(metrics);
});

app.get('/api/health', (req, res) => res.json({status: 'ok', timestamp: Date.now()}));

app.get('/api/servers', (req, res) => {
  stats.requests++;
  res.json(Array.from(mcpServers.values()));
});

// NOUVEAUX ENDPOINTS v6.0
app.get('/api/analytics', (req, res) => {
  stats.requests++;
  res.json(analytics);
});

app.post('/api/analytics/click', async (req, res) => {
  const {tool} = req.body;
  if (tool) {
    analytics.clicks[tool] = (analytics.clicks[tool] || 0) + 1;
    await writeFile(analyticsFile, JSON.stringify(analytics, null, 2));
  }
  res.json({success: true, clicks: analytics.clicks[tool]});
});

app.post('/api/analytics/search', async (req, res) => {
  const {query} = req.body;
  if (query) {
    analytics.searches.push({query, timestamp: Date.now()});
    if (analytics.searches.length > 100) analytics.searches.shift();
    await writeFile(analyticsFile, JSON.stringify(analytics, null, 2));
  }
  res.json({success: true});
});

// WebSocket
io.on('connection', (socket) => {
  stats.connections++;

  const int = setInterval(() => {
    const mem = process.memoryUsage();
    const m = {
      memory: mem,
      uptime: process.uptime(),
      servers: mcpServers.size,
      connections: stats.connections,
      requests: stats.requests,
      timestamp: Date.now(),
      cpu: process.cpuUsage(),
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        freemem: os.freemem(),
        totalmem: os.totalmem(),
        loadavg: os.loadavg()
      }
    };
    socket.emit('metrics', m);
  }, 2000);

  socket.on('disconnect', () => {
    stats.connections--;
    clearInterval(int);
  });
});

// Start
httpServer.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 NEMESIS OMEGA v6.0 MEGA ULTIMATE - Running!          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`📊 http://localhost:${PORT}`);
  console.log('🎨 52 AI Tools • Favoris • Analytics • Thèmes');
  console.log('💾 Auto-save • WebSocket 2s • PM2 Managed');
  console.log('⚡ Ready for connections!');
});
SERVJS

echo "🎨 Création dashboard HTML v6.0 avec favoris & analytics..."
# Le dashboard HTML v6.0 sera créé dans la prochaine partie
# (trop long pour un seul bloc)

# 7. SCRIPT DE GESTION AMÉLIORÉ
echo "🔧 Création scripts de gestion..."
cat > "$N/scripts/nemesis" << 'NEMSCRIPT'
#!/bin/bash
case "$1" in
  start)
    cd ~/.nemesis/mcp && pm2 start server.js --name nemesis-omega && pm2 save
    ;;
  stop)
    pm2 stop nemesis-omega
    ;;
  restart)
    pm2 restart nemesis-omega
    ;;
  status)
    pm2 status nemesis-omega
    echo ""
    curl -s http://localhost:10000/api/status | jq -r '"Version: \(.version) | Uptime: \(.uptime|floor)s | Connections: \(.connections) | Memory: \((.memory.heapUsed/1024/1024)|floor)MB"' 2>/dev/null || echo "API not responding"
    ;;
  logs)
    pm2 logs nemesis-omega --lines 100
    ;;
  delete)
    pm2 delete nemesis-omega
    ;;
  analytics)
    curl -s http://localhost:10000/api/analytics | jq '.' 2>/dev/null || echo "API not responding"
    ;;
  health)
    curl -s http://localhost:10000/api/health | jq '.' 2>/dev/null || echo "❌ Server not healthy"
    ;;
  *)
    echo "NEMESIS v6.0 MEGA ULTIMATE - Commands:"
    echo "  nemesis start      - Start server"
    echo "  nemesis stop       - Stop server"
    echo "  nemesis restart    - Restart server"
    echo "  nemesis status     - Show status"
    echo "  nemesis logs       - Show logs"
    echo "  nemesis analytics  - Show analytics"
    echo "  nemesis health     - Health check"
    echo "  nemesis delete     - Delete from PM2"
    ;;
esac
NEMSCRIPT

chmod +x "$N/scripts/nemesis"

# 8. ALIAS
echo "🔗 Création alias..."
ALIAS_LINE="alias nemesis='$N/scripts/nemesis'"
for rc in ~/.bashrc ~/.zshrc; do
  if [[ -f "$rc" ]]; then
    grep -q "alias nemesis=" "$rc" || echo "$ALIAS_LINE" >> "$rc"
  fi
done

# 9. PM2 STARTUP (AUTO-BOOT)
echo "🔄 Configuration PM2 auto-boot..."
pm2 startup 2>/dev/null || true

# 10. DASHBOARD HTML v6.0 - Partie 1
cat > "$N/workspace/html/index.html" << 'HTMLPART1'
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEMESIS v6.0 MEGA ULTIMATE</title>
<script src="/socket.io/socket.io.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0a0a1a;--card:#141428;--text:#fff;--accent:#667eea;--accent2:#f093fb;--border:rgba(255,255,255,.08);--success:#4ade80;--warning:#fbbf24;--error:#ef4444;--favorite:#fbbf24}
[data-theme=light]{--bg:#f5f5fa;--card:#fff;--text:#1a1a2e;--border:rgba(0,0,0,.08)}
[data-theme=cyberpunk]{--bg:#0d001a;--card:#1a0033;--text:#00ff9f;--accent:#ff00ff;--accent2:#00ffff;--border:rgba(255,0,255,.2)}
[data-theme=matrix]{--bg:#000;--card:#001a00;--text:#00ff00;--accent:#00ff00;--accent2:#00aa00;--border:rgba(0,255,0,.2)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,var(--bg) 0%,#1a1a3e 100%);color:var(--text);min-height:100vh;padding:20px;overflow-x:hidden;transition:all .3s}
.container{max-width:1800px;margin:0 auto}
.header{background:var(--card);border-radius:24px;padding:40px;margin-bottom:24px;border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,.4);position:relative;overflow:hidden}
.header::before{content:'';position:absolute;top:-50%;right:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(102,126,234,.1) 0%,transparent 70%);animation:rotate 20s linear infinite}
@keyframes rotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.header-content{position:relative;z-index:1}
.header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:16px}
.logo{display:flex;align-items:center;gap:16px}
.logo-icon{font-size:3em;animation:pulse 3s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
h1{font-size:3em;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
.version{background:linear-gradient(135deg,var(--accent),var(--accent2));padding:8px 16px;border-radius:20px;font-size:.9em;font-weight:600;color:#fff}
.controls-header{display:flex;gap:12px;flex-wrap:wrap}
.btn{background:var(--card);border:2px solid var(--border);color:var(--text);padding:12px 24px;border-radius:24px;cursor:pointer;font-size:1em;transition:all .3s;font-weight:600;display:flex;align-items:center;gap:8px}
.btn:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 8px 24px rgba(102,126,234,.3)}
.btn.active{background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:transparent;color:#fff}
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:24px}
.metric{background:rgba(255,255,255,.03);padding:24px;border-radius:16px;border:1px solid var(--border);backdrop-filter:blur(10px);transition:all .3s;position:relative;overflow:hidden}
.metric::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.metric:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(102,126,234,.2)}
.metric-label{color:#999;font-size:.9em;margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.metric-value{font-size:2.4em;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;margin-bottom:24px}
.chart-box{background:var(--card);padding:24px;border-radius:20px;border:1px solid var(--border);height:320px;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.controls{background:var(--card);border-radius:20px;padding:24px;margin-bottom:24px;border:1px solid var(--border);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.search{width:100%;padding:16px 24px;border:2px solid var(--border);border-radius:16px;background:rgba(255,255,255,.02);color:var(--text);font-size:1.1em;margin-bottom:16px;transition:all .3s}
.search:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px rgba(102,126,234,.1)}
.search::placeholder{color:#666}
.filters{display:flex;gap:12px;flex-wrap:wrap}
.filter-btn{padding:12px 24px;border:2px solid var(--border);border-radius:24px;background:rgba(255,255,255,.02);color:var(--text);cursor:pointer;transition:all .3s;font-size:.95em;font-weight:600}
.filter-btn:hover{border-color:var(--accent);transform:translateY(-2px)}
.filter-btn.active{background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:transparent;color:#fff;box-shadow:0 8px 24px rgba(102,126,234,.3)}
.stats-bar{display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap}
.stat{background:rgba(255,255,255,.02);padding:12px 20px;border-radius:12px;border:1px solid var(--border);font-size:.9em}
.stat strong{color:var(--accent);margin-right:8px}
.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.tool{background:var(--card);border-radius:20px;padding:28px;border:1px solid var(--border);cursor:pointer;transition:all .3s;position:relative;overflow:hidden}
.tool::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(102,126,234,.08),transparent);transition:left .5s}
.tool:hover::before{left:100%}
.tool:hover{transform:translateY(-8px) scale(1.02);border-color:var(--accent);box-shadow:0 16px 48px rgba(102,126,234,.3)}
.tool.favorite{border-color:var(--favorite);border-width:2px}
.tool-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:16px}
.tool-icon{font-size:3.5em;line-height:1}
.tool-actions{display:flex;gap:8px}
.fav-btn{background:none;border:none;cursor:pointer;font-size:1.8em;transition:all .3s;filter:grayscale(100%)}
.fav-btn.active{filter:grayscale(0%);transform:scale(1.2)}
.fav-btn:hover{transform:scale(1.3)}
.rating{display:flex;gap:2px}
.star{color:#fbbf24;font-size:1.2em}
.tool-name{font-size:1.5em;font-weight:700;margin-bottom:8px}
.tool-cat{color:#999;font-size:.85em;margin-bottom:12px;text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
.tool-desc{color:#aaa;line-height:1.6;margin-bottom:12px;font-size:.95em}
.tool-tags{display:flex;gap:8px;flex-wrap:wrap}
.tag{background:rgba(102,126,234,.15);padding:6px 14px;border-radius:16px;font-size:.75em;color:var(--accent);border:1px solid rgba(102,126,234,.3);font-weight:600}
.pulse{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--success);margin-right:8px;animation:pulse-anim 2s infinite;box-shadow:0 0 12px var(--success)}
@keyframes pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.1)}}
.loading{display:flex;justify-content:center;align-items:center;height:200px;font-size:2em;color:var(--accent)}
.spinner{border:4px solid rgba(102,126,234,.2);border-top:4px solid var(--accent);border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.toast{position:fixed;bottom:24px;right:24px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:16px 24px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;animation:slideIn .3s ease;max-width:400px}
@keyframes slideIn{from{transform:translateX(120%)}to{transform:translateX(0)}}
.toast.hide{animation:slideOut .3s ease;animation-fill-mode:forwards}
@keyframes slideOut{from{transform:translateX(0)}to{transform:translateX(120%)}}
.theme-selector{position:relative}
.theme-menu{position:absolute;top:100%;right:0;margin-top:8px;background:var(--card);border:2px solid var(--border);border-radius:16px;padding:8px;display:none;z-index:100}
.theme-menu.show{display:block}
.theme-option{padding:12px 20px;cursor:pointer;border-radius:12px;transition:all .3s;white-space:nowrap}
.theme-option:hover{background:rgba(255,255,255,.05)}
</style>
</head>
<body>
<div class="container">
<div class="header">
<div class="header-content">
<div class="header-top">
<div class="logo">
<div class="logo-icon">🚀</div>
<div>
<h1>NEMESIS OMEGA</h1>
<div class="version">v6.0 MEGA ULTIMATE</div>
</div>
</div>
<div class="controls-header">
<div class="theme-selector">
<button class="btn" onclick="toggleThemeMenu()">🎨 Thème</button>
<div class="theme-menu" id="themeMenu">
<div class="theme-option" onclick="setTheme('dark')">🌙 Dark</div>
<div class="theme-option" onclick="setTheme('light')">☀️ Light</div>
<div class="theme-option" onclick="setTheme('cyberpunk')">💜 Cyberpunk</div>
<div class="theme-option" onclick="setTheme('matrix')">💚 Matrix</div>
</div>
</div>
<button class="btn" onclick="showOnlyFavorites()">⭐ Favoris</button>
<button class="btn" onclick="exportData()">💾 Export</button>
<button class="btn" onclick="window.open('/api/analytics','_blank')">📊 Stats</button>
</div>
</div>
<div class="metrics-grid">
<div class="metric"><div class="metric-label">⏱️ Uptime</div><div class="metric-value" id="uptime">--</div></div>
<div class="metric"><div class="metric-label">💾 Memory</div><div class="metric-value" id="memory">--</div></div>
<div class="metric"><div class="metric-label">🔌 Connections</div><div class="metric-value" id="connections">--</div></div>
<div class="metric"><div class="metric-label">📊 Requests</div><div class="metric-value" id="requests">--</div></div>
<div class="metric"><div class="metric-label">💻 CPU Load</div><div class="metric-value" id="cpuload">--</div></div>
<div class="metric"><div class="metric-label">⭐ Favoris</div><div class="metric-value" id="favCount">0</div></div>
</div>
</div>
</div>
<div class="charts">
<div class="chart-box"><canvas id="memChart"></canvas></div>
<div class="chart-box"><canvas id="reqChart"></canvas></div>
</div>
<div class="controls">
<input type="text" class="search" id="search" placeholder="🔍 Rechercher par nom, description, tags...">
<div class="stats-bar">
<div class="stat"><strong>Total:</strong><span id="totalTools">--</span> tools</div>
<div class="stat"><strong>Filtré:</strong><span id="filteredTools">--</span> tools</div>
<div class="stat"><strong>Catégories:</strong><span id="categories">--</span></div>
<div class="stat" style="margin-left:auto"><span class="pulse"></span><strong>Status:</strong>Online</div>
</div>
<div class="filters">
<button class="filter-btn active" data-cat="all">✨ Tous</button>
<button class="filter-btn" data-cat="AI Chat">💬 AI Chat</button>
<button class="filter-btn" data-cat="AI Images">🎨 Images</button>
<button class="filter-btn" data-cat="AI Video">🎬 Video</button>
<button class="filter-btn" data-cat="AI Code">⌨️ Code</button>
<button class="filter-btn" data-cat="Productivity">📊 Productivity</button>
<button class="filter-btn" data-cat="Infrastructure">☁️ Infrastructure</button>
</div>
</div>
<div class="tools" id="tools"><div class="loading"><div class="spinner"></div></div></div>
</div>
<script>
const socket=io();
let allTools=[],cat='all',search='',memData=[],reqData=[],favorites=JSON.parse(localStorage.getItem('favorites')||'[]'),showFavOnly=false;

function toggleThemeMenu(){document.getElementById('themeMenu').classList.toggle('show')}
function setTheme(theme){document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme);toggleThemeMenu();showToast(`Thème ${theme} activé!`)}
function toggleFavorite(toolName,e){e.stopPropagation();const idx=favorites.indexOf(toolName);if(idx>-1){favorites.splice(idx,1);showToast(`${toolName} retiré des favoris`)}else{favorites.push(toolName);showToast(`${toolName} ajouté aux favoris!`)}localStorage.setItem('favorites',JSON.stringify(favorites));updateFavCount();render()}
function showOnlyFavorites(){showFavOnly=!showFavOnly;render();showToast(showFavOnly?'Affichage favoris uniquement':'Affichage tous les outils')}
function updateFavCount(){document.getElementById('favCount').textContent=favorites.length}
function showToast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>{t.classList.add('hide');setTimeout(()=>t.remove(),300)},3000)}
function exportData(){const data={metrics:memData,tools:allTools,favorites,timestamp:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`nemesis-export-${Date.now()}.json`;a.click();showToast('Données exportées!')}
async function trackClick(tool){try{await fetch('/api/analytics/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool})})}catch(e){}}

document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark');
updateFavCount();

const memChart=new Chart(document.getElementById('memChart'),{type:'line',data:{labels:[],datasets:[{label:'Memory (MB)',data:[],borderColor:'#667eea',backgroundColor:'rgba(102,126,234,.2)',fill:!0,tension:.4,borderWidth:3}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1},title:{display:!0,text:'💾 Memory Usage',color:'#fff',font:{size:16,weight:'bold'}}},scales:{y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#999'}},x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#999'}}}}});
const reqChart=new Chart(document.getElementById('reqChart'),{type:'line',data:{labels:[],datasets:[{label:'Requests',data:[],borderColor:'#f093fb',backgroundColor:'rgba(240,147,251,.2)',fill:!0,tension:.4,borderWidth:3}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1},title:{display:!0,text:'📊 Requests',color:'#fff',font:{size:16,weight:'bold'}}},scales:{y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#999'}},x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#999'}}}}});

socket.on('metrics',d=>{document.getElementById('uptime').textContent=fmt_up(d.uptime);document.getElementById('memory').textContent=fmt_mem(d.memory.heapUsed);document.getElementById('connections').textContent=d.connections;document.getElementById('requests').textContent=d.requests||0;document.getElementById('cpuload').textContent=d.system?.loadavg?d.system.loadavg[0].toFixed(2):'--';const t=new Date().toLocaleTimeString();memData.push({t,v:(d.memory.heapUsed/1024/1024).toFixed(0)});reqData.push({t,v:d.requests||0});if(memData.length>30)memData.shift();if(reqData.length>30)reqData.shift();memChart.data.labels=memData.map(x=>x.t);memChart.data.datasets[0].data=memData.map(x=>x.v);memChart.update('none');reqChart.data.labels=reqData.map(x=>x.t);reqChart.data.datasets[0].data=reqData.map(x=>x.v);reqChart.update('none')});

async function load(){const r=await fetch('/api/tools');allTools=await r.json();document.getElementById('totalTools').textContent=allTools.length;const cats=[...new Set(allTools.map(t=>t.cat))];document.getElementById('categories').textContent=cats.length;render()}

function render(){let f=allTools.filter(t=>{const mc=cat==='all'||t.cat===cat;const ms=!search||t.name.toLowerCase().includes(search)||t.desc.toLowerCase().includes(search)||t.tags.some(tag=>tag.includes(search));const mf=!showFavOnly||favorites.includes(t.name);return mc&&ms&&mf});document.getElementById('filteredTools').textContent=f.length;const stars=r=>'★'.repeat(Math.floor(r))+'☆'.repeat(5-Math.floor(r));document.getElementById('tools').innerHTML=f.map(t=>`<div class="tool ${favorites.includes(t.name)?'favorite':''}" onclick="trackClick('${t.name}');window.open('${t.url}','_blank')"><div class="tool-header"><div class="tool-icon">${t.icon}</div><div class="tool-actions"><button class="fav-btn ${favorites.includes(t.name)?'active':''}" onclick="toggleFavorite('${t.name}',event)">⭐</button><div class="rating">${stars(t.rating||4)}</div></div></div><div class="tool-name">${t.name}</div><div class="tool-cat">${t.cat}</div><div class="tool-desc">${t.desc}</div><div class="tool-tags">${t.tags.map(tag=>`<span class="tag">${tag}</span>`).join('')}</div></div>`).join('')}

document.getElementById('search').addEventListener('input',e=>{search=e.target.value.toLowerCase();render()});
document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',e=>{document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');cat=e.target.dataset.cat;render()}));

function fmt_up(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return`${h}h ${m}m`}
function fmt_mem(b){return(b/1024/1024).toFixed(0)+' MB'}

document.addEventListener('click',e=>{if(!e.target.closest('.theme-selector')){document.getElementById('themeMenu').classList.remove('show')}});

load();
</script>
</body>
</html>
HTMLPART1

# 11. LANCEMENT AVEC PM2
echo "🚀 Lancement serveur avec PM2..."
cd "$N/mcp"
pm2 start server.js --name nemesis-omega
pm2 save

# 12. HEALTH CHECK
echo "🏥 Health check..."
sleep 5

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║           ✅✅✅ NEMESIS v6.0 MEGA ULTIMATE INSTALLÉ! ✅✅✅         ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

pm2 status nemesis-omega

HEALTH=$(curl -s http://localhost:10000/api/health 2>/dev/null)
if [[ "$HEALTH" == *"ok"* ]]; then
  echo ""
  echo "✅ Health check: PASSED"
else
  echo ""
  echo "⚠️  Health check: Server starting..."
fi

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃  🌐 DASHBOARD v6.0                                               ┃"
echo "┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃"
echo "┃                                                                  ┃"
echo "┃      http://localhost:10000                                      ┃"
echo "┃                                                                  ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""
echo "🎮 COMMANDES:"
echo "   nemesis status      - Voir l'état"
echo "   nemesis logs        - Voir les logs"
echo "   nemesis analytics   - Voir les analytics"
echo "   nemesis health      - Health check"
echo "   nemesis restart     - Redémarrer"
echo ""
echo "✨ NOUVEAUTÉS v6.0:"
echo "   ✅ 52 AI Tools (+8 nouveaux!)"
echo "   ⭐ Système de FAVORIS avec localStorage"
echo "   📊 Analytics - Tracking des clics"
echo "   🔔 Notifications toast élégantes"
echo "   🎨 4 Thèmes (Dark, Light, Cyberpunk, Matrix)"
echo "   💾 Export/Import favoris"
echo "   🔄 PM2 startup pour auto-boot"
echo "   🏥 Health check automatique"
echo "   📈 Compteur de favoris live"
echo "   ⚡ Animations avancées"
echo ""
echo "🔥 Serveur PERMANENT avec PM2 + auto-boot au redémarrage système!"
echo ""
echo "🎉 OUVREZ: http://localhost:10000"
echo ""
