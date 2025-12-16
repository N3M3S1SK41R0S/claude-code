# NEMESIS HUB - Centre de Commande Multi-Plateformes

Hub n8n complet pour connecter et automatiser toutes vos plateformes.

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

## Installation Rapide

### Windows (Double-clic)
```
NEMESIS-HUB-SETUP.bat
```

### PowerShell (Admin)
```powershell
.\NEMESIS-HUB-SETUP.ps1
```

## Structure des Fichiers

```
n8n-hub/
├── NEMESIS-HUB-SETUP.bat       # Installateur Windows
├── NEMESIS-HUB-SETUP.ps1       # Installateur PowerShell
├── README.md                    # Ce fichier
├── config/
│   └── credentials-template.json   # Template des clés API
└── workflows/
    ├── NEMESIS-HUB-MASTER.json        # Orchestrateur central
    ├── google-ai-studio-connector.json # Google Gemini
    ├── notion-sync-hub.json           # Notion
    ├── discord-bot-automation.json    # Discord
    ├── github-integration.json        # GitHub
    ├── heygen-video-generator.json    # HeyGen
    ├── midjourney-automation.json     # Midjourney
    ├── bubble-connector.json          # Bubble.io
    └── make-zapier-bridge.json        # Make/Zapier
```

## Configuration des Clés API

1. Copiez `config/credentials-template.json` vers `credentials.json`
2. Remplissez vos clés API
3. Importez dans n8n

### Obtenir les Clés API

| Plateforme | URL |
|------------|-----|
| Google AI | https://aistudio.google.com/app/apikey |
| Notion | https://www.notion.so/my-integrations |
| Discord | https://discord.com/developers/applications |
| GitHub | https://github.com/settings/tokens |
| HeyGen | https://app.heygen.com/settings |
| Midjourney | https://www.goapi.ai (proxy) |
| Bubble | Settings > API dans votre app |
| Make | Profile > API |

## Utilisation

### Démarrer le Hub
```batch
NEMESIS-HUB-Start.bat
```

### Importer les Workflows
1. Ouvrez http://localhost:5678
2. Workflows > Import from File
3. Sélectionnez les fichiers JSON

### Webhooks Disponibles

| Workflow | Webhook URL |
|----------|-------------|
| Hub Master | http://localhost:5678/webhook/nemesis-hub-master |
| Google AI | http://localhost:5678/webhook/google-ai-studio |
| Notion | http://localhost:5678/webhook/notion-sync |
| Discord | http://localhost:5678/webhook/discord-bot |
| GitHub | http://localhost:5678/webhook/github-events |
| HeyGen | http://localhost:5678/webhook/heygen-video |
| Midjourney | http://localhost:5678/webhook/midjourney-gen |
| Bubble | http://localhost:5678/webhook/bubble-connector |
| Make/Zapier | http://localhost:5678/webhook/make-zapier-in |

## Serveurs MCP Claude Desktop

Après installation, Claude Desktop aura accès à :

- **n8n** - Automatisation workflows
- **filesystem** - Accès fichiers locaux
- **fetch** - Requêtes HTTP
- **memory** - Mémoire persistante
- **github** - Repos et issues
- **google-drive** - Documents Google
- **slack** - Messages Slack
- **notion** - Bases Notion
- **sequential-thinking** - Raisonnement avancé

## Support

- n8n Docs: https://docs.n8n.io
- MCP Protocol: https://modelcontextprotocol.io

---
**NEMESIS HUB v1.0** - Automatisation Multi-Plateformes
