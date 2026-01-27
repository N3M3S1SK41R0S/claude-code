# 🚀 NEMESIS DASHBOARD - Instructions d'Installation pour Claude

## 🎯 MISSION PRINCIPALE

Tu es chargé de créer et déployer le **NEMESIS Dashboard** - une interface web unifiée pour orchestrer tous les agents IA du système NEMESIS.

---

## 📚 SOURCES D'INFORMATION

### 1. Repository GitHub
```
https://github.com/N3M3S1SK41R0S/claude-code
Branche: claude/double-click-claude-script-d14iX
Dossier principal: ai-orchestrator/
```

### 2. Fichiers Clés à Lire
```
ai-orchestrator/
├── architecture.md          # Diagrammes et architecture complète
├── config.yaml              # Configuration YAML
├── nemesis.py               # CLI entry point
├── nemesis_server.py        # API REST (port 8765)
├── nemesis_mcp_server.py    # Intégration MCP
├── core/
│   ├── gateway.py           # Tool Gateway
│   ├── verifier.py          # Critic Layer
│   ├── router.py            # Smart Router
│   └── tracer.py            # Request Tracking
├── memory/
│   ├── ltm.py               # Long-Term Memory
│   └── cache.py             # Multi-level Cache
└── workers/
    └── base.py              # Circuit Breaker, patterns
```

### 3. Sessions Claude Code Précédentes
- Cherche dans l'historique: "Plan infrastructure setup"
- Cherche: "NEMESIS architecture"
- Cherche: "ai-orchestrator"

### 4. Accès Cloud
- Google Drive: Accès complet
- OneDrive: Accès complet
- Historique conversations: Accessible

---

## 🏗️ ARCHITECTURE DU DASHBOARD

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEMESIS DASHBOARD                            │
│                   http://localhost:3000                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    HEADER / NAV                          │    │
│  │  🏠 Home  │  ⚡ Analyze  │  📜 History  │  ⚙️ Settings  │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │   STATUS PANEL       │  │      MAIN CONTENT            │    │
│  │                      │  │                              │    │
│  │  🟢 API Server       │  │  [Contenu dynamique selon    │    │
│  │  🟢 MCP Server       │  │   la page sélectionnée]      │    │
│  │  🟡 7 Agents Active  │  │                              │    │
│  │  📊 12 analyses/jour │  │                              │    │
│  │                      │  │                              │    │
│  │  AGENTS:             │  │                              │    │
│  │  ├─ ZEUS      🟢     │  │                              │    │
│  │  ├─ SCRIBE    🟢     │  │                              │    │
│  │  ├─ ANALYST   🟢     │  │                              │    │
│  │  ├─ ARCHITECT 🟢     │  │                              │    │
│  │  ├─ CODER     🟢     │  │                              │    │
│  │  ├─ CRITIC    🟢     │  │                              │    │
│  │  └─ SENTINEL  🟢     │  │                              │    │
│  │                      │  │                              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                    QUICK ACTIONS BAR                             │
│  [🚀 New Analysis] [📋 From Clipboard] [📁 Upload] [🔄 Refresh] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 PAGES À CRÉER

### Page 1: Home / Dashboard (`/`)
```jsx
// Affiche:
- Statistiques globales (analyses, succès, coûts)
- Graphique d'activité récente
- Agents actifs avec leur statut
- Dernières analyses (3-5)
- Alertes/notifications
```

### Page 2: Nouvelle Analyse (`/analyze`)
```jsx
// Formulaire:
- Textarea pour le contenu (ou upload fichier)
- Sélection du mode: auto / semi-auto / manuel
- Nombre de rounds: 1-5
- Agents à utiliser (checkboxes)
- Focus: général / critique / technique / créatif / sécurité
- Bouton "Lancer l'analyse" → POST /api/analyze
- Progress bar temps réel via WebSocket
```

### Page 3: Historique (`/history`)
```jsx
// Liste paginée:
- Date/heure
- Aperçu du sujet (50 chars)
- Statut (✅ ❌ ⏳)
- Durée
- Coût estimé
- Actions: Voir, Relancer, Supprimer
- Filtres: date, statut, agents
```

### Page 4: Détail Analyse (`/analysis/:id`)
```jsx
// Affiche:
- Requête originale
- Réponses de chaque agent (tabs ou accordéon)
- Synthèse finale
- Métriques (tokens, coût, durée)
- Export: MD, PDF, JSON
```

### Page 5: Agents (`/agents`)
```jsx
// Pour chaque agent:
- Nom, rôle, modèle utilisé
- Statut (actif/inactif)
- Statistiques d'utilisation
- Configuration (éditable)
- Logs récents
```

### Page 6: Memory (`/memory`)
```jsx
// Affiche:
- Stats LTM (entrées, taille)
- Stats Cache (L1/L2/L3 hit rates)
- Recherche dans la mémoire
- Actions: Consolider, Nettoyer, Export
```

### Page 7: Settings (`/settings`)
```jsx
// Configuration:
- Clés API (masquées)
- Budget journalier
- Agents par défaut
- Mode headless
- Thème (dark/light)
- Langue
```

---

## 🔌 API ENDPOINTS (Backend existant sur :8765)

```javascript
// Base URL: http://localhost:8765

// Health check
GET /health
Response: { status: "ok", version: "2.0.0", running_jobs: 0 }

// Lancer une analyse
POST /analyze
Body: { text: "...", mode: "auto", rounds: 1 }
Response: { status: "accepted", request_id: "abc123" }

// Statut d'une analyse
GET /status/:request_id
Response: { status: "running|completed|failed", result: {...} }

// Résultats
GET /results/:request_id
Response: Markdown du rapport

// Historique
GET /history?limit=50
Response: { runs: [...], total: 123 }

// Vérification
POST /verify
Body: { content: "...", type: "code" }
Response: { passed: true, score: 0.95, issues: [] }

// Statistiques
GET /stats
Response: { total_runs: 150, success_rate: 0.92, ... }
```

---

## 🛠️ STACK TECHNIQUE RECOMMANDÉE

### Frontend (BOLT)
```
Framework: Next.js 14+ ou React + Vite
UI: Tailwind CSS + shadcn/ui
State: Zustand ou React Query
Charts: Recharts ou Chart.js
Icons: Lucide React
WebSocket: socket.io-client (pour updates temps réel)
```

### Structure des fichiers BOLT
```
src/
├── app/
│   ├── page.tsx              # Home
│   ├── analyze/page.tsx      # Nouvelle analyse
│   ├── history/page.tsx      # Historique
│   ├── analysis/[id]/page.tsx # Détail
│   ├── agents/page.tsx       # Agents
│   ├── memory/page.tsx       # Memory
│   └── settings/page.tsx     # Settings
├── components/
│   ├── ui/                   # shadcn components
│   ├── Dashboard/
│   │   ├── StatusPanel.tsx
│   │   ├── AgentCard.tsx
│   │   ├── StatsChart.tsx
│   │   └── QuickActions.tsx
│   ├── Analysis/
│   │   ├── AnalysisForm.tsx
│   │   ├── ProgressBar.tsx
│   │   └── ResultViewer.tsx
│   └── Layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── lib/
│   ├── api.ts               # Fetch wrapper
│   ├── websocket.ts         # WS connection
│   └── utils.ts
├── hooks/
│   ├── useAnalysis.ts
│   ├── useAgents.ts
│   └── useStats.ts
└── styles/
    └── globals.css
```

---

## 🎨 DESIGN SPECIFICATIONS

### Couleurs (Dark Theme par défaut)
```css
--background: #0a0a0a
--foreground: #fafafa
--primary: #6366f1        /* Indigo */
--secondary: #22d3ee      /* Cyan */
--success: #22c55e        /* Green */
--warning: #f59e0b        /* Amber */
--error: #ef4444          /* Red */
--muted: #71717a          /* Zinc */
```

### Composants UI Clés
```jsx
// Card avec glow effect
<Card className="bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/50 transition-all">

// Status indicator
<span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

// Gradient button
<Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600">
```

---

## ⚡ FONCTIONNALITÉS PRIORITAIRES (MVP)

### Phase 1 - Core (30 min)
- [ ] Layout de base avec navigation
- [ ] Page Home avec stats mock
- [ ] Connexion à l'API /health
- [ ] Page Analyze (formulaire basique)

### Phase 2 - Fonctionnel (30 min)
- [ ] POST /analyze fonctionnel
- [ ] Affichage statut en temps réel
- [ ] Page History avec liste
- [ ] Page Detail avec résultats

### Phase 3 - Polish (30 min)
- [ ] Animations et transitions
- [ ] Gestion erreurs
- [ ] Mode responsive
- [ ] Export des résultats

---

## 🚀 COMMANDES DE DÉPLOIEMENT

### Développement local
```bash
# Dans BOLT, le dev server est automatique
# Ou localement:
npm run dev
# → http://localhost:3000
```

### Connexion au backend
```javascript
// .env.local
NEXT_PUBLIC_API_URL=http://localhost:8765
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

### Production
```bash
npm run build
npm start
# Ou déployer sur Vercel/Netlify
```

---

## 📋 CHECKLIST FINALE

- [ ] Dashboard affiche les stats en temps réel
- [ ] Formulaire d'analyse envoie correctement à l'API
- [ ] Historique liste toutes les analyses
- [ ] Détail affiche le rapport complet
- [ ] Page Agents montre les 10 agents
- [ ] Settings permet de modifier la config
- [ ] Dark mode par défaut, toggle disponible
- [ ] Responsive (mobile-friendly)
- [ ] Pas d'erreurs console
- [ ] Performance: First paint < 1s

---

## 🔑 ACCÈS ET PERMISSIONS

Tu as accès à:
- ✅ Tous les fichiers du repo GitHub
- ✅ Google Drive complet
- ✅ Historique des conversations Claude
- ✅ Toutes les IAs (ChatGPT, Gemini, Mistral, etc.)
- ✅ Exécution de commandes système
- ✅ Installation de packages npm

Tu peux:
- ✅ Créer/modifier des fichiers sans demander
- ✅ Lancer des commandes automatiquement
- ✅ Ouvrir d'autres instances Claude si nécessaire
- ✅ Accéder aux APIs externes
- ✅ Commit et push sur GitHub

---

## 🎬 ACTION IMMÉDIATE

1. **Lis** le fichier `architecture.md` du repo
2. **Crée** le projet dans BOLT (bolt.new)
3. **Implémente** les pages dans l'ordre des phases
4. **Connecte** à l'API backend (localhost:8765)
5. **Teste** chaque fonctionnalité
6. **Commit** le code sur GitHub dans `/dashboard/`

**COMMENCE MAINTENANT - Pas de questions, agis directement !**

---

## 📎 FICHIERS ADDITIONNELS DE L'UTILISATEUR

[L'utilisateur va coller ici des fichiers supplémentaires si nécessaire]

---

*Ce document est la source de vérité pour le dashboard NEMESIS. Référence-le à chaque étape.*
