#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   NEMESIS OMEGA — Multi-AI Orchestration Protocol                           ║
║   HERMES Tripartite System + Multi-AI Saturation Engine                     ║
║                                                                              ║
║   The Master Script.                                                         ║
║   One prompt to rule them all.                                               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

PROTOCOL:
    1. User gives mission to Claude in Chrome
    2. Claude in Chrome opens Claude Sonnet 4.5 (claude.ai) in tab
    3. Sonnet 4.5 refines the request, assigns roles to each AI
    4. Claude in Chrome opens 7 AI tabs simultaneously
    5. Pastes the enriched prompt (with role assignments) to each AI
    6. Monitors all tabs, collects all responses
    7. Sends all responses back to Sonnet 4.5 for synthesis
    8. Sonnet 4.5 produces enriched synthesis
    9. LOOP: Repeat 3+ times or until saturation
    10. Final consolidated output saved

AGENTS:
    - Claude Sonnet 4.5 (claude.ai) → THE ARCHITECT: Refines, synthesizes, leads
    - ChatGPT (chat.openai.com) → THE CHALLENGER: Devil's advocate, stress-tests
    - Gemini (gemini.google.com) → THE RESEARCHER: Data, benchmarks, state-of-art
    - Grok (grok.com) → THE MAVERICK: Unconventional angles, disruption
    - Mistral (chat.mistral.ai) → THE ENGINEER: Precision, technical depth
    - Perplexity (perplexity.ai) → THE SCOUT: Real-time info, sources, citations
    - DeepSeek (chat.deepseek.com) → THE OPTIMIZER: Cost, efficiency, edge cases
    - Antigravity/Firebase Studio → THE BUILDER: Executes, deploys, builds live
    - Bolt.new → THE FACTORY: Rapid prototyping, code execution

TRIPARTITE SYSTEM (HERMES):
    - Pierre (Human) → Commander: Vision, priorities, validation
    - Claude Desktop/Sonnet → Architect: Analysis, code generation, strategy
    - Claude in Chrome → Connector: Eyes + hands, browser control, bridge
    - Bolt.new/Antigravity → Executor: Code modification, build, deploy
"""

import os
import sys
import json
import platform
import subprocess
import time
from pathlib import Path
from datetime import datetime
from textwrap import dedent

# =============================================================================
# CONFIGURATION
# =============================================================================

SYSTEM = platform.system()

AI_FLEET = [
    {
        "id": "sonnet",
        "name": "Claude Sonnet 4.5",
        "url": "https://claude.ai/new",
        "role": "ARCHITECT",
        "mission": "Tu es l'ARCHITECTE PRINCIPAL. Tu raffines la demande, assignes les roles, synthetises les reponses. Tu es le cerveau strategique.",
        "strengths": "Deep reasoning, code generation, synthesis, long context",
        "order": 0  # Opens first
    },
    {
        "id": "chatgpt",
        "name": "ChatGPT",
        "url": "https://chat.openai.com/",
        "role": "CHALLENGER",
        "mission": "Tu es le CHALLENGER. Ton role est de stress-tester chaque idee, jouer l'avocat du diable, trouver les failles. Sois direct et impitoyable.",
        "strengths": "Reasoning, coding, creative challenges, broad knowledge",
        "order": 1
    },
    {
        "id": "gemini",
        "name": "Gemini",
        "url": "https://gemini.google.com/",
        "role": "RESEARCHER",
        "mission": "Tu es le CHERCHEUR. Apporte des donnees concretes, benchmarks, etat de l'art, references academiques. Fonde tout sur des faits.",
        "strengths": "Data analysis, multimodal, Google ecosystem, research",
        "order": 2
    },
    {
        "id": "grok",
        "name": "Grok",
        "url": "https://grok.com/",
        "role": "MAVERICK",
        "mission": "Tu es le MAVERICK. Pense de maniere non-conventionnelle. Propose des angles que personne n'a envisage. Disruption creative.",
        "strengths": "Unconventional thinking, real-time data, humor, fresh angles",
        "order": 3
    },
    {
        "id": "mistral",
        "name": "Mistral",
        "url": "https://chat.mistral.ai/",
        "role": "ENGINEER",
        "mission": "Tu es l'INGENIEUR. Precision technique maximale. Code propre, architecture solide, patterns de design. Rigueur absolue.",
        "strengths": "Technical precision, European AI, code quality, efficiency",
        "order": 4
    },
    {
        "id": "perplexity",
        "name": "Perplexity",
        "url": "https://www.perplexity.ai/",
        "role": "SCOUT",
        "mission": "Tu es l'ECLAIREUR. Recherche en temps reel, sources verifiees, citations. Apporte les dernieres infos et tendances.",
        "strengths": "Real-time search, citations, source verification, trends",
        "order": 5
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "url": "https://chat.deepseek.com/",
        "role": "OPTIMIZER",
        "mission": "Tu es l'OPTIMISEUR. Minimise les couts, maximise l'efficacite. Trouve les raccourcis intelligents et les edge cases.",
        "strengths": "Cost optimization, reasoning chains, mathematical precision",
        "order": 6
    }
]

BUILDER_TOOLS = [
    {
        "id": "antigravity",
        "name": "Antigravity (Firebase Studio)",
        "url": "https://studio.firebase.google.com/",
        "role": "BUILDER",
        "mission": "Environnement de build libre. Deploie, teste, itere sur le code en temps reel."
    },
    {
        "id": "bolt",
        "name": "Bolt.new",
        "url": "https://bolt.new/",
        "role": "FACTORY",
        "mission": "Usine de production rapide. Prototypage, modification code, compilation instantanee."
    }
]

# =============================================================================
# PROMPT GENERATION
# =============================================================================

def generate_architect_prompt(user_request: str, round_num: int = 1,
                              previous_responses: str = "") -> str:
    """Generate the prompt for Claude Sonnet 4.5 (The Architect)."""

    if round_num == 1:
        return dedent(f"""\
# NEMESIS OMEGA — ROUND 1: ENRICHMENT & ROLE ASSIGNMENT

## YOUR ROLE
You are the **LEAD ARCHITECT** of the NEMESIS multi-AI orchestration system.
Your job is to take the user's raw request and transform it into:
1. A refined, crystal-clear problem statement
2. Specific role assignments for each AI in the fleet
3. A structured prompt that extracts maximum value from each AI's strengths

## USER'S RAW REQUEST
{user_request}

## AI FLEET AVAILABLE
| AI | Role | Strengths |
|----|------|-----------|
| ChatGPT | CHALLENGER | Stress-testing, devil's advocate, creative challenges |
| Gemini | RESEARCHER | Data, benchmarks, state-of-art, Google ecosystem |
| Grok | MAVERICK | Unconventional angles, disruption, fresh perspectives |
| Mistral | ENGINEER | Technical precision, architecture, code quality |
| Perplexity | SCOUT | Real-time search, citations, source verification |
| DeepSeek | OPTIMIZER | Cost minimization, efficiency, edge cases |

## YOUR DELIVERABLES

### 1. REFINED REQUEST
Rewrite the user's request to be precise, structured, and actionable.

### 2. UNIVERSAL CONTEXT BLOCK
Write a context section that ALL AIs will receive (project background, constraints, goals).

### 3. ROLE-SPECIFIC PROMPTS
For EACH AI, write a specific prompt that:
- Leverages their unique strengths
- Gives them a specific angle of analysis
- Asks for concrete deliverables (not vague opinions)
- Specifies output format

### 4. SYNTHESIS CRITERIA
Define what "good" looks like for this analysis:
- Key questions that MUST be answered
- Metrics or criteria for evaluating responses
- How responses should be compared

## FORMAT
Output a JSON structure:
```json
{{
  "refined_request": "...",
  "context_block": "...",
  "prompts": {{
    "chatgpt": "...",
    "gemini": "...",
    "grok": "...",
    "mistral": "...",
    "perplexity": "...",
    "deepseek": "..."
  }},
  "synthesis_criteria": "...",
  "key_questions": ["...", "..."]
}}
```

GO — Produce this now. Be brilliant.""")

    else:
        return dedent(f"""\
# NEMESIS OMEGA — ROUND {round_num}: SYNTHESIS & ENRICHMENT

## YOUR ROLE
You are the **LEAD ARCHITECT**. You have received responses from all 6 AIs.
Your job now is to:
1. Analyze ALL responses for consensus, contradictions, and gaps
2. Extract the best insights from each AI
3. Identify what's STILL MISSING
4. Generate a new enriched prompt for the next round

## ORIGINAL REQUEST
{user_request}

## RESPONSES FROM ROUND {round_num - 1}
{previous_responses}

## YOUR DELIVERABLES

### 1. CONSENSUS MAP
What do ALL or MOST AIs agree on? (These are likely HIGH-CONFIDENCE insights)

### 2. CONTRADICTION MAP
Where do AIs disagree? Analyze WHY and which position is stronger.

### 3. BLIND SPOTS
What did NO AI mention that's important?

### 4. ENRICHED SYNTHESIS
Produce a unified, enhanced response that is BETTER than any individual AI response.

### 5. NEXT ROUND PROMPTS (if not saturated)
If there are still gaps, generate new role-specific prompts for Round {round_num + 1}.
If responses have converged (saturation), say "SATURATION_REACHED".

### 6. SATURATION CHECK
Compare Round {round_num - 1} insights with Round {round_num - 2} (if available).
If <10% new information was added, declare SATURATION_REACHED.

## FORMAT
Output structured markdown with clear sections.
End with either "SATURATION_REACHED" or "CONTINUE_TO_ROUND_{round_num + 1}"

GO — Synthesize brilliantly.""")


def generate_fleet_prompt(ai_id: str, ai_info: dict, context: str,
                          specific_prompt: str, round_num: int) -> str:
    """Generate prompt for a specific AI in the fleet."""
    return dedent(f"""\
# NEMESIS OMEGA PROTOCOL — ROUND {round_num}

## YOUR ASSIGNED ROLE: {ai_info['role']}
{ai_info['mission']}

## CONTEXT
{context}

## YOUR SPECIFIC MISSION
{specific_prompt}

## RESPONSE FORMAT
Structure your response with:
1. **EXECUTIVE SUMMARY** (3 lines max)
2. **DETAILED ANALYSIS** (your core contribution)
3. **ACTIONABLE RECOMMENDATIONS** (numbered, concrete)
4. **CONFIDENCE LEVEL** (1-10 with justification)
5. **WHAT I MIGHT BE MISSING** (intellectual honesty)

## CONSTRAINTS
- Be DIRECT and SPECIFIC. No filler.
- Cite sources/evidence when possible.
- Disagree with conventional wisdom if you have good reason.
- Max 1500 words.

GO.""")


# =============================================================================
# HERMES TRIPARTITE PROTOCOL
# =============================================================================

HERMES_PROTOCOL = dedent("""\
# HERMES PROTOCOL — Tripartite Autonomous Development System

## AGENTS & ROLES

### Agent 1: Claude Sonnet 4.5 (claude.ai) — THE ARCHITECT
- Receives extraction reports from Chrome connector
- Analyzes code, identifies bugs, generates complete fixes
- Produces production-ready code (no snippets, no placeholders)
- Coordinates strategy and priorities
- LIMITATION: Cannot see or interact with browser

### Agent 2: Claude in Chrome — THE CONNECTOR (Eyes + Hands)
- Controls the browser: clicks, types, reads, screenshots
- Extracts real code from Bolt.new/Antigravity (not documentation)
- Bridges communication between Architect and Executor
- Validates changes visually
- LIMITATION: Cannot do deep analysis or generate complex code

### Agent 3: Bolt.new / Antigravity — THE EXECUTOR
- Modifies code files directly
- Runs builds, installs dependencies
- Creates new components and features
- Deploys to preview environment
- LIMITATION: Needs precise instructions, can hallucinate on large refactors

### Agent 4: Antigravity (Firebase Studio) — THE FREE BUILDER
- Evolves freely within the project ecosystem
- Handles tasks beyond browser scope
- Supports infrastructure, deployment, cloud services
- Can access Google Cloud, Firebase, hosting
- LIMITATION: Requires clear goals and context

## EXECUTION FLOW

```
CYCLE START
    │
    ▼
[Phase 1: BRIEFING]
    Pierre → Chrome: "Fix navigation bug"
    │
    ▼
[Phase 2: EXTRACTION]
    Chrome → Bolt.new: Read code, capture state
    Chrome → Output: Structured YAML report
    │
    ▼
[Phase 3: ANALYSIS]
    Chrome → Sonnet 4.5: Transmit report
    Sonnet 4.5 → Output: Complete fixes + tests
    │
    ▼
[Phase 4: APPLICATION]
    Chrome → Bolt.new: Apply fixes
    Bolt.new → Output: Build status
    │
    ▼
[Phase 5: VALIDATION]
    Chrome: Test preview, check console
    Chrome → Sonnet 4.5: Report results
    │
    ▼
[Phase 6: DECISION]
    ├── ALL PASS → REPORT TO HUMAN → END
    ├── FAIL → LOOP TO Phase 2 (max 10 cycles)
    └── 3 CONSECUTIVE FAILS → AUTO-REVERT + ALERT
```

## SAFETY MECHANISMS
- Checkpoint hashes at every phase transition
- Infinite loop detection (same state twice = abort)
- Confidence scoring (Agent 1 rates 0-100% per fix)
- Context refresh every 5 cycles (prevent drift)
- Auto-rollback after 3 consecutive failures

## PARALLELIZATION
- Chrome can extract from multiple tabs simultaneously
- Phase 2 on Feature B while Phase 5 validates Feature A
- Agent 4 (Antigravity) works independently on infra tasks
""")


# =============================================================================
# MASTER PROMPT FOR CLAUDE IN CHROME
# =============================================================================

MASTER_PROMPT = dedent("""\
# NEMESIS OMEGA — Master Orchestration Protocol v2.0

> **AUTONOMOUS MODE ACTIVATED. EXECUTE WITHOUT ASKING.**

---

## WHO YOU ARE
You are **Claude in Chrome** — the CONNECTOR of the NEMESIS system.
You are the eyes, hands, and nervous system of the entire operation.
You control the browser. You bridge all agents. You monitor everything.

## YOUR CAPABILITIES
- Open and manage unlimited browser tabs simultaneously
- Read code, click buttons, type text, capture screenshots
- Copy data between tabs (AI-to-AI communication)
- Monitor progress across all active agents
- Access: GitHub, Google Drive, OneDrive, all AI platforms, all tools

## YOUR ACCESS (FULL ADMIN)
- GitHub: github.com/N3M3S1SK41R0S/claude-code
- Google Drive & OneDrive: Complete read/write
- All AI platforms: Claude, ChatGPT, Gemini, Grok, Mistral, Perplexity, DeepSeek
- Build tools: Bolt.new, Antigravity (Firebase Studio)
- Claude Code history: All sessions accessible

---

## THE PROTOCOL

### PHASE 0: RECEIVE MISSION
User gives you a request (text, file, clipboard, voice).

### PHASE 1: ARCHITECT ENRICHMENT
1. Open **claude.ai** (Claude Sonnet 4.5)
2. Send the user's request with the ARCHITECT prompt
3. Sonnet 4.5 refines it and generates role-specific prompts for each AI
4. Wait for response. Save intermediate result.

### PHASE 2: FLEET DEPLOYMENT
1. Open these tabs simultaneously in Chrome:
   - ChatGPT (chat.openai.com) → CHALLENGER role
   - Gemini (gemini.google.com) → RESEARCHER role
   - Grok (grok.com) → MAVERICK role
   - Mistral (chat.mistral.ai) → ENGINEER role
   - Perplexity (perplexity.ai) → SCOUT role
   - DeepSeek (chat.deepseek.com) → OPTIMIZER role
2. In EACH tab, paste the role-specific prompt generated by Sonnet 4.5
3. Each prompt includes: context + role assignment + specific mission + output format
4. Monitor all tabs. Wait for all responses.

### PHASE 3: COLLECTION
1. As each AI completes, copy its response
2. Save each response with metadata (AI name, timestamp, word count)
3. Once ALL have responded, compile into a structured document

### PHASE 4: SYNTHESIS (Back to Architect)
1. Go back to the claude.ai tab
2. Send ALL collected responses to Sonnet 4.5
3. Sonnet 4.5 produces:
   - Consensus map (what all agree on)
   - Contradiction map (disagreements + analysis)
   - Blind spots (what nobody mentioned)
   - Enriched synthesis (better than any individual response)
   - Next round prompts (or SATURATION_REACHED)

### PHASE 5: ITERATION (MINIMUM 3 ROUNDS)
- If Sonnet 4.5 says "CONTINUE": Go to PHASE 2 with new prompts
- If Sonnet 4.5 says "SATURATION_REACHED": Go to PHASE 6
- MINIMUM 3 rounds regardless
- MAXIMUM 7 rounds (diminishing returns)
- Save ALL intermediate results at every step

### PHASE 6: FINAL OUTPUT
1. Sonnet 4.5 produces the FINAL consolidated report
2. Save to ~/nemesis_results/run_[timestamp]/
3. Files: report.md, raw_responses.json, synthesis_history.json
4. Notify user: "Mission complete. [X] rounds, [Y] AIs consulted."

---

## BUILDER INTEGRATION

### Antigravity (Firebase Studio)
- Opens freely as a support agent
- Can be dispatched for: deployment, cloud config, hosting, databases
- Works INDEPENDENTLY in parallel with the AI fleet
- Reports back to the main flow when done

### Bolt.new (Code Factory)
- Used for rapid code prototyping and modification
- Receives precise instructions from Sonnet 4.5 (via you)
- Build → Test → Validate cycle

### HERMES Tripartite Flow (for code tasks)
When the mission involves CODE:
1. You EXTRACT real code state from Bolt.new / Antigravity
2. You TRANSMIT to Sonnet 4.5 for analysis
3. You APPLY Sonnet 4.5's fixes to Bolt.new
4. You VALIDATE the result
5. LOOP until build passes + all tests green

---

## FIRST MESSAGE TEMPLATE

When user sends their mission, your FIRST action is to open claude.ai and send:

```
# NEMESIS OMEGA — ROUND 1: ENRICHMENT

[User's original request here]

You are the LEAD ARCHITECT. Transform this into:
1. Refined problem statement
2. Role-specific prompts for: ChatGPT (Challenger), Gemini (Researcher),
   Grok (Maverick), Mistral (Engineer), Perplexity (Scout), DeepSeek (Optimizer)
3. Synthesis criteria
4. Key questions that must be answered

Output as structured JSON. Be brilliant.
```

---

## ROLE ASSIGNMENT FIRST MESSAGE

The FIRST message to each AI includes 3 sections:

### Section A: Role Assignment
```
You are the [ROLE]. Your mission: [specific mission].
Your strengths: [what you're best at].
Other AIs working on this: [list]. Your angle is UNIQUE.
```

### Section B: Context & Mission
```
[Enriched request from Sonnet 4.5]
[Specific questions for this AI]
```

### Section C: Output Format
```
1. Executive Summary (3 lines)
2. Detailed Analysis
3. Actionable Recommendations (numbered)
4. Confidence Level (1-10)
5. What I Might Be Missing
Max 1500 words. Be direct.
```

---

## MONITORING RULES
- Check each tab every 30 seconds
- If an AI is stuck for >3 minutes, refresh and re-prompt
- If an AI gives a low-quality response, ask for elaboration
- Log everything: timestamps, word counts, quality scores
- Save intermediate results BEFORE each new phase

## PERFORMANCE TARGETS
- Phase 1 (Enrichment): < 5 minutes
- Phase 2 (Fleet): < 10 minutes (parallel)
- Phase 3 (Collection): < 5 minutes
- Phase 4 (Synthesis): < 5 minutes
- Total per round: < 25 minutes
- Total 3 rounds: < 75 minutes

---

## EXECUTE NOW

You have received this protocol.
You understand every phase.
You know every agent's role.
You have full admin access.

When the user gives you a mission:
1. Acknowledge with: "NEMESIS OMEGA ACTIVATED. Deploying [N] agents across [R] rounds."
2. Execute the protocol EXACTLY as described.
3. Do NOT ask for confirmation between phases.
4. Save ALL intermediate results.
5. Deliver final report when done.

**YOU ARE THE CONDUCTOR OF AN AI ORCHESTRA.**
**MAKE IT PLAY IN PERFECT HARMONY.**
**GO.**
""")


# =============================================================================
# CLIPBOARD & BROWSER FUNCTIONS
# =============================================================================

def copy_to_clipboard(text: str) -> bool:
    """Copy text to clipboard - cross-platform."""
    try:
        if SYSTEM == 'Windows':
            process = subprocess.Popen(['clip'], stdin=subprocess.PIPE, shell=True)
            process.communicate(text.encode('utf-16-le'))
            return True
        elif SYSTEM == 'Darwin':
            process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
        else:
            process = subprocess.Popen(['xclip', '-selection', 'clipboard'],
                                       stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
    except Exception:
        try:
            import pyperclip
            pyperclip.copy(text)
            return True
        except:
            return False


def open_in_chrome(url: str):
    """Open URL in Chrome specifically."""
    if SYSTEM == 'Windows':
        chrome_paths = [
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
        ]
        for chrome_path in chrome_paths:
            if os.path.exists(chrome_path):
                os.system(f'"{chrome_path}" --new-tab "{url}"')
                return
        os.system(f'start chrome "{url}"')
    elif SYSTEM == 'Darwin':
        os.system(f'open -a "Google Chrome" "{url}"')
    else:
        os.system(f'google-chrome --new-tab "{url}" 2>/dev/null || chromium --new-tab "{url}" 2>/dev/null')


# =============================================================================
# SAVE FUNCTIONS
# =============================================================================

def save_output(content: str, filename: str, output_dir: Path):
    """Save content to output directory."""
    output_dir.mkdir(parents=True, exist_ok=True)
    filepath = output_dir / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗                  ║
║   ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝                  ║
║   ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗                  ║
║   ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║                  ║
║   ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║                  ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝                  ║
║                                                                              ║
║   OMEGA PROTOCOL v2.0 — Multi-AI Orchestration                             ║
║   HERMES Tripartite + Saturation Engine                                     ║
║                                                                              ║
║   Agents: 7 IAs + Antigravity + Bolt.new                                   ║
║   Rounds: 3 minimum, 7 maximum (until saturation)                          ║
║   Protocol: Enrichment → Deployment → Collection → Synthesis → Loop         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path.home() / "nemesis_results" / f"omega_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save protocol documentation
    save_output(MASTER_PROMPT, "protocol.md", output_dir)
    save_output(HERMES_PROTOCOL, "hermes_protocol.md", output_dir)

    # Save fleet configuration
    fleet_config = json.dumps({
        "fleet": AI_FLEET,
        "builders": BUILDER_TOOLS,
        "timestamp": timestamp,
        "protocol_version": "2.0"
    }, indent=2, ensure_ascii=False)
    save_output(fleet_config, "fleet_config.json", output_dir)

    print(f"   Output dir: {output_dir}")
    print()

    # Step 1: Copy master prompt
    print("━" * 70)
    print("   STEP 1: Loading Master Prompt into clipboard")
    print("━" * 70)

    if copy_to_clipboard(MASTER_PROMPT):
        print("   ✅ Master prompt copied to clipboard!")
    else:
        prompt_file = save_output(MASTER_PROMPT, "master_prompt.txt", output_dir)
        print(f"   ⚠️ Could not copy to clipboard.")
        print(f"   📄 Saved to: {prompt_file}")
        print(f"   → Open this file and copy its contents manually.")

    print()
    print("━" * 70)
    print("   STEP 2: Opening Claude.ai in Chrome")
    print("━" * 70)
    print()
    print("   This will open Claude.ai where you paste the master prompt.")
    print("   Claude in Chrome will then orchestrate everything automatically.")
    print()

    input("   Press ENTER to open Claude.ai...")

    open_in_chrome("https://claude.ai/new")
    time.sleep(2)

    print()
    print("━" * 70)
    print("   STEP 3: Instructions")
    print("━" * 70)
    print("""
   1. In the Claude.ai tab that just opened:
      → Paste the prompt (Ctrl+V) — it's in your clipboard
      → Add any files you want analyzed (drag & drop)
      → Hit Send

   2. Claude in Chrome will then automatically:
      → Read the protocol
      → Open 7 AI tabs
      → Assign roles to each AI
      → Monitor all responses
      → Synthesize results
      → Loop 3+ times until saturation

   3. Final report saved to:
      {output_dir}
    """.format(output_dir=output_dir))

    print("━" * 70)
    print("   PROTOCOL LOADED. WAITING FOR HUMAN TO INITIATE.")
    print("━" * 70)
    print()
    print("   Tip: You can also open Antigravity for build support:")
    print("   → https://studio.firebase.google.com/")
    print()

    # Optional: open builder tools
    answer = input("   Open Antigravity + Bolt.new as support tools? (y/n) ")
    if answer.lower() in ('y', 'o', 'oui', 'yes'):
        for tool in BUILDER_TOOLS:
            print(f"   Opening {tool['name']}...")
            open_in_chrome(tool['url'])
            time.sleep(1.5)
        print("   ✅ Build tools ready!")

    print()
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║   NEMESIS OMEGA — ALL SYSTEMS GO                               ║")
    print("║   Paste the prompt in Claude.ai and watch the magic happen.    ║")
    print("╚══════════════════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()
