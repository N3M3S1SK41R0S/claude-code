# AI Orchestrator 🤖

> Système d'orchestration multi-IA autonome pour le raffinement collaboratif de requêtes.

## 🚀 Démarrage Rapide

### Double-Clic pour Lancer

1. **Linux**: Double-cliquez sur `launch.sh` ou exécutez `./create_shortcut.sh` pour créer un raccourci bureau
2. **macOS**: Double-cliquez sur `launch.command`
3. **Windows**: Double-cliquez sur `launch.bat`

## 📋 Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CLARIFICATION (Claude Sonnet 4.5)                           │
│     └─> Dialogue interactif pour enrichir la demande            │
│                                                                  │
│  2. RECHERCHE PARALLÈLE (Multi-IA)                              │
│     └─> GPT-4, Gemini, Mistral, Claude variants...              │
│     └─> Sélection automatique selon le domaine                  │
│                                                                  │
│  3. SYNTHÈSE (3 rounds)                                         │
│     └─> Claude Sonnet + Opus                                    │
│     └─> Tables comparatives                                     │
│     └─> Saturation conceptuelle                                 │
│                                                                  │
│  4. FORMATAGE                                                   │
│     └─> Instructions adaptées à chaque outil                    │
│     └─> Respect des limites de tokens                           │
│                                                                  │
│  5. EXÉCUTION & VÉRIFICATION                                    │
│     └─> Feedback automatique                                    │
│     └─> Tests et archivage                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Fonctionnalités

### Routage Intelligent
- **Code** → Codestral, Claude Code, Cursor
- **Architecture** → Claude Opus, GPT-4
- **Créativité** → GPT-4, Gemini
- **Finance/Conformité** → Claude Opus
- **UI/UX** → GPT-4, Gemini

### Automatisation Maximale
- Intervention utilisateur uniquement au début (clarification) et à la fin (validation)
- Sollicitation uniquement si blocage critique
- Simulation des réponses si une IA est indisponible

### Résilience
- File d'attente intelligente pour temps de réponse variables
- Timeout configurables
- Continuation sans interruption

## 📁 Structure du Projet

```
ai-orchestrator/
├── orchestrator.py      # Script principal
├── config.yaml          # Configuration
├── launch.sh            # Lanceur Linux/macOS
├── launch.bat           # Lanceur Windows
├── launch.command       # Lanceur macOS (Finder)
├── requirements.txt     # Dépendances Python
├── create_shortcut.sh   # Créer raccourci bureau
│
├── workers/             # Modules API pour chaque IA
│   ├── base.py
│   ├── claude_worker.py
│   ├── openai_worker.py
│   ├── gemini_worker.py
│   └── mistral_worker.py
│
├── browser/             # Automatisation Chrome
│   ├── controller.py
│   └── clipboard.py
│
├── synthesis/           # Moteur de synthèse
│   ├── engine.py
│   └── saturation.py
│
└── utils/               # Utilitaires
    ├── router.py        # Routage intelligent
    ├── credentials.py   # Gestion des clés API
    └── semantic_compressor.py  # Compression de contexte
```

## ⚙️ Configuration

### Configuration des API (Optionnel)

Pour utiliser les API directement (au lieu des interfaces web), définissez les variables d'environnement:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
export MISTRAL_API_KEY="..."
```

Ou utilisez le gestionnaire de credentials intégré:
```bash
python -c "from utils.credentials import CredentialManager; CredentialManager().interactive_setup()"
```

### Personnalisation (config.yaml)

```yaml
# Nombre d'onglets parallèles
browser:
  parallel_tabs: 8

# Rounds de synthèse
workflow:
  synthesis:
    rounds: 3

# Services IA activés
ai_services:
  claude_sonnet:
    enabled: true
  chatgpt:
    enabled: true
```

## 🔒 Sécurité

- Les clés API sont stockées localement avec obfuscation
- Aucune donnée envoyée à des serveurs tiers (hors APIs des IA)
- Permissions restrictives sur le fichier de credentials

## 💡 Cas d'Usage

### Exemple: Création d'une App Mobile CGP

1. **Vous**: "Je veux une app mobile pour calculer l'optimisation fiscale IFI"
2. **Claude Sonnet**: Clarification (profils clients, contraintes AMF, features)
3. **Multi-IA**: GPT-4 (UX), Gemini (architecture), Mistral (backend), Claude Opus (conformité)
4. **Synthèse**: Consolidation, détection de conflits, saturation
5. **Output**: Instructions pour Antigravity + Claude Code + documentation
6. **Feedback**: Vérification cohérence, tests, archivage

## 🛠️ Dépannage

### L'orchestrateur ne se lance pas
- Vérifiez que Python 3.8+ est installé: `python3 --version`
- Sur Linux, assurez-vous que le script est exécutable: `chmod +x launch.sh`

### Les onglets ne s'ouvrent pas
- Vérifiez que Chrome est installé et est le navigateur par défaut
- Ou modifiez `config.yaml` pour spécifier le chemin de Chrome

### Erreur de clipboard
- Linux: Installez `xclip`: `sudo apt install xclip`
- macOS: Le clipboard natif devrait fonctionner

## 📄 License

MIT License - Utilisation libre

---

**Développé avec Claude Code** 🤖
