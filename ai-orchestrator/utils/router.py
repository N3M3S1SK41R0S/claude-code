"""
Intelligent AI Router
Routes tasks to the most appropriate AI based on domain and requirements.
"""

import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger('AI-Router')


class TaskDomain(Enum):
    """Task domain categories for AI routing."""
    CODE = "code"
    ARCHITECTURE = "architecture"
    CREATIVE = "creative"
    ANALYSIS = "analysis"
    RESEARCH = "research"
    FINANCE = "finance"
    LEGAL = "legal"
    DOCUMENTATION = "documentation"
    UI_UX = "ui_ux"
    DATA_SCIENCE = "data_science"
    AUTOMATION = "automation"
    GENERAL = "general"


@dataclass
class AICapability:
    """AI service capability profile."""
    name: str
    domains: List[TaskDomain]
    strength_score: Dict[TaskDomain, float]  # 0.0 to 1.0
    max_tokens: int
    latency_category: str  # fast, medium, slow
    cost_category: str  # low, medium, high
    special_features: List[str]


class AIRouter:
    """
    Intelligent router that selects optimal AI(s) for each task.

    Routing Strategy:
    - Code tasks → Codestral, Claude Code, Cursor
    - Architecture → Claude Opus, GPT-4
    - Creative → GPT-4, Gemini
    - Analysis/Finance → Claude Opus (regulatory compliance)
    - UI/UX → GPT-4, Gemini
    - Automation → Claude, Antigravity
    """

    # AI capability profiles
    AI_PROFILES = {
        'claude_sonnet': AICapability(
            name='Claude Sonnet 4.5',
            domains=[TaskDomain.CODE, TaskDomain.ANALYSIS, TaskDomain.DOCUMENTATION,
                     TaskDomain.GENERAL, TaskDomain.ARCHITECTURE],
            strength_score={
                TaskDomain.CODE: 0.9,
                TaskDomain.ANALYSIS: 0.9,
                TaskDomain.DOCUMENTATION: 0.95,
                TaskDomain.GENERAL: 0.9,
                TaskDomain.ARCHITECTURE: 0.85,
            },
            max_tokens=8192,
            latency_category='medium',
            cost_category='medium',
            special_features=['tool_use', 'long_context', 'code_execution']
        ),
        'claude_opus': AICapability(
            name='Claude Opus 4.5',
            domains=[TaskDomain.ARCHITECTURE, TaskDomain.ANALYSIS, TaskDomain.FINANCE,
                     TaskDomain.LEGAL, TaskDomain.RESEARCH],
            strength_score={
                TaskDomain.ARCHITECTURE: 0.95,
                TaskDomain.ANALYSIS: 0.95,
                TaskDomain.FINANCE: 0.95,
                TaskDomain.LEGAL: 0.9,
                TaskDomain.RESEARCH: 0.9,
            },
            max_tokens=8192,
            latency_category='slow',
            cost_category='high',
            special_features=['deep_reasoning', 'compliance', 'complex_analysis']
        ),
        'gpt4o': AICapability(
            name='GPT-4o',
            domains=[TaskDomain.CREATIVE, TaskDomain.UI_UX, TaskDomain.GENERAL,
                     TaskDomain.ARCHITECTURE],
            strength_score={
                TaskDomain.CREATIVE: 0.95,
                TaskDomain.UI_UX: 0.9,
                TaskDomain.GENERAL: 0.85,
                TaskDomain.ARCHITECTURE: 0.85,
            },
            max_tokens=4096,
            latency_category='medium',
            cost_category='medium',
            special_features=['multimodal', 'creative_writing', 'image_analysis']
        ),
        'gemini_pro': AICapability(
            name='Gemini Pro',
            domains=[TaskDomain.RESEARCH, TaskDomain.CREATIVE, TaskDomain.UI_UX,
                     TaskDomain.DATA_SCIENCE],
            strength_score={
                TaskDomain.RESEARCH: 0.85,
                TaskDomain.CREATIVE: 0.85,
                TaskDomain.UI_UX: 0.85,
                TaskDomain.DATA_SCIENCE: 0.8,
            },
            max_tokens=8192,
            latency_category='fast',
            cost_category='low',
            special_features=['multimodal', 'web_search', 'large_context']
        ),
        'codestral': AICapability(
            name='Codestral',
            domains=[TaskDomain.CODE],
            strength_score={
                TaskDomain.CODE: 0.95,
            },
            max_tokens=8192,
            latency_category='fast',
            cost_category='low',
            special_features=['code_completion', 'code_review', 'refactoring']
        ),
        'mistral_large': AICapability(
            name='Mistral Large',
            domains=[TaskDomain.CODE, TaskDomain.ANALYSIS, TaskDomain.GENERAL],
            strength_score={
                TaskDomain.CODE: 0.85,
                TaskDomain.ANALYSIS: 0.8,
                TaskDomain.GENERAL: 0.8,
            },
            max_tokens=4096,
            latency_category='fast',
            cost_category='medium',
            special_features=['multilingual', 'code_generation']
        ),
    }

    # Domain detection keywords
    DOMAIN_KEYWORDS = {
        TaskDomain.CODE: [
            'code', 'programming', 'function', 'class', 'api', 'backend',
            'frontend', 'database', 'sql', 'python', 'javascript', 'typescript',
            'react', 'vue', 'angular', 'nodejs', 'django', 'flask', 'debug',
            'algorithm', 'data structure', 'git', 'deploy', 'docker', 'kubernetes'
        ],
        TaskDomain.ARCHITECTURE: [
            'architecture', 'design pattern', 'microservice', 'system design',
            'scalability', 'infrastructure', 'cloud', 'aws', 'gcp', 'azure',
            'distributed', 'load balancing', 'caching', 'message queue'
        ],
        TaskDomain.CREATIVE: [
            'creative', 'write', 'story', 'content', 'marketing', 'copywriting',
            'brand', 'slogan', 'narrative', 'blog', 'article', 'social media'
        ],
        TaskDomain.FINANCE: [
            'finance', 'fiscal', 'tax', 'ifi', 'investment', 'portfolio',
            'amf', 'regulatory', 'compliance', 'cgp', 'wealth', 'asset',
            'banking', 'insurance', 'risk', 'valuation'
        ],
        TaskDomain.LEGAL: [
            'legal', 'law', 'contract', 'regulation', 'compliance', 'gdpr',
            'privacy', 'intellectual property', 'license', 'terms of service'
        ],
        TaskDomain.UI_UX: [
            'ui', 'ux', 'design', 'user interface', 'user experience',
            'wireframe', 'prototype', 'figma', 'sketch', 'responsive',
            'accessibility', 'mobile app', 'web app'
        ],
        TaskDomain.DATA_SCIENCE: [
            'data science', 'machine learning', 'ml', 'ai', 'deep learning',
            'neural network', 'tensorflow', 'pytorch', 'pandas', 'numpy',
            'statistics', 'visualization', 'model', 'training'
        ],
        TaskDomain.AUTOMATION: [
            'automation', 'automate', 'script', 'workflow', 'pipeline',
            'ci/cd', 'jenkins', 'github actions', 'cron', 'scheduled'
        ],
        TaskDomain.RESEARCH: [
            'research', 'study', 'analysis', 'compare', 'benchmark',
            'state of the art', 'literature', 'survey', 'investigation'
        ],
        TaskDomain.DOCUMENTATION: [
            'documentation', 'readme', 'api docs', 'specification',
            'technical writing', 'manual', 'guide', 'tutorial'
        ],
    }

    def __init__(self, available_ais: List[str] = None):
        """
        Initialize router with list of available AI services.

        Args:
            available_ais: List of AI service keys that are available
        """
        self.available_ais = available_ais or list(self.AI_PROFILES.keys())

    def detect_domains(self, text: str) -> List[Tuple[TaskDomain, float]]:
        """
        Detect task domains from text with confidence scores.

        Args:
            text: The task description or prompt

        Returns:
            List of (domain, confidence) tuples sorted by confidence
        """
        text_lower = text.lower()
        domain_scores: Dict[TaskDomain, float] = {}

        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            score = 0.0
            matched_keywords = []

            for keyword in keywords:
                if keyword in text_lower:
                    # Weight longer keywords higher
                    weight = len(keyword.split()) * 0.1
                    score += 0.15 + weight
                    matched_keywords.append(keyword)

            if score > 0:
                # Normalize score (cap at 1.0)
                domain_scores[domain] = min(score, 1.0)
                logger.debug(f"Domain {domain.value}: {score:.2f} (keywords: {matched_keywords})")

        # Default to GENERAL if no specific domain detected
        if not domain_scores:
            domain_scores[TaskDomain.GENERAL] = 0.5

        # Sort by score descending
        sorted_domains = sorted(
            domain_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        return sorted_domains

    def get_best_ais(self, text: str, count: int = 3,
                     required_features: List[str] = None) -> List[str]:
        """
        Get the best AI services for a given task.

        Args:
            text: The task description
            count: Number of AIs to return
            required_features: Features that must be supported

        Returns:
            List of AI service keys ordered by suitability
        """
        domains = self.detect_domains(text)
        if not domains:
            domains = [(TaskDomain.GENERAL, 0.5)]

        primary_domain = domains[0][0]
        secondary_domains = [d[0] for d in domains[1:3]]

        ai_scores: Dict[str, float] = {}

        for ai_key in self.available_ais:
            if ai_key not in self.AI_PROFILES:
                continue

            profile = self.AI_PROFILES[ai_key]

            # Check required features
            if required_features:
                if not all(f in profile.special_features for f in required_features):
                    continue

            # Calculate score
            score = 0.0

            # Primary domain match
            if primary_domain in profile.strength_score:
                score += profile.strength_score[primary_domain] * 0.6

            # Secondary domain matches
            for sec_domain in secondary_domains:
                if sec_domain in profile.strength_score:
                    score += profile.strength_score[sec_domain] * 0.2

            # Bonus for special features relevance
            if self._features_relevant(profile.special_features, text):
                score += 0.1

            if score > 0:
                ai_scores[ai_key] = score

        # Sort by score and return top count
        sorted_ais = sorted(
            ai_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        result = [ai[0] for ai in sorted_ais[:count]]
        logger.info(f"Routed to AIs: {result} for domains: {[d[0].value for d in domains[:2]]}")

        return result

    def get_ai_for_domain(self, domain: TaskDomain) -> str:
        """Get the single best AI for a specific domain."""
        best_ai = None
        best_score = 0.0

        for ai_key in self.available_ais:
            if ai_key not in self.AI_PROFILES:
                continue

            profile = self.AI_PROFILES[ai_key]
            if domain in profile.strength_score:
                score = profile.strength_score[domain]
                if score > best_score:
                    best_score = score
                    best_ai = ai_key

        return best_ai or 'claude_sonnet'  # Default fallback

    def _features_relevant(self, features: List[str], text: str) -> bool:
        """Check if AI features are relevant to the task."""
        text_lower = text.lower()

        feature_keywords = {
            'multimodal': ['image', 'picture', 'photo', 'screenshot', 'visual'],
            'code_execution': ['run', 'execute', 'test', 'debug'],
            'web_search': ['search', 'find', 'latest', 'current', 'recent'],
            'long_context': ['document', 'file', 'codebase', 'repository'],
        }

        for feature in features:
            if feature in feature_keywords:
                if any(kw in text_lower for kw in feature_keywords[feature]):
                    return True

        return False

    def get_routing_explanation(self, text: str) -> str:
        """Generate human-readable explanation of routing decision."""
        domains = self.detect_domains(text)
        best_ais = self.get_best_ais(text)

        explanation = "## Routing Decision\n\n"
        explanation += "### Detected Domains:\n"
        for domain, score in domains[:3]:
            explanation += f"- {domain.value}: {score:.0%} confidence\n"

        explanation += "\n### Selected AIs:\n"
        for i, ai_key in enumerate(best_ais, 1):
            profile = self.AI_PROFILES.get(ai_key)
            if profile:
                explanation += f"{i}. **{profile.name}**\n"
                explanation += f"   - Strengths: {', '.join(d.value for d in profile.domains[:3])}\n"
                explanation += f"   - Features: {', '.join(profile.special_features[:3])}\n"

        return explanation
