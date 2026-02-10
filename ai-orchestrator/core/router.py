"""
NEMESIS Smart Router - Cost-aware, intelligent request routing to AI models.
Implements dynamic model selection based on complexity, cost, and quality requirements.
"""
import time
import json
import random
import threading
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
from abc import ABC, abstractmethod

from .tracer import get_tracer, SpanKind

logger = logging.getLogger(__name__)


class ModelTier(Enum):
    """Model capability tiers."""
    FAST = "fast"           # Fastest, cheapest (GPT-3.5, Claude Haiku)
    BALANCED = "balanced"   # Good balance (GPT-4-mini, Claude Sonnet)
    PREMIUM = "premium"     # Best quality (GPT-4, Claude Opus)
    SPECIALIZED = "specialized"  # Task-specific models


class TaskComplexity(Enum):
    """Complexity levels for tasks."""
    TRIVIAL = 1      # Simple lookup, formatting
    LOW = 2          # Basic Q&A, simple text
    MEDIUM = 3       # Analysis, summarization
    HIGH = 4         # Complex reasoning, code generation
    EXPERT = 5       # Multi-step, specialized knowledge


@dataclass
class ModelConfig:
    """Configuration for an AI model."""
    name: str
    provider: str
    tier: ModelTier
    cost_per_1k_input: float    # $ per 1k input tokens
    cost_per_1k_output: float   # $ per 1k output tokens
    max_tokens: int
    latency_ms: float           # Average latency
    quality_score: float        # 0-1 quality rating
    capabilities: List[str] = field(default_factory=list)
    rate_limit: int = 60        # Requests per minute
    enabled: bool = True

    @property
    def cost_efficiency(self) -> float:
        """Cost efficiency score (quality per dollar)."""
        avg_cost = (self.cost_per_1k_input + self.cost_per_1k_output) / 2
        return self.quality_score / max(avg_cost, 0.001)


@dataclass
class RoutingRequest:
    """Request to be routed to an AI model."""
    request_id: str
    content: str
    task_type: str = "general"
    complexity: TaskComplexity = TaskComplexity.MEDIUM
    max_cost: Optional[float] = None      # Max cost in $
    max_latency_ms: Optional[float] = None
    required_capabilities: List[str] = field(default_factory=list)
    preferred_tier: Optional[ModelTier] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def estimated_tokens(self) -> int:
        """Estimate token count from content length."""
        return len(self.content) // 4  # Rough estimate


@dataclass
class RoutingDecision:
    """Result of routing decision."""
    model: ModelConfig
    request: RoutingRequest
    reason: str
    estimated_cost: float
    estimated_latency_ms: float
    confidence: float
    alternatives: List[Tuple[ModelConfig, str]] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model.name,
            "provider": self.model.provider,
            "tier": self.model.tier.value,
            "reason": self.reason,
            "estimated_cost": self.estimated_cost,
            "estimated_latency_ms": self.estimated_latency_ms,
            "confidence": self.confidence,
            "alternatives": [(m.name, r) for m, r in self.alternatives]
        }


class RoutingStrategy(ABC):
    """Base class for routing strategies."""

    @abstractmethod
    def select(
        self,
        request: RoutingRequest,
        available_models: List[ModelConfig]
    ) -> Tuple[ModelConfig, str]:
        """Select a model for the request. Returns (model, reason)."""
        pass


class CostOptimizedStrategy(RoutingStrategy):
    """Route to minimize cost while meeting requirements."""

    def select(
        self,
        request: RoutingRequest,
        available_models: List[ModelConfig]
    ) -> Tuple[ModelConfig, str]:
        # Filter by constraints
        candidates = available_models.copy()

        if request.required_capabilities:
            candidates = [m for m in candidates
                         if all(c in m.capabilities for c in request.required_capabilities)]

        if request.max_latency_ms:
            candidates = [m for m in candidates if m.latency_ms <= request.max_latency_ms]

        if not candidates:
            candidates = available_models  # Fallback to all

        # Sort by cost
        candidates.sort(key=lambda m: m.cost_per_1k_input + m.cost_per_1k_output)

        # Find cheapest that can handle complexity
        for model in candidates:
            if self._can_handle_complexity(model, request.complexity):
                return model, "Cost-optimized selection"

        return candidates[0], "Cost-optimized (best available)"

    def _can_handle_complexity(self, model: ModelConfig, complexity: TaskComplexity) -> bool:
        tier_complexity = {
            ModelTier.FAST: TaskComplexity.LOW,
            ModelTier.BALANCED: TaskComplexity.MEDIUM,
            ModelTier.PREMIUM: TaskComplexity.EXPERT,
            ModelTier.SPECIALIZED: TaskComplexity.HIGH
        }
        max_complexity = tier_complexity.get(model.tier, TaskComplexity.MEDIUM)
        return complexity.value <= max_complexity.value


class QualityOptimizedStrategy(RoutingStrategy):
    """Route to maximize quality."""

    def select(
        self,
        request: RoutingRequest,
        available_models: List[ModelConfig]
    ) -> Tuple[ModelConfig, str]:
        candidates = available_models.copy()

        if request.required_capabilities:
            candidates = [m for m in candidates
                         if all(c in m.capabilities for c in request.required_capabilities)]

        if request.max_cost:
            estimated_tokens = request.estimated_tokens
            candidates = [m for m in candidates
                         if (m.cost_per_1k_input * estimated_tokens / 1000) <= request.max_cost]

        if not candidates:
            candidates = available_models

        # Sort by quality score
        candidates.sort(key=lambda m: m.quality_score, reverse=True)

        return candidates[0], "Quality-optimized selection"


class BalancedStrategy(RoutingStrategy):
    """Balance cost, quality, and latency."""

    def __init__(self, cost_weight: float = 0.3, quality_weight: float = 0.5, latency_weight: float = 0.2):
        self.cost_weight = cost_weight
        self.quality_weight = quality_weight
        self.latency_weight = latency_weight

    def select(
        self,
        request: RoutingRequest,
        available_models: List[ModelConfig]
    ) -> Tuple[ModelConfig, str]:
        candidates = available_models.copy()

        if request.required_capabilities:
            candidates = [m for m in candidates
                         if all(c in m.capabilities for c in request.required_capabilities)]

        if not candidates:
            candidates = available_models

        if not candidates:
            raise ValueError("No models available for routing")

        if len(candidates) == 1:
            return candidates[0], f"Only available model: {candidates[0].name}"

        # Calculate composite score
        def score(model: ModelConfig) -> float:
            # Normalize metrics (lower is better for cost and latency)
            max_cost = max(m.cost_per_1k_input for m in candidates) or 1
            max_latency = max(m.latency_ms for m in candidates) or 1

            cost_score = 1 - (model.cost_per_1k_input / max_cost)
            latency_score = 1 - (model.latency_ms / max_latency)
            quality_score = model.quality_score

            return (
                self.cost_weight * cost_score +
                self.quality_weight * quality_score +
                self.latency_weight * latency_score
            )

        candidates.sort(key=score, reverse=True)
        return candidates[0], f"Balanced selection (score: {score(candidates[0]):.2f})"


class ComplexityAwareStrategy(RoutingStrategy):
    """Route based on task complexity."""

    COMPLEXITY_TIER_MAP = {
        TaskComplexity.TRIVIAL: ModelTier.FAST,
        TaskComplexity.LOW: ModelTier.FAST,
        TaskComplexity.MEDIUM: ModelTier.BALANCED,
        TaskComplexity.HIGH: ModelTier.PREMIUM,
        TaskComplexity.EXPERT: ModelTier.PREMIUM
    }

    def select(
        self,
        request: RoutingRequest,
        available_models: List[ModelConfig]
    ) -> Tuple[ModelConfig, str]:
        target_tier = self.COMPLEXITY_TIER_MAP.get(request.complexity, ModelTier.BALANCED)

        # Prefer requested tier
        if request.preferred_tier:
            target_tier = request.preferred_tier

        # Find models of target tier
        candidates = [m for m in available_models if m.tier == target_tier]

        if not candidates:
            # Fallback to next higher tier
            tier_order = [ModelTier.FAST, ModelTier.BALANCED, ModelTier.PREMIUM]
            target_idx = tier_order.index(target_tier) if target_tier in tier_order else 1

            for tier in tier_order[target_idx:]:
                candidates = [m for m in available_models if m.tier == tier]
                if candidates:
                    break

        if not candidates:
            candidates = available_models

        # Select best in tier by quality
        candidates.sort(key=lambda m: m.quality_score, reverse=True)
        return candidates[0], f"Complexity-aware: {request.complexity.name} -> {target_tier.value}"


class SmartRouter:
    """
    Intelligent router for AI model selection.
    Considers cost, quality, latency, and task requirements.
    """

    # Default model configurations
    DEFAULT_MODELS = [
        ModelConfig(
            name="gpt-4-turbo",
            provider="openai",
            tier=ModelTier.PREMIUM,
            cost_per_1k_input=0.01,
            cost_per_1k_output=0.03,
            max_tokens=128000,
            latency_ms=2000,
            quality_score=0.95,
            capabilities=["code", "analysis", "reasoning", "creative"]
        ),
        ModelConfig(
            name="gpt-4o-mini",
            provider="openai",
            tier=ModelTier.BALANCED,
            cost_per_1k_input=0.00015,
            cost_per_1k_output=0.0006,
            max_tokens=128000,
            latency_ms=800,
            quality_score=0.85,
            capabilities=["code", "analysis", "reasoning"]
        ),
        ModelConfig(
            name="gpt-3.5-turbo",
            provider="openai",
            tier=ModelTier.FAST,
            cost_per_1k_input=0.0005,
            cost_per_1k_output=0.0015,
            max_tokens=16384,
            latency_ms=500,
            quality_score=0.75,
            capabilities=["general", "code"]
        ),
        ModelConfig(
            name="claude-opus-4",
            provider="anthropic",
            tier=ModelTier.PREMIUM,
            cost_per_1k_input=0.015,
            cost_per_1k_output=0.075,
            max_tokens=200000,
            latency_ms=3000,
            quality_score=0.98,
            capabilities=["code", "analysis", "reasoning", "creative", "vision"]
        ),
        ModelConfig(
            name="claude-sonnet-4",
            provider="anthropic",
            tier=ModelTier.BALANCED,
            cost_per_1k_input=0.003,
            cost_per_1k_output=0.015,
            max_tokens=200000,
            latency_ms=1500,
            quality_score=0.92,
            capabilities=["code", "analysis", "reasoning", "creative"]
        ),
        ModelConfig(
            name="claude-haiku",
            provider="anthropic",
            tier=ModelTier.FAST,
            cost_per_1k_input=0.00025,
            cost_per_1k_output=0.00125,
            max_tokens=200000,
            latency_ms=400,
            quality_score=0.80,
            capabilities=["general", "code", "analysis"]
        ),
        ModelConfig(
            name="mistral-large",
            provider="mistral",
            tier=ModelTier.PREMIUM,
            cost_per_1k_input=0.004,
            cost_per_1k_output=0.012,
            max_tokens=32000,
            latency_ms=1200,
            quality_score=0.88,
            capabilities=["code", "analysis", "reasoning"]
        ),
        ModelConfig(
            name="gemini-pro",
            provider="google",
            tier=ModelTier.BALANCED,
            cost_per_1k_input=0.00025,
            cost_per_1k_output=0.0005,
            max_tokens=32000,
            latency_ms=1000,
            quality_score=0.85,
            capabilities=["code", "analysis", "reasoning", "vision"]
        )
    ]

    def __init__(
        self,
        models: Optional[List[ModelConfig]] = None,
        default_strategy: Optional[RoutingStrategy] = None,
        budget_limit_daily: float = 10.0  # $ per day
    ):
        self.models = {m.name: m for m in (models or self.DEFAULT_MODELS)}
        self.strategies = {
            "cost": CostOptimizedStrategy(),
            "quality": QualityOptimizedStrategy(),
            "balanced": BalancedStrategy(),
            "complexity": ComplexityAwareStrategy()
        }
        self.default_strategy = default_strategy or self.strategies["complexity"]
        self.budget_limit_daily = budget_limit_daily

        self.tracer = get_tracer()
        self._usage_tracker: Dict[str, float] = {}  # model -> cost
        self._routing_history: List[RoutingDecision] = []
        self._lock = threading.Lock()

    def add_model(self, model: ModelConfig):
        """Add a model to the router."""
        self.models[model.name] = model

    def remove_model(self, name: str):
        """Remove a model from the router."""
        if name in self.models:
            del self.models[name]

    def enable_model(self, name: str, enabled: bool = True):
        """Enable or disable a model."""
        if name in self.models:
            self.models[name].enabled = enabled

    def route(
        self,
        request: RoutingRequest,
        strategy: Optional[str] = None
    ) -> RoutingDecision:
        """Route a request to the best model."""
        with self.tracer.span("router.route", SpanKind.INTERNAL) as span:
            span.set_attribute("request_id", request.request_id)
            span.set_attribute("task_type", request.task_type)
            span.set_attribute("complexity", request.complexity.name)

            # Get available models
            available = [m for m in self.models.values() if m.enabled]

            if not available:
                raise ValueError("No models available")

            # Check budget
            daily_usage = sum(self._usage_tracker.values())
            if daily_usage >= self.budget_limit_daily:
                # Only allow cheapest model
                available.sort(key=lambda m: m.cost_per_1k_input)
                available = available[:1]
                logger.warning("Budget limit reached, using cheapest model")

            # Select strategy
            routing_strategy = self.strategies.get(strategy) if strategy else self.default_strategy

            # Make selection
            selected_model, reason = routing_strategy.select(request, available)

            # Calculate estimates
            estimated_tokens = request.estimated_tokens
            estimated_cost = (
                selected_model.cost_per_1k_input * estimated_tokens / 1000 +
                selected_model.cost_per_1k_output * estimated_tokens / 1000
            )

            # Find alternatives
            alternatives = []
            for alt_strategy_name, alt_strategy in self.strategies.items():
                if alt_strategy != routing_strategy:
                    try:
                        alt_model, alt_reason = alt_strategy.select(request, available)
                        if alt_model != selected_model:
                            alternatives.append((alt_model, f"{alt_strategy_name}: {alt_reason}"))
                    except (ValueError, IndexError):
                        continue

            decision = RoutingDecision(
                model=selected_model,
                request=request,
                reason=reason,
                estimated_cost=estimated_cost,
                estimated_latency_ms=selected_model.latency_ms,
                confidence=0.9 if len(alternatives) == 0 else 0.7,
                alternatives=alternatives[:3]
            )

            with self._lock:
                self._routing_history.append(decision)

            span.set_attribute("selected_model", selected_model.name)
            span.set_attribute("estimated_cost", estimated_cost)

            return decision

    def record_usage(self, model_name: str, cost: float):
        """Record usage for budget tracking."""
        with self._lock:
            if model_name not in self._usage_tracker:
                self._usage_tracker[model_name] = 0
            self._usage_tracker[model_name] += cost

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics."""
        with self._lock:
            total = sum(self._usage_tracker.values())
            return {
                "total_cost": total,
                "budget_limit": self.budget_limit_daily,
                "budget_remaining": max(0, self.budget_limit_daily - total),
                "by_model": self._usage_tracker.copy(),
                "routing_count": len(self._routing_history)
            }

    def reset_daily_usage(self):
        """Reset daily usage counters."""
        with self._lock:
            self._usage_tracker.clear()

    def get_model_recommendation(
        self,
        task_description: str,
        budget: Optional[float] = None
    ) -> Dict[str, Any]:
        """Get a recommendation for which model to use."""
        # Simple complexity estimation from description
        complexity_keywords = {
            TaskComplexity.TRIVIAL: ["simple", "basic", "quick", "format"],
            TaskComplexity.LOW: ["summarize", "translate", "convert"],
            TaskComplexity.MEDIUM: ["analyze", "explain", "compare"],
            TaskComplexity.HIGH: ["code", "debug", "design", "implement"],
            TaskComplexity.EXPERT: ["architect", "optimize", "complex", "multi-step"]
        }

        task_lower = task_description.lower()
        detected_complexity = TaskComplexity.MEDIUM

        for complexity, keywords in complexity_keywords.items():
            if any(kw in task_lower for kw in keywords):
                detected_complexity = complexity
                break

        request = RoutingRequest(
            request_id="recommendation",
            content=task_description,
            complexity=detected_complexity,
            max_cost=budget
        )

        decision = self.route(request)

        return {
            "recommended_model": decision.model.name,
            "detected_complexity": detected_complexity.name,
            "estimated_cost": decision.estimated_cost,
            "reason": decision.reason,
            "alternatives": [
                {"model": m.name, "reason": r}
                for m, r in decision.alternatives
            ]
        }
