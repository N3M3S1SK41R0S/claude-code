"""
Browser Controller
Manages Chrome tabs for parallel AI service interactions.
"""

import logging
import subprocess
import time
import webbrowser
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional
import urllib.parse
import os
import sys

logger = logging.getLogger('Browser-Controller')


class TabStatus(Enum):
    """Status of a browser tab."""
    OPENING = "opening"
    READY = "ready"
    WAITING_INPUT = "waiting_input"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    TIMEOUT = "timeout"


@dataclass
class Tab:
    """Represents a browser tab."""
    id: str
    service_name: str
    url: str
    prompt: str
    status: TabStatus = TabStatus.OPENING
    opened_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    response: Optional[str] = None
    error: Optional[str] = None


class BrowserController:
    """
    Controls Chrome browser for parallel AI interactions.

    Features:
    - Open multiple tabs for different AI services
    - Manage tab lifecycle
    - Copy prompts to clipboard for easy pasting
    - Track tab status and responses
    """

    # AI Service URLs
    AI_URLS = {
        'claude': 'https://claude.ai/new',
        'chatgpt': 'https://chat.openai.com/',
        'gemini': 'https://gemini.google.com/',
        'mistral': 'https://chat.mistral.ai/',
        'perplexity': 'https://www.perplexity.ai/',
        'copilot': 'https://copilot.microsoft.com/',
        'grok': 'https://grok.x.ai/',
        'poe': 'https://poe.com/',
        'you': 'https://you.com/',
        'phind': 'https://www.phind.com/',
        'antigravity': 'https://studio.firebase.google.com/',
    }

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.tabs: Dict[str, Tab] = {}
        self.max_parallel_tabs = self.config.get('parallel_tabs', 8)
        self.tab_delay_ms = self.config.get('tab_delay_ms', 500)
        self.chrome_path = self._detect_chrome_path()

    def _detect_chrome_path(self) -> str:
        """Detect Chrome executable path based on OS."""
        if sys.platform == 'darwin':  # macOS
            paths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium'
            ]
        elif sys.platform == 'win32':  # Windows
            paths = [
                os.path.expandvars(r'%ProgramFiles%\Google\Chrome\Application\chrome.exe'),
                os.path.expandvars(r'%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe'),
                os.path.expandvars(r'%LocalAppData%\Google\Chrome\Application\chrome.exe')
            ]
        else:  # Linux
            paths = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/snap/bin/chromium'
            ]

        for path in paths:
            if os.path.exists(path):
                return path

        # Fallback to system command
        return self.config.get('executable', 'google-chrome')

    def open_tab(self, service: str, prompt: str = "",
                 url_override: str = None) -> Tab:
        """
        Open a new browser tab for an AI service.

        Args:
            service: Name of the AI service
            prompt: Optional prompt to use
            url_override: Override the default URL

        Returns:
            Tab object representing the opened tab
        """
        url = url_override or self.AI_URLS.get(service, service)

        # Some services support URL parameters for initial prompt
        if prompt and self._supports_url_prompt(service):
            url = self._add_prompt_to_url(url, prompt, service)

        tab_id = f"{service}_{int(datetime.now().timestamp() * 1000)}"

        tab = Tab(
            id=tab_id,
            service_name=service,
            url=url,
            prompt=prompt,
            status=TabStatus.OPENING
        )

        try:
            # Try to open with webbrowser module first
            webbrowser.open_new_tab(url)
            tab.status = TabStatus.READY

            # Wait a bit before opening next tab
            time.sleep(self.tab_delay_ms / 1000)

            self.tabs[tab_id] = tab
            logger.info(f"Opened tab for {service}: {tab_id}")

        except Exception as e:
            logger.error(f"Failed to open tab for {service}: {e}")
            tab.status = TabStatus.ERROR
            tab.error = str(e)

        return tab

    def _supports_url_prompt(self, service: str) -> bool:
        """Check if service supports prompt in URL."""
        # Currently limited support
        return service in ['perplexity', 'you', 'phind']

    def _add_prompt_to_url(self, url: str, prompt: str, service: str) -> str:
        """Add prompt to URL if supported."""
        encoded_prompt = urllib.parse.quote(prompt[:500])

        if service == 'perplexity':
            return f"{url}?q={encoded_prompt}"
        elif service == 'you':
            return f"{url}/search?q={encoded_prompt}"
        elif service == 'phind':
            return f"{url}/search?q={encoded_prompt}"

        return url

    def open_multiple_tabs(self, services: List[str], prompt: str,
                           stagger: bool = True) -> List[Tab]:
        """
        Open multiple tabs for parallel AI queries.

        Args:
            services: List of service names
            prompt: Prompt to use for all services
            stagger: Whether to stagger tab openings

        Returns:
            List of Tab objects
        """
        tabs = []
        limit = min(len(services), self.max_parallel_tabs)

        logger.info(f"Opening {limit} tabs for parallel queries...")

        for i, service in enumerate(services[:limit]):
            tab = self.open_tab(service, prompt)
            tabs.append(tab)

            if stagger and i < limit - 1:
                time.sleep(self.tab_delay_ms / 1000)

        return tabs

    def open_claude_tabs(self, count: int, prompts: List[str] = None) -> List[Tab]:
        """
        Open multiple Claude tabs for parallel processing.

        Useful for optimizing timing with multiple Claude conversations.
        """
        tabs = []
        prompts = prompts or [''] * count

        for i in range(min(count, self.max_parallel_tabs)):
            prompt = prompts[i] if i < len(prompts) else ''
            tab = self.open_tab('claude', prompt)
            tab.id = f"claude_{i+1}_{tab.id.split('_')[-1]}"
            tabs.append(tab)

        logger.info(f"Opened {len(tabs)} Claude tabs")
        return tabs

    def get_tab_status(self, tab_id: str) -> Optional[TabStatus]:
        """Get status of a specific tab."""
        tab = self.tabs.get(tab_id)
        return tab.status if tab else None

    def update_tab_status(self, tab_id: str, status: TabStatus,
                           response: str = None):
        """Update tab status and optionally store response."""
        if tab_id in self.tabs:
            self.tabs[tab_id].status = status
            if response:
                self.tabs[tab_id].response = response
            if status == TabStatus.COMPLETED:
                self.tabs[tab_id].completed_at = datetime.now()

    def get_all_tabs(self) -> Dict[str, Tab]:
        """Get all managed tabs."""
        return self.tabs.copy()

    def get_active_tabs(self) -> List[Tab]:
        """Get all tabs that are not completed or errored."""
        return [
            tab for tab in self.tabs.values()
            if tab.status not in [TabStatus.COMPLETED, TabStatus.ERROR, TabStatus.TIMEOUT]
        ]

    def get_completed_tabs(self) -> List[Tab]:
        """Get all completed tabs."""
        return [
            tab for tab in self.tabs.values()
            if tab.status == TabStatus.COMPLETED
        ]

    def open_code_tool(self, tool: str, project_path: str = None) -> bool:
        """
        Open a code tool (Cursor, VS Code, etc.).

        Args:
            tool: Tool name (cursor, vscode, etc.)
            project_path: Optional path to open

        Returns:
            True if successful
        """
        commands = {
            'cursor': ['cursor', project_path] if project_path else ['cursor'],
            'vscode': ['code', project_path] if project_path else ['code'],
            'vscode-insiders': ['code-insiders', project_path] if project_path else ['code-insiders'],
        }

        cmd = commands.get(tool.lower())
        if not cmd:
            logger.warning(f"Unknown code tool: {tool}")
            return False

        try:
            # Filter None values
            cmd = [c for c in cmd if c]
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info(f"Opened {tool}" + (f" with {project_path}" if project_path else ""))
            return True
        except Exception as e:
            logger.error(f"Failed to open {tool}: {e}")
            return False

    def generate_tab_report(self) -> str:
        """Generate a summary report of all tabs."""
        report = "## Browser Tab Status\n\n"
        report += "| Tab ID | Service | Status | Duration |\n"
        report += "|--------|---------|--------|----------|\n"

        for tab in self.tabs.values():
            duration = ""
            if tab.completed_at:
                delta = tab.completed_at - tab.opened_at
                duration = f"{delta.seconds}s"
            elif tab.status != TabStatus.OPENING:
                delta = datetime.now() - tab.opened_at
                duration = f"{delta.seconds}s (ongoing)"

            status_icon = {
                TabStatus.OPENING: "🔄",
                TabStatus.READY: "✅",
                TabStatus.WAITING_INPUT: "⏳",
                TabStatus.PROCESSING: "🔄",
                TabStatus.COMPLETED: "✓",
                TabStatus.ERROR: "❌",
                TabStatus.TIMEOUT: "⏰"
            }.get(tab.status, "?")

            report += f"| {tab.id[:20]} | {tab.service_name} | {status_icon} {tab.status.value} | {duration} |\n"

        return report

    def print_prompts_for_copy(self, tabs: List[Tab] = None):
        """Print prompts in a format easy to copy/paste."""
        tabs = tabs or list(self.tabs.values())

        print("\n" + "="*60)
        print("   PROMPTS FOR EACH TAB")
        print("="*60)

        for tab in tabs:
            print(f"\n--- {tab.service_name.upper()} ({tab.id}) ---")
            print(tab.prompt[:500] if tab.prompt else "[No prompt]")
            print("-" * 40)
