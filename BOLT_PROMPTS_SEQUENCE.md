# Séquence Complète de Prompts pour Bolt

> Donne ces prompts à Bolt **dans l'ordre**, un par un. Attends que chaque étape soit terminée avant de passer à la suivante.

---

## PHASE 1: FONDATIONS

### Prompt 1.1 - Structure du Projet

```
Crée la structure de base pour un agent de codage IA nommé "CodeAgent":

Structure des dossiers:
```
code-agent/
├── src/
│   ├── core/
│   │   ├── agent.ts          # Boucle principale de l'agent
│   │   ├── llm.ts            # Interface avec l'API LLM
│   │   └── context.ts        # Gestion du contexte
│   ├── tools/
│   │   ├── index.ts          # Export de tous les tools
│   │   ├── base.ts           # Interface Tool de base
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── edit.ts
│   │   └── bash.ts
│   ├── permissions/
│   │   └── index.ts          # Système de permissions
│   ├── cli/
│   │   ├── index.ts          # Point d'entrée CLI
│   │   ├── input.ts          # Gestion input utilisateur
│   │   └── output.ts         # Affichage formaté
│   └── types/
│       └── index.ts          # Types TypeScript
├── package.json
├── tsconfig.json
└── README.md
```

Stack technique:
- TypeScript
- Node.js 18+
- Anthropic SDK pour l'API Claude
- chalk pour les couleurs terminal
- ora pour les spinners

Crée les fichiers de base avec le setup npm/typescript.
```

---

### Prompt 1.2 - Types de Base

```
Dans src/types/index.ts, définis tous les types TypeScript:

```typescript
// Configuration
export interface Config {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Tools
export interface ToolInput {
  [key: string]: any;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  execute(input: ToolInput): Promise<ToolResult>;
}

// Messages
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResultMessage[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: ToolInput;
}

export interface ToolResultMessage {
  toolCallId: string;
  result: ToolResult;
}

// Permissions
export interface Permission {
  tool: string;
  pattern?: string;
  action: 'allow' | 'deny' | 'ask';
}

export interface PermissionConfig {
  allow: string[];
  deny: string[];
}

// Agent State
export interface AgentState {
  messages: Message[];
  workingDirectory: string;
  permissions: PermissionConfig;
  isRunning: boolean;
}
```
```

---

### Prompt 1.3 - Interface Tool de Base

```
Dans src/tools/base.ts, crée la classe abstraite Tool:

```typescript
import { Tool, ToolInput, ToolResult } from '../types';

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: object;

  abstract execute(input: ToolInput): Promise<ToolResult>;

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected error(message: string): ToolResult {
    return { success: false, output: '', error: message };
  }

  protected validateInput(input: ToolInput, required: string[]): string | null {
    for (const field of required) {
      if (!(field in input)) {
        return `Missing required field: ${field}`;
      }
    }
    return null;
  }
}
```

Cette classe servira de base pour tous les tools.
```

---

## PHASE 2: TOOLS FICHIERS

### Prompt 2.1 - Read Tool

```
Dans src/tools/read.ts, implémente le tool Read:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class ReadTool extends BaseTool {
  name = 'Read';
  description = 'Lit le contenu d\'un fichier. Supporte texte, et retourne avec numéros de ligne.';

  inputSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Chemin absolu du fichier à lire'
      },
      offset: {
        type: 'number',
        description: 'Ligne de départ (1-indexed), optionnel'
      },
      limit: {
        type: 'number',
        description: 'Nombre de lignes à lire (défaut: 2000)'
      }
    },
    required: ['file_path']
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['file_path']);
    if (validation) return this.error(validation);

    const filePath = input.file_path as string;
    const offset = (input.offset as number) || 1;
    const limit = (input.limit as number) || 2000;

    try {
      // Vérifier que le chemin est absolu
      if (!path.isAbsolute(filePath)) {
        return this.error('Le chemin doit être absolu');
      }

      // Lire le fichier
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Appliquer offset et limit
      const selectedLines = lines.slice(offset - 1, offset - 1 + limit);

      // Formater avec numéros de ligne (style cat -n)
      const formatted = selectedLines
        .map((line, i) => {
          const lineNum = offset + i;
          const truncated = line.length > 2000 ? line.slice(0, 2000) + '...[truncated]' : line;
          return `${String(lineNum).padStart(6)}\t${truncated}`;
        })
        .join('\n');

      return this.success(formatted);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return this.error(`Fichier non trouvé: ${filePath}`);
      }
      return this.error(`Erreur lecture: ${err.message}`);
    }
  }
}
```
```

---

### Prompt 2.2 - Write Tool

```
Dans src/tools/write.ts, implémente le tool Write:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class WriteTool extends BaseTool {
  name = 'Write';
  description = 'Écrit du contenu dans un fichier. Crée le fichier et les dossiers parents si nécessaire.';

  inputSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Chemin absolu du fichier à écrire'
      },
      content: {
        type: 'string',
        description: 'Contenu à écrire dans le fichier'
      }
    },
    required: ['file_path', 'content']
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['file_path', 'content']);
    if (validation) return this.error(validation);

    const filePath = input.file_path as string;
    const content = input.content as string;

    try {
      // Vérifier chemin absolu
      if (!path.isAbsolute(filePath)) {
        return this.error('Le chemin doit être absolu');
      }

      // Créer les dossiers parents si nécessaire
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Écrire le fichier
      await fs.writeFile(filePath, content, 'utf-8');

      const lines = content.split('\n').length;
      return this.success(`Fichier écrit: ${filePath} (${lines} lignes)`);
    } catch (err: any) {
      return this.error(`Erreur écriture: ${err.message}`);
    }
  }
}
```
```

---

### Prompt 2.3 - Edit Tool

```
Dans src/tools/edit.ts, implémente le tool Edit:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class EditTool extends BaseTool {
  name = 'Edit';
  description = 'Édite un fichier en remplaçant une chaîne par une autre. old_string DOIT être unique dans le fichier.';

  inputSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Chemin absolu du fichier à éditer'
      },
      old_string: {
        type: 'string',
        description: 'Texte exact à remplacer (doit être unique dans le fichier)'
      },
      new_string: {
        type: 'string',
        description: 'Nouveau texte'
      },
      replace_all: {
        type: 'boolean',
        description: 'Remplacer toutes les occurrences (défaut: false)'
      }
    },
    required: ['file_path', 'old_string', 'new_string']
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['file_path', 'old_string', 'new_string']);
    if (validation) return this.error(validation);

    const filePath = input.file_path as string;
    const oldString = input.old_string as string;
    const newString = input.new_string as string;
    const replaceAll = input.replace_all as boolean || false;

    try {
      // Vérifier chemin absolu
      if (!path.isAbsolute(filePath)) {
        return this.error('Le chemin doit être absolu');
      }

      // Lire le fichier
      const content = await fs.readFile(filePath, 'utf-8');

      // Compter les occurrences
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) {
        return this.error(`old_string non trouvé dans le fichier`);
      }

      if (occurrences > 1 && !replaceAll) {
        return this.error(
          `old_string trouvé ${occurrences} fois. ` +
          `Utilisez replace_all: true ou fournissez un contexte plus unique.`
        );
      }

      // Effectuer le remplacement
      let newContent: string;
      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
      } else {
        newContent = content.replace(oldString, newString);
      }

      // Écrire le fichier
      await fs.writeFile(filePath, newContent, 'utf-8');

      const replacements = replaceAll ? occurrences : 1;
      return this.success(`Édité ${filePath}: ${replacements} remplacement(s) effectué(s)`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return this.error(`Fichier non trouvé: ${filePath}`);
      }
      return this.error(`Erreur édition: ${err.message}`);
    }
  }
}
```
```

---

### Prompt 2.4 - Bash Tool

```
Dans src/tools/bash.ts, implémente le tool Bash:

```typescript
import { spawn } from 'child_process';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class BashTool extends BaseTool {
  name = 'Bash';
  description = 'Exécute une commande bash. Le répertoire de travail persiste entre les appels.';

  private workingDirectory: string;

  inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Commande bash à exécuter'
      },
      timeout: {
        type: 'number',
        description: 'Timeout en ms (défaut: 120000, max: 600000)'
      }
    },
    required: ['command']
  };

  constructor(initialDir?: string) {
    super();
    this.workingDirectory = initialDir || process.cwd();
  }

  setWorkingDirectory(dir: string) {
    this.workingDirectory = dir;
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['command']);
    if (validation) return this.error(validation);

    const command = input.command as string;
    const timeout = Math.min((input.timeout as number) || 120000, 600000);

    // Commandes dangereuses à bloquer
    const dangerous = ['rm -rf /', 'mkfs', ':(){:|:&};:', '> /dev/sda'];
    for (const d of dangerous) {
      if (command.includes(d)) {
        return this.error(`Commande dangereuse bloquée: ${d}`);
      }
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      // Parser la commande pour détecter cd
      const cdMatch = command.match(/^cd\s+(.+)$/);
      if (cdMatch) {
        const newDir = cdMatch[1].replace(/^["']|["']$/g, '');
        const resolvedDir = path.resolve(this.workingDirectory, newDir);
        try {
          this.workingDirectory = resolvedDir;
          resolve(this.success(`Changed directory to: ${resolvedDir}`));
          return;
        } catch {
          resolve(this.error(`Cannot change to directory: ${newDir}`));
          return;
        }
      }

      const proc = spawn('bash', ['-c', command], {
        cwd: this.workingDirectory,
        env: { ...process.env },
        shell: false
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        // Limiter la sortie
        if (stdout.length > 100000) {
          stdout = stdout.slice(0, 100000) + '\n...[output truncated]';
          proc.kill('SIGTERM');
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (killed) {
          resolve(this.error(`Commande timeout après ${timeout}ms`));
          return;
        }

        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

        if (code === 0) {
          resolve(this.success(output || '(no output)'));
        } else {
          resolve(this.error(`Exit code ${code}\n${output}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve(this.error(`Erreur exécution: ${err.message}`));
      });
    });
  }
}
```
```

---

## PHASE 3: TOOLS RECHERCHE

### Prompt 3.1 - Glob Tool

```
Dans src/tools/glob.ts, implémente le tool Glob pour rechercher des fichiers:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

// Simple glob matching (ou utilise la lib 'glob' npm)
function matchGlob(pattern: string, filePath: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

export class GlobTool extends BaseTool {
  name = 'Glob';
  description = 'Recherche des fichiers par pattern glob (ex: **/*.ts, src/**/*.js)';

  inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern glob (ex: **/*.ts, src/*.js)'
      },
      path: {
        type: 'string',
        description: 'Répertoire de recherche (défaut: cwd)'
      }
    },
    required: ['pattern']
  };

  private workingDirectory: string;

  constructor(workingDir?: string) {
    super();
    this.workingDirectory = workingDir || process.cwd();
  }

  setWorkingDirectory(dir: string) {
    this.workingDirectory = dir;
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['pattern']);
    if (validation) return this.error(validation);

    const pattern = input.pattern as string;
    const searchPath = (input.path as string) || this.workingDirectory;

    try {
      const files = await this.searchFiles(searchPath, pattern);

      if (files.length === 0) {
        return this.success('Aucun fichier trouvé');
      }

      // Trier par date de modification (plus récent en premier)
      const filesWithStats = await Promise.all(
        files.map(async (f) => {
          const stat = await fs.stat(f);
          return { path: f, mtime: stat.mtime };
        })
      );

      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const result = filesWithStats.map(f => f.path).join('\n');
      return this.success(`${files.length} fichier(s) trouvé(s):\n${result}`);
    } catch (err: any) {
      return this.error(`Erreur recherche: ${err.message}`);
    }
  }

  private async searchFiles(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(this.workingDirectory, fullPath);

        // Ignorer node_modules et .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue;

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (matchGlob(pattern, relativePath)) {
          results.push(fullPath);
        }
      }
    };

    await walk(dir);
    return results;
  }
}
```
```

---

### Prompt 3.2 - Grep Tool

```
Dans src/tools/grep.ts, implémente le tool Grep pour rechercher du contenu:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export class GrepTool extends BaseTool {
  name = 'Grep';
  description = 'Recherche du contenu dans les fichiers avec regex';

  inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern regex à rechercher'
      },
      path: {
        type: 'string',
        description: 'Fichier ou répertoire à chercher'
      },
      glob: {
        type: 'string',
        description: 'Filtrer par pattern glob (ex: *.ts)'
      },
      include_context: {
        type: 'number',
        description: 'Lignes de contexte avant/après (défaut: 0)'
      },
      case_insensitive: {
        type: 'boolean',
        description: 'Recherche insensible à la casse'
      },
      max_results: {
        type: 'number',
        description: 'Nombre max de résultats (défaut: 100)'
      }
    },
    required: ['pattern']
  };

  private workingDirectory: string;

  constructor(workingDir?: string) {
    super();
    this.workingDirectory = workingDir || process.cwd();
  }

  setWorkingDirectory(dir: string) {
    this.workingDirectory = dir;
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['pattern']);
    if (validation) return this.error(validation);

    const pattern = input.pattern as string;
    const searchPath = (input.path as string) || this.workingDirectory;
    const globPattern = input.glob as string;
    const context = (input.include_context as number) || 0;
    const caseInsensitive = input.case_insensitive as boolean || false;
    const maxResults = (input.max_results as number) || 100;

    try {
      const flags = caseInsensitive ? 'gi' : 'g';
      const regex = new RegExp(pattern, flags);

      const matches: GrepMatch[] = [];
      await this.searchInPath(searchPath, regex, globPattern, matches, maxResults, context);

      if (matches.length === 0) {
        return this.success('Aucune correspondance trouvée');
      }

      const output = matches.map(m =>
        `${m.file}:${m.line}: ${m.content}`
      ).join('\n');

      return this.success(`${matches.length} correspondance(s):\n${output}`);
    } catch (err: any) {
      return this.error(`Erreur grep: ${err.message}`);
    }
  }

  private matchesGlob(filename: string, pattern?: string): boolean {
    if (!pattern) return true;

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(filename);
  }

  private async searchInPath(
    searchPath: string,
    regex: RegExp,
    globPattern: string | undefined,
    matches: GrepMatch[],
    maxResults: number,
    context: number
  ): Promise<void> {
    const stat = await fs.stat(searchPath);

    if (stat.isFile()) {
      await this.searchInFile(searchPath, regex, matches, maxResults, context);
    } else if (stat.isDirectory()) {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        if (matches.length >= maxResults) break;

        // Ignorer node_modules et .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue;

        const fullPath = path.join(searchPath, entry.name);

        if (entry.isDirectory()) {
          await this.searchInPath(fullPath, regex, globPattern, matches, maxResults, context);
        } else if (this.matchesGlob(entry.name, globPattern)) {
          await this.searchInFile(fullPath, regex, matches, maxResults, context);
        }
      }
    }
  }

  private async searchInFile(
    filePath: string,
    regex: RegExp,
    matches: GrepMatch[],
    maxResults: number,
    context: number
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
        if (regex.test(lines[i])) {
          // Ajouter contexte si demandé
          const contextLines: string[] = [];
          for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
            const prefix = j === i ? '>' : ' ';
            contextLines.push(`${prefix} ${lines[j]}`);
          }

          matches.push({
            file: filePath,
            line: i + 1,
            content: context > 0 ? contextLines.join('\n') : lines[i]
          });
        }
        // Reset regex lastIndex for global flag
        regex.lastIndex = 0;
      }
    } catch {
      // Ignorer les fichiers binaires ou illisibles
    }
  }
}
```
```

---

## PHASE 4: SYSTÈME DE PERMISSIONS

### Prompt 4.1 - Permission Manager

```
Dans src/permissions/index.ts, implémente le système de permissions:

```typescript
import { PermissionConfig, ToolInput } from '../types';

type PermissionResult = 'allow' | 'deny' | 'ask';

export class PermissionManager {
  private config: PermissionConfig;

  constructor(config?: PermissionConfig) {
    this.config = config || { allow: [], deny: [] };
  }

  updateConfig(config: PermissionConfig) {
    this.config = config;
  }

  getConfig(): PermissionConfig {
    return this.config;
  }

  /**
   * Vérifie si un tool avec des inputs spécifiques est autorisé
   * Patterns supportés:
   * - "Read" -> autorise tous les Read
   * - "Bash(git *)" -> autorise Bash avec commandes git
   * - "Edit(src/**)" -> autorise Edit dans src/
   */
  check(toolName: string, input: ToolInput): PermissionResult {
    // D'abord vérifier les deny (priorité haute)
    for (const rule of this.config.deny) {
      if (this.matchesRule(rule, toolName, input)) {
        return 'deny';
      }
    }

    // Ensuite vérifier les allow
    for (const rule of this.config.allow) {
      if (this.matchesRule(rule, toolName, input)) {
        return 'allow';
      }
    }

    // Par défaut, demander
    return 'ask';
  }

  private matchesRule(rule: string, toolName: string, input: ToolInput): boolean {
    // Pattern: ToolName ou ToolName(pattern)
    const match = rule.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match) return false;

    const [, ruleTool, rulePattern] = match;

    // Le nom du tool doit correspondre
    if (ruleTool !== toolName) return false;

    // Si pas de pattern, le tool est autorisé/refusé globalement
    if (!rulePattern) return true;

    // Vérifier le pattern selon le tool
    return this.matchesPattern(toolName, rulePattern, input);
  }

  private matchesPattern(toolName: string, pattern: string, input: ToolInput): boolean {
    switch (toolName) {
      case 'Bash':
        return this.matchesBashPattern(pattern, input.command as string);

      case 'Read':
      case 'Write':
      case 'Edit':
        return this.matchesPathPattern(pattern, input.file_path as string);

      case 'Glob':
      case 'Grep':
        return this.matchesPathPattern(pattern, input.path as string);

      default:
        return false;
    }
  }

  private matchesBashPattern(pattern: string, command: string): boolean {
    if (!command) return false;

    // Pattern avec wildcard: "git *" -> match "git status", "git commit", etc.
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex chars sauf *
      .replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(command);
  }

  private matchesPathPattern(pattern: string, filePath: string): boolean {
    if (!filePath) return false;

    // Pattern glob: "src/**" -> match "src/foo/bar.ts"
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*');

    return new RegExp(`^${regexPattern}`).test(filePath);
  }

  // Ajouter une règle allow
  allow(rule: string) {
    if (!this.config.allow.includes(rule)) {
      this.config.allow.push(rule);
    }
  }

  // Ajouter une règle deny
  deny(rule: string) {
    if (!this.config.deny.includes(rule)) {
      this.config.deny.push(rule);
    }
  }

  // Retirer une règle
  remove(rule: string) {
    this.config.allow = this.config.allow.filter(r => r !== rule);
    this.config.deny = this.config.deny.filter(r => r !== rule);
  }
}
```
```

---

## PHASE 5: INTÉGRATION LLM

### Prompt 5.1 - Client LLM

```
Dans src/core/llm.ts, implémente l'interface avec l'API Claude:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Tool, Message, ToolCall } from '../types';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
}

export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 8192;
  }

  async chat(
    messages: Message[],
    tools: Tool[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    // Convertir les tools au format Anthropic
    const anthropicTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    // Convertir les messages au format Anthropic
    const anthropicMessages = this.convertMessages(messages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt || this.getDefaultSystemPrompt(),
      tools: anthropicTools,
      messages: anthropicMessages
    });

    return this.parseResponse(response);
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // System géré séparément

      if (msg.role === 'user') {
        // Message user normal ou avec résultats de tools
        if (msg.toolResults && msg.toolResults.length > 0) {
          result.push({
            role: 'user',
            content: msg.toolResults.map(tr => ({
              type: 'tool_result' as const,
              tool_use_id: tr.toolCallId,
              content: tr.result.success
                ? tr.result.output
                : `Error: ${tr.result.error}`
            }))
          });
        } else {
          result.push({
            role: 'user',
            content: msg.content
          });
        }
      } else if (msg.role === 'assistant') {
        const content: Anthropic.ContentBlock[] = [];

        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.input
            });
          }
        }

        result.push({ role: 'assistant', content });
      }
    }

    return result;
  }

  private parseResponse(response: Anthropic.Message): LLMResponse {
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>
        });
      }
    }

    return {
      content,
      toolCalls,
      stopReason: response.stop_reason as LLMResponse['stopReason']
    };
  }

  private getDefaultSystemPrompt(): string {
    return `Tu es un assistant de programmation expert. Tu aides les développeurs avec leurs tâches de codage.

Tu as accès à plusieurs outils pour interagir avec le système de fichiers et exécuter des commandes.

Règles importantes:
- TOUJOURS lire un fichier avant de l'éditer
- Utiliser des chemins absolus pour tous les fichiers
- Ne pas deviner le contenu des fichiers, toujours les lire
- Expliquer ce que tu fais avant d'utiliser un outil
- Être concis dans tes réponses

Quand tu utilises le tool Edit:
- old_string doit être EXACTEMENT comme dans le fichier (même indentation)
- old_string doit être UNIQUE dans le fichier
- Si old_string apparaît plusieurs fois, utilise plus de contexte`;
  }

  setModel(model: string) {
    this.model = model;
  }

  setMaxTokens(tokens: number) {
    this.maxTokens = tokens;
  }
}
```
```

---

### Prompt 5.2 - Boucle Agent Principale

```
Dans src/core/agent.ts, implémente la boucle principale de l'agent:

```typescript
import { LLMClient, LLMResponse } from './llm';
import { PermissionManager } from '../permissions';
import { Tool, Message, ToolCall, ToolResult, AgentState } from '../types';
import { ReadTool } from '../tools/read';
import { WriteTool } from '../tools/write';
import { EditTool } from '../tools/edit';
import { BashTool } from '../tools/bash';
import { GlobTool } from '../tools/glob';
import { GrepTool } from '../tools/grep';

export interface AgentConfig {
  apiKey: string;
  model?: string;
  workingDirectory?: string;
  systemPrompt?: string;
  onToolCall?: (name: string, input: any) => void;
  onToolResult?: (name: string, result: ToolResult) => void;
  onMessage?: (content: string) => void;
  onAskPermission?: (tool: string, input: any) => Promise<boolean>;
}

export class Agent {
  private llm: LLMClient;
  private tools: Map<string, Tool>;
  private permissions: PermissionManager;
  private state: AgentState;
  private config: AgentConfig;
  private systemPrompt: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.llm = new LLMClient({
      apiKey: config.apiKey,
      model: config.model
    });

    this.permissions = new PermissionManager({
      allow: ['Read', 'Glob', 'Grep'], // Outils de lecture autorisés par défaut
      deny: []
    });

    this.state = {
      messages: [],
      workingDirectory: config.workingDirectory || process.cwd(),
      permissions: this.permissions.getConfig(),
      isRunning: false
    };

    this.systemPrompt = config.systemPrompt || '';
    this.tools = this.initializeTools();
  }

  private initializeTools(): Map<string, Tool> {
    const bashTool = new BashTool(this.state.workingDirectory);
    const globTool = new GlobTool(this.state.workingDirectory);
    const grepTool = new GrepTool(this.state.workingDirectory);

    const tools = new Map<string, Tool>();
    tools.set('Read', new ReadTool());
    tools.set('Write', new WriteTool());
    tools.set('Edit', new EditTool());
    tools.set('Bash', bashTool);
    tools.set('Glob', globTool);
    tools.set('Grep', grepTool);

    return tools;
  }

  async run(userMessage: string): Promise<string> {
    this.state.isRunning = true;

    // Ajouter le message utilisateur
    this.state.messages.push({
      role: 'user',
      content: userMessage
    });

    try {
      // Boucle agent
      while (this.state.isRunning) {
        // Appeler le LLM
        const response = await this.llm.chat(
          this.state.messages,
          Array.from(this.tools.values()),
          this.systemPrompt
        );

        // Si le LLM a du texte à dire
        if (response.content) {
          this.config.onMessage?.(response.content);
        }

        // Ajouter la réponse de l'assistant
        this.state.messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls
        });

        // Si pas de tool calls, on a fini
        if (response.toolCalls.length === 0 || response.stopReason === 'end_turn') {
          this.state.isRunning = false;
          return response.content;
        }

        // Exécuter les tools
        const toolResults = await this.executeToolCalls(response.toolCalls);

        // Ajouter les résultats
        this.state.messages.push({
          role: 'user',
          content: '',
          toolResults
        });
      }

      return this.state.messages[this.state.messages.length - 1]?.content || '';
    } finally {
      this.state.isRunning = false;
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<{ toolCallId: string; result: ToolResult }[]> {
    const results: { toolCallId: string; result: ToolResult }[] = [];

    for (const tc of toolCalls) {
      this.config.onToolCall?.(tc.name, tc.input);

      // Vérifier les permissions
      const permission = this.permissions.check(tc.name, tc.input);

      let result: ToolResult;

      if (permission === 'deny') {
        result = {
          success: false,
          output: '',
          error: `Permission refusée pour ${tc.name}`
        };
      } else if (permission === 'ask') {
        // Demander la permission à l'utilisateur
        const allowed = await this.config.onAskPermission?.(tc.name, tc.input);
        if (!allowed) {
          result = {
            success: false,
            output: '',
            error: `Permission refusée par l'utilisateur pour ${tc.name}`
          };
        } else {
          result = await this.executeTool(tc);
        }
      } else {
        result = await this.executeTool(tc);
      }

      this.config.onToolResult?.(tc.name, result);
      results.push({ toolCallId: tc.id, result });
    }

    return results;
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool inconnu: ${toolCall.name}`
      };
    }

    try {
      return await tool.execute(toolCall.input);
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Erreur d'exécution: ${error.message}`
      };
    }
  }

  // Méthodes utilitaires
  stop() {
    this.state.isRunning = false;
  }

  clearHistory() {
    this.state.messages = [];
  }

  getMessages(): Message[] {
    return [...this.state.messages];
  }

  setPermissions(config: { allow?: string[]; deny?: string[] }) {
    if (config.allow) {
      for (const rule of config.allow) {
        this.permissions.allow(rule);
      }
    }
    if (config.deny) {
      for (const rule of config.deny) {
        this.permissions.deny(rule);
      }
    }
  }

  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }
}
```
```

---

## PHASE 6: INTERFACE CLI

### Prompt 6.1 - Affichage Terminal

```
Dans src/cli/output.ts, implémente l'affichage formaté:

```typescript
import chalk from 'chalk';

export class Output {
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private spinnerInterval?: NodeJS.Timeout;

  // Afficher un message utilisateur
  user(message: string) {
    console.log(chalk.blue.bold('\n👤 You:'));
    console.log(chalk.white(message));
  }

  // Afficher une réponse assistant
  assistant(message: string) {
    console.log(chalk.green.bold('\n🤖 Assistant:'));
    console.log(chalk.white(message));
  }

  // Afficher un appel de tool
  toolCall(name: string, input: any) {
    console.log(chalk.yellow(`\n🔧 ${name}`));
    const inputStr = JSON.stringify(input, null, 2);
    if (inputStr.length > 200) {
      console.log(chalk.gray(inputStr.slice(0, 200) + '...'));
    } else {
      console.log(chalk.gray(inputStr));
    }
  }

  // Afficher le résultat d'un tool
  toolResult(name: string, result: { success: boolean; output: string; error?: string }) {
    if (result.success) {
      console.log(chalk.green(`✓ ${name} completed`));
      if (result.output && result.output.length > 0) {
        const lines = result.output.split('\n');
        if (lines.length > 10) {
          console.log(chalk.gray(lines.slice(0, 10).join('\n')));
          console.log(chalk.gray(`... (${lines.length - 10} more lines)`));
        } else {
          console.log(chalk.gray(result.output));
        }
      }
    } else {
      console.log(chalk.red(`✗ ${name} failed: ${result.error}`));
    }
  }

  // Afficher une erreur
  error(message: string) {
    console.log(chalk.red.bold('\n❌ Error:'));
    console.log(chalk.red(message));
  }

  // Afficher une info
  info(message: string) {
    console.log(chalk.cyan(`ℹ ${message}`));
  }

  // Afficher un warning
  warn(message: string) {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  // Démarrer le spinner
  startSpinner(message: string = 'Thinking...') {
    process.stdout.write(chalk.cyan(`${this.spinnerFrames[0]} ${message}`));
    this.spinnerInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(chalk.cyan(`${this.spinnerFrames[this.spinnerIndex]} ${message}`));
    }, 80);
  }

  // Arrêter le spinner
  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = undefined;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  // Demander permission
  askPermission(tool: string, input: any): string {
    console.log(chalk.yellow.bold(`\n⚠ Permission requise pour ${tool}:`));
    console.log(chalk.gray(JSON.stringify(input, null, 2)));
    console.log(chalk.yellow('Autoriser? (y/n/always): '));
    return '';
  }

  // Afficher le prompt
  prompt() {
    process.stdout.write(chalk.blue.bold('\n> '));
  }

  // Ligne de séparation
  separator() {
    console.log(chalk.gray('─'.repeat(50)));
  }

  // Afficher l'aide
  help() {
    console.log(chalk.cyan.bold('\nCommandes disponibles:'));
    console.log(chalk.white('  /help       - Afficher cette aide'));
    console.log(chalk.white('  /clear      - Effacer la conversation'));
    console.log(chalk.white('  /model      - Changer le modèle'));
    console.log(chalk.white('  /permissions- Voir/modifier les permissions'));
    console.log(chalk.white('  /quit       - Quitter'));
    console.log('');
  }

  // Message de bienvenue
  welcome() {
    console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║         CodeAgent CLI                ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════╝'));
    console.log(chalk.gray('Tapez /help pour voir les commandes'));
    console.log(chalk.gray('Tapez votre message pour commencer\n'));
  }
}
```
```

---

### Prompt 6.2 - Gestion Input

```
Dans src/cli/input.ts, implémente la gestion des entrées:

```typescript
import * as readline from 'readline';
import { EventEmitter } from 'events';

export class Input extends EventEmitter {
  private rl: readline.Interface;
  private history: string[] = [];
  private historyIndex = -1;

  constructor() {
    super();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Gérer Ctrl+C
    this.rl.on('SIGINT', () => {
      this.emit('interrupt');
    });
  }

  async prompt(promptStr: string = '> '): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(promptStr, (answer) => {
        if (answer.trim()) {
          this.history.push(answer);
          this.historyIndex = this.history.length;
        }
        resolve(answer);
      });
    });
  }

  async confirm(message: string): Promise<boolean> {
    const answer = await this.prompt(`${message} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  async select(message: string, options: string[]): Promise<number> {
    console.log(message);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt}`);
    });

    while (true) {
      const answer = await this.prompt('Choix: ');
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= options.length) {
        return num - 1;
      }
      console.log('Choix invalide');
    }
  }

  close() {
    this.rl.close();
  }

  pause() {
    this.rl.pause();
  }

  resume() {
    this.rl.resume();
  }
}
```
```

---

### Prompt 6.3 - Point d'Entrée CLI

```
Dans src/cli/index.ts, implémente le point d'entrée principal:

```typescript
import { Agent } from '../core/agent';
import { Output } from './output';
import { Input } from './input';
import * as fs from 'fs';
import * as path from 'path';

export class CLI {
  private agent: Agent;
  private output: Output;
  private input: Input;
  private running = true;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY non définie');
      process.exit(1);
    }

    this.output = new Output();
    this.input = new Input();

    // Charger CLAUDE.md si présent
    let systemPrompt = '';
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8');
      this.output.info('CLAUDE.md chargé');
    }

    this.agent = new Agent({
      apiKey,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      workingDirectory: process.cwd(),
      systemPrompt,
      onToolCall: (name, input) => {
        this.output.stopSpinner();
        this.output.toolCall(name, input);
        this.output.startSpinner('Executing...');
      },
      onToolResult: (name, result) => {
        this.output.stopSpinner();
        this.output.toolResult(name, result);
      },
      onMessage: (content) => {
        this.output.stopSpinner();
        if (content) {
          this.output.assistant(content);
        }
      },
      onAskPermission: async (tool, input) => {
        this.output.stopSpinner();
        this.output.askPermission(tool, input);
        return this.input.confirm('');
      }
    });

    // Gérer Ctrl+C
    this.input.on('interrupt', () => {
      this.output.stopSpinner();
      this.agent.stop();
      this.output.info('Interrupted');
    });
  }

  async run() {
    this.output.welcome();

    while (this.running) {
      this.output.prompt();
      const userInput = await this.input.prompt('');

      if (!userInput.trim()) continue;

      // Traiter les commandes slash
      if (userInput.startsWith('/')) {
        await this.handleCommand(userInput);
        continue;
      }

      // Envoyer à l'agent
      this.output.user(userInput);
      this.output.startSpinner('Thinking...');

      try {
        await this.agent.run(userInput);
      } catch (error: any) {
        this.output.stopSpinner();
        this.output.error(error.message);
      }

      this.output.separator();
    }

    this.input.close();
  }

  private async handleCommand(cmd: string) {
    const [command, ...args] = cmd.slice(1).split(' ');

    switch (command.toLowerCase()) {
      case 'help':
        this.output.help();
        break;

      case 'clear':
        this.agent.clearHistory();
        console.clear();
        this.output.info('Conversation effacée');
        break;

      case 'quit':
      case 'exit':
        this.running = false;
        this.output.info('Au revoir!');
        break;

      case 'model':
        if (args[0]) {
          this.output.info(`Modèle changé: ${args[0]}`);
        } else {
          this.output.info('Usage: /model <nom-du-modele>');
        }
        break;

      case 'permissions':
        this.output.info('Permissions actuelles:');
        console.log(JSON.stringify(this.agent['permissions'].getConfig(), null, 2));
        break;

      default:
        this.output.warn(`Commande inconnue: ${command}`);
        this.output.help();
    }
  }
}

// Point d'entrée
const cli = new CLI();
cli.run().catch(console.error);
```
```

---

## PHASE 7: CONFIGURATION ET FINALISATION

### Prompt 7.1 - Package.json et Config

```
Mets à jour package.json avec toutes les dépendances et scripts:

```json
{
  "name": "code-agent",
  "version": "1.0.0",
  "description": "Agent de codage IA en ligne de commande",
  "main": "dist/cli/index.js",
  "bin": {
    "code-agent": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/index.js",
    "dev": "ts-node src/cli/index.ts",
    "watch": "tsc -w"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Et tsconfig.json:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Ajoute aussi le shebang en haut de src/cli/index.ts:
```typescript
#!/usr/bin/env node
```
```

---

### Prompt 7.2 - Export des Tools

```
Dans src/tools/index.ts, exporte tous les tools:

```typescript
export { BaseTool } from './base';
export { ReadTool } from './read';
export { WriteTool } from './write';
export { EditTool } from './edit';
export { BashTool } from './bash';
export { GlobTool } from './glob';
export { GrepTool } from './grep';

import { Tool } from '../types';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { EditTool } from './edit';
import { BashTool } from './bash';
import { GlobTool } from './glob';
import { GrepTool } from './grep';

export function createDefaultTools(workingDirectory?: string): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  tools.set('Read', new ReadTool());
  tools.set('Write', new WriteTool());
  tools.set('Edit', new EditTool());
  tools.set('Bash', new BashTool(workingDirectory));
  tools.set('Glob', new GlobTool(workingDirectory));
  tools.set('Grep', new GrepTool(workingDirectory));

  return tools;
}
```
```

---

## PHASE 8: FONCTIONNALITÉS AVANCÉES

### Prompt 8.1 - Gestion du Contexte

```
Dans src/core/context.ts, implémente la gestion du contexte:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../types';

export interface ContextConfig {
  maxTokens: number;
  compactThreshold: number; // 0.8 = compact quand 80% plein
}

export class ContextManager {
  private config: ContextConfig;

  constructor(config?: Partial<ContextConfig>) {
    this.config = {
      maxTokens: 100000,
      compactThreshold: 0.8,
      ...config
    };
  }

  /**
   * Charge le fichier CLAUDE.md et ses imports
   */
  loadProjectContext(projectDir: string): string {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

    if (!fs.existsSync(claudeMdPath)) {
      return '';
    }

    let content = fs.readFileSync(claudeMdPath, 'utf-8');

    // Traiter les imports @path/to/file.md
    const importRegex = /@([^\s]+\.md)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = path.join(projectDir, match[1]);
      if (fs.existsSync(importPath)) {
        const importContent = fs.readFileSync(importPath, 'utf-8');
        content = content.replace(match[0], importContent);
      }
    }

    return content;
  }

  /**
   * Estime le nombre de tokens dans les messages
   */
  estimateTokens(messages: Message[]): number {
    // Estimation simple: ~4 caractères par token
    let totalChars = 0;

    for (const msg of messages) {
      totalChars += msg.content.length;
      if (msg.toolCalls) {
        totalChars += JSON.stringify(msg.toolCalls).length;
      }
      if (msg.toolResults) {
        totalChars += JSON.stringify(msg.toolResults).length;
      }
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * Vérifie si on doit compacter
   */
  shouldCompact(messages: Message[]): boolean {
    const tokens = this.estimateTokens(messages);
    return tokens > this.config.maxTokens * this.config.compactThreshold;
  }

  /**
   * Compacte les messages en résumant les anciens
   */
  async compact(messages: Message[], summarize: (text: string) => Promise<string>): Promise<Message[]> {
    if (messages.length < 4) {
      return messages;
    }

    // Garder les 2 derniers échanges intacts
    const keepCount = 4;
    const toSummarize = messages.slice(0, -keepCount);
    const toKeep = messages.slice(-keepCount);

    // Créer un résumé des anciens messages
    const summaryText = toSummarize.map(m => {
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return '';
    }).filter(Boolean).join('\n\n');

    const summary = await summarize(summaryText);

    // Retourner les messages compactés
    return [
      {
        role: 'system' as const,
        content: `[Résumé de la conversation précédente]\n${summary}`
      },
      ...toKeep
    ];
  }
}
```
```

---

### Prompt 8.2 - Tool WebSearch

```
Dans src/tools/websearch.ts, implémente la recherche web:

```typescript
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class WebSearchTool extends BaseTool {
  name = 'WebSearch';
  description = 'Recherche sur le web pour obtenir des informations actuelles';

  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Requête de recherche'
      },
      max_results: {
        type: 'number',
        description: 'Nombre max de résultats (défaut: 5)'
      }
    },
    required: ['query']
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['query']);
    if (validation) return this.error(validation);

    const query = input.query as string;
    const maxResults = (input.max_results as number) || 5;

    try {
      // Utiliser DuckDuckGo Instant Answer API (gratuit, pas de clé)
      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;

      const response = await fetch(url);
      const data = await response.json();

      const results: string[] = [];

      // Abstract (résumé principal)
      if (data.Abstract) {
        results.push(`📄 ${data.AbstractText}\nSource: ${data.AbstractURL}`);
      }

      // Related Topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.Text) {
            results.push(`• ${topic.Text}`);
          }
        }
      }

      if (results.length === 0) {
        return this.success('Aucun résultat trouvé pour cette recherche');
      }

      return this.success(results.join('\n\n'));
    } catch (err: any) {
      return this.error(`Erreur recherche: ${err.message}`);
    }
  }
}
```
```

---

### Prompt 8.3 - Tool WebFetch

```
Dans src/tools/webfetch.ts, implémente la récupération de pages web:

```typescript
import { BaseTool } from './base';
import { ToolInput, ToolResult } from '../types';

export class WebFetchTool extends BaseTool {
  name = 'WebFetch';
  description = 'Récupère le contenu d\'une page web et le convertit en texte';

  inputSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL de la page à récupérer'
      },
      selector: {
        type: 'string',
        description: 'Sélecteur CSS optionnel pour extraire une partie'
      }
    },
    required: ['url']
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const validation = this.validateInput(input, ['url']);
    if (validation) return this.error(validation);

    let url = input.url as string;

    // S'assurer que l'URL est HTTPS
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (!url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CodeAgent/1.0)'
        }
      });

      if (!response.ok) {
        return this.error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const json = await response.json();
        return this.success(JSON.stringify(json, null, 2));
      }

      const html = await response.text();

      // Conversion HTML -> texte simple
      const text = this.htmlToText(html);

      // Limiter la taille
      if (text.length > 50000) {
        return this.success(text.slice(0, 50000) + '\n\n[...contenu tronqué]');
      }

      return this.success(text);
    } catch (err: any) {
      return this.error(`Erreur fetch: ${err.message}`);
    }
  }

  private htmlToText(html: string): string {
    // Supprimer scripts et styles
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Convertir les éléments courants
    text = text
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }
}
```
```

---

### Prompt 8.4 - Intégration Finale

```
Mets à jour src/tools/index.ts pour inclure les nouveaux tools:

```typescript
export { BaseTool } from './base';
export { ReadTool } from './read';
export { WriteTool } from './write';
export { EditTool } from './edit';
export { BashTool } from './bash';
export { GlobTool } from './glob';
export { GrepTool } from './grep';
export { WebSearchTool } from './websearch';
export { WebFetchTool } from './webfetch';

import { Tool } from '../types';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { EditTool } from './edit';
import { BashTool } from './bash';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { WebSearchTool } from './websearch';
import { WebFetchTool } from './webfetch';

export function createDefaultTools(workingDirectory?: string): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  tools.set('Read', new ReadTool());
  tools.set('Write', new WriteTool());
  tools.set('Edit', new EditTool());
  tools.set('Bash', new BashTool(workingDirectory));
  tools.set('Glob', new GlobTool(workingDirectory));
  tools.set('Grep', new GrepTool(workingDirectory));
  tools.set('WebSearch', new WebSearchTool());
  tools.set('WebFetch', new WebFetchTool());

  return tools;
}
```

Et mets à jour src/core/agent.ts pour utiliser les nouveaux tools dans initializeTools().
```

---

## PHASE 9: TESTS ET POLISH

### Prompt 9.1 - README

```
Crée un README.md pour le projet:

```markdown
# CodeAgent

Agent de codage IA en ligne de commande, inspiré de Claude Code.

## Installation

```bash
npm install
npm run build
npm link  # Pour utiliser globalement
```

## Configuration

Définir la variable d'environnement:

```bash
export ANTHROPIC_API_KEY="votre-clé-api"
```

Optionnel:
```bash
export CLAUDE_MODEL="claude-sonnet-4-20250514"  # Modèle par défaut
```

## Utilisation

```bash
# Lancer l'agent
code-agent

# Ou en développement
npm run dev
```

## Commandes

- `/help` - Afficher l'aide
- `/clear` - Effacer la conversation
- `/model <nom>` - Changer le modèle
- `/permissions` - Voir les permissions
- `/quit` - Quitter

## Fichier CLAUDE.md

Créez un fichier `CLAUDE.md` à la racine de votre projet pour définir des instructions personnalisées:

```markdown
# Instructions Projet

Ce projet utilise TypeScript avec React.

## Conventions
- Composants fonctionnels uniquement
- Tests avec Jest

## Structure
@docs/architecture.md
```

## Permissions

Par défaut:
- **Autorisés**: Read, Glob, Grep (lecture seule)
- **Demandés**: Write, Edit, Bash (modifications)

## Architecture

```
src/
├── core/           # Logique agent et LLM
├── tools/          # Outils disponibles
├── permissions/    # Système de permissions
├── cli/            # Interface terminal
└── types/          # Types TypeScript
```

## License

MIT
```
```

---

### Prompt 9.2 - Vérification Finale

```
Vérifie que tous les fichiers sont en place et que le projet compile:

1. Exécute `npm install`
2. Exécute `npm run build`
3. Corrige les erreurs TypeScript s'il y en a
4. Teste avec `npm run dev` et envoie un message simple

Liste tous les fichiers créés et confirme que tout fonctionne.
```

---

## RÉSUMÉ DES PHASES

| Phase | Prompts | Description |
|-------|---------|-------------|
| 1 | 1.1-1.3 | Structure, types, base tool |
| 2 | 2.1-2.4 | Tools fichiers (Read, Write, Edit, Bash) |
| 3 | 3.1-3.2 | Tools recherche (Glob, Grep) |
| 4 | 4.1 | Système permissions |
| 5 | 5.1-5.2 | LLM client et boucle agent |
| 6 | 6.1-6.3 | Interface CLI complète |
| 7 | 7.1-7.2 | Config et exports |
| 8 | 8.1-8.4 | Fonctionnalités avancées (context, web) |
| 9 | 9.1-9.2 | Documentation et tests |

**Total: 18 prompts à donner séquentiellement à Bolt**

---

## Notes Importantes pour Bolt

1. **Attendre** que chaque prompt soit terminé avant de passer au suivant
2. **Tester** après chaque phase (npm run build)
3. **Ne pas modifier** les interfaces sans raison
4. Si erreur, **corriger** avant de continuer
5. Les **chemins doivent être absolus** dans tous les tools
