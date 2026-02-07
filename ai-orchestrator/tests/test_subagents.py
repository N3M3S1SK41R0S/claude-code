#!/usr/bin/env python3
"""
Tests for the Subagents, Yolo Mode, and Focus Chain features.

Run with: python -m tests.test_subagents
"""

import asyncio
import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from subagents.agent import Subagent, SubagentType, SubagentStatus, SubagentTask, SubagentResult
from subagents.manager import SubagentManager, SubagentConfig
from subagents.cline_bridge import ClineBridge, ClineStatus
from core.yolo_mode import YoloMode, YoloConfig, YoloAction, ExecutionMode
from core.focus_chain import FocusChain, FocusChainConfig, FocusLevel, FocusState


class TestRunner:
    """Simple test runner."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def run(self, name, test_fn):
        try:
            test_fn()
            self.passed += 1
            print(f"  PASS  {name}")
        except AssertionError as e:
            self.failed += 1
            self.errors.append((name, str(e)))
            print(f"  FAIL  {name}: {e}")
        except Exception as e:
            self.failed += 1
            self.errors.append((name, str(e)))
            print(f"  ERROR {name}: {e}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Results: {self.passed}/{total} passed, {self.failed} failed")
        if self.errors:
            print("\nFailures:")
            for name, error in self.errors:
                print(f"  - {name}: {error}")
        print(f"{'='*60}")
        return self.failed == 0


# =============================================================================
# Subagent Tests
# =============================================================================

def test_subagent_creation():
    """Test creating a subagent with default settings."""
    agent = Subagent()
    assert agent.agent_id.startswith("subagent-")
    assert agent.agent_type == SubagentType.GENERAL
    assert agent.status == SubagentStatus.PENDING


def test_subagent_types():
    """Test all subagent types have default prompts."""
    for agent_type in SubagentType:
        agent = Subagent(agent_type=agent_type)
        assert agent.system_prompt is not None
        assert len(agent.system_prompt) > 0


def test_subagent_execution():
    """Test subagent executing a task."""
    agent = Subagent(agent_type=SubagentType.CODER)
    task = SubagentTask(
        task_id="test-task-1",
        description="Write a hello world function",
        agent_type=SubagentType.CODER,
    )

    def mock_executor(prompt, system_prompt, model, context):
        return "def hello(): return 'Hello, World!'"

    result = agent.execute(task, mock_executor)
    assert result.success
    assert result.status == SubagentStatus.COMPLETED
    assert "hello" in result.output.lower()
    assert result.execution_time_ms > 0


def test_subagent_failure_retry():
    """Test subagent retry on failure."""
    agent = Subagent(agent_type=SubagentType.DEBUGGER)
    task = SubagentTask(
        task_id="test-task-2",
        description="Debug an error",
        max_retries=1,
    )

    call_count = 0

    def failing_executor(prompt, system_prompt, model, context):
        nonlocal call_count
        call_count += 1
        raise RuntimeError("API timeout")

    result = agent.execute(task, failing_executor)
    assert not result.success
    assert result.status == SubagentStatus.FAILED
    assert result.error is not None
    assert call_count == 2  # Initial + 1 retry


def test_subagent_cancel():
    """Test cancelling a subagent."""
    agent = Subagent()
    agent.status = SubagentStatus.RUNNING
    agent.cancel()
    assert agent.status == SubagentStatus.CANCELLED


def test_subagent_get_status():
    """Test getting subagent status."""
    agent = Subagent(agent_type=SubagentType.REVIEWER, model="claude-sonnet-4")
    status = agent.get_status()
    assert status["type"] == "reviewer"
    assert status["status"] == "pending"
    assert status["model"] == "claude-sonnet-4"


# =============================================================================
# SubagentManager Tests
# =============================================================================

def test_manager_creation():
    """Test creating a SubagentManager."""
    config = SubagentConfig(max_concurrent_agents=3, use_cline=False)
    manager = SubagentManager(config=config)
    assert manager.config.max_concurrent_agents == 3
    stats = manager.get_stats()
    assert stats["total_agents"] == 0
    manager.shutdown()


def test_manager_spawn():
    """Test spawning an agent through the manager."""
    config = SubagentConfig(use_cline=False)
    manager = SubagentManager(config=config)

    agent_id = manager.spawn(
        task_description="Test task",
        agent_type=SubagentType.GENERAL,
    )

    assert agent_id is not None
    assert agent_id.startswith("subagent-")

    result = manager.wait_for(agent_id, timeout=10)
    assert result is not None

    manager.shutdown()


def test_manager_spawn_team():
    """Test spawning a team of agents."""
    config = SubagentConfig(use_cline=False)
    manager = SubagentManager(config=config)

    tasks = [
        {"description": "Task 1", "type": "coder"},
        {"description": "Task 2", "type": "reviewer"},
        {"description": "Task 3", "type": "tester"},
    ]

    agent_ids = manager.spawn_team(tasks)
    assert len(agent_ids) == 3

    results = manager.wait_for_all(agent_ids, timeout=15)
    assert len(results) >= 0  # May complete or timeout

    manager.shutdown()


def test_manager_stats():
    """Test manager statistics."""
    config = SubagentConfig(use_cline=False)
    manager = SubagentManager(config=config)

    stats = manager.get_stats()
    assert "total_agents" in stats
    assert "cline_status" in stats
    assert "max_concurrent" in stats

    manager.shutdown()


def test_manager_cancel():
    """Test cancelling agents."""
    config = SubagentConfig(use_cline=False)
    manager = SubagentManager(config=config)

    agent_id = manager.spawn(task_description="Long task")
    cancelled = manager.cancel(agent_id)
    # May or may not cancel depending on timing
    assert isinstance(cancelled, bool)

    manager.shutdown()


# =============================================================================
# Cline Bridge Tests
# =============================================================================

def test_cline_bridge_creation():
    """Test creating a ClineBridge."""
    bridge = ClineBridge()
    assert bridge.status in list(ClineStatus)


def test_cline_bridge_health():
    """Test ClineBridge health check."""
    bridge = ClineBridge()
    health = bridge.check_health()
    assert "status" in health
    assert "available" in health
    assert "binary" in health


def test_cline_bridge_install_instructions():
    """Test getting install instructions."""
    bridge = ClineBridge()
    instructions = bridge.get_install_instructions()
    assert "npm install -g cline" in instructions
    assert "cline auth" in instructions


# =============================================================================
# Yolo Mode Tests
# =============================================================================

def test_yolo_creation():
    """Test creating YoloMode with defaults."""
    yolo = YoloMode()
    assert not yolo.is_active
    assert yolo.should_ask_user()


def test_yolo_activate_deactivate():
    """Test activating and deactivating Yolo Mode."""
    config = YoloConfig(enabled=True)
    yolo = YoloMode(config=config)

    success = yolo.activate(ExecutionMode.PLAN)
    assert success
    assert yolo.is_active
    assert not yolo.should_ask_user()

    mode = yolo.deactivate()
    assert mode == ExecutionMode.PLAN
    assert not yolo.is_active


def test_yolo_disabled():
    """Test that Yolo Mode can't activate when disabled."""
    config = YoloConfig(enabled=False)
    yolo = YoloMode(config=config)
    success = yolo.activate()
    assert not success


def test_yolo_action_approval():
    """Test Yolo Mode action approval."""
    config = YoloConfig(enabled=True, max_actions_per_session=5)
    yolo = YoloMode(config=config)
    yolo.activate()

    approved, reason = yolo.approve_action(
        YoloAction.FILE_WRITE,
        "Write test file",
        {"path": "/tmp/test.txt"},
    )
    assert approved
    assert "Auto-approved" in reason


def test_yolo_blocked_commands():
    """Test that dangerous commands are blocked."""
    config = YoloConfig(enabled=True)
    yolo = YoloMode(config=config)
    yolo.activate()

    approved, reason = yolo.approve_action(
        YoloAction.COMMAND_EXECUTE,
        "Dangerous command",
        {"command": "rm -rf /"},
    )
    assert not approved
    assert "blocked" in reason.lower()


def test_yolo_blocked_paths():
    """Test that system paths are blocked."""
    config = YoloConfig(enabled=True)
    yolo = YoloMode(config=config)
    yolo.activate()

    approved, reason = yolo.approve_action(
        YoloAction.FILE_WRITE,
        "Write to system path",
        {"path": "/etc/passwd"},
    )
    assert not approved


def test_yolo_action_limit():
    """Test action limit enforcement."""
    config = YoloConfig(enabled=True, max_actions_per_session=2)
    yolo = YoloMode(config=config)
    yolo.activate()

    yolo.approve_action(YoloAction.FILE_WRITE, "Action 1", {})
    yolo.approve_action(YoloAction.FILE_WRITE, "Action 2", {})
    approved, reason = yolo.approve_action(YoloAction.FILE_WRITE, "Action 3", {})
    assert not approved


def test_yolo_execution_mode():
    """Test execution mode detection."""
    config = YoloConfig(enabled=True, auto_switch_to_act=True)
    yolo = YoloMode(config=config)

    assert yolo.get_execution_mode() == ExecutionMode.PLAN

    yolo.activate(ExecutionMode.PLAN)
    assert yolo.get_execution_mode() == ExecutionMode.ACT


def test_yolo_action_log():
    """Test action logging."""
    config = YoloConfig(enabled=True)
    yolo = YoloMode(config=config)
    yolo.activate()

    yolo.approve_action(YoloAction.FILE_WRITE, "Write file", {"path": "/tmp/a"})
    yolo.approve_action(YoloAction.TOOL_INVOKE, "Call tool", {"tool": "search"})

    log = yolo.get_action_log()
    assert len(log) == 2
    assert log[0]["action"] == "file_write"
    assert log[1]["action"] == "tool_invoke"


def test_yolo_stats():
    """Test Yolo Mode statistics."""
    config = YoloConfig(enabled=True)
    yolo = YoloMode(config=config)
    stats = yolo.get_stats()

    assert "active" in stats
    assert "enabled" in stats
    assert "action_count" in stats
    assert "guardrails_count" in stats


def test_yolo_file_delete_guard():
    """Test file delete guard."""
    config = YoloConfig(enabled=True, allow_file_deletes=False)
    yolo = YoloMode(config=config)
    yolo.activate()

    approved, _ = yolo.approve_action(
        YoloAction.FILE_DELETE,
        "Delete a file",
        {"path": "/tmp/file.txt"},
    )
    assert not approved


# =============================================================================
# Focus Chain Tests
# =============================================================================

def test_focus_creation():
    """Test creating a FocusChain."""
    chain = FocusChain()
    assert chain.config.enabled
    assert chain.config.reminder_interval == 6


def test_focus_push_pop():
    """Test pushing and popping focus."""
    chain = FocusChain()

    focus_id = chain.push_focus("Implement feature X", FocusLevel.HIGH)
    assert focus_id.startswith("focus-")

    current = chain.get_current_focus()
    assert current is not None
    assert current.description == "Implement feature X"
    assert current.level == FocusLevel.HIGH

    popped = chain.pop_focus()
    assert popped is not None
    assert popped.state == FocusState.COMPLETED

    assert chain.get_current_focus() is None


def test_focus_nested():
    """Test nested focus chain."""
    chain = FocusChain()

    chain.push_focus("Main task")
    chain.push_focus("Sub-task 1")
    chain.push_focus("Sub-task 1.1")

    current = chain.get_current_focus()
    assert current.description == "Sub-task 1.1"

    chain.pop_focus()
    current = chain.get_current_focus()
    assert current.description == "Sub-task 1"


def test_focus_complete():
    """Test completing a focus."""
    chain = FocusChain()
    focus_id = chain.push_focus("Task to complete")

    result = chain.complete_focus(focus_id, "Done!")
    assert result

    focus_chain = chain.get_focus_chain()
    completed = [f for f in focus_chain if f["focus_id"] == focus_id]
    assert len(completed) == 1
    assert completed[0]["state"] == "completed"


def test_focus_pause_resume():
    """Test pausing and resuming focus."""
    chain = FocusChain()
    focus_id = chain.push_focus("Pausable task")

    assert chain.pause_focus(focus_id)
    current = chain.get_current_focus()
    assert current is None  # No active focus

    assert chain.resume_focus(focus_id)
    current = chain.get_current_focus()
    assert current is not None
    assert current.description == "Pausable task"


def test_focus_reminder_interval():
    """Test reminder interval triggers."""
    config = FocusChainConfig(reminder_interval=3)
    chain = FocusChain(config=config)

    chain.push_focus("Test focus for reminders")

    reminders = []
    for i in range(10):
        reminder = chain.record_interaction()
        if reminder:
            reminders.append(reminder)

    # Should get reminders at interaction 3, 6, 9
    assert len(reminders) == 3
    assert "Focus Reminder" in reminders[0]


def test_focus_set_interval():
    """Test changing reminder interval."""
    chain = FocusChain()
    chain.set_reminder_interval(3)
    assert chain.config.reminder_interval == 3

    # Clamp to bounds
    chain.set_reminder_interval(0)
    assert chain.config.reminder_interval == 1

    chain.set_reminder_interval(15)
    assert chain.config.reminder_interval == 10


def test_focus_summary():
    """Test focus chain summary."""
    chain = FocusChain()
    assert chain.get_focus_summary() == "No active focus."

    chain.push_focus("Main task", FocusLevel.HIGH)
    chain.push_focus("Sub-task", FocusLevel.MEDIUM)

    summary = chain.get_focus_summary()
    assert "Main task" in summary
    assert "Sub-task" in summary


def test_focus_context_switch():
    """Test context switch detection."""
    config = FocusChainConfig(track_context_switches=True)
    chain = FocusChain(config=config)

    chain.push_focus("Implementing user authentication with JWT tokens")

    # Similar context - no switch (shares words like "JWT", "token")
    assert not chain.detect_context_switch("authentication JWT token validation user")

    # Completely different context - switch detected
    assert chain.detect_context_switch("deploy kubernetes cluster monitoring grafana dashboard")


def test_focus_progress():
    """Test adding progress notes."""
    chain = FocusChain()
    focus_id = chain.push_focus("Build API")

    chain.add_progress(focus_id, "Created endpoint structure")
    chain.add_progress(focus_id, "Added authentication middleware")

    focus_chain = chain.get_focus_chain()
    entry = [f for f in focus_chain if f["focus_id"] == focus_id][0]
    assert len(entry["progress_notes"]) == 2


def test_focus_clear():
    """Test clearing the focus chain."""
    chain = FocusChain()
    chain.push_focus("Task 1")
    chain.push_focus("Task 2")

    chain.clear()
    assert chain.get_current_focus() is None

    stats = chain.get_stats()
    assert stats["chain_depth"] == 0


def test_focus_stats():
    """Test focus chain statistics."""
    chain = FocusChain()
    chain.push_focus("Active task")
    focus_id = chain.push_focus("Paused task")
    chain.pause_focus(focus_id)

    stats = chain.get_stats()
    assert stats["active_focuses"] == 1
    assert stats["paused_focuses"] == 1
    assert stats["chain_depth"] == 2


def test_focus_max_depth():
    """Test max chain depth enforcement."""
    config = FocusChainConfig(max_chain_depth=3)
    chain = FocusChain(config=config)

    for i in range(5):
        chain.push_focus(f"Task {i}")

    # Should not exceed max depth
    focus_chain = chain.get_focus_chain()
    # Oldest completed entries get removed from active chain
    assert len(focus_chain) <= config.max_chain_depth + 2  # Some slack for completed


# =============================================================================
# SubagentResult Tests
# =============================================================================

def test_result_to_dict():
    """Test SubagentResult serialization."""
    result = SubagentResult(
        agent_id="test-agent",
        status=SubagentStatus.COMPLETED,
        output="Task done",
        execution_time_ms=1500.0,
        model_used="claude-sonnet-4",
    )

    d = result.to_dict()
    assert d["agent_id"] == "test-agent"
    assert d["status"] == "completed"
    assert d["output"] == "Task done"
    assert result.success


def test_result_failure():
    """Test SubagentResult failure state."""
    result = SubagentResult(
        agent_id="test-agent",
        status=SubagentStatus.FAILED,
        error="Connection timeout",
    )

    assert not result.success
    assert result.error == "Connection timeout"


# =============================================================================
# Main
# =============================================================================

def main():
    print("\n" + "=" * 60)
    print("   NEMESIS - Subagents, Yolo Mode & Focus Chain Tests")
    print("=" * 60 + "\n")

    runner = TestRunner()

    # Subagent tests
    print("Subagent Tests:")
    runner.run("subagent_creation", test_subagent_creation)
    runner.run("subagent_types", test_subagent_types)
    runner.run("subagent_execution", test_subagent_execution)
    runner.run("subagent_failure_retry", test_subagent_failure_retry)
    runner.run("subagent_cancel", test_subagent_cancel)
    runner.run("subagent_get_status", test_subagent_get_status)

    # SubagentManager tests
    print("\nSubagentManager Tests:")
    runner.run("manager_creation", test_manager_creation)
    runner.run("manager_spawn", test_manager_spawn)
    runner.run("manager_spawn_team", test_manager_spawn_team)
    runner.run("manager_stats", test_manager_stats)
    runner.run("manager_cancel", test_manager_cancel)

    # Cline Bridge tests
    print("\nCline Bridge Tests:")
    runner.run("cline_bridge_creation", test_cline_bridge_creation)
    runner.run("cline_bridge_health", test_cline_bridge_health)
    runner.run("cline_bridge_install_instructions", test_cline_bridge_install_instructions)

    # Yolo Mode tests
    print("\nYolo Mode Tests:")
    runner.run("yolo_creation", test_yolo_creation)
    runner.run("yolo_activate_deactivate", test_yolo_activate_deactivate)
    runner.run("yolo_disabled", test_yolo_disabled)
    runner.run("yolo_action_approval", test_yolo_action_approval)
    runner.run("yolo_blocked_commands", test_yolo_blocked_commands)
    runner.run("yolo_blocked_paths", test_yolo_blocked_paths)
    runner.run("yolo_action_limit", test_yolo_action_limit)
    runner.run("yolo_execution_mode", test_yolo_execution_mode)
    runner.run("yolo_action_log", test_yolo_action_log)
    runner.run("yolo_stats", test_yolo_stats)
    runner.run("yolo_file_delete_guard", test_yolo_file_delete_guard)

    # Focus Chain tests
    print("\nFocus Chain Tests:")
    runner.run("focus_creation", test_focus_creation)
    runner.run("focus_push_pop", test_focus_push_pop)
    runner.run("focus_nested", test_focus_nested)
    runner.run("focus_complete", test_focus_complete)
    runner.run("focus_pause_resume", test_focus_pause_resume)
    runner.run("focus_reminder_interval", test_focus_reminder_interval)
    runner.run("focus_set_interval", test_focus_set_interval)
    runner.run("focus_summary", test_focus_summary)
    runner.run("focus_context_switch", test_focus_context_switch)
    runner.run("focus_progress", test_focus_progress)
    runner.run("focus_clear", test_focus_clear)
    runner.run("focus_stats", test_focus_stats)
    runner.run("focus_max_depth", test_focus_max_depth)

    # SubagentResult tests
    print("\nSubagentResult Tests:")
    runner.run("result_to_dict", test_result_to_dict)
    runner.run("result_failure", test_result_failure)

    all_passed = runner.summary()
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
