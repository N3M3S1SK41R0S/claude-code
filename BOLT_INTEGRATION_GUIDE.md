# Guide d'Intégration Complet pour Bolt

## Vue d'Ensemble de Claude Code

Claude Code est un outil de codage agentique CLI qui vit dans le terminal, comprend les codebases et aide à coder plus rapidement via des commandes en langage naturel.

---

## Table des Matières

1. [Architecture Globale](#1-architecture-globale)
2. [Système de Commandes](#2-système-de-commandes)
3. [Outils Disponibles (Tools)](#3-outils-disponibles-tools)
4. [Système de Hooks](#4-système-de-hooks)
5. [MCP (Model Context Protocol)](#5-mcp-model-context-protocol)
6. [Système d'Agents Personnalisés](#6-système-dagents-personnalisés)
7. [Système de Permissions](#7-système-de-permissions)
8. [Configuration et Settings](#8-configuration-et-settings)
9. [SDK et API](#9-sdk-et-api)
10. [Fonctionnalités Avancées](#10-fonctionnalités-avancées)
11. [Subtilités d'Implémentation](#11-subtilités-dimplémentation)

---

## 1. Architecture Globale

### 1.1 Structure du Projet

```
claude-code/
├── .claude/                    # Configuration projet
│   ├── commands/               # Commandes slash personnalisées
│   │   └── *.md               # Fichiers de commandes
│   └── settings.json          # Paramètres projet
├── .vscode/                    # Intégration IDE
│   └── settings.json
├── .devcontainer/              # Configuration Docker/sandbox
│   └── devcontainer.json
├── .github/                    # CI/CD et templates
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── CLAUDE.md                   # Instructions projet (lu au démarrage)
└── .mcp.json                   # Configuration serveurs MCP
```

### 1.2 Fichiers de Configuration Utilisateur

```
~/.claude/
├── .claude.json               # Configuration globale utilisateur
├── settings.json              # Paramètres utilisateur
├── commands/                  # Commandes slash utilisateur
└── agents/                    # Agents personnalisés
```

### 1.3 Flux de Données Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INPUT                               │
│  (Terminal CLI, IDE Extension, SDK, GitHub @claude mention)      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CONTEXT GATHERING                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │CLAUDE.md │  │ MCP      │  │ @mentions│  │ Conversation     │ │
│  │ imports  │  │ servers  │  │ files    │  │ history          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HOOKS: SessionStart                         │
│                      HOOKS: UserPromptSubmit                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LLM PROCESSING                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Models: Opus 4.5, Opus 4, Sonnet 4, Haiku              │   │
│  │  Thinking Mode: Extended thinking for complex tasks      │   │
│  │  Plan Mode: Opus for planning, Sonnet for execution      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TOOL EXECUTION                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Bash   │  │  Read   │  │  Edit   │  │  Write  │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Glob   │  │  Grep   │  │  Task   │  │WebSearch│            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │WebFetch │  │TodoWrite│  │Notebook │  │ MCP     │            │
│  │         │  │         │  │  Edit   │  │ Tools   │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HOOKS: PreToolUse                           │
│                      HOOKS: PostToolUse                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT & RESPONSE                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Terminal │  │  IDE     │  │  JSON    │  │ Stream           │ │
│  │ Display  │  │  Diffs   │  │  Output  │  │ Output           │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HOOKS: Stop / SessionEnd                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Système de Commandes

### 2.1 Commandes Slash Intégrées

| Commande | Description |
|----------|-------------|
| `/help` | Affiche l'aide |
| `/bug` | Rapporter un bug |
| `/clear` | Efface la conversation |
| `/compact` | Compacte le contexte |
| `/config` | Modifier la configuration |
| `/context` | Debug des problèmes de contexte |
| `/cost` | Afficher les coûts |
| `/doctor` | Diagnostic des problèmes |
| `/export` | Exporter la conversation |
| `/memory` | Gérer la mémoire (CLAUDE.md) |
| `/model` | Changer le modèle |
| `/mcp` | Gérer les serveurs MCP |
| `/permissions` | Gérer les permissions d'outils |
| `/pr-comments` | Voir commentaires PR GitHub |
| `/resume` | Reprendre une conversation |
| `/rewind` | Annuler des changements de code |
| `/status` | État système et compte |
| `/statusline` | Configurer la ligne de statut |
| `/terminal-setup` | Configuration terminal |
| `/todos` | Voir les todos en cours |
| `/upgrade` | Passer à Claude Max |
| `/usage` | Voir les limites du plan |
| `/vim` | Activer mode vim |
| `/agents` | Gérer les agents personnalisés |
| `/add-dir` | Ajouter un répertoire de travail |

### 2.2 Commandes Slash Personnalisées

**Emplacement des fichiers:**
- Projet: `.claude/commands/*.md`
- Utilisateur: `~/.claude/commands/*.md`

**Structure du fichier commande:**

```markdown
---
description: Description courte de la commande
argument-hint: <nom-argument>
model: opus|sonnet|haiku  # Optionnel
allowed-tools:            # Optionnel
  - Bash(git *)
  - Read
  - Edit
---

Contenu du prompt qui sera injecté.

Peut utiliser:
- $ARGUMENTS pour les arguments passés
- @path/to/file.md pour inclure des fichiers
- Les mots-clés "think" pour activer le thinking

<!-- bash
echo "Code bash exécuté et output inclus"
-->
```

**Namespacing par sous-dossiers:**
- `.claude/commands/frontend/component.md` → `/frontend:component`

---

## 3. Outils Disponibles (Tools)

### 3.1 Outils de Fichiers

#### Read
```typescript
{
  file_path: string;     // Chemin absolu obligatoire
  offset?: number;       // Ligne de départ (optionnel)
  limit?: number;        // Nombre de lignes (défaut: 2000)
}
```
- Supporte: texte, images (PNG, JPG), PDFs, Jupyter notebooks (.ipynb)
- Lignes > 2000 caractères sont tronquées
- Format de sortie: `cat -n` avec numéros de ligne

#### Write
```typescript
{
  file_path: string;     // Chemin absolu obligatoire
  content: string;       // Contenu à écrire
}
```
- Écrase le fichier existant
- DOIT lire le fichier d'abord s'il existe

#### Edit
```typescript
{
  file_path: string;     // Chemin absolu obligatoire
  old_string: string;    // Texte à remplacer (doit être unique)
  new_string: string;    // Nouveau texte
  replace_all?: boolean; // Remplacer toutes les occurrences
}
```
- L'edit ÉCHOUE si `old_string` n'est pas unique
- Préserver l'indentation exacte (tabs/espaces)

### 3.2 Outils de Recherche

#### Glob
```typescript
{
  pattern: string;       // Pattern glob (ex: "**/*.ts")
  path?: string;         // Répertoire de recherche
}
```
- Retourne les fichiers triés par date de modification

#### Grep
```typescript
{
  pattern: string;       // Regex (syntaxe ripgrep)
  path?: string;         // Fichier ou répertoire
  glob?: string;         // Filtrer par pattern (ex: "*.js")
  type?: string;         // Type de fichier (js, py, rust, etc.)
  output_mode?: "content" | "files_with_matches" | "count";
  "-A"?: number;         // Lignes après
  "-B"?: number;         // Lignes avant
  "-C"?: number;         // Lignes contexte
  "-i"?: boolean;        // Insensible à la casse
  "-n"?: boolean;        // Numéros de ligne (défaut: true)
  multiline?: boolean;   // Mode multiligne
  head_limit?: number;   // Limiter les résultats
  offset?: number;       // Sauter N premiers résultats
}
```

### 3.3 Outil Bash

```typescript
{
  command: string;           // Commande à exécuter
  description?: string;      // Description (5-10 mots simple, plus détaillé si complexe)
  timeout?: number;          // Timeout en ms (max: 600000, défaut: 120000)
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;
}
```

**Règles importantes:**
- Le répertoire de travail persiste entre les commandes
- L'état du shell ne persiste PAS
- Toujours quoter les chemins avec espaces
- Ne PAS utiliser pour lecture/écriture de fichiers (utiliser Read/Write)
- Pour les commandes longues, utiliser `run_in_background: true`

### 3.4 Outil Task (Sub-agents)

```typescript
{
  prompt: string;            // Tâche à effectuer
  description: string;       // Description courte (3-5 mots)
  subagent_type: string;     // Type d'agent
  model?: "sonnet" | "opus" | "haiku";
  allowed_tools?: string[];  // Outils autorisés
  run_in_background?: boolean;
  resume?: string;           // ID d'agent pour reprendre
  max_turns?: number;
}
```

**Types d'agents intégrés:**
- `Bash` - Spécialiste commandes bash/git
- `Explore` - Exploration rapide de codebase
- `Plan` - Architecte logiciel pour planification
- `general-purpose` - Agent général multi-tâches

### 3.5 Outils Web

#### WebSearch
```typescript
{
  query: string;             // Requête de recherche
  allowed_domains?: string[];
  blocked_domains?: string[];
}
```

#### WebFetch
```typescript
{
  url: string;               // URL complète (HTTPS)
  prompt: string;            // Prompt pour analyser le contenu
}
```
- Convertit HTML en markdown
- Cache de 15 minutes
- Gère les redirections

### 3.6 Outil TodoWrite

```typescript
{
  todos: Array<{
    content: string;         // Description impérative
    activeForm: string;      // Forme continue (ex: "Running tests")
    status: "pending" | "in_progress" | "completed";
  }>
}
```

**Règles:**
- UN SEUL todo `in_progress` à la fois
- Marquer comme `completed` IMMÉDIATEMENT après avoir fini
- Ne PAS marquer `completed` si erreurs/blocages

### 3.7 NotebookEdit (Jupyter)

```typescript
{
  notebook_path: string;     // Chemin absolu
  new_source: string;        // Nouveau contenu
  cell_id?: string;          // ID de la cellule
  cell_type?: "code" | "markdown";
  edit_mode?: "replace" | "insert" | "delete";
}
```

---

## 4. Système de Hooks

### 4.1 Types de Hooks

| Hook | Déclencheur | Peut Bloquer |
|------|-------------|--------------|
| `SessionStart` | Nouvelle session | Non |
| `SessionEnd` | Fin de session | Non |
| `UserPromptSubmit` | Soumission utilisateur | Oui |
| `PreToolUse` | Avant exécution outil | Oui |
| `PostToolUse` | Après exécution outil | Non |
| `PreCompact` | Avant compaction | Non |
| `Stop` | Arrêt agent principal | Non |
| `SubagentStop` | Arrêt sous-agent | Non |

### 4.2 Configuration des Hooks

```json
// settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "/path/to/validator.py",
        "timeout": 5000
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "command": "/path/to/formatter.sh"
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "/path/to/prompt-filter.py"
      }
    ]
  },
  "disableAllHooks": false
}
```

### 4.3 Interface Hook (JSON)

**Input (stdin):**
```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "xxx",
  "transcript_path": "/path/to/transcript.json",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf /"
  }
}
```

**Output (stdout):**
```json
{
  "decision": "allow" | "block" | "modify",
  "reason": "Message à afficher si block",
  "modifiedInput": {},
  "additionalContext": "Contexte additionnel",
  "systemMessage": "Message système"
}
```

### 4.4 Variables d'Environnement pour Hooks

```
CLAUDE_PROJECT_DIR=/path/to/project
```

---

## 5. MCP (Model Context Protocol)

### 5.1 Configuration MCP

**Fichiers de configuration:**
- Projet: `.mcp.json`
- Local: `.claude/.mcp.local.json`
- Utilisateur: `~/.claude/.mcp.json`

**Structure:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-xxx"],
      "env": {
        "API_KEY": "${ENV_VAR}"
      },
      "timeout": 30000,
      "disabled": false
    }
  }
}
```

### 5.2 Types de Serveurs MCP

1. **stdio** - Processus local avec stdin/stdout
2. **SSE** - Server-Sent Events (HTTP)
3. **Streamable HTTP** - HTTP avec streaming

### 5.3 Configuration Avancée MCP

```json
{
  "mcpServers": {
    "remote-server": {
      "url": "https://mcp.example.com/sse",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      },
      "headersHelper": "/path/to/auth-helper.sh"
    }
  }
}
```

### 5.4 Fonctionnalités MCP

- **OAuth**: Support authentification OAuth pour serveurs distants
- **Resources**: Ressources @-mentionnables
- **Tools**: Outils exposés au LLM
- **Instructions**: Instructions serveur incluses dans le contexte

### 5.5 Commandes MCP CLI

```bash
claude mcp add <name>                    # Assistant interactif
claude mcp add-json <name> <json>        # Ajouter via JSON
claude mcp add-from-claude-desktop       # Importer depuis Claude Desktop
claude mcp list                          # Lister les serveurs
claude mcp remove <name>                 # Supprimer un serveur
```

---

## 6. Système d'Agents Personnalisés

### 6.1 Création d'Agent

**Emplacement:** `~/.claude/agents/*.md` ou `.claude/agents/*.md`

**Structure:**
```markdown
---
name: Mon Agent
description: Description de ce que fait l'agent
model: opus|sonnet|haiku
tools:
  - Bash(git *)
  - Read
  - Edit
  - Grep
---

Instructions système pour l'agent.

Tu es un agent spécialisé dans...
```

### 6.2 Invocation d'Agents

- Via commande: `/agents` puis sélection
- Via @-mention: `@mon-agent fait ceci...`
- Via Tool Task: `subagent_type: "mon-agent"`

### 6.3 Agents Intégrés

| Agent | Usage |
|-------|-------|
| `Bash` | Commandes git, exécution terminal |
| `Explore` | Exploration codebase (quick/medium/very thorough) |
| `Plan` | Planification architecture |
| `general-purpose` | Tâches multi-étapes |
| `claude-code-guide` | Questions sur Claude Code |
| `statusline-setup` | Configuration statusline |

---

## 7. Système de Permissions

### 7.1 Niveaux de Permission

1. **Demander** (Ask) - Demande confirmation chaque fois
2. **Autoriser** (Allow) - Autorisé automatiquement
3. **Refuser** (Deny) - Toujours refusé

### 7.2 Configuration Permissions

```json
// settings.json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(git status)",
      "Bash(npm test)",
      "Bash(git commit:*)",
      "Edit(src/**)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Write(.env)"
    ]
  }
}
```

### 7.3 Syntaxe des Règles

```
Tool                    # Tout usage de l'outil
Tool(pattern)           # Avec pattern glob
Tool(prefix:*)          # Préfixe avec wildcard
Bash(command > output)  # Avec redirections
Edit(path/**)           # Patterns de chemins
```

### 7.4 Mode Dangereux

```bash
claude --dangerously-skip-permissions
```
- UNIQUEMENT en mode non-interactif (`-p`)
- Désactive TOUTES les vérifications de permissions

---

## 8. Configuration et Settings

### 8.1 Hiérarchie de Configuration

```
1. Défauts système (priorité la plus basse)
   │
2. ~/.claude/settings.json (utilisateur)
   │
3. .claude/settings.json (projet)
   │
4. Variables d'environnement
   │
5. Arguments CLI (priorité la plus haute)
```

### 8.2 Structure settings.json

```json
{
  // Modèles
  "model": "claude-sonnet-4-20250514",
  "smallModel": "claude-haiku",

  // Permissions
  "permissions": {
    "allow": [],
    "deny": []
  },

  // Hooks
  "hooks": {},
  "disableAllHooks": false,

  // Affichage
  "theme": "dark",
  "spinnerTipsEnabled": true,

  // Comportement
  "autoCompact": true,
  "cleanupPeriodDays": 30,

  // Patterns à ignorer
  "ignorePatterns": [
    "node_modules/**",
    ".git/**",
    "*.log"
  ]
}
```

### 8.3 Variables d'Environnement Importantes

```bash
# API et Authentification
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_AUTH_TOKEN=xxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_SMALL_FAST_MODEL=claude-haiku

# Modèles personnalisés
ANTHROPIC_DEFAULT_SONNET_MODEL=xxx
ANTHROPIC_DEFAULT_OPUS_MODEL=xxx

# Bedrock/Vertex
AWS_BEARER_TOKEN_BEDROCK=xxx
CLOUD_ML_REGION=us-central1

# Comportement
CLAUDE_BASH_NO_LOGIN=1
CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1
DISABLE_INTERLEAVED_THINKING=1

# Timeouts
BASH_DEFAULT_TIMEOUT_MS=120000
BASH_MAX_TIMEOUT_MS=600000
MCP_TIMEOUT=30000
MCP_TOOL_TIMEOUT=60000

# Debug
ANTHROPIC_LOG=debug
DEBUG=true

# Chemins
CLAUDE_CONFIG_DIR=/custom/path
XDG_CONFIG_HOME=/custom/xdg

# IDE
CLAUDE_CODE_AUTO_CONNECT_IDE=false

# Proxy
NO_PROXY=localhost,127.0.0.1

# Shell
CLAUDE_CODE_SHELL_PREFIX="time"
USE_BUILTIN_RIPGREP=1
```

### 8.4 Fichier CLAUDE.md

**Emplacement:** Racine du projet

**Fonctionnalités:**
- Lu automatiquement au démarrage
- Supporte les imports: `@path/to/other.md`
- Contient les instructions projet

**Exemple:**
```markdown
# Instructions Projet

Ce projet utilise TypeScript avec React.

## Conventions
- Utiliser des composants fonctionnels
- Tests avec Jest et React Testing Library

## Architecture
@docs/architecture.md

## API
@docs/api-reference.md
```

---

## 9. SDK et API

### 9.1 SDK TypeScript

```typescript
import { ClaudeCode } from '@anthropic-ai/claude-code';
// Renommé: Claude Agent SDK

const claude = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const result = await claude.run({
  prompt: "Explique ce code",
  additionalDirectories: ["/path/to/other"],
  systemPrompt: "Tu es un assistant...",
});
```

### 9.2 SDK Python

```python
from claude_code_sdk import ClaudeCode

claude = ClaudeCode(api_key="xxx")
result = claude.run(
    prompt="Explique ce code",
    additional_directories=["/path/to/other"]
)
```

### 9.3 Mode CLI Headless (--print / -p)

```bash
# Sortie simple
claude -p "Explique ce fichier" < file.ts

# Sortie JSON
claude -p --output-format json "Analyse ce code"

# Streaming JSON
claude -p --output-format stream-json "Implémente X"

# Avec système prompt
claude -p --system-prompt "Tu es expert Python" "Optimise ce code"

# Depuis fichier
claude -p --system-prompt-file prompt.txt "Question"

# Append au système prompt
claude --append-system-prompt "Réponds en français" "Hello"
```

### 9.4 Options CLI Importantes

```bash
# Sessions
claude --continue               # Continuer dernière session
claude --resume                 # Choisir une session à reprendre
claude --resume <session-id>    # Reprendre session spécifique

# Configuration
claude --model opus             # Forcer un modèle
claude --mcp-config file.json   # Config MCP temporaire
claude --add-dir /path          # Ajouter répertoire
claude --settings file.json     # Charger settings

# Agents
claude --agents agent1,agent2   # Ajouter agents dynamiquement

# Debug
claude --mcp-debug              # Debug serveurs MCP
```

### 9.5 Événements SDK

```typescript
// Types d'événements streaming
interface StreamEvent {
  type: 'message' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool_name?: string;
  tool_input?: object;
  tool_result?: string;
  parent_tool_use_id?: string;  // Pour sub-tasks
}
```

---

## 10. Fonctionnalités Avancées

### 10.1 Mode Thinking (Réflexion Étendue)

**Activation:**
- Dire "think", "think harder", "ultrathink" dans le prompt
- Tab pour toggle (sticky entre sessions)
- `/t` pour désactiver temporairement

**Comportement:**
- Extended thinking pour tâches complexes
- Budget de tokens augmenté
- Meilleure planification

### 10.2 Plan Mode

**Configuration:**
```json
{
  "planMode": {
    "enabled": true,
    "planModel": "opus",
    "executeModel": "sonnet"
  }
}
```

- Opus pour la planification
- Sonnet pour l'exécution
- Shift+Tab pour toggle

### 10.3 Auto-Compaction

```json
{
  "autoCompact": true,
  "autoCompactThreshold": 0.8  // 80% du contexte
}
```

- Résume automatiquement les conversations longues
- Préserve les informations importantes
- Hook `PreCompact` disponible

### 10.4 Intégration IDE

**VSCode Extension:**
- Extension native disponible
- Diffs visuels
- Image paste (Cmd+V / Alt+V)
- Synchronisation sessions

**Configuration:**
```json
{
  "CLAUDE_CODE_AUTO_CONNECT_IDE": true
}
```

### 10.5 GitHub Integration

**@claude mentions:**
- Tag @claude dans les issues/PRs
- Réponse automatique

**Commandes:**
```bash
/install-github-app    # Installer l'app GitHub
/pr-comments           # Voir commentaires PR
```

### 10.6 Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| Tab | Auto-complétion / Toggle thinking |
| Shift+Tab | Toggle auto-accept / Plan mode |
| Ctrl+R | Recherche historique |
| Ctrl+O | Mode transcript |
| Ctrl+B | Commande en background |
| Ctrl+Z | Suspendre (fg pour reprendre) |
| Ctrl+\_ | Undo input |
| Esc | Interrompre / Annuler |

### 10.7 Vim Mode

```bash
/vim  # Activer
/config  # Configurer
```

Supporte: j, k, h, l, w, b, c, f, F, t, T, u (undo)

---

## 11. Subtilités d'Implémentation

### 11.1 Gestion du Contexte

1. **Limite de tokens:** Le contexte est limité, auto-compaction quand ~80%
2. **@-mentions:** Fichiers tronqués à 2000 lignes
3. **Images:** Redimensionnées avant upload
4. **PDFs:** Traités page par page

### 11.2 Sécurité

1. **Sandbox Bash:**
   - Commandes dangereuses détectées
   - Redirections vérifiées
   - Chemins validés

2. **Fichiers sensibles:**
   - Ne jamais committer .env, credentials
   - Avertissement si tentative

3. **Git Safety:**
   - Jamais de force push sans demande
   - Jamais de reset --hard automatique
   - Toujours nouveaux commits (pas amend sauf demandé)

### 11.3 Performance

1. **Recherche fichiers:**
   - Ripgrep intégré
   - Glob optimisé pour grandes codebases
   - Cache pour suggestions

2. **Streaming:**
   - Rendu incrémental
   - Pas de blocage UI pendant traitement

3. **Sessions:**
   - Stockage optimisé
   - Cleanup automatique (cleanupPeriodDays)

### 11.4 Robustesse

1. **Retry automatique:**
   - Erreurs réseau: 4 tentatives
   - Backoff exponentiel: 2s, 4s, 8s, 16s

2. **Recovery:**
   - Sessions persistées
   - Reprise possible après crash

3. **Validation:**
   - /doctor pour diagnostic
   - Validation settings au démarrage

### 11.5 Particularités des Outils

**Edit:**
- `old_string` DOIT être unique
- Préserver indentation exacte
- Lire fichier AVANT d'éditer

**Bash:**
- Working dir persiste, état shell non
- Pas de commandes interactives (-i)
- Quoter chemins avec espaces

**Task (Sub-agents):**
- Lancer plusieurs en parallèle si indépendants
- Résumer résultats pour l'utilisateur
- Peut reprendre avec `resume: agent_id`

**Grep:**
- Syntaxe ripgrep (pas grep standard)
- Accolades littérales: `\{` `\}`
- Mode multiligne: `multiline: true`

### 11.6 Bonnes Pratiques

1. **Édition de code:**
   - TOUJOURS lire avant d'éditer
   - Préférer Edit à Write pour fichiers existants
   - Ne pas sur-ingénierer

2. **Commits:**
   - UNIQUEMENT quand demandé
   - Messages via HEREDOC pour formatage
   - Ajouter fichiers spécifiques (pas `git add -A`)

3. **Recherche:**
   - Task/Explore pour recherches ouvertes
   - Grep/Glob pour recherches précises
   - Paralléliser quand possible

4. **Communication:**
   - Texte direct (pas echo/bash)
   - Concis mais complet
   - Références fichier:ligne

---

## 12. Checklist d'Implémentation pour Bolt

### Phase 1: Core
- [ ] Parser et exécuter commandes slash
- [ ] Système de tools avec permissions
- [ ] Intégration LLM avec streaming
- [ ] Gestion du contexte et compaction

### Phase 2: Fichiers
- [ ] Read avec support multi-format
- [ ] Edit avec validation unicité
- [ ] Write avec vérification pré-lecture
- [ ] Glob/Grep avec ripgrep

### Phase 3: Terminal
- [ ] Bash avec sandbox et timeout
- [ ] Persistance working directory
- [ ] Commandes background
- [ ] Gestion signaux (Ctrl+C, Ctrl+Z)

### Phase 4: Agents
- [ ] Système Task avec sub-agents
- [ ] Types d'agents intégrés
- [ ] Agents personnalisés
- [ ] Exécution parallèle

### Phase 5: Intégrations
- [ ] MCP protocol (stdio, SSE, HTTP)
- [ ] Hooks système
- [ ] IDE extension
- [ ] GitHub integration

### Phase 6: UX
- [ ] Auto-complétion
- [ ] Raccourcis clavier
- [ ] Mode vim
- [ ] Themes et personnalisation

### Phase 7: Avancé
- [ ] Thinking mode
- [ ] Plan mode
- [ ] Web search/fetch
- [ ] Sessions et reprise

---

## 13. Ressources

- **Documentation officielle:** https://docs.anthropic.com/en/docs/claude-code/overview
- **SDK TypeScript:** @anthropic-ai/claude-code (npm)
- **SDK Python:** claude-code-sdk (pip)
- **Discord:** https://anthropic.com/discord
- **Issues:** https://github.com/anthropics/claude-code/issues

---

*Document généré pour l'intégration Bolt - Version complète*
