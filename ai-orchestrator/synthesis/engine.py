"""
Advanced Synthesis Engine
Coordinates multi-round synthesis with saturation detection.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

logger = logging.getLogger('Synthesis-Engine')


class SynthesisStrategy(Enum):
    """Strategy for synthesis approach."""
    CONSENSUS = "consensus"  # Find common ground
    COMPARATIVE = "comparative"  # Compare and contrast
    INTEGRATIVE = "integrative"  # Integrate all perspectives
    CRITICAL = "critical"  # Critical analysis of conflicts


@dataclass
class AIResponse:
    """Represents a response from an AI service."""
    source: str
    content: str
    confidence: float = 1.0
    metadata: Dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SynthesisRound:
    """Represents a single round of synthesis."""
    round_number: int
    input_responses: List[AIResponse]
    synthesizer: str  # AI used for synthesis
    prompt: str
    result: str
    saturation_score: float
    key_insights: List[str]
    conflicts_identified: List[str]
    gaps_identified: List[str]
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SynthesisResult:
    """Final result of synthesis process."""
    original_request: str
    clarified_request: str
    rounds: List[SynthesisRound]
    final_synthesis: str
    total_sources: int
    saturation_achieved: bool
    confidence_score: float
    recommendations: List[str]
    warnings: List[str]
    metadata: Dict = field(default_factory=dict)


class SynthesisEngine:
    """
    Advanced synthesis engine for multi-AI response consolidation.

    Process:
    1. Collect responses from multiple AIs
    2. Analyze for common themes, conflicts, and gaps
    3. Generate structured synthesis tables
    4. Run multiple rounds until saturation
    5. Produce final consolidated output
    """

    def __init__(self, max_rounds: int = 3, saturation_threshold: float = 0.85):
        self.max_rounds = max_rounds
        self.saturation_threshold = saturation_threshold
        self.rounds: List[SynthesisRound] = []

    def generate_synthesis_prompt(self, responses: List[AIResponse],
                                  round_num: int,
                                  strategy: SynthesisStrategy = SynthesisStrategy.INTEGRATIVE,
                                  previous_synthesis: Optional[str] = None) -> str:
        """
        Generate a comprehensive synthesis prompt.

        Args:
            responses: List of AI responses to synthesize
            round_num: Current round number
            strategy: Synthesis strategy to use
            previous_synthesis: Result from previous round (if any)
        """
        prompt = f"""# Synthesis Round {round_num}/{self.max_rounds}

## Objective
Create a comprehensive synthesis of the following AI responses using {strategy.value} strategy.

## Critical Guidelines
1. **NO INVENTION**: Do not add information not present in the sources
2. **NO FABRICATION**: Do not make up examples or data
3. **CITE SOURCES**: Reference which AI provided each insight
4. **FLAG UNCERTAINTY**: Mark uncertain conclusions with [UNCERTAIN]
5. **IDENTIFY CONFLICTS**: Explicitly note contradictions between sources

"""
        if previous_synthesis:
            prompt += f"""## Previous Round Synthesis
{previous_synthesis}

## Task for This Round
Build upon the previous synthesis by:
- Deepening existing insights
- Resolving identified conflicts
- Filling identified gaps
- Increasing saturation without invention

"""

        prompt += "## AI Responses to Synthesize\n\n"

        for i, resp in enumerate(responses, 1):
            prompt += f"""### Source {i}: {resp.source}
{resp.content}

---

"""

        prompt += """## Required Output Structure

### 1. Synthesis Table
| Topic | Source(s) | Key Points | Confidence | Notes |
|-------|-----------|------------|------------|-------|
| ... | ... | ... | High/Medium/Low | ... |

### 2. Common Themes
- List themes that appear across multiple sources
- Indicate agreement level (unanimous/majority/split)

### 3. Conflicts & Contradictions
- Explicitly list where sources disagree
- Provide evidence for each position
- Suggest resolution if possible, otherwise flag for human review

### 4. Gaps & Missing Information
- What questions remain unanswered?
- What additional research might be needed?
- Flag: [NEEDS_HUMAN_INPUT] for critical decisions

### 5. Key Insights (Saturation Check)
Rate each insight's saturation level:
- 🟢 Saturated (fully explored)
- 🟡 Partial (needs more depth)
- 🔴 Unsaturated (requires another round)

### 6. Consolidated Recommendations
- Actionable next steps based on synthesis
- Prioritized by confidence level

### 7. Meta-Analysis
- Overall confidence in synthesis: __%
- Saturation estimate: __%
- Recommendation: [PROCEED/ANOTHER_ROUND/NEED_MORE_SOURCES]
"""

        return prompt

    def generate_final_formatting_prompt(self, synthesis_result: str,
                                          target_tools: List[str],
                                          project_context: Dict) -> str:
        """
        Generate prompt for final formatting phase.

        This creates instructions tailored to each target tool/AI.
        """
        prompt = f"""# Final Formatting Phase

## Project Context
- Name: {project_context.get('name', 'Project')}
- Description: {project_context.get('description', '')}
- Original Request: {project_context.get('original_request', '')}

## Synthesized Content
{synthesis_result}

## Target Destinations
{', '.join(target_tools)}

## Task
Create properly formatted instructions for EACH target tool listed above.
Respect each tool's specific constraints and capabilities.

## Tool-Specific Requirements

"""
        tool_specs = {
            'claude': """### Claude (Sonnet/Opus)
- Max tokens: 8192
- Supports: Markdown, code blocks, tool use
- Format: Structured prompts with clear sections
- Include: System context, specific instructions, expected output format""",

            'chatgpt': """### ChatGPT (GPT-4)
- Max tokens: 4096
- Supports: Markdown, code, function calling
- Format: Conversational but structured
- Include: Clear objective, constraints, examples if helpful""",

            'gemini': """### Google Gemini
- Max tokens: 8192
- Supports: Markdown, multimodal
- Format: Clear sections with bullet points
- Include: Context, specific requirements, output format""",

            'antigravity': """### Google Antigravity (Firebase Studio)
- Max tokens: ~4000
- Supports: App specifications
- Format: Structured app requirements
- Include: UI specs, data models, user flows, Firebase config
- Focus on: Functional requirements, not implementation details""",

            'cursor': """### Cursor IDE
- Format: Code-focused instructions
- Include: File paths, specific changes, test requirements
- Style: Technical and precise
- Include: Acceptance criteria for code changes""",

            'vscode': """### VS Code
- Format: Task-based instructions
- Include: Extensions needed, configuration, file operations
- Style: Step-by-step technical guide""",

            'mistral': """### Mistral (Codestral)
- Max tokens: 4096
- Specialization: Code generation
- Format: Clear code requirements
- Include: Language, framework, coding standards"""
        }

        for tool in target_tools:
            tool_lower = tool.lower()
            if tool_lower in tool_specs:
                prompt += tool_specs[tool_lower] + "\n\n"
            else:
                prompt += f"""### {tool}
- Follow standard formatting conventions
- Include clear instructions and expected output\n\n"""

        prompt += """## Output Format
For each tool, provide:
1. **Target**: [Tool name]
2. **Token Count**: Estimated tokens
3. **Instructions**:
```
[Formatted instructions here]
```

## Quality Checklist
Before finalizing, verify:
- [ ] All token limits respected
- [ ] No invented information included
- [ ] Instructions are self-contained
- [ ] Each tool gets complete context
- [ ] Action items are clear and specific
"""

        return prompt

    def analyze_responses(self, responses: List[AIResponse]) -> Dict:
        """
        Analyze responses for themes, conflicts, and gaps.

        Returns analysis metadata for synthesis guidance.
        """
        analysis = {
            'total_sources': len(responses),
            'total_content_length': sum(len(r.content) for r in responses),
            'sources': [r.source for r in responses],
            'common_keywords': self._extract_common_keywords(responses),
            'potential_conflicts': self._detect_conflicts(responses),
            'coverage_estimate': self._estimate_coverage(responses)
        }

        logger.info(f"Response analysis: {len(responses)} sources, "
                    f"{analysis['total_content_length']} chars total")

        return analysis

    def _extract_common_keywords(self, responses: List[AIResponse]) -> List[str]:
        """Extract keywords that appear across multiple responses."""
        word_counts: Dict[str, int] = {}

        for resp in responses:
            words = set(resp.content.lower().split())
            # Filter short words and common stopwords
            words = {w for w in words if len(w) > 4}

            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1

        # Return words appearing in multiple responses
        common = [word for word, count in word_counts.items()
                  if count >= len(responses) * 0.5]

        return sorted(common, key=lambda w: word_counts[w], reverse=True)[:20]

    def _detect_conflicts(self, responses: List[AIResponse]) -> List[str]:
        """Detect potential conflicts between responses."""
        conflicts = []

        # Simple heuristic: look for negation patterns
        negation_words = ['not', 'don\'t', 'shouldn\'t', 'won\'t', 'cannot',
                          'however', 'but', 'although', 'contrary', 'disagree']

        for i, resp1 in enumerate(responses):
            for resp2 in responses[i+1:]:
                # Check if one response might contradict another
                for neg in negation_words:
                    if neg in resp1.content.lower() or neg in resp2.content.lower():
                        # Found potential conflict marker
                        conflicts.append(f"Potential conflict between {resp1.source} and {resp2.source}")
                        break

        return list(set(conflicts))

    def _estimate_coverage(self, responses: List[AIResponse]) -> float:
        """Estimate topic coverage from responses."""
        if not responses:
            return 0.0

        # Simple heuristic based on content diversity
        total_unique_words = set()
        for resp in responses:
            words = set(resp.content.lower().split())
            total_unique_words.update(words)

        # More unique words = better coverage (simplified metric)
        coverage = min(len(total_unique_words) / 500, 1.0)
        return coverage

    def create_verification_prompt(self, executed_work: Dict,
                                    original_request: str) -> str:
        """
        Create prompt for Claude to verify completed work.
        """
        return f"""# Work Verification Request

## Original Request
{original_request}

## Executed Work Summary
{self._format_executed_work(executed_work)}

## Verification Tasks

### 1. Completeness Check
- [ ] All requirements from original request addressed
- [ ] No critical functionality missing
- [ ] Edge cases considered

### 2. Quality Check
- [ ] Code follows best practices (if applicable)
- [ ] Documentation is adequate
- [ ] No obvious bugs or issues

### 3. Consistency Check
- [ ] Output matches synthesized specifications
- [ ] No contradictions with original requirements
- [ ] Integration points are compatible

### 4. Test Recommendations
Suggest specific tests to verify:
- Functional correctness
- Edge cases
- Performance (if relevant)

### 5. Issues Found
List any issues discovered:
| Issue | Severity | Suggested Fix |
|-------|----------|---------------|
| ... | Critical/Warning/Info | ... |

### 6. Final Assessment
- Overall Status: [PASS/PASS_WITH_WARNINGS/FAIL]
- Confidence: __%
- Next Steps: [LIST]

## Output
Provide a structured verification report following the above format.
Flag any issues that require human intervention with [NEEDS_HUMAN_REVIEW].
"""

    def _format_executed_work(self, work: Dict) -> str:
        """Format executed work for verification prompt."""
        formatted = []
        for key, value in work.items():
            if isinstance(value, dict):
                formatted.append(f"### {key}")
                for k, v in value.items():
                    formatted.append(f"- {k}: {v}")
            else:
                formatted.append(f"### {key}\n{value}")
        return "\n\n".join(formatted)
