"""
Make (Integromat) Workflow Builder
Creates and exports scenarios for Make automation platform.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from .workflow_builder import (
    WorkflowBuilder, WorkflowDefinition, WorkflowNode,
    WorkflowPlatform, WorkflowType
)

logger = logging.getLogger('Make-Builder')


class MakeBuilder(WorkflowBuilder):
    """
    Builder for Make (formerly Integromat) scenarios.

    Make uses a visual flow-based approach with modules and routes.
    """

    # Module mappings for Make
    MODULE_TYPES = {
        'webhook': 'gateway:CustomWebHook',
        'http': 'http:ActionSendData',
        'json_parse': 'json:ParseJSON',
        'json_create': 'json:CreateJSON',
        'router': 'flow:Router',
        'iterator': 'flow:Iterator',
        'aggregator': 'flow:Aggregator',
        'set_variable': 'util:SetVariable',
        'get_variable': 'util:GetVariable',
        'sleep': 'util:Sleep',
        'slack': 'slack:CreateMessage',
        'gmail': 'google-email:SendEmail',
        'google_sheets': 'google-sheets:AddRow',
        'notion': 'notion:CreatePage',
        'airtable': 'airtable:CreateRecord',
        'openai': 'openai:CreateCompletion',
        'text_parser': 'builtin:TextParser',
        'error_handler': 'flow:ErrorHandler',
    }

    def __init__(self, output_dir: str = None):
        super().__init__(output_dir)
        self.platform = WorkflowPlatform.MAKE

    def build(self, description: str, workflow_type: WorkflowType = None) -> WorkflowDefinition:
        """Build a Make scenario from description."""
        if workflow_type is None:
            workflow_type = self.detect_workflow_type(description)

        workflow_id = self.generate_id(description[:30])

        workflow = WorkflowDefinition(
            id=workflow_id,
            name=self._generate_name(description),
            description=description,
            platform=self.platform,
            workflow_type=workflow_type,
            settings={
                'maxErrors': 3,
                'maxConsecutiveErrors': 3,
                'maxTransferAmount': 10485760,  # 10MB
                'scheduling': {'type': 'immediately'}
            }
        )

        # Build modules based on workflow type
        nodes = self._build_modules_for_type(workflow_type, description)
        workflow.nodes = nodes
        workflow.triggers = [nodes[0]] if nodes else []

        return workflow

    def _generate_name(self, description: str) -> str:
        """Generate scenario name."""
        words = description.split()[:4]
        return ' '.join(words).title()

    def _build_modules_for_type(self, workflow_type: WorkflowType,
                                 description: str) -> List[WorkflowNode]:
        """Build appropriate modules for workflow type."""
        modules = []
        position = 0

        # Add trigger module
        trigger = self._create_trigger_module(workflow_type)
        trigger.position = {"x": position, "y": 0}
        modules.append(trigger)
        position += 1

        # Add type-specific modules
        if workflow_type == WorkflowType.AI_PIPELINE:
            modules.extend(self._build_ai_pipeline_modules(position))
        elif workflow_type == WorkflowType.CONTENT_GENERATION:
            modules.extend(self._build_content_generation_modules(position))
        elif workflow_type == WorkflowType.DOCUMENT_PROCESSING:
            modules.extend(self._build_document_processing_modules(position))
        elif workflow_type == WorkflowType.MULTI_STEP_APPROVAL:
            modules.extend(self._build_approval_modules(position))
        else:
            modules.extend(self._build_generic_modules(position))

        # Connect modules
        self._connect_modules(modules)

        return modules

    def _create_trigger_module(self, workflow_type: WorkflowType) -> WorkflowNode:
        """Create trigger module."""
        if workflow_type in [WorkflowType.AI_PIPELINE, WorkflowType.WEBHOOK_HANDLER]:
            return WorkflowNode(
                id="trigger_webhook",
                name="Webhook",
                type=self.MODULE_TYPES['webhook'],
                parameters={
                    'hook': {
                        'type': 'custom',
                        'name': 'AI Orchestrator Webhook'
                    }
                }
            )
        elif workflow_type == WorkflowType.SCHEDULED_TASK:
            return WorkflowNode(
                id="trigger_schedule",
                name="Schedule",
                type="builtin:Schedule",
                parameters={
                    'interval': 60,
                    'unit': 'minutes'
                }
            )
        else:
            return WorkflowNode(
                id="trigger_instant",
                name="Instant Trigger",
                type="builtin:BasicTrigger",
                parameters={}
            )

    def _build_ai_pipeline_modules(self, start_pos: int) -> List[WorkflowNode]:
        """Build modules for AI pipeline."""
        modules = []
        pos = start_pos

        # Parse incoming JSON
        modules.append(WorkflowNode(
            id="parse_request",
            name="Parse Request",
            type=self.MODULE_TYPES['json_parse'],
            position={"x": pos, "y": 0},
            parameters={
                'json': '{{1.body}}'
            }
        ))
        pos += 1

        # Call Claude API
        modules.append(WorkflowNode(
            id="call_claude",
            name="Claude AI Request",
            type=self.MODULE_TYPES['http'],
            position={"x": pos, "y": 0},
            parameters={
                'url': 'https://api.anthropic.com/v1/messages',
                'method': 'POST',
                'headers': [
                    {'name': 'x-api-key', 'value': '{{connection.anthropic.apiKey}}'},
                    {'name': 'anthropic-version', 'value': '2023-06-01'},
                    {'name': 'content-type', 'value': 'application/json'}
                ],
                'body': {
                    'model': 'claude-sonnet-4-5-20250514',
                    'max_tokens': 4096,
                    'messages': [{'role': 'user', 'content': '{{2.request}}'}]
                }
            }
        ))
        pos += 1

        # Parse AI response
        modules.append(WorkflowNode(
            id="parse_response",
            name="Parse AI Response",
            type=self.MODULE_TYPES['json_parse'],
            position={"x": pos, "y": 0},
            parameters={
                'json': '{{3.data}}'
            }
        ))
        pos += 1

        # Format output
        modules.append(WorkflowNode(
            id="format_output",
            name="Format Output",
            type=self.MODULE_TYPES['json_create'],
            position={"x": pos, "y": 0},
            parameters={
                'value': {
                    'success': True,
                    'response': '{{4.content[0].text}}',
                    'model': '{{4.model}}',
                    'timestamp': '{{now}}'
                }
            }
        ))

        return modules

    def _build_content_generation_modules(self, start_pos: int) -> List[WorkflowNode]:
        """Build modules for content generation."""
        modules = []
        pos = start_pos

        # Set content parameters
        modules.append(WorkflowNode(
            id="set_params",
            name="Set Content Parameters",
            type=self.MODULE_TYPES['set_variable'],
            position={"x": pos, "y": 0},
            parameters={
                'variables': [
                    {'name': 'topic', 'value': '{{1.topic}}'},
                    {'name': 'style', 'value': '{{1.style}}'},
                    {'name': 'length', 'value': '{{1.length}}'}
                ]
            }
        ))
        pos += 1

        # Generate with AI
        modules.append(WorkflowNode(
            id="generate_content",
            name="Generate Content",
            type=self.MODULE_TYPES['http'],
            position={"x": pos, "y": 0},
            parameters={
                'url': 'https://api.anthropic.com/v1/messages',
                'method': 'POST',
                'body': {
                    'model': 'claude-sonnet-4-5-20250514',
                    'messages': [{
                        'role': 'user',
                        'content': 'Generate {{variables.style}} content about {{variables.topic}}'
                    }]
                }
            }
        ))
        pos += 1

        # Router for different outputs
        modules.append(WorkflowNode(
            id="output_router",
            name="Output Router",
            type=self.MODULE_TYPES['router'],
            position={"x": pos, "y": 0},
            parameters={
                'routes': [
                    {'condition': '{{1.output == "slack"}}', 'label': 'Slack'},
                    {'condition': '{{1.output == "notion"}}', 'label': 'Notion'},
                    {'condition': 'true', 'label': 'Default'}
                ]
            }
        ))

        return modules

    def _build_document_processing_modules(self, start_pos: int) -> List[WorkflowNode]:
        """Build modules for document processing."""
        modules = []
        pos = start_pos

        # Download document
        modules.append(WorkflowNode(
            id="download_doc",
            name="Download Document",
            type=self.MODULE_TYPES['http'],
            position={"x": pos, "y": 0},
            parameters={
                'url': '{{1.documentUrl}}',
                'method': 'GET',
                'parseResponse': False
            }
        ))
        pos += 1

        # Extract text (using AI for OCR/parsing)
        modules.append(WorkflowNode(
            id="extract_text",
            name="Extract Text with AI",
            type=self.MODULE_TYPES['http'],
            position={"x": pos, "y": 0},
            parameters={
                'url': 'https://api.anthropic.com/v1/messages',
                'method': 'POST',
                'body': {
                    'model': 'claude-sonnet-4-5-20250514',
                    'messages': [{
                        'role': 'user',
                        'content': 'Extract and structure the key information from this document'
                    }]
                }
            }
        ))
        pos += 1

        # Save to storage
        modules.append(WorkflowNode(
            id="save_result",
            name="Save Extracted Data",
            type=self.MODULE_TYPES['google_sheets'],
            position={"x": pos, "y": 0},
            parameters={
                'spreadsheetId': '{{connection.googleSheets.spreadsheetId}}',
                'sheetName': 'Extracted Documents',
                'values': ['{{now}}', '{{3.response}}']
            }
        ))

        return modules

    def _build_approval_modules(self, start_pos: int) -> List[WorkflowNode]:
        """Build modules for multi-step approval workflow."""
        modules = []
        pos = start_pos

        # Initial request processing
        modules.append(WorkflowNode(
            id="process_request",
            name="Process Approval Request",
            type=self.MODULE_TYPES['json_parse'],
            position={"x": pos, "y": 0},
            parameters={
                'json': '{{1.body}}'
            }
        ))
        pos += 1

        # Send for first approval
        modules.append(WorkflowNode(
            id="first_approval",
            name="Request First Approval",
            type=self.MODULE_TYPES['slack'],
            position={"x": pos, "y": 0},
            parameters={
                'channel': '{{2.firstApproverChannel}}',
                'text': 'Approval needed for: {{2.requestTitle}}'
            }
        ))
        pos += 1

        # Wait for response
        modules.append(WorkflowNode(
            id="wait_approval",
            name="Wait for Approval",
            type=self.MODULE_TYPES['sleep'],
            position={"x": pos, "y": 0},
            parameters={
                'delay': 300  # 5 minutes
            }
        ))

        return modules

    def _build_generic_modules(self, start_pos: int) -> List[WorkflowNode]:
        """Build generic processing modules."""
        modules = []
        pos = start_pos

        modules.append(WorkflowNode(
            id="process",
            name="Process Data",
            type=self.MODULE_TYPES['json_parse'],
            position={"x": pos, "y": 0},
            parameters={
                'json': '{{1.body}}'
            }
        ))
        pos += 1

        modules.append(WorkflowNode(
            id="transform",
            name="Transform",
            type=self.MODULE_TYPES['json_create'],
            position={"x": pos, "y": 0},
            parameters={
                'value': {
                    'processed': True,
                    'data': '{{2}}',
                    'timestamp': '{{now}}'
                }
            }
        ))

        return modules

    def _connect_modules(self, modules: List[WorkflowNode]):
        """Connect modules in sequence."""
        for i in range(len(modules) - 1):
            modules[i].connections = [modules[i + 1].id]

    def export(self, workflow: WorkflowDefinition, format: str = "json") -> str:
        """Export workflow to Make blueprint format."""
        blueprint = {
            "name": workflow.name,
            "flow": [],
            "metadata": {
                "instant": True,
                "version": 1,
                "scenario": {
                    "roundtrips": 1,
                    "maxErrors": workflow.settings.get('maxErrors', 3)
                }
            }
        }

        # Convert nodes to Make modules
        for i, node in enumerate(workflow.nodes):
            module = {
                "id": i + 1,
                "module": node.type,
                "version": 1,
                "parameters": node.parameters,
                "mapper": {},
                "metadata": {
                    "designer": {
                        "x": node.position.get("x", i) * 300,
                        "y": node.position.get("y", 0)
                    }
                }
            }
            blueprint["flow"].append(module)

        # Export to file
        filepath = self.output_dir / f"{workflow.id}_make.json"
        with open(filepath, 'w') as f:
            json.dump(blueprint, f, indent=2)

        logger.info(f"Make scenario exported to: {filepath}")
        return str(filepath)
