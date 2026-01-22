# INSTRUCTIONS ANTIGRAVITY - NEMESIS OMEGA UNIFIED v9.0

## PHASE 7A: LES 7 FRÈRES (Agents Fondateurs)

**Destination:** `C:\Users\pierr\NEMESIS_SINGULARITY\`

---

## ÉTAPE 1: Créer les 7 Frères

### 1.1 ZAPPA - Le Compilateur de Prompts (Déjà partiellement créé en Phase 6)

```powershell
# Mise à jour de ZAPPA avec activation key
@"
"""
ZAPPA - Le Compilateur de Prompts
Frère Fondateur #1
Activation Key: ZAPPA_COMPILE
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
from enum import Enum

class PromptSize(Enum):
    MINIMAL = "minimal"      # < 100 tokens
    STANDARD = "standard"    # 100-500 tokens
    EXTENDED = "extended"    # 500-2000 tokens
    MAXIMAL = "maximal"      # > 2000 tokens

class ZappaAgent(BaseAgent):
    """
    ZAPPA - Meta-Prompting Compiler
    Inspiré de l'architecture CPU: Prompts = Machine Code
    """

    ACTIVATION_KEY = "ZAPPA_COMPILE"
    BROTHER_ID = 1

    # Templates de prompts optimisés par taille
    PROMPT_TEMPLATES = {
        PromptSize.MINIMAL: {
            "prefix": "",
            "suffix": "",
            "max_context": 50,
            "instruction_style": "direct"
        },
        PromptSize.STANDARD: {
            "prefix": "Tu es un assistant expert. ",
            "suffix": "\nRéponds de manière concise et précise.",
            "max_context": 200,
            "instruction_style": "structured"
        },
        PromptSize.EXTENDED: {
            "prefix": "Tu es un assistant IA expert dans ton domaine. Tu analyses en profondeur et fournis des réponses détaillées.\n\n",
            "suffix": "\n\nAnalyse la demande, structure ta réponse, et assure-toi de couvrir tous les aspects.",
            "max_context": 1000,
            "instruction_style": "detailed"
        },
        PromptSize.MAXIMAL: {
            "prefix": """Tu es NEMESIS, un système d'intelligence artificielle avancé.
Tu opères selon le protocole Gabriel Mercier V2.0.
Tu as accès à une mémoire vectorielle et à un essaim multi-LLM.

CONTEXTE SYSTÈME:
- Mode: {mode}
- Souverain: Pierre Tagnard (N1)
- Protocole: R.I.T.U.E.L.

""",
            "suffix": """

DIRECTIVES:
1. Analyse exhaustive de la demande
2. Consultation de la mémoire si pertinent
3. Synthèse multi-sources si disponible
4. Réponse structurée avec méta-données""",
            "max_context": 5000,
            "instruction_style": "comprehensive"
        }
    }

    # Rôles des agents avec leurs spécificités
    AGENT_ROLES = {
        "chat": {
            "persona": "assistant conversationnel",
            "strength": "dialogue naturel",
            "focus": "compréhension et empathie"
        },
        "code": {
            "persona": "développeur senior full-stack",
            "strength": "code propre et optimisé",
            "focus": "qualité et maintenabilité"
        },
        "research": {
            "persona": "chercheur analytique",
            "strength": "synthèse d'information",
            "focus": "exhaustivité et précision"
        },
        "planner": {
            "persona": "architecte de solutions",
            "strength": "planification stratégique",
            "focus": "structure et séquencement"
        },
        "browser": {
            "persona": "agent web autonome",
            "strength": "navigation et extraction",
            "focus": "efficacité et pertinence"
        },
        "voice": {
            "persona": "interface vocale",
            "strength": "communication orale",
            "focus": "clarté et naturel"
        }
    }

    # Modes opérationnels
    OPERATIONAL_MODES = {
        "BERSERKER": {
            "description": "Mode maximum - Toutes ressources",
            "llm_count": 5,
            "parallel": True,
            "depth": "maximal"
        },
        "ORACLE": {
            "description": "Mode réflexion profonde",
            "llm_count": 3,
            "parallel": False,
            "depth": "extended"
        },
        "SHADOW": {
            "description": "Mode furtif - Minimal footprint",
            "llm_count": 1,
            "parallel": False,
            "depth": "minimal"
        }
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="ZAPPA",
            capabilities=[
                AgentCapability.GENERATION,
                AgentCapability.ANALYSIS
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.current_mode = "ORACLE"

    def set_mode(self, mode: str) -> bool:
        """Change le mode opérationnel"""
        if mode in self.OPERATIONAL_MODES:
            self.current_mode = mode
            return True
        return False

    def compile_prompt(
        self,
        agent_type: str,
        task: str,
        context: Optional[Dict] = None,
        model: str = "qwen2.5:0.5b",
        force_size: Optional[PromptSize] = None
    ) -> str:
        """
        Compile un prompt optimisé pour l'agent et le modèle cible.
        """
        # Déterminer la taille optimale
        if force_size:
            size = force_size
        else:
            size = self._determine_optimal_size(task, model)

        template = self.PROMPT_TEMPLATES[size]
        role = self.AGENT_ROLES.get(agent_type, self.AGENT_ROLES["chat"])
        mode_config = self.OPERATIONAL_MODES[self.current_mode]

        # Construire le prompt
        prompt_parts = []

        # Prefix avec substitution de variables
        prefix = template["prefix"]
        if "{mode}" in prefix:
            prefix = prefix.format(mode=self.current_mode)
        prompt_parts.append(prefix)

        # Rôle de l'agent
        if size in [PromptSize.EXTENDED, PromptSize.MAXIMAL]:
            prompt_parts.append(f"RÔLE: Tu es un {role['persona']}.")
            prompt_parts.append(f"FORCE: {role['strength']}")
            prompt_parts.append(f"FOCUS: {role['focus']}\n")

        # Contexte (tronqué selon la taille)
        if context:
            ctx_str = str(context)[:template["max_context"]]
            prompt_parts.append(f"CONTEXTE: {ctx_str}\n")

        # Tâche principale
        prompt_parts.append(f"TÂCHE: {task}")

        # Suffix
        prompt_parts.append(template["suffix"])

        return "\n".join(prompt_parts)

    def compile_branchless(self, task: str, context: Optional[Dict] = None) -> str:
        """
        Compilation branchless - Zéro hésitation.
        Inspiré du traitement SIMD: une instruction, une action.
        """
        return f"EXECUTE: {task}\nCONTEXT: {context or 'None'}\nMODE: DIRECT\nOUTPUT: ACTION_ONLY"

    def compile_simd(self, tasks: List[str], context: Optional[Dict] = None) -> List[str]:
        """
        Compilation SIMD - Exécution parallèle de multiples tâches.
        """
        return [self.compile_branchless(task, context) for task in tasks]

    def _determine_optimal_size(self, task: str, model: str) -> PromptSize:
        """Détermine la taille optimale du prompt selon la tâche et le modèle."""
        task_len = len(task)

        # Petits modèles = prompts minimaux
        if "0.5b" in model or "1b" in model:
            return PromptSize.MINIMAL if task_len < 100 else PromptSize.STANDARD

        # Modèles moyens
        if "7b" in model or "8b" in model:
            return PromptSize.STANDARD if task_len < 200 else PromptSize.EXTENDED

        # Grands modèles
        return PromptSize.EXTENDED if task_len < 500 else PromptSize.MAXIMAL

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande de compilation de prompt."""
        task = context.message
        agent_type = context.metadata.get("target_agent", "chat")
        model = context.metadata.get("target_model", "qwen2.5:0.5b")

        compiled = self.compile_prompt(agent_type, task, context.metadata, model)

        return AgentResponse(
            content=compiled,
            agent_name=self.name,
            success=True,
            metadata={
                "compilation_mode": self.current_mode,
                "target_agent": agent_type,
                "target_model": model,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\zappa.py" -Encoding UTF8

Write-Host "ZAPPA (Frère #1) créé avec succès" -ForegroundColor Green
```

### 1.2 DAEDALUS - L'Architecte de Code

```powershell
@"
"""
DAEDALUS - L'Architecte de Code
Frère Fondateur #2
Activation Key: DAEDALUS_FORGE
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
import ast
import re

class DaedalusAgent(BaseAgent):
    """
    DAEDALUS - The Code Architect
    Forge du code selon les 8 Blocs Fondamentaux
    """

    ACTIVATION_KEY = "DAEDALUS_FORGE"
    BROTHER_ID = 2

    # Les 8 Blocs de Forge
    FORGE_BLOCKS = {
        "GENESIS": {
            "description": "Bloc de création initiale",
            "operations": ["create", "initialize", "bootstrap"],
            "prompt_template": "Crée {target} avec les spécifications: {specs}"
        },
        "NEXUS": {
            "description": "Bloc de connexion et intégration",
            "operations": ["connect", "integrate", "bridge"],
            "prompt_template": "Connecte {source} à {target} via {method}"
        },
        "COSMOS": {
            "description": "Bloc d'organisation et structure",
            "operations": ["organize", "structure", "architect"],
            "prompt_template": "Structure {target} selon le pattern {pattern}"
        },
        "TELOS": {
            "description": "Bloc d'objectif et finalité",
            "operations": ["define_goal", "set_objective", "target"],
            "prompt_template": "Objectif: {goal}. Critères de succès: {criteria}"
        },
        "LOGOS": {
            "description": "Bloc de logique et raisonnement",
            "operations": ["analyze", "reason", "deduce"],
            "prompt_template": "Analyse logique de {subject}: {context}"
        },
        "PRAXIS": {
            "description": "Bloc d'exécution et action",
            "operations": ["execute", "run", "perform"],
            "prompt_template": "Exécute {action} sur {target} avec {params}"
        },
        "MORPHE": {
            "description": "Bloc de transformation",
            "operations": ["transform", "convert", "adapt"],
            "prompt_template": "Transforme {source} en {target} format {format}"
        },
        "KRITIK": {
            "description": "Bloc de validation et critique",
            "operations": ["validate", "review", "critique"],
            "prompt_template": "Valide {target} selon les critères: {criteria}"
        }
    }

    # Patterns architecturaux supportés
    ARCHITECTURE_PATTERNS = {
        "microservices": {
            "structure": ["api", "services", "models", "utils"],
            "principles": ["single_responsibility", "loose_coupling", "high_cohesion"]
        },
        "monolith": {
            "structure": ["core", "modules", "shared"],
            "principles": ["simplicity", "cohesion"]
        },
        "hexagonal": {
            "structure": ["domain", "ports", "adapters", "infrastructure"],
            "principles": ["dependency_inversion", "ports_and_adapters"]
        },
        "nemesis": {
            "structure": ["agents", "core", "api", "workflows", "memory"],
            "principles": ["agent_autonomy", "memory_persistence", "orchestration"]
        }
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="DAEDALUS",
            capabilities=[
                AgentCapability.CODE,
                AgentCapability.ANALYSIS,
                AgentCapability.GENERATION
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.current_block = None

    def set_forge_block(self, block: str) -> bool:
        """Active un bloc de forge spécifique"""
        if block.upper() in self.FORGE_BLOCKS:
            self.current_block = block.upper()
            return True
        return False

    def forge_code(
        self,
        task: str,
        language: str = "python",
        pattern: str = "nemesis",
        block: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Forge du code selon le bloc et le pattern spécifiés.
        """
        active_block = block.upper() if block else self.current_block or "GENESIS"
        forge_config = self.FORGE_BLOCKS[active_block]
        arch_config = self.ARCHITECTURE_PATTERNS.get(pattern, self.ARCHITECTURE_PATTERNS["nemesis"])

        return {
            "forge_block": active_block,
            "operation": forge_config["operations"][0],
            "prompt": forge_config["prompt_template"].format(
                target=task,
                specs=f"language={language}, pattern={pattern}",
                source="input",
                method="standard",
                pattern=pattern,
                goal=task,
                criteria="functional, clean, documented",
                subject=task,
                context="code generation",
                action="generate",
                params={"language": language},
                format=language
            ),
            "architecture": arch_config,
            "principles": arch_config["principles"]
        }

    def analyze_code(self, code: str) -> Dict[str, Any]:
        """Analyse statique du code"""
        analysis = {
            "lines": len(code.splitlines()),
            "characters": len(code),
            "has_classes": "class " in code,
            "has_functions": "def " in code or "function " in code,
            "has_async": "async " in code,
            "has_imports": "import " in code or "from " in code,
            "complexity_estimate": "low"
        }

        # Estimation de complexité
        if analysis["lines"] > 200:
            analysis["complexity_estimate"] = "high"
        elif analysis["lines"] > 50:
            analysis["complexity_estimate"] = "medium"

        return analysis

    def suggest_refactoring(self, code: str) -> List[str]:
        """Suggestions de refactoring basées sur les principes NEMESIS"""
        suggestions = []

        if len(code.splitlines()) > 100:
            suggestions.append("KRITIK: Fichier trop long - considérer la division")

        if code.count("def ") > 10:
            suggestions.append("COSMOS: Trop de fonctions - considérer l'extraction en classes")

        if "try:" in code and code.count("except:") > code.count("except "):
            suggestions.append("KRITIK: Éviter les except génériques - spécifier les exceptions")

        if "# TODO" in code or "# FIXME" in code:
            suggestions.append("PRAXIS: TODOs détectés - planifier leur résolution")

        return suggestions if suggestions else ["GENESIS: Code conforme aux standards NEMESIS"]

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande de forge de code."""
        task = context.message
        language = context.metadata.get("language", "python")
        pattern = context.metadata.get("pattern", "nemesis")
        block = context.metadata.get("forge_block")

        forge_result = self.forge_code(task, language, pattern, block)

        # Générer le code via LLM si disponible
        if self.llm_client:
            prompt = f"""Tu es DAEDALUS, l'Architecte de Code.

Bloc de Forge actif: {forge_result['forge_block']}
Pattern architectural: {pattern}
Langage: {language}

{forge_result['prompt']}

Génère un code {language} propre, documenté et fonctionnel."""

            llm_response = await self.llm_client.generate(prompt)
            forge_result["generated_code"] = llm_response

        return AgentResponse(
            content=str(forge_result),
            agent_name=self.name,
            success=True,
            metadata={
                "forge_block": forge_result["forge_block"],
                "pattern": pattern,
                "language": language,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\daedalus.py" -Encoding UTF8

Write-Host "DAEDALUS (Frère #2) créé avec succès" -ForegroundColor Green
```

### 1.3 SYNCORIA - L'Orchestrateur d'Essaim

```powershell
@"
"""
SYNCORIA - L'Orchestrateur d'Essaim Multi-LLM
Frère Fondateur #3
Activation Key: SYNCORIA_SWARM
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
import asyncio
from dataclasses import dataclass
from enum import Enum

class SwarmStrategy(Enum):
    PARALLEL = "parallel"       # Tous les LLMs en parallèle
    SEQUENTIAL = "sequential"   # Un après l'autre
    VOTING = "voting"          # Vote majoritaire
    CONSENSUS = "consensus"     # Recherche de consensus
    SPECIALIST = "specialist"   # Routage vers le spécialiste

@dataclass
class LLMConfig:
    name: str
    endpoint: str
    model: str
    specialty: str
    weight: float = 1.0
    active: bool = True

class SyncoriaAgent(BaseAgent):
    """
    SYNCORIA - The Multi-LLM Swarm Orchestrator
    Coordonne l'essaim de 5 LLMs pour des réponses enrichies
    """

    ACTIVATION_KEY = "SYNCORIA_SWARM"
    BROTHER_ID = 3

    # Configuration des 5 LLMs de l'essaim
    SWARM_CONFIG = {
        "ollama": LLMConfig(
            name="Ollama Local",
            endpoint="http://localhost:11434",
            model="qwen2.5:0.5b",
            specialty="fast_local",
            weight=1.0
        ),
        "gpt4": LLMConfig(
            name="GPT-4o",
            endpoint="https://api.openai.com/v1",
            model="gpt-4o",
            specialty="reasoning",
            weight=1.5,
            active=False  # Nécessite API key
        ),
        "claude": LLMConfig(
            name="Claude",
            endpoint="https://api.anthropic.com/v1",
            model="claude-3-opus",
            specialty="analysis",
            weight=1.5,
            active=False  # Nécessite API key
        ),
        "gemini": LLMConfig(
            name="Gemini",
            endpoint="https://generativelanguage.googleapis.com/v1",
            model="gemini-pro",
            specialty="multimodal",
            weight=1.2,
            active=False  # Nécessite API key
        ),
        "mistral": LLMConfig(
            name="Mistral",
            endpoint="https://api.mistral.ai/v1",
            model="mistral-large",
            specialty="code",
            weight=1.3,
            active=False  # Nécessite API key
        )
    }

    # Mapping spécialité -> tâche
    SPECIALTY_ROUTING = {
        "code": ["mistral", "gpt4", "ollama"],
        "analysis": ["claude", "gpt4", "gemini"],
        "reasoning": ["gpt4", "claude", "mistral"],
        "multimodal": ["gemini", "gpt4", "claude"],
        "fast": ["ollama", "mistral", "gemini"],
        "creative": ["claude", "gpt4", "gemini"]
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="SYNCORIA",
            capabilities=[
                AgentCapability.RESEARCH,
                AgentCapability.ANALYSIS,
                AgentCapability.GENERATION
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.strategy = SwarmStrategy.PARALLEL
        self.active_llms = self._get_active_llms()

    def _get_active_llms(self) -> List[str]:
        """Retourne la liste des LLMs actifs"""
        return [name for name, config in self.SWARM_CONFIG.items() if config.active]

    def set_strategy(self, strategy: str) -> bool:
        """Change la stratégie d'essaim"""
        try:
            self.strategy = SwarmStrategy(strategy.lower())
            return True
        except ValueError:
            return False

    def activate_llm(self, llm_name: str, api_key: Optional[str] = None) -> bool:
        """Active un LLM dans l'essaim"""
        if llm_name in self.SWARM_CONFIG:
            self.SWARM_CONFIG[llm_name].active = True
            self.active_llms = self._get_active_llms()
            return True
        return False

    def route_to_specialist(self, task_type: str) -> List[str]:
        """Route vers les spécialistes pour un type de tâche"""
        routing = self.SPECIALTY_ROUTING.get(task_type, ["ollama"])
        return [llm for llm in routing if llm in self.active_llms]

    async def swarm_query(
        self,
        prompt: str,
        task_type: str = "general",
        strategy: Optional[SwarmStrategy] = None
    ) -> Dict[str, Any]:
        """
        Exécute une requête sur l'essaim selon la stratégie.
        """
        active_strategy = strategy or self.strategy
        target_llms = self.route_to_specialist(task_type) if active_strategy == SwarmStrategy.SPECIALIST else self.active_llms

        results = {
            "strategy": active_strategy.value,
            "llms_queried": target_llms,
            "responses": {},
            "consensus": None,
            "final_response": None
        }

        if active_strategy == SwarmStrategy.PARALLEL:
            # Exécution parallèle
            responses = await self._parallel_query(prompt, target_llms)
            results["responses"] = responses
            results["final_response"] = self._merge_responses(responses)

        elif active_strategy == SwarmStrategy.SEQUENTIAL:
            # Exécution séquentielle avec enrichissement
            results["final_response"] = await self._sequential_query(prompt, target_llms)

        elif active_strategy == SwarmStrategy.VOTING:
            # Vote majoritaire
            responses = await self._parallel_query(prompt, target_llms)
            results["responses"] = responses
            results["final_response"] = self._vote_responses(responses)

        elif active_strategy == SwarmStrategy.CONSENSUS:
            # Recherche de consensus
            responses = await self._parallel_query(prompt, target_llms)
            results["responses"] = responses
            results["consensus"] = self._find_consensus(responses)
            results["final_response"] = results["consensus"]

        return results

    async def _parallel_query(self, prompt: str, llms: List[str]) -> Dict[str, str]:
        """Requête parallèle à plusieurs LLMs"""
        responses = {}

        # Pour l'instant, utiliser uniquement Ollama local
        if "ollama" in llms and self.llm_client:
            try:
                response = await self.llm_client.generate(prompt)
                responses["ollama"] = response
            except Exception as e:
                responses["ollama"] = f"Error: {str(e)}"

        # Placeholder pour les autres LLMs (nécessitent API keys)
        for llm in llms:
            if llm != "ollama" and llm not in responses:
                responses[llm] = f"[{llm.upper()}] API non configurée - Activer avec SYNCORIA_SWARM"

        return responses

    async def _sequential_query(self, prompt: str, llms: List[str]) -> str:
        """Requête séquentielle avec enrichissement progressif"""
        enriched_prompt = prompt
        final_response = ""

        for llm in llms:
            if llm == "ollama" and self.llm_client:
                response = await self.llm_client.generate(enriched_prompt)
                final_response = response
                enriched_prompt = f"{prompt}\n\nRéponse précédente à enrichir:\n{response}"

        return final_response

    def _merge_responses(self, responses: Dict[str, str]) -> str:
        """Fusionne les réponses de plusieurs LLMs"""
        valid_responses = [r for r in responses.values() if not r.startswith("Error") and not r.startswith("[")]

        if not valid_responses:
            return "Aucune réponse valide de l'essaim"

        if len(valid_responses) == 1:
            return valid_responses[0]

        # Fusion simple: concaténation avec séparateurs
        return "\n\n---\n\n".join(valid_responses)

    def _vote_responses(self, responses: Dict[str, str]) -> str:
        """Vote majoritaire parmi les réponses"""
        # Simplification: retourner la réponse la plus longue (heuristique)
        valid_responses = [(k, v) for k, v in responses.items() if not v.startswith("Error")]
        if not valid_responses:
            return "Aucun vote valide"

        return max(valid_responses, key=lambda x: len(x[1]))[1]

    def _find_consensus(self, responses: Dict[str, str]) -> str:
        """Trouve le consensus parmi les réponses"""
        # Simplification: recherche de termes communs
        valid_responses = [v for v in responses.values() if not v.startswith("Error") and not v.startswith("[")]

        if not valid_responses:
            return "Aucun consensus trouvé"

        if len(valid_responses) == 1:
            return valid_responses[0]

        # Retourner la première réponse valide avec note de consensus
        return f"[CONSENSUS PARTIEL]\n{valid_responses[0]}"

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande via l'essaim"""
        task = context.message
        task_type = context.metadata.get("task_type", "general")
        strategy = context.metadata.get("strategy")

        if strategy:
            self.set_strategy(strategy)

        swarm_result = await self.swarm_query(task, task_type)

        return AgentResponse(
            content=swarm_result["final_response"],
            agent_name=self.name,
            success=True,
            metadata={
                "strategy": swarm_result["strategy"],
                "llms_queried": swarm_result["llms_queried"],
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\syncoria.py" -Encoding UTF8

Write-Host "SYNCORIA (Frère #3) créé avec succès" -ForegroundColor Green
```

### 1.4 EXODIA - Le Maître de la Mémoire

```powershell
@"
"""
EXODIA - Le Maître de la Mémoire Vectorielle
Frère Fondateur #4
Activation Key: EXODIA_RECALL
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import hashlib
import json

@dataclass
class MemoryEntry:
    id: str
    content: str
    vector: List[float]
    metadata: Dict[str, Any]
    timestamp: datetime
    access_count: int = 0
    importance: float = 0.5

class ExodiaAgent(BaseAgent):
    """
    EXODIA - The Memory Master
    Gère la mémoire persistante, le rappel contextuel et l'oubli stratégique
    """

    ACTIVATION_KEY = "EXODIA_RECALL"
    BROTHER_ID = 4

    # Types de mémoire
    MEMORY_TYPES = {
        "episodic": {
            "description": "Événements et interactions spécifiques",
            "retention": timedelta(days=30),
            "priority": 0.7
        },
        "semantic": {
            "description": "Connaissances et faits généraux",
            "retention": timedelta(days=365),
            "priority": 0.9
        },
        "procedural": {
            "description": "Comment faire les choses",
            "retention": timedelta(days=180),
            "priority": 0.8
        },
        "working": {
            "description": "Contexte de session actuel",
            "retention": timedelta(hours=24),
            "priority": 1.0
        }
    }

    # Stratégies de rappel
    RECALL_STRATEGIES = {
        "similarity": "Recherche par similarité vectorielle",
        "temporal": "Recherche par proximité temporelle",
        "importance": "Recherche par importance",
        "hybrid": "Combinaison de toutes les stratégies"
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="EXODIA",
            capabilities=[
                AgentCapability.MEMORY,
                AgentCapability.ANALYSIS
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.working_memory: Dict[str, MemoryEntry] = {}
        self.recall_strategy = "hybrid"

    def set_recall_strategy(self, strategy: str) -> bool:
        """Change la stratégie de rappel"""
        if strategy in self.RECALL_STRATEGIES:
            self.recall_strategy = strategy
            return True
        return False

    def _generate_id(self, content: str) -> str:
        """Génère un ID unique pour une entrée mémoire"""
        return hashlib.sha256(f"{content}{datetime.now().isoformat()}".encode()).hexdigest()[:16]

    def _compute_importance(self, content: str, metadata: Dict) -> float:
        """Calcule l'importance d'une entrée"""
        base_importance = 0.5

        # Boost si contient des mots-clés importants
        important_keywords = ["critique", "urgent", "important", "clé", "essentiel", "pierre", "nemesis"]
        for keyword in important_keywords:
            if keyword.lower() in content.lower():
                base_importance += 0.1

        # Boost selon le type de mémoire
        memory_type = metadata.get("type", "working")
        base_importance *= self.MEMORY_TYPES.get(memory_type, {}).get("priority", 0.5)

        return min(base_importance, 1.0)

    async def store(
        self,
        content: str,
        memory_type: str = "working",
        metadata: Optional[Dict] = None
    ) -> str:
        """Stocke une nouvelle entrée en mémoire"""
        entry_id = self._generate_id(content)
        metadata = metadata or {}
        metadata["type"] = memory_type

        # Calculer l'importance
        importance = self._compute_importance(content, metadata)

        # Créer l'entrée mémoire
        entry = MemoryEntry(
            id=entry_id,
            content=content,
            vector=[],  # Sera calculé par la mémoire vectorielle
            metadata=metadata,
            timestamp=datetime.now(),
            importance=importance
        )

        # Stocker en mémoire de travail
        self.working_memory[entry_id] = entry

        # Stocker en mémoire persistante via Qdrant
        if self.memory:
            await self.memory.store(
                content=content,
                metadata={
                    **metadata,
                    "exodia_id": entry_id,
                    "importance": importance,
                    "timestamp": entry.timestamp.isoformat()
                }
            )

        return entry_id

    async def recall(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
        min_importance: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Rappelle des entrées de la mémoire"""
        results = []

        # Recherche en mémoire vectorielle
        if self.memory:
            vector_results = await self.memory.search(query, limit=limit * 2)

            for result in vector_results:
                # Filtrer par type si spécifié
                if memory_type and result.get("metadata", {}).get("type") != memory_type:
                    continue

                # Filtrer par importance
                importance = result.get("metadata", {}).get("importance", 0.5)
                if importance < min_importance:
                    continue

                results.append({
                    "id": result.get("metadata", {}).get("exodia_id", "unknown"),
                    "content": result.get("content", ""),
                    "score": result.get("score", 0),
                    "importance": importance,
                    "type": result.get("metadata", {}).get("type", "unknown"),
                    "timestamp": result.get("metadata", {}).get("timestamp")
                })

        # Ajouter les résultats de la mémoire de travail
        for entry_id, entry in self.working_memory.items():
            if memory_type and entry.metadata.get("type") != memory_type:
                continue
            if entry.importance < min_importance:
                continue

            # Calculer un score de similarité simple
            query_words = set(query.lower().split())
            content_words = set(entry.content.lower().split())
            overlap = len(query_words & content_words) / max(len(query_words), 1)

            results.append({
                "id": entry.id,
                "content": entry.content,
                "score": overlap,
                "importance": entry.importance,
                "type": entry.metadata.get("type", "working"),
                "timestamp": entry.timestamp.isoformat()
            })

        # Trier selon la stratégie
        if self.recall_strategy == "similarity":
            results.sort(key=lambda x: x["score"], reverse=True)
        elif self.recall_strategy == "importance":
            results.sort(key=lambda x: x["importance"], reverse=True)
        elif self.recall_strategy == "temporal":
            results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        else:  # hybrid
            results.sort(key=lambda x: x["score"] * 0.5 + x["importance"] * 0.5, reverse=True)

        return results[:limit]

    async def forget(
        self,
        entry_id: Optional[str] = None,
        older_than: Optional[timedelta] = None,
        below_importance: Optional[float] = None
    ) -> int:
        """Oublie des entrées de la mémoire (nettoyage stratégique)"""
        forgotten_count = 0

        if entry_id:
            # Oublier une entrée spécifique
            if entry_id in self.working_memory:
                del self.working_memory[entry_id]
                forgotten_count += 1

        if older_than:
            # Oublier les entrées trop anciennes
            cutoff = datetime.now() - older_than
            to_forget = [
                eid for eid, entry in self.working_memory.items()
                if entry.timestamp < cutoff
            ]
            for eid in to_forget:
                del self.working_memory[eid]
                forgotten_count += 1

        if below_importance is not None:
            # Oublier les entrées peu importantes
            to_forget = [
                eid for eid, entry in self.working_memory.items()
                if entry.importance < below_importance
            ]
            for eid in to_forget:
                del self.working_memory[eid]
                forgotten_count += 1

        return forgotten_count

    def get_memory_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques de la mémoire"""
        stats = {
            "working_memory_count": len(self.working_memory),
            "by_type": {},
            "average_importance": 0.0,
            "recall_strategy": self.recall_strategy
        }

        if self.working_memory:
            importances = []
            for entry in self.working_memory.values():
                mem_type = entry.metadata.get("type", "unknown")
                stats["by_type"][mem_type] = stats["by_type"].get(mem_type, 0) + 1
                importances.append(entry.importance)

            stats["average_importance"] = sum(importances) / len(importances)

        return stats

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande de mémoire"""
        task = context.message
        operation = context.metadata.get("operation", "recall")

        if operation == "store":
            memory_type = context.metadata.get("memory_type", "working")
            entry_id = await self.store(task, memory_type, context.metadata)
            result = f"Stocké en mémoire avec ID: {entry_id}"

        elif operation == "recall":
            limit = context.metadata.get("limit", 5)
            memories = await self.recall(task, limit=limit)
            result = json.dumps(memories, indent=2, ensure_ascii=False)

        elif operation == "forget":
            count = await self.forget(
                entry_id=context.metadata.get("entry_id"),
                older_than=context.metadata.get("older_than"),
                below_importance=context.metadata.get("below_importance")
            )
            result = f"Oublié {count} entrée(s)"

        elif operation == "stats":
            stats = self.get_memory_stats()
            result = json.dumps(stats, indent=2)

        else:
            result = f"Opération inconnue: {operation}"

        return AgentResponse(
            content=result,
            agent_name=self.name,
            success=True,
            metadata={
                "operation": operation,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\exodia.py" -Encoding UTF8

Write-Host "EXODIA (Frère #4) créé avec succès" -ForegroundColor Green
```

### 1.5 KYRON - Le Gardien du Temps

```powershell
@"
"""
KYRON - Le Gardien du Temps et Planificateur
Frère Fondateur #5
Activation Key: KYRON_SCHEDULE
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import uuid

class TaskPriority(Enum):
    CRITICAL = 4
    HIGH = 3
    MEDIUM = 2
    LOW = 1

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"

@dataclass
class ChronosTask:
    id: str
    title: str
    description: str
    priority: TaskPriority
    status: TaskStatus
    created_at: datetime
    due_date: Optional[datetime] = None
    estimated_duration: Optional[timedelta] = None
    tags: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    assignee: str = "NEMESIS"
    progress: float = 0.0

class KyronAgent(BaseAgent):
    """
    KYRON - The Time Guardian (Chronos GTD)
    Gère le temps, les tâches, et la planification selon la méthodologie GTD
    """

    ACTIVATION_KEY = "KYRON_SCHEDULE"
    BROTHER_ID = 5

    # Contextes GTD
    GTD_CONTEXTS = {
        "@computer": "Tâches nécessitant un ordinateur",
        "@phone": "Appels et communications",
        "@errands": "Courses et déplacements",
        "@home": "Tâches à domicile",
        "@office": "Tâches bureau",
        "@anywhere": "Tâches sans contrainte de lieu",
        "@waiting": "En attente d'une réponse/action externe",
        "@nemesis": "Tâches automatisables par NEMESIS"
    }

    # Horizons de focus GTD
    GTD_HORIZONS = {
        "runway": "Actions immédiates (aujourd'hui)",
        "10k": "Projets en cours (cette semaine)",
        "20k": "Domaines de responsabilité (ce mois)",
        "30k": "Objectifs 1-2 ans",
        "40k": "Vision 3-5 ans",
        "50k": "But de vie et principes"
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="KYRON",
            capabilities=[
                AgentCapability.PLANNING,
                AgentCapability.ANALYSIS
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.tasks: Dict[str, ChronosTask] = {}
        self.projects: Dict[str, List[str]] = {}  # project_id -> list of task_ids
        self.current_focus_horizon = "runway"

    def create_task(
        self,
        title: str,
        description: str = "",
        priority: str = "MEDIUM",
        due_date: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        dependencies: Optional[List[str]] = None,
        project_id: Optional[str] = None
    ) -> str:
        """Crée une nouvelle tâche"""
        task_id = str(uuid.uuid4())[:8]

        task = ChronosTask(
            id=task_id,
            title=title,
            description=description,
            priority=TaskPriority[priority.upper()],
            status=TaskStatus.PENDING,
            created_at=datetime.now(),
            due_date=due_date,
            tags=tags or [],
            dependencies=dependencies or []
        )

        self.tasks[task_id] = task

        if project_id:
            if project_id not in self.projects:
                self.projects[project_id] = []
            self.projects[project_id].append(task_id)

        return task_id

    def update_task_status(self, task_id: str, status: str) -> bool:
        """Met à jour le statut d'une tâche"""
        if task_id in self.tasks:
            self.tasks[task_id].status = TaskStatus(status.lower())
            if status.lower() == "completed":
                self.tasks[task_id].progress = 1.0
            return True
        return False

    def update_task_progress(self, task_id: str, progress: float) -> bool:
        """Met à jour la progression d'une tâche (0.0 à 1.0)"""
        if task_id in self.tasks:
            self.tasks[task_id].progress = min(max(progress, 0.0), 1.0)
            if progress >= 1.0:
                self.tasks[task_id].status = TaskStatus.COMPLETED
            elif progress > 0:
                self.tasks[task_id].status = TaskStatus.IN_PROGRESS
            return True
        return False

    def get_tasks_by_context(self, context: str) -> List[ChronosTask]:
        """Récupère les tâches par contexte GTD"""
        return [
            task for task in self.tasks.values()
            if context in task.tags and task.status != TaskStatus.COMPLETED
        ]

    def get_tasks_by_horizon(self, horizon: str) -> List[ChronosTask]:
        """Récupère les tâches par horizon de focus"""
        now = datetime.now()

        horizon_filters = {
            "runway": lambda t: t.due_date and t.due_date.date() == now.date() if t.due_date else False,
            "10k": lambda t: t.due_date and t.due_date <= now + timedelta(days=7) if t.due_date else False,
            "20k": lambda t: t.due_date and t.due_date <= now + timedelta(days=30) if t.due_date else False,
            "30k": lambda t: t.due_date and t.due_date <= now + timedelta(days=365) if t.due_date else True,
            "40k": lambda t: True,
            "50k": lambda t: True
        }

        filter_func = horizon_filters.get(horizon, lambda t: True)
        return [
            task for task in self.tasks.values()
            if filter_func(task) and task.status != TaskStatus.COMPLETED
        ]

    def get_next_actions(self, limit: int = 5) -> List[ChronosTask]:
        """Récupère les prochaines actions selon GTD"""
        pending_tasks = [
            task for task in self.tasks.values()
            if task.status == TaskStatus.PENDING
        ]

        # Vérifier les dépendances
        actionable = []
        for task in pending_tasks:
            deps_complete = all(
                self.tasks.get(dep_id, ChronosTask(
                    id="", title="", description="",
                    priority=TaskPriority.LOW,
                    status=TaskStatus.COMPLETED,
                    created_at=datetime.now()
                )).status == TaskStatus.COMPLETED
                for dep_id in task.dependencies
            )
            if deps_complete:
                actionable.append(task)

        # Trier par priorité et date d'échéance
        actionable.sort(
            key=lambda t: (
                -t.priority.value,
                t.due_date or datetime.max
            )
        )

        return actionable[:limit]

    def weekly_review(self) -> Dict[str, Any]:
        """Effectue une revue hebdomadaire GTD"""
        now = datetime.now()
        week_ago = now - timedelta(days=7)

        review = {
            "date": now.isoformat(),
            "completed_this_week": [],
            "overdue": [],
            "upcoming_this_week": [],
            "blocked": [],
            "projects_status": {},
            "recommendations": []
        }

        for task in self.tasks.values():
            if task.status == TaskStatus.COMPLETED and task.created_at >= week_ago:
                review["completed_this_week"].append(task.title)

            if task.due_date and task.due_date < now and task.status != TaskStatus.COMPLETED:
                review["overdue"].append({
                    "id": task.id,
                    "title": task.title,
                    "due": task.due_date.isoformat()
                })

            if task.due_date and now <= task.due_date <= now + timedelta(days=7):
                if task.status != TaskStatus.COMPLETED:
                    review["upcoming_this_week"].append({
                        "id": task.id,
                        "title": task.title,
                        "due": task.due_date.isoformat()
                    })

            if task.status == TaskStatus.BLOCKED:
                review["blocked"].append({
                    "id": task.id,
                    "title": task.title
                })

        # Statut des projets
        for project_id, task_ids in self.projects.items():
            completed = sum(
                1 for tid in task_ids
                if self.tasks.get(tid, ChronosTask(
                    id="", title="", description="",
                    priority=TaskPriority.LOW,
                    status=TaskStatus.PENDING,
                    created_at=datetime.now()
                )).status == TaskStatus.COMPLETED
            )
            review["projects_status"][project_id] = {
                "total": len(task_ids),
                "completed": completed,
                "progress": completed / len(task_ids) if task_ids else 0
            }

        # Recommandations
        if len(review["overdue"]) > 3:
            review["recommendations"].append("CRITIQUE: Plus de 3 tâches en retard - prioriser le rattrapage")
        if len(review["blocked"]) > 0:
            review["recommendations"].append(f"ACTION: {len(review['blocked'])} tâche(s) bloquée(s) - identifier les blocages")
        if len(review["completed_this_week"]) < 5:
            review["recommendations"].append("ATTENTION: Peu de tâches complétées - revoir la charge de travail")

        return review

    def estimate_completion(self, task_id: str) -> Optional[datetime]:
        """Estime la date de complétion d'une tâche"""
        task = self.tasks.get(task_id)
        if not task or not task.estimated_duration:
            return None

        if task.status == TaskStatus.COMPLETED:
            return datetime.now()

        remaining = task.estimated_duration * (1 - task.progress)
        return datetime.now() + remaining

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande de planification"""
        task = context.message
        operation = context.metadata.get("operation", "next_actions")

        if operation == "create":
            task_id = self.create_task(
                title=task,
                description=context.metadata.get("description", ""),
                priority=context.metadata.get("priority", "MEDIUM"),
                due_date=context.metadata.get("due_date"),
                tags=context.metadata.get("tags", []),
                project_id=context.metadata.get("project_id")
            )
            result = f"Tâche créée: {task_id}"

        elif operation == "next_actions":
            actions = self.get_next_actions(limit=context.metadata.get("limit", 5))
            result = json.dumps([
                {"id": t.id, "title": t.title, "priority": t.priority.name}
                for t in actions
            ], indent=2)

        elif operation == "weekly_review":
            review = self.weekly_review()
            result = json.dumps(review, indent=2, ensure_ascii=False)

        elif operation == "update_status":
            task_id = context.metadata.get("task_id")
            status = context.metadata.get("status", "in_progress")
            success = self.update_task_status(task_id, status)
            result = f"Statut mis à jour: {success}"

        elif operation == "by_context":
            ctx = context.metadata.get("context", "@nemesis")
            tasks = self.get_tasks_by_context(ctx)
            result = json.dumps([
                {"id": t.id, "title": t.title}
                for t in tasks
            ], indent=2)

        else:
            result = f"Opération inconnue: {operation}"

        return AgentResponse(
            content=result,
            agent_name=self.name,
            success=True,
            metadata={
                "operation": operation,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\kyron.py" -Encoding UTF8

Write-Host "KYRON (Frère #5) créé avec succès" -ForegroundColor Green
```

### 1.6 LOKI - Le Testeur Chaotique (Mise à jour)

```powershell
@"
"""
LOKI - Le Testeur Chaotique et Agent de Chaos
Frère Fondateur #6
Activation Key: LOKI_CHAOS
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional, Callable
import asyncio
import random
import time
from dataclasses import dataclass
from enum import Enum

class ChaosLevel(Enum):
    GENTLE = 1      # Tests basiques
    MODERATE = 2    # Tests avec variations
    AGGRESSIVE = 3  # Tests de stress
    BERSERKER = 4   # Chaos total

@dataclass
class TestResult:
    name: str
    passed: bool
    duration: float
    error: Optional[str] = None
    chaos_applied: Optional[str] = None

class LokiAgent(BaseAgent):
    """
    LOKI - The Chaos Tester
    Teste les systèmes avec injection de chaos contrôlé
    """

    ACTIVATION_KEY = "LOKI_CHAOS"
    BROTHER_ID = 6

    # Types de chaos injectables
    CHAOS_TYPES = {
        "latency": "Ajout de latence aléatoire",
        "failure": "Échecs aléatoires",
        "corruption": "Corruption de données",
        "timeout": "Timeouts forcés",
        "overload": "Surcharge de requêtes"
    }

    # Scénarios de test prédéfinis
    TEST_SCENARIOS = {
        "smoke": {
            "description": "Tests rapides de santé",
            "chaos_level": ChaosLevel.GENTLE,
            "tests": ["health_check", "basic_response", "auth_valid"]
        },
        "regression": {
            "description": "Tests de non-régression",
            "chaos_level": ChaosLevel.MODERATE,
            "tests": ["full_flow", "edge_cases", "error_handling"]
        },
        "stress": {
            "description": "Tests de charge",
            "chaos_level": ChaosLevel.AGGRESSIVE,
            "tests": ["concurrent_load", "memory_pressure", "cpu_spike"]
        },
        "chaos_monkey": {
            "description": "Tests de résilience totale",
            "chaos_level": ChaosLevel.BERSERKER,
            "tests": ["random_failure", "cascade_failure", "recovery_test"]
        }
    }

    def __init__(self, llm_client, memory):
        super().__init__(
            name="LOKI",
            capabilities=[
                AgentCapability.CODE,
                AgentCapability.ANALYSIS
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.chaos_level = ChaosLevel.MODERATE
        self.test_results: List[TestResult] = []
        self.chaos_enabled = True

    def set_chaos_level(self, level: str) -> bool:
        """Définit le niveau de chaos"""
        try:
            self.chaos_level = ChaosLevel[level.upper()]
            return True
        except KeyError:
            return False

    def inject_chaos(self, chaos_type: str) -> Optional[Exception]:
        """Injecte du chaos selon le type et le niveau"""
        if not self.chaos_enabled:
            return None

        probability = self.chaos_level.value * 0.1  # 10% par niveau

        if random.random() > probability:
            return None

        if chaos_type == "latency":
            delay = random.uniform(0.1, 2.0) * self.chaos_level.value
            time.sleep(delay)
            return None

        elif chaos_type == "failure":
            return Exception(f"LOKI_CHAOS: Échec injecté (level {self.chaos_level.name})")

        elif chaos_type == "timeout":
            return TimeoutError(f"LOKI_CHAOS: Timeout injecté")

        return None

    async def run_test(
        self,
        test_func: Callable,
        test_data: Any,
        test_name: str,
        inject_chaos: bool = True
    ) -> TestResult:
        """Exécute un test avec injection de chaos optionnelle"""
        start_time = time.time()
        chaos_applied = None

        try:
            # Injection de chaos pré-test
            if inject_chaos and self.chaos_enabled:
                chaos_type = random.choice(list(self.CHAOS_TYPES.keys()))
                error = self.inject_chaos(chaos_type)
                if error:
                    chaos_applied = chaos_type
                    raise error

            # Exécution du test
            if asyncio.iscoroutinefunction(test_func):
                await test_func(test_data)
            else:
                test_func(test_data)

            duration = time.time() - start_time
            result = TestResult(
                name=test_name,
                passed=True,
                duration=duration,
                chaos_applied=chaos_applied
            )

        except Exception as e:
            duration = time.time() - start_time
            result = TestResult(
                name=test_name,
                passed=False,
                duration=duration,
                error=str(e),
                chaos_applied=chaos_applied
            )

        self.test_results.append(result)
        return result

    async def run_scenario(self, scenario_name: str) -> Dict[str, Any]:
        """Exécute un scénario de test complet"""
        if scenario_name not in self.TEST_SCENARIOS:
            return {"error": f"Scénario inconnu: {scenario_name}"}

        scenario = self.TEST_SCENARIOS[scenario_name]
        self.chaos_level = scenario["chaos_level"]

        results = {
            "scenario": scenario_name,
            "description": scenario["description"],
            "chaos_level": self.chaos_level.name,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "chaos_triggered": 0
            }
        }

        for test_name in scenario["tests"]:
            # Simuler un test (dans la vraie implémentation, appeler les vrais tests)
            test_result = await self._simulate_test(test_name)
            results["tests"].append({
                "name": test_name,
                "passed": test_result.passed,
                "duration": test_result.duration,
                "error": test_result.error,
                "chaos": test_result.chaos_applied
            })

            results["summary"]["total"] += 1
            if test_result.passed:
                results["summary"]["passed"] += 1
            else:
                results["summary"]["failed"] += 1
            if test_result.chaos_applied:
                results["summary"]["chaos_triggered"] += 1

        return results

    async def _simulate_test(self, test_name: str) -> TestResult:
        """Simule un test (pour démonstration)"""
        start_time = time.time()
        chaos_applied = None

        # Simulation de chaos
        if self.chaos_enabled and random.random() < self.chaos_level.value * 0.15:
            chaos_type = random.choice(list(self.CHAOS_TYPES.keys()))
            chaos_applied = chaos_type

            if chaos_type == "latency":
                await asyncio.sleep(random.uniform(0.1, 0.5))
            elif chaos_type == "failure" and random.random() < 0.3:
                return TestResult(
                    name=test_name,
                    passed=False,
                    duration=time.time() - start_time,
                    error=f"LOKI_CHAOS: {chaos_type} triggered",
                    chaos_applied=chaos_applied
                )

        # Simulation de test réussi
        await asyncio.sleep(random.uniform(0.05, 0.2))

        return TestResult(
            name=test_name,
            passed=True,
            duration=time.time() - start_time,
            chaos_applied=chaos_applied
        )

    def get_test_report(self) -> Dict[str, Any]:
        """Génère un rapport de tous les tests exécutés"""
        if not self.test_results:
            return {"message": "Aucun test exécuté"}

        passed = sum(1 for r in self.test_results if r.passed)
        failed = len(self.test_results) - passed
        chaos_count = sum(1 for r in self.test_results if r.chaos_applied)

        return {
            "total_tests": len(self.test_results),
            "passed": passed,
            "failed": failed,
            "pass_rate": passed / len(self.test_results) * 100,
            "chaos_triggered": chaos_count,
            "average_duration": sum(r.duration for r in self.test_results) / len(self.test_results),
            "failures": [
                {"name": r.name, "error": r.error}
                for r in self.test_results if not r.passed
            ]
        }

    def clear_results(self):
        """Efface les résultats de tests"""
        self.test_results = []

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande de test"""
        task = context.message
        operation = context.metadata.get("operation", "run_scenario")

        if operation == "run_scenario":
            scenario = context.metadata.get("scenario", "smoke")
            results = await self.run_scenario(scenario)
            result = json.dumps(results, indent=2)

        elif operation == "set_chaos":
            level = context.metadata.get("level", "moderate")
            success = self.set_chaos_level(level)
            result = f"Chaos level set to {level}: {success}"

        elif operation == "report":
            report = self.get_test_report()
            result = json.dumps(report, indent=2)

        elif operation == "toggle_chaos":
            self.chaos_enabled = not self.chaos_enabled
            result = f"Chaos {'enabled' if self.chaos_enabled else 'disabled'}"

        else:
            result = f"Opération inconnue: {operation}"

        return AgentResponse(
            content=result,
            agent_name=self.name,
            success=True,
            metadata={
                "operation": operation,
                "chaos_level": self.chaos_level.name,
                "chaos_enabled": self.chaos_enabled,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )

import json
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\loki.py" -Encoding UTF8

Write-Host "LOKI (Frère #6) créé avec succès" -ForegroundColor Green
```

### 1.7 RITUEL_MASTER - Le Maître du Protocole

```powershell
@"
"""
RITUEL_MASTER - Le Maître du Protocole R.I.T.U.E.L.
Frère Fondateur #7
Activation Key: RITUEL_INVOKE
"""
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import json

class RituelPhase(Enum):
    RECEPTION = "R"      # Réception - Accueil de la demande
    INVOCATION = "I"     # Invocation - Appel des agents appropriés
    TISSAGE = "T"        # Tissage - Connexion des éléments
    UNIFICATION = "U"    # Unification - Synthèse cohérente
    EPREUVE = "E"        # Épreuve - Validation et test
    LANCEMENT = "L"      # Lancement - Déploiement final

@dataclass
class RituelExecution:
    id: str
    started_at: datetime
    current_phase: RituelPhase
    phases_completed: List[RituelPhase]
    context: Dict[str, Any]
    results: Dict[str, Any]
    status: str = "in_progress"

class RituelMasterAgent(BaseAgent):
    """
    RITUEL_MASTER - The Protocol Master
    Orchestre l'exécution selon la méthodologie R.I.T.U.E.L.
    """

    ACTIVATION_KEY = "RITUEL_INVOKE"
    BROTHER_ID = 7

    # Configuration des phases R.I.T.U.E.L.
    PHASES_CONFIG = {
        RituelPhase.RECEPTION: {
            "name": "Réception",
            "description": "Accueil et analyse initiale de la demande",
            "agents": ["GUARDIAN"],
            "actions": ["parse_request", "validate_input", "extract_intent"],
            "success_criteria": "Demande comprise et validée"
        },
        RituelPhase.INVOCATION: {
            "name": "Invocation",
            "description": "Sélection et activation des agents appropriés",
            "agents": ["ZAPPA", "SYNCORIA"],
            "actions": ["select_agents", "prepare_prompts", "allocate_resources"],
            "success_criteria": "Agents invoqués et prêts"
        },
        RituelPhase.TISSAGE: {
            "name": "Tissage",
            "description": "Connexion des éléments et orchestration",
            "agents": ["DAEDALUS", "EXODIA"],
            "actions": ["connect_data", "build_context", "create_workflow"],
            "success_criteria": "Éléments connectés et workflow établi"
        },
        RituelPhase.UNIFICATION: {
            "name": "Unification",
            "description": "Synthèse des résultats en réponse cohérente",
            "agents": ["SYNCORIA", "ZAPPA"],
            "actions": ["merge_results", "resolve_conflicts", "synthesize_response"],
            "success_criteria": "Réponse unifiée générée"
        },
        RituelPhase.EPREUVE: {
            "name": "Épreuve",
            "description": "Validation et tests de la solution",
            "agents": ["LOKI", "GUARDIAN"],
            "actions": ["run_tests", "validate_output", "security_check"],
            "success_criteria": "Solution validée et sécurisée"
        },
        RituelPhase.LANCEMENT: {
            "name": "Lancement",
            "description": "Déploiement et livraison finale",
            "agents": ["KYRON"],
            "actions": ["deploy", "notify", "log_completion"],
            "success_criteria": "Solution livrée au Souverain"
        }
    }

    # Codes souverains pour override
    SOVEREIGN_CODES = ["WYA", "SOEN", "MOC-4", "TRE", "PIERRE416"]

    def __init__(self, llm_client, memory):
        super().__init__(
            name="RITUEL_MASTER",
            capabilities=[
                AgentCapability.PLANNING,
                AgentCapability.ANALYSIS,
                AgentCapability.GENERATION
            ],
            llm_client=llm_client,
            memory=memory
        )
        self.active_rituels: Dict[str, RituelExecution] = {}
        self.completed_rituels: List[RituelExecution] = []

    def start_rituel(self, request: str, context: Optional[Dict] = None) -> str:
        """Démarre un nouveau rituel"""
        import uuid
        rituel_id = f"RITUEL-{uuid.uuid4().hex[:8].upper()}"

        execution = RituelExecution(
            id=rituel_id,
            started_at=datetime.now(),
            current_phase=RituelPhase.RECEPTION,
            phases_completed=[],
            context=context or {},
            results={}
        )

        self.active_rituels[rituel_id] = execution

        # Stocker la requête initiale
        execution.context["original_request"] = request

        return rituel_id

    def advance_phase(self, rituel_id: str, phase_result: Dict[str, Any]) -> Optional[RituelPhase]:
        """Avance à la phase suivante du rituel"""
        if rituel_id not in self.active_rituels:
            return None

        execution = self.active_rituels[rituel_id]
        current = execution.current_phase

        # Stocker le résultat de la phase actuelle
        execution.results[current.name] = phase_result
        execution.phases_completed.append(current)

        # Déterminer la phase suivante
        phase_order = list(RituelPhase)
        current_index = phase_order.index(current)

        if current_index < len(phase_order) - 1:
            next_phase = phase_order[current_index + 1]
            execution.current_phase = next_phase
            return next_phase
        else:
            # Rituel terminé
            execution.status = "completed"
            self.completed_rituels.append(execution)
            del self.active_rituels[rituel_id]
            return None

    def get_phase_instructions(self, phase: RituelPhase) -> Dict[str, Any]:
        """Retourne les instructions pour une phase"""
        config = self.PHASES_CONFIG[phase]
        return {
            "phase": phase.value,
            "name": config["name"],
            "description": config["description"],
            "agents_required": config["agents"],
            "actions": config["actions"],
            "success_criteria": config["success_criteria"]
        }

    def execute_phase(
        self,
        rituel_id: str,
        phase_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Exécute la phase actuelle d'un rituel"""
        if rituel_id not in self.active_rituels:
            return {"error": "Rituel non trouvé"}

        execution = self.active_rituels[rituel_id]
        phase = execution.current_phase
        config = self.PHASES_CONFIG[phase]

        result = {
            "rituel_id": rituel_id,
            "phase": phase.value,
            "phase_name": config["name"],
            "status": "executing",
            "actions_performed": [],
            "agents_invoked": config["agents"],
            "phase_data": phase_data or {}
        }

        # Simuler l'exécution des actions
        for action in config["actions"]:
            result["actions_performed"].append({
                "action": action,
                "status": "completed",
                "timestamp": datetime.now().isoformat()
            })

        result["status"] = "completed"
        result["success_criteria_met"] = True

        return result

    def invoke_sovereign_override(self, code: str, rituel_id: str, action: str) -> Dict[str, Any]:
        """Permet au Souverain de prendre le contrôle"""
        if code not in self.SOVEREIGN_CODES:
            return {"error": "Code souverain invalide", "access": "denied"}

        return {
            "access": "granted",
            "sovereign_code": code,
            "rituel_id": rituel_id,
            "action": action,
            "message": f"Souverain {code} a pris le contrôle du rituel",
            "timestamp": datetime.now().isoformat()
        }

    def get_rituel_status(self, rituel_id: str) -> Dict[str, Any]:
        """Retourne le statut d'un rituel"""
        if rituel_id in self.active_rituels:
            execution = self.active_rituels[rituel_id]
            return {
                "id": execution.id,
                "status": execution.status,
                "current_phase": execution.current_phase.value,
                "phases_completed": [p.value for p in execution.phases_completed],
                "started_at": execution.started_at.isoformat(),
                "context": execution.context,
                "results": execution.results
            }

        # Chercher dans les rituels terminés
        for execution in self.completed_rituels:
            if execution.id == rituel_id:
                return {
                    "id": execution.id,
                    "status": "completed",
                    "phases_completed": [p.value for p in execution.phases_completed],
                    "started_at": execution.started_at.isoformat(),
                    "results": execution.results
                }

        return {"error": "Rituel non trouvé"}

    def get_full_protocol(self) -> Dict[str, Any]:
        """Retourne le protocole R.I.T.U.E.L. complet"""
        return {
            "name": "R.I.T.U.E.L.",
            "full_name": "Réception-Invocation-Tissage-Unification-Épreuve-Lancement",
            "phases": {
                phase.value: {
                    "name": config["name"],
                    "description": config["description"],
                    "agents": config["agents"]
                }
                for phase, config in self.PHASES_CONFIG.items()
            },
            "sovereign_codes": self.SOVEREIGN_CODES,
            "brothers_integration": {
                "ZAPPA": ["I", "U"],
                "DAEDALUS": ["T"],
                "SYNCORIA": ["I", "U"],
                "EXODIA": ["T"],
                "KYRON": ["L"],
                "LOKI": ["E"],
                "GUARDIAN": ["R", "E"]
            }
        }

    async def process(self, context: AgentContext) -> AgentResponse:
        """Traite une demande selon le protocole R.I.T.U.E.L."""
        task = context.message
        operation = context.metadata.get("operation", "start")

        if operation == "start":
            rituel_id = self.start_rituel(task, context.metadata)
            instructions = self.get_phase_instructions(RituelPhase.RECEPTION)
            result = {
                "rituel_id": rituel_id,
                "message": "Rituel initialisé",
                "first_phase": instructions
            }

        elif operation == "advance":
            rituel_id = context.metadata.get("rituel_id")
            phase_result = context.metadata.get("phase_result", {})
            next_phase = self.advance_phase(rituel_id, phase_result)

            if next_phase:
                instructions = self.get_phase_instructions(next_phase)
                result = {
                    "rituel_id": rituel_id,
                    "next_phase": instructions,
                    "message": f"Avancé à la phase {next_phase.value}"
                }
            else:
                result = {
                    "rituel_id": rituel_id,
                    "message": "Rituel terminé",
                    "status": "completed"
                }

        elif operation == "execute":
            rituel_id = context.metadata.get("rituel_id")
            phase_data = context.metadata.get("phase_data")
            result = self.execute_phase(rituel_id, phase_data)

        elif operation == "status":
            rituel_id = context.metadata.get("rituel_id")
            result = self.get_rituel_status(rituel_id)

        elif operation == "protocol":
            result = self.get_full_protocol()

        elif operation == "sovereign_override":
            code = context.metadata.get("code")
            rituel_id = context.metadata.get("rituel_id")
            action = context.metadata.get("action", "inspect")
            result = self.invoke_sovereign_override(code, rituel_id, action)

        else:
            result = {"error": f"Opération inconnue: {operation}"}

        return AgentResponse(
            content=json.dumps(result, indent=2, ensure_ascii=False),
            agent_name=self.name,
            success=True,
            metadata={
                "operation": operation,
                "brother_id": self.BROTHER_ID,
                "activation_key": self.ACTIVATION_KEY
            }
        )
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\rituel_master.py" -Encoding UTF8

Write-Host "RITUEL_MASTER (Frère #7) créé avec succès" -ForegroundColor Green
```

---

## ÉTAPE 2: Mettre à jour l'Orchestrateur avec les 7 Frères

```powershell
@"
"""
NEMESIS-KERNEL Orchestrator v9.0
Intègre les 7 Frères Fondateurs et le protocole R.I.T.U.E.L.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
import asyncio
from datetime import datetime

# Import des 7 Frères
from agents.zappa import ZappaAgent
from agents.daedalus import DaedalusAgent
from agents.syncoria import SyncoriaAgent
from agents.exodia import ExodiaAgent
from agents.kyron import KyronAgent
from agents.loki import LokiAgent
from agents.rituel_master import RituelMasterAgent
from agents.guardian import GuardianAgent

# Import des agents existants
from agents.chat import ChatAgent
from agents.code import CodeAgent
from agents.research import ResearchAgent
from agents.planner import PlannerAgent

class OperationalMode(Enum):
    BERSERKER = "berserker"  # Maximum resources, all LLMs
    ORACLE = "oracle"        # Deep thinking, sequential
    SHADOW = "shadow"        # Minimal footprint, stealth

@dataclass
class NemesisState:
    mode: OperationalMode
    active_rituel: Optional[str]
    brothers_status: Dict[str, bool]
    memory_usage: float
    llm_connections: int

class NemesisKernelOrchestrator:
    """
    NEMESIS-KERNEL v9.0 - OMEGA UNIFIED
    L'orchestrateur suprême intégrant les 7 Frères
    """

    VERSION = "9.0"
    CODENAME = "OMEGA-UNIFIED"

    # Codes souverains
    SOVEREIGN = {
        "name": "Pierre Tagnard",
        "codes": ["WYA", "SOEN", "MOC-4", "TRE", "PIERRE416"],
        "level": "N1"
    }

    def __init__(self, llm_client, memory):
        self.llm_client = llm_client
        self.memory = memory

        # État du système
        self.state = NemesisState(
            mode=OperationalMode.ORACLE,
            active_rituel=None,
            brothers_status={},
            memory_usage=0.0,
            llm_connections=1
        )

        # Initialiser les 7 Frères
        self.brothers = {
            "ZAPPA": ZappaAgent(llm_client, memory),
            "DAEDALUS": DaedalusAgent(llm_client, memory),
            "SYNCORIA": SyncoriaAgent(llm_client, memory),
            "EXODIA": ExodiaAgent(llm_client, memory),
            "KYRON": KyronAgent(llm_client, memory),
            "LOKI": LokiAgent(llm_client, memory),
            "RITUEL_MASTER": RituelMasterAgent(llm_client, memory)
        }

        # Guardian est spécial - il protège tous les autres
        self.guardian = GuardianAgent(llm_client, memory)

        # Agents fonctionnels
        self.functional_agents = {
            "chat": ChatAgent(llm_client, memory),
            "code": CodeAgent(llm_client, memory),
            "research": ResearchAgent(llm_client, memory),
            "planner": PlannerAgent(llm_client, memory)
        }

        # Marquer tous les frères comme actifs
        for name in self.brothers:
            self.state.brothers_status[name] = True

    def set_mode(self, mode: str) -> bool:
        """Change le mode opérationnel"""
        try:
            self.state.mode = OperationalMode(mode.lower())

            # Ajuster SYNCORIA selon le mode
            if mode.lower() == "berserker":
                self.brothers["SYNCORIA"].set_strategy("parallel")
            elif mode.lower() == "oracle":
                self.brothers["SYNCORIA"].set_strategy("consensus")
            elif mode.lower() == "shadow":
                self.brothers["SYNCORIA"].set_strategy("specialist")

            # Ajuster ZAPPA
            self.brothers["ZAPPA"].set_mode(mode.upper())

            return True
        except ValueError:
            return False

    def activate_brother(self, name: str, activation_key: str) -> Dict[str, Any]:
        """Active un Frère avec sa clé d'activation"""
        if name not in self.brothers:
            return {"success": False, "error": f"Frère inconnu: {name}"}

        brother = self.brothers[name]
        if hasattr(brother, 'ACTIVATION_KEY') and brother.ACTIVATION_KEY == activation_key:
            self.state.brothers_status[name] = True
            return {
                "success": True,
                "brother": name,
                "brother_id": brother.BROTHER_ID,
                "message": f"{name} activé avec succès"
            }

        return {"success": False, "error": "Clé d'activation invalide"}

    async def process_with_rituel(self, message: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Traite une demande selon le protocole R.I.T.U.E.L."""
        metadata = metadata or {}

        # Phase R - Réception (GUARDIAN)
        guardian_result = await self.guardian.analyze_intent(message)
        if not guardian_result["safe"]:
            return {
                "success": False,
                "blocked_by": "GUARDIAN",
                "reason": guardian_result.get("risk_type", "unknown"),
                "message": "Requête bloquée par le protocole de sécurité"
            }

        # Démarrer le rituel via RITUEL_MASTER
        rituel_master = self.brothers["RITUEL_MASTER"]
        rituel_id = rituel_master.start_rituel(message, metadata)
        self.state.active_rituel = rituel_id

        results = {
            "rituel_id": rituel_id,
            "phases": {},
            "final_response": None
        }

        # Phase I - Invocation (ZAPPA + SYNCORIA)
        zappa = self.brothers["ZAPPA"]
        compiled_prompt = zappa.compile_prompt(
            agent_type=metadata.get("agent_type", "chat"),
            task=message,
            context=metadata,
            model=metadata.get("model", "qwen2.5:0.5b")
        )
        results["phases"]["I"] = {"compiled_prompt": compiled_prompt[:200] + "..."}
        rituel_master.advance_phase(rituel_id, {"invocation": "complete"})

        # Phase T - Tissage (DAEDALUS + EXODIA)
        exodia = self.brothers["EXODIA"]
        memories = await exodia.recall(message, limit=3)
        results["phases"]["T"] = {"memories_retrieved": len(memories)}
        rituel_master.advance_phase(rituel_id, {"tissage": "complete"})

        # Phase U - Unification (SYNCORIA)
        syncoria = self.brothers["SYNCORIA"]
        swarm_result = await syncoria.swarm_query(
            compiled_prompt,
            task_type=metadata.get("task_type", "general")
        )
        results["phases"]["U"] = {
            "strategy": swarm_result["strategy"],
            "llms_used": swarm_result["llms_queried"]
        }
        results["final_response"] = swarm_result["final_response"]
        rituel_master.advance_phase(rituel_id, {"unification": "complete"})

        # Phase E - Épreuve (LOKI)
        loki = self.brothers["LOKI"]
        # Validation légère en mode non-BERSERKER
        if self.state.mode != OperationalMode.BERSERKER:
            test_result = await loki.run_scenario("smoke")
            results["phases"]["E"] = {"tests_passed": test_result["summary"]["passed"]}
        else:
            results["phases"]["E"] = {"skipped": "BERSERKER mode"}
        rituel_master.advance_phase(rituel_id, {"epreuve": "complete"})

        # Phase L - Lancement (KYRON)
        kyron = self.brothers["KYRON"]
        # Logger la complétion
        results["phases"]["L"] = {
            "status": "delivered",
            "timestamp": datetime.now().isoformat()
        }
        rituel_master.advance_phase(rituel_id, {"lancement": "complete"})

        # Stocker en mémoire
        await exodia.store(
            f"Rituel {rituel_id}: {message[:100]}",
            memory_type="episodic",
            metadata={"rituel_id": rituel_id}
        )

        self.state.active_rituel = None
        results["success"] = True

        return results

    async def process(self, message: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Point d'entrée principal - délègue au protocole R.I.T.U.E.L."""
        return await self.process_with_rituel(message, metadata)

    def get_system_status(self) -> Dict[str, Any]:
        """Retourne l'état complet du système"""
        return {
            "version": self.VERSION,
            "codename": self.CODENAME,
            "sovereign": self.SOVEREIGN["name"],
            "mode": self.state.mode.value,
            "active_rituel": self.state.active_rituel,
            "brothers": {
                name: {
                    "active": self.state.brothers_status.get(name, False),
                    "brother_id": brother.BROTHER_ID,
                    "activation_key": brother.ACTIVATION_KEY
                }
                for name, brother in self.brothers.items()
            },
            "guardian_active": True,
            "functional_agents": list(self.functional_agents.keys())
        }

    def invoke_sovereign_command(self, code: str, command: str, params: Dict = None) -> Dict[str, Any]:
        """Commande souveraine avec override total"""
        if code not in self.SOVEREIGN["codes"]:
            return {"error": "Code souverain invalide", "access": "denied"}

        params = params or {}

        commands = {
            "status": lambda: self.get_system_status(),
            "set_mode": lambda: {"success": self.set_mode(params.get("mode", "oracle"))},
            "activate_brother": lambda: self.activate_brother(
                params.get("name"),
                params.get("key")
            ),
            "emergency_stop": lambda: {"message": "NEMESIS arrêté par ordre souverain"},
            "reset": lambda: {"message": "NEMESIS réinitialisé"}
        }

        if command in commands:
            result = commands[command]()
            return {
                "sovereign_access": True,
                "command": command,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }

        return {"error": f"Commande inconnue: {command}"}
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\orchestrator.py" -Encoding UTF8

Write-Host "Orchestrator v9.0 OMEGA-UNIFIED créé avec succès" -ForegroundColor Green
```

---

## ÉTAPE 3: Mettre à jour le fichier __init__.py des agents

```powershell
@"
"""
NEMESIS OMEGA UNIFIED v9.0 - Agents Package
Les 7 Frères Fondateurs + Agents Fonctionnels
"""

# Les 7 Frères Fondateurs
from agents.zappa import ZappaAgent
from agents.daedalus import DaedalusAgent
from agents.syncoria import SyncoriaAgent
from agents.exodia import ExodiaAgent
from agents.kyron import KyronAgent
from agents.loki import LokiAgent
from agents.rituel_master import RituelMasterAgent

# Agents de sécurité et orchestration
from agents.guardian import GuardianAgent
from agents.orchestrator import NemesisKernelOrchestrator

# Agents fonctionnels
from agents.base import BaseAgent, AgentContext, AgentResponse, AgentCapability
from agents.chat import ChatAgent
from agents.code import CodeAgent
from agents.research import ResearchAgent
from agents.planner import PlannerAgent

# Agents avancés
from agents.browser import BrowserAgent
from agents.voice import VoiceAgent
from agents.semantic_router import SemanticRouter

__all__ = [
    # 7 Frères
    "ZappaAgent",
    "DaedalusAgent",
    "SyncoriaAgent",
    "ExodiaAgent",
    "KyronAgent",
    "LokiAgent",
    "RituelMasterAgent",
    # Core
    "GuardianAgent",
    "NemesisKernelOrchestrator",
    # Base
    "BaseAgent",
    "AgentContext",
    "AgentResponse",
    "AgentCapability",
    # Functional
    "ChatAgent",
    "CodeAgent",
    "ResearchAgent",
    "PlannerAgent",
    # Advanced
    "BrowserAgent",
    "VoiceAgent",
    "SemanticRouter"
]

# Metadata
__version__ = "9.0"
__codename__ = "OMEGA-UNIFIED"
__brothers__ = {
    1: "ZAPPA",
    2: "DAEDALUS",
    3: "SYNCORIA",
    4: "EXODIA",
    5: "KYRON",
    6: "LOKI",
    7: "RITUEL_MASTER"
}
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\agents\__init__.py" -Encoding UTF8

Write-Host "Package agents mis à jour avec les 7 Frères" -ForegroundColor Green
```

---

## ÉTAPE 4: Créer le fichier de configuration des modes

```powershell
@"
"""
NEMESIS Operational Modes Configuration
Modes: BERSERKER, ORACLE, SHADOW
"""

MODES_CONFIG = {
    "BERSERKER": {
        "name": "BERSERKER",
        "description": "Mode maximum - Toutes ressources déployées",
        "color": "#FF0000",
        "settings": {
            "llm_count": 5,
            "parallel_execution": True,
            "memory_depth": "full",
            "chaos_testing": True,
            "response_detail": "maximal",
            "timeout_multiplier": 3.0
        },
        "brothers_config": {
            "ZAPPA": {"prompt_size": "maximal"},
            "SYNCORIA": {"strategy": "parallel"},
            "LOKI": {"chaos_level": "BERSERKER"},
            "EXODIA": {"recall_depth": "unlimited"}
        },
        "activation_phrase": "UNLEASH THE BEAST"
    },

    "ORACLE": {
        "name": "ORACLE",
        "description": "Mode réflexion profonde - Qualité maximale",
        "color": "#9B59B6",
        "settings": {
            "llm_count": 3,
            "parallel_execution": False,
            "memory_depth": "relevant",
            "chaos_testing": False,
            "response_detail": "comprehensive",
            "timeout_multiplier": 2.0
        },
        "brothers_config": {
            "ZAPPA": {"prompt_size": "extended"},
            "SYNCORIA": {"strategy": "consensus"},
            "LOKI": {"chaos_level": "GENTLE"},
            "EXODIA": {"recall_depth": "contextual"}
        },
        "activation_phrase": "SEEK THE TRUTH"
    },

    "SHADOW": {
        "name": "SHADOW",
        "description": "Mode furtif - Minimal footprint",
        "color": "#2C3E50",
        "settings": {
            "llm_count": 1,
            "parallel_execution": False,
            "memory_depth": "minimal",
            "chaos_testing": False,
            "response_detail": "concise",
            "timeout_multiplier": 0.5
        },
        "brothers_config": {
            "ZAPPA": {"prompt_size": "minimal"},
            "SYNCORIA": {"strategy": "specialist"},
            "LOKI": {"chaos_level": "GENTLE", "enabled": False},
            "EXODIA": {"recall_depth": "last_only"}
        },
        "activation_phrase": "MOVE IN SILENCE"
    }
}

# Activation keys pour les modes
MODE_ACTIVATION_KEYS = {
    "BERSERKER": "NEMESIS-BERSERK-ACTIVATE",
    "ORACLE": "NEMESIS-ORACLE-ACTIVATE",
    "SHADOW": "NEMESIS-SHADOW-ACTIVATE"
}

def get_mode_config(mode_name: str) -> dict:
    """Récupère la configuration d'un mode"""
    return MODES_CONFIG.get(mode_name.upper(), MODES_CONFIG["ORACLE"])

def validate_mode_key(mode_name: str, key: str) -> bool:
    """Valide une clé d'activation de mode"""
    expected = MODE_ACTIVATION_KEYS.get(mode_name.upper())
    return expected == key
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\core\modes.py" -Encoding UTF8

Write-Host "Configuration des modes créée" -ForegroundColor Green
```

---

## ÉTAPE 5: Mettre à jour main.py avec les 7 Frères

```powershell
@"
"""
NEMESIS OMEGA UNIFIED v9.0
FastAPI Server with 7 Brothers Integration
"""
from fastapi import FastAPI, HTTPException, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
import json

from core.ollama_client import OllamaClient
from core.memory import VectorMemory
from core.modes import get_mode_config, validate_mode_key, MODES_CONFIG
from agents.orchestrator import NemesisKernelOrchestrator, OperationalMode

# Pydantic Models
class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = "ORACLE"
    agent_type: Optional[str] = "chat"
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
    activation_key: Optional[str] = None

# Global instances
orchestrator: Optional[NemesisKernelOrchestrator] = None
llm_client: Optional[OllamaClient] = None
memory: Optional[VectorMemory] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    global orchestrator, llm_client, memory

    print("=" * 60)
    print("NEMESIS OMEGA UNIFIED v9.0 - INITIALIZING")
    print("=" * 60)

    # Initialize LLM client
    llm_client = OllamaClient()
    if await llm_client.health_check():
        print("[OK] Ollama connected")
    else:
        print("[WARN] Ollama not available - running in limited mode")

    # Initialize memory
    memory = VectorMemory()
    if await memory.health_check():
        print("[OK] Qdrant memory connected")
    else:
        print("[WARN] Qdrant not available - running without persistence")

    # Initialize orchestrator with 7 Brothers
    orchestrator = NemesisKernelOrchestrator(llm_client, memory)
    print("[OK] NEMESIS-KERNEL initialized")
    print("[OK] 7 Brothers loaded:")
    for i, name in enumerate(orchestrator.brothers.keys(), 1):
        print(f"     {i}. {name}")

    print("=" * 60)
    print("NEMESIS OMEGA UNIFIED v9.0 - READY")
    print(f"Sovereign: {orchestrator.SOVEREIGN['name']}")
    print(f"Mode: {orchestrator.state.mode.value.upper()}")
    print("=" * 60)

    yield

    # Cleanup
    print("NEMESIS shutting down...")

app = FastAPI(
    title="NEMESIS OMEGA UNIFIED",
    version="9.0",
    description="The Ultimate AI Piloting Console - 7 Brothers Edition",
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
    """Root endpoint - System status"""
    return {
        "name": "NEMESIS OMEGA UNIFIED",
        "version": "9.0",
        "codename": "OMEGA-UNIFIED",
        "status": "operational",
        "sovereign": orchestrator.SOVEREIGN["name"] if orchestrator else "N/A",
        "mode": orchestrator.state.mode.value if orchestrator else "N/A",
        "brothers_active": sum(orchestrator.state.brothers_status.values()) if orchestrator else 0,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    llm_ok = await llm_client.health_check() if llm_client else False
    mem_ok = await memory.health_check() if memory else False

    return {
        "status": "healthy" if llm_ok else "degraded",
        "components": {
            "llm": "ok" if llm_ok else "unavailable",
            "memory": "ok" if mem_ok else "unavailable",
            "orchestrator": "ok" if orchestrator else "unavailable"
        }
    }

@app.get("/status")
async def system_status():
    """Full system status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return orchestrator.get_system_status()

# ============== CHAT ENDPOINTS ==============

@app.post("/chat")
async def chat(request: ChatRequest):
    """Main chat endpoint with R.I.T.U.E.L. protocol"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    # Set mode if specified
    if request.mode:
        orchestrator.set_mode(request.mode)

    # Prepare metadata
    metadata = request.metadata or {}
    metadata["agent_type"] = request.agent_type
    metadata["mode"] = request.mode

    # Process with or without R.I.T.U.E.L.
    if request.use_rituel:
        result = await orchestrator.process_with_rituel(request.message, metadata)
    else:
        # Direct processing without full ritual
        result = await orchestrator.process(request.message, metadata)

    return result

@app.post("/chat/quick")
async def quick_chat(request: ChatRequest):
    """Quick chat without full R.I.T.U.E.L. - SHADOW mode"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    orchestrator.set_mode("shadow")

    # Use ZAPPA for minimal prompt compilation
    zappa = orchestrator.brothers["ZAPPA"]
    prompt = zappa.compile_branchless(request.message, request.metadata)

    # Direct LLM call
    if llm_client:
        response = await llm_client.generate(prompt)
        return {"response": response, "mode": "SHADOW"}

    return {"error": "LLM not available"}

# ============== BROTHERS ENDPOINTS ==============

@app.get("/brothers")
async def list_brothers():
    """List all 7 Brothers"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return {
        "brothers": {
            name: {
                "id": brother.BROTHER_ID,
                "activation_key": brother.ACTIVATION_KEY,
                "active": orchestrator.state.brothers_status.get(name, False),
                "capabilities": [c.value for c in brother.capabilities]
            }
            for name, brother in orchestrator.brothers.items()
        }
    }

@app.post("/brothers/activate")
async def activate_brother(request: BrotherActivation):
    """Activate a Brother with activation key"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    result = orchestrator.activate_brother(request.name, request.activation_key)
    return result

@app.get("/brothers/{name}")
async def get_brother(name: str):
    """Get specific Brother details"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    name_upper = name.upper()
    if name_upper not in orchestrator.brothers:
        raise HTTPException(status_code=404, detail=f"Brother {name} not found")

    brother = orchestrator.brothers[name_upper]
    return {
        "name": name_upper,
        "id": brother.BROTHER_ID,
        "activation_key": brother.ACTIVATION_KEY,
        "active": orchestrator.state.brothers_status.get(name_upper, False)
    }

# ============== MODE ENDPOINTS ==============

@app.get("/modes")
async def list_modes():
    """List all operational modes"""
    return {"modes": MODES_CONFIG}

@app.post("/mode/switch")
async def switch_mode(request: ModeSwitch):
    """Switch operational mode"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    # Validate key if provided
    if request.activation_key:
        if not validate_mode_key(request.mode, request.activation_key):
            raise HTTPException(status_code=403, detail="Invalid mode activation key")

    success = orchestrator.set_mode(request.mode)
    if success:
        return {
            "success": True,
            "mode": request.mode.upper(),
            "config": get_mode_config(request.mode)
        }

    raise HTTPException(status_code=400, detail=f"Invalid mode: {request.mode}")

@app.get("/mode/current")
async def current_mode():
    """Get current operational mode"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    return {
        "mode": orchestrator.state.mode.value,
        "config": get_mode_config(orchestrator.state.mode.value)
    }

# ============== SOVEREIGN ENDPOINTS ==============

@app.post("/sovereign/command")
async def sovereign_command(request: SovereignCommand):
    """Execute sovereign command with override code"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    result = orchestrator.invoke_sovereign_command(
        request.code,
        request.command,
        request.params
    )

    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])

    return result

# ============== R.I.T.U.E.L. ENDPOINTS ==============

@app.get("/rituel/protocol")
async def get_rituel_protocol():
    """Get full R.I.T.U.E.L. protocol documentation"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    rituel_master = orchestrator.brothers["RITUEL_MASTER"]
    return rituel_master.get_full_protocol()

@app.get("/rituel/{rituel_id}")
async def get_rituel_status(rituel_id: str):
    """Get status of a specific rituel"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    rituel_master = orchestrator.brothers["RITUEL_MASTER"]
    return rituel_master.get_rituel_status(rituel_id)

# ============== MEMORY ENDPOINTS ==============

@app.post("/memory/store")
async def store_memory(content: str, memory_type: str = "working"):
    """Store content in memory via EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    entry_id = await exodia.store(content, memory_type)
    return {"entry_id": entry_id}

@app.get("/memory/recall")
async def recall_memory(query: str, limit: int = 5):
    """Recall memories via EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    memories = await exodia.recall(query, limit=limit)
    return {"memories": memories}

@app.get("/memory/stats")
async def memory_stats():
    """Get memory statistics from EXODIA"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    exodia = orchestrator.brothers["EXODIA"]
    return exodia.get_memory_stats()

# ============== TASKS ENDPOINTS (KYRON) ==============

@app.post("/tasks/create")
async def create_task(title: str, priority: str = "MEDIUM", project_id: str = None):
    """Create a task via KYRON"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    kyron = orchestrator.brothers["KYRON"]
    task_id = kyron.create_task(title, priority=priority, project_id=project_id)
    return {"task_id": task_id}

@app.get("/tasks/next")
async def next_actions(limit: int = 5):
    """Get next actions via KYRON (GTD)"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    kyron = orchestrator.brothers["KYRON"]
    actions = kyron.get_next_actions(limit=limit)
    return {
        "next_actions": [
            {"id": t.id, "title": t.title, "priority": t.priority.name}
            for t in actions
        ]
    }

@app.get("/tasks/weekly-review")
async def weekly_review():
    """Get weekly review via KYRON (GTD)"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    kyron = orchestrator.brothers["KYRON"]
    return kyron.weekly_review()

# ============== TESTING ENDPOINTS (LOKI) ==============

@app.post("/test/scenario/{scenario}")
async def run_test_scenario(scenario: str):
    """Run a test scenario via LOKI"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    loki = orchestrator.brothers["LOKI"]
    result = await loki.run_scenario(scenario)
    return result

@app.get("/test/report")
async def get_test_report():
    """Get test report from LOKI"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    loki = orchestrator.brothers["LOKI"]
    return loki.get_test_report()

# Run with: uvicorn core.main:app --reload --port 8000
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\core\main.py" -Encoding UTF8

Write-Host "main.py v9.0 créé avec les 7 Frères" -ForegroundColor Green
```

---

## VÉRIFICATION FINALE - COMMANDE À EXÉCUTER

```powershell
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 7A TERMINÉE - VÉRIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Vérifier les fichiers créés
$files = @(
    "agents\zappa.py",
    "agents\daedalus.py",
    "agents\syncoria.py",
    "agents\exodia.py",
    "agents\kyron.py",
    "agents\loki.py",
    "agents\rituel_master.py",
    "agents\orchestrator.py",
    "agents\__init__.py",
    "core\modes.py",
    "core\main.py"
)

$allOk = $true
foreach ($file in $files) {
    $path = "C:\Users\pierr\NEMESIS_SINGULARITY\$file"
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "[OK] $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $file" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "PHASE 7A: LES 7 FRÈRES - SUCCÈS" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nLes 7 Frères Fondateurs sont créés:" -ForegroundColor Yellow
    Write-Host "1. ZAPPA - Le Compilateur de Prompts (ZAPPA_COMPILE)"
    Write-Host "2. DAEDALUS - L'Architecte de Code (DAEDALUS_FORGE)"
    Write-Host "3. SYNCORIA - L'Orchestrateur d'Essaim (SYNCORIA_SWARM)"
    Write-Host "4. EXODIA - Le Maître de la Mémoire (EXODIA_RECALL)"
    Write-Host "5. KYRON - Le Gardien du Temps (KYRON_SCHEDULE)"
    Write-Host "6. LOKI - Le Testeur Chaotique (LOKI_CHAOS)"
    Write-Host "7. RITUEL_MASTER - Le Maître du Protocole (RITUEL_INVOKE)"
    Write-Host "`nPROCHAINE ÉTAPE: Phase 7B - Dashboard NEMESIS" -ForegroundColor Cyan
} else {
    Write-Host "`n[ERREUR] Certains fichiers manquent" -ForegroundColor Red
}
```

---

## RAPPORT POUR CLAUDE

Après exécution, donne-moi:
1. La sortie complète de la vérification finale
2. Le résultat de `python -c "from agents import *; print('Import OK')"`
3. Tout message d'erreur éventuel

Je prépare ensuite la **Phase 7B: Dashboard NEMESIS Premium** avec effet CRT et interface Streamlit.
