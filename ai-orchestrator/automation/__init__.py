"""
Automation Module
Handles workflow creation for N8N, Make, Zapier, and other automation platforms.
"""

from .workflow_builder import WorkflowBuilder, WorkflowPlatform, WorkflowType
from .n8n_builder import N8NBuilder
from .make_builder import MakeBuilder
from .zapier_builder import ZapierBuilder

__all__ = [
    'WorkflowBuilder',
    'WorkflowPlatform',
    'WorkflowType',
    'N8NBuilder',
    'MakeBuilder',
    'ZapierBuilder'
]
