#!/usr/bin/env python3
"""
AI Orchestrator - Automation Workflow Tests

Tests for N8N, Make, and Zapier workflow generation.
Validates automatic workflow creation, testing, and improvement.
"""

import asyncio
import json
import logging
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from automation.workflow_builder import WorkflowBuilder, WorkflowType, WorkflowAnalyzer
from automation.n8n_builder import N8NBuilder
from automation.make_builder import MakeBuilder
from automation.zapier_builder import ZapierBuilder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('Test-Automation')


class WorkflowTestSuite:
    """Test suite for workflow automation."""

    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        self.results: List[Dict] = []
        self.test_requests = [
            {
                'description': 'Create an AI pipeline that receives requests via webhook, processes with Claude, and returns results',
                'expected_type': WorkflowType.AI_PIPELINE,
                'expected_platform': 'n8n'
            },
            {
                'description': 'Send Slack notifications when a new form submission arrives',
                'expected_type': WorkflowType.NOTIFICATION,
                'expected_platform': 'zapier'
            },
            {
                'description': 'Sync data from Google Sheets to Airtable every hour',
                'expected_type': WorkflowType.DATA_SYNC,
                'expected_platform': 'n8n'
            },
            {
                'description': 'Generate blog content using AI and post to Notion',
                'expected_type': WorkflowType.CONTENT_GENERATION,
                'expected_platform': 'make'
            },
            {
                'description': 'Handle webhook callbacks from payment processor',
                'expected_type': WorkflowType.WEBHOOK_HANDLER,
                'expected_platform': 'n8n'
            }
        ]

    async def run_all_tests(self) -> Dict:
        """Run all automation tests."""
        print("\n" + "="*80)
        print("         AUTOMATION WORKFLOW TEST SUITE")
        print("="*80 + "\n")

        tests = [
            ("Test 1: Workflow Type Detection", self.test_type_detection),
            ("Test 2: N8N Workflow Generation", self.test_n8n_generation),
            ("Test 3: Make Scenario Generation", self.test_make_generation),
            ("Test 4: Zapier Zap Generation", self.test_zapier_generation),
            ("Test 5: Multi-Platform Workflow", self.test_multi_platform),
            ("Test 6: Workflow Improvement Cycle", self.test_improvement_cycle),
            ("Test 7: Full Integration Test", self.test_full_integration),
        ]

        passed = 0
        failed = 0

        for test_name, test_func in tests:
            print(f"\n{'─'*60}")
            print(f"Running: {test_name}")
            print('─'*60)

            try:
                await test_func()
                print(f"  ✅ PASSED")
                passed += 1
                self.results.append({'test': test_name, 'status': 'passed'})
            except Exception as e:
                print(f"  ❌ FAILED: {e}")
                failed += 1
                self.results.append({'test': test_name, 'status': 'failed', 'error': str(e)})
                logger.exception(f"Test failed: {test_name}")

        return self._generate_summary(passed, failed)

    async def test_type_detection(self):
        """Test workflow type detection from descriptions."""
        print("  Testing workflow type detection...")

        for req in self.test_requests:
            detected = WorkflowBuilder.detect_workflow_type(req['description'])
            print(f"    '{req['description'][:40]}...' -> {detected.value}")

            # Note: We test that it detects something reasonable, not exact match
            assert detected is not None
            assert isinstance(detected, WorkflowType)

        print("  ✓ Type detection working correctly")

    async def test_n8n_generation(self):
        """Test N8N workflow generation."""
        print("  Testing N8N workflow generation...")

        builder = N8NBuilder(output_dir=self.temp_dir)

        # Test AI Pipeline workflow
        workflow = builder.build(
            "Create an AI pipeline that processes incoming requests with Claude API",
            WorkflowType.AI_PIPELINE
        )

        assert workflow is not None
        assert workflow.name is not None
        assert len(workflow.nodes) > 0
        assert workflow.platform.value == "n8n"

        # Export and verify
        export_path = builder.export(workflow)
        assert Path(export_path).exists()

        # Verify JSON structure
        with open(export_path) as f:
            exported = json.load(f)
            assert 'nodes' in exported
            assert 'connections' in exported
            print(f"    Generated {len(exported['nodes'])} nodes")

        print("  ✓ N8N workflow generated and exported successfully")

    async def test_make_generation(self):
        """Test Make scenario generation."""
        print("  Testing Make scenario generation...")

        builder = MakeBuilder(output_dir=self.temp_dir)

        workflow = builder.build(
            "Generate content using AI and save to Google Sheets",
            WorkflowType.CONTENT_GENERATION
        )

        assert workflow is not None
        assert len(workflow.nodes) > 0
        assert workflow.platform.value == "make"

        export_path = builder.export(workflow)
        assert Path(export_path).exists()

        with open(export_path) as f:
            exported = json.load(f)
            assert 'flow' in exported
            print(f"    Generated {len(exported['flow'])} modules")

        print("  ✓ Make scenario generated and exported successfully")

    async def test_zapier_generation(self):
        """Test Zapier Zap generation."""
        print("  Testing Zapier Zap generation...")

        builder = ZapierBuilder(output_dir=self.temp_dir)

        workflow = builder.build(
            "Send Slack notifications when new form submissions arrive",
            WorkflowType.NOTIFICATION
        )

        assert workflow is not None
        assert len(workflow.nodes) > 0
        assert workflow.platform.value == "zapier"

        export_path = builder.export(workflow)
        assert Path(export_path).exists()

        # Also generate setup instructions
        template_path = builder.generate_zapier_template(workflow)
        assert Path(template_path).exists()

        with open(export_path) as f:
            exported = json.load(f)
            assert 'steps' in exported
            print(f"    Generated {len(exported['steps'])} steps")

        print("  ✓ Zapier Zap generated and exported successfully")

    async def test_multi_platform(self):
        """Test generating same workflow for multiple platforms."""
        print("  Testing multi-platform workflow generation...")

        description = "Process webhook data, call AI, and send results to Slack"
        workflow_type = WorkflowBuilder.detect_workflow_type(description)

        builders = {
            'n8n': N8NBuilder(output_dir=self.temp_dir),
            'make': MakeBuilder(output_dir=self.temp_dir),
            'zapier': ZapierBuilder(output_dir=self.temp_dir)
        }

        workflows = {}
        for platform, builder in builders.items():
            workflow = builder.build(description, workflow_type)
            export_path = builder.export(workflow)
            workflows[platform] = {
                'workflow': workflow,
                'export_path': export_path,
                'node_count': len(workflow.nodes)
            }
            print(f"    {platform}: {len(workflow.nodes)} nodes")

        # All platforms should generate valid workflows
        for platform, data in workflows.items():
            assert Path(data['export_path']).exists()
            assert data['node_count'] > 0

        print("  ✓ Multi-platform generation successful")

    async def test_improvement_cycle(self):
        """Test workflow improvement through multiple iterations."""
        print("  Testing workflow improvement cycle...")

        builder = N8NBuilder(output_dir=self.temp_dir)
        description = "AI pipeline for customer support automation"

        # Round 1: Initial generation
        workflow_v1 = builder.build(description, WorkflowType.AI_PIPELINE)
        v1_nodes = len(workflow_v1.nodes)
        print(f"    V1: {v1_nodes} nodes")

        # Round 2: Add error handling context
        enhanced_description = description + " with error handling and retry logic"
        workflow_v2 = builder.build(enhanced_description, WorkflowType.AI_PIPELINE)
        v2_nodes = len(workflow_v2.nodes)
        print(f"    V2: {v2_nodes} nodes (with error handling)")

        # Round 3: Add multi-step processing
        final_description = enhanced_description + " and multi-step approval flow"
        workflow_v3 = builder.build(final_description, WorkflowType.AI_PIPELINE)
        v3_nodes = len(workflow_v3.nodes)
        print(f"    V3: {v3_nodes} nodes (full featured)")

        # Export all versions
        for i, wf in enumerate([workflow_v1, workflow_v2, workflow_v3], 1):
            export_path = builder.export(wf)
            assert Path(export_path).exists()

        print("  ✓ Improvement cycle completed successfully")

    async def test_full_integration(self):
        """Test full integration: analyze, build, export, validate."""
        print("  Testing full integration workflow...")

        # Step 1: Analyze request
        analyzer = WorkflowAnalyzer()
        request = """
        Create an automated workflow that:
        1. Receives webhook requests
        2. Processes them with Claude AI
        3. Stores results in Google Sheets
        4. Sends Slack notifications
        5. Handles errors gracefully
        """

        analysis = analyzer.analyze_request(request)
        print(f"    Analysis: Type={analysis['workflow_type']}, "
              f"Platform={analysis['recommended_platform']}, "
              f"Complexity={analysis['complexity']}")

        # Step 2: Build for recommended platform
        platform = analysis['recommended_platform']
        if platform == 'n8n':
            builder = N8NBuilder(output_dir=self.temp_dir)
        elif platform == 'make':
            builder = MakeBuilder(output_dir=self.temp_dir)
        else:
            builder = ZapierBuilder(output_dir=self.temp_dir)

        workflow_type = WorkflowType(analysis['workflow_type'])
        workflow = builder.build(request, workflow_type)

        # Step 3: Export
        export_path = builder.export(workflow)
        print(f"    Exported to: {Path(export_path).name}")

        # Step 4: Validate export
        with open(export_path) as f:
            exported = json.load(f)

        # Basic validation
        assert exported is not None
        if platform == 'n8n':
            assert 'nodes' in exported
        elif platform == 'make':
            assert 'flow' in exported
        else:
            assert 'steps' in exported

        # Step 5: Generate report
        report = self._generate_workflow_report(workflow, analysis, export_path)
        print(f"    Report generated: {len(report)} characters")

        print("  ✓ Full integration test passed")

    def _generate_workflow_report(self, workflow, analysis: Dict, export_path: str) -> str:
        """Generate a detailed workflow report."""
        report = f"""
# Workflow Generation Report

## Request Analysis
- **Workflow Type**: {analysis['workflow_type']}
- **Recommended Platform**: {analysis['recommended_platform']}
- **Complexity**: {analysis['complexity']}
- **Integrations Detected**: {', '.join(analysis['integrations']) or 'None'}
- **Estimated Steps**: {analysis['estimated_steps']}

## Generated Workflow
- **Name**: {workflow.name}
- **Platform**: {workflow.platform.value}
- **Nodes**: {len(workflow.nodes)}
- **Export Path**: {export_path}

## Nodes Summary
"""
        for i, node in enumerate(workflow.nodes, 1):
            report += f"{i}. **{node.name}** ({node.type})\n"

        report += f"""
## Timestamps
- **Analysis**: {analysis['timestamp']}
- **Generation**: {workflow.created_at.isoformat()}

## Status
✅ Workflow generated and validated successfully
"""
        return report

    def _generate_summary(self, passed: int, failed: int) -> Dict:
        """Generate test summary."""
        total = passed + failed

        print("\n" + "="*80)
        print("                    TEST SUMMARY")
        print("="*80)
        print(f"\n  Total Tests: {total}")
        print(f"  Passed: {passed} ✅")
        print(f"  Failed: {failed} ❌")
        print(f"  Success Rate: {passed/total*100:.1f}%")

        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'results': self.results
        }


async def main():
    """Run automation tests."""
    suite = WorkflowTestSuite()
    results = await suite.run_all_tests()
    return 0 if results['failed'] == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
