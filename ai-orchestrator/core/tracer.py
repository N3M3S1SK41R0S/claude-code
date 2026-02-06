"""
NEMESIS Tracer - Request tracking with correlation IDs and distributed tracing.
Implements OpenTelemetry-compatible tracing for full request lifecycle visibility.
"""
import uuid
import time
import json
import threading
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class SpanKind(Enum):
    """Type of span in the trace."""
    INTERNAL = "internal"
    CLIENT = "client"
    SERVER = "server"
    PRODUCER = "producer"
    CONSUMER = "consumer"


class SpanStatus(Enum):
    """Status of a span."""
    UNSET = "unset"
    OK = "ok"
    ERROR = "error"


@dataclass
class Span:
    """A single span in a trace - represents one unit of work."""
    span_id: str
    trace_id: str
    parent_span_id: Optional[str]
    name: str
    kind: SpanKind
    start_time: float
    end_time: Optional[float] = None
    status: SpanStatus = SpanStatus.UNSET
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict[str, Any]] = field(default_factory=list)

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        """Add an event to this span."""
        self.events.append({
            "name": name,
            "timestamp": time.time(),
            "attributes": attributes or {}
        })

    def set_attribute(self, key: str, value: Any):
        """Set an attribute on this span."""
        self.attributes[key] = value

    def set_status(self, status: SpanStatus, description: str = ""):
        """Set the status of this span."""
        self.status = status
        if description:
            self.attributes["status_description"] = description

    def end(self):
        """End this span."""
        self.end_time = time.time()

    @property
    def duration_ms(self) -> float:
        """Duration of the span in milliseconds."""
        if self.end_time is None:
            return (time.time() - self.start_time) * 1000
        return (self.end_time - self.start_time) * 1000

    def to_dict(self) -> Dict[str, Any]:
        """Convert span to dictionary for serialization."""
        return {
            "span_id": self.span_id,
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "kind": self.kind.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
            "attributes": self.attributes,
            "events": self.events
        }


@dataclass
class RequestContext:
    """Context for a request - carries trace info across boundaries."""
    request_id: str
    trace_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    @classmethod
    def new(cls, user_id: Optional[str] = None, session_id: Optional[str] = None) -> "RequestContext":
        """Create a new request context."""
        request_id = str(uuid.uuid4())
        return cls(
            request_id=request_id,
            trace_id=request_id,  # trace_id = request_id for root
            user_id=user_id,
            session_id=session_id
        )

    def child(self, span_id: str) -> "RequestContext":
        """Create a child context for nested operations."""
        return RequestContext(
            request_id=self.request_id,
            trace_id=self.trace_id,
            user_id=self.user_id,
            session_id=self.session_id,
            parent_span_id=span_id,
            metadata=self.metadata.copy()
        )

    def to_headers(self) -> Dict[str, str]:
        """Convert to HTTP headers for propagation."""
        return {
            "X-Request-ID": self.request_id,
            "X-Trace-ID": self.trace_id,
            "X-Parent-Span-ID": self.parent_span_id or "",
            "X-User-ID": self.user_id or "",
            "X-Session-ID": self.session_id or ""
        }

    @classmethod
    def from_headers(cls, headers: Dict[str, str]) -> "RequestContext":
        """Create context from HTTP headers."""
        return cls(
            request_id=headers.get("X-Request-ID", str(uuid.uuid4())),
            trace_id=headers.get("X-Trace-ID", str(uuid.uuid4())),
            user_id=headers.get("X-User-ID") or None,
            session_id=headers.get("X-Session-ID") or None,
            parent_span_id=headers.get("X-Parent-Span-ID") or None
        )


class SpanExporter:
    """Base class for span exporters."""

    def export(self, spans: List[Span]) -> bool:
        """Export spans to backend."""
        raise NotImplementedError


class ConsoleExporter(SpanExporter):
    """Export spans to console for debugging."""

    def export(self, spans: List[Span]) -> bool:
        for span in spans:
            print(f"[TRACE] {span.trace_id[:8]} | {span.name} | {span.duration_ms:.2f}ms | {span.status.value}")
        return True


class JSONFileExporter(SpanExporter):
    """Export spans to JSON file for replay/analysis."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._lock = threading.Lock()

    def export(self, spans: List[Span]) -> bool:
        try:
            with self._lock:
                with open(self.file_path, 'a') as f:
                    for span in spans:
                        f.write(json.dumps(span.to_dict()) + "\n")
            return True
        except Exception as e:
            logger.error(f"Failed to export spans: {e}")
            return False


class Tracer:
    """
    Distributed tracer for NEMESIS system.
    Tracks all requests with correlation IDs and provides Record/Replay capability.
    """

    _instance: Optional["Tracer"] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Singleton pattern for global tracer."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, exporters: Optional[List[SpanExporter]] = None):
        if hasattr(self, '_initialized'):
            return
        self._initialized = True

        self._exporters = exporters or [ConsoleExporter()]
        self._active_spans: Dict[str, Span] = {}
        self._completed_spans: List[Span] = []
        self._context_var = threading.local()
        self._lock = threading.Lock()
        self._record_mode = False
        self._recorded_traces: List[Dict] = []

    @property
    def current_context(self) -> Optional[RequestContext]:
        """Get current request context."""
        return getattr(self._context_var, 'context', None)

    @current_context.setter
    def current_context(self, ctx: RequestContext):
        """Set current request context."""
        self._context_var.context = ctx

    def start_span(
        self,
        name: str,
        kind: SpanKind = SpanKind.INTERNAL,
        attributes: Optional[Dict[str, Any]] = None,
        context: Optional[RequestContext] = None
    ) -> Span:
        """Start a new span."""
        ctx = context or self.current_context
        if ctx is None:
            ctx = RequestContext.new()
            self.current_context = ctx

        span = Span(
            span_id=str(uuid.uuid4())[:16],
            trace_id=ctx.trace_id,
            parent_span_id=ctx.parent_span_id,
            name=name,
            kind=kind,
            start_time=time.time(),
            attributes=attributes or {}
        )

        with self._lock:
            self._active_spans[span.span_id] = span

        # Update context with new parent
        self.current_context = ctx.child(span.span_id)

        return span

    def end_span(self, span: Span, status: SpanStatus = SpanStatus.OK):
        """End a span and export it."""
        span.end()
        span.set_status(status)

        with self._lock:
            if span.span_id in self._active_spans:
                del self._active_spans[span.span_id]
            self._completed_spans.append(span)

            if self._record_mode:
                self._recorded_traces.append(span.to_dict())

        # Export immediately
        for exporter in self._exporters:
            try:
                exporter.export([span])
            except Exception as e:
                logger.error(f"Exporter failed: {e}")

    @contextmanager
    def span(
        self,
        name: str,
        kind: SpanKind = SpanKind.INTERNAL,
        attributes: Optional[Dict[str, Any]] = None
    ):
        """Context manager for creating spans."""
        span = self.start_span(name, kind, attributes)
        try:
            yield span
            self.end_span(span, SpanStatus.OK)
        except Exception as e:
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            self.end_span(span, SpanStatus.ERROR)
            raise

    @contextmanager
    def request(self, name: str, user_id: Optional[str] = None):
        """Context manager for tracking a full request."""
        ctx = RequestContext.new(user_id=user_id)
        self.current_context = ctx

        with self.span(name, SpanKind.SERVER, {"request_id": ctx.request_id}):
            yield ctx

    # Record/Replay functionality
    def start_recording(self):
        """Start recording all traces for replay."""
        self._record_mode = True
        self._recorded_traces = []
        logger.info("Trace recording started")

    def stop_recording(self) -> List[Dict]:
        """Stop recording and return recorded traces."""
        self._record_mode = False
        traces = self._recorded_traces.copy()
        self._recorded_traces = []
        logger.info(f"Trace recording stopped: {len(traces)} spans recorded")
        return traces

    def save_recording(self, file_path: str):
        """Save recorded traces to file."""
        traces = self.stop_recording()
        with open(file_path, 'w') as f:
            json.dump(traces, f, indent=2)
        logger.info(f"Traces saved to {file_path}")

    def load_recording(self, file_path: str) -> List[Dict]:
        """Load recorded traces from file."""
        with open(file_path, 'r') as f:
            return json.load(f)

    def replay(self, traces: List[Dict], callback=None):
        """Replay recorded traces for debugging/testing."""
        logger.info(f"Replaying {len(traces)} spans")
        for trace in traces:
            if callback:
                callback(trace)
            else:
                print(f"[REPLAY] {trace['name']} | {trace['duration_ms']:.2f}ms")

    def get_trace(self, trace_id: str) -> List[Span]:
        """Get all spans for a trace ID."""
        with self._lock:
            return [s for s in self._completed_spans if s.trace_id == trace_id]

    def clear(self):
        """Clear all completed spans."""
        with self._lock:
            self._completed_spans.clear()


# Global tracer instance
_tracer: Optional[Tracer] = None

def get_tracer() -> Tracer:
    """Get the global tracer instance."""
    global _tracer
    if _tracer is None:
        _tracer = Tracer()
    return _tracer

def trace(name: str, kind: SpanKind = SpanKind.INTERNAL):
    """Decorator for tracing functions."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.span(name, kind):
                return func(*args, **kwargs)
        return wrapper
    return decorator
