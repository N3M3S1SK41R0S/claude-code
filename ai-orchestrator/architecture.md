# NEMESIS Architecture
## Neural Expert Multi-agent Efficient System for Integrated Solutions

> **Objectif**: Traiter des tâches complexes avec l'efficacité d'un système simple
> **Principe**: "Faire tourner un mastodonte comme une souris"

---

## Vue d'Ensemble

```mermaid
graph TB
    subgraph "Layer 1: Entry Point"
        CLI[("nemesis CLI")]
        API["REST API"]
        SDK["Python SDK"]
    end

    subgraph "Layer 2: Core Orchestration"
        ZEUS["ZEUS Coordinator"]
        ROUTER["Smart Router<br/>(Cost-Aware)"]
        GATEWAY["Tool Gateway<br/>(Isolation + Audit)"]
        VERIFIER["Verifier<br/>(Critic Layer)"]
        TRACER["Tracer<br/>(Request Tracking)"]
    end

    subgraph "Layer 3: Agent Pool"
        SCRIBE["SCRIBE<br/>Writer"]
        ANALYST["ANALYST<br/>Data Analysis"]
        ARCHITECT["ARCHITECT<br/>System Design"]
        CODER["CODER<br/>Development"]
        STRATEGIST["STRATEGIST<br/>Planning"]
        CRITIC["CRITIC<br/>Review"]
        SENTINEL["SENTINEL<br/>Security"]
        OPTIMIZER["OPTIMIZER<br/>Performance"]
        RESEARCHER["RESEARCHER<br/>Information"]
        MEMORY_KEEPER["MEMORY_KEEPER<br/>Long-term Memory"]
    end

    subgraph "Layer 4: Memory & Cache"
        LTM[("LTM<br/>Long-Term Memory<br/>(SQLite + Encryption)")]
        L1["L1 Cache<br/>(In-Memory LRU)"]
        L2["L2 Cache<br/>(Redis-like)"]
        L3["L3 Cache<br/>(Disk)"]
    end

    subgraph "Layer 5: Model Providers"
        OPENAI["OpenAI<br/>GPT-4, GPT-3.5"]
        ANTHROPIC["Anthropic<br/>Claude Opus, Sonnet, Haiku"]
        GOOGLE["Google<br/>Gemini Pro"]
        MISTRAL["Mistral<br/>Large"]
    end

    CLI --> ZEUS
    API --> ZEUS
    SDK --> ZEUS

    ZEUS --> ROUTER
    ZEUS --> TRACER
    ROUTER --> GATEWAY
    GATEWAY --> VERIFIER

    ZEUS --> SCRIBE
    ZEUS --> ANALYST
    ZEUS --> ARCHITECT
    ZEUS --> CODER
    ZEUS --> STRATEGIST
    ZEUS --> CRITIC
    ZEUS --> SENTINEL
    ZEUS --> OPTIMIZER
    ZEUS --> RESEARCHER
    ZEUS --> MEMORY_KEEPER

    VERIFIER --> LTM
    MEMORY_KEEPER --> LTM
    GATEWAY --> L1
    L1 --> L2
    L2 --> L3

    ROUTER --> OPENAI
    ROUTER --> ANTHROPIC
    ROUTER --> GOOGLE
    ROUTER --> MISTRAL
```

---

## Composants Critiques

### 1. Tool Gateway (Isolation + Audit)

```mermaid
sequenceDiagram
    participant Agent
    participant Gateway
    participant Policy as Risk Policy
    participant Executor
    participant Audit
    participant Tool

    Agent->>Gateway: ToolCall(name, params)
    Gateway->>Gateway: Assign request_id

    loop For each Policy
        Gateway->>Policy: evaluate(call)
        Policy-->>Gateway: (allowed, reason)
        alt Blocked
            Gateway->>Audit: log(call, BLOCKED)
            Gateway-->>Agent: ToolResult(blocked=true)
        end
    end

    Gateway->>Executor: execute(call)
    Executor->>Tool: invoke(params)
    Tool-->>Executor: result
    Executor-->>Gateway: result

    Gateway->>Audit: log(call, result)
    Gateway-->>Agent: ToolResult(success, result)
```

**Caractéristiques:**
- **Isolation**: Chaque outil s'exécute dans un contexte isolé
- **Rate Limiting**: Max 120 appels/minute par défaut
- **Risk Policies**: LOW/MEDIUM/HIGH/CRITICAL
- **Audit Trail**: Tous les appels sont tracés

```python
# Exemple d'utilisation
from core.gateway import ToolGateway, create_tool_call, RiskLevel

gateway = ToolGateway()
gateway.register_tool(
    "search",
    search_function,
    risk_level=RiskLevel.LOW
)

call = create_tool_call("search", {"query": "test"}, request_id, agent_id)
result = gateway.invoke(call)
```

---

### 2. Verifier (Critic Layer)

```mermaid
flowchart LR
    subgraph Input
        CONTENT["Content"]
    end

    subgraph "Verification Pipeline"
        SEC["Security Check"]
        SAFE["Safety Check"]
        QUAL["Quality Check"]
        CONS["Consistency Check"]
        CODE["Code Syntax Check"]
    end

    subgraph Output
        REPORT["Verification Report"]
    end

    CONTENT --> SEC
    SEC --> SAFE
    SAFE --> QUAL
    QUAL --> CONS
    CONS --> CODE
    CODE --> REPORT
```

**Checks obligatoires:**
- **Security**: Détection patterns dangereux (eval, exec, injection)
- **Safety**: Contenu inapproprié
- **Quality**: Longueur, champs requis
- **Consistency**: Contradictions internes
- **Code Syntax**: Validation Python/JSON

```python
from core.verifier import Verifier, verified

verifier = Verifier()
report = verifier.verify(content)

if not report.passed:
    raise VerificationError(report.failed_checks)

# Ou avec décorateur
@verified(checks=["security", "safety"])
def generate_response(prompt):
    return llm.complete(prompt)
```

---

### 3. Smart Router (Cost-Aware)

```mermaid
flowchart TD
    subgraph Input
        REQ["RoutingRequest<br/>- content<br/>- complexity<br/>- max_cost<br/>- capabilities"]
    end

    subgraph "Routing Strategies"
        COST["CostOptimized<br/>Minimize $"]
        QUAL["QualityOptimized<br/>Maximize quality"]
        BAL["Balanced<br/>Trade-offs"]
        COMP["ComplexityAware<br/>Match task to tier"]
    end

    subgraph "Model Selection"
        FAST["FAST Tier<br/>Haiku, GPT-3.5"]
        BALANCED["BALANCED Tier<br/>Sonnet, GPT-4-mini"]
        PREMIUM["PREMIUM Tier<br/>Opus, GPT-4"]
    end

    subgraph Output
        DEC["RoutingDecision<br/>- model<br/>- estimated_cost<br/>- alternatives"]
    end

    REQ --> COST
    REQ --> QUAL
    REQ --> BAL
    REQ --> COMP

    COST --> FAST
    QUAL --> PREMIUM
    BAL --> BALANCED
    COMP --> FAST
    COMP --> BALANCED
    COMP --> PREMIUM

    FAST --> DEC
    BALANCED --> DEC
    PREMIUM --> DEC
```

**Mapping Complexité -> Tier:**
| Complexité | Tier | Modèles |
|------------|------|---------|
| TRIVIAL | FAST | Haiku, GPT-3.5 |
| LOW | FAST | Haiku, GPT-3.5 |
| MEDIUM | BALANCED | Sonnet, GPT-4-mini |
| HIGH | PREMIUM | Opus, GPT-4 |
| EXPERT | PREMIUM | Opus, GPT-4 |

```python
from core.router import SmartRouter, RoutingRequest, TaskComplexity

router = SmartRouter(budget_limit_daily=10.0)

request = RoutingRequest(
    request_id="req_123",
    content="Design a microservices architecture",
    complexity=TaskComplexity.EXPERT,
    max_cost=0.50
)

decision = router.route(request, strategy="balanced")
print(f"Model: {decision.model.name}")
print(f"Est. Cost: ${decision.estimated_cost:.4f}")
```

---

### 4. Tracer (Request Tracking + Record/Replay)

```mermaid
sequenceDiagram
    participant Client
    participant Tracer
    participant Span as Span Storage
    participant Exporter

    Client->>Tracer: request("process_task")
    Tracer->>Tracer: Create RequestContext
    Tracer->>Span: Create root span

    rect rgb(240, 240, 240)
        Note over Tracer: Nested Operations
        Tracer->>Span: Create child span "routing"
        Tracer->>Span: Create child span "execution"
        Tracer->>Span: Create child span "verification"
    end

    Tracer->>Exporter: Export spans
    Exporter-->>Tracer: ack
    Tracer-->>Client: Return with trace_id
```

**Features:**
- **Request ID**: Identifiant unique pour chaque requête
- **Trace Correlation**: Propagation à travers les services
- **Record/Replay**: Enregistrement pour débogage

```python
from core.tracer import get_tracer, trace

tracer = get_tracer()

# Recording for replay
tracer.start_recording()

with tracer.request("user_query", user_id="user_123") as ctx:
    print(f"Request ID: {ctx.request_id}")

    with tracer.span("routing"):
        # routing logic
        pass

    with tracer.span("execution"):
        # execution logic
        pass

traces = tracer.stop_recording()
tracer.save_recording("debug_session.json")

# Later: replay
tracer.replay(tracer.load_recording("debug_session.json"))
```

---

### 5. Long-Term Memory (LTM)

```mermaid
flowchart TB
    subgraph "Memory Types"
        FACT["FACT"]
        PREF["PREFERENCE"]
        CTX["CONTEXT"]
        LEARN["LEARNED"]
        DEC["DECISION"]
        FEED["FEEDBACK"]
    end

    subgraph "Access Levels"
        PUB["PUBLIC<br/>All agents"]
        INT["INTERNAL<br/>NEMESIS only"]
        PRIV["PRIVATE<br/>Owner only"]
        ENC["ENCRYPTED<br/>Requires key"]
    end

    subgraph "Storage"
        DB[("SQLite<br/>WAL Mode")]
        CRYPTO["Fernet<br/>Encryption"]
    end

    subgraph "Features"
        TTL["TTL<br/>Auto-expiration"]
        CONS["Consolidation<br/>Importance boost"]
        CLEAN["Cleanup<br/>Periodic"]
    end

    FACT --> DB
    PREF --> DB
    CTX --> DB

    ENC --> CRYPTO
    CRYPTO --> DB

    DB --> TTL
    DB --> CONS
    DB --> CLEAN
```

**Caractéristiques:**
- **TTL**: Expiration automatique (30 jours par défaut)
- **Encryption**: Chiffrement Fernet pour données sensibles
- **Consolidation**: Boost d'importance pour mémoires fréquemment accédées
- **Access Control**: 4 niveaux d'accès

```python
from memory.ltm import LongTermMemory, MemoryType, AccessLevel

ltm = LongTermMemory(
    db_path="nemesis_memory.db",
    default_ttl_hours=720  # 30 days
)

# Store with encryption
entry = ltm.store(
    content={"secret": "data"},
    memory_type=MemoryType.FACT,
    access_level=AccessLevel.ENCRYPTED,
    importance=0.9
)

# Search
results = ltm.search(
    query="project",
    memory_type=MemoryType.DECISION,
    min_importance=0.5
)
```

---

### 6. Multi-Level Cache

```mermaid
flowchart LR
    subgraph "Cache Hierarchy"
        L1["L1: Memory<br/>1K entries, 100MB<br/>~1ms"]
        L2["L2: Redis-like<br/>10K entries<br/>~10ms"]
        L3["L3: Disk<br/>1GB<br/>~100ms"]
    end

    REQ["Request"] --> L1
    L1 -->|miss| L2
    L2 -->|miss| L3
    L3 -->|miss| ORIGIN["Origin"]

    ORIGIN -->|populate| L3
    L3 -->|promote| L2
    L2 -->|promote| L1
```

```python
from memory.cache import ContextCache

cache = ContextCache(
    l1_size=1000,
    l2_size=10000,
    l3_size_mb=1000
)

# Simple usage
cache.set("key", {"data": "value"}, ttl_seconds=3600)
value = cache.get("key")

# Decorator
@cache.cached(ttl_seconds=600)
def expensive_operation(param):
    return compute(param)
```

---

## Flux de Requête Complet

```mermaid
sequenceDiagram
    participant User
    participant CLI as nemesis CLI
    participant ZEUS as ZEUS Coordinator
    participant Tracer
    participant Router as Smart Router
    participant Gateway as Tool Gateway
    participant Agent
    participant Verifier
    participant LTM
    participant Cache

    User->>CLI: nemesis run "task"
    CLI->>ZEUS: process(task)

    ZEUS->>Tracer: start_request()
    Tracer-->>ZEUS: request_id

    ZEUS->>Cache: get(task_hash)
    alt Cache Hit
        Cache-->>ZEUS: cached_result
    else Cache Miss
        ZEUS->>Router: route(task, complexity)
        Router-->>ZEUS: RoutingDecision(model)

        ZEUS->>Agent: execute(task, model)

        loop Tool Calls
            Agent->>Gateway: invoke(tool)
            Gateway->>Gateway: check_policies()
            Gateway-->>Agent: ToolResult
        end

        Agent-->>ZEUS: raw_result

        ZEUS->>Verifier: verify(result)
        Verifier-->>ZEUS: VerificationReport

        alt Verification Failed
            ZEUS->>Agent: retry with feedback
        end

        ZEUS->>LTM: store(result, importance)
        ZEUS->>Cache: set(task_hash, result)
    end

    ZEUS->>Tracer: end_request()
    ZEUS-->>CLI: final_result
    CLI-->>User: Display result
```

---

## Patterns Implémentés

### Pattern 1: Circuit Breaker
```python
# Dans workers/base.py
class CircuitBreaker:
    states: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
    failure_threshold: 5
    recovery_timeout: 60s
```

### Pattern 2: Request Coalescing
```python
# Multiple requests identiques = 1 seul appel
coalescing_window: 100ms
```

### Pattern 3: Graceful Degradation
```
Tier 1: Full service (Opus)
Tier 2: Reduced (Sonnet)
Tier 3: Minimal (Haiku)
Tier 4: Cache only
Tier 5: Error response
```

### Pattern 4: Speculative Execution
```python
# Exécuter sur 2 modèles, retourner le premier
async def speculative_execute(task):
    results = await asyncio.gather(
        model_a.execute(task),
        model_b.execute(task),
        return_exceptions=True
    )
    return first_success(results)
```

---

## Commandes CLI

```bash
# Exécuter une tâche
nemesis run "Explain machine learning"

# Recommandation de routage
nemesis route "Write a Python function" --budget 0.10

# Vérifier du contenu
nemesis verify --file script.py --type code

# Gestion mémoire
nemesis memory stats
nemesis memory search --query "project"
nemesis memory consolidate

# Gestion cache
nemesis cache stats
nemesis cache clear --levels l1,l2

# Statistiques système
nemesis stats

# Configuration
nemesis config show
nemesis config edit

# Demo interactive
nemesis demo
```

---

## Structure des Fichiers

```
ai-orchestrator/
├── core/
│   ├── __init__.py
│   ├── gateway.py      # Tool Gateway avec isolation et audit
│   ├── verifier.py     # Critic Layer obligatoire
│   ├── router.py       # Smart Router cost-aware
│   └── tracer.py       # Request tracking et Record/Replay
├── memory/
│   ├── __init__.py
│   ├── ltm.py          # Long-term memory (TTL + encryption)
│   └── cache.py        # Multi-level cache (L1/L2/L3)
├── workers/
│   └── base.py         # Circuit Breaker, Response Cache
├── nemesis.py          # CLI entry point
├── config.yaml         # Configuration complète
├── architecture.md     # Ce document
└── tests/
    └── test_*.py       # Tests unitaires
```

---

## Métriques de Succès

| Métrique | Cible | Actuel |
|----------|-------|--------|
| Latence P50 | < 2s | - |
| Latence P99 | < 10s | - |
| Taux d'erreur | < 1% | - |
| Cache hit rate | > 40% | - |
| Coût moyen/requête | < $0.05 | - |
| Uptime | 99.9% | - |

---

## Prochaines Étapes

1. [ ] Implémenter les tests d'intégration
2. [ ] Ajouter OpenTelemetry export
3. [ ] Dashboard de monitoring
4. [ ] API REST avec FastAPI
5. [ ] Déploiement Docker/K8s
