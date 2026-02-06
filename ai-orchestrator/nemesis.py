#!/usr/bin/env python3
"""
NEMESIS CLI - Neural Expert Multi-agent Efficient System for Integrated Solutions

Usage:
    nemesis run <task>          Execute a task through the orchestrator
    nemesis route <query>       Get model routing recommendation
    nemesis verify <content>    Verify content through the critic layer
    nemesis memory <action>     Manage long-term memory
    nemesis cache <action>      Manage cache
    nemesis stats               Show system statistics
    nemesis config              Show/edit configuration
    nemesis demo                Run interactive demo
"""
import argparse
import json
import sys
import yaml
import logging
from pathlib import Path
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger('nemesis')

# ANSI colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def color(text: str, c: str) -> str:
    """Apply color to text."""
    return f"{c}{text}{Colors.ENDC}"


# =============================================================================
# CLI Commands
# =============================================================================

def cmd_run(args):
    """Execute a task through the orchestrator."""
    from core.tracer import get_tracer, RequestContext
    from core.router import SmartRouter, RoutingRequest, TaskComplexity
    from core.gateway import ToolGateway
    from core.verifier import Verifier

    print(color("\n=== NEMESIS Task Execution ===", Colors.HEADER))

    task = args.task
    print(f"\nTask: {color(task, Colors.CYAN)}")

    # Initialize components
    tracer = get_tracer()
    router = SmartRouter()
    gateway = ToolGateway()
    verifier = Verifier()

    # Start request tracing
    with tracer.request("nemesis.run") as ctx:
        print(f"Request ID: {color(ctx.request_id[:8], Colors.YELLOW)}")

        # Route to best model
        print(f"\n{color('1. Routing...', Colors.BLUE)}")
        complexity = _detect_complexity(task)
        request = RoutingRequest(
            request_id=ctx.request_id,
            content=task,
            complexity=complexity
        )
        decision = router.route(request)
        print(f"   Model: {color(decision.model.name, Colors.GREEN)}")
        print(f"   Reason: {decision.reason}")
        print(f"   Est. Cost: ${decision.estimated_cost:.4f}")

        # Simulate task execution
        print(f"\n{color('2. Executing...', Colors.BLUE)}")
        result = _simulate_task_execution(task, decision.model.name)
        print(f"   Status: {color('Complete', Colors.GREEN)}")

        # Verify output
        print(f"\n{color('3. Verifying...', Colors.BLUE)}")
        report = verifier.verify(result)
        status_color = Colors.GREEN if report.passed else Colors.RED
        print(f"   Status: {color(report.overall_status.value, status_color)}")
        for check_result in report.results:
            icon = "" if check_result.passed else ""
            print(f"   {icon} {check_result.check_name}: {check_result.message}")

        print(f"\n{color('=== Result ===', Colors.HEADER)}")
        print(result)


def cmd_route(args):
    """Get model routing recommendation."""
    from core.router import SmartRouter

    print(color("\n=== NEMESIS Smart Router ===", Colors.HEADER))

    router = SmartRouter()
    recommendation = router.get_model_recommendation(
        task_description=args.query,
        budget=args.budget
    )

    print(f"\nQuery: {color(args.query, Colors.CYAN)}")
    print(f"\n{color('Recommendation:', Colors.BLUE)}")
    print(f"  Model: {color(recommendation['recommended_model'], Colors.GREEN)}")
    print(f"  Complexity: {recommendation['detected_complexity']}")
    print(f"  Est. Cost: ${recommendation['estimated_cost']:.4f}")
    print(f"  Reason: {recommendation['reason']}")

    if recommendation['alternatives']:
        print(f"\n{color('Alternatives:', Colors.YELLOW)}")
        for alt in recommendation['alternatives']:
            print(f"  - {alt['model']}: {alt['reason']}")


def cmd_verify(args):
    """Verify content through the critic layer."""
    from core.verifier import Verifier, CodeSyntaxCheck

    print(color("\n=== NEMESIS Verifier ===", Colors.HEADER))

    # Read content from file or argument
    if args.file:
        with open(args.file, 'r') as f:
            content = f.read()
    else:
        content = args.content

    # Create verifier with appropriate checks
    verifier = Verifier()

    if args.type == "code":
        verifier.add_check(CodeSyntaxCheck(language="python"))

    print(f"\nVerifying {len(content)} characters...")

    report = verifier.verify(content)

    print(f"\n{color('Verification Report:', Colors.BLUE)}")
    print(f"  Content Hash: {report.content_hash}")
    print(f"  Overall Status: {color(report.overall_status.value, Colors.GREEN if report.passed else Colors.RED)}")
    print(f"  Time: {report.total_time_ms:.2f}ms")

    print(f"\n{color('Checks:', Colors.BLUE)}")
    for result in report.results:
        icon = "" if result.passed else "" if result.status.value == "warning" else ""
        color_code = Colors.GREEN if result.passed else Colors.YELLOW if result.status.value == "warning" else Colors.RED
        print(f"  {icon} {result.check_name}: {color(result.message, color_code)}")

        if result.suggestions:
            for suggestion in result.suggestions:
                print(f"      {suggestion}")


def cmd_memory(args):
    """Manage long-term memory."""
    from memory.ltm import LongTermMemory, MemoryType, AccessLevel

    ltm = LongTermMemory()

    if args.action == "stats":
        print(color("\n=== NEMESIS Memory Stats ===", Colors.HEADER))
        stats = ltm.get_stats()
        print(f"\nTotal Memories: {color(str(stats['total_memories']), Colors.CYAN)}")
        print(f"\n{color('By Type:', Colors.BLUE)}")
        for mem_type, count in stats['by_type'].items():
            print(f"  {mem_type}: {count}")
        print(f"\n{color('By Access Level:', Colors.BLUE)}")
        for level, count in stats['by_access_level'].items():
            print(f"  {level}: {count}")
        print(f"\nAvg Importance: {stats['average_importance']:.2f}")
        print(f"Expiring (24h): {stats['expiring_24h']}")

    elif args.action == "store":
        entry = ltm.store(
            content=args.content,
            memory_type=MemoryType(args.type or "fact"),
            importance=args.importance or 0.5
        )
        print(f"{color('Stored:', Colors.GREEN)} {entry.id}")

    elif args.action == "search":
        print(color(f"\n=== Memory Search: {args.query} ===", Colors.HEADER))
        results = ltm.search(query=args.query, limit=args.limit or 10)
        for entry in results:
            print(f"\n{color(entry.id, Colors.CYAN)} ({entry.memory_type.value})")
            print(f"  Content: {str(entry.content)[:100]}...")
            print(f"  Importance: {entry.importance:.2f} | Access: {entry.access_count}")

    elif args.action == "consolidate":
        ltm.consolidate()
        print(color("Memory consolidation complete", Colors.GREEN))


def cmd_cache(args):
    """Manage cache."""
    from memory.cache import ContextCache

    cache = ContextCache()

    if args.action == "stats":
        print(color("\n=== NEMESIS Cache Stats ===", Colors.HEADER))
        stats = cache.stats()

        for level, level_stats in stats.items():
            print(f"\n{color(level.upper(), Colors.BLUE)} ({level_stats['type']}):")
            print(f"  Entries: {level_stats['entries']}")
            print(f"  Hits: {level_stats['hits']} | Misses: {level_stats['misses']}")
            print(f"  Hit Rate: {level_stats['hit_rate']:.2%}")

    elif args.action == "clear":
        levels = args.levels.split(',') if args.levels else None
        cache.clear(levels)
        print(color("Cache cleared", Colors.GREEN))

    elif args.action == "persist":
        cache.persist()
        print(color("L2 cache persisted to disk", Colors.GREEN))


def cmd_stats(args):
    """Show system statistics."""
    from core.router import SmartRouter

    print(color("\n=== NEMESIS System Statistics ===", Colors.HEADER))

    router = SmartRouter()
    usage = router.get_usage_stats()

    print(f"\n{color('Budget:', Colors.BLUE)}")
    print(f"  Total Spent: ${usage['total_cost']:.4f}")
    print(f"  Limit: ${usage['budget_limit']:.2f}")
    print(f"  Remaining: ${usage['budget_remaining']:.2f}")

    print(f"\n{color('Routing:', Colors.BLUE)}")
    print(f"  Total Routes: {usage['routing_count']}")

    if usage['by_model']:
        print(f"\n{color('By Model:', Colors.BLUE)}")
        for model, cost in usage['by_model'].items():
            print(f"  {model}: ${cost:.4f}")


def cmd_config(args):
    """Show/edit configuration."""
    config_path = Path(__file__).parent / "config.yaml"

    if args.action == "show":
        print(color("\n=== NEMESIS Configuration ===", Colors.HEADER))
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            print(yaml.dump(config, default_flow_style=False, indent=2))
        else:
            print(color("No config.yaml found. Using defaults.", Colors.YELLOW))

    elif args.action == "edit":
        import subprocess
        editor = args.editor or "nano"
        subprocess.call([editor, str(config_path)])

    elif args.action == "reset":
        # Generate default config
        _generate_default_config(config_path)
        print(color(f"Config reset to defaults: {config_path}", Colors.GREEN))


def cmd_demo(args):
    """Run interactive demo."""
    print(color("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🚀 NEMESIS - Neural Expert Multi-agent Efficient System                   ║
║                                                                              ║
║   Interactive Demo                                                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """, Colors.HEADER))

    from core.tracer import get_tracer
    from core.router import SmartRouter, RoutingRequest, TaskComplexity
    from core.gateway import ToolGateway, create_tool_call, RiskLevel, ToolCategory
    from core.verifier import Verifier
    from memory.ltm import LongTermMemory, MemoryType
    from memory.cache import ContextCache

    # Initialize all components
    print(color("Initializing NEMESIS components...", Colors.BLUE))

    tracer = get_tracer()
    router = SmartRouter()
    gateway = ToolGateway()
    verifier = Verifier()
    ltm = LongTermMemory(db_path=":memory:")  # In-memory for demo
    cache = ContextCache()

    # Register demo tools
    gateway.register_tool(
        "calculator",
        lambda expression: eval(expression),
        category=ToolCategory.EXECUTE,
        risk_level=RiskLevel.LOW,
        description="Basic calculator"
    )

    gateway.register_tool(
        "search",
        lambda query: f"Results for: {query}",
        category=ToolCategory.READ,
        risk_level=RiskLevel.LOW,
        description="Web search"
    )

    print(color("All components initialized!", Colors.GREEN))

    # Demo 1: Smart Routing
    print(color("\n=== Demo 1: Smart Routing ===", Colors.HEADER))
    tasks = [
        ("What is 2+2?", TaskComplexity.TRIVIAL),
        ("Explain quantum computing", TaskComplexity.MEDIUM),
        ("Design a distributed system architecture", TaskComplexity.EXPERT)
    ]

    for task, complexity in tasks:
        request = RoutingRequest(
            request_id="demo",
            content=task,
            complexity=complexity
        )
        decision = router.route(request)
        print(f"  '{task[:40]}...'")
        print(f"    -> {color(decision.model.name, Colors.CYAN)} (${decision.estimated_cost:.4f})")

    # Demo 2: Tool Gateway
    print(color("\n=== Demo 2: Tool Gateway ===", Colors.HEADER))

    call = create_tool_call(
        tool_name="calculator",
        parameters={"expression": "42 * 2"},
        request_id="demo",
        agent_id="demo_agent"
    )

    result = gateway.invoke(call)
    print(f"  Calculator: 42 * 2 = {color(str(result.result), Colors.GREEN)}")
    print(f"  Audit ID: {result.audit_id}")

    # Demo 3: Verifier
    print(color("\n=== Demo 3: Content Verification ===", Colors.HEADER))

    test_content = "This is a safe response with no security issues."
    report = verifier.verify(test_content)
    print(f"  Content: '{test_content[:50]}...'")
    print(f"  Status: {color(report.overall_status.value, Colors.GREEN)}")

    # Demo 4: Memory
    print(color("\n=== Demo 4: Long-Term Memory ===", Colors.HEADER))

    entry = ltm.store(
        content={"key": "demo_fact", "value": "NEMESIS was created in 2024"},
        memory_type=MemoryType.FACT,
        importance=0.8
    )
    print(f"  Stored: {color(entry.id, Colors.CYAN)}")

    retrieved = ltm.retrieve(entry.id)
    print(f"  Retrieved: {retrieved.content}")

    # Demo 5: Cache
    print(color("\n=== Demo 5: Multi-Level Cache ===", Colors.HEADER))

    cache.set("demo_key", {"data": "cached_value"}, ttl_seconds=300)
    print(f"  Set: demo_key -> cached_value")

    value = cache.get("demo_key")
    print(f"  Get: {color(str(value), Colors.GREEN)}")

    stats = cache.stats()
    print(f"  L1 hits: {stats['l1']['hits']}")

    # Demo 6: Request Tracing
    print(color("\n=== Demo 6: Distributed Tracing ===", Colors.HEADER))

    tracer.start_recording()

    with tracer.request("demo_request", user_id="demo_user") as ctx:
        print(f"  Request ID: {color(ctx.request_id[:12], Colors.YELLOW)}")

        with tracer.span("processing"):
            with tracer.span("sub_task_1"):
                pass
            with tracer.span("sub_task_2"):
                pass

    traces = tracer.stop_recording()
    print(f"  Recorded {color(str(len(traces)), Colors.CYAN)} spans")

    print(color("\n=== Demo Complete! ===", Colors.GREEN))
    print("\nTry these commands:")
    print("  nemesis run 'Explain machine learning'")
    print("  nemesis route 'Write a Python function'")
    print("  nemesis verify --file script.py --type code")
    print("  nemesis memory stats")
    print("  nemesis cache stats")


# =============================================================================
# Helper Functions
# =============================================================================

def _detect_complexity(task: str) -> "TaskComplexity":
    """Simple complexity detection from task description."""
    from core.router import TaskComplexity

    task_lower = task.lower()

    if any(word in task_lower for word in ['simple', 'basic', 'what is', 'how many']):
        return TaskComplexity.LOW
    elif any(word in task_lower for word in ['explain', 'describe', 'summarize']):
        return TaskComplexity.MEDIUM
    elif any(word in task_lower for word in ['code', 'implement', 'write', 'create']):
        return TaskComplexity.HIGH
    elif any(word in task_lower for word in ['design', 'architect', 'optimize', 'complex']):
        return TaskComplexity.EXPERT

    return TaskComplexity.MEDIUM


def _simulate_task_execution(task: str, model: str) -> str:
    """Simulate task execution (placeholder)."""
    return f"[{model}] Processed task: {task}\n\nThis is a simulated response demonstrating the NEMESIS pipeline."


def _generate_default_config(path: Path):
    """Generate default configuration file."""
    default_config = {
        "nemesis": {
            "version": "1.0.0",
            "environment": "development"
        },
        "routing": {
            "default_strategy": "complexity",
            "budget_limit_daily": 10.0,
            "fallback_model": "claude-haiku"
        },
        "gateway": {
            "rate_limit_per_minute": 120,
            "max_risk_auto_approve": "medium",
            "audit_log_file": "logs/audit.jsonl"
        },
        "verifier": {
            "enabled_checks": ["security", "safety", "quality", "consistency"],
            "fail_on_warning": False
        },
        "memory": {
            "db_path": "data/nemesis_memory.db",
            "default_ttl_hours": 720,
            "encryption_enabled": True
        },
        "cache": {
            "l1_size": 1000,
            "l1_memory_mb": 100,
            "l2_size": 10000,
            "l2_persistence_file": "data/l2_cache.json",
            "l3_dir": ".cache/l3",
            "l3_size_mb": 1000,
            "default_ttl_seconds": 3600
        },
        "tracing": {
            "enabled": True,
            "export_file": "logs/traces.jsonl",
            "sample_rate": 1.0
        },
        "models": {
            "openai": {
                "api_key_env": "OPENAI_API_KEY",
                "enabled_models": ["gpt-4-turbo", "gpt-4o-mini", "gpt-3.5-turbo"]
            },
            "anthropic": {
                "api_key_env": "ANTHROPIC_API_KEY",
                "enabled_models": ["claude-opus-4", "claude-sonnet-4", "claude-haiku"]
            },
            "google": {
                "api_key_env": "GOOGLE_API_KEY",
                "enabled_models": ["gemini-pro"]
            },
            "mistral": {
                "api_key_env": "MISTRAL_API_KEY",
                "enabled_models": ["mistral-large"]
            }
        }
    }

    with open(path, 'w') as f:
        yaml.dump(default_config, f, default_flow_style=False, indent=2)


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="NEMESIS - Neural Expert Multi-agent Efficient System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  nemesis run "Explain machine learning"
  nemesis route "Write a Python function" --budget 0.10
  nemesis verify --file script.py --type code
  nemesis memory stats
  nemesis cache stats
  nemesis demo
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Run command
    run_parser = subparsers.add_parser("run", help="Execute a task")
    run_parser.add_argument("task", help="Task to execute")

    # Route command
    route_parser = subparsers.add_parser("route", help="Get routing recommendation")
    route_parser.add_argument("query", help="Task description")
    route_parser.add_argument("--budget", type=float, help="Maximum budget in $")

    # Verify command
    verify_parser = subparsers.add_parser("verify", help="Verify content")
    verify_parser.add_argument("content", nargs="?", help="Content to verify")
    verify_parser.add_argument("--file", "-f", help="File to verify")
    verify_parser.add_argument("--type", choices=["text", "code", "json"], default="text")

    # Memory command
    memory_parser = subparsers.add_parser("memory", help="Manage memory")
    memory_parser.add_argument("action", choices=["stats", "store", "search", "consolidate"])
    memory_parser.add_argument("--content", help="Content to store")
    memory_parser.add_argument("--query", "-q", help="Search query")
    memory_parser.add_argument("--type", help="Memory type")
    memory_parser.add_argument("--importance", type=float, help="Importance score")
    memory_parser.add_argument("--limit", type=int, help="Result limit")

    # Cache command
    cache_parser = subparsers.add_parser("cache", help="Manage cache")
    cache_parser.add_argument("action", choices=["stats", "clear", "persist"])
    cache_parser.add_argument("--levels", help="Cache levels (comma-separated)")

    # Stats command
    subparsers.add_parser("stats", help="Show statistics")

    # Config command
    config_parser = subparsers.add_parser("config", help="Manage configuration")
    config_parser.add_argument("action", choices=["show", "edit", "reset"], default="show", nargs="?")
    config_parser.add_argument("--editor", help="Editor to use")

    # Demo command
    subparsers.add_parser("demo", help="Run interactive demo")

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Execute command
    commands = {
        "run": cmd_run,
        "route": cmd_route,
        "verify": cmd_verify,
        "memory": cmd_memory,
        "cache": cmd_cache,
        "stats": cmd_stats,
        "config": cmd_config,
        "demo": cmd_demo
    }

    try:
        commands[args.command](args)
    except Exception as e:
        print(color(f"\nError: {e}", Colors.RED))
        logger.exception("Command failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
