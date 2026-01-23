#!/usr/bin/env python3
"""
Unit tests for AI Worker improvements (Round 4).
Tests availability caching, exponential backoff, and concurrency limiting.
"""

import asyncio
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from workers.base import (
    AvailabilityCache, AIWorker, WorkerPool, WorkerTask, WorkerResponse,
    WorkerStatus, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_BASE_DELAY,
    AVAILABILITY_CACHE_TTL, DEFAULT_MAX_CONCURRENT_REQUESTS
)


class TestAvailabilityCache(unittest.TestCase):
    """Tests for AvailabilityCache class."""

    def test_cache_set_and_get(self):
        """Test basic cache operations."""
        cache = AvailabilityCache(ttl_seconds=60)

        cache.set("test_worker", True)
        self.assertTrue(cache.get("test_worker"))

        cache.set("test_worker2", False)
        self.assertFalse(cache.get("test_worker2"))

    def test_cache_miss(self):
        """Test cache miss returns None."""
        cache = AvailabilityCache()
        self.assertIsNone(cache.get("nonexistent"))

    def test_cache_expiration(self):
        """Test cache entries expire after TTL."""
        cache = AvailabilityCache(ttl_seconds=0.1)  # 100ms TTL

        cache.set("test", True)
        self.assertTrue(cache.get("test"))

        time.sleep(0.15)  # Wait for expiration
        self.assertIsNone(cache.get("test"))

    def test_cache_invalidate(self):
        """Test cache invalidation."""
        cache = AvailabilityCache()

        cache.set("test", True)
        self.assertTrue(cache.get("test"))

        cache.invalidate("test")
        self.assertIsNone(cache.get("test"))

    def test_cache_clear(self):
        """Test clearing entire cache."""
        cache = AvailabilityCache()

        cache.set("test1", True)
        cache.set("test2", False)

        cache.clear()

        self.assertIsNone(cache.get("test1"))
        self.assertIsNone(cache.get("test2"))


class MockWorker(AIWorker):
    """Mock worker for testing."""

    def __init__(self, should_fail=False, fail_count=0):
        super().__init__()
        self.name = "MockWorker"
        self.model = "mock-model"
        self.should_fail = should_fail
        self.fail_count = fail_count
        self.call_count = 0
        self.is_available = True

    async def send_message(self, task):
        self.call_count += 1
        if self.should_fail and self.call_count <= self.fail_count:
            raise Exception("Simulated failure")
        return WorkerResponse(
            content="Mock response",
            model=self.model,
            status=WorkerStatus.COMPLETED
        )

    async def check_availability(self):
        return self.is_available


class TestExponentialBackoff(unittest.TestCase):
    """Tests for exponential backoff retry logic."""

    def test_backoff_calculation(self):
        """Test backoff delay increases exponentially."""
        worker = MockWorker()

        delay0 = worker._calculate_backoff_delay(0)
        delay1 = worker._calculate_backoff_delay(1)
        delay2 = worker._calculate_backoff_delay(2)

        # Each delay should roughly double (within jitter range)
        self.assertLess(delay0, delay1)
        self.assertLess(delay1, delay2)

    def test_backoff_max_cap(self):
        """Test backoff is capped at max delay."""
        worker = MockWorker()
        worker.retry_max_delay = 10.0

        delay = worker._calculate_backoff_delay(100)  # Very high attempt
        self.assertLessEqual(delay, 10.0 * 1.1)  # Allow for jitter

    def test_backoff_minimum(self):
        """Test backoff has minimum delay."""
        worker = MockWorker()

        delay = worker._calculate_backoff_delay(0)
        self.assertGreaterEqual(delay, 0.1)  # Minimum 100ms

    def test_retry_on_failure(self):
        """Test retry with exponential backoff on failure."""
        worker = MockWorker(should_fail=True, fail_count=2)
        worker.retry_attempts = 3
        worker.retry_base_delay = 0.01  # Fast for testing

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        response = loop.run_until_complete(worker.execute_with_retry(task))

        # Should succeed after 2 failures (on 3rd attempt)
        self.assertEqual(response.status, WorkerStatus.COMPLETED)
        self.assertEqual(worker.call_count, 3)

    def test_retry_exhaustion(self):
        """Test returns error after exhausting retries."""
        worker = MockWorker(should_fail=True, fail_count=10)
        worker.retry_attempts = 3
        worker.retry_base_delay = 0.01

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        response = loop.run_until_complete(worker.execute_with_retry(task))

        self.assertEqual(response.status, WorkerStatus.FAILED)
        self.assertEqual(worker.call_count, 3)


class TestWorkerPool(unittest.TestCase):
    """Tests for WorkerPool concurrency limiting."""

    def test_pool_registration(self):
        """Test worker registration."""
        pool = WorkerPool()
        worker = MockWorker()

        pool.register_worker("test", worker)

        self.assertIn("test", pool.workers)
        self.assertEqual(pool.workers["test"], worker)

    def test_get_available_workers(self):
        """Test getting available workers."""
        pool = WorkerPool()

        worker1 = MockWorker()
        worker2 = MockWorker()
        worker2.status = WorkerStatus.UNAVAILABLE

        pool.register_worker("worker1", worker1)
        pool.register_worker("worker2", worker2)

        available = pool.get_available_workers()

        self.assertIn("worker1", available)
        self.assertNotIn("worker2", available)

    def test_parallel_execution(self):
        """Test parallel execution with multiple workers."""
        pool = WorkerPool(max_concurrent=5)

        for i in range(3):
            pool.register_worker(f"worker{i}", MockWorker())

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        responses = loop.run_until_complete(pool.execute_parallel(task))

        self.assertEqual(len(responses), 3)
        for name, response in responses.items():
            self.assertEqual(response.status, WorkerStatus.COMPLETED)

    def test_concurrency_limiting(self):
        """Test that semaphore limits concurrent executions."""
        pool = WorkerPool(max_concurrent=2)

        # Track concurrent executions
        concurrent_count = 0
        max_concurrent = 0
        lock = asyncio.Lock()

        class SlowWorker(MockWorker):
            async def send_message(self, task):
                nonlocal concurrent_count, max_concurrent
                async with lock:
                    concurrent_count += 1
                    max_concurrent = max(max_concurrent, concurrent_count)

                await asyncio.sleep(0.1)  # Simulate work

                async with lock:
                    concurrent_count -= 1

                return await super().send_message(task)

        for i in range(5):
            pool.register_worker(f"worker{i}", SlowWorker())

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        loop.run_until_complete(pool.execute_parallel(task))

        # Max concurrent should not exceed semaphore limit
        self.assertLessEqual(max_concurrent, 2)

    def test_timeout_handling(self):
        """Test timeout handling in parallel execution."""
        pool = WorkerPool()

        class SlowWorker(MockWorker):
            async def send_message(self, task):
                await asyncio.sleep(10)  # Very slow
                return await super().send_message(task)

        pool.register_worker("slow", SlowWorker())

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        responses = loop.run_until_complete(
            pool.execute_parallel(task, timeout=0.1)
        )

        # Should return error due to timeout
        self.assertEqual(responses["slow"].status, WorkerStatus.FAILED)


class TestWorkerAvailabilityCaching(unittest.TestCase):
    """Tests for worker availability caching integration."""

    def test_availability_cache_used(self):
        """Test that availability cache is used."""
        worker = MockWorker()
        worker._availability_cache.set(worker.name, True)

        # Should use cached value
        cached = worker._availability_cache.get(worker.name)
        self.assertTrue(cached)

    def test_availability_invalidated_on_failure(self):
        """Test cache invalidation on failure."""
        worker = MockWorker(should_fail=True, fail_count=10)
        worker.retry_attempts = 1
        worker.retry_base_delay = 0.01
        worker._availability_cache.set(worker.name, True)

        loop = asyncio.get_event_loop()
        task = WorkerTask(id="test", prompt="test prompt")

        loop.run_until_complete(worker.execute_with_retry(task))

        # Cache should be invalidated
        self.assertIsNone(worker._availability_cache.get(worker.name))


def run_tests():
    """Run all worker tests."""
    print("="*60)
    print("         AI WORKER UNIT TESTS (ROUND 4)")
    print("="*60)
    print()

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestAvailabilityCache))
    suite.addTests(loader.loadTestsFromTestCase(TestExponentialBackoff))
    suite.addTests(loader.loadTestsFromTestCase(TestWorkerPool))
    suite.addTests(loader.loadTestsFromTestCase(TestWorkerAvailabilityCaching))

    # Run with verbosity
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print()
    print("="*60)
    print("                    SUMMARY")
    print("="*60)
    print(f"  Tests Run: {result.testsRun}")
    print(f"  Failures: {len(result.failures)}")
    print(f"  Errors: {len(result.errors)}")
    print(f"  Success Rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")

    return len(result.failures) == 0 and len(result.errors) == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
