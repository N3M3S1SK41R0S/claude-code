"""
NEMESIS Yolo Mode - Execute tasks without user confirmation.

Experimental feature that auto-switches from Plan to Act mode and
disables the ask question tool for uninterrupted autonomous execution.
Use with extreme caution.
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class ExecutionMode(Enum):
    """Execution modes for the orchestrator."""
    PLAN = "plan"    # Planning only, requires confirmation
    ACT = "act"      # Executes actions, may ask questions
    YOLO = "yolo"    # Full autonomous execution, no confirmations


class YoloAction(Enum):
    """Actions taken during Yolo Mode execution."""
    FILE_WRITE = "file_write"
    FILE_DELETE = "file_delete"
    COMMAND_EXECUTE = "command_execute"
    API_CALL = "api_call"
    CONFIG_CHANGE = "config_change"
    TOOL_INVOKE = "tool_invoke"


@dataclass
class YoloGuardrail:
    """Safety guardrail for Yolo Mode."""
    name: str
    description: str
    check_fn: Optional[Callable] = None
    enabled: bool = True
    block_on_fail: bool = True


@dataclass
class YoloActionLog:
    """Log entry for an action taken in Yolo Mode."""
    action_type: YoloAction
    description: str
    timestamp: float = field(default_factory=time.time)
    auto_approved: bool = True
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class YoloConfig:
    """Configuration for Yolo Mode."""
    enabled: bool = False
    auto_switch_to_act: bool = True
    disable_ask_tool: bool = True
    max_actions_per_session: int = 100
    allow_file_writes: bool = True
    allow_file_deletes: bool = False
    allow_command_execution: bool = True
    allow_network_calls: bool = True
    blocked_commands: List[str] = field(default_factory=lambda: [
        "rm -rf /",
        "rm -rf ~",
        "format",
        "mkfs",
        "dd if=/dev/zero",
    ])
    blocked_paths: List[str] = field(default_factory=lambda: [
        "/etc/",
        "/sys/",
        "/proc/",
        "/boot/",
    ])
    require_guardrails: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'YoloConfig':
        """Create config from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class YoloMode:
    """
    Yolo Mode controller for autonomous task execution.

    When enabled, Yolo Mode:
    - Auto-switches from Plan mode to Act mode
    - Disables the ask question tool (no user prompts)
    - Executes all actions without confirmation
    - Maintains an audit log of all autonomous actions
    - Enforces safety guardrails to prevent dangerous operations

    WARNING: Use with extreme caution. Yolo Mode bypasses normal
    confirmation flows and executes actions autonomously.
    """

    def __init__(self, config: Optional[YoloConfig] = None):
        self.config = config or YoloConfig()
        self._active = False
        self._previous_mode: Optional[ExecutionMode] = None
        self._action_count = 0
        self._action_log: List[YoloActionLog] = []
        self._guardrails: List[YoloGuardrail] = []
        self._lock = threading.Lock()
        self._session_start: Optional[float] = None

        # Register default guardrails
        if self.config.require_guardrails:
            self._register_default_guardrails()

    def _register_default_guardrails(self):
        """Register default safety guardrails."""
        self._guardrails = [
            YoloGuardrail(
                name="action_limit",
                description="Limits total actions per session",
                check_fn=lambda action, details: (
                    self._action_count < self.config.max_actions_per_session
                ),
            ),
            YoloGuardrail(
                name="blocked_commands",
                description="Blocks dangerous commands",
                check_fn=lambda action, details: not any(
                    blocked in details.get("command", "")
                    for blocked in self.config.blocked_commands
                ),
            ),
            YoloGuardrail(
                name="blocked_paths",
                description="Blocks writes to system paths",
                check_fn=lambda action, details: not any(
                    details.get("path", "").startswith(blocked)
                    for blocked in self.config.blocked_paths
                ),
            ),
            YoloGuardrail(
                name="file_delete_guard",
                description="Controls file deletion permission",
                check_fn=lambda action, details: (
                    action != YoloAction.FILE_DELETE or
                    self.config.allow_file_deletes
                ),
            ),
        ]

    def activate(self, current_mode: ExecutionMode = ExecutionMode.PLAN) -> bool:
        """
        Activate Yolo Mode.

        Args:
            current_mode: The current execution mode to restore on deactivation.

        Returns:
            True if activation succeeded, False otherwise.
        """
        if not self.config.enabled:
            logger.warning("Yolo Mode is disabled in configuration")
            return False

        with self._lock:
            if self._active:
                logger.warning("Yolo Mode is already active")
                return True

            self._previous_mode = current_mode
            self._active = True
            self._action_count = 0
            self._action_log.clear()
            self._session_start = time.time()

            logger.warning(
                "YOLO MODE ACTIVATED - All actions will execute without "
                "confirmation. Use with extreme caution."
            )

            return True

    def deactivate(self) -> ExecutionMode:
        """
        Deactivate Yolo Mode and restore previous execution mode.

        Returns:
            The previous execution mode to restore.
        """
        with self._lock:
            if not self._active:
                return ExecutionMode.PLAN

            self._active = False
            restored_mode = self._previous_mode or ExecutionMode.PLAN
            session_duration = (
                (time.time() - self._session_start) * 1000
                if self._session_start
                else 0
            )

            logger.info(
                f"Yolo Mode deactivated. Actions taken: {self._action_count}, "
                f"Session duration: {session_duration:.0f}ms"
            )

            return restored_mode

    @property
    def is_active(self) -> bool:
        """Check if Yolo Mode is currently active."""
        return self._active

    def get_execution_mode(self) -> ExecutionMode:
        """Get the current effective execution mode."""
        if self._active:
            if self.config.auto_switch_to_act:
                return ExecutionMode.ACT
            return ExecutionMode.YOLO
        return self._previous_mode or ExecutionMode.PLAN

    def should_ask_user(self) -> bool:
        """
        Check if the system should ask the user for input.

        In Yolo Mode with disable_ask_tool=True, this always returns False.
        """
        if self._active and self.config.disable_ask_tool:
            return False
        return True

    def approve_action(
        self,
        action: YoloAction,
        description: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> tuple:
        """
        Check if an action should be approved in Yolo Mode.

        Args:
            action: Type of action to approve.
            description: Human-readable description of the action.
            details: Additional details for guardrail checks.

        Returns:
            Tuple of (approved: bool, reason: str).
        """
        details = details or {}

        if not self._active:
            return False, "Yolo Mode is not active"

        # Check guardrails
        for guardrail in self._guardrails:
            if not guardrail.enabled:
                continue

            if guardrail.check_fn:
                passed = guardrail.check_fn(action, details)
                if not passed:
                    reason = f"Guardrail '{guardrail.name}' blocked: {guardrail.description}"
                    logger.warning(f"Yolo action blocked: {reason}")

                    if guardrail.block_on_fail:
                        return False, reason

        # Action approved
        with self._lock:
            self._action_count += 1
            self._action_log.append(YoloActionLog(
                action_type=action,
                description=description,
                details=details,
            ))

        logger.info(
            f"Yolo auto-approved [{self._action_count}]: "
            f"{action.value} - {description[:80]}"
        )

        return True, "Auto-approved by Yolo Mode"

    def add_guardrail(self, guardrail: YoloGuardrail):
        """Add a custom guardrail."""
        self._guardrails.append(guardrail)
        logger.info(f"Added guardrail: {guardrail.name}")

    def remove_guardrail(self, name: str) -> bool:
        """Remove a guardrail by name."""
        initial_count = len(self._guardrails)
        self._guardrails = [g for g in self._guardrails if g.name != name]
        removed = len(self._guardrails) < initial_count
        if removed:
            logger.info(f"Removed guardrail: {name}")
        return removed

    def get_action_log(self) -> List[Dict[str, Any]]:
        """Get the audit log of all actions taken."""
        return [
            {
                "action": entry.action_type.value,
                "description": entry.description,
                "timestamp": entry.timestamp,
                "auto_approved": entry.auto_approved,
                "details": entry.details,
            }
            for entry in self._action_log
        ]

    def get_stats(self) -> Dict[str, Any]:
        """Get Yolo Mode statistics."""
        action_counts = {}
        for entry in self._action_log:
            action_type = entry.action_type.value
            action_counts[action_type] = action_counts.get(action_type, 0) + 1

        return {
            "active": self._active,
            "enabled": self.config.enabled,
            "action_count": self._action_count,
            "max_actions": self.config.max_actions_per_session,
            "actions_remaining": max(
                0,
                self.config.max_actions_per_session - self._action_count,
            ),
            "action_breakdown": action_counts,
            "guardrails_count": len(self._guardrails),
            "session_duration_ms": (
                (time.time() - self._session_start) * 1000
                if self._session_start and self._active
                else 0
            ),
            "auto_switch_to_act": self.config.auto_switch_to_act,
            "ask_tool_disabled": self.config.disable_ask_tool,
        }
