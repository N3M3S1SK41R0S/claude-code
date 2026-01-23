"""
Base AI Worker class for API interactions.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any, Callable
import json

logger = logging.getLogger('AI-Worker')


class WorkerStatus(Enum):
    IDLE = "idle"
    WORKING = "working"
    COMPLETED = "completed"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"


@dataclass
class WorkerResponse:
    """Response from an AI worker."""
    content: str
    model: str
    tokens_used: int = 0
    latency_ms: float = 0
    status: WorkerStatus = WorkerStatus.COMPLETED
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class WorkerTask:
    """Task for an AI worker."""
    id: str
    prompt: str
    system_prompt: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    context: List[Dict] = field(default_factory=list)
    callbacks: List[Callable] = field(default_factory=list)


class AIWorker(ABC):
    """Abstract base class for AI workers."""

    def __init__(self, api_key: Optional[str] = None, config: Dict = None):
        self.api_key = api_key
        self.config = config or {}
        self.status = WorkerStatus.IDLE
        self.name = "BaseWorker"
        self.model = "unknown"
        self.max_tokens = 4096
        self.retry_attempts = 3
        self.retry_delay = 2.0

    @abstractmethod
    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to the AI service."""
        pass

    @abstractmethod
    async def check_availability(self) -> bool:
        """Check if the AI service is available."""
        pass

    async def execute_with_retry(self, task: WorkerTask) -> WorkerResponse:
        """Execute task with automatic retry on failure."""
        last_error = None

        for attempt in range(self.retry_attempts):
            try:
                self.status = WorkerStatus.WORKING
                response = await self.send_message(task)
                self.status = WorkerStatus.COMPLETED
                return response
            except Exception as e:
                last_error = e
                logger.warning(
                    f"{self.name} attempt {attempt + 1} failed: {e}"
                )
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))

        self.status = WorkerStatus.FAILED
        return WorkerResponse(
            content=f"[ERROR] Failed after {self.retry_attempts} attempts: {last_error}",
            model=self.model,
            status=WorkerStatus.FAILED
        )

    def simulate_response(self, task: WorkerTask) -> WorkerResponse:
        """Generate a simulated response when service is unavailable."""
        simulated_content = f"""[SIMULATED RESPONSE - {self.name} unavailable]

Based on the prompt analysis, a typical response might include:

1. **Acknowledgment**: Understanding of the request
2. **Analysis**: Key points from the prompt
3. **Suggestions**: Possible approaches or solutions
4. **Caveats**: Limitations or considerations

Original prompt summary: {task.prompt[:200]}...

Note: This is a simulated response to prevent workflow blocking.
Please verify with the actual service when available."""

        return WorkerResponse(
            content=simulated_content,
            model=f"{self.model}_simulated",
            status=WorkerStatus.UNAVAILABLE,
            metadata={'simulated': True}
        )

    def format_context(self, context: List[Dict]) -> str:
        """Format conversation context for the prompt."""
        formatted = []
        for msg in context:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            formatted.append(f"[{role.upper()}]: {content}")
        return "\n\n".join(formatted)

    def truncate_to_token_limit(self, text: str, max_chars: int = None) -> str:
        """Truncate text to approximate token limit."""
        if max_chars is None:
            max_chars = self.max_tokens * 4  # Rough approximation

        if len(text) <= max_chars:
            return text

        return text[:max_chars - 50] + "\n\n[Content truncated for token limit]"


class WorkerPool:
    """Pool of AI workers for parallel execution."""

    def __init__(self):
        self.workers: Dict[str, AIWorker] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.results: Dict[str, WorkerResponse] = {}

    def register_worker(self, name: str, worker: AIWorker):
        """Register a worker in the pool."""
        self.workers[name] = worker
        logger.info(f"Registered worker: {name}")

    def get_available_workers(self) -> List[str]:
        """Get list of available workers."""
        return [
            name for name, worker in self.workers.items()
            if worker.status != WorkerStatus.UNAVAILABLE
        ]

    async def execute_parallel(self, task: WorkerTask,
                               worker_names: List[str] = None) -> Dict[str, WorkerResponse]:
        """Execute a task across multiple workers in parallel."""
        if worker_names is None:
            worker_names = list(self.workers.keys())

        tasks = []
        for name in worker_names:
            if name in self.workers:
                worker = self.workers[name]
                tasks.append(self._execute_worker(name, worker, task))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        responses = {}
        for name, result in zip(worker_names, results):
            if isinstance(result, Exception):
                responses[name] = WorkerResponse(
                    content=f"[ERROR] {result}",
                    model=self.workers[name].model if name in self.workers else "unknown",
                    status=WorkerStatus.FAILED
                )
            else:
                responses[name] = result

        return responses

    async def _execute_worker(self, name: str, worker: AIWorker,
                              task: WorkerTask) -> WorkerResponse:
        """Execute a single worker."""
        try:
            available = await worker.check_availability()
            if not available:
                logger.warning(f"{name} unavailable, simulating response")
                return worker.simulate_response(task)
            return await worker.execute_with_retry(task)
        except Exception as e:
            logger.error(f"Worker {name} failed: {e}")
            return worker.simulate_response(task)
