# NEMESIS OMEGA v5.2 - ULTIMATE FINAL EDITION

**Version**: 5.2.0
**Date**: December 2025
**Status**: ✅ Production Ready

---

## 🚀 Installation Ultra-Rapide (1 Commande)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/claude/nemesis-ultimate-setup-011CULPeU8m8D8qYiqbCw8ce/nemesis_v52_ultimate.sh)
```

**Installation**: ~2 minutes
**Interaction**: Zéro
**Taille**: ~50 MB

---

## ✨ Caractéristiques v5.2

### 🎨 Dashboard Ultra
- **33 AI Tools** intégrés et cliquables
- **Charts temps réel** (Chart.js) - Memory & Connections
- **Dark/Light mode** toggle avec sauvegarde
- **Recherche intelligente** - nom, description, tags
- **Filtres par catégorie** - 7 catégories
- **Design glassmorphism** responsive
- **Animations fluides** et transitions

### 📊 Monitoring & Analytics
- **WebSocket** updates toutes les 3 secondes
- **Historique métriques** sauvegardé en JSON
- **6 API endpoints** REST complets
- **Health checks** intégrés
- **Logs structurés** avec rotation

### 🔧 Architecture
- **Node.js ES6** modules
- **Express 4.19** avec middleware complet
- **Socket.io 4.7** pour WebSocket
- **Sans SQLite** - utilise fichiers JSON
- **97 packages npm** - ultra léger
- **Compression level 9** - performance maximale
- **Rate limiting** - 250 req/15min

---

## 🎨 33 AI Tools Intégrés

### AI Chat (8 tools)
| Tool | Description | Tags |
|------|-------------|------|
| 🤖 Claude | Assistant IA avancé par Anthropic | chat, code |
| 💬 ChatGPT | Chat IA par OpenAI | chat, gpt4 |
| ✨ Gemini | IA multimodale Google | chat, multi |
| 🔍 Perplexity | Moteur de recherche IA | search |
| 🌬️ Mistral | IA opensource européenne | chat, open |
| 🎭 Poe | Multi-bot AI platform | chat, multi |
| 🥧 Pi AI | Personal AI | chat |
| 🎪 Character AI | AI characters | chat, role |

### AI Images (5 tools)
| Tool | Description | Tags |
|------|-------------|------|
| 🎨 Midjourney | Images IA premium qualité | img, art |
| 🖼️ DALL-E | Images par OpenAI | img |
| 🌈 Stable Diffusion | Images opensource | img, open |
| 🎭 Leonardo AI | Game assets AI | img, game |
| 📸 Ideogram | Text-to-image précis | img, text |

### AI Video (3 tools)
| Tool | Description | Tags |
|------|-------------|------|
| 🎬 Runway | Génération vidéo IA | video |
| 🎥 Pika | Text to video | video |
| 👤 HeyGen | AI avatars vidéo | video, avatar |

### AI Code (5 tools)
| Tool | Description | Tags |
|------|-------------|------|
| ⌨️ Cursor | IDE avec IA intégrée | code, ide |
| 🐙 GitHub Copilot | Assistant code GitHub | code |
| 🔥 Replit | IDE en ligne avec IA | code, web |
| ⚡ Codeium | Autocomplete gratuit | code, free |
| 🔮 Tabnine | Code completion IA | code |

### Productivity (5 tools)
| Tool | Description | Tags |
|------|-------------|------|
| 📝 Notion AI | Workspace intelligent | notes |
| 📊 Linear | Gestion projet moderne | pm |
| 🎨 Figma | Design collaboratif | design |
| 📋 Miro | Tableau blanc collab | collab |
| 💎 Obsidian | Knowledge base | notes |

### Infrastructure (7 tools)
| Tool | Description | Tags |
|------|-------------|------|
| ▲ Vercel | Deploy frontend | host |
| 🚂 Railway | Deploy backend | host |
| 🔋 Supabase | Backend as Service | db, auth |
| 🌲 Pinecone | Vector database | db, vector |
| 🤗 HuggingFace | AI Models Hub | ai, models |
| ☁️ Cloudflare | CDN & Security | cdn |
| 🪰 Fly.io | Global deployment | host, edge |

---

## 📡 API Endpoints

### GET /api/status
Retourne le status complet du système.

**Response:**
```json
{
  "status": "running",
  "version": "5.2.0",
  "uptime": 3600,
  "memory": {
    "heapUsed": 45678901,
    "heapTotal": 67890123
  },
  "connections": 5,
  "servers": [],
  "timestamp": "2025-12-16T10:30:00.000Z"
}
```

### GET /api/tools
Liste tous les outils IA avec filtrage.

**Query Parameters:**
- `category` - Filtre par catégorie
- `search` - Recherche texte

**Response:**
```json
[
  {
    "name": "Claude",
    "url": "https://claude.ai",
    "category": "AI Chat",
    "icon": "🤖",
    "desc": "Assistant IA avancé",
    "tags": ["chat", "code"]
  }
]
```

### GET /api/metrics
Métriques système en temps réel.

**Response:**
```json
{
  "memory": {...},
  "uptime": 3600,
  "cpu": {...},
  "connections": 5,
  "timestamp": 1702728600000
}
```

### GET /api/metrics/history
Historique des métriques.

**Query Parameters:**
- `limit` - Nombre de points (default: 100, max: 1000)

**Response:**
```json
[
  {"t": 1702728600000, "m": 45678901, "u": 3600, "c": 5}
]
```

### GET /api/health
Health check pour monitoring.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "used": 45678901,
    "total": 67890123,
    "percent": "67.23"
  },
  "connections": 5
}
```

### GET /api/servers
Liste des serveurs MCP actifs.

**Response:**
```json
{
  "count": 0,
  "servers": []
}
```

---

## 🔌 WebSocket Events

### Client → Server

#### `cmd`
Envoi d'une commande au serveur.

**Payload:**
```javascript
{
  cmd: 'command',
  args: ['arg1', 'arg2']
}
```

### Server → Client

#### `metrics`
Métriques système envoyées toutes les 3s.

**Payload:**
```javascript
{
  memory: {heapUsed, heapTotal, external, arrayBuffers},
  uptime: 3600,
  servers: 0,
  connections: 5,
  timestamp: 1702728600000,
  cpu: {user, system}
}
```

#### `cmd-res`
Réponse à une commande.

**Payload:**
```javascript
{
  ok: true,
  msg: 'Executed'
}
```

---

## 🎮 Scripts de Gestion

### Start
```bash
~/.nemesis/scripts/start.sh
```
Démarre le serveur en arrière-plan.

### Stop
```bash
~/.nemesis/scripts/stop.sh
```
Arrête le serveur gracieusement.

### Restart
```bash
~/.nemesis/scripts/restart.sh
```
Redémarre le serveur (stop + start).

### Status
```bash
~/.nemesis/scripts/status.sh
```
Affiche le status détaillé avec check API.

---

## 📂 Structure des Fichiers

```
~/.nemesis/
├── workspace/
│   └── html/
│       └── index.html           # Dashboard web
├── mcp/
│   ├── server.js                # Serveur Node.js ES6
│   ├── package.json             # Dépendances (97 packages)
│   ├── node_modules/            # Packages npm
│   ├── logs/
│   │   ├── server.log          # Logs serveur
│   │   └── server.pid          # PID processus
│   ├── cache/                   # Cache temporaire
│   └── configs/                 # Configs serveurs MCP
├── scripts/
│   ├── start.sh                # Démarrage
│   ├── stop.sh                 # Arrêt
│   ├── restart.sh              # Redémarrage
│   └── status.sh               # Status
├── data/
│   ├── metrics.json            # Historique métriques
│   ├── backups/                # Backups manuels
│   └── exports/                # Exports données
├── logs/                        # Logs applicatifs
└── .env                        # Variables d'environnement

~/nemesis_logs/
└── v52_ultimate_YYYYMMDD_HHMMSS.log  # Logs d'installation
```

---

## 🔧 Configuration

### Variables d'Environnement (.env)

```bash
# Core
NODE_ENV=production
PORT=10000

# API Keys (optional)
GITHUB_TOKEN=your_github_token
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GOOGLE_MAPS_API_KEY=your_maps_key
BRAVE_API_KEY=your_brave_key
```

### Modifier le Port

```bash
# Éditer .env
nano ~/.nemesis/.env

# Changer PORT
PORT=8080

# Redémarrer
~/.nemesis/scripts/restart.sh
```

---

## 🚀 Utilisation Avancée

### Lancer avec PM2

```bash
cd ~/.nemesis/mcp
pm2 start server.js --name nemesis
pm2 save
pm2 startup
```

### Monitoring PM2

```bash
pm2 monit nemesis
pm2 logs nemesis
pm2 restart nemesis
```

### Backup Manuel

```bash
# Backup complet
tar -czf ~/nemesis-backup-$(date +%Y%m%d).tar.gz ~/.nemesis

# Backup data uniquement
cp ~/.nemesis/data/metrics.json ~/.nemesis/data/backups/
```

### Restauration

```bash
# Restaurer backup
tar -xzf ~/nemesis-backup-20251216.tar.gz -C ~/

# Redémarrer
~/.nemesis/scripts/restart.sh
```

---

## 🐛 Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier les logs
cat ~/.nemesis/mcp/logs/server.log

# Vérifier le port
lsof -i :10000

# Tuer processus sur port
kill $(lsof -t -i:10000)

# Redémarrer
~/.nemesis/scripts/start.sh
```

### Dashboard ne charge pas

```bash
# Vérifier que le serveur tourne
~/.nemesis/scripts/status.sh

# Tester l'API
curl http://localhost:10000/api/status

# Vérifier les permissions
ls -la ~/.nemesis/workspace/html/
```

### Erreur "EADDRINUSE"

```bash
# Port déjà utilisé - trouver le processus
lsof -ti:10000

# Tuer le processus
kill $(lsof -ti:10000)

# Ou changer le port dans .env
echo "PORT=8080" >> ~/.nemesis/.env
```

### Performance lente

```bash
# Nettoyer les métriques anciennes
rm ~/.nemesis/data/metrics.json

# Nettoyer le cache
rm -rf ~/.nemesis/mcp/cache/*

# Redémarrer
~/.nemesis/scripts/restart.sh
```

---

## 📊 Métriques & Performance

### Utilisation Typique

- **Mémoire**: 40-60 MB
- **CPU**: <5% au repos
- **Latence API**: <50ms
- **WebSocket**: <10ms
- **Taille totale**: ~50 MB

### Optimisations

```bash
# Augmenter limite mémoire Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Compression maximale (déjà activée)
# Level 9 dans server.js

# Limiter historique métriques
# Éditer dans server.js: if(metricsHistory.length > 500)
```

---

## 🔒 Sécurité

### Recommandations Production

1. **Firewall**
```bash
# Bloquer accès externe
sudo ufw deny 10000/tcp
sudo ufw allow from 127.0.0.1 to any port 10000
```

2. **Reverse Proxy (nginx)**
```nginx
server {
    listen 443 ssl;
    server_name nemesis.example.com;

    location / {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

3. **Rate Limiting**
```javascript
// Déjà configuré dans server.js
// 250 req / 15min par IP
```

4. **HTTPS**
```bash
# Avec Certbot
sudo certbot --nginx -d nemesis.example.com
```

---

## 🆚 Comparaison des Versions

| Feature | v4.0 | v5.0 | v5.1 | v5.2 |
|---------|------|------|------|------|
| AI Tools | 19 | 33 | 33 | 33 |
| Charts | ❌ | ✅ | ✅ | ✅ |
| Dark Mode | ❌ | ✅ | ✅ | ✅ |
| Database | ❌ | SQLite | JSON | JSON |
| npm packages | 287 | 287 | 97 | 97 |
| Install time | 5min | 8min | 2min | 2min |
| Size | 100MB | 150MB | 50MB | 50MB |
| Stability | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 📝 Changelog

### v5.2.0 (2025-12-16)

**Added:**
- Optimized dashboard HTML/CSS/JS (minified)
- Better error handling in server.js
- Improved startup time (<2min)
- Enhanced WebSocket reconnection logic
- Better memory management (metrics capping)

**Changed:**
- Reduced npm packages from 287 to 97
- Simplified dependencies (removed SQLite)
- Improved JSON storage format
- Faster chart updates (optimized rendering)

**Fixed:**
- Installation script more robust
- Sudo keep-alive improved
- Port conflict handling
- Metrics overflow prevention

---

## 🤝 Support & Contribution

### Reporting Issues

```bash
# Logs d'installation
cat ~/nemesis_logs/v52_ultimate_*.log

# Logs serveur
cat ~/.nemesis/mcp/logs/server.log

# Status système
~/.nemesis/scripts/status.sh
```

### Repository

```
https://github.com/N3M3S1SK41R0S/claude-code
Branch: claude/nemesis-ultimate-setup-011CULPeU8m8D8qYiqbCw8ce
```

---

## 📜 Licence

MIT License

Copyright (c) 2025 NEMESIS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🎉 Remerciements

- **Anthropic** pour Claude AI
- **Chart.js** pour les graphiques
- **Socket.io** pour le WebSocket
- **Express.js** pour le serveur
- **Communauté open source**

---

**🚀 NEMESIS OMEGA v5.2 - Built with ❤️ by NEMESIS Team**
