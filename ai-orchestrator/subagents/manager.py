"""
SubagentManager - Orchestrates spawning, tracking, and coordination of sub-agents.

The manager is responsible for:
- Spawning sub-agents for delegated tasks
- Tracking sub-agent lifecycle and status
- Coordinating results from parallel sub-agents
- Managing the Cline CLI bridge for external execution
"""

import time
import uuid
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from concurrent.futures import ThreadPoolExecutor, Future

from .agent import (
    Subagent,
    SubagentStatus,
    SubagentType,
    SubagentTask,
    SubagentResult,
)
from .cline_bridge import ClineBridge, ClineStatus

logger = logging.getLogger(__name__)


@dataclass
class SubagentConfig:
    """Configuration for the subagent system."""
    enabled: bool = True
    max_concurrent_agents: int = 5
    default_timeout_seconds: float = 300.0
    default_model: Optional[str] = None
    use_cline: bool = True
    auto_decompose: bool = False
    max_depth: int = 3  # Maximum nesting depth for sub-agents
    retry_failed: bool = True
    collect_artifacts: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SubagentConfig':
        """Create config from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class SubagentManager:
    """
    Manages the lifecycle of sub-agents for task delegation.

    The SubagentManager enables the NEMESIS orchestrator to decompose
    complex tasks and delegate subtasks to specialized agents that
    execute through the Cline CLI or internal workers.
    """

    def __init__(
        self,
        config: Optional[SubagentConfig] = None,
        cline_bridge: Optional[ClineBridge] = None,
    ):
        self.config = config or SubagentConfig()
        self.cline = cline_bridge or ClineBridge(
            timeout_seconds=self.config.default_timeout_seconds
        )

        self._agents: Dict[str, Subagent] = {}
        self._tasks: Dict[str, SubagentTask] = {}
        self._results: Dict[str, SubagentResult] = {}
        self._executor = ThreadPoolExecutor(
            max_workers=self.config.max_concurrent_agents
        )
        self._futures: Dict[str, Future] = {}
        self._lock = threading.Lock()

        logger.info(
            f"SubagentManager initialized "
            f"(max_concurrent={self.config.max_concurrent_agents}, "
            f"cline={self.cline.status.value})"
        )

    def spawn(
        self,
        task_description: str,
        agent_type: SubagentType = SubagentType.GENERAL,
        model: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        parent_task_id: Optional[str] = None,
        priority: int = 5,
        timeout_seconds: Optional[float] = None,
        on_complete: Optional[Callable] = None,
        on_error: Optional[Callable] = None,
    ) -> str:
        """
        Spawn a new sub-agent to handle a task.

        Args:
            task_description: Description of the task to delegate.
            agent_type: Type of specialized agent to use.
            model: Model override for this agent.
            context: Additional context for the task.
            parent_task_id: ID of the parent task (for nesting).
            priority: Task priority (1=highest, 10=lowest).
            timeout_seconds: Timeout for this specific task.
            on_complete: Callback when task completes.
            on_error: Callback when task fails.

        Returns:
            The agent ID for tracking.
        """
        if not self.config.enabled:
            raise RuntimeError("Subagent system is disabled")

        active_count = self._get_active_count()
        if active_count >= self.config.max_concurrent_agents:
            raise RuntimeError(
                f"Maximum concurrent agents reached "
                f"({self.config.max_concurrent_agents})"
            )

        # Create task
        task = SubagentTask(
            task_id=f"task-{uuid.uuid4().hex[:8]}",
            description=task_description,
            agent_type=agent_type,
            context=context or {},
            parent_task_id=parent_task_id,
            timeout_seconds=timeout_seconds or self.config.default_timeout_seconds,
            priority=priority,
        )

        # Create agent
        agent = Subagent(
            agent_type=agent_type,
            model=model or self.config.default_model,
            on_complete=on_complete,
            on_error=on_error,
        )

        with self._lock:
            self._agents[agent.agent_id] = agent
            self._tasks[task.task_id] = task

        # Submit to thread pool
        future = self._executor.submit(
            self._run_agent, agent, task
        )
        self._futures[agent.agent_id] = future

        logger.info(
            f"Spawned subagent {agent.agent_id} "
            f"({agent_type.value}) for: {task_description[:60]}..."
        )

        return agent.agent_id

    def spawn_team(
        self,
        tasks: List[Dict[str, Any]],
    ) -> List[str]:
        """
        Spawn multiple sub-agents as a coordinated team.

        Args:
            tasks: List of task configs, each with:
                - description (str): Task description
                - type (str): Agent type name
                - model (str, optional): Model override
                - context (dict, optional): Task context

        Returns:
            List of agent IDs.
        """
        agent_ids = []
        for task_config in tasks:
            agent_type = SubagentType(
                task_config.get("type", "general")
            )
            agent_id = self.spawn(
                task_description=task_config["description"],
                agent_type=agent_type,
                model=task_config.get("model"),
                context=task_config.get("context"),
                priority=task_config.get("priority", 5),
            )
            agent_ids.append(agent_id)

        logger.info(f"Spawned team of {len(agent_ids)} subagents")
        return agent_ids

    def _run_agent(self, agent: Subagent, task: SubagentTask) -> SubagentResult:
        """Run an agent's task through the appropriate executor."""

        def executor_fn(prompt, system_prompt, model, context):
            if self.config.use_cline and self.cline.is_available:
                result = self.cline.execute_task(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    model=model,
                    context=context,
                )
                if result.success:
                    return result.output
                raise RuntimeError(
                    f"Cline execution failed: {result.error}"
                )
            else:
                # Fallback: simulate execution for when Cline is unavailable
                return (
                    f"[Simulated] Task processed by {agent.agent_type.value} "
                    f"agent: {prompt[:200]}\n\n"
                    f"Note: Cline CLI not available. Install with: "
                    f"npm install -g cline"
                )

        result = agent.execute(task, executor_fn)

        with self._lock:
            self._results[agent.agent_id] = result

        return result

    def get_status(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific sub-agent."""
        agent = self._agents.get(agent_id)
        if agent:
            return agent.get_status()
        return None

    def get_result(self, agent_id: str) -> Optional[SubagentResult]:
        """Get result of a completed sub-agent."""
        return self._results.get(agent_id)

    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all sub-agents."""
        return {
            agent_id: agent.get_status()
            for agent_id, agent in self._agents.items()
        }

    def cancel(self, agent_id: str) -> bool:
        """Cancel a running sub-agent."""
        agent = self._agents.get(agent_id)
        if agent:
            agent.cancel()
            future = self._futures.get(agent_id)
            if future and not future.done():
                future.cancel()
            logger.info(f"Cancelled subagent {agent_id}")
            return True
        return False

    def cancel_all(self):
        """Cancel all running sub-agents."""
        for agent_id in list(self._agents.keys()):
            self.cancel(agent_id)
        logger.info("Cancelled all subagents")

    def wait_for(
        self,
        agent_id: str,
        timeout: Optional[float] = None,
    ) -> Optional[SubagentResult]:
        """Wait for a specific sub-agent to complete."""
        future = self._futures.get(agent_id)
        if future:
            try:
                return future.result(timeout=timeout)
            except Exception as e:
                logger.error(f"Error waiting for agent {agent_id}: {e}")
                return None
        return self._results.get(agent_id)

    def wait_for_all(
        self,
        agent_ids: Optional[List[str]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, SubagentResult]:
        """Wait for multiple sub-agents to complete."""
        ids_to_wait = agent_ids or list(self._futures.keys())
        results = {}

        for agent_id in ids_to_wait:
            result = self.wait_for(agent_id, timeout=timeout)
            if result:
                results[agent_id] = result

        return results

    def cleanup(self, keep_results: bool = True):
        """Clean up completed and cancelled agents."""
        with self._lock:
            completed_ids = [
                agent_id
                for agent_id, agent in self._agents.items()
                if agent.status in (
                    SubagentStatus.COMPLETED,
                    SubagentStatus.FAILED,
                    SubagentStatus.CANCELLED,
                )
            ]

            for agent_id in completed_ids:
                del self._agents[agent_id]
                self._futures.pop(agent_id, None)
                if not keep_results:
                    self._results.pop(agent_id, None)

        logger.info(f"Cleaned up {len(completed_ids)} agents")

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the subagent system."""
        with self._lock:
            status_counts = {}
            for agent in self._agents.values():
                status = agent.status.value
                status_counts[status] = status_counts.get(status, 0) + 1

            completed_results = [
                r for r in self._results.values()
                if r.status == SubagentStatus.COMPLETED
            ]

            avg_time = (
                sum(r.execution_time_ms for r in completed_results) /
                len(completed_results)
                if completed_results
                else 0
            )

            return {
                "total_agents": len(self._agents),
                "total_results": len(self._results),
                "active_agents": self._get_active_count(),
                "max_concurrent": self.config.max_concurrent_agents,
                "status_counts": status_counts,
                "avg_execution_time_ms": avg_time,
                "cline_status": self.cline.status.value,
                "cline_available": self.cline.is_available,
            }

    def _get_active_count(self) -> int:
        """Count currently active agents."""
        return sum(
            1
            for agent in self._agents.values()
            if agent.status in (
                SubagentStatus.INITIALIZING,
                SubagentStatus.RUNNING,
                SubagentStatus.WAITING,
            )
        )

    def shutdown(self):
        """Shutdown the subagent manager."""
        self.cancel_all()
        self._executor.shutdown(wait=False)
        logger.info("SubagentManager shutdown complete")
