# NEMESIS OMEGA v4.0 - Guide de Démarrage Rapide

## Installation Ultra-Rapide (1 Commande)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/claude/nemesis-ultimate-setup-011CULPeU8m8D8qYiqbCw8ce/nemesis_mega_all_in_one.sh)
```

**Durée totale**: 5-10 minutes
**Interaction requise**: Zéro
**Espace disque**: ~500 MB

---

## Ce Qui Est Installé

### Système de Base
- ✅ **Node.js 20** + npm, yarn, pnpm, nodemon, PM2
- ✅ **Python 3.11** + pip, pipx, requests, beautifulsoup4, pandas, numpy
- ✅ **Docker** (optionnel, pour containerisation)
- ✅ **Outils média**: ImageMagick, FFmpeg
- ✅ **Outils système**: git, curl, wget, jq, htop, tmux

### Infrastructure NEMESIS
- ✅ **Serveur Express** avec WebSocket (Socket.io)
- ✅ **API REST complète** (4 endpoints)
- ✅ **Dashboard interactif** avec 19 outils IA
- ✅ **Configuration MCP** (25+ serveurs pré-configurés)
- ✅ **6 scripts de gestion**
- ✅ **Auto-démarrage** du serveur

---

## Accès Post-Installation

### Dashboard Web
```
http://localhost:10000
```

### API Endpoints
```bash
# Status système
curl http://localhost:10000/api/status | jq

# Liste des outils
curl http://localhost:10000/api/tools | jq

# Métriques temps réel
curl http://localhost:10000/api/metrics | jq

# Serveurs MCP
curl http://localhost:10000/api/servers | jq
```

---

## Commandes de Gestion

### Démarrer le serveur
```bash
~/.nemesis/scripts/start_nemesis.sh
```

### Arrêter le serveur
```bash
~/.nemesis/scripts/stop_nemesis.sh
```

### Redémarrer le serveur
```bash
~/.nemesis/scripts/restart_nemesis.sh
```

### Vérifier le status
```bash
~/.nemesis/scripts/status_nemesis.sh
```

### Voir les logs
```bash
~/.nemesis/scripts/logs_nemesis.sh
```

### Lancer les tests
```bash
~/.nemesis/scripts/test_nemesis.sh
```

---

## Configuration des API Keys (Optionnel)

```bash
nano ~/.nemesis/.env
```

Remplissez vos clés API si vous voulez utiliser les services MCP:

```env
GITHUB_TOKEN=ghp_votre_token_github
GITLAB_TOKEN=glpat-votre_token_gitlab
GOOGLE_MAPS_API_KEY=votre_cle_google_maps
BRAVE_API_KEY=votre_cle_brave_search
SLACK_BOT_TOKEN=xoxb-votre_token_slack
ANTHROPIC_API_KEY=sk-ant-votre_cle_anthropic
OPENAI_API_KEY=sk-votre_cle_openai
```

**Note**: Les services fonctionnent même sans clés API, certaines fonctionnalités seront limitées.

---

## Dashboard - Outils Disponibles

### AI Chat (5 outils)
- 🤖 **Claude** - Assistant IA avancé par Anthropic
- 💬 **ChatGPT** - Chatbot IA par OpenAI
- ✨ **Gemini** - IA multimodale par Google
- 🔍 **Perplexity** - Moteur de réponses IA
- 🌬️ **Mistral** - IA open source européenne

### AI Images (3 outils)
- 🎨 **Midjourney** - Génération d'images IA
- 🖼️ **DALL-E** - Création d'images par OpenAI
- 🌈 **Stable Diffusion** - Génération d'images open source

### AI IDE (3 outils)
- ⌨️ **Cursor** - IDE avec IA intégrée
- 🐙 **GitHub Copilot** - Assistant code par GitHub
- 🔥 **Replit** - IDE en ligne avec IA

### Productivity (3 outils)
- 📝 **Notion AI** - Workspace avec IA
- 📊 **Linear** - Gestion de projet moderne
- 🎨 **Figma** - Design collaboratif

### Infrastructure (5 outils)
- ▲ **Vercel** - Déploiement frontend
- 🚂 **Railway** - Déploiement backend
- 🔋 **Supabase** - Backend as a Service
- 🌲 **Pinecone** - Vector database
- 🤗 **HuggingFace** - Hub de modèles IA

---

## Fonctionnalités Dashboard

### 🔍 Recherche
Tapez dans la barre de recherche pour filtrer les outils par nom ou description.

### 🏷️ Filtres par Catégorie
Cliquez sur les boutons de catégorie pour afficher uniquement:
- Tous
- AI Chat
- AI Images
- AI IDE
- Productivity
- Infrastructure

### 📊 Métriques en Temps Réel
Le dashboard affiche automatiquement (mise à jour toutes les 3s):
- Uptime du serveur
- Utilisation mémoire
- Nombre de serveurs MCP actifs
- Status global

### 🔌 WebSocket
Connexion WebSocket automatique pour les mises à jour en temps réel.

---

## Structure des Fichiers

```
~/.nemesis/
├── server.js              # Serveur Node.js principal
├── package.json           # Dépendances npm
├── .env                   # Configuration (API keys)
├── config/
│   └── mcp_config.json   # Configuration MCP servers
├── scripts/
│   ├── start_nemesis.sh
│   ├── stop_nemesis.sh
│   ├── restart_nemesis.sh
│   ├── status_nemesis.sh
│   ├── logs_nemesis.sh
│   └── test_nemesis.sh
├── html/
│   └── index.html        # Dashboard web
├── logs/
│   ├── server.log        # Logs serveur
│   └── server.pid        # PID du processus
└── data/                 # Données persistantes

~/nemesis_logs/
└── mega_YYYYMMDD_HHMMSS.log  # Logs d'installation
```

---

## Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier les logs
cat ~/.nemesis/logs/server.log

# Vérifier le port
lsof -i :10000

# Redémarrer complètement
~/.nemesis/scripts/stop_nemesis.sh
sleep 3
~/.nemesis/scripts/start_nemesis.sh
```

### Le dashboard ne s'affiche pas

```bash
# Vérifier que le serveur tourne
~/.nemesis/scripts/status_nemesis.sh

# Tester l'API
curl http://localhost:10000/api/status

# Vérifier les dépendances npm
cd ~/.nemesis && npm install
```

### Erreur "EADDRINUSE" (port déjà utilisé)

```bash
# Trouver le processus qui utilise le port
lsof -ti:10000

# Tuer le processus
kill $(lsof -ti:10000)

# Redémarrer
~/.nemesis/scripts/start_nemesis.sh
```

### Réinstallation complète

```bash
# Sauvegarder .env si nécessaire
cp ~/.nemesis/.env ~/nemesis_env_backup

# Supprimer
rm -rf ~/.nemesis ~/nemesis_logs

# Réinstaller
bash <(curl -fsSL https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/claude/nemesis-ultimate-setup-011CULPeU8m8D8qYiqbCw8ce/nemesis_mega_all_in_one.sh)

# Restaurer .env
cp ~/nemesis_env_backup ~/.nemesis/.env
```

---

## Utilisation Avancée

### Lancer avec PM2 (processus persistant)

```bash
cd ~/.nemesis
pm2 start server.js --name nemesis-omega
pm2 save
pm2 startup
```

### Lancer en arrière-plan

```bash
cd ~/.nemesis
nohup node server.js > logs/server.log 2>&1 &
```

### Changer le port

```bash
# Éditer .env
nano ~/.nemesis/.env

# Modifier PORT
PORT=8080

# Redémarrer
~/.nemesis/scripts/restart_nemesis.sh
```

### Ajouter des outils personnalisés

Éditez `~/.nemesis/server.js` et ajoutez vos outils dans l'array `tools`:

```javascript
{
  name: 'Mon Outil',
  url: 'https://mon-outil.com',
  category: 'Productivity',
  icon: '🔧',
  description: 'Description de mon outil'
}
```

---

## Sécurité

### Recommandations Production

1. **Firewall**: Bloquer le port 10000 de l'extérieur
   ```bash
   sudo ufw deny 10000/tcp
   ```

2. **HTTPS**: Utiliser un reverse proxy (nginx/Caddy)
   ```nginx
   server {
       listen 443 ssl;
       server_name nemesis.example.com;
       location / {
           proxy_pass http://localhost:10000;
       }
   }
   ```

3. **Authentication**: Ajouter une couche d'auth (JWT, OAuth)

4. **Rate Limiting**: Déjà intégré (100 req/15min par IP)

---

## Performance

### Métriques Typiques

- **Mémoire**: ~50-100 MB
- **CPU**: <5% au repos
- **Temps de réponse API**: <50ms
- **WebSocket latency**: <10ms

### Optimisations

```bash
# Augmenter limite mémoire Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Activer compression
# Déjà inclus dans le serveur (compression middleware)

# Cache DNS
sudo systemd-resolve --flush-caches
```

---

## Support & Contribution

### Logs d'Installation
```bash
ls -lth ~/nemesis_logs/
```

### Version
```bash
curl -s http://localhost:10000/api/status | jq .version
```

### Repository
https://github.com/N3M3S1SK41R0S/claude-code

---

## Licence

MIT License - Voir LICENSE-NEMESIS

---

**🚀 Profitez de NEMESIS OMEGA v4.0!**
