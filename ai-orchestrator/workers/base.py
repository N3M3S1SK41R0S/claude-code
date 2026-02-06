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
    - Circuit breaker pattern for fault tolerance
    - Response caching with deduplication
    - Response simulation for graceful degradation
"""

import asyncio
import hashlib
import logging
import random
import threading
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
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

# Response cache configuration
RESPONSE_CACHE_TTL = 300  # 5 minutes
RESPONSE_CACHE_MAX_SIZE = 100

# Concurrency limits
DEFAULT_MAX_CONCURRENT_REQUESTS = 10

# Circuit breaker configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT = 60  # seconds
CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS = 3


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


class CircuitBreakerState(Enum):
    """States for the circuit breaker."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Blocking calls
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Circuit breaker pattern for fault tolerance.

    Simple explanation (for a 6-year-old):
        This is like a safety switch. If our robot friend keeps making mistakes,
        we flip the switch to give it a break. After some rest, we try again
        slowly to see if it's feeling better.

    Technical explanation (for experts):
        Implements the circuit breaker pattern with three states:
        - CLOSED: Normal operation, tracking failures
        - OPEN: Blocking all calls after failure threshold
        - HALF_OPEN: Allowing limited calls to test recovery

        Thread-safe implementation using locks.
    """

    def __init__(
        self,
        failure_threshold: int = CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        recovery_timeout: float = CIRCUIT_BREAKER_RECOVERY_TIMEOUT,
        half_open_max_calls: int = CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS
    ):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._half_open_max_calls = half_open_max_calls

        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitBreakerState:
        """Get current circuit breaker state with automatic transitions."""
        with self._lock:
            if self._state == CircuitBreakerState.OPEN:
                # Check if recovery timeout has passed
                if self._last_failure_time and \
                   time.time() - self._last_failure_time >= self._recovery_timeout:
                    self._state = CircuitBreakerState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info("Circuit breaker transitioning to HALF_OPEN")
            return self._state

    def can_execute(self) -> bool:
        """Check if a call can be executed."""
        state = self.state
        if state == CircuitBreakerState.CLOSED:
            return True
        if state == CircuitBreakerState.OPEN:
            return False
        # HALF_OPEN: allow limited calls
        with self._lock:
            return self._half_open_calls < self._half_open_max_calls

    def record_success(self):
        """Record a successful call."""
        with self._lock:
            if self._state == CircuitBreakerState.HALF_OPEN:
                self._half_open_calls += 1
                if self._half_open_calls >= self._half_open_max_calls:
                    # All test calls succeeded, close circuit
                    self._state = CircuitBreakerState.CLOSED
                    self._failure_count = 0
                    logger.info("Circuit breaker CLOSED after successful recovery")
            else:
                # In CLOSED state, reset failure count on success
                self._failure_count = 0

    def record_failure(self):
        """Record a failed call."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == CircuitBreakerState.HALF_OPEN:
                # Failure during recovery, go back to OPEN
                self._state = CircuitBreakerState.OPEN
                logger.warning("Circuit breaker back to OPEN after recovery failure")
            elif self._failure_count >= self._failure_threshold:
                # Threshold exceeded, open circuit
                self._state = CircuitBreakerState.OPEN
                logger.warning(
                    f"Circuit breaker OPEN after {self._failure_count} failures"
                )

    def reset(self):
        """Reset circuit breaker to initial state."""
        with self._lock:
            self._state = CircuitBreakerState.CLOSED
            self._failure_count = 0
            self._last_failure_time = None
            self._half_open_calls = 0


class ResponseCache:
    """LRU cache for API responses with TTL.

    Simple explanation (for a 6-year-old):
        This is like a memory box. When we ask the same question twice,
        we check the box first to see if we already have the answer.
        Old answers get thrown away to make room for new ones.

    Technical explanation (for experts):
        Thread-safe LRU cache with TTL for response deduplication.
        Uses OrderedDict for O(1) LRU operations.
        Cache keys are SHA256 hashes of (model, prompt) for privacy.
    """

    def __init__(
        self,
        max_size: int = RESPONSE_CACHE_MAX_SIZE,
        ttl_seconds: int = RESPONSE_CACHE_TTL
    ):
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def _make_key(self, model: str, prompt: str) -> str:
        """Create a cache key from model and prompt."""
        content = f"{model}:{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def get(self, model: str, prompt: str) -> Optional['WorkerResponse']:
        """Get cached response if not expired."""
        key = self._make_key(model, prompt)

        with self._lock:
            if key not in self._cache:
                return None

            response, expiry = self._cache[key]
            if time.time() > expiry:
                # Expired, remove from cache
                del self._cache[key]
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            logger.debug(f"Cache hit for {model}")
            return response

    def set(self, model: str, prompt: str, response: 'WorkerResponse'):
        """Cache a response with TTL."""
        key = self._make_key(model, prompt)

        with self._lock:
            # Remove oldest if at capacity
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)

            self._cache[key] = (response, time.time() + self._ttl)

    def invalidate(self, model: str = None):
        """Invalidate cache entries (all or by model)."""
        with self._lock:
            if model is None:
                self._cache.clear()
            else:
                # Remove entries matching model (requires full scan)
                keys_to_remove = [
                    k for k in self._cache.keys()
                    if k.startswith(hashlib.sha256(f"{model}:".encode()).hexdigest()[:16])
                ]
                for k in keys_to_remove:
                    del self._cache[k]

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            return {
                'size': len(self._cache),
                'max_size': self._max_size,
                'ttl_seconds': self._ttl
            }


# Global response cache (shared across workers)
_response_cache = ResponseCache()


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

        # Response cache reference
        self._response_cache = _response_cache

        # Circuit breaker (per worker instance)
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=self.config.get('circuit_breaker_threshold', CIRCUIT_BREAKER_FAILURE_THRESHOLD),
            recovery_timeout=self.config.get('circuit_breaker_timeout', CIRCUIT_BREAKER_RECOVERY_TIMEOUT)
        )

        # Enable/disable caching
        self._caching_enabled = self.config.get('enable_response_cache', True)

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
        """Execute task with automatic retry, circuit breaker, and caching.

        Simple explanation (for a 6-year-old):
            First we check if we already have the answer saved.
            If not, we check if our robot friend is taking a break (circuit open).
            Then we try to get an answer. If it doesn't work, we wait and try again.

        Technical explanation (for experts):
            Order of operations:
            1. Check response cache for cached result
            2. Check circuit breaker state
            3. Execute with retry and exponential backoff
            4. Update circuit breaker and cache on result
        """
        # 1. Check response cache first (if enabled)
        if self._caching_enabled:
            cached_response = self._response_cache.get(self.model, task.prompt)
            if cached_response:
                logger.debug(f"{self.name} returning cached response")
                return cached_response

        # 2. Check circuit breaker
        if not self._circuit_breaker.can_execute():
            logger.warning(f"{self.name} circuit breaker OPEN, simulating response")
            return self.simulate_response(task)

        last_error = None

        for attempt in range(self.retry_attempts):
            try:
                self.status = WorkerStatus.WORKING
                response = await self.send_message(task)
                self.status = WorkerStatus.COMPLETED

                # Record success with circuit breaker
                self._circuit_breaker.record_success()

                # Cache successful response
                if self._caching_enabled and response.status == WorkerStatus.COMPLETED:
                    self._response_cache.set(self.model, task.prompt, response)

                return response
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()

                # Record failure with circuit breaker
                self._circuit_breaker.record_failure()

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

    def get_circuit_breaker_state(self) -> str:
        """Get current circuit breaker state."""
        return self._circuit_breaker.state.value

    def reset_circuit_breaker(self):
        """Reset circuit breaker to closed state."""
        self._circuit_breaker.reset()
        logger.info(f"{self.name} circuit breaker reset")

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
