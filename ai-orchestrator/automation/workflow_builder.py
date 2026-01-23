"""
Workflow Builder
Creates automated workflows for N8N, Make, Zapier based on request typology.
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any
import hashlib

logger = logging.getLogger('Workflow-Builder')


class WorkflowPlatform(Enum):
    """Supported automation platforms."""
    N8N = "n8n"
    MAKE = "make"  # formerly Integromat
    ZAPIER = "zapier"
    GITHUB_ACTIONS = "github_actions"
    AUTO = "auto"  # Auto-detect best platform


class WorkflowType(Enum):
    """Types of workflows based on use case."""
    DATA_SYNC = "data_sync"
    API_INTEGRATION = "api_integration"
    AI_PIPELINE = "ai_pipeline"
    NOTIFICATION = "notification"
    CONTENT_GENERATION = "content_generation"
    DOCUMENT_PROCESSING = "document_processing"
    FORM_PROCESSING = "form_processing"
    SCHEDULED_TASK = "scheduled_task"
    WEBHOOK_HANDLER = "webhook_handler"
    MULTI_STEP_APPROVAL = "multi_step_approval"


@dataclass
class WorkflowNode:
    """Represents a node/step in a workflow."""
    id: str
    name: str
    type: str
    position: Dict[str, int] = field(default_factory=lambda: {"x": 0, "y": 0})
    parameters: Dict = field(default_factory=dict)
    credentials: Optional[str] = None
    connections: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class WorkflowDefinition:
    """Complete workflow definition."""
    id: str
    name: str
    description: str
    platform: WorkflowPlatform
    workflow_type: WorkflowType
    nodes: List[WorkflowNode] = field(default_factory=list)
    triggers: List[WorkflowNode] = field(default_factory=list)
    variables: Dict = field(default_factory=dict)
    settings: Dict = field(default_factory=dict)
    version: str = "1.0.0"
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for export."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'platform': self.platform.value,
            'workflow_type': self.workflow_type.value,
            'nodes': [self._node_to_dict(n) for n in self.nodes],
            'triggers': [self._node_to_dict(n) for n in self.triggers],
            'variables': self.variables,
            'settings': self.settings,
            'version': self.version,
            'created_at': self.created_at.isoformat()
        }

    def _node_to_dict(self, node: WorkflowNode) -> Dict:
        return {
            'id': node.id,
            'name': node.name,
            'type': node.type,
            'position': node.position,
            'parameters': node.parameters,
            'credentials': node.credentials,
            'connections': node.connections,
            'notes': node.notes
        }


class WorkflowBuilder(ABC):
    """Abstract base class for workflow builders."""

    # Keywords for detecting workflow type
    TYPE_KEYWORDS = {
        WorkflowType.DATA_SYNC: ['sync', 'synchronize', 'backup', 'mirror', 'replicate'],
        WorkflowType.API_INTEGRATION: ['api', 'rest', 'graphql', 'endpoint', 'integration'],
        WorkflowType.AI_PIPELINE: ['ai', 'ml', 'claude', 'gpt', 'model', 'inference', 'orchestr'],
        WorkflowType.NOTIFICATION: ['notify', 'alert', 'email', 'slack', 'discord', 'message'],
        WorkflowType.CONTENT_GENERATION: ['generate', 'create content', 'blog', 'social media'],
        WorkflowType.DOCUMENT_PROCESSING: ['document', 'pdf', 'extract', 'ocr', 'parse'],
        WorkflowType.FORM_PROCESSING: ['form', 'submission', 'survey', 'input'],
        WorkflowType.SCHEDULED_TASK: ['schedule', 'cron', 'daily', 'weekly', 'periodic'],
        WorkflowType.WEBHOOK_HANDLER: ['webhook', 'callback', 'event', 'trigger'],
        WorkflowType.MULTI_STEP_APPROVAL: ['approval', 'review', 'validate', 'sign-off'],
    }

    # Platform recommendations based on workflow type
    PLATFORM_RECOMMENDATIONS = {
        WorkflowType.DATA_SYNC: WorkflowPlatform.N8N,
        WorkflowType.API_INTEGRATION: WorkflowPlatform.N8N,
        WorkflowType.AI_PIPELINE: WorkflowPlatform.N8N,  # Best for complex AI workflows
        WorkflowType.NOTIFICATION: WorkflowPlatform.ZAPIER,  # Simple and reliable
        WorkflowType.CONTENT_GENERATION: WorkflowPlatform.MAKE,
        WorkflowType.DOCUMENT_PROCESSING: WorkflowPlatform.MAKE,
        WorkflowType.FORM_PROCESSING: WorkflowPlatform.ZAPIER,
        WorkflowType.SCHEDULED_TASK: WorkflowPlatform.N8N,
        WorkflowType.WEBHOOK_HANDLER: WorkflowPlatform.N8N,
        WorkflowType.MULTI_STEP_APPROVAL: WorkflowPlatform.MAKE,
    }

    def __init__(self, output_dir: str = None):
        self.output_dir = Path(output_dir or "~/.ai-orchestrator/workflows").expanduser()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def detect_workflow_type(cls, description: str) -> WorkflowType:
        """Detect workflow type from description."""
        description_lower = description.lower()
        scores = {}

        for wf_type, keywords in cls.TYPE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in description_lower)
            if score > 0:
                scores[wf_type] = score

        if scores:
            return max(scores, key=scores.get)
        return WorkflowType.API_INTEGRATION  # Default

    @classmethod
    def recommend_platform(cls, workflow_type: WorkflowType,
                           requirements: Dict = None) -> WorkflowPlatform:
        """Recommend best platform for the workflow type."""
        requirements = requirements or {}

        # Check specific requirements
        if requirements.get('self_hosted'):
            return WorkflowPlatform.N8N
        if requirements.get('simple'):
            return WorkflowPlatform.ZAPIER
        if requirements.get('complex_logic'):
            return WorkflowPlatform.MAKE

        return cls.PLATFORM_RECOMMENDATIONS.get(
            workflow_type, WorkflowPlatform.N8N
        )

    @abstractmethod
    def build(self, description: str, workflow_type: WorkflowType = None) -> WorkflowDefinition:
        """Build a workflow from description."""
        pass

    @abstractmethod
    def export(self, workflow: WorkflowDefinition, format: str = "json") -> str:
        """Export workflow to platform-specific format."""
        pass

    def generate_id(self, name: str) -> str:
        """Generate unique workflow ID."""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        hash_part = hashlib.md5(name.encode()).hexdigest()[:8]
        return f"wf_{timestamp}_{hash_part}"

    def save_workflow(self, workflow: WorkflowDefinition, filename: str = None) -> str:
        """Save workflow to file."""
        filename = filename or f"{workflow.id}.json"
        filepath = self.output_dir / filename

        with open(filepath, 'w') as f:
            json.dump(workflow.to_dict(), f, indent=2)

        logger.info(f"Workflow saved to: {filepath}")
        return str(filepath)


class WorkflowAnalyzer:
    """Analyzes requests to determine optimal workflow configuration."""

    def __init__(self):
        self.analysis_history: List[Dict] = []

    def analyze_request(self, request: str) -> Dict:
        """Analyze a request and return workflow recommendations."""
        workflow_type = WorkflowBuilder.detect_workflow_type(request)
        platform = WorkflowBuilder.recommend_platform(workflow_type)

        # Identify required integrations
        integrations = self._detect_integrations(request)

        # Estimate complexity
        complexity = self._estimate_complexity(request, integrations)

        # Generate node suggestions
        suggested_nodes = self._suggest_nodes(workflow_type, integrations)

        analysis = {
            'request': request[:200],
            'workflow_type': workflow_type.value,
            'recommended_platform': platform.value,
            'integrations': integrations,
            'complexity': complexity,
            'suggested_nodes': suggested_nodes,
            'estimated_steps': len(suggested_nodes),
            'timestamp': datetime.now().isoformat()
        }

        self.analysis_history.append(analysis)
        return analysis

    def _detect_integrations(self, request: str) -> List[str]:
        """Detect required integrations from request."""
        request_lower = request.lower()

        integration_keywords = {
            'slack': ['slack', 'channel'],
            'discord': ['discord'],
            'email': ['email', 'mail', 'smtp', 'gmail'],
            'google_sheets': ['google sheets', 'spreadsheet', 'gsheet'],
            'google_drive': ['google drive', 'gdrive'],
            'notion': ['notion'],
            'airtable': ['airtable'],
            'github': ['github', 'git repo'],
            'gitlab': ['gitlab'],
            'jira': ['jira'],
            'trello': ['trello'],
            'asana': ['asana'],
            'hubspot': ['hubspot'],
            'salesforce': ['salesforce'],
            'stripe': ['stripe', 'payment'],
            'twilio': ['twilio', 'sms'],
            'openai': ['openai', 'gpt', 'chatgpt'],
            'anthropic': ['claude', 'anthropic'],
            'webhook': ['webhook'],
            'http': ['http', 'api', 'rest'],
            'database': ['database', 'mysql', 'postgres', 'mongodb'],
            'firebase': ['firebase', 'firestore'],
        }

        detected = []
        for integration, keywords in integration_keywords.items():
            if any(kw in request_lower for kw in keywords):
                detected.append(integration)

        return detected

    def _estimate_complexity(self, request: str, integrations: List[str]) -> str:
        """Estimate workflow complexity."""
        # Simple heuristics
        complexity_score = 0

        # More integrations = more complex
        complexity_score += len(integrations) * 2

        # Check for complex patterns
        complex_indicators = [
            'conditional', 'if', 'loop', 'iterate', 'for each',
            'parallel', 'branch', 'merge', 'wait', 'delay',
            'error handling', 'retry', 'fallback'
        ]
        for indicator in complex_indicators:
            if indicator in request.lower():
                complexity_score += 3

        if complexity_score < 5:
            return "simple"
        elif complexity_score < 10:
            return "moderate"
        elif complexity_score < 20:
            return "complex"
        else:
            return "very_complex"

    def _suggest_nodes(self, workflow_type: WorkflowType,
                       integrations: List[str]) -> List[Dict]:
        """Suggest nodes based on workflow type and integrations."""
        nodes = []

        # Add trigger node
        trigger_map = {
            WorkflowType.WEBHOOK_HANDLER: {"type": "webhook", "name": "Webhook Trigger"},
            WorkflowType.SCHEDULED_TASK: {"type": "cron", "name": "Schedule Trigger"},
            WorkflowType.FORM_PROCESSING: {"type": "form_trigger", "name": "Form Submission"},
        }
        trigger = trigger_map.get(workflow_type, {"type": "manual", "name": "Manual Trigger"})
        nodes.append(trigger)

        # Add integration nodes
        for integration in integrations:
            nodes.append({
                "type": integration,
                "name": f"{integration.replace('_', ' ').title()} Node"
            })

        # Add AI processing node for AI pipelines
        if workflow_type == WorkflowType.AI_PIPELINE:
            nodes.append({"type": "ai_processor", "name": "AI Processing"})
            nodes.append({"type": "response_formatter", "name": "Format Response"})

        # Add output node
        nodes.append({"type": "output", "name": "Output/Response"})

        return nodes
