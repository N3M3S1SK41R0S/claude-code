# NEMESIS HUB v2.0 - Centre de Commande Multi-Plateformes

Hub n8n complet pour connecter et automatiser toutes vos plateformes - **20 workflows intégrés**.

## Installation Ultra-Rapide (1 clic)

```batch
NEMESIS-ULTIMATE-INSTALLER.bat
```

C'est tout ! Le script fait TOUT automatiquement.

## Plateformes Supportées

| Plateforme | Type | Fonctionnalités |
|------------|------|-----------------|
| **Google AI Studio** | IA | Gemini Pro, Vision, Embeddings |
| **Notion** | Productivité | Bases de données, Pages, Sync |
| **Discord** | Communication | Bot, Messages, Embeds, Threads |
| **GitHub** | Développement | Issues, PRs, Releases, Actions |
| **HeyGen** | Vidéo IA | Génération avatars, Voix |
| **Midjourney** | Images IA | Génération, Upscale, Variations |
| **Bubble.io** | No-Code | CRUD, Workflows |
| **Make** | Automatisation | Scénarios, Webhooks |
| **Zapier** | Automatisation | Zaps, Webhooks |
| **Slack** | Communication | Messages, Channels |

## Structure du Hub

```
n8n-hub/
├── NEMESIS-ULTIMATE-INSTALLER.bat  # Installation 100% automatique
├── NEMESIS-HUB-SETUP.bat           # Installateur standard
├── NEMESIS-HUB-SETUP.ps1           # Version PowerShell
├── README.md
├── config/
│   ├── .env                        # Variables environnement (généré)
│   └── credentials-template.json   # Template clés API
└── workflows/                      # 20 workflows
    ├── NEMESIS-ORCHESTRATOR.json       # Commande centrale
    ├── NEMESIS-HUB-MASTER.json         # Hub principal
    ├── unified-sync-controller.json    # Sync auto /30min
    ├── nemesis-dashboard.json          # Monitoring temps réel
    ├── connection-validator.json       # Tests API horaires
    ├── error-handler-global.json       # Gestion erreurs + retry
    ├── backup-recovery-system.json     # Backup quotidien
    ├── webhook-relay-system.json       # Routeur webhooks
    ├── claude-mcp-bridge.json          # Bridge MCP Claude
    ├── data-pipeline-etl.json          # ETL données
    ├── ai-content-pipeline.json        # Génération IA
    ├── social-media-automation.json    # Cross-post social
    ├── google-ai-studio-connector.json # API Gemini
    ├── notion-sync-hub.json            # Sync Notion
    ├── discord-bot-automation.json     # Bot Discord
    ├── github-integration.json         # CI/CD GitHub
    ├── heygen-video-generator.json     # Vidéos HeyGen
    ├── midjourney-automation.json      # Images Midjourney
    ├── bubble-connector.json           # Apps Bubble
    └── make-zapier-bridge.json         # Bridge Make/Zapier
```

## Webhooks Disponibles (20)

| Webhook | URL | Fonction |
|---------|-----|----------|
| **orchestrator** | `/webhook/orchestrator` | Commande centrale |
| **nemesis-hub-master** | `/webhook/nemesis-hub-master` | Hub principal |
| **dashboard** | `/webhook/dashboard` | Monitoring |
| **unified-sync** | `/webhook/unified-sync` | Sync plateformes |
| **backup** | `/webhook/backup` | Backup manuel |
| **connection-test** | `/webhook/connection-test` | Test APIs |
| **error-handler** | `/webhook/error-handler` | Erreurs |
| **relay** | `/webhook/relay` | Routeur |
| **mcp-bridge** | `/webhook/mcp-bridge` | Claude MCP |
| **etl-pipeline** | `/webhook/etl-pipeline` | ETL |
| **ai-content** | `/webhook/ai-content` | Gen IA |
| **social-post** | `/webhook/social-post` | Social media |
| **notion-sync** | `/webhook/notion-sync` | Notion |
| **discord-bot** | `/webhook/discord-bot` | Discord |
| **github-events** | `/webhook/github-events` | GitHub |
| **heygen-video** | `/webhook/heygen-video` | HeyGen |
| **midjourney-gen** | `/webhook/midjourney-gen` | Midjourney |
| **bubble-connector** | `/webhook/bubble-connector` | Bubble |
| **make-zapier-in** | `/webhook/make-zapier-in` | Make/Zapier |
| **google-ai-studio** | `/webhook/google-ai-studio` | Gemini |

## Commandes Orchestrator

Envoyez une requête POST à `http://localhost:5678/webhook/orchestrator` :

```json
{ "command": "status" }   // Statut système
{ "command": "sync" }     // Sync toutes plateformes
{ "command": "backup" }   // Lancer backup
{ "command": "test" }     // Tester connexions
```

## Automatisations Intégrées

- **Heartbeat** : Vérification système chaque minute
- **Health Check** : Test APIs toutes les heures
- **Sync** : Synchronisation toutes les 30 minutes
- **Backup** : Sauvegarde quotidienne automatique
- **Error Retry** : Retry automatique avec backoff exponentiel
- **Discord Alerts** : Notifications temps réel

## Configuration

### 1. Variables d'environnement
Éditez `config/.env` avec vos clés API.

### 2. Credentials n8n
- Ouvrez http://localhost:5678
- Settings > Credentials > Add
- Ajoutez chaque service

### 3. Activer les workflows
- Ouvrez chaque workflow
- Toggle "Active" ON

## Support

- n8n: https://docs.n8n.io
- MCP: https://modelcontextprotocol.io

---
**NEMESIS HUB v2.0** - 20 workflows - 10 plateformes - 100% automatisé
