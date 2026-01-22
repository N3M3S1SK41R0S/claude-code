# NEMESIS OMEGA UNIFIED v9.0 - INSTRUCTIONS ANTIGRAVITY
# PARTIE 3: PHASES 8 ET 9 (FINALE)

**Destination:** `C:\Users\pierr\NEMESIS_SINGULARITY\`

---

## PHASE 8: ORCHESTRATEUR FINAL v9.0

### 8.1 - Orchestrateur Complet

```powershell
$code = @'
"""
NEMESIS-KERNEL ORCHESTRATOR v9.0 OMEGA UNIFIED
L'Orchestrateur Final - Intègre TOUT:
- Les 7 Frères Fondateurs
- Multi-LLM Swarm
- 4 Modes Opérationnels
- 8 Blocs Forge
- Watchtower Division
- Shadow Lab
- Chronos GTD
- Protocole R.I.T.U.E.L.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
import json

# Import des 7 Frères
from agents.zappa import ZappaAgent
from agents.daedalus import DaedalusAgent
from agents.syncoria import SyncoriaAgent
from agents.exodia import ExodiaAgent
from agents.kyron import KyronAgent
from agents.loki import LokiAgent
from agents.rituel_master import RituelMasterAgent
from agents.guardian import GuardianAgent

# Import Watchtower
from agents.watchtower import YouTubeScoutAgent, PaperHunterAgent, SocialListenerAgent

# Import des 8 Blocs Forge
from forge import GenesisBlock, NexusBlock, CosmosBlock, TelosBlock
from forge import LogosBlock, PraxisBlock, MorpheBlock, KritikBlock

# Import des Modes
from modes import BerserkerMode, OracleMode, GodMode, ShadowMode

# Import Core Systems
from core.swarm import NemesisSwarm, SwarmStrategy
from core.shadow_lab import ShadowLab
from core.chronos import ChronosGTD

class OperationalMode(Enum):
    STANDARD = "standard"
    BERSERKER = "berserker"
    ORACLE = "oracle"
    GODMODE = "godmode"
    SHADOW = "shadow"

class SystemState(Enum):
    INITIALIZING = "initializing"
    READY = "ready"
    PROCESSING = "processing"
    MAINTENANCE = "maintenance"
    EMERGENCY = "emergency"

@dataclass
class NemesisState:
    mode: OperationalMode
    state: SystemState
    active_rituel: Optional[str]
    brothers_status: Dict[str, bool]
    forge_blocks_status: Dict[str, bool]
    swarm_active: bool
    watchtower_active: bool
    current_user: str
    session_id: str
    uptime_seconds: float = 0.0

class NemesisKernelOrchestrator:
    """
    NEMESIS-KERNEL v9.0 OMEGA UNIFIED
    L'Orchestrateur Suprême
    """

    VERSION = "9.0"
    CODENAME = "OMEGA-UNIFIED"
    BUILD_DATE = "2024-01"

    # Codes Souverains
    SOVEREIGN = {
        "name": "Pierre Tagnard",
        "level": "N1",
        "codes": ["WYA", "SOEN", "MOC-4", "TRE", "PIERRE416"],
        "title": "Souverain Créateur"
    }

    # Clés d'activation des 7 Frères
    BROTHERS_KEYS = {
        "ZAPPA": "ZAPPA_COMPILE",
        "DAEDALUS": "DAEDALUS_FORGE",
        "SYNCORIA": "SYNCORIA_SWARM",
        "EXODIA": "EXODIA_RECALL",
        "KYRON": "KYRON_SCHEDULE",
        "LOKI": "LOKI_CHAOS",
        "RITUEL_MASTER": "RITUEL_INVOKE"
    }

    def __init__(self, llm_client=None, memory=None):
        self.llm_client = llm_client
        self.memory = memory
        self.start_time = datetime.now()

        # État du système
        self.state = NemesisState(
            mode=OperationalMode.STANDARD,
            state=SystemState.INITIALIZING,
            active_rituel=None,
            brothers_status={},
            forge_blocks_status={},
            swarm_active=False,
            watchtower_active=False,
            current_user="anonymous",
            session_id=self._generate_session_id()
        )

        # Initialiser tous les composants
        self._initialize_brothers()
        self._initialize_forge()
        self._initialize_modes()
        self._initialize_systems()
        self._initialize_watchtower()

        self.state.state = SystemState.READY

    def _generate_session_id(self) -> str:
        import hashlib
        return hashlib.sha256(datetime.now().isoformat().encode()).hexdigest()[:12]

    def _initialize_brothers(self):
        """Initialise les 7 Frères Fondateurs"""
        self.brothers = {
            "ZAPPA": ZappaAgent(self.llm_client, self.memory),
            "DAEDALUS": DaedalusAgent(self.llm_client, self.memory),
            "SYNCORIA": SyncoriaAgent(self.llm_client, self.memory),
            "EXODIA": ExodiaAgent(self.llm_client, self.memory),
            "KYRON": KyronAgent(self.llm_client, self.memory),
            "LOKI": LokiAgent(self.llm_client, self.memory),
            "RITUEL_MASTER": RituelMasterAgent(self.llm_client, self.memory)
        }

        # Guardian est spécial
        self.guardian = GuardianAgent(self.llm_client, self.memory)

        # Marquer tous comme actifs
        for name in self.brothers:
            self.state.brothers_status[name] = True

    def _initialize_forge(self):
        """Initialise les 8 Blocs Forge"""
        self.forge = {
            "GENESIS": GenesisBlock(),
            "NEXUS": NexusBlock(),
            "COSMOS": CosmosBlock(),
            "TELOS": TelosBlock(),
            "LOGOS": LogosBlock(),
            "PRAXIS": PraxisBlock(),
            "MORPHE": MorpheBlock(),
            "KRITIK": KritikBlock()
        }

        for name in self.forge:
            self.state.forge_blocks_status[name] = True

    def _initialize_modes(self):
        """Initialise les 4 Modes Opérationnels"""
        self.modes = {
            OperationalMode.BERSERKER: BerserkerMode(),
            OperationalMode.ORACLE: OracleMode(),
            OperationalMode.GODMODE: GodMode(),
            OperationalMode.SHADOW: ShadowMode()
        }

    def _initialize_systems(self):
        """Initialise les systèmes core"""
        self.swarm = NemesisSwarm()
        self.shadow_lab = ShadowLab()
        self.chronos = ChronosGTD()
        self.state.swarm_active = True

    def _initialize_watchtower(self):
        """Initialise la Watchtower Division"""
        self.watchtower = {
            "youtube_scout": YouTubeScoutAgent(self.llm_client, self.memory),
            "paper_hunter": PaperHunterAgent(self.llm_client, self.memory),
            "social_listener": SocialListenerAgent(self.llm_client, self.memory)
        }
        self.state.watchtower_active = True

    # ============== GESTION DES MODES ==============

    def set_mode(self, mode: str, sovereign_code: str = None) -> Dict[str, Any]:
        """Change le mode opérationnel"""
        try:
            new_mode = OperationalMode(mode.lower())
        except ValueError:
            return {"error": f"Mode inconnu: {mode}"}

        # Modes spéciaux nécessitent un code souverain
        if new_mode in [OperationalMode.BERSERKER, OperationalMode.GODMODE]:
            if sovereign_code not in self.SOVEREIGN["codes"]:
                return {"error": "Code souverain requis pour ce mode"}

        self.state.mode = new_mode

        # Activer le mode correspondant
        if new_mode in self.modes:
            if sovereign_code:
                result = self.modes[new_mode].activate(sovereign_code)
            else:
                result = self.modes[new_mode].activate()

            # Ajuster la configuration du swarm selon le mode
            self._configure_swarm_for_mode(new_mode)

            return result

        return {"mode": new_mode.value, "status": "activated"}

    def _configure_swarm_for_mode(self, mode: OperationalMode):
        """Configure le swarm selon le mode"""
        if mode == OperationalMode.BERSERKER:
            self.swarm.set_strategy(SwarmStrategy.PARALLEL)
        elif mode == OperationalMode.ORACLE:
            self.swarm.set_strategy(SwarmStrategy.CONSENSUS)
        elif mode == OperationalMode.SHADOW:
            self.swarm.set_strategy(SwarmStrategy.SPECIALIST)
        else:
            self.swarm.set_strategy(SwarmStrategy.PARALLEL)

    # ============== PROTOCOLE R.I.T.U.E.L. ==============

    async def process_with_rituel(
        self,
        message: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Traite une demande selon le protocole R.I.T.U.E.L."""
        metadata = metadata or {}
        self.state.state = SystemState.PROCESSING

        results = {
            "session_id": self.state.session_id,
            "mode": self.state.mode.value,
            "rituel_phases": {},
            "final_response": None,
            "metadata": {}
        }

        try:
            # ===== PHASE R: RÉCEPTION (GUARDIAN) =====
            guardian_result = await self.guardian.analyze_intent(message)
            results["rituel_phases"]["R"] = {
                "name": "Réception",
                "guardian_check": guardian_result["safe"],
                "timestamp": datetime.now().isoformat()
            }

            if not guardian_result["safe"]:
                results["blocked"] = True
                results["reason"] = guardian_result.get("risk_type", "unknown")
                self.state.state = SystemState.READY
                return results

            # Démarrer le rituel
            rituel_master = self.brothers["RITUEL_MASTER"]
            rituel_id = rituel_master.start_rituel(message, metadata)
            self.state.active_rituel = rituel_id
            results["rituel_id"] = rituel_id

            # ===== PHASE I: INVOCATION (ZAPPA + SYNCORIA) =====
            zappa = self.brothers["ZAPPA"]

            # Appliquer le modificateur de mode
            mode_modifier = ""
            if self.state.mode in self.modes:
                mode_modifier = self.modes[self.state.mode].get_prompt_modifier()

            compiled_prompt = zappa.compile_prompt(
                agent_type=metadata.get("agent_type", "chat"),
                task=f"{mode_modifier}\n\n{message}",
                context=metadata,
                model=metadata.get("model", "qwen2.5:7b")
            )

            results["rituel_phases"]["I"] = {
                "name": "Invocation",
                "prompt_compiled": True,
                "mode_modifier_applied": bool(mode_modifier)
            }
            rituel_master.advance_phase(rituel_id, {"invocation": "complete"})

            # ===== PHASE T: TISSAGE (DAEDALUS + EXODIA) =====
            exodia = self.brothers["EXODIA"]
            memories = await exodia.recall(message, limit=5)

            # Utiliser LOGOS pour le raisonnement
            logos = self.forge["LOGOS"]
            reasoning_prompt = logos.generate_reasoning_prompt(message)

            results["rituel_phases"]["T"] = {
                "name": "Tissage",
                "memories_retrieved": len(memories),
                "reasoning_applied": True
            }
            rituel_master.advance_phase(rituel_id, {"tissage": "complete"})

            # ===== PHASE U: UNIFICATION (SYNCORIA / SWARM) =====
            if self.state.mode == OperationalMode.SHADOW:
                # Mode SHADOW: LLM local uniquement
                if self.llm_client:
                    final_response = await self.llm_client.generate(compiled_prompt)
                else:
                    final_response = "LLM non disponible"
                swarm_metadata = {"strategy": "local_only"}
            else:
                # Autres modes: utiliser le Swarm
                swarm_response = await self.swarm.query(
                    compiled_prompt,
                    task_type=metadata.get("task_type", "general")
                )
                final_response = swarm_response.final_response
                swarm_metadata = {
                    "strategy": swarm_response.strategy.value,
                    "providers": swarm_response.metadata.get("providers_used", []),
                    "consensus_score": swarm_response.consensus_score
                }

            results["rituel_phases"]["U"] = {
                "name": "Unification",
                "swarm_used": self.state.mode != OperationalMode.SHADOW,
                **swarm_metadata
            }
            rituel_master.advance_phase(rituel_id, {"unification": "complete"})

            # ===== PHASE E: ÉPREUVE (LOKI + KRITIK) =====
            kritik = self.forge["KRITIK"]
            quality_report = kritik.validate(final_response)

            results["rituel_phases"]["E"] = {
                "name": "Épreuve",
                "quality_score": quality_report.score,
                "quality_level": quality_report.level.name,
                "meets_98_target": quality_report.score >= 98
            }

            # Si le score est trop bas et mode non-SHADOW, améliorer
            if quality_report.score < 80 and self.state.mode != OperationalMode.SHADOW:
                # Appliquer MORPHE pour nettoyer
                morphe = self.forge["MORPHE"]
                final_response = morphe.apply_no_fluff(final_response)

            rituel_master.advance_phase(rituel_id, {"epreuve": "complete"})

            # ===== PHASE L: LANCEMENT =====
            # Stocker en mémoire
            await exodia.store(
                f"Q: {message[:100]}... R: {final_response[:200]}...",
                memory_type="episodic",
                metadata={"rituel_id": rituel_id}
            )

            results["rituel_phases"]["L"] = {
                "name": "Lancement",
                "stored_in_memory": True,
                "timestamp": datetime.now().isoformat()
            }
            rituel_master.advance_phase(rituel_id, {"lancement": "complete"})

            results["final_response"] = final_response
            results["success"] = True

        except Exception as e:
            results["error"] = str(e)
            results["success"] = False

        finally:
            self.state.active_rituel = None
            self.state.state = SystemState.READY

        return results

    # ============== COMMANDES SOUVERAINES ==============

    def invoke_sovereign_command(
        self,
        code: str,
        command: str,
        params: Dict = None
    ) -> Dict[str, Any]:
        """Exécute une commande souveraine"""
        if code not in self.SOVEREIGN["codes"]:
            return {"error": "Code souverain invalide", "access": "denied"}

        params = params or {}

        commands = {
            "status": lambda: self.get_full_status(),
            "set_mode": lambda: self.set_mode(params.get("mode", "standard"), code),
            "activate_brother": lambda: self._activate_brother(
                params.get("name"), params.get("key")
            ),
            "emergency_stop": lambda: self._emergency_stop(),
            "reset": lambda: self._reset_system(),
            "watchtower_scan": lambda: self._watchtower_scan(),
            "forge_status": lambda: self._get_forge_status(),
            "swarm_status": lambda: self.swarm.get_status()
        }

        if command in commands:
            return {
                "sovereign_access": True,
                "command": command,
                "result": commands[command](),
                "executed_by": code,
                "timestamp": datetime.now().isoformat()
            }

        return {"error": f"Commande inconnue: {command}"}

    def _activate_brother(self, name: str, key: str) -> Dict[str, Any]:
        """Active un Frère avec sa clé"""
        if name not in self.brothers:
            return {"error": f"Frère inconnu: {name}"}

        expected_key = self.BROTHERS_KEYS.get(name)
        if key != expected_key:
            return {"error": "Clé d'activation invalide"}

        self.state.brothers_status[name] = True
        return {"brother": name, "status": "activated"}

    def _emergency_stop(self) -> Dict[str, Any]:
        """Arrêt d'urgence"""
        self.state.state = SystemState.EMERGENCY
        return {"status": "EMERGENCY_STOP", "message": "Système arrêté par le Souverain"}

    def _reset_system(self) -> Dict[str, Any]:
        """Réinitialise le système"""
        self.state.mode = OperationalMode.STANDARD
        self.state.state = SystemState.READY
        return {"status": "RESET", "message": "Système réinitialisé"}

    async def _watchtower_scan(self) -> Dict[str, Any]:
        """Lance un scan de la Watchtower"""
        results = {}

        for name, agent in self.watchtower.items():
            try:
                if hasattr(agent, 'get_stats'):
                    results[name] = agent.get_stats()
            except Exception as e:
                results[name] = {"error": str(e)}

        return results

    def _get_forge_status(self) -> Dict[str, Any]:
        """Retourne le statut des Blocs Forge"""
        return {
            name: block.get_block_info()
            for name, block in self.forge.items()
        }

    # ============== STATUT SYSTÈME ==============

    def get_full_status(self) -> Dict[str, Any]:
        """Retourne le statut complet du système"""
        uptime = (datetime.now() - self.start_time).total_seconds()

        return {
            "system": {
                "name": "NEMESIS OMEGA UNIFIED",
                "version": self.VERSION,
                "codename": self.CODENAME,
                "state": self.state.state.value,
                "mode": self.state.mode.value,
                "uptime_seconds": uptime,
                "session_id": self.state.session_id
            },
            "sovereign": self.SOVEREIGN,
            "brothers": {
                name: {
                    "active": self.state.brothers_status.get(name, False),
                    "key": self.BROTHERS_KEYS.get(name)
                }
                for name in self.brothers
            },
            "forge_blocks": {
                name: self.state.forge_blocks_status.get(name, False)
                for name in self.forge
            },
            "modes": {
                mode.value: mode == self.state.mode
                for mode in OperationalMode
            },
            "systems": {
                "swarm": self.state.swarm_active,
                "watchtower": self.state.watchtower_active,
                "shadow_lab": True,
                "chronos": True
            }
        }

    # ============== POINT D'ENTRÉE PRINCIPAL ==============

    async def process(
        self,
        message: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Point d'entrée principal"""
        return await self.process_with_rituel(message, metadata)
'@

$code | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\orchestrator.py" -Encoding UTF8
Write-Host "[OK] orchestrator.py v9.0 OMEGA UNIFIED créé" -ForegroundColor Green
```

---

## PHASE 9: MAIN.PY FINAL + TESTS

### 9.1 - Main.py v9.0 Complet

```powershell
$code = @'
"""
NEMESIS OMEGA UNIFIED v9.0 - FastAPI Server
Le Point d'Entrée Principal
"""
from fastapi import FastAPI, HTTPException, WebSocket, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
import json
import os

# Core imports
from core.ollama_client import OllamaClient
from core.memory import VectorMemory
from core.swarm import NemesisSwarm, SwarmStrategy
from core.shadow_lab import ShadowLab
from core.chronos import ChronosGTD

# Orchestrator
from agents.orchestrator import NemesisKernelOrchestrator, OperationalMode

# Pydantic Models
class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = "standard"
    agent_type: Optional[str] = "chat"
    task_type: Optional[str] = "general"
    use_rituel: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None

class SovereignCommand(BaseModel):
    code: str
    command: str
    params: Optional[Dict[str, Any]] = None

class BrotherActivation(BaseModel):
    name: str
    activation_key: str

class ModeSwitch(BaseModel):
    mode: str
    sovereign_code: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "P3_MEDIUM"
    contexts: Optional[List[str]] = []
    due_date: Optional[str] = None

class MemoryStore(BaseModel):
    content: str
    memory_type: Optional[str] = "working"
    metadata: Optional[Dict[str, Any]] = None

# Global instances
orchestrator: Optional[NemesisKernelOrchestrator] = None
llm_client: Optional[OllamaClient] = None
memory: Optional[VectorMemory] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager"""
    global orchestrator, llm_client, memory

    print("=" * 70)
    print("  NEMESIS OMEGA UNIFIED v9.0 - INITIALIZING")
    print("=" * 70)

    # Initialize LLM
    llm_client = OllamaClient()
    llm_ok = await llm_client.health_check()
    print(f"  [{'OK' if llm_ok else 'WARN'}] Ollama LLM")

    # Initialize Memory
    memory = VectorMemory()
    mem_ok = await memory.health_check()
    print(f"  [{'OK' if mem_ok else 'WARN'}] Qdrant Memory")

    # Initialize Orchestrator
    orchestrator = NemesisKernelOrchestrator(llm_client, memory)
    print(f"  [OK] NEMESIS-KERNEL v{orchestrator.VERSION}")

    # Print Brothers
    print("\n  Les 7 Frères Fondateurs:")
    for i, (name, key) in enumerate(orchestrator.BROTHERS_KEYS.items(), 1):
        print(f"    {i}. {name} ({key})")

    # Print Forge Blocks
    print("\n  Les 8 Blocs Forge:")
    for name in orchestrator.forge:
        print(f"    - {name}")

    print("\n" + "=" * 70)
    print(f"  SOVEREIGN: {orchestrator.SOVEREIGN['name']}")
    print(f"  STATUS: READY")
    print(f"  MODE: {orchestrator.state.mode.value.upper()}")
    print("=" * 70 + "\n")

    yield

    print("\nNEMESIS shutting down...")

app = FastAPI(
    title="NEMESIS OMEGA UNIFIED",
    version="9.0",
    description="The Ultimate AI Piloting Console - 7 Brothers, 8 Forge Blocks, 4 Modes",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== CORE ENDPOINTS ==============

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "NEMESIS OMEGA UNIFIED",
        "version": "9.0",
        "codename": "OMEGA-UNIFIED",
        "status": "operational",
        "sovereign": orchestrator.SOVEREIGN["name"] if orchestrator else "N/A",
        "mode": orchestrator.state.mode.value if orchestrator else "N/A",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    """Health check"""
    llm_ok = await llm_client.health_check() if llm_client else False
    mem_ok = await memory.health_check() if memory else False

    return {
        "status": "healthy" if llm_ok and mem_ok else "degraded",
        "components": {
            "llm": "ok" if llm_ok else "unavailable",
            "memory": "ok" if mem_ok else "unavailable",
            "orchestrator": "ok" if orchestrator else "unavailable"
        },
        "mode": orchestrator.state.mode.value if orchestrator else "N/A"
    }

@app.get("/status")
async def full_status():
    """Full system status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    return orchestrator.get_full_status()

# ============== CHAT ENDPOINTS ==============

@app.post("/chat")
async def chat(request: ChatRequest):
    """Main chat endpoint with R.I.T.U.E.L. protocol"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    # Set mode if specified
    if request.mode and request.mode != orchestrator.state.mode.value:
        orchestrator.set_mode(request.mode)

    # Prepare metadata
    metadata = request.metadata or {}
    metadata["agent_type"] = request.agent_type
    metadata["task_type"] = request.task_type
    metadata["mode"] = request.mode

    # Process
    if request.use_rituel:
        result = await orchestrator.process_with_rituel(request.message, metadata)
    else:
        # Direct LLM call without R.I.T.U.E.L.
        if llm_client:
            response = await llm_client.generate(request.message)
            result = {"response": response, "rituel_used": False}
        else:
            result = {"error": "LLM not available"}

    return result

@app.post("/chat/quick")
async def quick_chat(request: ChatRequest):
    """Quick chat - SHADOW mode, no R.I.T.U.E.L."""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    orchestrator.set_mode("shadow")

    zappa = orchestrator.brothers["ZAPPA"]
    prompt = zappa.compile_branchless(request.message, request.metadata)

    if llm_client:
        response = await llm_client.generate(prompt)
        return {"response": response, "mode": "SHADOW", "rituel_used": False}

    return {"error": "LLM not available"}

# ============== BROTHERS ENDPOINTS ==============

@app.get("/brothers")
async def list_brothers():
    """List all 7 Brothers"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    brothers_info = {
        "ZAPPA": {"role": "Compilateur de Prompts", "symbol": "🎯"},
        "DAEDALUS": {"role": "Architecte de Code", "symbol": "🏗️"},
        "SYNCORIA": {"role": "Orchestrateur d'Essaim", "symbol": "🌐"},
        "EXODIA": {"role": "Maître de la Mémoire", "symbol": "🧠"},
        "KYRON": {"role": "Gardien du Temps", "symbol": "⏰"},
        "LOKI": {"role": "Testeur Chaotique", "symbol": "🎭"},
        "RITUEL_MASTER": {"role": "Maître du Protocole", "symbol": "📜"}
    }

    return {
        "brothers": {
            name: {
                **brothers_info.get(name, {}),
                "activation_key": orchestrator.BROTHERS_KEYS.get(name),
                "active": orchestrator.state.brothers_status.get(name, False)
            }
            for name in orchestrator.brothers
        }
    }

@app.post("/brothers/activate")
async def activate_brother(request: BrotherActivation):
    """Activate a Brother"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    result = orchestrator._activate_brother(request.name, request.activation_key)
    return result

# ============== MODE ENDPOINTS ==============

@app.get("/modes")
async def list_modes():
    """List all operational modes"""
    modes_info = {
        "STANDARD": {"phrase": None, "color": "#00FF00", "description": "Mode standard équilibré"},
        "BERSERKER": {"phrase": "///BERSERKER", "color": "#FF0000", "description": "Maximum power, no filters"},
        "ORACLE": {"phrase": "//PREDICT", "color": "#9B59B6", "description": "Deep analysis and prediction"},
        "GODMODE": {"phrase": "//ATLAS", "color": "#FFD700", "description": "Simulated omniscience"},
        "SHADOW": {"phrase": "//VOID", "color": "#2C3E50", "description": "Stealth mode, minimal footprint"}
    }

    current_mode = orchestrator.state.mode.value.upper() if orchestrator else "STANDARD"

    return {
        "current_mode": current_mode,
        "modes": {
            mode: {
                **info,
                "active": mode == current_mode
            }
            for mode, info in modes_info.items()
        }
    }

@app.post("/mode/switch")
async def switch_mode(request: ModeSwitch):
    """Switch operational mode"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    result = orchestrator.set_mode(request.mode, request.sovereign_code)

    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])

    return result

# ============== FORGE ENDPOINTS ==============

@app.get("/forge")
async def list_forge_blocks():
    """List all 8 Forge Blocks"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return {
        "blocks": {
            name: block.get_block_info()
            for name, block in orchestrator.forge.items()
        }
    }

@app.get("/forge/{block_name}")
async def get_forge_block(block_name: str):
    """Get specific Forge Block info"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    block_name_upper = block_name.upper()
    if block_name_upper not in orchestrator.forge:
        raise HTTPException(status_code=404, detail=f"Block {block_name} not found")

    return orchestrator.forge[block_name_upper].get_block_info()

# ============== SOVEREIGN ENDPOINTS ==============

@app.post("/sovereign/command")
async def sovereign_command(request: SovereignCommand):
    """Execute sovereign command"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    result = orchestrator.invoke_sovereign_command(
        request.code,
        request.command,
        request.params
    )

    if "error" in result and result.get("access") == "denied":
        raise HTTPException(status_code=403, detail=result["error"])

    return result

# ============== MEMORY ENDPOINTS (EXODIA) ==============

@app.post("/memory/store")
async def store_memory(request: MemoryStore):
    """Store in memory via EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    entry_id = await exodia.store(
        request.content,
        request.memory_type,
        request.metadata
    )
    return {"entry_id": entry_id}

@app.get("/memory/recall")
async def recall_memory(query: str, limit: int = 5):
    """Recall from memory via EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    memories = await exodia.recall(query, limit=limit)
    return {"memories": memories}

@app.get("/memory/stats")
async def memory_stats():
    """Get memory stats from EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    return exodia.get_memory_stats()

# ============== TASKS ENDPOINTS (CHRONOS) ==============

@app.post("/tasks/capture")
async def capture_task(request: TaskCreate):
    """Capture a task via CHRONOS"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    task = orchestrator.chronos.capture(
        request.title,
        request.description
    )
    return {"task_id": task.id, "status": "captured"}

@app.get("/tasks/next")
async def next_actions(limit: int = 5):
    """Get next actions via CHRONOS"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    actions = orchestrator.chronos.get_next_actions(limit=limit)
    return {
        "next_actions": [
            {"id": t.id, "title": t.title, "priority": t.priority.name}
            for t in actions
        ]
    }

@app.get("/tasks/daily-review")
async def daily_review():
    """Get daily review via CHRONOS"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return orchestrator.chronos.daily_review()

@app.get("/tasks/weekly-review")
async def weekly_review():
    """Get weekly review via CHRONOS"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return orchestrator.chronos.weekly_review()

# ============== SWARM ENDPOINTS ==============

@app.get("/swarm/status")
async def swarm_status():
    """Get Multi-LLM Swarm status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return orchestrator.swarm.get_status()

@app.post("/swarm/query")
async def swarm_query(message: str, strategy: str = "parallel", task_type: str = "general"):
    """Query the Multi-LLM Swarm directly"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    try:
        strat = SwarmStrategy(strategy.lower())
    except ValueError:
        strat = SwarmStrategy.PARALLEL

    result = await orchestrator.swarm.query(message, strategy=strat, task_type=task_type)

    return {
        "query": result.query,
        "strategy": result.strategy.value,
        "response": result.final_response,
        "consensus_score": result.consensus_score,
        "providers_used": result.metadata.get("providers_used", []),
        "execution_time": result.execution_time
    }

# ============== WATCHTOWER ENDPOINTS ==============

@app.get("/watchtower/status")
async def watchtower_status():
    """Get Watchtower Division status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return {
        sentinel: agent.get_stats()
        for sentinel, agent in orchestrator.watchtower.items()
    }

# ============== R.I.T.U.E.L. ENDPOINTS ==============

@app.get("/rituel/protocol")
async def get_rituel_protocol():
    """Get R.I.T.U.E.L. protocol documentation"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    rituel_master = orchestrator.brothers["RITUEL_MASTER"]
    return rituel_master.get_full_protocol()

# Run with: uvicorn core.main:app --host 0.0.0.0 --port 8000 --reload
'@

$code | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\core\main.py" -Encoding UTF8
Write-Host "[OK] main.py v9.0 créé" -ForegroundColor Green
```

### 9.2 - Script de Lancement

```powershell
$code = @'
@echo off
echo ========================================
echo  NEMESIS OMEGA UNIFIED v9.0 - LAUNCHER
echo ========================================
echo.

cd /d C:\Users\pierr\NEMESIS_SINGULARITY

echo [1/4] Checking Python...
python --version
if errorlevel 1 (
    echo [ERROR] Python not found!
    pause
    exit /b 1
)

echo.
echo [2/4] Starting Ollama...
start /min cmd /c "ollama serve"
timeout /t 2 /nobreak >nul

echo [3/4] Starting Qdrant (if Docker available)...
REM docker start qdrant 2>nul

echo.
echo [4/4] Starting NEMESIS Backend...
echo.
echo ========================================
echo  NEMESIS OMEGA UNIFIED v9.0 - STARTING
echo ========================================
echo.
echo  API:       http://localhost:8000
echo  Docs:      http://localhost:8000/docs
echo.
echo  Sovereign: Pierre Tagnard
echo  Codes:     WYA, SOEN, MOC-4, TRE, PIERRE416
echo.
echo ========================================
echo.

python -m uvicorn core.main:app --host 0.0.0.0 --port 8000 --reload

pause
'@

$code | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\start_nemesis.bat" -Encoding ASCII
Write-Host "[OK] start_nemesis.bat créé" -ForegroundColor Green
```

### 9.3 - Script de Test

```powershell
$code = @'
"""
NEMESIS OMEGA UNIFIED v9.0 - Test Suite
"""
import asyncio
import aiohttp
import json
from datetime import datetime

API_URL = "http://localhost:8000"

async def test_endpoint(session, method, endpoint, data=None, name=""):
    """Test a single endpoint"""
    url = f"{API_URL}{endpoint}"
    try:
        if method == "GET":
            async with session.get(url) as response:
                result = await response.json()
                status = response.status
        else:
            async with session.post(url, json=data) as response:
                result = await response.json()
                status = response.status

        success = status == 200
        print(f"  {'[OK]' if success else '[FAIL]'} {name or endpoint} - Status: {status}")
        return success, result
    except Exception as e:
        print(f"  [ERROR] {name or endpoint} - {str(e)}")
        return False, {"error": str(e)}

async def run_tests():
    """Run all tests"""
    print("=" * 60)
    print("NEMESIS OMEGA UNIFIED v9.0 - TEST SUITE")
    print("=" * 60)
    print(f"Started: {datetime.now().isoformat()}")
    print()

    results = {"passed": 0, "failed": 0, "errors": []}

    async with aiohttp.ClientSession() as session:
        # Core Tests
        print("CORE TESTS:")
        tests = [
            ("GET", "/", None, "Root"),
            ("GET", "/health", None, "Health Check"),
            ("GET", "/status", None, "Full Status"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Brothers Tests
        print("\nBROTHERS TESTS:")
        tests = [
            ("GET", "/brothers", None, "List Brothers"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Modes Tests
        print("\nMODES TESTS:")
        tests = [
            ("GET", "/modes", None, "List Modes"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Forge Tests
        print("\nFORGE TESTS:")
        tests = [
            ("GET", "/forge", None, "List Forge Blocks"),
            ("GET", "/forge/genesis", None, "Genesis Block"),
            ("GET", "/forge/kritik", None, "Kritik Block"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Chat Tests
        print("\nCHAT TESTS:")
        tests = [
            ("POST", "/chat", {"message": "Hello NEMESIS", "mode": "standard"}, "Basic Chat"),
            ("POST", "/chat/quick", {"message": "Quick test"}, "Quick Chat"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Memory Tests
        print("\nMEMORY TESTS:")
        tests = [
            ("POST", "/memory/store", {"content": "Test memory entry"}, "Store Memory"),
            ("GET", "/memory/stats", None, "Memory Stats"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # R.I.T.U.E.L. Tests
        print("\nR.I.T.U.E.L. TESTS:")
        tests = [
            ("GET", "/rituel/protocol", None, "R.I.T.U.E.L. Protocol"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Swarm Tests
        print("\nSWARM TESTS:")
        tests = [
            ("GET", "/swarm/status", None, "Swarm Status"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

        # Sovereign Tests (will fail without valid code)
        print("\nSOVEREIGN TESTS:")
        tests = [
            ("POST", "/sovereign/command", {"code": "PIERRE416", "command": "status"}, "Sovereign Status"),
        ]
        for method, endpoint, data, name in tests:
            success, _ = await test_endpoint(session, method, endpoint, data, name)
            results["passed" if success else "failed"] += 1

    # Summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total = results["passed"] + results["failed"]
    print(f"  Total Tests: {total}")
    print(f"  Passed: {results['passed']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Success Rate: {results['passed']/total*100:.1f}%")
    print()

    return results

if __name__ == "__main__":
    asyncio.run(run_tests())
'@

$code | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\test_nemesis.py" -Encoding UTF8
Write-Host "[OK] test_nemesis.py créé" -ForegroundColor Green
```

### 9.4 - Requirements.txt Final

```powershell
$code = @'
# NEMESIS OMEGA UNIFIED v9.0 - Requirements

# FastAPI & Server
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
websockets>=12.0

# HTTP Client
aiohttp>=3.9.0
httpx>=0.25.0
requests>=2.31.0

# Data & Validation
pydantic>=2.5.0
python-dotenv>=1.0.0

# Vector Database
qdrant-client>=1.7.0

# LLM & AI
openai>=1.3.0
anthropic>=0.7.0
google-generativeai>=0.3.0
ollama>=0.1.0

# YouTube & Social
youtube-transcript-api>=0.6.0

# System Monitoring
psutil>=5.9.0

# Async
asyncio-throttle>=1.0.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0

# Dashboard (optional)
streamlit>=1.28.0
plotly>=5.18.0
'@

$code | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\requirements.txt" -Encoding UTF8
Write-Host "[OK] requirements.txt créé" -ForegroundColor Green
```

---

## VÉRIFICATION FINALE COMPLÈTE

```powershell
Write-Host "`n" -NoNewline
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  NEMESIS OMEGA UNIFIED v9.0 - VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$structure = @{
    "Core" = @(
        "core\main.py",
        "core\ollama_client.py",
        "core\memory.py",
        "core\swarm.py",
        "core\shadow_lab.py",
        "core\chronos.py",
        "core\modes.py"
    )
    "Agents - 7 Frères" = @(
        "agents\zappa.py",
        "agents\daedalus.py",
        "agents\syncoria.py",
        "agents\exodia.py",
        "agents\kyron.py",
        "agents\loki.py",
        "agents\rituel_master.py",
        "agents\guardian.py",
        "agents\orchestrator.py"
    )
    "Watchtower" = @(
        "agents\watchtower\youtube_scout.py",
        "agents\watchtower\paper_hunter.py",
        "agents\watchtower\social_listener.py"
    )
    "Forge - 8 Blocs" = @(
        "forge\genesis.py",
        "forge\nexus.py",
        "forge\cosmos.py",
        "forge\telos.py",
        "forge\logos.py",
        "forge\praxis.py",
        "forge\morphe.py",
        "forge\kritik.py"
    )
    "Modes" = @(
        "modes\berserker.py",
        "modes\oracle.py",
        "modes\godmode.py",
        "modes\shadow.py"
    )
    "Scripts" = @(
        "start_nemesis.bat",
        "test_nemesis.py",
        "requirements.txt"
    )
}

$totalFiles = 0
$foundFiles = 0

foreach ($category in $structure.Keys) {
    Write-Host "`n$category`:" -ForegroundColor Yellow
    foreach ($file in $structure[$category]) {
        $totalFiles++
        $path = "C:\Users\pierr\NEMESIS_SINGULARITY\$file"
        if (Test-Path $path) {
            $size = (Get-Item $path).Length
            Write-Host "  [OK] $file ($size bytes)" -ForegroundColor Green
            $foundFiles++
        } else {
            Write-Host "  [MISSING] $file" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  RÉSUMÉ" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "  Fichiers trouvés: $foundFiles / $totalFiles" -ForegroundColor $(if ($foundFiles -eq $totalFiles) { "Green" } else { "Yellow" })
Write-Host ""

if ($foundFiles -eq $totalFiles) {
    Write-Host "  ✓ NEMESIS OMEGA UNIFIED v9.0 - INSTALLATION COMPLETE" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Pour lancer NEMESIS:" -ForegroundColor Yellow
    Write-Host "    1. cd C:\Users\pierr\NEMESIS_SINGULARITY"
    Write-Host "    2. pip install -r requirements.txt"
    Write-Host "    3. start_nemesis.bat"
    Write-Host ""
    Write-Host "  Endpoints:" -ForegroundColor Yellow
    Write-Host "    API:  http://localhost:8000"
    Write-Host "    Docs: http://localhost:8000/docs"
    Write-Host ""
    Write-Host "  Codes Souverains: WYA, SOEN, MOC-4, TRE, PIERRE416" -ForegroundColor Magenta
} else {
    Write-Host "  ⚠ Certains fichiers manquent. Vérifier les erreurs ci-dessus." -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
```

---

## RÉSUMÉ FINAL

**NEMESIS OMEGA UNIFIED v9.0** contient:

### Les 7 Frères Fondateurs
1. **ZAPPA** - Compilateur de Prompts (ZAPPA_COMPILE)
2. **DAEDALUS** - Architecte de Code (DAEDALUS_FORGE)
3. **SYNCORIA** - Orchestrateur d'Essaim (SYNCORIA_SWARM)
4. **EXODIA** - Maître de la Mémoire (EXODIA_RECALL)
5. **KYRON** - Gardien du Temps (KYRON_SCHEDULE)
6. **LOKI** - Testeur Chaotique (LOKI_CHAOS)
7. **RITUEL_MASTER** - Maître du Protocole (RITUEL_INVOKE)

### Les 8 Blocs Forge
1. **GENESIS** - Ontologie et Archétypes
2. **NEXUS** - Contrats et Dettes d'Honneur
3. **COSMOS** - Infrastructure Hybride
4. **TELOS** - Objectifs SMART Omega
5. **LOGOS** - Protocole ZAPPA + CoT/ToT
6. **PRAXIS** - Pipeline d'Exécution
7. **MORPHE** - Format No Fluff
8. **KRITIK** - Contrôle Qualité 98%

### Les 4 Modes Opérationnels
1. **BERSERKER** (///BERSERKER) - Maximum Power
2. **ORACLE** (//PREDICT) - Prédiction Profonde
3. **GODMODE** (//ATLAS) - Omniscience Simulée
4. **SHADOW** (//VOID) - Mode Furtif

### Systèmes Core
- **Multi-LLM Swarm** - 5 LLMs en parallèle
- **Chronos GTD** - Gestion du Temps
- **Shadow Lab** - Staging et Déploiement
- **Watchtower** - Veille YouTube/Papers/Social

### Protocole R.I.T.U.E.L.
**R**éception → **I**nvocation → **T**issage → **U**nification → **É**preuve → **L**ancement

---

**FIN DES INSTRUCTIONS ANTIGRAVITY COMPLÈTES**
