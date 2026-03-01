"""
NEMESIS Surface Layer — Cascade Escalation Engine
Flow: Sonnet 4.6 → Opus 4.6 → Claude Code ×3 workers

Implémente l'escalade automatique entre modèles quand la qualité
de la réponse est insuffisante. Chaque niveau est évalué via un
score de qualité avant escalade.
"""

import json
import time
import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List, Callable

logger = logging.getLogger(__name__)


class EscalationLevel(Enum):
    """Niveaux dans la chaîne d'escalade."""
    SONNET = 1     # Tentative initiale — rapide, économique
    OPUS = 2       # Escalade — raisonnement complexe
    CODE_X3 = 3    # Escalade max — 3 workers Claude Code en parallèle


@dataclass
class QualityCheckResult:
    """Résultat de l'évaluation qualité d'une réponse."""
    score: float                  # 0.0 - 1.0
    passed: bool                  # True si score >= seuil
    checks: Dict[str, bool] = field(default_factory=dict)
    feedback: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "passed": self.passed,
            "checks": self.checks,
            "feedback": self.feedback,
        }


@dataclass
class EscalationStep:
    """Enregistrement d'une étape dans l'escalade."""
    level: EscalationLevel
    model: str
    response: str
    quality: QualityCheckResult
    cost_usd: float
    latency_ms: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class CascadeResult:
    """Résultat final de la cascade d'escalade."""
    final_response: str
    final_level: EscalationLevel
    total_cost_usd: float
    total_latency_ms: float
    steps: List[EscalationStep] = field(default_factory=list)
    escalation_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "final_level": self.final_level.name,
            "total_cost_usd": self.total_cost_usd,
            "total_latency_ms": self.total_latency_ms,
            "escalation_count": self.escalation_count,
            "steps": [
                {
                    "level": s.level.name,
                    "model": s.model,
                    "quality_score": s.quality.score,
                    "passed": s.quality.passed,
                    "cost_usd": s.cost_usd,
                    "latency_ms": s.latency_ms,
                }
                for s in self.steps
            ],
        }


class QualityEvaluator:
    """
    Évalue la qualité d'une réponse selon plusieurs critères.
    Utilisé pour décider si on escalade au niveau suivant.
    """

    def __init__(self, threshold: float = 0.7):
        self.threshold = threshold

    def evaluate(
        self,
        response: str,
        original_request: str,
        expected_elements: Optional[List[str]] = None,
    ) -> QualityCheckResult:
        """
        Évalue la qualité de la réponse.

        Critères:
        1. Longueur suffisante (vs. requête)
        2. Densité informative (ratio contenu utile / total)
        3. Présence des éléments attendus (si checklist fournie)
        4. Cohérence structurelle (titres, listes, formatage)
        5. Absence de phrases vagues / hallucinations détectables
        """
        checks: Dict[str, bool] = {}
        scores: List[float] = []

        # --- Check 1: Length adequacy ---
        request_words = len(original_request.split())
        response_words = len(response.split())
        # Response should be at least 2x request length for substantive tasks
        length_ratio = response_words / max(request_words, 1)
        length_ok = length_ratio >= 1.5 or response_words >= 100
        checks["length_adequate"] = length_ok
        scores.append(1.0 if length_ok else min(length_ratio / 1.5, 0.9))

        # --- Check 2: Informative density ---
        filler_phrases = [
            "il est important de noter",
            "en conclusion",
            "comme mentionné",
            "il convient de",
            "dans ce contexte",
            "de manière générale",
        ]
        filler_count = sum(1 for p in filler_phrases if p in response.lower())
        filler_ratio = filler_count / max(len(response.split(".")), 1)
        density_ok = filler_ratio < 0.3
        checks["informative_density"] = density_ok
        scores.append(1.0 if density_ok else 0.5)

        # --- Check 3: Expected elements (if checklist provided) ---
        if expected_elements:
            found = sum(
                1 for elem in expected_elements
                if elem.lower() in response.lower()
            )
            coverage = found / len(expected_elements)
            checks["expected_elements"] = coverage >= 0.7
            scores.append(coverage)
        else:
            scores.append(0.8)  # Neutral if no checklist

        # --- Check 4: Structural coherence ---
        has_structure = any([
            "##" in response,
            "- " in response,
            "1." in response,
            "```" in response,
        ])
        # Only expect structure for longer responses
        structure_ok = has_structure or response_words < 100
        checks["structural_coherence"] = structure_ok
        scores.append(1.0 if structure_ok else 0.6)

        # --- Check 5: No vague/empty answers ---
        vague_patterns = [
            "je ne suis pas sûr",
            "je ne peux pas",
            "cela dépend",
            "il faudrait plus d'informations",
            "i cannot",
            "i'm not sure",
        ]
        is_vague = any(p in response.lower() for p in vague_patterns)
        checks["not_vague"] = not is_vague
        scores.append(0.3 if is_vague else 1.0)

        # --- Aggregate score ---
        avg_score = sum(scores) / len(scores)
        passed = avg_score >= self.threshold

        feedback = ""
        if not passed:
            failed_checks = [k for k, v in checks.items() if not v]
            feedback = f"Qualité insuffisante ({avg_score:.2f} < {self.threshold}). Échecs: {', '.join(failed_checks)}"

        return QualityCheckResult(
            score=round(avg_score, 3),
            passed=passed,
            checks=checks,
            feedback=feedback,
        )


class CascadeEngine:
    """
    Moteur d'escalade en cascade Sonnet → Opus → Code ×3.

    Usage:
        engine = CascadeEngine(call_model_fn=my_api_caller)
        result = await engine.execute("Analyse ce patrimoine complexe...")
    """

    LEVEL_CONFIG = {
        EscalationLevel.SONNET: {
            "model": "claude-sonnet-4-6",
            "display": "Claude Sonnet 4.6",
            "cost_per_1k_input": 0.003,
            "cost_per_1k_output": 0.015,
            "timeout_ms": 30000,
        },
        EscalationLevel.OPUS: {
            "model": "claude-opus-4-6",
            "display": "Claude Opus 4.6",
            "cost_per_1k_input": 0.015,
            "cost_per_1k_output": 0.075,
            "timeout_ms": 60000,
        },
        EscalationLevel.CODE_X3: {
            "model": "claude-code",
            "display": "Claude Code ×3 Workers",
            "cost_per_1k_input": 0.015,
            "cost_per_1k_output": 0.075,
            "timeout_ms": 120000,
            "parallel_workers": 3,
        },
    }

    def __init__(
        self,
        call_model_fn: Optional[Callable] = None,
        quality_threshold: float = 0.7,
        max_budget_usd: float = 2.0,
        slack_webhook_url: Optional[str] = None,
    ):
        """
        Args:
            call_model_fn: async fn(model, prompt, **kwargs) -> str
            quality_threshold: Score minimum pour accepter une réponse
            max_budget_usd: Budget max pour une cascade complète
            slack_webhook_url: URL webhook pour poster les résultats
        """
        self.call_model = call_model_fn
        self.evaluator = QualityEvaluator(threshold=quality_threshold)
        self.max_budget = max_budget_usd
        self.slack_webhook = slack_webhook_url

    async def execute(
        self,
        prompt: str,
        expected_elements: Optional[List[str]] = None,
        start_level: EscalationLevel = EscalationLevel.SONNET,
        context: Optional[str] = None,
    ) -> CascadeResult:
        """
        Exécute la cascade d'escalade.

        Args:
            prompt: La requête utilisateur
            expected_elements: Checklist d'éléments attendus dans la réponse
            start_level: Niveau de départ (défaut: Sonnet)
            context: Contexte additionnel (ex: project.yaml)

        Returns:
            CascadeResult avec la meilleure réponse obtenue
        """
        steps: List[EscalationStep] = []
        total_cost = 0.0
        total_latency = 0.0
        levels = [EscalationLevel.SONNET, EscalationLevel.OPUS, EscalationLevel.CODE_X3]

        # Start from the specified level
        start_idx = levels.index(start_level)
        active_levels = levels[start_idx:]

        enriched_prompt = prompt
        if context:
            enriched_prompt = f"CONTEXTE PROJET:\n{context}\n\n---\n\nREQUÊTE:\n{prompt}"

        for level in active_levels:
            config = self.LEVEL_CONFIG[level]

            # Budget guard
            if total_cost >= self.max_budget:
                logger.warning(
                    f"Budget cascade atteint ({total_cost:.3f}$ >= {self.max_budget}$). "
                    f"Arrêt à {level.name}."
                )
                break

            logger.info(f"Cascade: tentative niveau {level.name} ({config['display']})")
            start_time = time.time()

            # Call the model
            if level == EscalationLevel.CODE_X3:
                response = await self._call_parallel_workers(
                    enriched_prompt, config, num_workers=3
                )
            else:
                response = await self._call_single(enriched_prompt, config)

            latency = (time.time() - start_time) * 1000
            word_count = len(prompt.split())
            cost = self._estimate_cost(config, word_count, len(response.split()))

            # Evaluate quality
            quality = self.evaluator.evaluate(response, prompt, expected_elements)

            step = EscalationStep(
                level=level,
                model=config["model"],
                response=response,
                quality=quality,
                cost_usd=cost,
                latency_ms=latency,
            )
            steps.append(step)
            total_cost += cost
            total_latency += latency

            logger.info(
                f"Cascade {level.name}: qualité={quality.score:.2f}, "
                f"passé={quality.passed}, coût={cost:.4f}$"
            )

            if quality.passed:
                return CascadeResult(
                    final_response=response,
                    final_level=level,
                    total_cost_usd=total_cost,
                    total_latency_ms=total_latency,
                    steps=steps,
                    escalation_count=len(steps) - 1,
                )

            # Enrich prompt for next level with feedback
            enriched_prompt = (
                f"{enriched_prompt}\n\n"
                f"--- FEEDBACK QUALITÉ (tentative précédente) ---\n"
                f"{quality.feedback}\n"
                f"Améliore ta réponse en couvrant les points manquants."
            )

        # Return best response even if none passed threshold
        best_step = max(steps, key=lambda s: s.quality.score)
        return CascadeResult(
            final_response=best_step.response,
            final_level=best_step.level,
            total_cost_usd=total_cost,
            total_latency_ms=total_latency,
            steps=steps,
            escalation_count=len(steps) - 1,
        )

    async def _call_single(self, prompt: str, config: Dict[str, Any]) -> str:
        """Appel modèle simple (Sonnet ou Opus)."""
        if self.call_model:
            return await self.call_model(config["model"], prompt)
        # Placeholder for when no model function is provided
        return f"[{config['display']}] Response placeholder — connect call_model_fn"

    async def _call_parallel_workers(
        self, prompt: str, config: Dict[str, Any], num_workers: int = 3
    ) -> str:
        """
        Lance N workers Claude Code en parallèle avec des angles différents.
        Synthétise les résultats.
        """
        worker_prompts = [
            f"WORKER {i+1}/{num_workers} — Approche: {angle}\n\n{prompt}"
            for i, angle in enumerate([
                "Analyse approfondie et exhaustive",
                "Synthèse concise avec recommandations actionables",
                "Contre-analyse critique et risques identifiés",
            ][:num_workers])
        ]

        if self.call_model:
            tasks = [
                self.call_model(config["model"], wp)
                for wp in worker_prompts
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            valid_results = [r for r in results if isinstance(r, str)]
        else:
            valid_results = [
                f"[Worker {i+1}] Placeholder response" for i in range(num_workers)
            ]

        # Synthesize parallel results
        synthesis = self._synthesize_parallel(valid_results)
        return synthesis

    def _synthesize_parallel(self, responses: List[str]) -> str:
        """Synthétise les réponses des workers parallèles."""
        if not responses:
            return "Aucune réponse des workers."

        if len(responses) == 1:
            return responses[0]

        # Combine with clear separation
        parts = ["## SYNTHÈSE MULTI-WORKERS\n"]
        for i, resp in enumerate(responses):
            parts.append(f"### Worker {i+1}\n{resp}\n")

        parts.append(
            "\n---\n"
            "## RÉSULTAT CONSOLIDÉ\n"
            "Les analyses convergent sur les points suivants. "
            "Les divergences sont signalées pour arbitrage.\n"
        )

        return "\n".join(parts)

    def _estimate_cost(
        self, config: Dict[str, Any], input_words: int, output_words: int
    ) -> float:
        """Estime le coût d'un appel."""
        input_tokens = input_words * 1.25
        output_tokens = output_words * 1.25
        workers = config.get("parallel_workers", 1)
        return (
            (config["cost_per_1k_input"] * input_tokens / 1000)
            + (config["cost_per_1k_output"] * output_tokens / 1000)
        ) * workers
