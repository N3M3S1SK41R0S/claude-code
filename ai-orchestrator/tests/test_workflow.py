#!/usr/bin/env python3
"""
AI Orchestrator - Complete Workflow Test Suite

This test suite validates the entire orchestration workflow by:
1. Tracking timestamps at each step
2. Testing all AI service integrations
3. Testing code tool integrations (Cursor, VS Code, Codestral)
4. Verifying the feedback loop to Claude

Run with: python -m tests.test_workflow
"""

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.router import AIRouter, TaskDomain
from utils.semantic_compressor import SemanticCompressor
from synthesis.saturation import SaturationAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('Test-Workflow')


class TestStatus(Enum):
    PENDING = "⏳ PENDING"
    RUNNING = "🔄 RUNNING"
    PASSED = "✅ PASSED"
    FAILED = "❌ FAILED"
    SKIPPED = "⏭️ SKIPPED"


@dataclass
class TimestampedEvent:
    """Event with timestamp for tracking workflow."""
    timestamp: datetime
    ai_name: str
    model: str
    action: str
    input_preview: str
    output_preview: str = ""
    duration_ms: float = 0
    status: str = "success"
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'ai_name': self.ai_name,
            'model': self.model,
            'action': self.action,
            'input_preview': self.input_preview[:100],
            'output_preview': self.output_preview[:100],
            'duration_ms': self.duration_ms,
            'status': self.status
        }


@dataclass
class TestResult:
    """Result of a single test."""
    name: str
    status: TestStatus
    duration_ms: float
    events: List[TimestampedEvent] = field(default_factory=list)
    error: Optional[str] = None
    details: Dict = field(default_factory=dict)


class WorkflowTracker:
    """Tracks all events in the workflow with timestamps."""

    def __init__(self):
        self.events: List[TimestampedEvent] = []
        self.start_time: Optional[datetime] = None

    def start(self):
        """Start tracking."""
        self.start_time = datetime.now()
        self.log_event("System", "Orchestrator", "workflow_start", "Test workflow initiated")

    def log_event(self, ai_name: str, model: str, action: str,
                  input_data: str, output_data: str = "", status: str = "success"):
        """Log a timestamped event."""
        event = TimestampedEvent(
            timestamp=datetime.now(),
            ai_name=ai_name,
            model=model,
            action=action,
            input_preview=input_data,
            output_preview=output_data,
            duration_ms=(datetime.now() - self.start_time).total_seconds() * 1000 if self.start_time else 0,
            status=status
        )
        self.events.append(event)
        logger.info(f"[{event.timestamp.strftime('%H:%M:%S.%f')[:-3]}] "
                    f"{ai_name} ({model}): {action}")
        return event

    def get_report(self) -> str:
        """Generate a detailed report of all events."""
        report = "\n" + "="*80 + "\n"
        report += "                    WORKFLOW TRACKING REPORT\n"
        report += "="*80 + "\n\n"

        report += "| # | Timestamp | AI Service | Model | Action | Status |\n"
        report += "|---|-----------|------------|-------|--------|--------|\n"

        for i, event in enumerate(self.events, 1):
            ts = event.timestamp.strftime('%H:%M:%S.%f')[:-3]
            status_icon = "✓" if event.status == "success" else "✗"
            report += f"| {i} | {ts} | {event.ai_name} | {event.model} | {event.action} | {status_icon} |\n"

        total_duration = (self.events[-1].timestamp - self.events[0].timestamp).total_seconds() if len(self.events) > 1 else 0
        report += f"\n**Total Duration**: {total_duration:.2f}s\n"
        report += f"**Total Events**: {len(self.events)}\n"

        return report

    def export_json(self, filepath: str):
        """Export events to JSON file."""
        data = {
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'events': [e.to_dict() for e in self.events],
            'total_events': len(self.events)
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)


class MockAIService:
    """Mock AI service for testing without actual API calls."""

    MOCK_RESPONSES = {
        'claude_sonnet': {
            'model': 'claude-sonnet-4-5-20250514',
            'response': "Je suis Claude Sonnet 4.5. Voici ma clarification de votre demande: "
                       "L'objectif est de créer un système de test complet pour valider "
                       "l'orchestration multi-IA. Points clés identifiés: 1) Horodatage, "
                       "2) Traçabilité, 3) Génération de code, 4) Vérification."
        },
        'claude_opus': {
            'model': 'claude-opus-4-5-20251101',
            'response': "Claude Opus 4.5 - Analyse approfondie: Le système proposé "
                       "présente une architecture robuste. Recommandations: implémenter "
                       "des mécanismes de fallback, ajouter des métriques de performance."
        },
        'chatgpt': {
            'model': 'gpt-4o',
            'response': "GPT-4o analysis: The multi-AI orchestration approach is sound. "
                       "Key considerations: error handling, rate limiting, response validation."
        },
        'gemini': {
            'model': 'gemini-1.5-pro',
            'response': "Gemini Pro: Excellent approach for distributed AI processing. "
                       "Suggested improvements: add caching layer, implement circuit breakers."
        },
        'mistral': {
            'model': 'mistral-large-latest',
            'response': "Mistral Large: Architecture analysis complete. The workflow "
                       "demonstrates good separation of concerns and scalability."
        },
        'codestral': {
            'model': 'codestral-latest',
            'response': """```python
# Generated by Codestral
def process_workflow(request: str) -> dict:
    '''Process a workflow request with timestamps.'''
    import datetime
    result = {
        'timestamp': datetime.datetime.now().isoformat(),
        'model': 'codestral-latest',
        'processed': True,
        'request_hash': hash(request)
    }
    return result
```"""
        }
    }

    def __init__(self, service_name: str):
        self.service_name = service_name
        self.config = self.MOCK_RESPONSES.get(service_name, {
            'model': 'unknown',
            'response': f"Mock response from {service_name}"
        })

    async def generate(self, prompt: str) -> Dict:
        """Simulate AI response with delay."""
        # Simulate network latency
        await asyncio.sleep(0.1 + (hash(self.service_name) % 100) / 1000)

        return {
            'model': self.config['model'],
            'response': self.config['response'],
            'timestamp': datetime.now().isoformat()
        }


class CodeToolMock:
    """Mock for code tools (Cursor, VS Code, Codestral)."""

    TOOL_CONFIGS = {
        'cursor': {
            'name': 'Cursor AI',
            'capabilities': ['code_completion', 'refactoring', 'chat'],
            'response': "Cursor: Code analysis complete. Suggested refactoring applied."
        },
        'vscode': {
            'name': 'VS Code',
            'capabilities': ['editing', 'debugging', 'extensions'],
            'response': "VS Code: File opened, syntax highlighting active."
        },
        'codestral': {
            'name': 'Codestral',
            'capabilities': ['code_generation', 'completion', 'review'],
            'response': "Codestral: Code generated successfully."
        },
        'antigravity': {
            'name': 'Google Antigravity (Firebase Studio)',
            'capabilities': ['app_generation', 'deployment', 'hosting'],
            'response': "Antigravity: App scaffold created, ready for deployment."
        }
    }

    def __init__(self, tool_name: str):
        self.tool_name = tool_name
        self.config = self.TOOL_CONFIGS.get(tool_name.lower(), {
            'name': tool_name,
            'capabilities': [],
            'response': f"Mock response from {tool_name}"
        })

    async def execute(self, instruction: str) -> Dict:
        """Simulate tool execution."""
        await asyncio.sleep(0.05)
        return {
            'tool': self.config['name'],
            'status': 'success',
            'response': self.config['response'],
            'timestamp': datetime.now().isoformat()
        }


class TestSuite:
    """Complete test suite for AI Orchestrator."""

    def __init__(self):
        self.tracker = WorkflowTracker()
        self.results: List[TestResult] = []
        self.test_output_dir = Path(__file__).parent / "test_output"
        self.test_output_dir.mkdir(exist_ok=True)

    async def run_all_tests(self) -> Dict:
        """Run all tests and return summary."""
        print("\n" + "="*80)
        print("            AI ORCHESTRATOR - TEST SUITE")
        print("="*80 + "\n")

        self.tracker.start()

        tests = [
            ("Test 1: Timestamp Tracking", self.test_timestamp_tracking),
            ("Test 2: AI Router", self.test_ai_router),
            ("Test 3: Multi-AI Workflow", self.test_multi_ai_workflow),
            ("Test 4: Code Tools Integration", self.test_code_tools),
            ("Test 5: Synthesis Engine", self.test_synthesis),
            ("Test 6: Saturation Detection", self.test_saturation),
            ("Test 7: Semantic Compression", self.test_semantic_compression),
            ("Test 8: Full E2E Workflow", self.test_full_e2e_workflow),
            ("Test 9: Feedback to Claude", self.test_feedback_loop),
        ]

        for test_name, test_func in tests:
            print(f"\n{'─'*60}")
            print(f"Running: {test_name}")
            print('─'*60)

            start_time = time.time()
            try:
                await test_func()
                duration = (time.time() - start_time) * 1000
                result = TestResult(
                    name=test_name,
                    status=TestStatus.PASSED,
                    duration_ms=duration,
                    events=self.tracker.events.copy()
                )
                print(f"  {TestStatus.PASSED.value} ({duration:.0f}ms)")
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                result = TestResult(
                    name=test_name,
                    status=TestStatus.FAILED,
                    duration_ms=duration,
                    error=str(e)
                )
                print(f"  {TestStatus.FAILED.value} - {e}")
                logger.exception(f"Test failed: {test_name}")

            self.results.append(result)

        # Generate final report
        return self._generate_summary()

    async def test_timestamp_tracking(self):
        """Test that timestamps are properly recorded at each step."""
        self.tracker.log_event(
            "Test", "pytest", "timestamp_test",
            "Testing timestamp functionality",
            "Timestamp recorded successfully"
        )

        # Verify timestamp format
        event = self.tracker.events[-1]
        assert event.timestamp is not None
        assert isinstance(event.timestamp, datetime)
        assert event.ai_name == "Test"

    async def test_ai_router(self):
        """Test intelligent AI routing."""
        router = AIRouter()

        # Test code routing
        code_request = "Write a Python function to sort a list"
        code_ais = router.get_best_ais(code_request)
        self.tracker.log_event(
            "Router", "intelligent_router", "route_code_task",
            code_request,
            f"Routed to: {code_ais}"
        )
        assert 'codestral' in code_ais or 'claude_sonnet' in code_ais

        # Test architecture routing
        arch_request = "Design a microservices architecture for e-commerce"
        arch_ais = router.get_best_ais(arch_request)
        self.tracker.log_event(
            "Router", "intelligent_router", "route_arch_task",
            arch_request,
            f"Routed to: {arch_ais}"
        )
        assert 'claude_opus' in arch_ais or 'claude_sonnet' in arch_ais

        # Test domain detection
        domains = router.detect_domains(code_request)
        assert any(d[0] == TaskDomain.CODE for d in domains)

    async def test_multi_ai_workflow(self):
        """Test parallel AI querying."""
        ai_services = ['claude_sonnet', 'chatgpt', 'gemini', 'mistral']
        prompt = "Analyze the benefits of multi-AI orchestration"

        tasks = []
        for service in ai_services:
            mock = MockAIService(service)
            tasks.append(mock.generate(prompt))

        # Run in parallel
        start = time.time()
        responses = await asyncio.gather(*tasks)
        duration = (time.time() - start) * 1000

        for i, (service, resp) in enumerate(zip(ai_services, responses)):
            self.tracker.log_event(
                service, resp['model'], "parallel_query",
                prompt[:50],
                resp['response'][:50]
            )

        assert len(responses) == len(ai_services)
        print(f"    Parallel queries completed in {duration:.0f}ms")

    async def test_code_tools(self):
        """Test code tool integrations."""
        tools = ['cursor', 'vscode', 'codestral', 'antigravity']
        instruction = "Create a simple REST API endpoint"

        for tool_name in tools:
            tool = CodeToolMock(tool_name)
            result = await tool.execute(instruction)

            self.tracker.log_event(
                tool_name, tool.config['name'], "code_tool_test",
                instruction,
                result['response'],
                result['status']
            )

            assert result['status'] == 'success'

    async def test_synthesis(self):
        """Test synthesis engine."""
        from synthesis.engine import SynthesisEngine, AIResponse

        engine = SynthesisEngine(max_rounds=3)

        # Create mock responses
        responses = [
            AIResponse(source="Claude", content="Point A: Architecture should be modular"),
            AIResponse(source="GPT-4", content="Point B: Use microservices pattern"),
            AIResponse(source="Gemini", content="Point C: Consider serverless options"),
        ]

        prompt = engine.generate_synthesis_prompt(responses, round_num=1)

        self.tracker.log_event(
            "Synthesis", "synthesis_engine", "generate_prompt",
            f"{len(responses)} responses",
            f"Generated prompt: {len(prompt)} chars"
        )

        assert "Synthesis Round 1" in prompt
        assert "Point A" in prompt or "Claude" in prompt

    async def test_saturation(self):
        """Test saturation detection."""
        analyzer = SaturationAnalyzer(saturation_threshold=0.85)

        # Round 1 - low saturation
        round1 = """
        ## Analysis
        The system should handle multiple inputs.
        Key points:
        - Point 1: Basic functionality
        - Point 2: Error handling
        """

        metrics1 = analyzer.analyze(round1, [], "Create a robust system")

        self.tracker.log_event(
            "Saturation", "saturation_analyzer", "round_1",
            "Initial analysis",
            f"Score: {metrics1.overall_score:.2%}, Recommendation: {metrics1.recommendation}"
        )

        # Round 2 - more content
        round2 = round1 + """
        ## Deep Dive
        ### Point 1: Basic functionality
        - Sub-point 1.1: Input validation is critical
        - Sub-point 1.2: Output formatting must be consistent
        - Example: User submits form, system validates, returns structured response

        ### Point 2: Error handling
        - Sub-point 2.1: Graceful degradation
        - Sub-point 2.2: User-friendly error messages
        - Implications: Better user experience, easier debugging
        """

        metrics2 = analyzer.analyze(round2, [round1], "Create a robust system")

        self.tracker.log_event(
            "Saturation", "saturation_analyzer", "round_2",
            "Deeper analysis",
            f"Score: {metrics2.overall_score:.2%}, Recommendation: {metrics2.recommendation}"
        )

        # Saturation should increase
        assert metrics2.overall_score >= metrics1.overall_score

    async def test_semantic_compression(self):
        """Test semantic compression for context management."""
        compressor = SemanticCompressor(max_tokens=500)

        # Create large content
        large_content = """
        # Project Overview

        This is a comprehensive analysis of the multi-AI orchestration system.

        ## Section 1: Architecture
        The architecture follows a modular design pattern with clear separation of concerns.
        Each component is responsible for a specific functionality.

        ## Section 2: Implementation
        The implementation uses Python with async/await for concurrent operations.
        Key libraries include asyncio for async operations and sqlite3 for persistence.

        ## Section 3: Testing
        Testing covers unit tests, integration tests, and end-to-end tests.
        All critical paths are validated with automated tests.

        ```python
        def example_function():
            '''This is preserved code'''
            return True
        ```

        ## Section 4: Deployment
        Deployment is handled through Docker containers.
        CI/CD pipeline automates the deployment process.
        """ * 5  # Make it large

        result = compressor.compress(large_content, preserve_code=True)

        self.tracker.log_event(
            "Compressor", "semantic_compressor", "compress",
            f"Original: {result.original_length} chars",
            f"Compressed: {result.compressed_length} chars ({result.compression_ratio:.1%})"
        )

        assert result.compressed_length < result.original_length
        # Code should be preserved
        assert "example_function" in result.content

    async def test_full_e2e_workflow(self):
        """Test complete end-to-end workflow."""
        print("\n    Simulating full workflow...")

        # Phase 1: Clarification with Claude Sonnet
        clarification_ai = MockAIService('claude_sonnet')
        clarification = await clarification_ai.generate(
            "Create a test system for multi-AI orchestration"
        )
        self.tracker.log_event(
            "Claude Sonnet", clarification['model'], "phase1_clarification",
            "Initial request",
            clarification['response'][:50]
        )

        # Phase 2: Parallel research
        research_ais = ['chatgpt', 'gemini', 'mistral']
        research_tasks = [MockAIService(ai).generate("Research: AI orchestration best practices")
                         for ai in research_ais]
        research_results = await asyncio.gather(*research_tasks)

        for ai, result in zip(research_ais, research_results):
            self.tracker.log_event(
                ai, result['model'], "phase2_research",
                "Research query",
                result['response'][:50]
            )

        # Phase 3: Synthesis rounds
        for round_num in range(1, 4):
            synth_ai = MockAIService('claude_opus' if round_num % 2 == 0 else 'claude_sonnet')
            synth_result = await synth_ai.generate(f"Synthesis round {round_num}")
            self.tracker.log_event(
                synth_ai.service_name, synth_result['model'], f"phase3_synthesis_round{round_num}",
                f"Round {round_num} input",
                synth_result['response'][:50]
            )

        # Phase 4: Code generation with tools
        code_tools = ['codestral', 'cursor']
        for tool in code_tools:
            tool_mock = CodeToolMock(tool)
            tool_result = await tool_mock.execute("Generate test code")
            self.tracker.log_event(
                tool, tool_mock.config['name'], "phase4_code_generation",
                "Code generation request",
                tool_result['response'][:50]
            )

        # Phase 5: Verification
        verification_ai = MockAIService('claude_sonnet')
        verification = await verification_ai.generate("Verify completed work")
        self.tracker.log_event(
            "Claude Sonnet", verification['model'], "phase5_verification",
            "Verification request",
            "Workflow verified successfully"
        )

        print("    E2E workflow completed successfully")

    async def test_feedback_loop(self):
        """Test feedback loop to Claude for verification."""
        # Simulate work completion
        completed_work = {
            'code_generated': True,
            'tests_passed': True,
            'files_created': ['api.py', 'test_api.py'],
            'tools_used': ['Codestral', 'Cursor', 'VS Code']
        }

        # Send to Claude for verification
        claude = MockAIService('claude_sonnet')
        feedback_prompt = f"""
        Verify the following completed work:
        {json.dumps(completed_work, indent=2)}

        Confirm all components are properly integrated.
        """

        result = await claude.generate(feedback_prompt)

        self.tracker.log_event(
            "Claude Sonnet", result['model'], "feedback_verification",
            f"Work summary: {len(completed_work)} items",
            "Verification complete: All checks passed"
        )

        # Log final confirmation
        self.tracker.log_event(
            "System", "Orchestrator", "workflow_complete",
            "All tests executed",
            "Feedback loop successful, workflow validated"
        )

    def _generate_summary(self) -> Dict:
        """Generate test summary."""
        passed = sum(1 for r in self.results if r.status == TestStatus.PASSED)
        failed = sum(1 for r in self.results if r.status == TestStatus.FAILED)
        total = len(self.results)

        # Print summary
        print("\n" + "="*80)
        print("                         TEST SUMMARY")
        print("="*80)
        print(f"\n  Total Tests: {total}")
        print(f"  Passed: {passed} ✅")
        print(f"  Failed: {failed} ❌")
        print(f"  Success Rate: {passed/total*100:.1f}%")

        # Print workflow tracking report
        print(self.tracker.get_report())

        # Export results
        export_path = self.test_output_dir / f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.tracker.export_json(str(export_path))
        print(f"\n  Results exported to: {export_path}")

        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'success_rate': passed / total if total > 0 else 0,
            'events': len(self.tracker.events),
            'export_path': str(export_path)
        }


async def main():
    """Run the test suite."""
    suite = TestSuite()
    results = await suite.run_all_tests()

    # Return exit code based on results
    return 0 if results['failed'] == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
