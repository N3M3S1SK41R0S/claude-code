"""
NEMESIS Long-Term Memory - Secure, persistent memory with TTL and encryption.
Implements hierarchical memory storage with automatic cleanup and access control.
"""
import os
import json
import time
import sqlite3
import hashlib
import threading
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from contextlib import contextmanager

# Optional encryption support
try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    import base64
    ENCRYPTION_AVAILABLE = True
except ImportError:
    ENCRYPTION_AVAILABLE = False

logger = logging.getLogger(__name__)


class MemoryType(Enum):
    """Types of memory entries."""
    FACT = "fact"               # Factual information
    PREFERENCE = "preference"   # User preferences
    CONTEXT = "context"         # Conversation context
    LEARNED = "learned"         # Learned patterns
    DECISION = "decision"       # Past decisions
    FEEDBACK = "feedback"       # User feedback
    SYSTEM = "system"           # System state


class AccessLevel(Enum):
    """Access levels for memory entries."""
    PUBLIC = "public"       # Accessible by all agents
    INTERNAL = "internal"   # Accessible by NEMESIS agents only
    PRIVATE = "private"     # Accessible only by owner agent
    ENCRYPTED = "encrypted" # Encrypted, requires key


@dataclass
class MemoryEntry:
    """A single memory entry."""
    id: str
    content: Any
    memory_type: MemoryType
    access_level: AccessLevel = AccessLevel.INTERNAL
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None  # TTL support
    owner_agent: str = "system"
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    access_count: int = 0
    importance: float = 0.5  # 0-1 importance score

    @property
    def is_expired(self) -> bool:
        """Check if memory has expired."""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    @property
    def age_hours(self) -> float:
        """Age of the memory in hours."""
        return (time.time() - self.created_at) / 3600

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "memory_type": self.memory_type.value,
            "access_level": self.access_level.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "expires_at": self.expires_at,
            "owner_agent": self.owner_agent,
            "tags": self.tags,
            "metadata": self.metadata,
            "access_count": self.access_count,
            "importance": self.importance
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryEntry":
        return cls(
            id=data["id"],
            content=data["content"],
            memory_type=MemoryType(data["memory_type"]),
            access_level=AccessLevel(data.get("access_level", "internal")),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            expires_at=data.get("expires_at"),
            owner_agent=data.get("owner_agent", "system"),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            access_count=data.get("access_count", 0),
            importance=data.get("importance", 0.5)
        )


class MemoryEncryption:
    """Handles encryption/decryption of sensitive memories."""

    def __init__(self, password: Optional[str] = None):
        if not ENCRYPTION_AVAILABLE:
            logger.warning("Cryptography library not available. Encryption disabled.")
            self._cipher = None
            return

        # Use environment variable or provided password
        password = password or os.environ.get("NEMESIS_MEMORY_KEY", "default-dev-key")

        # Derive key from password
        salt = b"nemesis_memory_salt"  # In production, use random salt stored separately
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self._cipher = Fernet(key)

    def encrypt(self, data: str) -> str:
        """Encrypt data."""
        if not self._cipher:
            return data
        return self._cipher.encrypt(data.encode()).decode()

    def decrypt(self, data: str) -> str:
        """Decrypt data."""
        if not self._cipher:
            return data
        return self._cipher.decrypt(data.encode()).decode()


class LongTermMemory:
    """
    Secure long-term memory storage for NEMESIS.
    Features: TTL, encryption, access control, automatic cleanup.
    """

    def __init__(
        self,
        db_path: str = "nemesis_memory.db",
        encryption_password: Optional[str] = None,
        default_ttl_hours: float = 24 * 30,  # 30 days default
        cleanup_interval_hours: float = 1.0
    ):
        self.db_path = db_path
        self.default_ttl_hours = default_ttl_hours
        self.cleanup_interval = cleanup_interval_hours * 3600

        self._encryption = MemoryEncryption(encryption_password)
        self._lock = threading.RLock()
        self._last_cleanup = 0.0
        self._persistent_conn = None

        # For in-memory databases, keep a persistent connection
        if db_path == ":memory:":
            self._persistent_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._persistent_conn.row_factory = sqlite3.Row

        # Initialize database
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with WAL mode."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    access_level TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL,
                    owner_agent TEXT NOT NULL,
                    tags TEXT,
                    metadata TEXT,
                    access_count INTEGER DEFAULT 0,
                    importance REAL DEFAULT 0.5,
                    content_hash TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_memory_type ON memories(memory_type)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_owner ON memories(owner_agent)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_expires ON memories(expires_at)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance)
            """)
            # Enable WAL mode for better concurrency
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.commit()

    @contextmanager
    def _get_connection(self):
        """Get a database connection."""
        if self._persistent_conn is not None:
            yield self._persistent_conn
        else:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
            finally:
                conn.close()

    def _maybe_cleanup(self):
        """Run cleanup if enough time has passed."""
        now = time.time()
        if now - self._last_cleanup > self.cleanup_interval:
            self._cleanup_expired()
            self._last_cleanup = now

    def _cleanup_expired(self):
        """Remove expired memories."""
        with self._lock:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?",
                    (time.time(),)
                )
                deleted = cursor.rowcount
                conn.commit()
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} expired memories")

    def _generate_id(self, content: Any) -> str:
        """Generate unique ID for memory."""
        import uuid
        content_hash = hashlib.sha256(json.dumps(content, default=str).encode()).hexdigest()[:8]
        return f"mem_{content_hash}_{uuid.uuid4().hex[:8]}"

    def store(
        self,
        content: Any,
        memory_type: MemoryType,
        owner_agent: str = "system",
        access_level: AccessLevel = AccessLevel.INTERNAL,
        ttl_hours: Optional[float] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        importance: float = 0.5
    ) -> MemoryEntry:
        """Store a memory entry."""
        self._maybe_cleanup()

        memory_id = self._generate_id(content)
        now = time.time()

        # Calculate expiration
        ttl = ttl_hours if ttl_hours is not None else self.default_ttl_hours
        expires_at = now + (ttl * 3600) if ttl > 0 else None

        entry = MemoryEntry(
            id=memory_id,
            content=content,
            memory_type=memory_type,
            access_level=access_level,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            owner_agent=owner_agent,
            tags=tags or [],
            metadata=metadata or {},
            importance=importance
        )

        # Serialize and optionally encrypt
        content_str = json.dumps(content, default=str)
        if access_level == AccessLevel.ENCRYPTED:
            content_str = self._encryption.encrypt(content_str)

        content_hash = hashlib.sha256(content_str.encode()).hexdigest()

        with self._lock:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO memories
                    (id, content, memory_type, access_level, created_at, updated_at,
                     expires_at, owner_agent, tags, metadata, access_count, importance, content_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry.id,
                    content_str,
                    entry.memory_type.value,
                    entry.access_level.value,
                    entry.created_at,
                    entry.updated_at,
                    entry.expires_at,
                    entry.owner_agent,
                    json.dumps(entry.tags),
                    json.dumps(entry.metadata),
                    entry.access_count,
                    entry.importance,
                    content_hash
                ))
                conn.commit()

        logger.debug(f"Stored memory: {entry.id} (type: {memory_type.value})")
        return entry

    def retrieve(
        self,
        memory_id: str,
        requester_agent: str = "system"
    ) -> Optional[MemoryEntry]:
        """Retrieve a memory by ID."""
        self._maybe_cleanup()

        with self._lock:
            with self._get_connection() as conn:
                row = conn.execute(
                    "SELECT * FROM memories WHERE id = ?",
                    (memory_id,)
                ).fetchone()

                if not row:
                    return None

                # Check expiration
                if row["expires_at"] and row["expires_at"] < time.time():
                    conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
                    conn.commit()
                    return None

                # Access control
                access_level = AccessLevel(row["access_level"])
                if access_level == AccessLevel.PRIVATE and row["owner_agent"] != requester_agent:
                    logger.warning(f"Access denied to memory {memory_id} for {requester_agent}")
                    return None

                # Decrypt if needed
                content_str = row["content"]
                if access_level == AccessLevel.ENCRYPTED:
                    content_str = self._encryption.decrypt(content_str)

                # Update access count
                conn.execute(
                    "UPDATE memories SET access_count = access_count + 1 WHERE id = ?",
                    (memory_id,)
                )
                conn.commit()

                return MemoryEntry(
                    id=row["id"],
                    content=json.loads(content_str),
                    memory_type=MemoryType(row["memory_type"]),
                    access_level=access_level,
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    expires_at=row["expires_at"],
                    owner_agent=row["owner_agent"],
                    tags=json.loads(row["tags"]) if row["tags"] else [],
                    metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                    access_count=row["access_count"] + 1,
                    importance=row["importance"]
                )

    def search(
        self,
        query: Optional[str] = None,
        memory_type: Optional[MemoryType] = None,
        owner_agent: Optional[str] = None,
        tags: Optional[List[str]] = None,
        min_importance: float = 0.0,
        limit: int = 100,
        requester_agent: str = "system"
    ) -> List[MemoryEntry]:
        """Search memories with filters."""
        self._maybe_cleanup()

        conditions = ["(expires_at IS NULL OR expires_at > ?)"]
        params: List[Any] = [time.time()]

        if memory_type:
            conditions.append("memory_type = ?")
            params.append(memory_type.value)

        if owner_agent:
            conditions.append("owner_agent = ?")
            params.append(owner_agent)

        if min_importance > 0:
            conditions.append("importance >= ?")
            params.append(min_importance)

        if query:
            conditions.append("content LIKE ?")
            params.append(f"%{query}%")

        # Exclude private memories from other agents
        conditions.append(
            "(access_level != 'private' OR owner_agent = ?)"
        )
        params.append(requester_agent)

        sql = f"""
            SELECT * FROM memories
            WHERE {' AND '.join(conditions)}
            ORDER BY importance DESC, updated_at DESC
            LIMIT ?
        """
        params.append(limit)

        results = []
        with self._lock:
            with self._get_connection() as conn:
                rows = conn.execute(sql, params).fetchall()

                for row in rows:
                    try:
                        content_str = row["content"]
                        access_level = AccessLevel(row["access_level"])

                        if access_level == AccessLevel.ENCRYPTED:
                            content_str = self._encryption.decrypt(content_str)

                        entry = MemoryEntry(
                            id=row["id"],
                            content=json.loads(content_str),
                            memory_type=MemoryType(row["memory_type"]),
                            access_level=access_level,
                            created_at=row["created_at"],
                            updated_at=row["updated_at"],
                            expires_at=row["expires_at"],
                            owner_agent=row["owner_agent"],
                            tags=json.loads(row["tags"]) if row["tags"] else [],
                            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                            access_count=row["access_count"],
                            importance=row["importance"]
                        )

                        # Filter by tags if specified
                        if tags and not any(t in entry.tags for t in tags):
                            continue

                        results.append(entry)
                    except Exception as e:
                        logger.error(f"Error loading memory {row['id']}: {e}")

        return results

    def update(
        self,
        memory_id: str,
        content: Optional[Any] = None,
        importance: Optional[float] = None,
        tags: Optional[List[str]] = None,
        extend_ttl_hours: Optional[float] = None
    ) -> bool:
        """Update an existing memory."""
        with self._lock:
            with self._get_connection() as conn:
                row = conn.execute(
                    "SELECT * FROM memories WHERE id = ?",
                    (memory_id,)
                ).fetchone()

                if not row:
                    return False

                updates = ["updated_at = ?"]
                params = [time.time()]

                if content is not None:
                    content_str = json.dumps(content, default=str)
                    if AccessLevel(row["access_level"]) == AccessLevel.ENCRYPTED:
                        content_str = self._encryption.encrypt(content_str)
                    updates.append("content = ?")
                    params.append(content_str)

                if importance is not None:
                    updates.append("importance = ?")
                    params.append(importance)

                if tags is not None:
                    updates.append("tags = ?")
                    params.append(json.dumps(tags))

                if extend_ttl_hours is not None and row["expires_at"]:
                    new_expires = row["expires_at"] + (extend_ttl_hours * 3600)
                    updates.append("expires_at = ?")
                    params.append(new_expires)

                params.append(memory_id)
                conn.execute(
                    f"UPDATE memories SET {', '.join(updates)} WHERE id = ?",
                    params
                )
                conn.commit()
                return True

    def delete(self, memory_id: str) -> bool:
        """Delete a memory."""
        with self._lock:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "DELETE FROM memories WHERE id = ?",
                    (memory_id,)
                )
                conn.commit()
                return cursor.rowcount > 0

    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics."""
        with self._get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]

            by_type = {}
            for row in conn.execute(
                "SELECT memory_type, COUNT(*) as cnt FROM memories GROUP BY memory_type"
            ):
                by_type[row["memory_type"]] = row["cnt"]

            by_access = {}
            for row in conn.execute(
                "SELECT access_level, COUNT(*) as cnt FROM memories GROUP BY access_level"
            ):
                by_access[row["access_level"]] = row["cnt"]

            avg_importance = conn.execute(
                "SELECT AVG(importance) FROM memories"
            ).fetchone()[0] or 0

            expiring_soon = conn.execute(
                "SELECT COUNT(*) FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?",
                (time.time() + 86400,)  # Next 24 hours
            ).fetchone()[0]

        return {
            "total_memories": total,
            "by_type": by_type,
            "by_access_level": by_access,
            "average_importance": avg_importance,
            "expiring_24h": expiring_soon
        }

    def consolidate(self, min_age_hours: float = 24, min_access_count: int = 3):
        """Consolidate frequently accessed memories (increase importance, extend TTL)."""
        threshold_time = time.time() - (min_age_hours * 3600)

        with self._lock:
            with self._get_connection() as conn:
                # Find memories that are old but frequently accessed
                cursor = conn.execute("""
                    UPDATE memories
                    SET importance = MIN(importance + 0.1, 1.0),
                        expires_at = CASE
                            WHEN expires_at IS NOT NULL
                            THEN expires_at + 604800
                            ELSE NULL
                        END
                    WHERE created_at < ?
                    AND access_count >= ?
                    AND importance < 1.0
                """, (threshold_time, min_access_count))

                conn.commit()
                logger.info(f"Consolidated {cursor.rowcount} memories")
