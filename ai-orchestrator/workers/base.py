"""
Base AI Worker class for API interactions.

SIMPLE EXPLANATION (for a 6-year-old):
    This is like the blueprint for building robot helpers.
    Each robot helper (worker) knows how to talk to a different AI friend.
    They all follow the same rules: ask questions, wait for answers, and
    remember if their AI friend is home (available) or not.

TECHNICAL EXPLANATION (for experts):
    Abstract base class implementing:
    - Exponential backoff retry with jitter for resilience
    - TTL-based availability caching to reduce API calls
    - Semaphore-based concurrency limiting
    - Response simulation for graceful degradation
"""

import asyncio
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any, Callable
import json

logger = logging.getLogger('AI-Worker')

# =============================================================================
# CONSTANTS
# =============================================================================

# Retry configuration
DEFAULT_RETRY_ATTEMPTS = 3
DEFAULT_RETRY_BASE_DELAY = 1.0  # seconds
DEFAULT_RETRY_MAX_DELAY = 30.0  # seconds
RETRY_JITTER_FACTOR = 0.1  # 10% random jitter

# Availability cache TTL (seconds)
AVAILABILITY_CACHE_TTL = 60

# Concurrency limits
DEFAULT_MAX_CONCURRENT_REQUESTS = 10


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


class AvailabilityCache:
    """Cache for API availability status with TTL.

    Simple explanation (for a 6-year-old):
        This is like a sticky note that remembers if our AI friend was home.
        After some time (TTL), we throw away the note and check again.

    Technical explanation (for experts):
        Thread-safe TTL cache for availability checks to reduce
        unnecessary API calls. Uses time-based expiration.
    """

    def __init__(self, ttl_seconds: int = AVAILABILITY_CACHE_TTL):
        self._cache: Dict[str, tuple] = {}  # {key: (value, expiry_time)}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[bool]:
        """Get cached availability status if not expired."""
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                return value
            # Expired, remove from cache
            del self._cache[key]
        return None

    def set(self, key: str, value: bool):
        """Cache availability status with TTL."""
        self._cache[key] = (value, time.time() + self._ttl)

    def invalidate(self, key: str):
        """Invalidate a specific cache entry."""
        self._cache.pop(key, None)

    def clear(self):
        """Clear all cached entries."""
        self._cache.clear()


# Global availability cache (shared across workers)
_availability_cache = AvailabilityCache()


class AIWorker(ABC):
    """Abstract base class for AI workers.

    Simple explanation (for a 6-year-old):
        This is the instruction manual for building robot helpers.
        All helpers know how to send messages, check if their AI friend
        is available, and try again if something goes wrong.

    Technical explanation (for experts):
        Implements exponential backoff with jitter, availability caching,
        and graceful degradation through response simulation.
    """

    def __init__(self, api_key: Optional[str] = None, config: Dict = None):
        self.api_key = api_key
        self.config = config or {}
        self.status = WorkerStatus.IDLE
        self.name = "BaseWorker"
        self.model = "unknown"
        self.max_tokens = 4096

        # Retry configuration with exponential backoff
        self.retry_attempts = self.config.get('retry_attempts', DEFAULT_RETRY_ATTEMPTS)
        self.retry_base_delay = self.config.get('retry_base_delay', DEFAULT_RETRY_BASE_DELAY)
        self.retry_max_delay = self.config.get('retry_max_delay', DEFAULT_RETRY_MAX_DELAY)

        # Availability cache reference
        self._availability_cache = _availability_cache

    @abstractmethod
    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to the AI service."""
        pass

    @abstractmethod
    async def check_availability(self) -> bool:
        """Check if the AI service is available."""
        pass

    def _calculate_backoff_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter.

        Simple explanation (for a 6-year-old):
            When something doesn't work, we wait a little bit before trying again.
            Each time, we wait a bit longer, plus a tiny random amount so
            everyone doesn't try at exactly the same time.

        Technical explanation (for experts):
            Implements exponential backoff: delay = base * 2^attempt
            Adds jitter (±10%) to prevent thundering herd problem.
            Caps at max_delay to prevent excessive waits.
        """
        # Exponential backoff: base * 2^attempt
        delay = self.retry_base_delay * (2 ** attempt)

        # Cap at max delay
        delay = min(delay, self.retry_max_delay)

        # Add jitter (±10%)
        jitter = delay * RETRY_JITTER_FACTOR * (2 * random.random() - 1)
        delay += jitter

        return max(0.1, delay)  # Minimum 100ms delay

    async def execute_with_retry(self, task: WorkerTask) -> WorkerResponse:
        """Execute task with automatic retry using exponential backoff.

        Simple explanation (for a 6-year-old):
            We try to get an answer. If it doesn't work, we wait and try again.
            Each time we wait a bit longer. After a few tries, we give up.

        Technical explanation (for experts):
            Implements retry with exponential backoff + jitter.
            Categorizes errors as retryable vs. non-retryable.
            Returns error response after exhausting retries.
        """
        last_error = None

        for attempt in range(self.retry_attempts):
            try:
                self.status = WorkerStatus.WORKING
                response = await self.send_message(task)
                self.status = WorkerStatus.COMPLETED
                return response
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()

                # Check if error is retryable
                non_retryable = ['invalid_api_key', 'authentication', 'unauthorized', 'forbidden']
                if any(err in error_msg for err in non_retryable):
                    logger.error(f"{self.name} non-retryable error: {e}")
                    break

                logger.warning(
                    f"{self.name} attempt {attempt + 1}/{self.retry_attempts} failed: {e}"
                )

                if attempt < self.retry_attempts - 1:
                    delay = self._calculate_backoff_delay(attempt)
                    logger.debug(f"{self.name} retrying in {delay:.2f}s")
                    await asyncio.sleep(delay)

        self.status = WorkerStatus.FAILED
        # Invalidate availability cache on failure
        self._availability_cache.invalidate(self.name)

        return WorkerResponse(
            content=f"[ERROR] Failed after {self.retry_attempts} attempts: {last_error}",
            model=self.model,
            status=WorkerStatus.FAILED,
            metadata={'error': str(last_error), 'attempts': self.retry_attempts}
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
    """Pool of AI workers for parallel execution with concurrency limiting.

    Simple explanation (for a 6-year-old):
        This is like a team of robot helpers. We can send the same question
        to all of them at once! But we make sure not too many robots work
        at the same time, so nobody gets tired.

    Technical explanation (for experts):
        Manages a pool of AIWorker instances with:
        - Semaphore-based concurrency limiting
        - Parallel task execution with asyncio.gather
        - Automatic fallback to simulation on failure
    """

    def __init__(self, max_concurrent: int = DEFAULT_MAX_CONCURRENT_REQUESTS):
        self.workers: Dict[str, AIWorker] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.results: Dict[str, WorkerResponse] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_concurrent = max_concurrent

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
                               worker_names: List[str] = None,
                               timeout: float = 60.0) -> Dict[str, WorkerResponse]:
        """Execute a task across multiple workers in parallel with concurrency limits.

        Args:
            task: The task to execute
            worker_names: List of worker names to use (default: all)
            timeout: Maximum time to wait for all workers (seconds)

        Returns:
            Dict mapping worker names to their responses
        """
        if worker_names is None:
            worker_names = list(self.workers.keys())

        # Filter to only existing workers
        valid_names = [n for n in worker_names if n in self.workers]
        if not valid_names:
            logger.warning("No valid workers to execute")
            return {}

        tasks = []
        for name in valid_names:
            worker = self.workers[name]
            tasks.append(self._execute_worker_with_semaphore(name, worker, task))

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"Parallel execution timed out after {timeout}s")
            results = [asyncio.TimeoutError(f"Timeout after {timeout}s")] * len(valid_names)

        responses = {}
        for name, result in zip(valid_names, results):
            if isinstance(result, Exception):
                responses[name] = WorkerResponse(
                    content=f"[ERROR] {result}",
                    model=self.workers[name].model if name in self.workers else "unknown",
                    status=WorkerStatus.FAILED,
                    metadata={'error': str(result)}
                )
            else:
                responses[name] = result

        return responses

    async def _execute_worker_with_semaphore(self, name: str, worker: AIWorker,
                                              task: WorkerTask) -> WorkerResponse:
        """Execute a single worker with semaphore-based concurrency limiting."""
        async with self._semaphore:
            return await self._execute_worker(name, worker, task)

    async def _execute_worker(self, name: str, worker: AIWorker,
                              task: WorkerTask) -> WorkerResponse:
        """Execute a single worker with availability caching."""
        try:
            # Check cached availability first
            cached_available = worker._availability_cache.get(name)
            if cached_available is not None:
                available = cached_available
                logger.debug(f"{name} availability from cache: {available}")
            else:
                available = await worker.check_availability()
                worker._availability_cache.set(name, available)
                logger.debug(f"{name} availability checked: {available}")

            if not available:
                logger.warning(f"{name} unavailable, simulating response")
                return worker.simulate_response(task)

            return await worker.execute_with_retry(task)
        except Exception as e:
            logger.error(f"Worker {name} failed: {e}")
            # Invalidate cache on unexpected failure
            worker._availability_cache.invalidate(name)
            return worker.simulate_response(task)
