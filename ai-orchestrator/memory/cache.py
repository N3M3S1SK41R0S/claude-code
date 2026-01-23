"""
NEMESIS Context Cache - Multi-level LRU cache with TTL support.
Implements L1 (in-memory), L2 (Redis-like), L3 (disk) caching.
"""
import time
import json
import hashlib
import threading
import logging
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable, Union
from pathlib import Path
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """A single cache entry."""
    key: str
    value: Any
    created_at: float = field(default_factory=time.time)
    accessed_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None
    size_bytes: int = 0
    hit_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    @property
    def age_seconds(self) -> float:
        """Age of the entry in seconds."""
        return time.time() - self.created_at

    def touch(self):
        """Update last access time."""
        self.accessed_at = time.time()
        self.hit_count += 1


class CacheLevel:
    """Base class for cache levels."""

    def get(self, key: str) -> Optional[CacheEntry]:
        raise NotImplementedError

    def set(self, key: str, entry: CacheEntry):
        raise NotImplementedError

    def delete(self, key: str) -> bool:
        raise NotImplementedError

    def clear(self):
        raise NotImplementedError

    def stats(self) -> Dict[str, Any]:
        raise NotImplementedError


class L1MemoryCache(CacheLevel):
    """
    L1 Cache - In-memory LRU cache.
    Fastest, limited size, volatile.
    """

    def __init__(self, max_size: int = 1000, max_memory_mb: float = 100):
        self.max_size = max_size
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
        self._current_memory = 0

    def get(self, key: str) -> Optional[CacheEntry]:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            entry = self._cache[key]

            # Check expiration
            if entry.is_expired:
                del self._cache[key]
                self._current_memory -= entry.size_bytes
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.touch()
            self._hits += 1
            return entry

    def set(self, key: str, entry: CacheEntry):
        with self._lock:
            # Remove old entry if exists
            if key in self._cache:
                old_entry = self._cache[key]
                self._current_memory -= old_entry.size_bytes
                del self._cache[key]

            # Estimate size
            entry.size_bytes = len(json.dumps(entry.value, default=str).encode())

            # Evict if necessary
            self._evict_if_needed(entry.size_bytes)

            # Add new entry
            self._cache[key] = entry
            self._current_memory += entry.size_bytes

    def _evict_if_needed(self, needed_bytes: int):
        """Evict entries if cache is full."""
        # Evict by count
        while len(self._cache) >= self.max_size:
            oldest_key = next(iter(self._cache))
            oldest_entry = self._cache[oldest_key]
            self._current_memory -= oldest_entry.size_bytes
            del self._cache[oldest_key]

        # Evict by memory
        while self._current_memory + needed_bytes > self.max_memory_bytes and self._cache:
            oldest_key = next(iter(self._cache))
            oldest_entry = self._cache[oldest_key]
            self._current_memory -= oldest_entry.size_bytes
            del self._cache[oldest_key]

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                self._current_memory -= entry.size_bytes
                del self._cache[key]
                return True
            return False

    def clear(self):
        with self._lock:
            self._cache.clear()
            self._current_memory = 0

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._hits + self._misses
            return {
                "level": "L1",
                "type": "memory",
                "entries": len(self._cache),
                "max_entries": self.max_size,
                "memory_used_mb": self._current_memory / (1024 * 1024),
                "max_memory_mb": self.max_memory_bytes / (1024 * 1024),
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self._hits / total if total > 0 else 0
            }


class L2RedisLikeCache(CacheLevel):
    """
    L2 Cache - Redis-like in-memory store with persistence.
    Medium speed, larger capacity, semi-persistent.
    """

    def __init__(self, max_size: int = 10000, persistence_file: Optional[str] = None):
        self.max_size = max_size
        self.persistence_file = persistence_file
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

        # Load from persistence if available
        if persistence_file:
            self._load_from_disk()

    def _load_from_disk(self):
        """Load cache from disk."""
        if not self.persistence_file:
            return

        path = Path(self.persistence_file)
        if not path.exists():
            return

        try:
            with open(path, 'r') as f:
                data = json.load(f)
                for key, entry_data in data.items():
                    entry = CacheEntry(
                        key=entry_data["key"],
                        value=entry_data["value"],
                        created_at=entry_data["created_at"],
                        accessed_at=entry_data["accessed_at"],
                        expires_at=entry_data.get("expires_at"),
                        hit_count=entry_data.get("hit_count", 0)
                    )
                    if not entry.is_expired:
                        self._cache[key] = entry
            logger.info(f"Loaded {len(self._cache)} entries from L2 cache")
        except Exception as e:
            logger.error(f"Failed to load L2 cache: {e}")

    def _save_to_disk(self):
        """Save cache to disk."""
        if not self.persistence_file:
            return

        try:
            data = {}
            for key, entry in self._cache.items():
                if not entry.is_expired:
                    data[key] = {
                        "key": entry.key,
                        "value": entry.value,
                        "created_at": entry.created_at,
                        "accessed_at": entry.accessed_at,
                        "expires_at": entry.expires_at,
                        "hit_count": entry.hit_count
                    }

            with open(self.persistence_file, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            logger.error(f"Failed to save L2 cache: {e}")

    def get(self, key: str) -> Optional[CacheEntry]:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            entry = self._cache[key]

            if entry.is_expired:
                del self._cache[key]
                self._misses += 1
                return None

            entry.touch()
            self._hits += 1
            return entry

    def set(self, key: str, entry: CacheEntry):
        with self._lock:
            # Simple eviction: remove oldest if full
            if len(self._cache) >= self.max_size and key not in self._cache:
                # Find least recently accessed
                oldest_key = min(self._cache.keys(),
                               key=lambda k: self._cache[k].accessed_at)
                del self._cache[oldest_key]

            self._cache[key] = entry

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self):
        with self._lock:
            self._cache.clear()

    def persist(self):
        """Force persistence to disk."""
        self._save_to_disk()

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._hits + self._misses
            return {
                "level": "L2",
                "type": "redis-like",
                "entries": len(self._cache),
                "max_entries": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self._hits / total if total > 0 else 0,
                "persistence": self.persistence_file is not None
            }


class L3DiskCache(CacheLevel):
    """
    L3 Cache - Disk-based cache.
    Slowest, largest capacity, persistent.
    """

    def __init__(self, cache_dir: str = ".cache/l3", max_size_mb: float = 1000):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
        self._index: Dict[str, Dict[str, Any]] = {}

        # Load index
        self._load_index()

    def _key_to_path(self, key: str) -> Path:
        """Convert key to file path."""
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        return self.cache_dir / f"{key_hash[:2]}" / f"{key_hash}.json"

    def _load_index(self):
        """Load cache index from disk."""
        index_path = self.cache_dir / "index.json"
        if index_path.exists():
            try:
                with open(index_path, 'r') as f:
                    self._index = json.load(f)
            except:
                self._index = {}

    def _save_index(self):
        """Save cache index to disk."""
        index_path = self.cache_dir / "index.json"
        with open(index_path, 'w') as f:
            json.dump(self._index, f)

    def get(self, key: str) -> Optional[CacheEntry]:
        with self._lock:
            if key not in self._index:
                self._misses += 1
                return None

            path = self._key_to_path(key)
            if not path.exists():
                del self._index[key]
                self._misses += 1
                return None

            try:
                with open(path, 'r') as f:
                    data = json.load(f)

                entry = CacheEntry(
                    key=data["key"],
                    value=data["value"],
                    created_at=data["created_at"],
                    accessed_at=data["accessed_at"],
                    expires_at=data.get("expires_at"),
                    size_bytes=data.get("size_bytes", 0),
                    hit_count=data.get("hit_count", 0)
                )

                if entry.is_expired:
                    self.delete(key)
                    self._misses += 1
                    return None

                entry.touch()
                self._hits += 1

                # Update on disk
                data["accessed_at"] = entry.accessed_at
                data["hit_count"] = entry.hit_count
                with open(path, 'w') as f:
                    json.dump(data, f)

                return entry

            except Exception as e:
                logger.error(f"Failed to read L3 cache entry: {e}")
                self._misses += 1
                return None

    def set(self, key: str, entry: CacheEntry):
        with self._lock:
            path = self._key_to_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "key": entry.key,
                "value": entry.value,
                "created_at": entry.created_at,
                "accessed_at": entry.accessed_at,
                "expires_at": entry.expires_at,
                "size_bytes": entry.size_bytes,
                "hit_count": entry.hit_count
            }

            try:
                with open(path, 'w') as f:
                    json.dump(data, f)

                self._index[key] = {
                    "path": str(path),
                    "created_at": entry.created_at,
                    "size_bytes": entry.size_bytes
                }
                self._save_index()

            except Exception as e:
                logger.error(f"Failed to write L3 cache entry: {e}")

    def delete(self, key: str) -> bool:
        with self._lock:
            if key not in self._index:
                return False

            path = self._key_to_path(key)
            try:
                if path.exists():
                    path.unlink()
                del self._index[key]
                self._save_index()
                return True
            except Exception as e:
                logger.error(f"Failed to delete L3 cache entry: {e}")
                return False

    def clear(self):
        with self._lock:
            import shutil
            shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._index.clear()

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._hits + self._misses
            total_size = sum(e.get("size_bytes", 0) for e in self._index.values())
            return {
                "level": "L3",
                "type": "disk",
                "entries": len(self._index),
                "size_mb": total_size / (1024 * 1024),
                "max_size_mb": self.max_size_bytes / (1024 * 1024),
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self._hits / total if total > 0 else 0
            }


class ContextCache:
    """
    Multi-level context cache for NEMESIS.
    L1 (memory) -> L2 (redis-like) -> L3 (disk)
    """

    def __init__(
        self,
        l1_size: int = 1000,
        l1_memory_mb: float = 100,
        l2_size: int = 10000,
        l2_persistence: Optional[str] = None,
        l3_dir: str = ".cache/l3",
        l3_size_mb: float = 1000,
        default_ttl_seconds: float = 3600
    ):
        self.l1 = L1MemoryCache(max_size=l1_size, max_memory_mb=l1_memory_mb)
        self.l2 = L2RedisLikeCache(max_size=l2_size, persistence_file=l2_persistence)
        self.l3 = L3DiskCache(cache_dir=l3_dir, max_size_mb=l3_size_mb)
        self.default_ttl = default_ttl_seconds
        self._lock = threading.RLock()

    def _generate_key(self, *args, **kwargs) -> str:
        """Generate cache key from arguments."""
        content = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache, checking all levels."""
        # Try L1
        entry = self.l1.get(key)
        if entry:
            return entry.value

        # Try L2
        entry = self.l2.get(key)
        if entry:
            # Promote to L1
            self.l1.set(key, entry)
            return entry.value

        # Try L3
        entry = self.l3.get(key)
        if entry:
            # Promote to L1 and L2
            self.l1.set(key, entry)
            self.l2.set(key, entry)
            return entry.value

        return None

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[float] = None,
        levels: List[str] = None
    ):
        """Set value in cache."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        expires_at = time.time() + ttl if ttl > 0 else None

        entry = CacheEntry(
            key=key,
            value=value,
            expires_at=expires_at
        )

        levels = levels or ["l1", "l2", "l3"]

        if "l1" in levels:
            self.l1.set(key, entry)
        if "l2" in levels:
            self.l2.set(key, entry)
        if "l3" in levels:
            self.l3.set(key, entry)

    def delete(self, key: str):
        """Delete from all cache levels."""
        self.l1.delete(key)
        self.l2.delete(key)
        self.l3.delete(key)

    def clear(self, levels: Optional[List[str]] = None):
        """Clear cache levels."""
        levels = levels or ["l1", "l2", "l3"]
        if "l1" in levels:
            self.l1.clear()
        if "l2" in levels:
            self.l2.clear()
        if "l3" in levels:
            self.l3.clear()

    def stats(self) -> Dict[str, Any]:
        """Get stats for all cache levels."""
        return {
            "l1": self.l1.stats(),
            "l2": self.l2.stats(),
            "l3": self.l3.stats()
        }

    def cached(self, ttl_seconds: Optional[float] = None, key_prefix: str = ""):
        """Decorator for caching function results."""
        def decorator(func: Callable):
            def wrapper(*args, **kwargs):
                # Generate cache key
                key = key_prefix + self._generate_key(func.__name__, args, kwargs)

                # Try cache
                result = self.get(key)
                if result is not None:
                    return result

                # Execute function
                result = func(*args, **kwargs)

                # Cache result
                self.set(key, result, ttl_seconds)

                return result
            return wrapper
        return decorator

    @contextmanager
    def request_cache(self, request_id: str):
        """Context manager for request-scoped caching."""
        prefix = f"req:{request_id}:"
        try:
            yield lambda key, value, ttl=60: self.set(prefix + key, value, ttl, ["l1"])
        finally:
            # Clean up request-specific cache entries from L1
            # (In production, would track keys and delete them)
            pass

    def warm_up(self, keys: List[str]):
        """Pre-warm cache by promoting entries from lower levels."""
        for key in keys:
            entry = self.l3.get(key)
            if entry:
                self.l2.set(key, entry)
                self.l1.set(key, entry)
            else:
                entry = self.l2.get(key)
                if entry:
                    self.l1.set(key, entry)

    def persist(self):
        """Force persistence of L2 cache."""
        self.l2.persist()
