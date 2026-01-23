"""
Zapier Workflow Builder
Creates and exports Zaps for Zapier automation platform.
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

logger = logging.getLogger('Zapier-Builder')


class ZapierBuilder(WorkflowBuilder):
    """
    Builder for Zapier Zaps.

    Zapier uses a trigger-action model with steps.
    """

    # App/Action mappings for Zapier
    APP_MAPPINGS = {
        'webhook': {'app': 'WebhooksCLI', 'action': 'catch_hook'},
        'http': {'app': 'WebhooksCLI', 'action': 'custom_request'},
        'slack': {'app': 'SlackCLI', 'action': 'send_channel_message'},
        'discord': {'app': 'DiscordCLI', 'action': 'send_channel_message'},
        'gmail': {'app': 'GmailCLI', 'action': 'send_email'},
        'google_sheets': {'app': 'GoogleSheetsCLI', 'action': 'create_spreadsheet_row'},
        'google_drive': {'app': 'GoogleDriveCLI', 'action': 'upload_file'},
        'notion': {'app': 'NotionCLI', 'action': 'create_database_item'},
        'airtable': {'app': 'AirtableCLI', 'action': 'create_record'},
        'trello': {'app': 'TrelloCLI', 'action': 'create_card'},
        'asana': {'app': 'AsanaCLI', 'action': 'create_task'},
        'hubspot': {'app': 'HubSpotCLI', 'action': 'create_contact'},
        'openai': {'app': 'OpenAICLI', 'action': 'send_prompt'},
        'filter': {'app': 'FilterCLI', 'action': 'only_continue_if'},
        'formatter': {'app': 'FormatterCLI', 'action': 'text'},
        'delay': {'app': 'DelayCLI', 'action': 'delay_for'},
        'code': {'app': 'CodeCLI', 'action': 'run_python'},
    }

    def __init__(self, output_dir: str = None):
        super().__init__(output_dir)
        self.platform = WorkflowPlatform.ZAPIER

    def build(self, description: str, workflow_type: WorkflowType = None) -> WorkflowDefinition:
        """Build a Zapier Zap from description."""
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
                'autoreplay': True,
                'timezone': 'UTC'
            }
        )

        # Build steps based on workflow type
        nodes = self._build_steps_for_type(workflow_type, description)
        workflow.nodes = nodes
        workflow.triggers = [nodes[0]] if nodes else []

        return workflow

    def _generate_name(self, description: str) -> str:
        """Generate Zap name."""
        words = description.split()[:3]
        return ' '.join(words).title() + ' Zap'

    def _build_steps_for_type(self, workflow_type: WorkflowType,
                               description: str) -> List[WorkflowNode]:
        """Build appropriate steps for workflow type."""
        steps = []

        # Add trigger step
        trigger = self._create_trigger_step(workflow_type)
        steps.append(trigger)

        # Add type-specific steps
        if workflow_type == WorkflowType.NOTIFICATION:
            steps.extend(self._build_notification_steps())
        elif workflow_type == WorkflowType.FORM_PROCESSING:
            steps.extend(self._build_form_processing_steps())
        elif workflow_type == WorkflowType.AI_PIPELINE:
            steps.extend(self._build_ai_pipeline_steps())
        elif workflow_type == WorkflowType.DATA_SYNC:
            steps.extend(self._build_data_sync_steps())
        else:
            steps.extend(self._build_generic_steps())

        # Number and connect steps
        for i, step in enumerate(steps):
            step.position = {"x": i, "y": 0}
            if i > 0:
                steps[i-1].connections = [step.id]

        return steps

    def _create_trigger_step(self, workflow_type: WorkflowType) -> WorkflowNode:
        """Create trigger step."""
        trigger_configs = {
            WorkflowType.WEBHOOK_HANDLER: {
                'app': 'WebhooksCLI',
                'action': 'catch_hook',
                'name': 'Catch Hook'
            },
            WorkflowType.FORM_PROCESSING: {
                'app': 'TypeformCLI',
                'action': 'new_entry',
                'name': 'New Form Entry'
            },
            WorkflowType.SCHEDULED_TASK: {
                'app': 'ScheduleCLI',
                'action': 'every_hour',
                'name': 'Every Hour'
            },
            WorkflowType.AI_PIPELINE: {
                'app': 'WebhooksCLI',
                'action': 'catch_hook',
                'name': 'AI Pipeline Trigger'
            }
        }

        config = trigger_configs.get(workflow_type, {
            'app': 'WebhooksCLI',
            'action': 'catch_hook',
            'name': 'Webhook Trigger'
        })

        return WorkflowNode(
            id="trigger",
            name=config['name'],
            type=f"{config['app']}.{config['action']}",
            parameters={
                'trigger_type': 'trigger'
            }
        )

    def _build_notification_steps(self) -> List[WorkflowNode]:
        """Build steps for notification workflow."""
        return [
            WorkflowNode(
                id="format_message",
                name="Format Message",
                type="FormatterCLI.text",
                parameters={
                    'input': '{{trigger.message}}',
                    'transform': 'capitalize'
                }
            ),
            WorkflowNode(
                id="send_slack",
                name="Send to Slack",
                type="SlackCLI.send_channel_message",
                parameters={
                    'channel': '#notifications',
                    'message': '{{format_message.output}}'
                }
            ),
            WorkflowNode(
                id="send_email",
                name="Send Email Backup",
                type="GmailCLI.send_email",
                parameters={
                    'to': '{{trigger.email}}',
                    'subject': 'Notification',
                    'body': '{{format_message.output}}'
                }
            )
        ]

    def _build_form_processing_steps(self) -> List[WorkflowNode]:
        """Build steps for form processing."""
        return [
            WorkflowNode(
                id="filter_valid",
                name="Filter Valid Submissions",
                type="FilterCLI.only_continue_if",
                parameters={
                    'condition': '{{trigger.email}} contains @'
                }
            ),
            WorkflowNode(
                id="save_to_sheets",
                name="Save to Google Sheets",
                type="GoogleSheetsCLI.create_spreadsheet_row",
                parameters={
                    'spreadsheet': 'Form Submissions',
                    'worksheet': 'Sheet1',
                    'values': {
                        'name': '{{trigger.name}}',
                        'email': '{{trigger.email}}',
                        'message': '{{trigger.message}}',
                        'timestamp': '{{zap.timestamp}}'
                    }
                }
            ),
            WorkflowNode(
                id="send_confirmation",
                name="Send Confirmation Email",
                type="GmailCLI.send_email",
                parameters={
                    'to': '{{trigger.email}}',
                    'subject': 'Thank you for your submission',
                    'body': 'Hi {{trigger.name}}, we received your message.'
                }
            )
        ]

    def _build_ai_pipeline_steps(self) -> List[WorkflowNode]:
        """Build steps for AI pipeline."""
        return [
            WorkflowNode(
                id="parse_input",
                name="Parse Input",
                type="FormatterCLI.text",
                parameters={
                    'input': '{{trigger.body}}',
                    'transform': 'trim'
                }
            ),
            # SECURITY: API key placeholder - must be configured in Zapier connection
            WorkflowNode(
                id="call_ai",
                name="Send to Claude AI",
                type="WebhooksCLI.custom_request",
                parameters={
                    'method': 'POST',
                    'url': 'https://api.anthropic.com/v1/messages',
                    # SECURITY: Use Zapier's secure credential storage
                    'headers': {
                        'x-api-key': '__CONFIGURE_IN_ZAPIER_AUTH__',
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    'data': {
                        'model': 'claude-sonnet-4-5-20250514',
                        'max_tokens': 4096,
                        'messages': [
                            {'role': 'user', 'content': '{{parse_input.output}}'}
                        ]
                    }
                },
                notes='SETUP: Add Anthropic API key in Zapier Authentication settings'
            ),
            WorkflowNode(
                id="format_response",
                name="Format AI Response",
                type="CodeCLI.run_python",
                parameters={
                    'code': '''
response = input_data.get('call_ai', {})
content = response.get('content', [{}])[0].get('text', '')
output = {
    'success': True,
    'response': content,
    'timestamp': datetime.now().isoformat()
}
'''
                }
            ),
            WorkflowNode(
                id="webhook_response",
                name="Return Response",
                type="WebhooksCLI.custom_request",
                parameters={
                    'method': 'POST',
                    'url': '{{trigger.callback_url}}',
                    'data': '{{format_response.output}}'
                }
            )
        ]

    def _build_data_sync_steps(self) -> List[WorkflowNode]:
        """Build steps for data sync."""
        return [
            WorkflowNode(
                id="get_data",
                name="Get Source Data",
                type="WebhooksCLI.custom_request",
                parameters={
                    'method': 'GET',
                    'url': '{{trigger.source_url}}'
                }
            ),
            WorkflowNode(
                id="transform",
                name="Transform Data",
                type="FormatterCLI.text",
                parameters={
                    'input': '{{get_data.body}}',
                    'transform': 'default'
                }
            ),
            WorkflowNode(
                id="save_destination",
                name="Save to Destination",
                type="GoogleSheetsCLI.create_spreadsheet_row",
                parameters={
                    'spreadsheet': '{{trigger.destination_sheet}}',
                    'values': '{{transform.output}}'
                }
            )
        ]

    def _build_generic_steps(self) -> List[WorkflowNode]:
        """Build generic processing steps."""
        return [
            WorkflowNode(
                id="process",
                name="Process Data",
                type="FormatterCLI.text",
                parameters={
                    'input': '{{trigger.data}}',
                    'transform': 'trim'
                }
            ),
            WorkflowNode(
                id="output",
                name="Send Output",
                type="WebhooksCLI.custom_request",
                parameters={
                    'method': 'POST',
                    'url': '{{trigger.callback_url}}',
                    'data': {
                        'processed': True,
                        'result': '{{process.output}}'
                    }
                }
            )
        ]

    def export(self, workflow: WorkflowDefinition, format: str = "json") -> str:
        """Export workflow to Zapier-compatible format."""
        zap_definition = {
            "name": workflow.name,
            "description": workflow.description,
            "steps": [],
            "meta": {
                "created_at": workflow.created_at.isoformat(),
                "version": workflow.version,
                "platform": "zapier"
            }
        }

        # Convert nodes to Zapier steps
        for i, node in enumerate(workflow.nodes):
            step = {
                "id": i + 1,
                "type": "trigger" if i == 0 else "action",
                "app": node.type.split('.')[0] if '.' in node.type else node.type,
                "action": node.type.split('.')[1] if '.' in node.type else 'default',
                "name": node.name,
                "params": node.parameters
            }
            zap_definition["steps"].append(step)

        # Export to file
        filepath = self.output_dir / f"{workflow.id}_zapier.json"
        with open(filepath, 'w') as f:
            json.dump(zap_definition, f, indent=2)

        logger.info(f"Zapier Zap exported to: {filepath}")
        return str(filepath)

    def generate_zapier_template(self, workflow: WorkflowDefinition) -> str:
        """Generate human-readable Zapier setup instructions."""
        template = f"""# Zapier Zap Setup Instructions

## Zap Name: {workflow.name}

### Description
{workflow.description}

### Steps to Create

"""
        for i, node in enumerate(workflow.nodes):
            step_type = "TRIGGER" if i == 0 else f"ACTION {i}"
            app_name = node.type.split('.')[0].replace('CLI', '') if '.' in node.type else node.type

            template += f"""#### Step {i + 1}: {step_type}
- **App**: {app_name}
- **Action**: {node.name}
- **Configuration**:
```json
{json.dumps(node.parameters, indent=2)}
```

"""

        template += """### Notes
- Replace placeholder values ({{...}}) with actual field mappings
- Test each step before activating the Zap
- Enable error notifications for monitoring
"""

        # Save template
        filepath = self.output_dir / f"{workflow.id}_zapier_setup.md"
        with open(filepath, 'w') as f:
            f.write(template)

        return str(filepath)
