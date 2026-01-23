---
title: "MCP (Model Context Protocol)"
date: 2025-01-23
category: Knowledge/Technical
tags: [mcp, protocol, claude, integration]
version: 1.0
status: active
---

# MCP (Model Context Protocol) - Guide Technique

## 📋 Vue d'ensemble

MCP (Model Context Protocol) est un protocole développé par Anthropic permettant à Claude de se connecter à des outils et services externes de manière sécurisée et structurée.

## 🎯 Objectifs MCP

- Connecter Claude à des outils locaux (filesystem, databases)
- Intégrer des APIs externes de manière transparente
- Étendre les capacités de Claude avec des fonctions custom
- Maintenir la sécurité et le contrôle utilisateur

## ⚙️ Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Claude    │ ←──→ │ MCP Server  │ ←──→ │   Tools     │
│  (Client)   │      │  (Bridge)   │      │ (Resources) │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                     ┌──────┴──────┐
                     │             │
              ┌──────┴──┐   ┌──────┴──┐
              │Filesystem│   │ Database │
              └─────────┘   └─────────┘
```

## 🛠️ Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Claude Desktop ou API access

### Installation MCP SDK
```bash
npm install @anthropic-ai/mcp-sdk
# ou
yarn add @anthropic-ai/mcp-sdk
```

### Configuration Claude Desktop
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path/to/allowed/directory"]
    },
    "custom-server": {
      "command": "node",
      "args": ["/path/to/your/mcp-server.js"]
    }
  }
}
```

## 📊 Servers MCP disponibles

### Filesystem Server
Accès au système de fichiers local.

```bash
npx -y @anthropic-ai/mcp-server-filesystem /path/to/directory
```

**Capabilities**:
- Lire fichiers
- Écrire fichiers
- Lister répertoires
- Rechercher fichiers

### SQLite Server
Accès à des bases de données SQLite.

```bash
npx -y @anthropic-ai/mcp-server-sqlite /path/to/database.db
```

**Capabilities**:
- Exécuter requêtes SELECT
- Insérer/Modifier données
- Schéma exploration

### GitHub Server
Intégration avec GitHub.

```bash
npx -y @anthropic-ai/mcp-server-github
```

**Capabilities**:
- Lire repositories
- Créer issues/PRs
- Gérer branches

## 🔧 Création d'un MCP Server Custom

### Structure de base
```typescript
// mcp-server.ts
import { Server } from "@anthropic-ai/mcp-sdk/server";
import { StdioServerTransport } from "@anthropic-ai/mcp-sdk/server/stdio";

const server = new Server({
  name: "nemesis-mcp-server",
  version: "1.0.0"
});

// Définir les tools disponibles
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "search_memory",
      description: "Search in NEMESIS collective memory",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          category: { type: "string", enum: ["Context", "Projects", "Knowledge", "Solutions", "Learnings"] }
        },
        required: ["query"]
      }
    },
    {
      name: "add_learning",
      description: "Add a new learning to the collective memory",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Learning content" },
          category: { type: "string", description: "Category" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["content"]
      }
    }
  ]
}));

// Implémenter les handlers
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_memory":
      return await searchMemory(args.query, args.category);
    case "add_learning":
      return await addLearning(args.content, args.category, args.tags);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Démarrer le serveur
const transport = new StdioServerTransport();
server.connect(transport);
```

### Implémentation des fonctions
```typescript
import fs from 'fs/promises';
import path from 'path';

const MEMORY_PATH = "/path/to/NEMESIS_Collective_Memory";

async function searchMemory(query: string, category?: string): Promise<string> {
  const searchPath = category
    ? path.join(MEMORY_PATH, category)
    : MEMORY_PATH;

  const results: string[] = [];

  async function searchDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await searchDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push(`## ${fullPath}\n${extractRelevantSection(content, query)}`);
        }
      }
    }
  }

  await searchDir(searchPath);

  return results.length > 0
    ? results.join('\n\n---\n\n')
    : `No results found for "${query}"`;
}

async function addLearning(content: string, category?: string, tags?: string[]): Promise<string> {
  const learningsPath = path.join(MEMORY_PATH, "Learnings", "lessons_learned.md");

  const timestamp = new Date().toISOString();
  const tagsStr = tags ? tags.map(t => `#${t}`).join(' ') : '';

  const entry = `\n\n## ${timestamp}\n${tagsStr}\n\n${content}`;

  await fs.appendFile(learningsPath, entry);

  return `Learning added successfully at ${timestamp}`;
}

function extractRelevantSection(content: string, query: string): string {
  const lines = content.split('\n');
  const queryLower = query.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(queryLower)) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 5);
      return lines.slice(start, end).join('\n');
    }
  }

  return content.slice(0, 500) + '...';
}
```

## 📈 Use Cases NEMESIS

### 1. Accès à la mémoire collective
```
Claude peut maintenant:
- Rechercher dans tous les fichiers NEMESIS
- Ajouter des learnings automatiquement
- Lire les configurations et préférences
- Accéder aux solutions passées
```

### 2. Intégration N8N
```typescript
// MCP Server pour déclencher workflows N8N
server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "trigger_workflow") {
    const response = await fetch("http://localhost:5678/webhook/...", {
      method: "POST",
      body: JSON.stringify(request.params.arguments)
    });
    return await response.json();
  }
});
```

### 3. Accès bases de données
```typescript
// MCP Server pour requêtes DB
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('/path/to/nemesis.db');

server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "query_db") {
    return new Promise((resolve, reject) => {
      db.all(request.params.arguments.sql, (err, rows) => {
        if (err) reject(err);
        else resolve(JSON.stringify(rows, null, 2));
      });
    });
  }
});
```

## ⚠️ Sécurité

### Bonnes pratiques
- Limiter les chemins accessibles
- Valider toutes les entrées
- Pas d'exécution de code arbitraire
- Logging des actions sensibles
- Permissions minimales

### Exemple de validation
```typescript
function validatePath(requestedPath: string, allowedBase: string): string {
  const resolved = path.resolve(allowedBase, requestedPath);

  if (!resolved.startsWith(allowedBase)) {
    throw new Error("Path traversal attempt detected");
  }

  return resolved;
}
```

## 🔄 Debugging

### Logs
```typescript
server.setRequestHandler("tools/call", async (request) => {
  console.error(`[MCP] Tool called: ${request.params.name}`);
  console.error(`[MCP] Arguments: ${JSON.stringify(request.params.arguments)}`);

  try {
    const result = await handleTool(request);
    console.error(`[MCP] Result: ${result.slice(0, 200)}...`);
    return result;
  } catch (error) {
    console.error(`[MCP] Error: ${error.message}`);
    throw error;
  }
});
```

### Test manuel
```bash
# Tester le serveur MCP directement
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node mcp-server.js
```

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
