# 🚀 NEMESIS LIGHTWEIGHT ARCHITECTURE
## "Transformer le Mastodonte en Souris"

---

## 📊 DIAGNOSTIC: Pourquoi NEMESIS est "Lourd"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANALYSE DES GOULOTS D'ÉTRANGLEMENT                        │
│                                                                             │
│  PROBLÈME 1: Trop de Couches (Latence Cumulée)                              │
│  ───────────────────────────────────────────────                            │
│  Request → Layer 1 → Layer 2 → Layer 3 → ... → Layer 7 → Response           │
│            +100ms    +200ms    +300ms    ...    +500ms                      │
│                                                                             │
│  Total: 2-5 secondes juste pour la COORDINATION                            │
│                                                                             │
│  PROBLÈME 2: Communication Inter-Agents (Overhead Réseau)                   │
│  ──────────────────────────────────────────────────────────                 │
│  Agent A ──HTTP──▶ Agent B ──HTTP──▶ Agent C                               │
│          +50ms            +50ms                                             │
│                                                                             │
│  50 agents × ~50ms = 2.5 secondes d'overhead réseau                        │
│                                                                             │
│  PROBLÈME 3: Pas de Cache = Recalculs Inutiles                             │
│  ─────────────────────────────────────────────────                         │
│  Mission similaire hier? On recalcule TOUT from scratch                    │
│                                                                             │
│  PROBLÈME 4: Tous les Agents Actifs = Gaspillage                           │
│  ─────────────────────────────────────────────────                         │
│  50 agents en mémoire, mais mission simple utilise 3                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 SOLUTION: Architecture "Fast Path" + "Full Path"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DUAL-PATH ARCHITECTURE                                    │
│                                                                             │
│                         ┌─────────────┐                                     │
│                         │   REQUEST   │                                     │
│                         └──────┬──────┘                                     │
│                                │                                            │
│                         ┌──────▼──────┐                                     │
│                         │  ANALYZER   │  Complexity Score: 0.0-1.0          │
│                         └──────┬──────┘                                     │
│                                │                                            │
│              ┌─────────────────┼─────────────────┐                          │
│              │                 │                 │                          │
│              ▼                 ▼                 ▼                          │
│     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐               │
│     │  EXPRESS PATH  │ │ STANDARD PATH  │ │ ADVANCED PATH  │               │
│     │   Score <0.3   │ │  Score 0.3-0.7 │ │   Score >0.7   │               │
│     └────────────────┘ └────────────────┘ └────────────────┘               │
│              │                 │                 │                          │
│              ▼                 ▼                 ▼                          │
│     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐               │
│     │ 1-2 Agents     │ │ 3-5 Agents     │ │ Full Pipeline  │               │
│     │ Direct Exec    │ │ Basic Pipeline │ │ All Features   │               │
│     │ ~500ms         │ │ ~2-5s          │ │ ~10-30s        │               │
│     └────────────────┘ └────────────────┘ └────────────────┘               │
│                                                                             │
│  EXPRESS: "Fix typo", "Add comment", "Simple refactor"                     │
│  STANDARD: "Add endpoint", "Write tests", "Basic feature"                  │
│  ADVANCED: "Design system", "Complex integration", "New architecture"       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 PATTERN 1: Smart Workflow Router

```python
# ============================================================================
# SMART WORKFLOW ROUTER
# Bypasse les couches inutiles pour requêtes simples
# ============================================================================

class SmartWorkflowRouter:
    """
    Analyse requête et route vers le chemin optimal.
    80% des requêtes = EXPRESS (pas besoin du full pipeline)
    """

    def __init__(self):
        # Patterns de requêtes simples (regex)
        self.express_patterns = [
            r"fix\s+(typo|bug|error)",
            r"add\s+(comment|docstring)",
            r"rename\s+\w+",
            r"format\s+code",
            r"simple\s+(change|update)",
        ]

        # Patterns de requêtes complexes
        self.advanced_patterns = [
            r"(design|architect)\s+system",
            r"(integrate|implement)\s+.*(api|service)",
            r"(refactor|rewrite)\s+(entire|whole|complete)",
            r"(security|performance)\s+audit",
            r"(migrate|upgrade)\s+(database|framework)",
        ]

        # Cache de décisions passées
        self.routing_cache = {}

    def route(self, request: str, context: dict = None) -> dict:
        """
        Décide quel workflow utiliser.

        Returns:
            {
                "path": "express" | "standard" | "advanced",
                "agents": ["agent1", "agent2", ...],
                "skip_layers": ["evaluation", "parallel_universe", ...],
                "estimated_time": "500ms" | "5s" | "30s"
            }
        """
        # Check cache first
        cache_key = self._generate_cache_key(request)
        if cache_key in self.routing_cache:
            return self.routing_cache[cache_key]

        # Calculate complexity
        complexity = self._calculate_complexity(request, context)

        if complexity < 0.3:
            routing = self._express_routing(request)
        elif complexity < 0.7:
            routing = self._standard_routing(request)
        else:
            routing = self._advanced_routing(request)

        # Cache decision
        self.routing_cache[cache_key] = routing
        return routing

    def _calculate_complexity(self, request: str, context: dict) -> float:
        """Score 0.0-1.0 indiquant complexité."""
        score = 0.0

        # Factor 1: Request length
        if len(request) > 200: score += 0.15
        if len(request) > 500: score += 0.15

        # Factor 2: Express patterns (reduce score)
        for pattern in self.express_patterns:
            if re.search(pattern, request, re.I):
                score -= 0.3
                break

        # Factor 3: Advanced patterns (increase score)
        for pattern in self.advanced_patterns:
            if re.search(pattern, request, re.I):
                score += 0.4
                break

        # Factor 4: Multiple requirements
        requirement_count = len(re.findall(r'(and|also|plus|with)', request, re.I))
        score += requirement_count * 0.1

        # Factor 5: Historical success (from context)
        if context and "similar_request_success_rate" in context:
            if context["similar_request_success_rate"] > 0.9:
                score -= 0.1  # Known pattern, probably simpler

        return max(0.0, min(1.0, score))

    def _express_routing(self, request: str) -> dict:
        """
        EXPRESS PATH: Minimum d'agents, maximum de vitesse.
        Skip: Input analysis, evaluation layers, parallel universe
        """
        return {
            "path": "express",
            "agents": ["code_generator"],  # Single agent only
            "skip_layers": [
                "input_analysis",
                "task_decomposition",
                "peer_evaluation",
                "meta_evaluation",
                "parallel_universe"
            ],
            "evaluation": "self_only",  # Just self-eval, no multi-strata
            "estimated_time": "500ms",
            "max_retries": 1
        }

    def _standard_routing(self, request: str) -> dict:
        """
        STANDARD PATH: Core agents, basic evaluation.
        """
        return {
            "path": "standard",
            "agents": ["code_generator", "test_generator", "self_evaluator"],
            "skip_layers": [
                "parallel_universe",
                "meta_evaluation"
            ],
            "evaluation": "self_and_peer",  # 2 strata only
            "estimated_time": "5s",
            "max_retries": 2
        }

    def _advanced_routing(self, request: str) -> dict:
        """
        ADVANCED PATH: Full NEMESIS power.
        """
        return {
            "path": "advanced",
            "agents": "dynamic",  # Orchestrator decides
            "skip_layers": [],  # Nothing skipped
            "evaluation": "full",  # All 5 strata
            "parallel_approaches": 3,
            "estimated_time": "30s",
            "max_retries": 3
        }
```

---

## 🔧 PATTERN 2: Lazy Agent Pool

```python
# ============================================================================
# LAZY AGENT POOL
# Agents créés uniquement quand nécessaires, détruits quand idle
# ============================================================================

class LazyAgentPool:
    """
    Pool d'agents avec:
    - Création lazy (on-demand)
    - Destruction automatique (idle timeout)
    - Priorisation (agents critiques gardés plus longtemps)
    """

    def __init__(self):
        self.agent_registry = {}  # Configs des agents (pas les instances)
        self.active_agents = {}   # Instances actives
        self.agent_stats = {}     # Usage statistics

        # Configuration
        self.idle_timeout = 300   # 5 minutes
        self.critical_agents = ["code_generator", "zeus_orchestrator"]

        # Register all possible agents (configs only, no instances)
        self._register_agents()

        # Start cleanup daemon
        self._start_cleanup_daemon()

    def _register_agents(self):
        """
        Enregistre les configurations de tous les agents.
        AUCUN agent n'est créé ici (lazy loading).
        """
        self.agent_registry = {
            "code_generator": {
                "class": CodeGeneratorAgent,
                "config": {"model": "claude-3-5-sonnet", "temperature": 0.2},
                "priority": "critical",
                "warmup_time": 2.0  # seconds
            },
            "test_generator": {
                "class": TestGeneratorAgent,
                "config": {"model": "claude-3-haiku", "coverage": 0.85},
                "priority": "standard",
                "warmup_time": 1.5
            },
            "security_specialist": {
                "class": SecuritySpecialistAgent,
                "config": {"model": "claude-3-5-sonnet", "paranoia": "high"},
                "priority": "standard",
                "warmup_time": 2.0
            },
            # ... 47 autres agents configs
        }

        # Initialize stats
        for agent_name in self.agent_registry:
            self.agent_stats[agent_name] = {
                "calls": 0,
                "total_time": 0,
                "last_used": None,
                "created_count": 0,
                "destroyed_count": 0
            }

    def get_agent(self, agent_name: str):
        """
        Retourne un agent (créé si nécessaire).

        Premier appel: Crée l'agent (~2s)
        Appels suivants: Retourne instance existante (~0.001s)
        """
        if agent_name not in self.agent_registry:
            raise ValueError(f"Unknown agent: {agent_name}")

        # Check if already active
        if agent_name in self.active_agents:
            self._update_last_used(agent_name)
            return self.active_agents[agent_name]

        # LAZY CREATION
        print(f"🔧 Creating agent: {agent_name}")
        start = time.time()

        config = self.agent_registry[agent_name]
        agent_instance = config["class"](**config["config"])

        self.active_agents[agent_name] = agent_instance
        self.agent_stats[agent_name]["created_count"] += 1
        self._update_last_used(agent_name)

        creation_time = time.time() - start
        print(f"✅ Agent {agent_name} ready in {creation_time:.2f}s")

        return agent_instance

    def preload_agents(self, agent_names: list):
        """
        Précharge des agents en parallèle (optimisation).
        Utile quand on SAIT qu'on aura besoin de certains agents.
        """
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(self.get_agent, name): name
                for name in agent_names
                if name not in self.active_agents
            }

            for future in concurrent.futures.as_completed(futures):
                agent_name = futures[future]
                try:
                    future.result()
                except Exception as e:
                    print(f"❌ Failed to preload {agent_name}: {e}")

    def _cleanup_idle_agents(self):
        """
        Daemon qui détruit les agents idle.
        Appelé toutes les 60 secondes.
        """
        current_time = time.time()
        agents_to_destroy = []

        for agent_name, instance in self.active_agents.items():
            stats = self.agent_stats[agent_name]
            config = self.agent_registry[agent_name]

            # Calculate idle time
            idle_time = current_time - stats["last_used"]

            # Critical agents have longer timeout
            timeout = self.idle_timeout
            if config["priority"] == "critical":
                timeout *= 2  # 10 minutes for critical

            if idle_time > timeout:
                agents_to_destroy.append(agent_name)

        for agent_name in agents_to_destroy:
            print(f"🗑️ Destroying idle agent: {agent_name}")
            del self.active_agents[agent_name]
            self.agent_stats[agent_name]["destroyed_count"] += 1

    def get_pool_stats(self) -> dict:
        """
        Statistiques du pool.
        """
        return {
            "registered_agents": len(self.agent_registry),
            "active_agents": len(self.active_agents),
            "memory_saved_percent": (
                (1 - len(self.active_agents) / len(self.agent_registry)) * 100
            ),
            "agent_details": {
                name: {
                    "active": name in self.active_agents,
                    "calls": stats["calls"],
                    "avg_time": stats["total_time"] / max(1, stats["calls"]),
                }
                for name, stats in self.agent_stats.items()
            }
        }
```

---

## 🔧 PATTERN 3: Multi-Level Cache avec Invalidation Intelligente

```python
# ============================================================================
# INTELLIGENT MULTI-LEVEL CACHE
# L1 (Memory) → L2 (Redis) → L3 (SQLite) avec smart invalidation
# ============================================================================

class NEMESISCache:
    """
    Cache intelligent avec:
    - 3 niveaux (memory → redis → disk)
    - Invalidation sélective
    - Compression pour gros objets
    - TTL dynamique basé sur usage
    """

    def __init__(self):
        # L1: In-memory (LRU, limité)
        self.l1 = LRUCache(maxsize=200)

        # L2: Redis
        self.l2 = redis.Redis(host='localhost', db=0, decode_responses=False)

        # L3: SQLite (persistent)
        self.l3_conn = sqlite3.connect('nemesis_cache.db', check_same_thread=False)
        self._init_l3_schema()

        # Stats
        self.stats = {"l1_hits": 0, "l2_hits": 0, "l3_hits": 0, "misses": 0}

    def get(self, key: str, default=None):
        """
        Récupère valeur en vérifiant L1 → L2 → L3.
        Auto-promote vers niveaux supérieurs.
        """
        # Try L1 (instant)
        value = self.l1.get(key)
        if value is not None:
            self.stats["l1_hits"] += 1
            return value

        # Try L2 (fast)
        l2_key = f"nemesis:{key}"
        value = self.l2.get(l2_key)
        if value is not None:
            self.stats["l2_hits"] += 1
            value = self._decompress(pickle.loads(value))
            self.l1.put(key, value)  # Promote to L1
            return value

        # Try L3 (slower but persistent)
        cursor = self.l3_conn.execute(
            "SELECT value, compressed FROM cache WHERE key = ?", (key,)
        )
        row = cursor.fetchone()
        if row:
            self.stats["l3_hits"] += 1
            value = self._decompress(pickle.loads(row[0])) if row[1] else pickle.loads(row[0])
            # Promote to L2 and L1
            self._set_l2(key, value)
            self.l1.put(key, value)
            return value

        self.stats["misses"] += 1
        return default

    def set(self, key: str, value, ttl: int = 3600, persist: bool = True):
        """
        Stocke valeur dans tous les niveaux appropriés.

        Args:
            ttl: Time-to-live en secondes
            persist: Si True, stocke aussi en L3 (disk)
        """
        # Compress if large
        compressed = False
        stored_value = value
        if self._should_compress(value):
            stored_value = self._compress(value)
            compressed = True

        # L1: Always
        self.l1.put(key, value)

        # L2: Always with TTL
        self._set_l2(key, stored_value, ttl)

        # L3: Only if persist=True (important data)
        if persist:
            self._set_l3(key, stored_value, compressed)

    def invalidate_pattern(self, pattern: str):
        """
        Invalide toutes les clés matchant un pattern.

        Example:
            invalidate_pattern("code_gen_*")  # Invalide tout code généré
            invalidate_pattern("security_*")  # Invalide tous scans security
        """
        # L1: Iterate and remove
        keys_to_remove = [k for k in self.l1.keys() if fnmatch.fnmatch(k, pattern)]
        for key in keys_to_remove:
            self.l1.pop(key)

        # L2: Use SCAN for pattern matching
        cursor = 0
        while True:
            cursor, keys = self.l2.scan(cursor, match=f"nemesis:{pattern}")
            for key in keys:
                self.l2.delete(key)
            if cursor == 0:
                break

        # L3: SQL LIKE
        self.l3_conn.execute(
            "DELETE FROM cache WHERE key LIKE ?",
            (pattern.replace("*", "%"),)
        )
        self.l3_conn.commit()

        print(f"🗑️ Invalidated cache pattern: {pattern}")

    def get_or_compute(self, key: str, compute_func, ttl: int = 3600):
        """
        Pattern cache-aside: Get from cache or compute if miss.

        This is THE most useful method - avoids boilerplate everywhere.
        """
        value = self.get(key)
        if value is not None:
            return value

        # Cache miss, compute
        value = compute_func()
        self.set(key, value, ttl)
        return value

    # ─────────────────────────────────────────────────────────────────────────
    # SMART INVALIDATION RULES
    # ─────────────────────────────────────────────────────────────────────────

    def on_event(self, event_type: str, event_data: dict):
        """
        Réagit aux événements pour invalider caches affectés.

        Events:
            - code_updated: Invalide analyses liées
            - dependency_changed: Invalide security scans
            - user_preference_changed: Invalide personalization cache
        """
        invalidation_rules = {
            "code_updated": [
                f"security_scan_{event_data.get('file', '*')}",
                f"test_coverage_{event_data.get('file', '*')}",
                "complexity_analysis_*"
            ],
            "dependency_changed": [
                "security_scan_*",
                "vulnerability_check_*"
            ],
            "pattern_learned": [
                f"similar_patterns_{event_data.get('domain', '*')}",
            ],
            "user_preference_changed": [
                "personalization_*",
                "style_suggestion_*"
            ]
        }

        patterns = invalidation_rules.get(event_type, [])
        for pattern in patterns:
            self.invalidate_pattern(pattern)

    def get_hit_rate(self) -> dict:
        """
        Calcule les taux de hit par niveau.
        """
        total = sum(self.stats.values())
        if total == 0:
            return {"l1": 0, "l2": 0, "l3": 0, "miss": 0}

        return {
            "l1_hit_rate": self.stats["l1_hits"] / total,
            "l2_hit_rate": self.stats["l2_hits"] / total,
            "l3_hit_rate": self.stats["l3_hits"] / total,
            "miss_rate": self.stats["misses"] / total,
            "overall_hit_rate": 1 - (self.stats["misses"] / total)
        }


# ============================================================================
# CACHE DECORATOR
# ============================================================================

cache = NEMESISCache()

def cached(ttl: int = 3600, key_prefix: str = "", persist: bool = True):
    """
    Decorator pour cacher résultats de fonction automatiquement.

    Usage:
        @cached(ttl=3600, key_prefix="code_gen")
        def generate_code(requirements: str) -> str:
            # Expensive operation...
            return code
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(a) for a in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = hashlib.md5(":".join(key_parts).encode()).hexdigest()

            # Try cache
            return cache.get_or_compute(
                key=cache_key,
                compute_func=lambda: func(*args, **kwargs),
                ttl=ttl
            )
        return wrapper
    return decorator


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

@cached(ttl=7200, key_prefix="security")
def analyze_security(code: str) -> dict:
    """
    Même code → même résultat (déterministe).
    Cache très efficace ici (hit rate ~85%).
    """
    return security_scanner.full_scan(code)

@cached(ttl=86400, key_prefix="pattern")
def get_fastapi_pattern(pattern_name: str) -> dict:
    """
    Patterns changent rarement → long TTL.
    """
    return dify.query_patterns(pattern_name)

@cached(ttl=300, key_prefix="similar", persist=False)
def find_similar_requests(request: str) -> list:
    """
    Recherche de similarité → TTL court, pas persisté.
    """
    return vector_db.similarity_search(request)
```

---

## 🔧 PATTERN 4: Event-Driven Architecture avec Redis Streams

```python
# ============================================================================
# EVENT-DRIVEN ARCHITECTURE
# Communication découplée entre agents via événements
# ============================================================================

class NEMESISEventBus:
    """
    Event bus basé sur Redis Streams.

    Avantages vs HTTP direct:
    - Découplage (agents ne se connaissent pas)
    - Parallélisme naturel (multiple consumers)
    - Replay (debug, recovery)
    - Backpressure handling
    """

    def __init__(self):
        self.redis = redis.Redis(host='localhost', db=1)
        self.consumer_group = "nemesis-agents"
        self.handlers = {}

    def publish(self, event_type: str, data: dict, priority: str = "normal"):
        """
        Publie un événement.

        Args:
            event_type: "code_generated", "tests_passed", "security_issue", etc.
            data: Payload de l'événement
            priority: "critical" | "normal" | "low"
        """
        stream_name = f"nemesis:events:{priority}"

        event = {
            "type": event_type,
            "data": json.dumps(data),
            "timestamp": time.time(),
            "id": str(uuid.uuid4())
        }

        # Add to stream (Redis handles ordering)
        self.redis.xadd(stream_name, event, maxlen=10000)  # Keep last 10k events

    def subscribe(self, event_type: str, handler_func, consumer_name: str = None):
        """
        Souscrit à un type d'événement.
        Handler appelé automatiquement quand événement publié.
        """
        if event_type not in self.handlers:
            self.handlers[event_type] = []

        self.handlers[event_type].append({
            "func": handler_func,
            "consumer": consumer_name or f"consumer_{len(self.handlers[event_type])}"
        })

    def start_consuming(self):
        """
        Démarre la consommation des événements (tourne en background).
        """
        for priority in ["critical", "normal", "low"]:
            stream_name = f"nemesis:events:{priority}"

            # Create consumer group if not exists
            try:
                self.redis.xgroup_create(stream_name, self.consumer_group, mkstream=True)
            except redis.exceptions.ResponseError:
                pass  # Group already exists

            # Start consumer thread
            thread = threading.Thread(
                target=self._consume_stream,
                args=(stream_name, priority),
                daemon=True
            )
            thread.start()

    def _consume_stream(self, stream_name: str, priority: str):
        """
        Consumer loop pour un stream.
        """
        consumer_name = f"consumer_{os.getpid()}"

        while True:
            try:
                # Read events (blocking, timeout 5s)
                events = self.redis.xreadgroup(
                    self.consumer_group,
                    consumer_name,
                    {stream_name: ">"},  # Only new events
                    count=10,
                    block=5000
                )

                if not events:
                    continue

                for stream, messages in events:
                    for msg_id, msg_data in messages:
                        self._process_event(msg_data, msg_id, stream_name)

            except Exception as e:
                print(f"❌ Consumer error: {e}")
                time.sleep(1)

    def _process_event(self, msg_data: dict, msg_id: str, stream_name: str):
        """
        Traite un événement reçu.
        """
        event_type = msg_data.get(b"type", b"").decode()
        data = json.loads(msg_data.get(b"data", b"{}").decode())

        handlers = self.handlers.get(event_type, [])

        for handler in handlers:
            try:
                handler["func"]({"type": event_type, "data": data})
            except Exception as e:
                print(f"❌ Handler error for {event_type}: {e}")

        # Acknowledge event (won't be redelivered)
        self.redis.xack(stream_name, self.consumer_group, msg_id)


# ============================================================================
# USAGE: DECOUPLED AGENT COMMUNICATION
# ============================================================================

bus = NEMESISEventBus()

# ─────────────────────────────────────────────────────────────────────────────
# AGENT 1: Code Generator (Publisher)
# ─────────────────────────────────────────────────────────────────────────────

def code_generator_agent(request):
    """Génère du code et publie événement."""
    code = generate_code(request)

    # Publish event (ne sait PAS qui écoute)
    bus.publish("code_generated", {
        "code": code,
        "file_path": "auth/routes.py",
        "mission_id": request["mission_id"]
    })

    return code

# ─────────────────────────────────────────────────────────────────────────────
# AGENT 2: Test Generator (Subscriber)
# ─────────────────────────────────────────────────────────────────────────────

def on_code_generated_for_tests(event):
    """Réagit au code généré pour créer des tests."""
    code = event["data"]["code"]
    file_path = event["data"]["file_path"]

    tests = generate_tests(code)

    # Publish own event
    bus.publish("tests_generated", {
        "tests": tests,
        "for_file": file_path,
        "count": len(tests)
    })

bus.subscribe("code_generated", on_code_generated_for_tests)

# ─────────────────────────────────────────────────────────────────────────────
# AGENT 3: Security Specialist (Subscriber)
# ─────────────────────────────────────────────────────────────────────────────

def on_code_generated_for_security(event):
    """Réagit au code généré pour scan security."""
    code = event["data"]["code"]

    issues = scan_security(code)

    if issues:
        bus.publish("security_issues_found", {
            "issues": issues,
            "severity": max(i["severity"] for i in issues)
        }, priority="critical")  # High priority!
    else:
        bus.publish("security_passed", {
            "file": event["data"]["file_path"]
        })

bus.subscribe("code_generated", on_code_generated_for_security)

# ─────────────────────────────────────────────────────────────────────────────
# AGENT 4: Logger/Tracker (Subscriber to ALL)
# ─────────────────────────────────────────────────────────────────────────────

def log_all_events(event):
    """Logue tous les événements pour tracking."""
    timestamp = datetime.now().isoformat()
    print(f"📝 [{timestamp}] {event['type']}: {json.dumps(event['data'])[:100]}")

    # Also write to Google Sheets or DB
    update_tracking_sheet(event)

bus.subscribe("code_generated", log_all_events)
bus.subscribe("tests_generated", log_all_events)
bus.subscribe("security_issues_found", log_all_events)
bus.subscribe("security_passed", log_all_events)

# Start consuming
bus.start_consuming()
```

---

## 🔧 PATTERN 5: Circuit Breaker + Fallback Chain

```python
# ============================================================================
# CIRCUIT BREAKER WITH FALLBACK CHAIN
# Résilience: Si agent fail, fallback automatique
# ============================================================================

class CircuitBreaker:
    """
    Circuit breaker avec 3 états:
    - CLOSED: Normal operation
    - OPEN: Failing, reject requests (fail fast)
    - HALF_OPEN: Testing recovery
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 3,
        timeout: int = 30,
        half_open_max_calls: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.half_open_max_calls = half_open_max_calls

        self.state = self.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0

    def call(self, func, *args, **kwargs):
        """
        Exécute fonction protégée par circuit breaker.
        """
        if self.state == self.OPEN:
            if time.time() - self.last_failure_time > self.timeout:
                self.state = self.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitOpenError("Circuit breaker is OPEN")

        if self.state == self.HALF_OPEN:
            if self.half_open_calls >= self.half_open_max_calls:
                self.state = self.OPEN
                raise CircuitOpenError("Half-open test failed")
            self.half_open_calls += 1

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e

    def _on_success(self):
        if self.state == self.HALF_OPEN:
            self.state = self.CLOSED
        self.failure_count = 0

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN


class FallbackChain:
    """
    Chaîne de fallback: Si primary fail, essaie alternatives.
    """

    def __init__(self, name: str):
        self.name = name
        self.chain = []
        self.circuit_breakers = {}

    def add_step(
        self,
        func,
        name: str,
        failure_threshold: int = 3,
        timeout: int = 30
    ):
        """
        Ajoute une étape à la chaîne.
        Chaque étape a son propre circuit breaker.
        """
        self.chain.append({
            "func": func,
            "name": name
        })
        self.circuit_breakers[name] = CircuitBreaker(
            failure_threshold=failure_threshold,
            timeout=timeout
        )
        return self

    def execute(self, *args, **kwargs):
        """
        Exécute la chaîne: essaie chaque étape jusqu'à succès.
        """
        last_error = None

        for step in self.chain:
            breaker = self.circuit_breakers[step["name"]]

            try:
                result = breaker.call(step["func"], *args, **kwargs)
                print(f"✅ {self.name}: {step['name']} succeeded")
                return result

            except CircuitOpenError:
                print(f"⚡ {self.name}: {step['name']} circuit OPEN, skipping")
                continue

            except Exception as e:
                print(f"❌ {self.name}: {step['name']} failed: {e}")
                last_error = e
                continue

        raise FallbackExhaustedError(
            f"All fallbacks exhausted for {self.name}",
            last_error
        )


# ============================================================================
# USAGE: CODE GENERATION WITH FALLBACKS
# ============================================================================

code_gen_chain = FallbackChain("code_generation")

# Primary: Claude Opus (best quality, expensive)
code_gen_chain.add_step(
    func=lambda req: call_claude_opus(req),
    name="claude_opus",
    failure_threshold=3,
    timeout=60
)

# Fallback 1: Claude Sonnet (good quality, cheaper)
code_gen_chain.add_step(
    func=lambda req: call_claude_sonnet(req),
    name="claude_sonnet",
    failure_threshold=3,
    timeout=45
)

# Fallback 2: Claude Haiku (basic quality, cheapest)
code_gen_chain.add_step(
    func=lambda req: call_claude_haiku(req),
    name="claude_haiku",
    failure_threshold=5,
    timeout=30
)

# Fallback 3: Template-based (no API, always works)
code_gen_chain.add_step(
    func=lambda req: generate_from_template(req),
    name="template",
    failure_threshold=999,  # Never fails
    timeout=999
)

# Execute
try:
    code = code_gen_chain.execute(requirements="JWT authentication")
except FallbackExhaustedError:
    code = "# Unable to generate code. Please try again later."
```

---

## 🔧 PATTERN 6: Workflow Decomposition avec Numérotation

```yaml
# ============================================================================
# WORKFLOW NUMBERING & COLOR CODING SYSTEM
# Système de numérotation et couleurs pour tracking
# ============================================================================

WORKFLOW_STRUCTURE:

  # ─────────────────────────────────────────────────────────────────────────
  # MISSION LEVEL (M-YYYY-MM-DD-NNN)
  # ─────────────────────────────────────────────────────────────────────────

  Mission:
    ID_format: "M-{date}-{sequence}"
    Example: "M-2026-01-23-001"
    Contains: Multiple Workflows

  # ─────────────────────────────────────────────────────────────────────────
  # WORKFLOW LEVEL (WF-{type}-NNN)
  # ─────────────────────────────────────────────────────────────────────────

  Workflow:
    ID_format: "WF-{type}-{sequence}"
    Types:
      - INIT: Initialization workflows
      - EXEC: Execution workflows
      - EVAL: Evaluation workflows
      - FALL: Fallback workflows
    Example: "WF-EXEC-001"
    Contains: Multiple Steps

  # ─────────────────────────────────────────────────────────────────────────
  # STEP LEVEL ({color}{workflow}-{step})
  # ─────────────────────────────────────────────────────────────────────────

  Step:
    ID_format: "{color_code}{workflow_id}-{step_number}"
    Example: "🟢WF-INIT-001-01"

    Color_Codes:
      🟢: INPUT (Green)      # Parsing, analysis
      🟡: PLAN (Yellow)      # Orchestration, decomposition
      🔵: EXEC (Blue)        # Code generation, main work
      🟣: EVAL (Purple)      # Testing, review
      🔴: ERROR (Red)        # Failures, retries
      ⚪: WAIT (White)       # Pending, blocked
      🟠: FALL (Orange)      # Fallback execution


# ============================================================================
# EXAMPLE: COMPLETE MISSION BREAKDOWN
# ============================================================================

MISSION: "M-2026-01-23-001"
REQUEST: "Add JWT authentication to API"
STATUS: 🔄 IN_PROGRESS

WORKFLOWS:

  # ─────────────────────────────────────────────────────────────────────────
  WF-INIT-001: "Input Processing"
  # ─────────────────────────────────────────────────────────────────────────

  Steps:
    🟢WF-INIT-001-01:
      Name: "Request Parsing"
      Agent: "input_parser"
      Status: ✅ DONE
      Start: "2026-01-23T10:00:00Z"
      End: "2026-01-23T10:00:02Z"
      Duration: "2s"
      Output: {parsed_requirements: {...}}

    🟢WF-INIT-001-02:
      Name: "Context Enrichment"
      Agent: "context_analyzer"
      Status: ✅ DONE
      Start: "2026-01-23T10:00:02Z"
      End: "2026-01-23T10:00:05Z"
      Duration: "3s"
      Output: {enriched_context: {...}}

    🟢WF-INIT-001-03:
      Name: "Complexity Analysis"
      Agent: "complexity_scorer"
      Status: ✅ DONE
      Start: "2026-01-23T10:00:05Z"
      End: "2026-01-23T10:00:06Z"
      Duration: "1s"
      Output: {complexity_score: 0.65, path: "standard"}

  # ─────────────────────────────────────────────────────────────────────────
  WF-PLAN-001: "Task Planning"
  # ─────────────────────────────────────────────────────────────────────────

  Steps:
    🟡WF-PLAN-001-01:
      Name: "Goal Decomposition"
      Agent: "zeus_orchestrator"
      Status: ✅ DONE
      Start: "2026-01-23T10:00:06Z"
      End: "2026-01-23T10:00:10Z"
      Duration: "4s"
      Output:
        tasks:
          - {id: "T001", name: "User Model", agent: "code_generator"}
          - {id: "T002", name: "Password Utils", agent: "code_generator"}
          - {id: "T003", name: "JWT Utils", agent: "code_generator"}
          - {id: "T004", name: "Auth Routes", agent: "code_generator"}
          - {id: "T005", name: "Unit Tests", agent: "test_generator"}
        dependencies:
          T004: [T001, T002, T003]
          T005: [T004]
        parallel_groups:
          - [T001, T002, T003]  # Can run in parallel
          - [T004]              # Depends on group 1
          - [T005]              # Depends on group 2

    🟡WF-PLAN-001-02:
      Name: "Agent Selection"
      Agent: "zeus_orchestrator"
      Status: ✅ DONE
      Duration: "1s"
      Output: {assigned_agents: ["code_generator", "test_generator", "security"]}

  # ─────────────────────────────────────────────────────────────────────────
  WF-EXEC-001: "Code Generation"
  # ─────────────────────────────────────────────────────────────────────────

  Steps:
    # Parallel Group 1
    🔵WF-EXEC-001-01:
      Name: "Generate User Model"
      Agent: "code_generator"
      Task_ID: "T001"
      Status: ✅ DONE
      Duration: "15s"
      Output: {file: "models/user.py", lines: 45}
      Quality_Score: 9.2/10

    🔵WF-EXEC-001-02:
      Name: "Generate Password Utils"
      Agent: "code_generator"
      Task_ID: "T002"
      Status: ✅ DONE
      Duration: "12s"
      Output: {file: "utils/password.py", lines: 30}
      Quality_Score: 9.5/10

    🔵WF-EXEC-001-03:
      Name: "Generate JWT Utils"
      Agent: "code_generator"
      Task_ID: "T003"
      Status: ✅ DONE
      Duration: "18s"
      Output: {file: "utils/jwt.py", lines: 55}
      Quality_Score: 9.0/10

    # Sequential (depends on parallel group 1)
    🔵WF-EXEC-001-04:
      Name: "Generate Auth Routes"
      Agent: "code_generator"
      Task_ID: "T004"
      Status: 🔄 IN_PROGRESS
      Start: "2026-01-23T10:00:30Z"
      Dependencies_Met: ✅
      Progress: "60%"

  # ─────────────────────────────────────────────────────────────────────────
  WF-EVAL-001: "Quality Evaluation" (Not started yet)
  # ─────────────────────────────────────────────────────────────────────────

  Steps:
    ⚪WF-EVAL-001-01:
      Name: "Self Evaluation"
      Agent: "self_evaluator"
      Status: ⏸️ PENDING
      Waiting_For: "WF-EXEC-001 completion"

    ⚪WF-EVAL-001-02:
      Name: "Security Scan"
      Agent: "security_specialist"
      Status: ⏸️ PENDING

    ⚪WF-EVAL-001-03:
      Name: "Test Execution"
      Agent: "test_runner"
      Status: ⏸️ PENDING

  # ─────────────────────────────────────────────────────────────────────────
  WF-FALL-001: "Fallback Plans" (Defined but not triggered)
  # ─────────────────────────────────────────────────────────────────────────

  Trigger_Conditions:
    - "WF-EXEC-001 fails 3 times"
    - "Quality score < 7.0"
    - "Security issues CRITICAL"

  Plan_B:
    🟠WF-FALL-001-B01:
      Name: "Simplified Generation"
      Description: "Use simpler model with more constraints"
      Agent: "code_generator_simple"

  Plan_C:
    🟠WF-FALL-001-C01:
      Name: "Template-Based Generation"
      Description: "Use pre-built templates, fill in specifics"
      Agent: "template_engine"

  Plan_D:
    🟠WF-FALL-001-D01:
      Name: "Human Escalation"
      Description: "Ask user to provide more details or code themselves"
      Agent: "notification_agent"
```

---

## 📊 GOOGLE SHEETS STRUCTURE

```
# ============================================================================
# GOOGLE SHEETS DASHBOARD STRUCTURE
# Pour tracking visuel en temps réel
# ============================================================================

SPREADSHEET: "NEMESIS Mission Control"

SHEETS:

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 1: MISSIONS
# ─────────────────────────────────────────────────────────────────────────────

"📋 Missions":
  Columns:
    A: Mission_ID (M-YYYY-MM-DD-NNN)
    B: Request (user's original request)
    C: Status (🔄 / ✅ / ❌)
    D: Path (express / standard / advanced)
    E: Start_Time (ISO timestamp)
    F: End_Time
    G: Duration
    H: Quality_Score
    I: Cost_Estimate
    J: Agents_Used (comma-separated)
    K: Fallbacks_Triggered (Y/N)
    L: Notes

  Conditional_Formatting:
    Status_Column:
      "✅" → Green background
      "🔄" → Yellow background
      "❌" → Red background
    Quality_Score:
      ≥ 9.0 → Green
      ≥ 7.0 → Yellow
      < 7.0 → Red

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 2: WORKFLOW STEPS
# ─────────────────────────────────────────────────────────────────────────────

"🔄 Workflow Steps":
  Columns:
    A: Step_ID (🟢WF-INIT-001-01)
    B: Mission_ID (link to Missions sheet)
    C: Workflow_Type (INIT/PLAN/EXEC/EVAL/FALL)
    D: Step_Name
    E: Agent
    F: Status (⏸️ / 🔄 / ✅ / ❌)
    G: Start_Time
    H: End_Time
    I: Duration_Seconds
    J: Input_Summary
    K: Output_Summary
    L: Quality_Score
    M: Error_Message (if failed)

  Conditional_Formatting:
    Step_ID_Column:
      Starts with "🟢" → Green text
      Starts with "🟡" → Yellow text
      Starts with "🔵" → Blue text
      Starts with "🟣" → Purple text
      Starts with "🔴" → Red text

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 3: AGENT PERFORMANCE
# ─────────────────────────────────────────────────────────────────────────────

"🤖 Agent Performance":
  Columns:
    A: Agent_Name
    B: Total_Calls
    C: Success_Count
    D: Failure_Count
    E: Success_Rate (formula)
    F: Avg_Duration_Seconds
    G: Total_Cost
    H: Avg_Quality_Score
    I: Last_Used
    J: Status (🟢 Active / 🟡 Idle / 🔴 Circuit Open)

  Charts:
    - Bar chart: Success rate by agent
    - Line chart: Avg duration over time
    - Pie chart: Call distribution

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 4: PATTERNS LEARNED
# ─────────────────────────────────────────────────────────────────────────────

"💡 Patterns":
  Columns:
    A: Pattern_ID (P-001)
    B: Pattern_Name (e.g., "JWT_Auth_FastAPI")
    C: Domain (auth / database / api / testing)
    D: Times_Used
    E: Success_Rate
    F: Last_Used
    G: Template_Link (link to stored template)
    H: Tags

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 5: ERROR LOG
# ─────────────────────────────────────────────────────────────────────────────

"❌ Errors":
  Columns:
    A: Timestamp
    B: Mission_ID
    C: Step_ID
    D: Agent
    E: Error_Type
    F: Error_Message
    G: Stack_Trace (truncated)
    H: Fallback_Triggered
    I: Resolution

# ─────────────────────────────────────────────────────────────────────────────
# SHEET 6: CACHE STATS
# ─────────────────────────────────────────────────────────────────────────────

"📦 Cache Stats":
  Columns:
    A: Date
    B: L1_Hits
    C: L2_Hits
    D: L3_Hits
    E: Misses
    F: Hit_Rate
    G: Estimated_Savings (API calls avoided)
    H: Estimated_Cost_Saved
```

---

## 🛠️ TOOLS TO BORROW FROM COMMUNITY

```yaml
# ============================================================================
# FRAMEWORKS & LIBRARIES TO USE
# ============================================================================

ORCHESTRATION:

  Temporal.io:
    What: "Workflow orchestration engine"
    Why: "Handles retries, timeouts, state persistence natively"
    Use_For: "Complex multi-step workflows"
    Alternative: "Prefect, Apache Airflow (simpler)"

  LangGraph:
    What: "LLM agent workflow framework"
    Why: "Built for agent orchestration, state management"
    Use_For: "Agent communication patterns"

  Crew AI:
    What: "Multi-agent orchestration"
    Why: "Already mentioned - good for agent collaboration"
    Use_For: "Specialized agent teams"

RESILIENCE:

  Tenacity:
    What: "Python retry library"
    Why: "Exponential backoff, jitter, configurable"
    Install: "pip install tenacity"
    Example: |
      @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=60),
        retry=retry_if_exception_type(APIError)
      )
      def call_agent(request):
          return agent.execute(request)

  PyBreaker:
    What: "Circuit breaker implementation"
    Why: "Production-ready, well-tested"
    Install: "pip install pybreaker"

  Polly (if using .NET):
    What: "Resilience and transient-fault-handling"
    Why: "Industry standard for resilience patterns"

CACHING:

  CacheTools:
    What: "Caching utilities for Python"
    Why: "LRU, TTL, LFU caches built-in"
    Install: "pip install cachetools"

  DiskCache:
    What: "Disk-based cache"
    Why: "Persistent, larger capacity than memory"
    Install: "pip install diskcache"

  Redis:
    What: "In-memory data store"
    Why: "Fast, shared across processes, pub/sub"
    Use_For: "L2 cache, event bus"

MONITORING:

  Prometheus + Grafana:
    What: "Metrics collection + visualization"
    Why: "Industry standard, powerful dashboards"
    Use_For: "Real-time monitoring, alerting"

  OpenTelemetry:
    What: "Distributed tracing"
    Why: "Trace requests across agents"
    Use_For: "Debug complex workflows"

WORKFLOW AUTOMATION:

  N8N:
    What: "Workflow automation tool"
    Why: "Visual, extensible, self-hosted"
    Use_For: "Connecting services, triggers"

  Make (Integromat):
    What: "No-code automation"
    Why: "Great API integrations"
    Use_For: "Third-party integrations"

  Dify:
    What: "LLM application platform"
    Why: "RAG, agent building, workflows"
    Use_For: "Knowledge base, agent conversations"

KNOWLEDGE BASE:

  Chroma / Pinecone / Weaviate:
    What: "Vector databases"
    Why: "Semantic search for patterns/similar requests"
    Use_For: "Finding similar past missions"

  LlamaIndex:
    What: "Data framework for LLM apps"
    Why: "Easy RAG implementation"
    Use_For: "Knowledge base queries"
```

---

## 🎯 FINAL ARCHITECTURE: NEMESIS LIGHTWEIGHT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEMESIS LIGHTWEIGHT ARCHITECTURE                          │
│                         "Mastodonte → Souris"                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USER REQUEST                                 │   │
│  └─────────────────────────────────┬───────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SMART ROUTER                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │   │
│  │  │ EXPRESS  │  │ STANDARD │  │ ADVANCED │                           │   │
│  │  │  <0.3    │  │ 0.3-0.7  │  │  >0.7    │                           │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │   │
│  └───────┼─────────────┼─────────────┼─────────────────────────────────┘   │
│          │             │             │                                      │
│          ▼             ▼             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LAZY AGENT POOL                                   │   │
│  │                                                                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Active  │ │ Active  │ │  Lazy   │ │  Lazy   │ │  Lazy   │ ...   │   │
│  │  │ Agent 1 │ │ Agent 2 │ │   ---   │ │   ---   │ │   ---   │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │                                                                      │   │
│  │  Only 2-5 agents active at any time (not 50!)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    EVENT BUS (Redis)                                 │   │
│  │                                                                      │   │
│  │  Events flow between agents without direct coupling                  │   │
│  │  Parallel processing, replay, debugging                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MULTI-LEVEL CACHE                                 │   │
│  │                                                                      │   │
│  │  L1 (Memory)  →  L2 (Redis)  →  L3 (SQLite)                         │   │
│  │    <1ms            <10ms          <100ms                             │   │
│  │                                                                      │   │
│  │  80%+ hit rate = massive cost/time savings                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CIRCUIT BREAKER + FALLBACK                        │   │
│  │                                                                      │   │
│  │  Primary (Opus) → Fallback 1 (Sonnet) → Fallback 2 (Haiku)         │   │
│  │  → Fallback 3 (Template) → Escalate to User                         │   │
│  │                                                                      │   │
│  │  Never completely fails, always degrades gracefully                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GOOGLE SHEETS DASHBOARD                           │   │
│  │                                                                      │   │
│  │  Real-time visibility: Missions, Steps, Agents, Errors, Patterns    │   │
│  │  Color-coded, auto-updated via N8N webhooks                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PERFORMANCE GAINS:                                                         │
│  ═══════════════════                                                        │
│  • Startup: 30s → 0.1s (lazy loading)                                       │
│  • Express requests: 5s → 0.5s (skip layers)                               │
│  • Memory: 2GB → 200MB (lazy agents)                                        │
│  • API calls: 70 → 15 per mission (cache + smart routing)                  │
│  • Cost: $3.50 → $0.80 per mission                                         │
│  • Reliability: 95% → 99.9% (circuit breakers + fallbacks)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

```markdown
## Phase 1: Core Infrastructure (Semaine 1-2)

- [ ] Setup Redis (docker-compose)
- [ ] Implement MultiLevelCache
- [ ] Implement SmartWorkflowRouter
- [ ] Implement LazyAgentPool
- [ ] Setup Google Sheets dashboard

## Phase 2: Resilience (Semaine 3)

- [ ] Implement CircuitBreaker
- [ ] Implement FallbackChain
- [ ] Add Tenacity retries to all API calls
- [ ] Configure timeouts everywhere

## Phase 3: Event-Driven (Semaine 4)

- [ ] Implement NEMESISEventBus
- [ ] Migrate agents to event-based communication
- [ ] Add event logging

## Phase 4: Optimization (Semaine 5-6)

- [ ] Profile and identify bottlenecks
- [ ] Tune cache TTLs based on hit rates
- [ ] Optimize agent warmup
- [ ] Add parallel execution where possible

## Phase 5: Monitoring (Semaine 7)

- [ ] Setup Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Configure alerts
- [ ] Add distributed tracing

## Ongoing: Measure & Iterate

- [ ] Track hit rates, latencies, costs weekly
- [ ] A/B test different routing strategies
- [ ] Gradually add agents as needed (not all at once)
```
