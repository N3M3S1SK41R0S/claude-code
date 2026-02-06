"""
NEMESIS Tool Gateway - Secure tool execution with isolation, audit, and risk policies.
Acts as the single entry point for ALL tool invocations in the system.
"""
import time
import json
import hashlib
import threading
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
from enum import Enum
from abc import ABC, abstractmethod

from .tracer import get_tracer, SpanKind, RequestContext

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Risk level for tool operations."""
    LOW = "low"           # Read-only, no side effects
    MEDIUM = "medium"     # Limited side effects, reversible
    HIGH = "high"         # Significant side effects
    CRITICAL = "critical" # Irreversible, requires approval


class ToolCategory(Enum):
    """Categories of tools."""
    READ = "read"           # Read operations
    WRITE = "write"         # Write operations
    EXECUTE = "execute"     # Code execution
    NETWORK = "network"     # Network operations
    SYSTEM = "system"       # System operations
    AI = "ai"               # AI/LLM operations


@dataclass
class ToolCall:
    """Represents a tool invocation request."""
    tool_id: str
    tool_name: str
    parameters: Dict[str, Any]
    request_id: str
    agent_id: str
    timestamp: float = field(default_factory=time.time)
    category: ToolCategory = ToolCategory.READ
    risk_level: RiskLevel = RiskLevel.LOW
    timeout_seconds: float = 30.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def signature(self) -> str:
        """Generate unique signature for this call."""
        content = f"{self.tool_name}:{json.dumps(self.parameters, sort_keys=True)}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_id": self.tool_id,
            "tool_name": self.tool_name,
            "parameters": self.parameters,
            "request_id": self.request_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp,
            "category": self.category.value,
            "risk_level": self.risk_level.value,
            "signature": self.signature()
        }


@dataclass
class ToolResult:
    """Result of a tool invocation."""
    tool_call: ToolCall
    success: bool
    result: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    blocked: bool = False
    block_reason: Optional[str] = None
    audit_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_call": self.tool_call.to_dict(),
            "success": self.success,
            "result": str(self.result)[:1000] if self.result else None,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
            "blocked": self.blocked,
            "block_reason": self.block_reason,
            "audit_id": self.audit_id
        }


class RiskPolicy(ABC):
    """Base class for risk-based policies."""

    @abstractmethod
    def evaluate(self, call: ToolCall, context: Dict[str, Any]) -> tuple[bool, str]:
        """Evaluate if the call is allowed. Returns (allowed, reason)."""
        pass


class RateLimitPolicy(RiskPolicy):
    """Rate limiting policy for tools."""

    def __init__(self, max_calls_per_minute: int = 60):
        self.max_calls = max_calls_per_minute
        self._calls: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def evaluate(self, call: ToolCall, context: Dict[str, Any]) -> tuple[bool, str]:
        key = f"{call.agent_id}:{call.tool_name}"
        now = time.time()
        window = 60.0

        with self._lock:
            if key not in self._calls:
                self._calls[key] = []

            # Clean old entries
            self._calls[key] = [t for t in self._calls[key] if now - t < window]

            if len(self._calls[key]) >= self.max_calls:
                return False, f"Rate limit exceeded: {self.max_calls}/minute"

            self._calls[key].append(now)

        return True, ""


class RiskLevelPolicy(RiskPolicy):
    """Policy based on risk levels."""

    def __init__(self, max_auto_approve: RiskLevel = RiskLevel.MEDIUM):
        self.max_auto_approve = max_auto_approve
        self._risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]

    def evaluate(self, call: ToolCall, context: Dict[str, Any]) -> tuple[bool, str]:
        call_risk_idx = self._risk_order.index(call.risk_level)
        max_risk_idx = self._risk_order.index(self.max_auto_approve)

        if call_risk_idx > max_risk_idx:
            return False, f"Risk level {call.risk_level.value} requires manual approval"

        return True, ""


class DenyListPolicy(RiskPolicy):
    """Policy to deny specific tools or patterns."""

    def __init__(self, denied_tools: List[str] = None, denied_patterns: List[str] = None):
        self.denied_tools = set(denied_tools or [])
        self.denied_patterns = denied_patterns or []

    def evaluate(self, call: ToolCall, context: Dict[str, Any]) -> tuple[bool, str]:
        if call.tool_name in self.denied_tools:
            return False, f"Tool {call.tool_name} is denied"

        for pattern in self.denied_patterns:
            if pattern in call.tool_name:
                return False, f"Tool matches denied pattern: {pattern}"

        return True, ""


class AuditLog:
    """Audit log for all tool invocations."""

    def __init__(self, log_file: Optional[str] = None):
        self.log_file = log_file
        self._entries: List[Dict] = []
        self._lock = threading.Lock()

    def log(self, call: ToolCall, result: ToolResult) -> str:
        """Log a tool invocation and return audit ID."""
        import uuid
        audit_id = str(uuid.uuid4())[:12]

        entry = {
            "audit_id": audit_id,
            "timestamp": datetime.now().isoformat(),
            "tool_call": call.to_dict(),
            "result": {
                "success": result.success,
                "blocked": result.blocked,
                "block_reason": result.block_reason,
                "execution_time_ms": result.execution_time_ms,
                "error": result.error
            }
        }

        with self._lock:
            self._entries.append(entry)

            if self.log_file:
                try:
                    with open(self.log_file, 'a') as f:
                        f.write(json.dumps(entry) + "\n")
                except Exception as e:
                    logger.error(f"Failed to write audit log: {e}")

        return audit_id

    def query(self,
              request_id: Optional[str] = None,
              agent_id: Optional[str] = None,
              tool_name: Optional[str] = None,
              limit: int = 100) -> List[Dict]:
        """Query audit log entries."""
        with self._lock:
            results = self._entries.copy()

        if request_id:
            results = [e for e in results if e["tool_call"]["request_id"] == request_id]
        if agent_id:
            results = [e for e in results if e["tool_call"]["agent_id"] == agent_id]
        if tool_name:
            results = [e for e in results if e["tool_call"]["tool_name"] == tool_name]

        return results[-limit:]


class ToolExecutor(ABC):
    """Base class for tool executors."""

    @abstractmethod
    def execute(self, call: ToolCall) -> Any:
        """Execute the tool call and return result."""
        pass


class IsolatedExecutor(ToolExecutor):
    """Executor that runs tools in isolation."""

    def __init__(self, tools: Dict[str, Callable]):
        self.tools = tools

    def execute(self, call: ToolCall) -> Any:
        if call.tool_name not in self.tools:
            raise ValueError(f"Unknown tool: {call.tool_name}")

        tool_fn = self.tools[call.tool_name]

        # Execute with timeout
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(tool_fn, **call.parameters)
            try:
                return future.result(timeout=call.timeout_seconds)
            except concurrent.futures.TimeoutError:
                raise TimeoutError(f"Tool {call.tool_name} timed out after {call.timeout_seconds}s")


class ToolGateway:
    """
    Central gateway for all tool invocations.
    Provides: isolation, audit, risk policies, rate limiting.
    """

    def __init__(
        self,
        executor: Optional[ToolExecutor] = None,
        policies: Optional[List[RiskPolicy]] = None,
        audit_log: Optional[AuditLog] = None
    ):
        self.executor = executor
        self.policies = policies or [
            RateLimitPolicy(max_calls_per_minute=120),
            RiskLevelPolicy(max_auto_approve=RiskLevel.MEDIUM)
        ]
        self.audit = audit_log or AuditLog()
        self.tracer = get_tracer()
        self._tools_registry: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def register_tool(
        self,
        name: str,
        executor: Callable,
        category: ToolCategory = ToolCategory.READ,
        risk_level: RiskLevel = RiskLevel.LOW,
        description: str = ""
    ):
        """Register a tool with the gateway."""
        with self._lock:
            self._tools_registry[name] = {
                "executor": executor,
                "category": category,
                "risk_level": risk_level,
                "description": description
            }
        logger.info(f"Registered tool: {name} (risk: {risk_level.value})")

    def invoke(self, call: ToolCall, context: Optional[RequestContext] = None) -> ToolResult:
        """Invoke a tool through the gateway."""
        start_time = time.time()

        with self.tracer.span(
            f"tool.{call.tool_name}",
            SpanKind.CLIENT,
            {"tool_name": call.tool_name, "agent_id": call.agent_id}
        ) as span:
            # Enrich call with registry info
            if call.tool_name in self._tools_registry:
                tool_info = self._tools_registry[call.tool_name]
                call.category = tool_info["category"]
                call.risk_level = tool_info["risk_level"]

            # Evaluate all policies
            policy_context = {"span": span, "context": context}
            for policy in self.policies:
                allowed, reason = policy.evaluate(call, policy_context)
                if not allowed:
                    result = ToolResult(
                        tool_call=call,
                        success=False,
                        blocked=True,
                        block_reason=reason,
                        execution_time_ms=(time.time() - start_time) * 1000
                    )
                    result.audit_id = self.audit.log(call, result)
                    span.set_attribute("blocked", True)
                    span.set_attribute("block_reason", reason)
                    logger.warning(f"Tool call blocked: {call.tool_name} - {reason}")
                    return result

            # Execute the tool
            try:
                if call.tool_name in self._tools_registry:
                    executor = self._tools_registry[call.tool_name]["executor"]
                    result_value = executor(**call.parameters)
                elif self.executor:
                    result_value = self.executor.execute(call)
                else:
                    raise ValueError(f"No executor for tool: {call.tool_name}")

                result = ToolResult(
                    tool_call=call,
                    success=True,
                    result=result_value,
                    execution_time_ms=(time.time() - start_time) * 1000
                )
                span.set_attribute("success", True)

            except Exception as e:
                result = ToolResult(
                    tool_call=call,
                    success=False,
                    error=str(e),
                    execution_time_ms=(time.time() - start_time) * 1000
                )
                span.set_attribute("success", False)
                span.set_attribute("error", str(e))
                logger.error(f"Tool execution failed: {call.tool_name} - {e}")

            # Audit logging
            result.audit_id = self.audit.log(call, result)
            span.set_attribute("audit_id", result.audit_id)

            return result

    def batch_invoke(self, calls: List[ToolCall]) -> List[ToolResult]:
        """Invoke multiple tools in sequence."""
        return [self.invoke(call) for call in calls]

    def get_tool_info(self, name: str) -> Optional[Dict[str, Any]]:
        """Get information about a registered tool."""
        return self._tools_registry.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all registered tools."""
        return [
            {"name": name, **{k: v.value if hasattr(v, 'value') else v
                             for k, v in info.items() if k != "executor"}}
            for name, info in self._tools_registry.items()
        ]


# Convenience function for creating tool calls
def create_tool_call(
    tool_name: str,
    parameters: Dict[str, Any],
    request_id: str,
    agent_id: str,
    **kwargs
) -> ToolCall:
    """Create a ToolCall with auto-generated ID."""
    import uuid
    return ToolCall(
        tool_id=str(uuid.uuid4())[:12],
        tool_name=tool_name,
        parameters=parameters,
        request_id=request_id,
        agent_id=agent_id,
        **kwargs
    )
