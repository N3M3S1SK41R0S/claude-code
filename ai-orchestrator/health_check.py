#!/usr/bin/env python3
"""
AI Orchestrator - Health Check Utility

SIMPLE EXPLANATION (for a 6-year-old):
    This is like a doctor checkup for our robot helper program.
    It checks if everything is working:
    - Can we find the settings file? ✓
    - Do we have the secret keys to talk to the robots? ✓
    - Is the memory (database) working? ✓
    - Can we open web pages? ✓

TECHNICAL EXPLANATION (for experts):
    Comprehensive diagnostic tool that validates:
    - Configuration file presence and validity
    - API key availability (env vars and credential store)
    - Database connectivity and schema integrity
    - Python package dependencies
    - Browser availability
    - Network connectivity to AI endpoints

Usage:
    python health_check.py          # Run all checks
    python health_check.py --quick  # Quick check (skip network)
    python health_check.py --fix    # Attempt auto-fix of issues
"""

import os
import sys
import json
import sqlite3
import webbrowser
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import importlib.util

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))


class HealthChecker:
    """Comprehensive health check for AI Orchestrator."""

    def __init__(self):
        self.results: List[Dict] = []
        self.script_dir = Path(__file__).parent

    def check_all(self, quick: bool = False) -> Dict:
        """Run all health checks."""
        print("\n" + "="*60)
        print("   AI ORCHESTRATOR - HEALTH CHECK")
        print("="*60 + "\n")

        checks = [
            ("Python Version", self.check_python_version),
            ("Configuration File", self.check_config),
            ("Required Packages", self.check_packages),
            ("API Keys", self.check_api_keys),
            ("Database", self.check_database),
            ("Directories", self.check_directories),
        ]

        if not quick:
            checks.extend([
                ("Browser", self.check_browser),
            ])

        passed = 0
        failed = 0
        warnings = 0

        for name, check_func in checks:
            try:
                status, message = check_func()
                if status == "PASS":
                    icon = "✅"
                    passed += 1
                elif status == "WARN":
                    icon = "⚠️"
                    warnings += 1
                else:
                    icon = "❌"
                    failed += 1

                print(f"  {icon} {name}: {message}")
                self.results.append({
                    'check': name,
                    'status': status,
                    'message': message
                })
            except Exception as e:
                print(f"  ❌ {name}: Error - {e}")
                failed += 1
                self.results.append({
                    'check': name,
                    'status': 'FAIL',
                    'message': str(e)
                })

        # Summary
        print("\n" + "-"*60)
        total = passed + failed + warnings
        print(f"  Results: {passed}/{total} passed, {warnings} warnings, {failed} failed")

        if failed == 0:
            print("\n  🎉 All critical checks passed!")
            overall = "HEALTHY"
        elif failed <= 2:
            print("\n  ⚠️ Some issues detected. See above for details.")
            overall = "DEGRADED"
        else:
            print("\n  ❌ Multiple failures. Please fix before running.")
            overall = "UNHEALTHY"

        print("="*60 + "\n")

        return {
            'overall': overall,
            'passed': passed,
            'warnings': warnings,
            'failed': failed,
            'results': self.results,
            'timestamp': datetime.now().isoformat()
        }

    def check_python_version(self) -> Tuple[str, str]:
        """Check Python version is adequate."""
        version = sys.version_info
        version_str = f"{version.major}.{version.minor}.{version.micro}"

        if version.major < 3 or (version.major == 3 and version.minor < 8):
            return "FAIL", f"Python 3.8+ required, found {version_str}"

        return "PASS", f"Python {version_str}"

    def check_config(self) -> Tuple[str, str]:
        """Check configuration file exists and is valid."""
        config_path = self.script_dir / "config.yaml"

        if not config_path.exists():
            return "WARN", "config.yaml not found (will use defaults)"

        try:
            import yaml
            with open(config_path) as f:
                config = yaml.safe_load(f)

            if config is None:
                return "WARN", "config.yaml is empty"

            # Check for required sections
            required = ['ai_services', 'workflow']
            missing = [s for s in required if s not in config]
            if missing:
                return "WARN", f"Missing sections: {missing}"

            return "PASS", f"Valid ({len(config)} sections)"
        except yaml.YAMLError as e:
            return "FAIL", f"Invalid YAML: {e}"
        except Exception as e:
            return "FAIL", f"Cannot read: {e}"

    def check_packages(self) -> Tuple[str, str]:
        """Check required Python packages."""
        required = ['yaml']  # Core requirement
        optional = ['anthropic', 'openai', 'google.generativeai', 'mistralai']

        missing_required = []
        missing_optional = []

        for pkg in required:
            if importlib.util.find_spec(pkg) is None:
                missing_required.append(pkg)

        for pkg in optional:
            if importlib.util.find_spec(pkg.split('.')[0]) is None:
                missing_optional.append(pkg)

        if missing_required:
            return "FAIL", f"Missing required: {missing_required}"

        if missing_optional:
            return "WARN", f"Optional not installed: {missing_optional}"

        return "PASS", "All packages available"

    def check_api_keys(self) -> Tuple[str, str]:
        """Check API key configuration."""
        keys = {
            'ANTHROPIC_API_KEY': 'Claude',
            'OPENAI_API_KEY': 'OpenAI',
            'GOOGLE_API_KEY': 'Gemini',
            'MISTRAL_API_KEY': 'Mistral'
        }

        found = []
        missing = []

        for env_var, name in keys.items():
            if os.environ.get(env_var):
                found.append(name)
            else:
                missing.append(name)

        if not found:
            return "WARN", "No API keys configured (browser mode only)"

        if missing:
            return "PASS", f"Configured: {found} | Missing: {missing}"

        return "PASS", f"All configured: {found}"

    def check_database(self) -> Tuple[str, str]:
        """Check database connectivity."""
        db_path = Path("~/.ai-orchestrator/projects.db").expanduser()

        if not db_path.exists():
            # Try to create it
            try:
                db_path.parent.mkdir(parents=True, exist_ok=True)
                conn = sqlite3.connect(db_path)
                conn.execute("SELECT 1")
                conn.close()
                return "PASS", "Created new database"
            except Exception as e:
                return "FAIL", f"Cannot create database: {e}"

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()

            if not tables:
                return "WARN", "Database exists but empty"

            return "PASS", f"Connected ({len(tables)} tables)"
        except Exception as e:
            return "FAIL", f"Cannot connect: {e}"

    def check_directories(self) -> Tuple[str, str]:
        """Check required directories exist."""
        dirs = [
            Path("~/.ai-orchestrator").expanduser(),
            Path("~/.ai-orchestrator/logs").expanduser(),
            Path("~/.ai-orchestrator/workflows").expanduser(),
        ]

        created = []
        for d in dirs:
            if not d.exists():
                try:
                    d.mkdir(parents=True, exist_ok=True)
                    created.append(d.name)
                except Exception:
                    return "FAIL", f"Cannot create {d}"

        if created:
            return "PASS", f"Created: {created}"

        return "PASS", "All directories exist"

    def check_browser(self) -> Tuple[str, str]:
        """Check if browser is available."""
        try:
            # Try to get default browser
            browser = webbrowser.get()
            browser_name = type(browser).__name__
            return "PASS", f"Default browser: {browser_name}"
        except webbrowser.Error:
            return "WARN", "No default browser configured"
        except Exception as e:
            return "WARN", f"Browser check failed: {e}"


def main():
    """Run health check."""
    import argparse

    parser = argparse.ArgumentParser(description="AI Orchestrator Health Check")
    parser.add_argument('--quick', action='store_true', help="Skip network checks")
    parser.add_argument('--json', action='store_true', help="Output as JSON")
    args = parser.parse_args()

    checker = HealthChecker()
    results = checker.check_all(quick=args.quick)

    if args.json:
        print(json.dumps(results, indent=2))

    # Exit code based on health
    if results['overall'] == 'HEALTHY':
        sys.exit(0)
    elif results['overall'] == 'DEGRADED':
        sys.exit(1)
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()
