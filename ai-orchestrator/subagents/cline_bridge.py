"""
Cline Bridge - Interface to Cline CLI for sub-agent execution.

Provides a bridge between the NEMESIS subagent system and the Cline CLI,
enabling task delegation through Cline's agent infrastructure.
"""

import json
import logging
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class ClineStatus(Enum):
    """Status of the Cline CLI connection."""
    NOT_INSTALLED = "not_installed"
    NOT_AUTHENTICATED = "not_authenticated"
    READY = "ready"
    BUSY = "busy"
    ERROR = "error"


@dataclass
class ClineTaskResult:
    """Result from a Cline CLI task execution."""
    success: bool
    output: str = ""
    error: Optional[str] = None
    exit_code: int = 0
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ClineBridge:
    """
    Bridge to Cline CLI for executing sub-agent tasks.

    Cline CLI is required for subagents. Install it with:
        npm install -g cline

    Then authenticate with:
        cline auth
    """

    CLINE_BINARY = "cline"

    def __init__(self, timeout_seconds: float = 300.0):
        self.timeout_seconds = timeout_seconds
        self._status = ClineStatus.NOT_INSTALLED
        self._check_installation()

    def _check_installation(self):
        """Check if Cline CLI is installed and authenticated."""
        cline_path = shutil.which(self.CLINE_BINARY)

        if not cline_path:
            self._status = ClineStatus.NOT_INSTALLED
            logger.warning(
                "Cline CLI not found. Install with: npm install -g cline"
            )
            return

        try:
            result = subprocess.run(
                [self.CLINE_BINARY, "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                self._status = ClineStatus.READY
                logger.info(f"Cline CLI found: {result.stdout.strip()}")
            else:
                self._status = ClineStatus.NOT_AUTHENTICATED
                logger.warning(
                    "Cline CLI found but not authenticated. Run: cline auth"
                )
        except subprocess.TimeoutExpired:
            self._status = ClineStatus.ERROR
            logger.error("Cline CLI version check timed out")
        except Exception as e:
            self._status = ClineStatus.ERROR
            logger.error(f"Error checking Cline CLI: {e}")

    @property
    def status(self) -> ClineStatus:
        """Get current Cline CLI status."""
        return self._status

    @property
    def is_available(self) -> bool:
        """Check if Cline CLI is available for use."""
        return self._status == ClineStatus.READY

    def get_install_instructions(self) -> str:
        """Get installation instructions for Cline CLI."""
        return (
            "Cline CLI is required for subagents.\n\n"
            "Install:\n"
            "  npm install -g cline\n\n"
            "Authenticate:\n"
            "  cline auth\n\n"
            "Verify:\n"
            "  cline --version\n"
        )

    def execute_task(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        working_directory: Optional[str] = None,
    ) -> ClineTaskResult:
        """
        Execute a task through Cline CLI.

        Args:
            prompt: The task prompt to execute.
            system_prompt: Optional system prompt for context.
            model: Optional model override.
            context: Additional context for the task.
            working_directory: Working directory for execution.

        Returns:
            ClineTaskResult with execution results.
        """
        if not self.is_available:
            return ClineTaskResult(
                success=False,
                error=f"Cline CLI not available: {self._status.value}",
                exit_code=-1,
            )

        self._status = ClineStatus.BUSY
        start_time = time.time()

        try:
            cmd = [self.CLINE_BINARY, "run"]

            if model:
                cmd.extend(["--model", model])

            if system_prompt:
                cmd.extend(["--system-prompt", system_prompt])

            cmd.extend(["--prompt", prompt])

            env = None
            if context:
                # Pass context as environment variable
                import os

                env = os.environ.copy()
                env["CLINE_CONTEXT"] = json.dumps(context)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                cwd=working_directory,
                env=env,
            )

            execution_time = (time.time() - start_time) * 1000

            self._status = ClineStatus.READY

            return ClineTaskResult(
                success=result.returncode == 0,
                output=result.stdout,
                error=result.stderr if result.returncode != 0 else None,
                exit_code=result.returncode,
                execution_time_ms=execution_time,
                metadata={
                    "model": model,
                    "working_directory": working_directory,
                },
            )

        except subprocess.TimeoutExpired:
            self._status = ClineStatus.READY
            execution_time = (time.time() - start_time) * 1000
            return ClineTaskResult(
                success=False,
                error=f"Task timed out after {self.timeout_seconds}s",
                exit_code=-1,
                execution_time_ms=execution_time,
            )

        except Exception as e:
            self._status = ClineStatus.ERROR
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"Cline task execution failed: {e}")
            return ClineTaskResult(
                success=False,
                error=str(e),
                exit_code=-1,
                execution_time_ms=execution_time,
            )

    def check_health(self) -> Dict[str, Any]:
        """Check health of the Cline CLI integration."""
        self._check_installation()
        return {
            "status": self._status.value,
            "available": self.is_available,
            "binary": self.CLINE_BINARY,
            "binary_path": shutil.which(self.CLINE_BINARY),
        }
