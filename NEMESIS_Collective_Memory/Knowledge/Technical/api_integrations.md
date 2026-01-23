---
title: "API Integrations"
date: 2025-01-23
category: Knowledge/Technical
tags: [api, integration, development, technical]
version: 1.0
status: active
---

# API Integrations - Guide Technique

## 📋 Vue d'ensemble

Documentation des intégrations API utilisées dans le projet NEMESIS, incluant configurations, authentification et exemples.

## 🤖 APIs IA

### Anthropic (Claude)

**Base URL**: `https://api.anthropic.com`

**Authentification**:
```
Header: x-api-key: sk-ant-api03-...
Header: anthropic-version: 2023-06-01
```

**Endpoint Messages**:
```bash
POST /v1/messages

curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4096,
    "system": "Contexte NEMESIS...",
    "messages": [
      {"role": "user", "content": "Votre prompt"}
    ]
  }'
```

**Modèles disponibles**:
- `claude-opus-4-20250514` - Plus puissant
- `claude-sonnet-4-20250514` - Équilibré
- `claude-3-5-haiku-20241022` - Rapide et économique

### OpenAI (ChatGPT)

**Base URL**: `https://api.openai.com`

**Authentification**:
```
Header: Authorization: Bearer sk-...
```

**Endpoint Chat Completions**:
```bash
POST /v1/chat/completions

curl -X POST "https://api.openai.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4-turbo-preview",
    "messages": [
      {"role": "system", "content": "Contexte NEMESIS..."},
      {"role": "user", "content": "Votre prompt"}
    ],
    "max_tokens": 4096
  }'
```

**Modèles disponibles**:
- `gpt-4-turbo-preview` - Dernière version
- `gpt-4` - Stable
- `gpt-3.5-turbo` - Économique

### Mistral AI

**Base URL**: `https://api.mistral.ai`

**Authentification**:
```
Header: Authorization: Bearer ...
```

**Endpoint Chat**:
```bash
POST /v1/chat/completions

curl -X POST "https://api.mistral.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -d '{
    "model": "mistral-large-latest",
    "messages": [
      {"role": "system", "content": "Contexte NEMESIS..."},
      {"role": "user", "content": "Votre prompt"}
    ]
  }'
```

### Google Gemini

**Base URL**: `https://generativelanguage.googleapis.com`

**Authentification**:
```
Query param: key=AIza...
```

**Endpoint Generate Content**:
```bash
POST /v1/models/gemini-pro:generateContent?key=$GOOGLE_API_KEY

curl -X POST "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {"parts": [{"text": "Votre prompt"}]}
    ],
    "systemInstruction": {
      "parts": [{"text": "Contexte NEMESIS..."}]
    }
  }'
```

### DeepSeek

**Base URL**: `https://api.deepseek.com`

**Authentification**:
```
Header: Authorization: Bearer sk-...
```

**Endpoint Chat** (compatible OpenAI):
```bash
POST /v1/chat/completions

curl -X POST "https://api.deepseek.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "Contexte NEMESIS..."},
      {"role": "user", "content": "Votre prompt"}
    ]
  }'
```

## 🔧 APIs Productivité

### Google Workspace

**Scopes nécessaires**:
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/calendar
```

**Google Drive - List files**:
```bash
GET https://www.googleapis.com/drive/v3/files
Authorization: Bearer $GOOGLE_ACCESS_TOKEN
```

**Google Sheets - Read**:
```bash
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
Authorization: Bearer $GOOGLE_ACCESS_TOKEN
```

### Notion

**Base URL**: `https://api.notion.com`

**Authentification**:
```
Header: Authorization: Bearer secret_...
Header: Notion-Version: 2022-06-28
```

**Query Database**:
```bash
POST /v1/databases/{database_id}/query

curl -X POST "https://api.notion.com/v1/databases/{database_id}/query" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "property": "Status",
      "select": {"equals": "Active"}
    }
  }'
```

### GitHub

**Base URL**: `https://api.github.com`

**Authentification**:
```
Header: Authorization: token ghp_...
```

**List Repositories**:
```bash
GET /user/repos
Authorization: token $GITHUB_TOKEN
```

## 🔐 Gestion des credentials

### Variables d'environnement
```bash
# .env (JAMAIS commité)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
NOTION_API_KEY=secret_...
GITHUB_TOKEN=ghp_...
```

### Chargement sécurisé
```python
import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY not set")
```

```typescript
import dotenv from 'dotenv';
dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY not set");
}
```

## 📊 Rate Limits et Quotas

| API | Rate Limit | Notes |
|-----|------------|-------|
| Anthropic | 60 RPM (tier 1) | Augmente avec usage |
| OpenAI | 60 RPM (tier 1) | Varie selon modèle |
| Mistral | 120 RPM | Plan Pro |
| Gemini | 60 RPM | Quotas projet |
| DeepSeek | Variable | Voir dashboard |

### Gestion des rate limits
```python
import time
from functools import wraps

def rate_limited(max_per_minute):
    min_interval = 60.0 / max_per_minute
    last_called = [0.0]

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            wait = min_interval - elapsed
            if wait > 0:
                time.sleep(wait)
            result = func(*args, **kwargs)
            last_called[0] = time.time()
            return result
        return wrapper
    return decorator

@rate_limited(60)  # Max 60 calls per minute
def call_api():
    pass
```

## 🔄 Retry Logic

```python
import time
import requests
from typing import Callable

def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0
):
    """Retry with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return func()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            print(f"Attempt {attempt + 1} failed, retrying in {delay}s...")
            time.sleep(delay)
```

## ⚠️ Error Handling

### Codes d'erreur communs
| Code | Signification | Action |
|------|---------------|--------|
| 401 | Non autorisé | Vérifier API key |
| 429 | Rate limit | Attendre et retry |
| 500 | Erreur serveur | Retry avec backoff |
| 503 | Service indisponible | Retry plus tard |

### Exemple de gestion
```python
def handle_api_response(response):
    if response.status_code == 200:
        return response.json()
    elif response.status_code == 401:
        raise AuthenticationError("Invalid API key")
    elif response.status_code == 429:
        retry_after = int(response.headers.get("Retry-After", 60))
        raise RateLimitError(f"Rate limited, retry after {retry_after}s")
    elif response.status_code >= 500:
        raise ServerError(f"Server error: {response.status_code}")
    else:
        raise APIError(f"API error: {response.status_code}")
```

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
