"""
Saturation Analyzer
Determines when ideas are fully explored without invention.
"""

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple
import hashlib

logger = logging.getLogger('Saturation-Analyzer')


@dataclass
class SaturationMetrics:
    """Metrics for saturation analysis."""
    overall_score: float  # 0.0 to 1.0
    concept_coverage: float
    depth_score: float
    diversity_score: float
    novelty_decay: float  # How much new info each round adds
    recommendation: str  # CONTINUE, SATURATED, or NEEDS_INPUT
    details: Dict


class SaturationAnalyzer:
    """
    Analyzes synthesis rounds to determine when ideas are saturated.

    Saturation means:
    - All relevant aspects have been explored
    - Further rounds add diminishing value
    - No fabrication or invention has occurred

    Metrics:
    1. Concept Coverage: Are all key concepts addressed?
    2. Depth Score: How deeply are concepts explored?
    3. Diversity Score: Multiple perspectives represented?
    4. Novelty Decay: Diminishing new information per round
    """

    def __init__(self, saturation_threshold: float = 0.85):
        self.saturation_threshold = saturation_threshold
        self.round_history: List[Dict] = []

    def analyze(self, current_round: str, previous_rounds: List[str] = None,
                original_request: str = "") -> SaturationMetrics:
        """
        Analyze current synthesis round for saturation.

        Args:
            current_round: Current synthesis content
            previous_rounds: List of previous round contents
            original_request: Original user request for context

        Returns:
            SaturationMetrics with analysis results
        """
        previous_rounds = previous_rounds or []

        # Calculate individual metrics
        concept_coverage = self._calculate_concept_coverage(
            current_round, original_request
        )
        depth_score = self._calculate_depth_score(current_round)
        diversity_score = self._calculate_diversity_score(current_round)
        novelty_decay = self._calculate_novelty_decay(
            current_round, previous_rounds
        )

        # Calculate overall saturation
        overall_score = self._calculate_overall_score(
            concept_coverage, depth_score, diversity_score, novelty_decay
        )

        # Determine recommendation
        recommendation = self._get_recommendation(
            overall_score, novelty_decay, len(previous_rounds) + 1
        )

        # Store for history
        self.round_history.append({
            'round': len(previous_rounds) + 1,
            'overall_score': overall_score,
            'novelty_decay': novelty_decay
        })

        return SaturationMetrics(
            overall_score=overall_score,
            concept_coverage=concept_coverage,
            depth_score=depth_score,
            diversity_score=diversity_score,
            novelty_decay=novelty_decay,
            recommendation=recommendation,
            details={
                'round_number': len(previous_rounds) + 1,
                'content_length': len(current_round),
                'key_concepts_found': self._extract_key_concepts(current_round),
                'saturation_indicators': self._find_saturation_indicators(current_round),
                'gaps_detected': self._detect_gaps(current_round)
            }
        )

    def _calculate_concept_coverage(self, content: str,
                                    original_request: str) -> float:
        """Calculate how well the content covers concepts from the request."""
        if not original_request:
            return 0.7  # Default if no reference

        # Extract key terms from request
        request_words = set(
            word.lower() for word in original_request.split()
            if len(word) > 3
        )

        content_lower = content.lower()

        # Check how many request terms appear in content
        matched = sum(1 for word in request_words if word in content_lower)
        coverage = matched / len(request_words) if request_words else 0.5

        # Boost for structured content (headers, lists)
        if re.search(r'^#+\s', content, re.MULTILINE):
            coverage += 0.1
        if re.search(r'^[-*]\s', content, re.MULTILINE):
            coverage += 0.05

        return min(coverage, 1.0)

    def _calculate_depth_score(self, content: str) -> float:
        """Calculate depth of exploration."""
        score = 0.5  # Base score

        # Check for depth indicators
        depth_indicators = [
            (r'\bwhy\b.*\?', 0.1),  # Questions explored
            (r'\bbecause\b', 0.08),  # Explanations
            (r'\bexample[s]?\b', 0.1),  # Examples provided
            (r'\bfor instance\b', 0.08),
            (r'\bspecifically\b', 0.07),
            (r'\bin detail\b', 0.08),
            (r'\bimplication[s]?\b', 0.1),
            (r'\bconsequence[s]?\b', 0.08),
            (r'\badvantage[s]?\b|\bdisadvantage[s]?\b', 0.1),
            (r'\bpros?\b.*\bcons?\b', 0.1),
        ]

        for pattern, boost in depth_indicators:
            if re.search(pattern, content, re.IGNORECASE):
                score += boost

        # Check for multi-level structure
        header_levels = set(re.findall(r'^(#+)', content, re.MULTILINE))
        if len(header_levels) >= 2:
            score += 0.1

        return min(score, 1.0)

    def _calculate_diversity_score(self, content: str) -> float:
        """Calculate diversity of perspectives."""
        score = 0.5

        # Check for multiple viewpoints
        perspective_markers = [
            r'\bon one hand\b.*\bon the other\b',
            r'\balternatively\b',
            r'\bhowever\b',
            r'\bin contrast\b',
            r'\bfrom another perspective\b',
            r'\bsome argue\b.*\bothers\b',
            r'\bpros?\b|\bcons?\b',
            r'\bstrength[s]?\b|\bweakness[es]?\b',
        ]

        for pattern in perspective_markers:
            if re.search(pattern, content, re.IGNORECASE):
                score += 0.1

        # Check for multiple sources cited
        source_citations = re.findall(
            r'\baccording to\b|\bsource[s]?\b|\b(?:GPT|Claude|Gemini|Mistral)\b',
            content, re.IGNORECASE
        )
        if len(source_citations) >= 2:
            score += 0.15

        return min(score, 1.0)

    def _calculate_novelty_decay(self, current: str,
                                  previous: List[str]) -> float:
        """
        Calculate how much new information this round adds.
        High decay = less new info = closer to saturation.
        """
        if not previous:
            return 0.0  # First round has no decay

        # Get unique content in current round
        current_sentences = set(self._extract_sentences(current))
        previous_sentences = set()
        for prev in previous:
            previous_sentences.update(self._extract_sentences(prev))

        # Calculate overlap
        new_sentences = current_sentences - previous_sentences
        if not current_sentences:
            return 1.0  # No content = fully saturated

        novelty_ratio = len(new_sentences) / len(current_sentences)

        # Decay is inverse of novelty
        decay = 1.0 - novelty_ratio

        return decay

    def _extract_sentences(self, text: str) -> List[str]:
        """Extract normalized sentences for comparison."""
        # Simple sentence splitting
        sentences = re.split(r'[.!?]\s+', text)

        # Normalize
        normalized = []
        for sent in sentences:
            # Remove extra whitespace and lowercase
            clean = ' '.join(sent.lower().split())
            if len(clean) > 20:  # Skip very short fragments
                # Hash for comparison
                normalized.append(
                    hashlib.md5(clean.encode()).hexdigest()[:16]
                )

        return normalized

    def _calculate_overall_score(self, concept_coverage: float,
                                  depth: float, diversity: float,
                                  novelty_decay: float) -> float:
        """Calculate weighted overall saturation score."""
        # Weights for different aspects
        weights = {
            'concept_coverage': 0.3,
            'depth': 0.25,
            'diversity': 0.2,
            'novelty_decay': 0.25
        }

        overall = (
            concept_coverage * weights['concept_coverage'] +
            depth * weights['depth'] +
            diversity * weights['diversity'] +
            novelty_decay * weights['novelty_decay']
        )

        return overall

    def _get_recommendation(self, overall_score: float,
                             novelty_decay: float,
                             round_number: int) -> str:
        """Determine recommendation based on metrics."""
        # High saturation
        if overall_score >= self.saturation_threshold:
            return "SATURATED"

        # Diminishing returns
        if novelty_decay > 0.8 and round_number >= 2:
            return "SATURATED"

        # Maximum rounds reached
        if round_number >= 3:
            if overall_score >= 0.7:
                return "SATURATED"
            else:
                return "NEEDS_INPUT"

        # More exploration needed
        return "CONTINUE"

    def _extract_key_concepts(self, content: str) -> List[str]:
        """Extract key concepts from content."""
        concepts = []

        # Headers often contain key concepts
        headers = re.findall(r'^#+\s+(.+)$', content, re.MULTILINE)
        concepts.extend(headers[:10])

        # Bold/emphasized text
        bold = re.findall(r'\*\*(.+?)\*\*', content)
        concepts.extend(bold[:10])

        # Items after "Key:" or "Important:"
        key_items = re.findall(
            r'(?:key|important|critical|main)[:\s]+(.+?)(?:\.|$)',
            content, re.IGNORECASE
        )
        concepts.extend(key_items[:5])

        return list(set(concepts))[:15]

    def _find_saturation_indicators(self, content: str) -> List[str]:
        """Find indicators that suggest saturation."""
        indicators = []

        saturation_patterns = [
            (r'fully explored', 'Topic marked as fully explored'),
            (r'comprehensive', 'Content described as comprehensive'),
            (r'all aspects', 'All aspects mentioned as covered'),
            (r'no additional', 'No additional information needed'),
            (r'saturated', 'Explicit saturation marker'),
            (r'🟢', 'Green saturation indicator'),
            (r'complete overview', 'Complete overview claimed'),
        ]

        for pattern, description in saturation_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                indicators.append(description)

        return indicators

    def _detect_gaps(self, content: str) -> List[str]:
        """Detect potential gaps in the synthesis."""
        gaps = []

        gap_patterns = [
            (r'needs? more', 'Needs more exploration'),
            (r'unclear', 'Unclear areas identified'),
            (r'missing', 'Missing information noted'),
            (r'\?(?!\s*$)', 'Unanswered questions present'),
            (r'🔴|🟡', 'Non-saturated markers found'),
            (r'NEEDS_HUMAN', 'Human input requested'),
            (r'further research', 'Further research suggested'),
            (r'not covered', 'Topics not covered'),
        ]

        for pattern, description in gap_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                gaps.append(description)

        return gaps

    def get_progress_report(self) -> str:
        """Generate a human-readable progress report."""
        if not self.round_history:
            return "No rounds analyzed yet."

        report = "## Saturation Progress Report\n\n"
        report += "| Round | Score | Novelty Decay | Status |\n"
        report += "|-------|-------|---------------|--------|\n"

        for entry in self.round_history:
            score = entry['overall_score']
            decay = entry['novelty_decay']
            status = "✓" if score >= self.saturation_threshold else "○"
            report += f"| {entry['round']} | {score:.0%} | {decay:.0%} | {status} |\n"

        latest = self.round_history[-1]
        report += f"\n**Current Status**: "
        if latest['overall_score'] >= self.saturation_threshold:
            report += "Ideas appear saturated. Ready for final formatting."
        else:
            report += "Further exploration recommended."

        return report
