"""
NEMESIS Subagents - Delegate tasks to specialized sub-agents.

Experimental feature for task decomposition and parallel execution
through specialized sub-agent processes.
"""

from .manager import SubagentManager, SubagentConfig
from .agent import Subagent, SubagentStatus, SubagentResult
from .cline_bridge import ClineBridge, ClineStatus

__all__ = [
    'SubagentManager',
    'SubagentConfig',
    'Subagent',
    'SubagentStatus',
    'SubagentResult',
    'ClineBridge',
    'ClineStatus',
]
