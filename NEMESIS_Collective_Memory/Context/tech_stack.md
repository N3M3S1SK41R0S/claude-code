---
title: "Stack Technique NEMESIS"
date: 2025-01-23
category: Context
tags: [technical, stack, tools, environment]
version: 1.0
---

# Stack Technique NEMESIS

## 💻 Hardware

### Setup principal
**AORUS 16X** - Workstation portable haute performance

**Spécifications**:
- **CPU**: Intel Core i9 (14th gen)
- **RAM**: 64 Go DDR5
- **GPU**: NVIDIA RTX 4070 (8GB VRAM)
- **Stockage interne**: SSD NVMe 2 To
- **Stockage externe**: SSD 2 To
- **Connectivité**: Thunderbolt 4, WiFi 6E, Bluetooth 5.3
- **Écran**: 16" QHD+ 165Hz

**Périphériques**:
- Dock Thunderbolt 4 (multi-écrans, USB-C charging, networking)
- SSD externe 2To (backup, archives, projets volumineux)

### Mobile
**iPhone 16 Pro Max**
- Utilisé pour: Tests mobile, consultations rapides, IA on-the-go
- Apps: ChatGPT, Claude mobile, Perplexity, Notion

## 🤖 Plateformes IA

### Production (Utilisation quotidienne)

#### Claude.ai (Anthropic)
- **Version**: Claude Sonnet 4.5 / Opus (selon besoin)
- **Plan**: Max (Pro+)
- **Features activées**:
  - ✅ Artifacts
  - ✅ AI-powered artifacts
  - ✅ Code execution & file creation
  - ✅ Network access autorisé
  - ✅ Memory features
  - ✅ Extended Thinking mode
- **Use cases**: Development, architecture, complex problem solving
- **Custom instructions**: Configurées pour proactivité maximale

#### ChatGPT (OpenAI)
- **Version**: GPT-5.2 Pro (avec Extended Reflection)
- **Plan**: Pro
- **Features activées**:
  - ✅ Code Interpreter
  - ✅ Web browsing
  - ✅ DALL-E 3 image generation
  - ✅ Advanced Data Analysis
  - ✅ Custom GPTs
  - ✅ Memory enabled
- **Use cases**: Polyvalence, Custom GPTs spécialisés, quick tasks
- **Custom instructions**: Configurées pour zéro-itération

#### Mistral Le Chat (Mistral AI)
- **Version**: Mistral Large 2
- **Plan**: Pro
- **Features activées**:
  - ✅ Intelligence Beta
  - ✅ Souvenirs (mémoire collective)
  - ✅ Agents
  - ✅ Réflexion mode
  - ✅ Outils activés
- **Use cases**: European AI, privacy-focused, specialized reasoning
- **Mémoire**: Contexte NEMESIS ajouté dans Souvenirs

#### Google Gemini / AI Studio
- **Versions**:
  - Gemini 3 Pro Preview (AI Studio)
  - Gemini Ultra (Consumer)
- **Plan**: Google One AI Premium
- **Features**:
  - ✅ Multimodal (texte, image, audio, vidéo)
  - ✅ Long context (2M tokens)
  - ✅ Search grounding
  - ✅ Google Workspace integration
  - ✅ AI Studio system instructions
- **Use cases**: Multimodal tasks, long documents, Google ecosystem integration

#### DeepSeek
- **Version**: DeepSeek-V3
- **Features**:
  - ✅ DeepThink mode (raisonnement profond)
  - ✅ Search integration
  - ✅ Code generation avancé
- **Use cases**: Algorithmes complexes, math, recherche scientifique

#### Perplexity AI
- **Plan**: Pro
- **Features**:
  - ✅ Search-augmented responses
  - ✅ Citations sources
  - ✅ Multi-source synthesis
  - ✅ Real-time web data
- **Use cases**: Recherche, informations actuelles, fact-checking

### Développement et Testing
- **Anthropic API**: Pour intégrations programmatiques Claude
- **OpenAI API**: Pour Custom GPTs et automations
- **Google AI Studio**: Pour prototypage rapide Gemini

## 🔧 Outils et Frameworks

### Automation & Orchestration

#### N8N (no-code automation)
- **Version**: Self-hosted / Cloud
- **Use cases**:
  - Workflows multi-IA orchestrés
  - Intégrations API entre plateformes
  - Automatisations déclenchées par événements
  - Data pipelines
- **Intégrations**: Claude, ChatGPT, Mistral, Gemini, webhooks, Google Workspace

#### MCP (Model Context Protocol)
- **Use cases**:
  - Connexion Claude avec outils externes
  - Accès filesystem local
  - Intégrations databases
  - APIs custom
- **Status**: En expérimentation

### Development

#### Docker
- **Use cases**:
  - Environnements isolés pour tests
  - Déploiement reproductible
  - Containers pour services
- **Images courantes**: Python, Node.js, PostgreSQL, Redis

#### Git & GitHub
- **Use cases**:
  - Version control code
  - Collaboration projets
  - Documentation versionnée
  - CI/CD pipelines
- **Repos**: Privés pour projets clients, publics pour open source

#### VSCode
- **Extensions**:
  - GitHub Copilot
  - Python, JavaScript/TypeScript
  - Docker, Kubernetes
  - Markdown All in One
  - GitLens
- **Use cases**: IDE principal pour développement

### Productivity & Documentation

#### Notion
- **Use cases**:
  - Documentation projets
  - Base de connaissances
  - Planning et roadmaps
  - Notes et recherches
- **Workspaces**: Personnel, KAIROS, NEMESIS

#### Markdown
- **Format standard**: Toute documentation NEMESIS
- **Outils**: Obsidian, Typora, VSCode
- **Avantages**: Portable, versionnable, lisible, convertible

#### Google Workspace
- **Use cases**:
  - Docs: Documentation collaborative
  - Sheets: Analyses, tracking
  - Drive: Stockage centralisé
  - Calendar: Planning
- **Intégration**: Gemini native, N8N workflows

### Cloud & Storage

#### Google Cloud Platform
- **Services utilisés**:
  - Cloud Storage: Backups, archives
  - Vertex AI: Expérimentations IA
  - BigQuery: Analyses de données
- **Use cases**: Storage long-terme, ML experiments

#### Google Drive
- **Use cases**:
  - Partage documents
  - Synchronisation multi-devices
  - Collaboration
- **Structure**: Organisée par projets et clients

## 🌐 Networking & APIs

### APIs utilisées

#### AI Platforms
- Anthropic Claude API
- OpenAI GPT API
- Mistral AI API
- Google Gemini API
- Perplexity API (si disponible)

#### Productivity
- Google Workspace APIs (Drive, Docs, Sheets, Calendar)
- Notion API
- GitHub API

#### Finance (professionnel CGP)
- APIs données financières (À documenter)
- APIs outils KAIROS (À documenter)

### Webhooks
- N8N webhook endpoints
- Custom notifications
- Event-driven automations

## 📱 Applications mobiles

### IA & Productivity
- ChatGPT (OpenAI)
- Claude (Anthropic)
- Perplexity
- Notion
- Google Drive / Docs / Sheets

### Développement
- Working Copy (Git client iOS)
- Textastic (code editor)
- SSH clients

## 🔐 Sécurité & Privacy

### Stockage sensible
- 1Password: Gestion mots de passe et secrets
- Encrypted drives: Pour données confidentielles clients
- Google Cloud Storage: Avec encryption at rest

### Backup strategy
- **Local**: SSD externe 2To (backup quotidien)
- **Cloud**: Google Drive (sync temps réel)
- **Archive**: Google Cloud Storage (long-terme)
- **Frequency**: Daily automated + weekly manual verification

### Compliance
- RGPD-aware pour tous projets clients
- Données clients CGP: Strictement confidentielles
- API keys: Jamais en plain text, toujours via env vars ou secrets management

## 📊 Monitoring & Analytics

### Performance tracking
- N8N execution logs
- API usage dashboards
- Cost tracking (AI API calls)

### Quality metrics
- Task completion time
- Iteration count per task
- User satisfaction ratings (subjective)
- Code quality metrics (si applicable)

## 🔄 Évolution du stack

### En expérimentation
- MCP integrations avancées
- Langchain / LangGraph pour orchestration
- Vector databases (Pinecone, Weaviate)
- Fine-tuning models custom

### À venir
- Kubernetes pour orchestration containers
- Airflow pour data pipelines complexes
- Custom IA agents framework
- Multi-modal processing pipelines

---

**Dernière mise à jour**: 2025-01-23
**Maintenu par**: Pierre TAGNARD
**Révision**: Mensuelle ou à chaque ajout majeur
