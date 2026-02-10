# NEMESIS + BOLT - Instructions Projet

## Vue d'ensemble

Ce depot integre **Claude Code** (outil CLI agentique d'Anthropic) avec **NEMESIS** (Neural Expert Multi-agent Efficient System), un orchestrateur multi-IA.

## Structure

```
.
├── ai-orchestrator/       # Systeme NEMESIS (Python)
│   ├── nemesis.py         # CLI principal
│   ├── nemesis_mcp_server.py  # Serveur MCP pour Claude
│   ├── nemesis_omega.py   # Version avancee multi-IA
│   ├── config.yaml        # Configuration complete
│   ├── core/              # Modules coeur (router, gateway, verifier, tracer)
│   ├── memory/            # LTM + Cache multi-niveaux
│   ├── workers/           # Workers IA (Claude, OpenAI, Gemini, Mistral)
│   ├── synthesis/         # Moteur de synthese
│   └── automation/        # Builders (n8n, Zapier, Make)
├── .claude/               # Config Claude Code
│   ├── commands/          # Commandes slash personnalisees
│   └── settings.json      # Permissions et hooks
├── .mcp.json              # Configuration serveur MCP NEMESIS
├── BOLT_INTEGRATION_GUIDE.md  # Guide complet d'integration Bolt
└── BOLT_PROMPTS_SEQUENCE.md   # Sequence de prompts pour Bolt
```

## Commandes NEMESIS

Depuis le dossier `ai-orchestrator/`:

```bash
python3 nemesis.py demo                          # Demo complete
python3 nemesis.py run "ta tache"                # Executer une tache
python3 nemesis.py route "ta question"           # Recommandation de modele
python3 nemesis.py verify "contenu" --type code  # Verifier du code
python3 nemesis.py memory stats                  # Stats memoire
python3 nemesis.py cache stats                   # Stats cache
python3 nemesis.py config show                   # Voir la config
```

## MCP NEMESIS

Le serveur MCP (`nemesis_mcp_server.py`) expose ces outils a Claude:
- `analyze_with_multi_ai` - Analyse multi-IA d'un sujet
- `verify_content` - Verification securite/qualite de code
- `get_analysis_history` - Historique des analyses
- `get_nemesis_stats` - Statistiques systeme

## Conventions

- Python 3.10+ pour NEMESIS
- Dependance minimale requise: `pyyaml`, `cryptography`
- Les cles API vont dans `ai-orchestrator/.env` (jamais committer)
- Lancer les tests: `cd ai-orchestrator && python3 -m pytest tests/`

## Agents NEMESIS (10 specialises)

| Agent | Role | Modele |
|-------|------|--------|
| Zeus | Coordinateur central | claude-sonnet-4 |
| Scribe | Documentation | gpt-4o-mini |
| Analyst | Analyse de donnees | claude-sonnet-4 |
| Architect | Design systeme | claude-opus-4 |
| Coder | Code et debug | claude-sonnet-4 |
| Strategist | Planification | gpt-4-turbo |
| Critic | Controle qualite | claude-haiku |
| Memory Keeper | Memoire long-terme | claude-haiku |
| Sentinel | Securite | claude-sonnet-4 |
| Optimizer | Performance et couts | gpt-4o-mini |
