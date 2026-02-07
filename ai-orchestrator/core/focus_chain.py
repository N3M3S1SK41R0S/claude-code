"""
NEMESIS Focus Chain - Maintain context focus across interactions.

The Focus Chain tracks the current task context, ensures continuity
between interactions, and periodically reminds the system of the
active focus to prevent context drift.
"""

import time
import uuid
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)


class FocusLevel(Enum):
    """Level of focus intensity."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FocusState(Enum):
    """State of a focus chain entry."""
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


@dataclass
class FocusEntry:
    """A single entry in the focus chain."""
    focus_id: str
    description: str
    level: FocusLevel = FocusLevel.MEDIUM
    state: FocusState = FocusState.ACTIVE
    context: Dict[str, Any] = field(default_factory=dict)
    parent_id: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    last_reminded_at: Optional[float] = None
    reminder_count: int = 0
    completion_criteria: Optional[str] = None
    progress_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "focus_id": self.focus_id,
            "description": self.description,
            "level": self.level.value,
            "state": self.state.value,
            "context": self.context,
            "parent_id": self.parent_id,
            "created_at": self.created_at,
            "reminder_count": self.reminder_count,
            "completion_criteria": self.completion_criteria,
            "progress_notes": self.progress_notes,
        }


@dataclass
class FocusChainConfig:
    """Configuration for the Focus Chain system."""
    enabled: bool = True
    reminder_interval: int = 6       # 1-10 scale, interactions between reminders
    max_chain_depth: int = 10        # Maximum nested focus entries
    auto_complete_on_drift: bool = False
    track_context_switches: bool = True
    default_level: str = "medium"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FocusChainConfig':
        """Create config from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class FocusChain:
    """
    Maintains context focus across interactions to prevent drift.

    The Focus Chain ensures that the system stays on track by:
    - Tracking the current task focus and sub-focuses
    - Generating periodic reminders based on the reminder interval
    - Detecting context switches and logging them
    - Providing focus summaries for context restoration

    The reminder_interval (1-10) controls how frequently focus
    reminders are generated:
    - 1: Every interaction (most aggressive)
    - 5-6: Every 5-6 interactions (balanced, default)
    - 10: Every 10 interactions (most relaxed)
    """

    def __init__(self, config: Optional[FocusChainConfig] = None):
        self.config = config or FocusChainConfig()
        self._chain: List[FocusEntry] = []
        self._interaction_count: int = 0
        self._context_switches: List[Dict[str, Any]] = []
        self._lock = threading.Lock()

        logger.info(
            f"FocusChain initialized "
            f"(reminder_interval={self.config.reminder_interval})"
        )

    def push_focus(
        self,
        description: str,
        level: FocusLevel = FocusLevel.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        completion_criteria: Optional[str] = None,
    ) -> str:
        """
        Push a new focus onto the chain.

        Args:
            description: Description of the focus.
            level: Focus intensity level.
            context: Additional context for the focus.
            completion_criteria: What marks this focus as complete.

        Returns:
            Focus ID for tracking.
        """
        if not self.config.enabled:
            return ""

        with self._lock:
            if len(self._chain) >= self.config.max_chain_depth:
                logger.warning(
                    f"Focus chain at max depth ({self.config.max_chain_depth}), "
                    f"completing oldest focus"
                )
                self._chain[0].state = FocusState.COMPLETED

            parent_id = self._chain[-1].focus_id if self._chain else None

            entry = FocusEntry(
                focus_id=f"focus-{uuid.uuid4().hex[:8]}",
                description=description,
                level=level,
                context=context or {},
                parent_id=parent_id,
                completion_criteria=completion_criteria,
            )

            self._chain.append(entry)

            logger.info(
                f"Focus pushed: [{level.value}] {description[:60]}... "
                f"(depth={len(self._chain)})"
            )

            return entry.focus_id

    def pop_focus(self, focus_id: Optional[str] = None) -> Optional[FocusEntry]:
        """
        Pop the current focus (or a specific one) from the chain.

        Args:
            focus_id: Specific focus to pop. If None, pops the most recent.

        Returns:
            The popped FocusEntry, or None if chain is empty.
        """
        with self._lock:
            if not self._chain:
                return None

            if focus_id:
                for i, entry in enumerate(self._chain):
                    if entry.focus_id == focus_id:
                        entry.state = FocusState.COMPLETED
                        return self._chain.pop(i)
                return None

            entry = self._chain.pop()
            entry.state = FocusState.COMPLETED
            logger.info(f"Focus popped: {entry.description[:60]}...")
            return entry

    def complete_focus(self, focus_id: str, note: Optional[str] = None) -> bool:
        """
        Mark a focus as completed.

        Args:
            focus_id: ID of the focus to complete.
            note: Optional completion note.

        Returns:
            True if the focus was found and completed.
        """
        with self._lock:
            for entry in self._chain:
                if entry.focus_id == focus_id:
                    entry.state = FocusState.COMPLETED
                    if note:
                        entry.progress_notes.append(f"[COMPLETED] {note}")
                    logger.info(f"Focus completed: {entry.description[:60]}...")
                    return True
        return False

    def pause_focus(self, focus_id: str) -> bool:
        """Pause a focus without removing it."""
        with self._lock:
            for entry in self._chain:
                if entry.focus_id == focus_id:
                    entry.state = FocusState.PAUSED
                    logger.info(f"Focus paused: {entry.description[:60]}...")
                    return True
        return False

    def resume_focus(self, focus_id: str) -> bool:
        """Resume a paused focus."""
        with self._lock:
            for entry in self._chain:
                if entry.focus_id == focus_id and entry.state == FocusState.PAUSED:
                    entry.state = FocusState.ACTIVE
                    logger.info(f"Focus resumed: {entry.description[:60]}...")
                    return True
        return False

    def add_progress(self, focus_id: str, note: str):
        """Add a progress note to a focus entry."""
        with self._lock:
            for entry in self._chain:
                if entry.focus_id == focus_id:
                    entry.progress_notes.append(note)
                    return

    def record_interaction(self) -> Optional[str]:
        """
        Record an interaction and check if a focus reminder is needed.

        Call this on every interaction to track the reminder interval.

        Returns:
            A focus reminder string if one is due, None otherwise.
        """
        if not self.config.enabled:
            return None

        with self._lock:
            self._interaction_count += 1

            if self._interaction_count % self.config.reminder_interval == 0:
                return self._generate_reminder()

        return None

    def _generate_reminder(self) -> Optional[str]:
        """Generate a focus reminder based on the current chain."""
        active_focuses = [
            e for e in self._chain
            if e.state == FocusState.ACTIVE
        ]

        if not active_focuses:
            return None

        current = active_focuses[-1]
        current.last_reminded_at = time.time()
        current.reminder_count += 1

        reminder_parts = [
            f"[Focus Reminder #{current.reminder_count}]",
            f"Current focus: {current.description}",
        ]

        if current.completion_criteria:
            reminder_parts.append(
                f"Completion criteria: {current.completion_criteria}"
            )

        if len(active_focuses) > 1:
            parent_chain = " -> ".join(
                e.description[:40] for e in active_focuses[:-1]
            )
            reminder_parts.append(f"Context chain: {parent_chain}")

        if current.progress_notes:
            last_note = current.progress_notes[-1]
            reminder_parts.append(f"Last progress: {last_note}")

        return "\n".join(reminder_parts)

    def get_current_focus(self) -> Optional[FocusEntry]:
        """Get the current active focus."""
        with self._lock:
            for entry in reversed(self._chain):
                if entry.state == FocusState.ACTIVE:
                    return entry
        return None

    def get_focus_chain(self) -> List[Dict[str, Any]]:
        """Get the full focus chain as a list of dicts."""
        with self._lock:
            return [entry.to_dict() for entry in self._chain]

    def get_focus_summary(self) -> str:
        """Get a human-readable summary of the current focus chain."""
        with self._lock:
            if not self._chain:
                return "No active focus."

            active = [e for e in self._chain if e.state == FocusState.ACTIVE]
            paused = [e for e in self._chain if e.state == FocusState.PAUSED]

            parts = []

            if active:
                parts.append("Active focuses:")
                for i, entry in enumerate(active, 1):
                    depth = "  " * i
                    parts.append(
                        f"{depth}{i}. [{entry.level.value}] {entry.description}"
                    )

            if paused:
                parts.append("\nPaused:")
                for entry in paused:
                    parts.append(f"  - {entry.description}")

            return "\n".join(parts)

    def detect_context_switch(self, new_context: str) -> bool:
        """
        Detect if a new interaction represents a context switch.

        Args:
            new_context: Description of the new interaction context.

        Returns:
            True if a context switch was detected.
        """
        if not self.config.track_context_switches:
            return False

        current = self.get_current_focus()
        if not current:
            return False

        # Simple heuristic: check if the new context is significantly
        # different from the current focus
        current_words = set(current.description.lower().split())
        new_words = set(new_context.lower().split())

        if not current_words or not new_words:
            return False

        overlap = len(current_words & new_words) / max(
            len(current_words), len(new_words)
        )

        is_switch = overlap < 0.2  # Less than 20% word overlap

        if is_switch and self.config.track_context_switches:
            self._context_switches.append({
                "from_focus": current.description,
                "to_context": new_context,
                "timestamp": time.time(),
                "overlap": overlap,
            })
            logger.info(
                f"Context switch detected (overlap={overlap:.2f}): "
                f"'{current.description[:40]}' -> '{new_context[:40]}'"
            )

        return is_switch

    def set_reminder_interval(self, interval: int):
        """
        Set the reminder interval (1-10).

        Args:
            interval: Number of interactions between reminders (1-10).
        """
        interval = max(1, min(10, interval))
        self.config.reminder_interval = interval
        logger.info(f"Reminder interval set to {interval}")

    def get_stats(self) -> Dict[str, Any]:
        """Get Focus Chain statistics."""
        with self._lock:
            active_count = sum(
                1 for e in self._chain if e.state == FocusState.ACTIVE
            )
            paused_count = sum(
                1 for e in self._chain if e.state == FocusState.PAUSED
            )

            return {
                "enabled": self.config.enabled,
                "chain_depth": len(self._chain),
                "active_focuses": active_count,
                "paused_focuses": paused_count,
                "interaction_count": self._interaction_count,
                "reminder_interval": self.config.reminder_interval,
                "context_switches": len(self._context_switches),
                "max_depth": self.config.max_chain_depth,
            }

    def clear(self):
        """Clear the entire focus chain."""
        with self._lock:
            for entry in self._chain:
                entry.state = FocusState.ABANDONED
            self._chain.clear()
            self._interaction_count = 0
            logger.info("Focus chain cleared")
