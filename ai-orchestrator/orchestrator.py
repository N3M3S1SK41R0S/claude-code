#!/usr/bin/env python3
"""
AI Orchestrator - Multi-AI Collaboration System
Double-click to launch intelligent AI workflow orchestration.

Author: Claude AI Assistant
Version: 1.0.0
"""

import asyncio
import json
import logging
import os
import signal
import sys
import sqlite3
import webbrowser
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, List, Any
from concurrent.futures import ThreadPoolExecutor
import subprocess
import threading
import queue
import time
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('AI-Orchestrator')


class AIRole(Enum):
    ORCHESTRATOR = "orchestrator"
    SYNTHESIS = "synthesis"
    RESEARCHER = "researcher"
    CODER = "coder"


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SIMULATED = "simulated"


@dataclass
class AIService:
    """Represents an AI service configuration."""
    name: str
    url: str
    role: AIRole
    max_tokens: int
    priority: int
    available: bool = True
    model: Optional[str] = None


@dataclass
class Task:
    """Represents a task in the orchestration pipeline."""
    id: str
    content: str
    status: TaskStatus = TaskStatus.PENDING
    assigned_to: Optional[str] = None
    result: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class Project:
    """Represents a project with its history and context."""
    id: str
    name: str
    description: str
    original_request: str
    clarified_request: Optional[str] = None
    tasks: List[Task] = field(default_factory=list)
    synthesis_rounds: List[Dict] = field(default_factory=list)
    final_output: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class ProjectMemory:
    """Persistent storage for projects and their history."""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()

    def _init_database(self):
        """Initialize SQLite database."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    description TEXT,
                    original_request TEXT,
                    clarified_request TEXT,
                    final_output TEXT,
                    data JSON,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS ai_responses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT,
                    ai_service TEXT,
                    prompt TEXT,
                    response TEXT,
                    status TEXT,
                    created_at TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id)
                )
            ''')
            conn.commit()

    def save_project(self, project: Project):
        """Save or update a project."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO projects
                (id, name, description, original_request, clarified_request,
                 final_output, data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                project.id, project.name, project.description,
                project.original_request, project.clarified_request,
                project.final_output,
                json.dumps({
                    'tasks': [(t.id, t.content, t.status.value, t.result) for t in project.tasks],
                    'synthesis_rounds': project.synthesis_rounds
                }),
                project.created_at.isoformat(),
                datetime.now().isoformat()
            ))
            conn.commit()

    def load_project(self, project_id: str) -> Optional[Project]:
        """Load a project by ID."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'SELECT * FROM projects WHERE id = ?', (project_id,)
            )
            row = cursor.fetchone()
            if row:
                data = json.loads(row[6]) if row[6] else {}
                return Project(
                    id=row[0], name=row[1], description=row[2],
                    original_request=row[3], clarified_request=row[4],
                    final_output=row[5],
                    created_at=datetime.fromisoformat(row[7]),
                    updated_at=datetime.fromisoformat(row[8])
                )
        return None

    def list_projects(self) -> List[Dict]:
        """List all projects."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'SELECT id, name, description, created_at FROM projects ORDER BY updated_at DESC'
            )
            return [
                {'id': r[0], 'name': r[1], 'description': r[2], 'created_at': r[3]}
                for r in cursor.fetchall()
            ]

    def save_ai_response(self, project_id: str, ai_service: str,
                         prompt: str, response: str, status: str):
        """Save an AI response for audit trail."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO ai_responses
                (project_id, ai_service, prompt, response, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (project_id, ai_service, prompt, response, status,
                  datetime.now().isoformat()))
            conn.commit()


class BrowserController:
    """Controls Chrome browser for AI interactions."""

    def __init__(self, config: Dict):
        self.config = config
        self.tabs: Dict[str, Any] = {}
        self.parallel_limit = config.get('parallel_tabs', 8)
        self.tab_delay = config.get('tab_delay_ms', 500) / 1000

    def open_ai_tab(self, service: AIService, prompt: str = "") -> str:
        """Open a new browser tab for an AI service."""
        url = service.url
        if prompt:
            # Encode prompt for URL if supported
            encoded_prompt = prompt.replace(' ', '+').replace('\n', '%0A')[:500]
            if 'claude.ai' in url:
                url = f"{url}?q={encoded_prompt}"

        tab_id = f"{service.name}_{datetime.now().timestamp()}"

        try:
            webbrowser.open_new_tab(url)
            self.tabs[tab_id] = {
                'service': service.name,
                'url': url,
                'opened_at': datetime.now()
            }
            time.sleep(self.tab_delay)
            logger.info(f"Opened tab for {service.name}: {url}")
            return tab_id
        except Exception as e:
            logger.error(f"Failed to open tab for {service.name}: {e}")
            return ""

    def open_multiple_tabs(self, services: List[AIService], prompt: str) -> List[str]:
        """Open multiple tabs in parallel."""
        tab_ids = []
        for service in services[:self.parallel_limit]:
            tab_id = self.open_ai_tab(service, prompt)
            if tab_id:
                tab_ids.append(tab_id)
        return tab_ids


class SynthesisEngine:
    """Handles synthesis and refinement of AI responses."""

    def __init__(self, config: Dict):
        self.config = config
        self.rounds = config.get('rounds', 3)

    def generate_synthesis_prompt(self, responses: List[Dict], round_num: int) -> str:
        """Generate a synthesis prompt from multiple AI responses."""
        prompt = f"""# Synthesis Round {round_num}/{self.rounds}

## Objective
Synthesize and enrich the following AI responses WITHOUT inventing or fabricating information.
Focus on:
1. Identifying common themes and agreements
2. Highlighting unique valuable insights from each source
3. Resolving contradictions with evidence-based reasoning
4. Saturating ideas to their fullest potential

## AI Responses to Synthesize:
"""
        for resp in responses:
            prompt += f"\n### {resp['source']}:\n{resp['content']}\n"

        prompt += """
## Instructions:
1. Create a comprehensive synthesis table
2. Rate each idea's saturation level (1-10)
3. Identify gaps that need further exploration
4. Propose enrichments based ONLY on provided information
5. Flag any contradictions for human review

## Output Format:
- Use structured tables for clarity
- Highlight key insights with bullet points
- End with actionable next steps
"""
        return prompt

    def check_saturation(self, content: str) -> Dict:
        """Check if ideas are fully saturated."""
        # Simple heuristic - in production, use Claude API for analysis
        word_count = len(content.split())
        unique_concepts = len(set(content.lower().split()))

        return {
            'word_count': word_count,
            'unique_concepts': unique_concepts,
            'saturation_estimate': min(100, (unique_concepts / max(word_count, 1)) * 500),
            'needs_more_rounds': word_count < 500 or unique_concepts < 50
        }


class PromptFormatter:
    """Formats prompts for specific AI services and tools."""

    AI_SPECS = {
        'claude': {'max_tokens': 8192, 'supports_markdown': True, 'supports_code': True},
        'chatgpt': {'max_tokens': 4096, 'supports_markdown': True, 'supports_code': True},
        'gemini': {'max_tokens': 8192, 'supports_markdown': True, 'supports_code': True},
        'mistral': {'max_tokens': 4096, 'supports_markdown': True, 'supports_code': True},
        'antigravity': {'max_tokens': 4000, 'supports_markdown': False, 'supports_code': True},
    }

    def format_for_ai(self, content: str, target_ai: str,
                      include_context: bool = True) -> str:
        """Format content for a specific AI service."""
        specs = self.AI_SPECS.get(target_ai.lower(), self.AI_SPECS['claude'])

        # Truncate if needed
        if len(content) > specs['max_tokens'] * 4:  # Rough char estimate
            content = content[:specs['max_tokens'] * 4] + "\n\n[Content truncated for token limit]"

        formatted = f"""# Instructions for {target_ai}

## Context
This is part of a multi-AI collaborative workflow. Your response will be synthesized with other AI responses.

## Task
{content}

## Guidelines
1. Be precise and factual
2. Do NOT invent or fabricate information
3. Clearly indicate uncertainty with [UNCERTAIN] tags
4. Structure your response for easy synthesis
5. Maximum response length: {specs['max_tokens']} tokens

## Output Requirements
- Use {'markdown formatting' if specs['supports_markdown'] else 'plain text'}
- {'Include code examples where relevant' if specs['supports_code'] else 'Describe code conceptually'}
"""
        return formatted

    def format_for_code_tool(self, instruction: str, tool: str,
                             project_context: Dict) -> str:
        """Format instructions for code tools like Cursor, VS Code, Antigravity."""
        if tool.lower() == 'antigravity':
            return f"""# Firebase/Antigravity App Generation

## Project: {project_context.get('name', 'Unnamed')}

## App Requirements:
{instruction}

## Technical Specifications:
- Platform: Web/Mobile (specify in requirements)
- Framework: React/Flutter (auto-detected)
- Backend: Firebase

## Implementation Steps:
1. Generate UI components
2. Set up Firebase backend
3. Implement business logic
4. Add authentication if needed
5. Deploy to Firebase Hosting

## Constraints:
- Follow Material Design guidelines
- Ensure accessibility compliance
- Optimize for performance
"""
        elif tool.lower() in ['cursor', 'vscode']:
            return f"""# Code Generation Task

## Project Context:
{json.dumps(project_context, indent=2)}

## Instructions:
{instruction}

## Requirements:
1. Follow project coding standards
2. Add appropriate error handling
3. Include inline documentation
4. Write unit tests if applicable
"""
        return instruction


class AIOrchestrator:
    """Main orchestrator coordinating the entire workflow."""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.memory = ProjectMemory(
            self.config.get('memory', {}).get('database_path', '~/.ai-orchestrator/projects.db')
        )
        self.browser = BrowserController(self.config.get('browser', {}))
        self.synthesis = SynthesisEngine(self.config.get('workflow', {}).get('synthesis', {}))
        self.formatter = PromptFormatter()
        self.ai_services = self._init_ai_services()
        self.current_project: Optional[Project] = None
        self.response_queue = queue.Queue()
        self.running = True

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file."""
        config_file = Path(__file__).parent / config_path
        if config_file.exists():
            with open(config_file) as f:
                return yaml.safe_load(f)
        return {}

    def _init_ai_services(self) -> Dict[str, AIService]:
        """Initialize AI service configurations."""
        services = {}
        for key, cfg in self.config.get('ai_services', {}).items():
            services[key] = AIService(
                name=cfg.get('name', key),
                url=cfg.get('url', ''),
                role=AIRole(cfg.get('role', 'researcher')),
                max_tokens=cfg.get('max_tokens', 4096),
                priority=cfg.get('priority', 5),
                model=cfg.get('model')
            )
        return services

    def display_banner(self):
        """Display welcome banner."""
        banner = """
╔══════════════════════════════════════════════════════════════════╗
║                    AI ORCHESTRATOR v1.0.0                        ║
║              Multi-AI Collaboration System                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Workflow:                                                       ║
║  1. Clarify request with Claude Sonnet 4.5                      ║
║  2. Query multiple AIs in parallel                               ║
║  3. Synthesis rounds (3x) with saturation check                  ║
║  4. Format outputs for target tools/AIs                          ║
║  5. Execute and verify with feedback loop                        ║
╚══════════════════════════════════════════════════════════════════╝
        """
        print(banner)

    def get_user_request(self) -> str:
        """Get initial request from user."""
        print("\n" + "="*60)
        print("   STEP 1: Enter Your Request")
        print("="*60)
        print("Describe what you want to accomplish.")
        print("(Press Enter twice to submit, or type 'quit' to exit)\n")

        lines = []
        while True:
            try:
                line = input()
                if line.lower() == 'quit':
                    return ''
                if line == '' and lines and lines[-1] == '':
                    break
                lines.append(line)
            except EOFError:
                break

        return '\n'.join(lines).strip()

    def phase1_clarification(self, request: str) -> str:
        """Phase 1: Clarify and enrich request with Claude Sonnet."""
        print("\n" + "="*60)
        print("   PHASE 1: Clarification with Claude Sonnet 4.5")
        print("="*60)

        # Open Claude tab for clarification
        claude_service = self.ai_services.get('claude_sonnet')
        if claude_service:
            clarification_prompt = f"""# Request Clarification Needed

## Original Request:
{request}

## Your Task:
Help clarify and enrich this request by:
1. Identifying ambiguities or missing information
2. Suggesting specific questions to ask the user
3. Proposing a structured approach
4. Defining success criteria

Please ask clarifying questions before proceeding."""

            self.browser.open_ai_tab(claude_service, clarification_prompt)

            print("\n[Claude tab opened for clarification]")
            print("Please interact with Claude to clarify your request.")
            print("\nOnce clarified, paste the enriched request below")
            print("(Press Enter twice to continue):\n")

            lines = []
            while True:
                try:
                    line = input()
                    if line == '' and lines and lines[-1] == '':
                        break
                    lines.append(line)
                except EOFError:
                    break

            clarified = '\n'.join(lines).strip()
            return clarified if clarified else request

        return request

    def phase2_parallel_research(self, clarified_request: str) -> List[Dict]:
        """Phase 2: Query multiple AIs in parallel."""
        print("\n" + "="*60)
        print("   PHASE 2: Parallel AI Research")
        print("="*60)

        # Get research AIs
        research_ais = [
            svc for svc in self.ai_services.values()
            if svc.role == AIRole.RESEARCHER and svc.available
        ]

        print(f"\nOpening {len(research_ais)} AI tabs for parallel research...")

        # Format prompt for each AI
        formatted_prompts = {}
        for ai in research_ais:
            formatted_prompts[ai.name] = self.formatter.format_for_ai(
                clarified_request, ai.name
            )

        # Open all tabs
        for ai in research_ais:
            self.browser.open_ai_tab(ai, formatted_prompts[ai.name])
            print(f"  ✓ Opened {ai.name}")

        print("\n[All AI tabs opened]")
        print("Please collect responses from each AI.")
        print("\nFor each AI, paste its response below.")
        print("Format: AI_NAME::: response content")
        print("Type 'done' when finished:\n")

        responses = []
        current_ai = None
        current_response = []

        while True:
            try:
                line = input()
                if line.lower() == 'done':
                    if current_ai and current_response:
                        responses.append({
                            'source': current_ai,
                            'content': '\n'.join(current_response),
                            'status': 'collected'
                        })
                    break

                if ':::' in line:
                    # Save previous response
                    if current_ai and current_response:
                        responses.append({
                            'source': current_ai,
                            'content': '\n'.join(current_response),
                            'status': 'collected'
                        })
                    # Start new response
                    parts = line.split(':::', 1)
                    current_ai = parts[0].strip()
                    current_response = [parts[1].strip()] if len(parts) > 1 else []
                else:
                    current_response.append(line)

            except EOFError:
                break

        # Simulate responses for unavailable AIs if configured
        if self.config.get('workflow', {}).get('research', {}).get('simulate_on_failure'):
            collected_ais = {r['source'].lower() for r in responses}
            for ai in research_ais:
                if ai.name.lower() not in collected_ais:
                    responses.append({
                        'source': ai.name,
                        'content': f"[SIMULATED] Response simulated due to unavailability. "
                                  f"Key points would likely include analysis of: {clarified_request[:200]}...",
                        'status': 'simulated'
                    })
                    print(f"  ⚠ Simulated response for {ai.name}")

        return responses

    def phase3_synthesis(self, responses: List[Dict]) -> str:
        """Phase 3: Synthesis rounds with Claude Sonnet and Opus."""
        print("\n" + "="*60)
        print("   PHASE 3: Synthesis Rounds (3x)")
        print("="*60)

        synthesis_results = []

        for round_num in range(1, self.synthesis.rounds + 1):
            print(f"\n--- Synthesis Round {round_num}/{self.synthesis.rounds} ---")

            # Generate synthesis prompt
            synthesis_prompt = self.synthesis.generate_synthesis_prompt(
                responses if round_num == 1 else [{'source': 'Previous', 'content': synthesis_results[-1]}],
                round_num
            )

            # Alternate between Sonnet and Opus
            model_key = 'claude_sonnet' if round_num % 2 == 1 else 'claude_opus'
            model = self.ai_services.get(model_key)

            if model:
                print(f"Using {model.name} for this round...")
                self.browser.open_ai_tab(model, synthesis_prompt)

                print(f"\n[{model.name} tab opened]")
                print("Paste the synthesis result below (Enter twice to continue):\n")

                lines = []
                while True:
                    try:
                        line = input()
                        if line == '' and lines and lines[-1] == '':
                            break
                        lines.append(line)
                    except EOFError:
                        break

                result = '\n'.join(lines).strip()
                synthesis_results.append(result)

                # Check saturation
                saturation = self.synthesis.check_saturation(result)
                print(f"\nSaturation check: {saturation['saturation_estimate']:.1f}%")

                if not saturation['needs_more_rounds'] and round_num >= 2:
                    print("✓ Ideas appear saturated, proceeding to formatting")
                    break

        return synthesis_results[-1] if synthesis_results else ""

    def phase4_formatting(self, final_synthesis: str,
                          target_tools: List[str] = None) -> Dict[str, str]:
        """Phase 4: Format outputs for specific tools and AIs."""
        print("\n" + "="*60)
        print("   PHASE 4: Output Formatting")
        print("="*60)

        if not target_tools:
            print("\nWhich tools/AIs should receive formatted instructions?")
            print("Options: claude, chatgpt, gemini, antigravity, cursor, vscode")
            print("Enter comma-separated list (or 'all'):\n")
            user_input = input().strip()
            if user_input.lower() == 'all':
                target_tools = ['claude', 'chatgpt', 'gemini', 'antigravity', 'cursor']
            else:
                target_tools = [t.strip() for t in user_input.split(',')]

        formatted_outputs = {}
        project_context = {
            'name': self.current_project.name if self.current_project else 'Project',
            'description': self.current_project.description if self.current_project else ''
        }

        for tool in target_tools:
            if tool.lower() in ['antigravity', 'cursor', 'vscode']:
                formatted_outputs[tool] = self.formatter.format_for_code_tool(
                    final_synthesis, tool, project_context
                )
            else:
                formatted_outputs[tool] = self.formatter.format_for_ai(
                    final_synthesis, tool
                )
            print(f"  ✓ Formatted for {tool}")

        return formatted_outputs

    def phase5_execution(self, formatted_outputs: Dict[str, str]):
        """Phase 5: Execute and verify with feedback loop."""
        print("\n" + "="*60)
        print("   PHASE 5: Execution & Verification")
        print("="*60)

        print("\nSending formatted instructions to target tools...")

        for tool, content in formatted_outputs.items():
            print(f"\n--- {tool.upper()} ---")
            print(content[:500] + "..." if len(content) > 500 else content)

            # Open appropriate tabs/tools
            if tool.lower() in self.ai_services:
                service = self.ai_services[tool.lower()]
                self.browser.open_ai_tab(service, content)
            elif tool.lower() == 'antigravity':
                webbrowser.open_new_tab("https://studio.firebase.google.com/")

        # Verification with Claude
        print("\n" + "-"*40)
        print("Verification Phase")
        print("-"*40)
        print("\nOpening Claude for work verification...")

        verification_prompt = f"""# Work Verification Required

## Completed Tasks:
{json.dumps(list(formatted_outputs.keys()), indent=2)}

## Instructions Sent:
{list(formatted_outputs.values())[0][:1000] if formatted_outputs else 'None'}

## Your Task:
1. Review the work completed
2. Identify any issues or gaps
3. Suggest improvements if needed
4. Confirm if objectives are met

Please provide your verification assessment."""

        claude = self.ai_services.get('claude_sonnet')
        if claude:
            self.browser.open_ai_tab(claude, verification_prompt)

    def save_project_state(self):
        """Save current project to memory."""
        if self.current_project:
            self.memory.save_project(self.current_project)
            print(f"\n✓ Project saved: {self.current_project.id}")

    def run(self):
        """Main orchestration workflow."""
        self.display_banner()

        # Get user request
        request = self.get_user_request()
        if not request:
            print("No request provided. Exiting.")
            return

        # Create project
        project_id = f"proj_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.current_project = Project(
            id=project_id,
            name=f"Project {datetime.now().strftime('%Y-%m-%d')}",
            description="Auto-generated project",
            original_request=request
        )

        try:
            # Phase 1: Clarification
            clarified_request = self.phase1_clarification(request)
            self.current_project.clarified_request = clarified_request

            # Phase 2: Parallel Research
            responses = self.phase2_parallel_research(clarified_request)

            # Phase 3: Synthesis
            final_synthesis = self.phase3_synthesis(responses)

            # Phase 4: Formatting
            formatted_outputs = self.phase4_formatting(final_synthesis)

            # Phase 5: Execution
            self.phase5_execution(formatted_outputs)

            # Save final state
            self.current_project.final_output = final_synthesis
            self.save_project_state()

            print("\n" + "="*60)
            print("   WORKFLOW COMPLETE")
            print("="*60)
            print(f"\nProject ID: {self.current_project.id}")
            print("All results have been saved to memory.")
            print("\nThank you for using AI Orchestrator!")

        except KeyboardInterrupt:
            print("\n\nWorkflow interrupted by user.")
            self.save_project_state()
        except Exception as e:
            logger.error(f"Error in workflow: {e}")
            self.save_project_state()
            raise


def main():
    """Entry point for the AI Orchestrator."""
    # Handle signals gracefully
    def signal_handler(sig, frame):
        print("\n\nShutting down gracefully...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    # Find config file
    script_dir = Path(__file__).parent
    config_path = script_dir / "config.yaml"

    if not config_path.exists():
        print(f"Warning: Config file not found at {config_path}")
        print("Using default configuration.")

    # Create and run orchestrator
    orchestrator = AIOrchestrator(str(config_path))
    orchestrator.run()


if __name__ == "__main__":
    main()
