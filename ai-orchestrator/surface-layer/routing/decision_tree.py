"""
NEMESIS Surface Layer — Routing Decision Tree
Point d'entrée: Claude in Chrome → routing intelligent vers le bon modèle/agent.

Implémente le score de complexité automatique et l'arbre de décision
pour router chaque requête vers la surface optimale.
"""

import json
import re
import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class TaskCategory(Enum):
    """Catégories de tâches pour le routing."""
    CODE = "code"
    REDACTION = "redaction"
    ANALYSE = "analyse"
    STRATEGIE = "strategie"
    VEILLE = "veille"
    DESIGN = "design"
    QUOTIDIEN = "quotidien"
    ORCHESTRATION = "orchestration"


class Surface(Enum):
    """Surfaces Claude disponibles."""
    OPUS = "claude-opus-4.6"
    SONNET = "claude-sonnet-4.6"
    CODE = "claude-code"
    CHROME = "claude-chrome"
    COWORD = "claude-coword"


class ExternalTool(Enum):
    """Outils tiers pour délégation."""
    PERPLEXITY = "perplexity"
    N8N = "n8n"
    CANVA = "canva"
    CODEX = "chatgpt-codex"


@dataclass
class ComplexitySignals:
    """Signaux extraits de la requête pour évaluer la complexité."""
    word_count: int = 0
    has_code_keywords: bool = False
    has_analysis_keywords: bool = False
    has_strategy_keywords: bool = False
    has_redaction_keywords: bool = False
    has_multi_step: bool = False
    has_client_data: bool = False
    has_financial_terms: bool = False
    has_urgency: bool = False
    document_attached: bool = False
    explicit_model_request: Optional[str] = None


@dataclass
class RoutingResult:
    """Résultat du routing avec justification."""
    target_surface: Surface
    category: TaskCategory
    complexity_score: int  # 0-100
    confidence: float  # 0.0-1.0
    reason: str
    fallback_surface: Optional[Surface] = None
    delegate_to: Optional[ExternalTool] = None
    estimated_cost_usd: float = 0.0
    escalation_eligible: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target_surface.value,
            "category": self.category.value,
            "complexity": self.complexity_score,
            "confidence": self.confidence,
            "reason": self.reason,
            "fallback": self.fallback_surface.value if self.fallback_surface else None,
            "delegate_to": self.delegate_to.value if self.delegate_to else None,
            "estimated_cost": self.estimated_cost_usd,
            "escalation_eligible": self.escalation_eligible,
        }


# ---------------------------------------------------------------------------
# Keyword dictionaries for complexity signal detection
# ---------------------------------------------------------------------------

CODE_KEYWORDS = {
    "code", "script", "python", "javascript", "typescript", "api", "webhook",
    "n8n", "workflow", "docker", "deploy", "debug", "refactor", "mcp",
    "function", "class", "endpoint", "database", "sql", "git", "yaml",
    "json", "serveur", "server", "build", "test", "ci/cd", "pipeline",
    "automatisation", "automation", "cron", "lambda", "container",
}

ANALYSIS_KEYWORDS = {
    "analyse", "analyser", "comparer", "évaluer", "diagnostiquer",
    "audit", "performance", "benchmark", "metrics", "rapport", "bilan",
    "synthèse", "résumer", "extraire", "données", "tableau", "graph",
    "statistiques", "tendance", "évolution", "corrélation",
}

STRATEGY_KEYWORDS = {
    "stratégie", "planifier", "arbitrage", "allocation", "patrimoine",
    "fiscalité", "optimisation", "succession", "investissement", "epargne",
    "assurance-vie", "pea", "scpi", "immobilier", "diversification",
    "retraite", "prévoyance", "défiscalisation", "ifi", "donation",
    "démembrement", "holding", "société civile", "mandat",
}

REDACTION_KEYWORDS = {
    "rédiger", "écrire", "lettre", "mail", "email", "document",
    "présentation", "rapport", "note", "synthèse", "proposition",
    "recommandation", "compte-rendu", "procès-verbal", "contrat",
    "avenant", "mise en page", "formatage", "template",
}

MULTI_STEP_INDICATORS = {
    "étapes", "d'abord", "ensuite", "puis", "enfin", "premièrement",
    "deuxièmement", "plan", "séquence", "workflow", "processus",
    "1.", "2.", "3.", "étape 1", "étape 2", "phase",
}

FINANCIAL_TERMS = {
    "€", "euros", "patrimoine", "capital", "rendement", "taux",
    "intérêt", "dividende", "plus-value", "moins-value", "tmg",
    "prélèvement", "impôt", "flat tax", "barème", "tranche",
}

URGENCY_TERMS = {
    "urgent", "asap", "immédiatement", "maintenant", "vite",
    "deadline", "délai", "échéance", "prioritaire", "critique",
}


class ComplexityScorer:
    """Calcule un score de complexité 0-100 à partir des signaux."""

    WEIGHTS = {
        "word_count": 15,        # Long = plus complexe
        "code": 20,              # Code = complexité technique
        "analysis": 15,          # Analyse = raisonnement
        "strategy": 25,          # Stratégie CGP = haute complexité
        "multi_step": 15,        # Multi-étapes = complexité structurelle
        "financial": 10,         # Termes financiers = domaine expert
    }

    def score(self, signals: ComplexitySignals) -> int:
        """Retourne un score 0-100."""
        total = 0

        # Word count contribution (0-15)
        if signals.word_count > 500:
            total += self.WEIGHTS["word_count"]
        elif signals.word_count > 200:
            total += self.WEIGHTS["word_count"] * 0.7
        elif signals.word_count > 50:
            total += self.WEIGHTS["word_count"] * 0.3

        if signals.has_code_keywords:
            total += self.WEIGHTS["code"]
        if signals.has_analysis_keywords:
            total += self.WEIGHTS["analysis"]
        if signals.has_strategy_keywords:
            total += self.WEIGHTS["strategy"]
        if signals.has_multi_step:
            total += self.WEIGHTS["multi_step"]
        if signals.has_financial_terms:
            total += self.WEIGHTS["financial"]

        return min(100, int(total))


class SurfaceRouter:
    """
    Arbre de décision pour router les requêtes vers la bonne surface Claude.
    Point d'entrée principal: route()
    """

    def __init__(self, routing_matrix_path: Optional[str] = None):
        self.scorer = ComplexityScorer()
        self.routing_matrix = self._load_matrix(routing_matrix_path)
        self._history: List[RoutingResult] = []

    def _load_matrix(self, path: Optional[str]) -> Dict[str, Any]:
        """Charge la matrice de routage JSON."""
        if path:
            with open(path, "r") as f:
                return json.load(f)
        return {}

    def extract_signals(self, text: str, has_attachment: bool = False) -> ComplexitySignals:
        """Extrait les signaux de complexité du texte de la requête."""
        text_lower = text.lower()
        words = text_lower.split()

        signals = ComplexitySignals(
            word_count=len(words),
            has_code_keywords=bool(CODE_KEYWORDS & set(words)),
            has_analysis_keywords=bool(ANALYSIS_KEYWORDS & set(words)),
            has_strategy_keywords=any(kw in text_lower for kw in STRATEGY_KEYWORDS),
            has_redaction_keywords=any(kw in text_lower for kw in REDACTION_KEYWORDS),
            has_multi_step=any(kw in text_lower for kw in MULTI_STEP_INDICATORS),
            has_client_data=bool(re.search(r"\b(client|dossier|m\.|mme\.)\b", text_lower)),
            has_financial_terms=any(kw in text_lower for kw in FINANCIAL_TERMS),
            has_urgency=any(kw in text_lower for kw in URGENCY_TERMS),
            document_attached=has_attachment,
        )

        # Detect explicit model requests
        if "opus" in text_lower:
            signals.explicit_model_request = "opus"
        elif "sonnet" in text_lower:
            signals.explicit_model_request = "sonnet"
        elif "claude code" in text_lower or "code" in text_lower and "genere" in text_lower:
            signals.explicit_model_request = "code"

        return signals

    def classify_task(self, signals: ComplexitySignals) -> TaskCategory:
        """Détermine la catégorie de tâche à partir des signaux."""
        if signals.has_code_keywords:
            return TaskCategory.CODE
        if signals.has_strategy_keywords and signals.has_financial_terms:
            return TaskCategory.STRATEGIE
        if signals.has_redaction_keywords:
            return TaskCategory.REDACTION
        if signals.has_analysis_keywords:
            return TaskCategory.ANALYSE
        return TaskCategory.QUOTIDIEN

    def route(
        self,
        text: str,
        has_attachment: bool = False,
        budget_remaining_usd: Optional[float] = None,
    ) -> RoutingResult:
        """
        Route une requête vers la surface Claude optimale.

        Args:
            text: Texte de la requête utilisateur
            has_attachment: True si un document est joint
            budget_remaining_usd: Budget restant pour la journée

        Returns:
            RoutingResult avec la surface cible et justification
        """
        signals = self.extract_signals(text, has_attachment)
        complexity = self.scorer.score(signals)
        category = self.classify_task(signals)

        # === Explicit model request override ===
        if signals.explicit_model_request:
            model_map = {
                "opus": Surface.OPUS,
                "sonnet": Surface.SONNET,
                "code": Surface.CODE,
            }
            target = model_map.get(signals.explicit_model_request, Surface.SONNET)
            return RoutingResult(
                target_surface=target,
                category=category,
                complexity_score=complexity,
                confidence=0.95,
                reason=f"Modèle explicitement demandé: {signals.explicit_model_request}",
                escalation_eligible=False,
            )

        # === Category-based routing ===

        # CODE → Claude Code (always)
        if category == TaskCategory.CODE:
            return RoutingResult(
                target_surface=Surface.CODE,
                category=category,
                complexity_score=complexity,
                confidence=0.92,
                reason="Tâche de développement/automatisation détectée → Claude Code",
                fallback_surface=Surface.OPUS,
                escalation_eligible=True,
                estimated_cost_usd=self._estimate_cost(Surface.CODE, signals.word_count),
            )

        # STRATEGIE CGP → Opus (complex financial reasoning)
        if category == TaskCategory.STRATEGIE:
            return RoutingResult(
                target_surface=Surface.OPUS,
                category=category,
                complexity_score=complexity,
                confidence=0.90,
                reason="Stratégie patrimoniale/CGP détectée → Opus pour raisonnement expert",
                fallback_surface=Surface.SONNET,
                escalation_eligible=False,
                estimated_cost_usd=self._estimate_cost(Surface.OPUS, signals.word_count),
            )

        # REDACTION → Coword
        if category == TaskCategory.REDACTION:
            return RoutingResult(
                target_surface=Surface.COWORD,
                category=category,
                complexity_score=complexity,
                confidence=0.88,
                reason="Tâche de rédaction détectée → Claude Coword",
                fallback_surface=Surface.SONNET,
                escalation_eligible=True,
                estimated_cost_usd=self._estimate_cost(Surface.COWORD, signals.word_count),
            )

        # ANALYSE → Complexity-based routing
        if category == TaskCategory.ANALYSE:
            if complexity >= 60:
                target = Surface.OPUS
                reason = f"Analyse complexe (score={complexity}) → Opus"
            else:
                target = Surface.SONNET
                reason = f"Analyse standard (score={complexity}) → Sonnet"

            return RoutingResult(
                target_surface=target,
                category=category,
                complexity_score=complexity,
                confidence=0.85,
                reason=reason,
                fallback_surface=Surface.SONNET if target == Surface.OPUS else Surface.OPUS,
                escalation_eligible=True,
                estimated_cost_usd=self._estimate_cost(target, signals.word_count),
            )

        # QUOTIDIEN → Sonnet (default fast path)
        # Budget guard: force Sonnet if budget is low
        if budget_remaining_usd is not None and budget_remaining_usd < 1.0:
            return RoutingResult(
                target_surface=Surface.SONNET,
                category=category,
                complexity_score=complexity,
                confidence=0.95,
                reason=f"Budget faible ({budget_remaining_usd:.2f}$) → Sonnet économique",
                escalation_eligible=False,
                estimated_cost_usd=self._estimate_cost(Surface.SONNET, signals.word_count),
            )

        # Complexity-based default routing
        if complexity >= 80:
            target = Surface.OPUS
        elif complexity >= 40:
            target = Surface.SONNET
        else:
            target = Surface.SONNET

        return RoutingResult(
            target_surface=target,
            category=category,
            complexity_score=complexity,
            confidence=0.80,
            reason=f"Routing par complexité (score={complexity}) → {target.value}",
            fallback_surface=Surface.SONNET,
            escalation_eligible=complexity >= 40,
            estimated_cost_usd=self._estimate_cost(target, signals.word_count),
        )

    def _estimate_cost(self, surface: Surface, word_count: int) -> float:
        """Estime le coût en USD pour une requête."""
        # ~4 chars per token, ~5 chars per word → ~1.25 tokens per word
        estimated_tokens = word_count * 1.25
        cost_map = {
            Surface.OPUS: (0.015, 0.075),
            Surface.SONNET: (0.003, 0.015),
            Surface.CODE: (0.015, 0.075),
            Surface.CHROME: (0.003, 0.015),
            Surface.COWORD: (0.003, 0.015),
        }
        input_cost, output_cost = cost_map.get(surface, (0.003, 0.015))
        # Assume output ~2x input
        return (input_cost * estimated_tokens / 1000) + (output_cost * estimated_tokens * 2 / 1000)

    def route_batch(self, requests: List[Dict[str, Any]]) -> List[RoutingResult]:
        """Route un batch de requêtes (utile pour N8N webhook)."""
        results = []
        for req in requests:
            result = self.route(
                text=req.get("text", ""),
                has_attachment=req.get("has_attachment", False),
                budget_remaining_usd=req.get("budget_remaining_usd"),
            )
            results.append(result)
        return results
