# Configuration MCP pour Claude Desktop / Claude Code

Ce guide explique comment intégrer NEMESIS avec Claude via le Model Context Protocol (MCP).

## Qu'est-ce que MCP ?

Le Model Context Protocol permet à Claude d'appeler des outils externes directement.
Avec l'intégration NEMESIS, tu peux dire à Claude :
- "Analyse cette architecture avec NEMESIS"
- "Lance une analyse multi-IA sur ce code"
- Et Claude exécutera automatiquement l'orchestration !

---

## Installation

### 1. Localiser le fichier de configuration Claude

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/claude/claude_desktop_config.json
```

### 2. Ajouter la configuration NEMESIS

Ouvre (ou crée) le fichier `claude_desktop_config.json` et ajoute :

```json
{
  "mcpServers": {
    "nemesis": {
      "command": "python3",
      "args": [
        "/chemin/vers/claude-code/ai-orchestrator/nemesis_mcp_server.py"
      ],
      "env": {
        "NEMESIS_CONFIG": "~/.config/nemesis/config.yaml"
      }
    }
  }
}
```

**Remplace `/chemin/vers/` par ton chemin réel !**

Exemples :
- **macOS/Linux:** `/home/ton_user/claude-code/ai-orchestrator/nemesis_mcp_server.py`
- **Windows:** `C:\\Users\\ton_user\\claude-code\\ai-orchestrator\\nemesis_mcp_server.py`

### 3. Redémarrer Claude Desktop

Ferme complètement Claude Desktop et relance-le.

---

## Utilisation

Une fois configuré, tu peux utiliser ces commandes dans Claude :

### Analyse Multi-IA
```
Utilise NEMESIS pour analyser cette architecture microservices
```

```
Lance une analyse multi-IA approfondie (3 rounds) sur ce code Python
```

### Historique
```
Montre-moi l'historique des analyses NEMESIS
```

### Vérification
```
Vérifie ce code avec NEMESIS pour les problèmes de sécurité
```

### Statistiques
```
Quelles sont les statistiques d'utilisation de NEMESIS ?
```

---

## Outils Disponibles

| Outil | Description |
|-------|-------------|
| `analyze_with_multi_ai` | Analyse un sujet avec 7+ modèles IA |
| `get_analysis_history` | Historique des analyses |
| `get_analysis_result` | Récupérer un rapport spécifique |
| `verify_content` | Vérifier du code/contenu |
| `get_nemesis_stats` | Statistiques système |

---

## Paramètres d'Analyse

| Paramètre | Description | Valeurs |
|-----------|-------------|---------|
| `topic` | Le sujet à analyser | Texte libre |
| `rounds` | Nombre de rounds | 1-5 (défaut: 1) |
| `mode` | Mode d'exécution | auto, semi-auto, manual |
| `focus` | Focus de l'analyse | general, critique, technical, creative, security |

---

## Dépannage

### Claude ne voit pas NEMESIS

1. Vérifie que le chemin dans la config est correct
2. Vérifie que Python 3 est installé et dans le PATH
3. Teste manuellement :
   ```bash
   python3 /chemin/vers/nemesis_mcp_server.py
   ```

### Erreur "Module not found"

Installe les dépendances :
```bash
pip install flask flask-cors pyyaml requests
```

### Logs de debug

Les logs MCP sont dans :
```
~/.local/share/nemesis/logs/mcp_server.log
```

---

## Configuration Claude Code (CLI)

Pour Claude Code (version CLI), ajoute à ton fichier de projet `.claude/settings.json` :

```json
{
  "mcpServers": {
    "nemesis": {
      "command": "python3",
      "args": ["./ai-orchestrator/nemesis_mcp_server.py"]
    }
  }
}
```

---

## Exemple Complet

### Configuration complète avec plusieurs serveurs MCP

```json
{
  "mcpServers": {
    "nemesis": {
      "command": "python3",
      "args": ["/home/user/claude-code/ai-orchestrator/nemesis_mcp_server.py"],
      "env": {
        "NEMESIS_CONFIG": "/home/user/.config/nemesis/config.yaml",
        "NEMESIS_RESULTS": "/home/user/nemesis_results"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/home/user/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

---

## Support

- **Issues:** https://github.com/N3M3S1SK41R0S/claude-code/issues
- **Docs:** Voir `architecture.md` pour plus de détails
