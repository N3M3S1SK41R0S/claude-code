---
title: "N8N Workflows"
date: 2025-01-23
category: Knowledge/Technical
tags: [n8n, automation, workflows, integration]
version: 1.0
status: active
---

# N8N Workflows - Guide Technique

## 📋 Vue d'ensemble

N8N est une plateforme d'automatisation no-code/low-code permettant de créer des workflows complexes connectant différents services et APIs.

## 🎯 Use cases NEMESIS

- Orchestration multi-IA automatisée
- Intégrations entre plateformes IA
- Pipelines de données automatisés
- Notifications et alertes
- Backup et synchronisation

## ⚙️ Installation et Configuration

### Docker (recommandé)
```bash
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_password
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      - GENERIC_TIMEZONE=Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### Lancement
```bash
docker-compose up -d
# Accès: http://localhost:5678
```

## 🛠️ Nodes essentiels

### Triggers
| Node | Usage | Configuration |
|------|-------|---------------|
| Webhook | Réception d'appels externes | URL unique, méthodes HTTP |
| Schedule | Exécution planifiée | Cron expression |
| Manual | Test manuel | Bouton Execute |

### IA Integrations
| Node | Service | Credentials |
|------|---------|-------------|
| OpenAI | ChatGPT API | API Key |
| HTTP Request | Claude API | Bearer Token |
| HTTP Request | Mistral API | API Key |
| HTTP Request | Gemini API | API Key |

### Data Processing
| Node | Usage |
|------|-------|
| Set | Définir/modifier variables |
| Function | Code JavaScript custom |
| IF | Conditions et branchements |
| Switch | Multi-branches |
| Merge | Fusionner flux |
| Split In Batches | Traitement par lots |

### Output
| Node | Usage |
|------|-------|
| HTTP Request | Appels API |
| Send Email | Notifications email |
| Slack | Messages Slack |
| Google Sheets | Export données |

## 📊 Workflows NEMESIS

### 1. Multi-IA Router
Route les requêtes vers l'IA optimale selon le type de tâche.

```
[Webhook] → [Switch by task_type] → [Claude/ChatGPT/Mistral/etc.] → [Format Response] → [Respond to Webhook]
```

**Configuration Switch**:
```javascript
// Rules
task_type === "code" → Claude
task_type === "research" → Perplexity
task_type === "math" → DeepSeek
task_type === "multimodal" → Gemini
default → ChatGPT
```

### 2. Context Sync
Synchronise le contexte NEMESIS entre plateformes.

```
[Schedule: Daily] → [Read Context Files] → [Format for each platform] → [Update Claude/ChatGPT/Mistral memories]
```

### 3. Response Aggregator
Collecte réponses de multiples IA et synthétise.

```
[Webhook] → [Split to multiple IAs] → [Wait for all] → [Merge responses] → [Synthesize with Claude] → [Return best answer]
```

### 4. Learning Capture
Capture automatiquement les learnings des sessions.

```
[Webhook: session_end] → [Extract insights] → [Categorize] → [Append to lessons_learned.md] → [Notify]
```

## 🔧 Intégration Claude API

### Node HTTP Request Configuration
```json
{
  "method": "POST",
  "url": "https://api.anthropic.com/v1/messages",
  "authentication": "predefinedCredentialType",
  "headers": {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "x-api-key": "{{ $credentials.anthropicApi.apiKey }}"
  },
  "body": {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": "{{ $json.prompt }}"
      }
    ],
    "system": "Contexte NEMESIS: [instructions]"
  }
}
```

### Credentials Setup
```
Type: Header Auth
Name: X-API-Key
Value: sk-ant-api...
```

## 🔧 Intégration OpenAI API

### Node Configuration
```json
{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "authentication": "predefinedCredentialType",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{ $credentials.openAiApi.apiKey }}"
  },
  "body": {
    "model": "gpt-4-turbo-preview",
    "messages": [
      {
        "role": "system",
        "content": "Contexte NEMESIS: [instructions]"
      },
      {
        "role": "user",
        "content": "{{ $json.prompt }}"
      }
    ],
    "max_tokens": 4096
  }
}
```

## 📈 Best Practices

### Error Handling
```javascript
// Dans un node Function après HTTP Request
if ($json.error) {
  // Log error
  console.error($json.error);
  // Fallback to another AI
  return { fallback: true, original_error: $json.error };
}
return $json;
```

### Rate Limiting
```javascript
// Ajouter délai entre requêtes
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
await delay(1000); // 1 seconde entre appels
```

### Logging
- Activer logs détaillés en développement
- Utiliser node "Set" pour tracer les étapes
- Exporter logs vers fichier/service externe

### Security
- Ne jamais hardcoder les API keys
- Utiliser les credentials N8N
- Limiter accès webhook (IP whitelist)
- HTTPS en production

## 🔄 Maintenance

### Backup Workflows
```bash
# Export via CLI
n8n export:workflow --all --output=./backups/

# Ou via API
curl -X GET "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: your_api_key" > workflows_backup.json
```

### Monitoring
- Dashboard N8N pour executions
- Alertes sur échecs
- Métriques de performance

## ⚠️ Limitations

- Pas de persistence d'état entre executions
- Timeout sur workflows longs
- Limite de taille des payloads
- Rate limits des APIs externes

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
