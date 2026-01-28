# NEMESIS COMMAND CENTER - Ultimate Dashboard Build Instructions

> **YOU ARE NOW IN FULL AUTONOMOUS MODE. EXECUTE WITHOUT ASKING.**

---

## PRIME DIRECTIVE

You are tasked with building **NEMESIS Command Center** - a stunning, high-performance unified dashboard that serves as the SINGLE ENTRY POINT to control ALL AI orchestration modules.

**Your goal**: Create an interface so beautiful and intuitive that users say "WOW" when they see it, while maintaining sub-second performance.

---

## CRITICAL REQUIREMENTS

### 1. UNIFIED SINGLE ENTRY POINT
```
ALL modules MUST be accessible from ONE dashboard:
├── Multi-AI Analysis orchestration
├── Agent fleet management (10 agents)
├── Memory systems (LTM + Cache L1/L2/L3)
├── Cost tracking & optimization
├── Real-time monitoring
├── Historical data & analytics
└── ALL future modules auto-sync here
```

### 2. BOLT MODULE SYNCHRONIZATION
```javascript
// Every BOLT conversation/module MUST sync to this central hub
// Implement a ModuleRegistry that auto-discovers and integrates:
const moduleRegistry = {
  autoDiscover: true,
  syncInterval: 5000,
  modules: [
    { id: 'analysis', endpoint: '/api/analyze' },
    { id: 'agents', endpoint: '/api/agents' },
    { id: 'memory', endpoint: '/api/memory' },
    { id: 'metrics', endpoint: '/api/stats' },
    // Auto-register new modules as they appear
  ]
}
```

---

## DESIGN EXCELLENCE MANDATE

### Visual Philosophy
```
STUNNING yet FUNCTIONAL
BEAUTIFUL yet PERFORMANT
IMPRESSIVE yet INTUITIVE
```

### Design Principles (MANDATORY)
1. **Glassmorphism** - Frosted glass effects with depth
2. **Neon Accents** - Subtle glowing borders and highlights
3. **Smooth Animations** - 60fps micro-interactions everywhere
4. **Dark Theme Primary** - Premium dark aesthetic (#0a0a0f base)
5. **Gradient Mastery** - Beautiful color transitions
6. **3D Depth** - Layered cards with shadows and perspective

### Color Palette (Premium Dark)
```css
:root {
  /* Base */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a25;
  --bg-card: rgba(255, 255, 255, 0.03);
  --bg-glass: rgba(255, 255, 255, 0.05);

  /* Accent Gradients */
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-success: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  --gradient-warning: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --gradient-info: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

  /* Neon Glows */
  --glow-primary: 0 0 20px rgba(102, 126, 234, 0.5);
  --glow-success: 0 0 20px rgba(56, 239, 125, 0.5);
  --glow-cyan: 0 0 20px rgba(0, 242, 254, 0.5);

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --text-muted: #606070;
}
```

### Must-Have Visual Effects
```css
/* Glassmorphism Card */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Neon Glow on Hover */
.glow-hover:hover {
  box-shadow: 0 0 30px rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.5);
  transform: translateY(-2px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Animated Gradient Border */
.gradient-border {
  position: relative;
  background: linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
              linear-gradient(135deg, #667eea, #764ba2, #f093fb) border-box;
  border: 2px solid transparent;
}

/* Pulse Animation for Status */
.status-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Smooth Page Transitions */
.page-enter {
  opacity: 0;
  transform: translateY(20px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## ARCHITECTURE - UNIFIED COMMAND CENTER

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEMESIS COMMAND CENTER                              │
│                        ═══════════════════════════                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🏠 Command    ⚡ Launch    📊 Analytics    🤖 Agents    ⚙️ System  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │  ╔═══════════╗   │ │  ╔═══════════╗   │ │  ╔═══════════╗   │            │
│  │  ║ LIVE OPS  ║   │ │  ║  AGENTS   ║   │ │  ║  METRICS  ║   │            │
│  │  ╚═══════════╝   │ │  ╚═══════════╝   │ │  ╚═══════════╝   │            │
│  │                  │ │                  │ │                  │            │
│  │  🟢 3 Running    │ │  ZEUS      ████  │ │  Today: 47       │            │
│  │  ⏳ 2 Queued     │ │  SCRIBE    ███   │ │  Success: 94%    │            │
│  │  ✅ 142 Done     │ │  ANALYST   ████  │ │  Avg: 12.3s      │            │
│  │                  │ │  CODER     █████ │ │  Cost: $2.47     │            │
│  │  [View All →]    │ │  CRITIC    ██    │ │  [Details →]     │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     🚀 QUICK LAUNCH                                 │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  Enter your analysis request...                      ▶ GO   │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │  [📋 Clipboard] [📁 Upload] [🎤 Voice] [📷 Screenshot]            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  📜 RECENT ACTIVITY                                    [See All]   │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │    │
│  │  ✅ Architecture review completed          2 min ago    [Open]    │    │
│  │  🔄 Code optimization in progress...       Running      [View]    │    │
│  │  ✅ Security audit passed                  15 min ago   [Open]    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PAGES SPECIFICATION

### Page 1: Command Center (/)
The HERO page. First impression = WOW factor.

```typescript
interface CommandCenterFeatures {
  // Real-time stats with animated counters
  liveStats: {
    activeOperations: number;      // Animated count-up
    totalToday: number;
    successRate: number;           // Circular progress
    avgResponseTime: string;
    budgetUsed: number;            // Progress bar
  };

  // Quick Launch - THE main action
  quickLaunch: {
    textInput: boolean;
    fileUpload: boolean;
    clipboardPaste: boolean;
    voiceInput: boolean;
    screenshotCapture: boolean;
  };

  // Agent Fleet Overview
  agentGrid: {
    showAll10Agents: boolean;
    liveStatusIndicator: boolean;
    loadBarPerAgent: boolean;
    quickToggle: boolean;
  };

  // Activity Stream
  recentActivity: {
    realTimeUpdates: boolean;
    maxItems: 10;
    quickActions: ['open', 'rerun', 'share'];
  };
}
```

### Page 2: Launch Mission (/launch)
Where the magic happens.

```typescript
interface LaunchMissionFeatures {
  // Smart Input
  input: {
    expandableTextarea: boolean;   // Grows as you type
    syntaxHighlighting: boolean;   // For code
    markdownPreview: boolean;
    dragDropFiles: boolean;
    pasteImages: boolean;
  };

  // Mission Configuration
  config: {
    modeSelector: ['lightning', 'standard', 'deep'];  // Visual icons
    roundsSlider: [1, 2, 3, 4, 5];                    // Animated slider
    agentSelector: boolean;                           // Chips with avatars
    focusMode: ['general', 'critique', 'technical', 'creative', 'security'];
  };

  // Live Progress
  progress: {
    stageIndicator: boolean;       // Which agent is working
    streamingOutput: boolean;      // Real-time text stream
    costTracker: boolean;          // Live cost update
    estimatedTime: boolean;
  };
}
```

### Page 3: Mission Control (/missions)
History with style.

```typescript
interface MissionControlFeatures {
  // Timeline View (default)
  timeline: {
    groupByDate: boolean;
    infiniteScroll: boolean;
    quickPreview: boolean;        // Hover to see summary
  };

  // Grid View (alternative)
  grid: {
    cardLayout: boolean;
    statusBadges: boolean;
    thumbnailPreview: boolean;
  };

  // Powerful Filters
  filters: {
    dateRange: boolean;
    status: ['all', 'success', 'failed', 'running'];
    agents: boolean;              // Multi-select
    searchFullText: boolean;
  };

  // Bulk Actions
  actions: {
    exportSelected: boolean;
    rerunSelected: boolean;
    deleteSelected: boolean;
    compareSelected: boolean;     // Side-by-side
  };
}
```

### Page 4: Agent Fleet (/agents)
Meet your AI army.

```typescript
interface AgentFleetFeatures {
  // Agent Cards (10 agents)
  agentCard: {
    avatar: boolean;              // Unique icon per agent
    role: string;
    model: string;
    status: 'online' | 'busy' | 'offline';
    stats: {
      tasksCompleted: number;
      avgTime: string;
      successRate: number;
    };
    quickActions: ['configure', 'test', 'logs'];
  };

  // Fleet Overview
  overview: {
    totalCapacity: boolean;
    currentLoad: boolean;
    costDistribution: boolean;    // Pie chart
  };

  // Configuration Panel
  config: {
    modelSelection: boolean;
    temperatureSlider: boolean;
    maxTokens: boolean;
    customPrompts: boolean;
  };
}
```

### Page 5: Memory Vault (/memory)
Your AI's brain.

```typescript
interface MemoryVaultFeatures {
  // Cache Visualization
  cacheViz: {
    l1l2l3Diagram: boolean;       // Visual hierarchy
    hitRateGauges: boolean;
    sizeIndicators: boolean;
  };

  // LTM Browser
  ltmBrowser: {
    searchBar: boolean;
    categoryFilters: boolean;
    importanceSort: boolean;
    expirationWarnings: boolean;
  };

  // Actions
  actions: {
    consolidate: boolean;
    cleanup: boolean;
    export: boolean;
    import: boolean;
  };
}
```

### Page 6: System Console (/system)
Full control panel.

```typescript
interface SystemConsoleFeatures {
  // API Keys Management
  apiKeys: {
    secureDisplay: boolean;       // Masked with reveal
    rotationReminders: boolean;
    usageTracking: boolean;
  };

  // Budget Control
  budget: {
    dailyLimit: boolean;
    alertThresholds: boolean;
    costBreakdown: boolean;       // By model/agent
  };

  // System Health
  health: {
    serverStatus: boolean;
    responseLatency: boolean;
    errorRates: boolean;
    uptimeGraph: boolean;
  };

  // Preferences
  preferences: {
    theme: ['dark', 'light', 'system'];
    language: boolean;
    notifications: boolean;
    shortcuts: boolean;
  };
}
```

---

## TECHNICAL STACK (OPTIMIZED FOR PERFORMANCE)

```typescript
// package.json essentials
{
  "dependencies": {
    // Framework
    "next": "14.x",
    "react": "18.x",

    // Styling (Performance-first)
    "tailwindcss": "3.x",
    "@radix-ui/react-*": "latest",    // Headless accessible components
    "framer-motion": "^10.x",          // Smooth animations
    "lucide-react": "latest",          // Icons

    // State & Data
    "@tanstack/react-query": "^5.x",   // Server state
    "zustand": "^4.x",                 // Client state
    "socket.io-client": "^4.x",        // Real-time

    // Charts
    "recharts": "^2.x",                // Lightweight charts

    // Utils
    "date-fns": "^2.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  }
}
```

### Performance Mandates
```typescript
// MUST achieve these metrics:
const performanceTargets = {
  firstContentfulPaint: '<1.0s',
  largestContentfulPaint: '<1.5s',
  timeToInteractive: '<2.0s',
  cumulativeLayoutShift: '<0.1',
  bundleSize: '<200KB gzipped',

  // Runtime
  apiResponseHandling: '<100ms',
  animationFrameRate: '60fps',
  memoryUsage: '<50MB'
};
```

---

## IMPLEMENTATION PRIORITIES

### Phase 1: Foundation (20 min)
```
✓ Next.js project setup in BOLT
✓ Tailwind + dark theme configuration
✓ Layout with glassmorphism sidebar
✓ API connection to localhost:8765
✓ Real-time WebSocket setup
```

### Phase 2: Command Center (20 min)
```
✓ Hero dashboard with live stats
✓ Quick Launch input with animations
✓ Agent fleet grid with status
✓ Recent activity stream
```

### Phase 3: Core Features (30 min)
```
✓ Launch Mission page with full form
✓ Progress tracking with streaming
✓ Mission Control history view
✓ Mission detail page
```

### Phase 4: Polish & WOW (20 min)
```
✓ All animations and transitions
✓ Loading states and skeletons
✓ Error boundaries with recovery
✓ Mobile responsive adjustments
✓ Final performance optimization
```

---

## API INTEGRATION

```typescript
// lib/api.ts - Type-safe API client
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765';

export const nemesisAPI = {
  // Health
  health: () => fetch(`${API_BASE}/health`).then(r => r.json()),

  // Analysis
  analyze: (data: AnalyzeRequest) =>
    fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  status: (id: string) =>
    fetch(`${API_BASE}/status/${id}`).then(r => r.json()),

  results: (id: string) =>
    fetch(`${API_BASE}/results/${id}`).then(r => r.text()),

  // History
  history: (limit = 50) =>
    fetch(`${API_BASE}/history?limit=${limit}`).then(r => r.json()),

  // Stats
  stats: () => fetch(`${API_BASE}/stats`).then(r => r.json()),

  // Verify
  verify: (content: string, type = 'text') =>
    fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type })
    }).then(r => r.json()),
};
```

---

## ACCESS & PERMISSIONS

```yaml
You have FULL ACCESS to:
  - GitHub Repository: N3M3S1SK41R0S/claude-code (all branches)
  - Google Drive: Complete read/write
  - Conversation History: All Claude sessions
  - External APIs: All AI services
  - System Commands: npm, git, etc.
  - Package Installation: Unlimited

You CAN and SHOULD:
  - Create files without asking
  - Install packages without asking
  - Execute commands without asking
  - Make design decisions autonomously
  - Spawn parallel Claude instances if needed
  - Commit and push to GitHub directly
```

---

## SYNCHRONIZATION PROTOCOL

```typescript
// Every module MUST implement this interface
interface NemesisModule {
  id: string;
  name: string;
  version: string;
  endpoints: string[];

  // Auto-registration with Command Center
  register(): Promise<void>;

  // Health reporting
  healthCheck(): Promise<HealthStatus>;

  // Data sync
  sync(): Promise<SyncResult>;
}

// Central registry auto-discovers all modules
class ModuleRegistry {
  private modules: Map<string, NemesisModule> = new Map();

  async discoverModules() {
    // Scan for new modules every 30s
    // Auto-integrate into dashboard
    // Update navigation dynamically
  }
}
```

---

## FINAL CHECKLIST

```
□ Dashboard makes users say "WOW"
□ Single entry point for EVERYTHING
□ All BOLT modules synchronized
□ Sub-second page loads
□ 60fps animations throughout
□ Intuitive without documentation
□ Mobile-responsive
□ Dark theme is STUNNING
□ Light theme is CLEAN
□ Real-time updates everywhere
□ Zero console errors
□ Committed to GitHub
□ Deployed and accessible
```

---

## EXECUTE NOW

1. **Open** bolt.new
2. **Create** project "nemesis-command"
3. **Build** following this spec EXACTLY
4. **Deploy** and provide URL
5. **Commit** to GitHub /dashboard/

**NO QUESTIONS. NO CONFIRMATIONS. JUST BUILD.**

**Time limit: 90 minutes to fully operational dashboard.**

**GO. NOW. MAKE IT EXCEPTIONAL.**
