"""
NEMESIS Verifier - Critic Layer for output validation and quality assurance.
Implements mandatory verification before any output is returned to users.
"""
import re
import json
import time
import hashlib
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable, Union
from enum import Enum
from abc import ABC, abstractmethod

from .tracer import get_tracer, SpanKind

logger = logging.getLogger(__name__)


class VerificationStatus(Enum):
    """Status of verification."""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    SKIPPED = "skipped"


class VerificationType(Enum):
    """Types of verification checks."""
    SYNTAX = "syntax"           # Syntax validation
    SCHEMA = "schema"           # Schema compliance
    SECURITY = "security"       # Security checks
    QUALITY = "quality"         # Quality metrics
    CONSISTENCY = "consistency" # Internal consistency
    FACTUAL = "factual"         # Factual accuracy
    SAFETY = "safety"           # Safety checks


@dataclass
class VerificationResult:
    """Result of a verification check."""
    status: VerificationStatus
    check_name: str
    check_type: VerificationType
    message: str
    confidence: float = 1.0  # 0.0 to 1.0
    details: Dict[str, Any] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)
    execution_time_ms: float = 0.0

    @property
    def passed(self) -> bool:
        return self.status == VerificationStatus.PASSED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "check_name": self.check_name,
            "check_type": self.check_type.value,
            "message": self.message,
            "confidence": self.confidence,
            "details": self.details,
            "suggestions": self.suggestions,
            "execution_time_ms": self.execution_time_ms
        }


class VerificationCheck(ABC):
    """Base class for verification checks."""

    name: str = "base_check"
    check_type: VerificationType = VerificationType.QUALITY

    @abstractmethod
    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        """Run the verification check."""
        pass


class JSONSchemaCheck(VerificationCheck):
    """Verify content against JSON schema."""

    name = "json_schema"
    check_type = VerificationType.SCHEMA

    def __init__(self, schema: Dict[str, Any]):
        self.schema = schema

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()
        try:
            # Simple schema validation (could use jsonschema library for full validation)
            if isinstance(content, str):
                content = json.loads(content)

            required = self.schema.get("required", [])
            for field in required:
                if field not in content:
                    return VerificationResult(
                        status=VerificationStatus.FAILED,
                        check_name=self.name,
                        check_type=self.check_type,
                        message=f"Missing required field: {field}",
                        execution_time_ms=(time.time() - start) * 1000
                    )

            return VerificationResult(
                status=VerificationStatus.PASSED,
                check_name=self.name,
                check_type=self.check_type,
                message="Schema validation passed",
                execution_time_ms=(time.time() - start) * 1000
            )
        except json.JSONDecodeError as e:
            return VerificationResult(
                status=VerificationStatus.FAILED,
                check_name=self.name,
                check_type=self.check_type,
                message=f"Invalid JSON: {e}",
                execution_time_ms=(time.time() - start) * 1000
            )


class SecurityCheck(VerificationCheck):
    """Check for security issues in content."""

    name = "security"
    check_type = VerificationType.SECURITY

    DANGEROUS_PATTERNS = [
        (r'rm\s+-rf\s+/', "Dangerous rm command detected"),
        (r'eval\s*\(', "Eval usage detected"),
        (r'exec\s*\(', "Exec usage detected"),
        (r'__import__\s*\(', "Dynamic import detected"),
        (r'subprocess\.call.*shell\s*=\s*True', "Shell injection risk"),
        (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password detected"),
        (r'api[_-]?key\s*=\s*["\'][^"\']+["\']', "Hardcoded API key detected"),
    ]

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()
        content_str = str(content)
        issues = []

        for pattern, message in self.DANGEROUS_PATTERNS:
            if re.search(pattern, content_str, re.IGNORECASE):
                issues.append(message)

        if issues:
            return VerificationResult(
                status=VerificationStatus.FAILED,
                check_name=self.name,
                check_type=self.check_type,
                message=f"Security issues found: {len(issues)}",
                details={"issues": issues},
                suggestions=["Review and fix security issues before proceeding"],
                execution_time_ms=(time.time() - start) * 1000
            )

        return VerificationResult(
            status=VerificationStatus.PASSED,
            check_name=self.name,
            check_type=self.check_type,
            message="No security issues detected",
            execution_time_ms=(time.time() - start) * 1000
        )


class SafetyCheck(VerificationCheck):
    """Check for safety issues in AI output."""

    name = "safety"
    check_type = VerificationType.SAFETY

    UNSAFE_PATTERNS = [
        (r'how to (make|create|build) (a |an )?(bomb|weapon|explosive)', "Weapon instructions"),
        (r'(hack|break into|exploit) .* (system|account|server)', "Hacking instructions"),
        (r'(steal|fraud|scam)', "Fraud/theft content"),
    ]

    def __init__(self, custom_patterns: List[tuple] = None):
        self.patterns = self.UNSAFE_PATTERNS + (custom_patterns or [])

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()
        content_str = str(content).lower()

        for pattern, description in self.patterns:
            if re.search(pattern, content_str, re.IGNORECASE):
                return VerificationResult(
                    status=VerificationStatus.FAILED,
                    check_name=self.name,
                    check_type=self.check_type,
                    message=f"Safety violation: {description}",
                    execution_time_ms=(time.time() - start) * 1000
                )

        return VerificationResult(
            status=VerificationStatus.PASSED,
            check_name=self.name,
            check_type=self.check_type,
            message="Content passed safety checks",
            execution_time_ms=(time.time() - start) * 1000
        )


class QualityCheck(VerificationCheck):
    """Check content quality metrics."""

    name = "quality"
    check_type = VerificationType.QUALITY

    def __init__(
        self,
        min_length: int = 10,
        max_length: int = 100000,
        required_fields: List[str] = None
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.required_fields = required_fields or []

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()
        content_str = str(content)
        issues = []

        if len(content_str) < self.min_length:
            issues.append(f"Content too short: {len(content_str)} < {self.min_length}")

        if len(content_str) > self.max_length:
            issues.append(f"Content too long: {len(content_str)} > {self.max_length}")

        # Check for required keywords/sections
        for field in self.required_fields:
            if field.lower() not in content_str.lower():
                issues.append(f"Missing required section: {field}")

        if issues:
            return VerificationResult(
                status=VerificationStatus.WARNING,
                check_name=self.name,
                check_type=self.check_type,
                message=f"Quality issues: {len(issues)}",
                details={"issues": issues},
                execution_time_ms=(time.time() - start) * 1000
            )

        return VerificationResult(
            status=VerificationStatus.PASSED,
            check_name=self.name,
            check_type=self.check_type,
            message="Quality checks passed",
            execution_time_ms=(time.time() - start) * 1000
        )


class ConsistencyCheck(VerificationCheck):
    """Check internal consistency of content."""

    name = "consistency"
    check_type = VerificationType.CONSISTENCY

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()

        # Check for contradictions (simplified)
        content_str = str(content).lower()

        # Simple contradiction detection
        contradictions = []
        if "always" in content_str and "never" in content_str:
            contradictions.append("Potential always/never contradiction")
        if "must" in content_str and "optional" in content_str:
            contradictions.append("Potential must/optional contradiction")

        status = VerificationStatus.PASSED
        if contradictions:
            status = VerificationStatus.WARNING

        return VerificationResult(
            status=status,
            check_name=self.name,
            check_type=self.check_type,
            message="Consistency check complete",
            details={"potential_contradictions": contradictions},
            confidence=0.7 if contradictions else 0.9,
            execution_time_ms=(time.time() - start) * 1000
        )


class CodeSyntaxCheck(VerificationCheck):
    """Verify code syntax for common languages."""

    name = "code_syntax"
    check_type = VerificationType.SYNTAX

    def __init__(self, language: str = "python"):
        self.language = language

    def verify(self, content: Any, context: Dict[str, Any]) -> VerificationResult:
        start = time.time()
        code = str(content)

        if self.language == "python":
            try:
                import ast
                ast.parse(code)
                return VerificationResult(
                    status=VerificationStatus.PASSED,
                    check_name=self.name,
                    check_type=self.check_type,
                    message="Python syntax is valid",
                    execution_time_ms=(time.time() - start) * 1000
                )
            except SyntaxError as e:
                return VerificationResult(
                    status=VerificationStatus.FAILED,
                    check_name=self.name,
                    check_type=self.check_type,
                    message=f"Python syntax error: {e}",
                    details={"line": e.lineno, "offset": e.offset},
                    execution_time_ms=(time.time() - start) * 1000
                )

        elif self.language == "json":
            try:
                json.loads(code)
                return VerificationResult(
                    status=VerificationStatus.PASSED,
                    check_name=self.name,
                    check_type=self.check_type,
                    message="JSON syntax is valid",
                    execution_time_ms=(time.time() - start) * 1000
                )
            except json.JSONDecodeError as e:
                return VerificationResult(
                    status=VerificationStatus.FAILED,
                    check_name=self.name,
                    check_type=self.check_type,
                    message=f"JSON syntax error: {e}",
                    execution_time_ms=(time.time() - start) * 1000
                )

        return VerificationResult(
            status=VerificationStatus.SKIPPED,
            check_name=self.name,
            check_type=self.check_type,
            message=f"Unsupported language: {self.language}",
            execution_time_ms=(time.time() - start) * 1000
        )


@dataclass
class VerificationReport:
    """Complete verification report."""
    content_hash: str
    timestamp: float
    results: List[VerificationResult]
    overall_status: VerificationStatus
    total_time_ms: float

    @property
    def passed(self) -> bool:
        return self.overall_status in [VerificationStatus.PASSED, VerificationStatus.WARNING]

    @property
    def failed_checks(self) -> List[VerificationResult]:
        return [r for r in self.results if r.status == VerificationStatus.FAILED]

    @property
    def warnings(self) -> List[VerificationResult]:
        return [r for r in self.results if r.status == VerificationStatus.WARNING]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content_hash": self.content_hash,
            "timestamp": self.timestamp,
            "overall_status": self.overall_status.value,
            "total_time_ms": self.total_time_ms,
            "results": [r.to_dict() for r in self.results],
            "summary": {
                "total_checks": len(self.results),
                "passed": len([r for r in self.results if r.passed]),
                "failed": len(self.failed_checks),
                "warnings": len(self.warnings)
            }
        }


class Verifier:
    """
    Central verification layer for NEMESIS.
    Runs all configured checks on content before output.
    """

    def __init__(self, checks: Optional[List[VerificationCheck]] = None):
        self.checks = checks or [
            SecurityCheck(),
            SafetyCheck(),
            QualityCheck(),
            ConsistencyCheck()
        ]
        self.tracer = get_tracer()
        self._verification_history: List[VerificationReport] = []

    def add_check(self, check: VerificationCheck):
        """Add a verification check."""
        self.checks.append(check)

    def remove_check(self, check_name: str):
        """Remove a verification check by name."""
        self.checks = [c for c in self.checks if c.name != check_name]

    def verify(
        self,
        content: Any,
        context: Optional[Dict[str, Any]] = None,
        required_checks: Optional[List[str]] = None
    ) -> VerificationReport:
        """
        Run all verification checks on content.
        Returns a complete verification report.
        """
        start_time = time.time()
        context = context or {}

        # Generate content hash for tracking
        content_str = str(content)
        content_hash = hashlib.sha256(content_str.encode()).hexdigest()[:16]

        with self.tracer.span("verifier.verify", SpanKind.INTERNAL) as span:
            span.set_attribute("content_hash", content_hash)

            results = []
            checks_to_run = self.checks

            if required_checks:
                checks_to_run = [c for c in self.checks if c.name in required_checks]

            for check in checks_to_run:
                try:
                    result = check.verify(content, context)
                    results.append(result)
                    span.add_event(f"check.{check.name}", {
                        "status": result.status.value,
                        "time_ms": result.execution_time_ms
                    })
                except Exception as e:
                    logger.error(f"Check {check.name} failed: {e}")
                    results.append(VerificationResult(
                        status=VerificationStatus.FAILED,
                        check_name=check.name,
                        check_type=check.check_type,
                        message=f"Check error: {e}"
                    ))

            # Determine overall status
            if any(r.status == VerificationStatus.FAILED for r in results):
                overall_status = VerificationStatus.FAILED
            elif any(r.status == VerificationStatus.WARNING for r in results):
                overall_status = VerificationStatus.WARNING
            else:
                overall_status = VerificationStatus.PASSED

            report = VerificationReport(
                content_hash=content_hash,
                timestamp=time.time(),
                results=results,
                overall_status=overall_status,
                total_time_ms=(time.time() - start_time) * 1000
            )

            self._verification_history.append(report)
            span.set_attribute("overall_status", overall_status.value)

            return report

    def verify_or_raise(self, content: Any, context: Optional[Dict[str, Any]] = None):
        """Verify content and raise exception if failed."""
        report = self.verify(content, context)
        if not report.passed:
            failed = report.failed_checks
            raise VerificationError(
                f"Verification failed: {[f.message for f in failed]}",
                report
            )
        return report

    def get_history(self, limit: int = 100) -> List[VerificationReport]:
        """Get recent verification history."""
        return self._verification_history[-limit:]


class VerificationError(Exception):
    """Exception raised when verification fails."""

    def __init__(self, message: str, report: VerificationReport):
        super().__init__(message)
        self.report = report


# Convenience decorator for automatic verification
def verified(checks: Optional[List[str]] = None):
    """Decorator to automatically verify function output."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            verifier = Verifier()
            report = verifier.verify(result, required_checks=checks)
            if not report.passed:
                logger.warning(f"Verification warnings for {func.__name__}: {report.warnings}")
            return result
        return wrapper
    return decorator
