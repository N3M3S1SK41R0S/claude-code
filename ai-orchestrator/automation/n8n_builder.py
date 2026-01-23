"""
N8N Workflow Builder
Creates and exports workflows for n8n automation platform.
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

logger = logging.getLogger('N8N-Builder')


class N8NBuilder(WorkflowBuilder):
    """
    Builder for n8n workflows.

    n8n is a self-hosted, open-source workflow automation tool.
    This builder creates workflows in n8n's JSON format.
    """

    # Node type mappings for n8n
    NODE_TYPES = {
        'webhook': 'n8n-nodes-base.webhook',
        'cron': 'n8n-nodes-base.cron',
        'manual': 'n8n-nodes-base.manualTrigger',
        'http': 'n8n-nodes-base.httpRequest',
        'code': 'n8n-nodes-base.code',
        'set': 'n8n-nodes-base.set',
        'if': 'n8n-nodes-base.if',
        'switch': 'n8n-nodes-base.switch',
        'merge': 'n8n-nodes-base.merge',
        'split_batches': 'n8n-nodes-base.splitInBatches',
        'wait': 'n8n-nodes-base.wait',
        'slack': 'n8n-nodes-base.slack',
        'discord': 'n8n-nodes-base.discord',
        'email': 'n8n-nodes-base.emailSend',
        'gmail': 'n8n-nodes-base.gmail',
        'google_sheets': 'n8n-nodes-base.googleSheets',
        'google_drive': 'n8n-nodes-base.googleDrive',
        'notion': 'n8n-nodes-base.notion',
        'airtable': 'n8n-nodes-base.airtable',
        'github': 'n8n-nodes-base.github',
        'gitlab': 'n8n-nodes-base.gitlab',
        'jira': 'n8n-nodes-base.jira',
        'openai': 'n8n-nodes-base.openAi',
        'anthropic': '@n8n/n8n-nodes-langchain.anthropic',
        'postgres': 'n8n-nodes-base.postgres',
        'mysql': 'n8n-nodes-base.mySql',
        'mongodb': 'n8n-nodes-base.mongoDb',
        'function': 'n8n-nodes-base.function',
        'function_item': 'n8n-nodes-base.functionItem',
    }

    def __init__(self, output_dir: str = None):
        super().__init__(output_dir)
        self.platform = WorkflowPlatform.N8N

    def build(self, description: str, workflow_type: WorkflowType = None) -> WorkflowDefinition:
        """Build an n8n workflow from description."""
        if workflow_type is None:
            workflow_type = self.detect_workflow_type(description)

        workflow_id = self.generate_id(description[:30])

        # Create workflow definition
        workflow = WorkflowDefinition(
            id=workflow_id,
            name=self._generate_name(description),
            description=description,
            platform=self.platform,
            workflow_type=workflow_type,
            settings={
                'executionOrder': 'v1',
                'saveManualExecutions': True,
                'callerPolicy': 'workflowsFromSameOwner'
            }
        )

        # Build nodes based on workflow type
        nodes = self._build_nodes_for_type(workflow_type, description)
        workflow.nodes = nodes

        # Set trigger
        workflow.triggers = [nodes[0]] if nodes else []

        return workflow

    def _generate_name(self, description: str) -> str:
        """Generate workflow name from description."""
        # Take first meaningful words
        words = description.split()[:5]
        name = ' '.join(words)
        if len(name) > 50:
            name = name[:47] + '...'
        return name.title()

    def _build_nodes_for_type(self, workflow_type: WorkflowType,
                               description: str) -> List[WorkflowNode]:
        """Build appropriate nodes for workflow type."""
        nodes = []
        y_pos = 0
        x_pos = 0

        # Add trigger node
        trigger = self._create_trigger_node(workflow_type)
        trigger.position = {"x": x_pos, "y": y_pos}
        nodes.append(trigger)
        x_pos += 250

        # Add type-specific nodes
        if workflow_type == WorkflowType.AI_PIPELINE:
            nodes.extend(self._build_ai_pipeline_nodes(x_pos, y_pos))
        elif workflow_type == WorkflowType.WEBHOOK_HANDLER:
            nodes.extend(self._build_webhook_handler_nodes(x_pos, y_pos))
        elif workflow_type == WorkflowType.DATA_SYNC:
            nodes.extend(self._build_data_sync_nodes(x_pos, y_pos))
        elif workflow_type == WorkflowType.NOTIFICATION:
            nodes.extend(self._build_notification_nodes(x_pos, y_pos))
        elif workflow_type == WorkflowType.SCHEDULED_TASK:
            nodes.extend(self._build_scheduled_task_nodes(x_pos, y_pos))
        else:
            nodes.extend(self._build_generic_nodes(x_pos, y_pos))

        # Connect nodes
        self._connect_nodes(nodes)

        return nodes

    def _create_trigger_node(self, workflow_type: WorkflowType) -> WorkflowNode:
        """Create appropriate trigger node."""
        trigger_configs = {
            WorkflowType.WEBHOOK_HANDLER: {
                'type': 'webhook',
                'name': 'Webhook',
                'parameters': {
                    'httpMethod': 'POST',
                    'path': 'ai-orchestrator',
                    'responseMode': 'onReceived',
                    'responseData': 'allEntries'
                }
            },
            WorkflowType.SCHEDULED_TASK: {
                'type': 'cron',
                'name': 'Schedule Trigger',
                'parameters': {
                    'triggerTimes': {
                        'item': [{'mode': 'everyHour'}]
                    }
                }
            },
            WorkflowType.AI_PIPELINE: {
                'type': 'webhook',
                'name': 'AI Request Webhook',
                'parameters': {
                    'httpMethod': 'POST',
                    'path': 'ai-pipeline',
                    'responseMode': 'lastNode',
                    'responseData': 'allEntries'
                }
            }
        }

        config = trigger_configs.get(workflow_type, {
            'type': 'manual',
            'name': 'Manual Trigger',
            'parameters': {}
        })

        return WorkflowNode(
            id=f"trigger_{workflow_type.value}",
            name=config['name'],
            type=self.NODE_TYPES.get(config['type'], config['type']),
            parameters=config['parameters']
        )

    def _build_ai_pipeline_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build nodes for AI pipeline workflow."""
        nodes = []
        x = start_x

        # Input processor
        nodes.append(WorkflowNode(
            id="process_input",
            name="Process Input",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
// Extract and validate input
const input = items[0].json;
const request = input.body?.request || input.request || '';
const context = input.body?.context || {};

return [{
    json: {
        request: request,
        context: context,
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substring(7)
    }
}];
'''
            }
        ))
        x += 250

        # Claude API call - SECURITY: Uses credential reference, not actual key
        # User must configure 'anthropicApi' credential in n8n settings
        nodes.append(WorkflowNode(
            id="claude_api",
            name="Claude AI Processing",
            type=self.NODE_TYPES['http'],
            position={"x": x, "y": y},
            parameters={
                'method': 'POST',
                'url': 'https://api.anthropic.com/v1/messages',
                'authentication': 'predefinedCredentialType',
                'nodeCredentialType': 'httpHeaderAuth',
                'sendHeaders': True,
                'headerParameters': {
                    'parameters': [
                        # SECURITY: Credential placeholder - actual key configured in n8n
                        {'name': 'x-api-key', 'value': '={{$credentials.httpHeaderAuth.value}}'},
                        {'name': 'anthropic-version', 'value': '2023-06-01'},
                        {'name': 'content-type', 'value': 'application/json'}
                    ]
                },
                'sendBody': True,
                'bodyParameters': {
                    'parameters': [
                        {'name': 'model', 'value': 'claude-sonnet-4-5-20250514'},
                        {'name': 'max_tokens', 'value': '4096'},
                        {'name': 'messages', 'value': '={{ JSON.stringify([{role: "user", content: $json.request}]) }}'}
                    ]
                }
            },
            credentials='httpHeaderAuth',
            notes='SETUP: Create HTTP Header Auth credential named "Anthropic API" with header "x-api-key"'
        ))
        x += 250

        # Process response
        nodes.append(WorkflowNode(
            id="process_response",
            name="Format Response",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
// Format AI response
const response = items[0].json;
const aiResponse = response.content?.[0]?.text || response.content || 'No response';

return [{
    json: {
        success: true,
        response: aiResponse,
        model: response.model || 'claude-sonnet-4-5',
        timestamp: new Date().toISOString(),
        usage: response.usage || {}
    }
}];
'''
            }
        ))
        x += 250

        # Error handler (parallel branch)
        nodes.append(WorkflowNode(
            id="error_handler",
            name="Error Handler",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y + 150},
            parameters={
                'jsCode': '''
// Handle errors gracefully
const error = items[0].json;
return [{
    json: {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
    }
}];
'''
            }
        ))

        return nodes

    def _build_webhook_handler_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build nodes for webhook handler workflow."""
        nodes = []
        x = start_x

        # Validate webhook
        nodes.append(WorkflowNode(
            id="validate_webhook",
            name="Validate Webhook",
            type=self.NODE_TYPES['if'],
            position={"x": x, "y": y},
            parameters={
                'conditions': {
                    'boolean': [{
                        'value1': '={{ $json.body !== undefined }}',
                        'operation': 'equal',
                        'value2': True
                    }]
                }
            }
        ))
        x += 250

        # Process webhook data
        nodes.append(WorkflowNode(
            id="process_webhook",
            name="Process Data",
            type=self.NODE_TYPES['set'],
            position={"x": x, "y": y},
            parameters={
                'values': {
                    'string': [
                        {'name': 'processedAt', 'value': '={{ new Date().toISOString() }}'},
                        {'name': 'source', 'value': 'webhook'}
                    ]
                }
            }
        ))
        x += 250

        # Send confirmation
        nodes.append(WorkflowNode(
            id="send_response",
            name="Send Response",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
return [{
    json: {
        status: 'received',
        message: 'Webhook processed successfully',
        timestamp: new Date().toISOString()
    }
}];
'''
            }
        ))

        return nodes

    def _build_data_sync_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build nodes for data sync workflow."""
        nodes = []
        x = start_x

        # Fetch source data
        nodes.append(WorkflowNode(
            id="fetch_source",
            name="Fetch Source Data",
            type=self.NODE_TYPES['http'],
            position={"x": x, "y": y},
            parameters={
                'method': 'GET',
                'url': '={{ $json.sourceUrl }}',
                'responseFormat': 'json'
            }
        ))
        x += 250

        # Transform data
        nodes.append(WorkflowNode(
            id="transform_data",
            name="Transform Data",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
// Transform data for destination format
const sourceData = items.map(item => item.json);
return sourceData.map(data => ({
    json: {
        ...data,
        syncedAt: new Date().toISOString(),
        syncSource: 'ai-orchestrator'
    }
}));
'''
            }
        ))
        x += 250

        # Write to destination
        nodes.append(WorkflowNode(
            id="write_destination",
            name="Write to Destination",
            type=self.NODE_TYPES['http'],
            position={"x": x, "y": y},
            parameters={
                'method': 'POST',
                'url': '={{ $json.destinationUrl }}',
                'sendBody': True,
                'bodyContentType': 'json'
            }
        ))

        return nodes

    def _build_notification_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build nodes for notification workflow."""
        nodes = []
        x = start_x

        # Format notification
        nodes.append(WorkflowNode(
            id="format_notification",
            name="Format Notification",
            type=self.NODE_TYPES['set'],
            position={"x": x, "y": y},
            parameters={
                'values': {
                    'string': [
                        {'name': 'title', 'value': 'AI Orchestrator Notification'},
                        {'name': 'message', 'value': '={{ $json.message }}'},
                        {'name': 'timestamp', 'value': '={{ new Date().toISOString() }}'}
                    ]
                }
            }
        ))
        x += 250

        # Send via Slack (example)
        nodes.append(WorkflowNode(
            id="send_slack",
            name="Send Slack Message",
            type=self.NODE_TYPES['slack'],
            position={"x": x, "y": y},
            parameters={
                'channel': '={{ $json.channel || "general" }}',
                'text': '={{ $json.message }}',
                'otherOptions': {}
            },
            credentials='slackApi'
        ))

        return nodes

    def _build_scheduled_task_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build nodes for scheduled task workflow."""
        nodes = []
        x = start_x

        # Log execution
        nodes.append(WorkflowNode(
            id="log_execution",
            name="Log Execution",
            type=self.NODE_TYPES['set'],
            position={"x": x, "y": y},
            parameters={
                'values': {
                    'string': [
                        {'name': 'executionTime', 'value': '={{ new Date().toISOString() }}'},
                        {'name': 'status', 'value': 'running'}
                    ]
                }
            }
        ))
        x += 250

        # Execute task
        nodes.append(WorkflowNode(
            id="execute_task",
            name="Execute Task",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
// Scheduled task logic
const result = {
    taskCompleted: true,
    completedAt: new Date().toISOString(),
    nextRun: new Date(Date.now() + 3600000).toISOString() // +1 hour
};
return [{ json: result }];
'''
            }
        ))

        return nodes

    def _build_generic_nodes(self, start_x: int, y: int) -> List[WorkflowNode]:
        """Build generic nodes for unspecified workflow types."""
        nodes = []
        x = start_x

        nodes.append(WorkflowNode(
            id="process",
            name="Process",
            type=self.NODE_TYPES['code'],
            position={"x": x, "y": y},
            parameters={
                'jsCode': '''
// Generic processing
const input = items[0].json;
return [{
    json: {
        processed: true,
        input: input,
        timestamp: new Date().toISOString()
    }
}];
'''
            }
        ))

        return nodes

    def _connect_nodes(self, nodes: List[WorkflowNode]):
        """Connect nodes in sequence."""
        for i in range(len(nodes) - 1):
            nodes[i].connections = [nodes[i + 1].id]

    def export(self, workflow: WorkflowDefinition, format: str = "json") -> str:
        """Export workflow to n8n JSON format."""
        # Build n8n-compatible structure
        n8n_workflow = {
            "name": workflow.name,
            "nodes": [],
            "connections": {},
            "active": False,
            "settings": workflow.settings,
            "versionId": workflow.id,
            "meta": {
                "instanceId": "ai-orchestrator"
            },
            "tags": [
                {"name": "ai-orchestrator"},
                {"name": workflow.workflow_type.value}
            ]
        }

        # Convert nodes
        for node in workflow.nodes:
            n8n_node = {
                "id": node.id,
                "name": node.name,
                "type": node.type,
                "typeVersion": 1,
                "position": [node.position["x"], node.position["y"]],
                "parameters": node.parameters
            }
            if node.credentials:
                n8n_node["credentials"] = {
                    node.credentials: {"id": "1", "name": node.credentials}
                }
            n8n_workflow["nodes"].append(n8n_node)

        # Build connections
        for node in workflow.nodes:
            if node.connections:
                n8n_workflow["connections"][node.name] = {
                    "main": [[{"node": conn, "type": "main", "index": 0}
                             for conn in node.connections]]
                }

        # Export to file
        filepath = self.output_dir / f"{workflow.id}_n8n.json"
        with open(filepath, 'w') as f:
            json.dump(n8n_workflow, f, indent=2)

        logger.info(f"n8n workflow exported to: {filepath}")
        return str(filepath)

    def export_for_import(self, workflow: WorkflowDefinition) -> Dict:
        """Export in format ready for n8n import."""
        return {
            "name": workflow.name,
            "nodes": [self._node_to_n8n(n) for n in workflow.nodes],
            "connections": self._build_connections(workflow.nodes),
            "active": False,
            "settings": workflow.settings
        }

    def _node_to_n8n(self, node: WorkflowNode) -> Dict:
        """Convert node to n8n format."""
        return {
            "id": node.id,
            "name": node.name,
            "type": node.type,
            "typeVersion": 1,
            "position": [node.position["x"], node.position["y"]],
            "parameters": node.parameters
        }

    def _build_connections(self, nodes: List[WorkflowNode]) -> Dict:
        """Build n8n connections object."""
        connections = {}
        for node in nodes:
            if node.connections:
                connections[node.name] = {
                    "main": [[{"node": conn, "type": "main", "index": 0}
                             for conn in node.connections]]
                }
        return connections
