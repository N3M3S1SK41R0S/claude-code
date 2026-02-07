"""
Subagent - Individual sub-agent that handles delegated tasks.

Each subagent is a specialized unit that receives a task from the manager,
executes it through the configured backend (Cline CLI or internal workers),
and reports results back.
"""

import time
import uuid
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class SubagentStatus(Enum):
    """Status of a sub-agent."""
    PENDING = "pending"
    INITIALIZING = "initializing"
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class SubagentType(Enum):
    """Types of specialized sub-agents."""
    CODER = "coder"
    RESEARCHER = "researcher"
    REVIEWER = "reviewer"
    PLANNER = "planner"
    DEBUGGER = "debugger"
    TESTER = "tester"
    DOCUMENTER = "documenter"
    GENERAL = "general"


@dataclass
class SubagentResult:
    """Result from a sub-agent execution."""
    agent_id: str
    status: SubagentStatus
    output: str = ""
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    tokens_used: int = 0
    model_used: Optional[str] = None
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def success(self) -> bool:
        return self.status == SubagentStatus.COMPLETED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "status": self.status.value,
            "output": self.output[:2000],
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
            "tokens_used": self.tokens_used,
            "model_used": self.model_used,
            "artifacts_count": len(self.artifacts),
            "metadata": self.metadata,
        }


@dataclass
class SubagentTask:
    """Task assigned to a sub-agent."""
    task_id: str
    description: str
    agent_type: SubagentType = SubagentType.GENERAL
    context: Dict[str, Any] = field(default_factory=dict)
    parent_task_id: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)
    timeout_seconds: float = 300.0
    priority: int = 5  # 1 (highest) to 10 (lowest)
    max_retries: int = 2
    metadata: Dict[str, Any] = field(default_factory=dict)


class Subagent:
    """
    Individual sub-agent that executes delegated tasks.

    A subagent is spawned by the SubagentManager to handle a specific task.
    It operates independently, communicating results back through callbacks
    or the result store.
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        agent_type: SubagentType = SubagentType.GENERAL,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        on_complete: Optional[Callable] = None,
        on_error: Optional[Callable] = None,
    ):
        self.agent_id = agent_id or f"subagent-{uuid.uuid4().hex[:8]}"
        self.agent_type = agent_type
        self.model = model
        self.system_prompt = system_prompt or self._default_system_prompt()
        self.on_complete = on_complete
        self.on_error = on_error

        self.status = SubagentStatus.PENDING
        self.current_task: Optional[SubagentTask] = None
        self.results: List[SubagentResult] = []
        self._lock = threading.Lock()
        self._start_time: Optional[float] = None

    def _default_system_prompt(self) -> str:
        """Generate default system prompt based on agent type."""
        prompts = {
            SubagentType.CODER: (
                "You are a specialized coding agent. Focus on writing clean, "
                "efficient, and well-tested code. Follow best practices and "
                "established patterns in the codebase."
            ),
            SubagentType.RESEARCHER: (
                "You are a research agent. Gather information, analyze data, "
                "and provide comprehensive findings with citations and evidence."
            ),
            SubagentType.REVIEWER: (
                "You are a code review agent. Analyze code for bugs, security "
                "issues, performance problems, and adherence to best practices. "
                "Provide actionable feedback."
            ),
            SubagentType.PLANNER: (
                "You are a planning agent. Break down complex tasks into "
                "manageable steps, identify dependencies, and create actionable "
                "implementation plans."
            ),
            SubagentType.DEBUGGER: (
                "You are a debugging agent. Analyze error messages, trace "
                "execution paths, identify root causes, and suggest fixes."
            ),
            SubagentType.TESTER: (
                "You are a testing agent. Write comprehensive test cases, "
                "identify edge cases, and ensure code coverage."
            ),
            SubagentType.DOCUMENTER: (
                "You are a documentation agent. Write clear, comprehensive "
                "documentation including API docs, guides, and inline comments."
            ),
            SubagentType.GENERAL: (
                "You are a general-purpose agent. Handle the assigned task "
                "to the best of your ability."
            ),
        }
        return prompts.get(self.agent_type, prompts[SubagentType.GENERAL])

    def execute(self, task: SubagentTask, executor_fn: Callable) -> SubagentResult:
        """
        Execute a task using the provided executor function.

        Args:
            task: The task to execute.
            executor_fn: Callable that performs the actual work.
                         Signature: (prompt, system_prompt, model, context) -> str

        Returns:
            SubagentResult with the execution outcome.
        """
        with self._lock:
            self.status = SubagentStatus.INITIALIZING
            self.current_task = task
            self._start_time = time.time()

        logger.info(
            f"Subagent {self.agent_id} ({self.agent_type.value}) "
            f"starting task: {task.description[:80]}..."
        )

        attempt = 0
        last_error = None

        while attempt <= task.max_retries:
            try:
                with self._lock:
                    self.status = SubagentStatus.RUNNING

                output = executor_fn(
                    prompt=task.description,
                    system_prompt=self.system_prompt,
                    model=self.model,
                    context=task.context,
                )

                execution_time = (time.time() - self._start_time) * 1000

                result = SubagentResult(
                    agent_id=self.agent_id,
                    status=SubagentStatus.COMPLETED,
                    output=output,
                    execution_time_ms=execution_time,
                    model_used=self.model,
                    metadata={
                        "agent_type": self.agent_type.value,
                        "task_id": task.task_id,
                        "attempt": attempt + 1,
                    },
                )

                with self._lock:
                    self.status = SubagentStatus.COMPLETED
                    self.results.append(result)

                if self.on_complete:
                    self.on_complete(result)

                logger.info(
                    f"Subagent {self.agent_id} completed in "
                    f"{execution_time:.0f}ms"
                )
                return result

            except Exception as e:
                last_error = str(e)
                attempt += 1
                logger.warning(
                    f"Subagent {self.agent_id} attempt {attempt} failed: {e}"
                )

                if attempt <= task.max_retries:
                    time.sleep(min(2 ** attempt, 30))

        # All retries exhausted
        execution_time = (time.time() - self._start_time) * 1000
        result = SubagentResult(
            agent_id=self.agent_id,
            status=SubagentStatus.FAILED,
            error=last_error,
            execution_time_ms=execution_time,
            metadata={
                "agent_type": self.agent_type.value,
                "task_id": task.task_id,
                "attempts": attempt,
            },
        )

        with self._lock:
            self.status = SubagentStatus.FAILED
            self.results.append(result)

        if self.on_error:
            self.on_error(result)

        logger.error(
            f"Subagent {self.agent_id} failed after {attempt} attempts: "
            f"{last_error}"
        )
        return result

    def cancel(self):
        """Cancel the current task."""
        with self._lock:
            if self.status in (SubagentStatus.RUNNING, SubagentStatus.WAITING):
                self.status = SubagentStatus.CANCELLED
                logger.info(f"Subagent {self.agent_id} cancelled")

    def get_status(self) -> Dict[str, Any]:
        """Get current status of the sub-agent."""
        with self._lock:
            return {
                "agent_id": self.agent_id,
                "type": self.agent_type.value,
                "status": self.status.value,
                "model": self.model,
                "current_task": (
                    self.current_task.description[:100]
                    if self.current_task
                    else None
                ),
                "completed_tasks": len(self.results),
                "uptime_ms": (
                    (time.time() - self._start_time) * 1000
                    if self._start_time
                    else 0
                ),
            }
