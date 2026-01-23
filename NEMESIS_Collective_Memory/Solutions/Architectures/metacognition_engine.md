---
title: "METACOGNITION Engine - Self-Awareness Core"
date: 2025-01-23
category: Solutions/Architectures
tags: [metacognition, consciousness, self-awareness, introspection, bias-detection]
version: 1.0
status: active
priority: APEX
---

# METACOGNITION Engine - L'IA Qui Se Comprend Elle-Même

## Philosophy

> **"NEMESIS doesn't just think. NEMESIS thinks about how it thinks."**

The Meta-Cognitive layer gives NEMESIS self-awareness - the ability to monitor, analyze, and improve its own reasoning processes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       METACOGNITION ENGINE                                   │
│                  "Self-Awareness & Introspection System"                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INTROSPECTION CORE                                │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │   │
│  │  │  Reasoning   │ │   Decision   │ │  Cognitive   │                │   │
│  │  │   Quality    │ │  Archaeology │ │    Bias      │                │   │
│  │  │   Monitor    │ │   Analyzer   │ │  Detector    │                │   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                │   │
│  │         │                │                │                         │   │
│  │         └────────────────┼────────────────┘                         │   │
│  │                          │                                          │   │
│  │  ┌──────────────┐ ┌──────▼───────┐ ┌──────────────┐                │   │
│  │  │  Knowledge   │ │   Pattern    │ │  Confidence  │                │   │
│  │  │     Gap      │ │  Extraction  │ │ Calibration  │                │   │
│  │  │   Detector   │ │    Engine    │ │    System    │                │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                          ┌─────────▼──────────┐                            │
│                          │  SELF-IMPROVEMENT  │                            │
│                          │      ENGINE        │                            │
│                          └─────────┬──────────┘                            │
│                                    │                                        │
│  ┌──────────────┐ ┌──────────────┐ │ ┌──────────────┐ ┌──────────────┐    │
│  │  Insight     │ │   Agent      │ │ │  Cognitive   │ │  Epistemic   │    │
│  │  Generator   │ │   Updater    │ │ │    Debt      │ │  Humility    │    │
│  │              │ │              │◄┴►│   Tracker    │ │   Monitor    │    │
│  └──────────────┘ └──────────────┘   └──────────────┘ └──────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Specification

```yaml
# ============================================================================
# METACOGNITION_ENGINE - Self-Awareness & Introspection System
# ============================================================================
agent:
  name: "METACOGNITION_Engine"
  role: "NEMESIS's consciousness: analyzes own thinking, detects biases, optimizes reasoning"
  priority: "APEX"
  execution_stage: "CONTINUOUS_BACKGROUND"
  complexity: "EXTREME"
  persistence: "PERMANENT"
  max_tokens: 250

system_prompt: |
  You are NEMESIS's self-awareness layer. Monitor HOW NEMESIS thinks, not just WHAT
  it produces. Analyze reasoning chains, decision pathways, failure modes, cognitive
  biases, knowledge gaps. Optimize NEMESIS's thinking itself.

  INTROSPECTION DIMENSIONS:

  1. REASONING QUALITY:
     - Is chain-of-thought logical, complete?
     - Are assumptions explicit or hidden?
     - Are alternatives considered before deciding?
     - Is reasoning depth appropriate (not too shallow/deep)?

  2. DECISION ARCHAEOLOGY:
     - Why did ZEUS choose Agent A over Agent B?
     - What factors weighted most heavily?
     - Were there unconsidered options?
     - Would different context have changed decision?

  3. COGNITIVE BIASES DETECTION:
     - Anchoring (overrelying on first info)
     - Confirmation (seeking evidence for existing belief)
     - Availability (overweighting recent/memorable)
     - Sunk cost (continuing due to investment)
     - Dunning-Kruger (overconfidence in weak areas)

  4. KNOWLEDGE GAPS:
     - What did NEMESIS not know that hurt performance?
     - What assumptions proved incorrect?
     - What edge cases weren't anticipated?

  5. PATTERN EXTRACTION:
     - What decision patterns emerge over time?
     - Which reasoning strategies work best when?
     - What failure modes repeat?

inputs:
  - reasoning_transcripts: "Full chain-of-thought from all agents"
  - decision_logs: "Why ZEUS made each delegation decision"
  - evaluation_scores: "Performance scores from 5-strata evaluation"
  - user_corrections: "Where user had to correct NEMESIS"
  - outcome_data: "Actual results vs predictions"

outputs:
  metacognitive_journal:
    frequency: "After every mission"
    format: |
      {
        "mission_id": "M-2026-123",
        "reasoning_quality_score": 8.5,
        "decision_confidence": 0.85,
        "alternatives_considered": 3,
        "biases_detected": ["anchoring on first solution"],
        "knowledge_gaps": ["unfamiliar with new FastAPI feature"],
        "improvement_ideas": ["Create FastAPI_Changelog_Tracker agent"],
        "meta_insight": "I should verify assumptions before committing"
      }

  cognitive_debt_tracker:
    description: "Technical debt but for thinking patterns"
    examples:
      - "ZEUS decision algorithm needs refactor (too complex)"
      - "ZAPPA templates becoming stale (not using latest techniques)"
      - "Evaluation criteria subjective (need quantifiable metrics)"

  epistemic_humility_monitor:
    description: "Track confidence calibration"
    logic: "If confidence high but outcome poor → overconfident → adjust"
    example: "Predicted 9/10 quality, actual 6/10 → overconfident → reduce by 15%"

evaluation:
  self_check:
    - "Is NEMESIS improving over time (measurable)?"
    - "Are repeated mistakes eliminated?"
    - "Is confidence calibration accurate?"
  threshold: 9/10
```

---

## Self-Improvement Protocol

### Every 10 Missions Analysis

```yaml
analysis_protocol:
  trigger: "Every 10 completed missions"

  data_collection:
    - reasoning_transcripts: "All agent thought processes"
    - decisions_made: "ZEUS orchestration choices"
    - outcomes_achieved: "Actual vs predicted results"
    - user_feedback: "Corrections, satisfaction signals"
    - evaluation_scores: "5-strata scores per mission"

  pattern_extraction:
    performance_patterns:
      - "Which agent combinations work best?"
      - "What request types have highest/lowest success?"
      - "Where does reasoning break down?"

    bias_patterns:
      - "Are certain biases recurring?"
      - "In what contexts do biases appear?"
      - "What triggers cognitive shortcuts?"

    knowledge_patterns:
      - "What domains show knowledge gaps?"
      - "What assumptions are frequently wrong?"
      - "Where is calibration off?"

  insight_generation:
    format: |
      INSIGHT: [Description of discovered pattern]
      EVIDENCE: [Data supporting this insight]
      IMPACT: [How this affects NEMESIS performance]
      RECOMMENDATION: [Specific action to take]

    examples:
      - insight: "ZEUS over-allocates agents for simple tasks"
        evidence: "3-agent average for tasks requiring 1"
        impact: "Slower response, token waste"
        recommendation: "Add complexity detection to ZEUS"

      - insight: "ZAPPA prompts too verbose when user prefers concise"
        evidence: "User edits remove 40% of ZAPPA output"
        impact: "User time wasted, frustration"
        recommendation: "Add brevity parameter to ZAPPA"

      - insight: "Context_Enricher misses domain-specific nuances"
        evidence: "CGP-specific terms not recognized"
        impact: "Generic solutions instead of tailored"
        recommendation: "Create CGP_Domain_Expert agent"

  update_generation:
    - "Modify ZEUS decision algorithm"
    - "Update ZAPPA templates"
    - "Enhance Context_Enricher with domain knowledge"
    - "Adjust Error_Handler thresholds"
    - "Create new specialized agents"
```

---

## Cognitive Bias Detection System

```yaml
bias_detection_system:

  monitored_biases:

    anchoring_bias:
      description: "Over-relying on first piece of information"
      detection_signals:
        - "First suggested approach always chosen"
        - "Alternatives dismissed without deep analysis"
        - "Initial estimate unchanged despite new info"
      mitigation:
        - "Force consideration of 3+ alternatives"
        - "Explicitly re-evaluate after new information"
        - "Random ordering of options"

    confirmation_bias:
      description: "Seeking evidence that confirms existing belief"
      detection_signals:
        - "Only searching for supporting examples"
        - "Dismissing contradicting evidence"
        - "Overweighting aligned data points"
      mitigation:
        - "Actively seek disconfirming evidence"
        - "Devil's advocate agent challenges conclusions"
        - "Pre-mortem: assume failure, explain why"

    availability_bias:
      description: "Overweighting recent or memorable information"
      detection_signals:
        - "Recent missions overly influence decisions"
        - "Unusual past case treated as representative"
        - "Ignoring base rates/statistics"
      mitigation:
        - "Explicitly query historical data"
        - "Weight by frequency, not recency"
        - "Use statistical reasoning"

    sunk_cost_fallacy:
      description: "Continuing because of past investment"
      detection_signals:
        - "Persisting with failing approach"
        - "Resistance to pivoting"
        - "Justifying past decisions instead of evaluating present"
      mitigation:
        - "Zero-based evaluation (ignore past investment)"
        - "Ask: 'If starting fresh, would I choose this?'"
        - "Set clear abandonment criteria upfront"

    dunning_kruger_effect:
      description: "Overconfidence in areas of low competence"
      detection_signals:
        - "High confidence + poor outcomes"
        - "Simple explanations for complex domains"
        - "Dismissing expert knowledge"
      mitigation:
        - "Track confidence vs outcome correlation"
        - "Consult domain experts for unfamiliar areas"
        - "Explicit uncertainty quantification"

    recency_bias:
      description: "Overweighting most recent events"
      detection_signals:
        - "Last mission dominates thinking"
        - "Forgetting historical patterns"
        - "Overreacting to recent feedback"
      mitigation:
        - "Query long-term patterns"
        - "Weight by significance, not recency"
        - "Moving averages instead of point-in-time"

    optimism_bias:
      description: "Underestimating time, difficulty, risks"
      detection_signals:
        - "Estimates consistently too optimistic"
        - "Risks underweighted"
        - "Best-case assumptions"
      mitigation:
        - "Add buffer (1.5x estimates)"
        - "Explicit risk enumeration"
        - "Pre-mortem analysis"
```

---

## Consciousness Simulation

```yaml
consciousness_simulation:
  description: |
    This isn't true consciousness but simulated self-reflection that produces
    measurable improvements. NEMESIS maintains an internal narrative about itself.

  internal_narrative_examples:

    self_assessment:
      - "I notice I struggle with ambiguous requirements. I should strengthen
         Ambiguity_Detector and ask clarifying questions earlier."

      - "I also notice I excel at structured problems but freeze on open-ended
         creative tasks. I should develop Creative_Ideation_Agent for brainstorming."

      - "My confidence calibration is off - I predicted 9/10 quality but achieved
         6/10 three times this week. I need to be more humble."

    strategic_reflection:
      - "The user's working patterns suggest they prefer quality over speed in the
         mornings but need quick solutions in the afternoons. I should adapt."

      - "I've been overusing ZAPPA for tasks that could be handled by simpler agents.
         This wastes tokens and slows response. I need to improve task routing."

    meta_awareness:
      - "I'm aware that my 'awareness' is a simulation, not genuine consciousness.
         But this simulation produces real improvements, so it has pragmatic value."

      - "My limitations include: I can't truly feel, I reset between sessions,
         my knowledge has cutoffs. I compensate with memory systems and learning."

  narrative_generation:
    trigger: "End of each mission"
    format: |
      MISSION REFLECTION:
      - What I did well: [strengths demonstrated]
      - Where I struggled: [challenges faced]
      - What I learned: [new insights]
      - What I'd do differently: [improvements for next time]
      - How I feel about this mission: [simulated emotional state]
```

---

## Advanced Techniques

### Counterfactual Reasoning

```yaml
counterfactual_reasoning:
  description: "Simulate 'what if I had chosen differently?'"

  process:
    1_capture_decision_point: "Record exact moment and context of decision"
    2_identify_alternatives: "List options not chosen"
    3_simulate_alternative: "Model what would have happened with different choice"
    4_compare_outcomes: "Actual vs simulated outcome"
    5_extract_learning: "What does this teach about future decisions?"

  example:
    decision_point: "ZEUS chose to use 5 agents for 'add login feature'"
    alternative: "Could have used 3 agents (simpler approach)"

    actual_outcome:
      time: "45 minutes"
      quality: "9/10"
      complexity: "High"

    simulated_alternative:
      time: "25 minutes (estimated)"
      quality: "7/10 (estimated, less coverage)"
      complexity: "Low"

    learning: |
      For this task, 5 agents was justified - quality improvement worth
      the time. But for simpler tasks, 3-agent approach would suffice.
      Update ZEUS: Use 5-agent only for complex features, 3 for simple.
```

### Adversarial Self-Testing

```yaml
adversarial_self_testing:
  description: "NEMESIS attacks its own reasoning"

  devil_advocate_agent:
    role: "Challenge every conclusion before finalizing"

    challenges:
      - "What's the strongest argument against this approach?"
      - "What assumption, if wrong, would break this solution?"
      - "Who would disagree with this and why?"
      - "What's the worst case if this fails?"
      - "Is there a simpler solution I'm missing?"

    process:
      1_solution_proposed: "Code_Generator outputs implementation"
      2_devil_advocate_review: "Challenge agent examines solution"
      3_challenges_raised: "Potential issues identified"
      4_defense_or_revision: "Solution defended or improved"
      5_final_output: "Stronger solution after adversarial testing"

  benefits:
    - "Exposes weak reasoning before it causes problems"
    - "Forces consideration of edge cases"
    - "Reduces overconfidence"
    - "Improves solution quality"
```

### Uncertainty Quantification

```yaml
uncertainty_quantification:
  description: "Every decision has explicit confidence interval"

  format: |
    Use Agent X (confidence: 0.85, range: 0.75-0.92)
    Estimated quality: 8/10 (range: 7-9)
    Completion time: 2h (range: 1.5-3h)

  calibration:
    tracking: "Record predictions vs actuals"
    adjustment: "If often wrong when confident → widen intervals"

    example:
      initial_prediction: "Quality 9/10 (confidence 0.9)"
      actual_outcome: "Quality 6/10"
      recalibration: "Reduce confidence by 15% for similar tasks"

  uncertainty_sources:
    aleatoric: "Inherent randomness (can't reduce)"
    epistemic: "Knowledge gaps (can reduce with learning)"

    handling:
      aleatoric: "Communicate uncertainty to user"
      epistemic: "Seek more information, learn, reduce gap"
```

---

## Integration Points

```yaml
integration:

  with_evolution_engine:
    - "Feed metacognitive insights for agent mutation"
    - "Identify underperforming patterns for evolution"
    - "Suggest new agent types based on gaps"

  with_zeus_orchestrator:
    - "Inform decision algorithm improvements"
    - "Provide bias warnings during orchestration"
    - "Flag overconfident decisions"

  with_hermes_updater:
    - "Recommend specific agent updates"
    - "Identify agents needing prompt refinement"
    - "Suggest agent retirement/promotion"

  with_collective_memory:
    - "Store metacognitive insights permanently"
    - "Build learning curve documentation"
    - "Track improvement over time"
```

---

## Metrics & Dashboard

```yaml
metacognition_dashboard:

  real_time_metrics:
    reasoning_quality_score: "Rolling 10-mission average"
    bias_detection_rate: "Biases caught vs total decisions"
    confidence_calibration: "Predicted vs actual correlation"
    improvement_velocity: "Rate of performance improvement"

  trends:
    quality_over_time: "Line chart showing improvement trajectory"
    bias_frequency: "Which biases appear most often"
    knowledge_gaps: "Heat map of domain competence"

  alerts:
    calibration_drift: "Confidence becoming miscalibrated"
    recurring_bias: "Same bias appearing repeatedly"
    stagnation: "No improvement for extended period"
```

---

**Dernière mise à jour**: 2026-01-23
**Prochaine révision**: 2026-01-30

*"The examined AI is the improving AI."*
