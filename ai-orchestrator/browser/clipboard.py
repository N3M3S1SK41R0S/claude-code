"""
Clipboard Manager
Handles clipboard operations for copying prompts and collecting responses.
"""

import logging
import subprocess
import sys
from typing import Optional

logger = logging.getLogger('Clipboard-Manager')


class ClipboardManager:
    """
    Cross-platform clipboard manager.

    Provides easy copy/paste functionality for:
    - Copying prompts to paste into AI interfaces
    - Collecting responses from AI interfaces
    """

    def __init__(self):
        self._backend = self._detect_backend()
        self._history: list = []

    def _detect_backend(self) -> str:
        """Detect available clipboard backend."""
        if sys.platform == 'darwin':  # macOS
            return 'pbcopy'
        elif sys.platform == 'win32':  # Windows
            return 'clip'
        else:  # Linux
            # Check for available clipboard tools
            for tool in ['xclip', 'xsel', 'wl-copy']:
                try:
                    subprocess.run(['which', tool], capture_output=True, check=True)
                    return tool
                except (subprocess.CalledProcessError, FileNotFoundError):
                    continue
            return 'none'

    def copy(self, text: str) -> bool:
        """
        Copy text to clipboard.

        Args:
            text: Text to copy

        Returns:
            True if successful
        """
        try:
            if self._backend == 'pbcopy':  # macOS
                process = subprocess.Popen(
                    ['pbcopy'],
                    stdin=subprocess.PIPE
                )
                process.communicate(text.encode('utf-8'))
                return process.returncode == 0

            elif self._backend == 'clip':  # Windows
                process = subprocess.Popen(
                    ['clip'],
                    stdin=subprocess.PIPE
                )
                process.communicate(text.encode('utf-16'))
                return process.returncode == 0

            elif self._backend == 'xclip':  # Linux X11
                process = subprocess.Popen(
                    ['xclip', '-selection', 'clipboard'],
                    stdin=subprocess.PIPE
                )
                process.communicate(text.encode('utf-8'))
                return process.returncode == 0

            elif self._backend == 'xsel':  # Linux X11 alternative
                process = subprocess.Popen(
                    ['xsel', '--clipboard', '--input'],
                    stdin=subprocess.PIPE
                )
                process.communicate(text.encode('utf-8'))
                return process.returncode == 0

            elif self._backend == 'wl-copy':  # Wayland
                process = subprocess.Popen(
                    ['wl-copy'],
                    stdin=subprocess.PIPE
                )
                process.communicate(text.encode('utf-8'))
                return process.returncode == 0

            else:
                logger.warning("No clipboard backend available")
                return False

        except Exception as e:
            logger.error(f"Failed to copy to clipboard: {e}")
            return False

    def paste(self) -> Optional[str]:
        """
        Get text from clipboard.

        Returns:
            Clipboard content or None if failed
        """
        try:
            if self._backend == 'pbcopy':  # macOS uses pbpaste
                result = subprocess.run(
                    ['pbpaste'],
                    capture_output=True
                )
                return result.stdout.decode('utf-8')

            elif self._backend == 'clip':  # Windows
                # Windows doesn't have a direct paste command
                # Use PowerShell
                result = subprocess.run(
                    ['powershell', '-command', 'Get-Clipboard'],
                    capture_output=True
                )
                return result.stdout.decode('utf-8')

            elif self._backend == 'xclip':
                result = subprocess.run(
                    ['xclip', '-selection', 'clipboard', '-o'],
                    capture_output=True
                )
                return result.stdout.decode('utf-8')

            elif self._backend == 'xsel':
                result = subprocess.run(
                    ['xsel', '--clipboard', '--output'],
                    capture_output=True
                )
                return result.stdout.decode('utf-8')

            elif self._backend == 'wl-copy':  # Wayland uses wl-paste
                result = subprocess.run(
                    ['wl-paste'],
                    capture_output=True
                )
                return result.stdout.decode('utf-8')

            else:
                logger.warning("No clipboard backend available")
                return None

        except Exception as e:
            logger.error(f"Failed to paste from clipboard: {e}")
            return None

    def copy_with_notification(self, text: str, description: str = ""):
        """Copy text and print notification."""
        if self.copy(text):
            print(f"\n✓ Copied to clipboard: {description or text[:50]}...")
            self._history.append({
                'text': text,
                'description': description
            })
        else:
            print(f"\n✗ Failed to copy. Text:")
            print("-" * 40)
            print(text[:500])
            print("-" * 40)

    def interactive_collect(self, service_name: str) -> Optional[str]:
        """
        Interactively collect a response from user.

        Prompts user to paste response and returns it.
        """
        print(f"\n--- Collecting response from {service_name} ---")
        print("Paste the AI response below (press Enter twice to finish):")
        print()

        lines = []
        empty_count = 0

        while True:
            try:
                line = input()
                if line == '':
                    empty_count += 1
                    if empty_count >= 2:
                        break
                    lines.append(line)
                else:
                    empty_count = 0
                    lines.append(line)
            except EOFError:
                break

        response = '\n'.join(lines).strip()

        if response:
            print(f"✓ Collected {len(response)} characters from {service_name}")
            return response
        else:
            print(f"✗ No response collected from {service_name}")
            return None

    def batch_copy_prompts(self, prompts: dict):
        """
        Display prompts for batch copying.

        Args:
            prompts: Dict of {service_name: prompt}
        """
        print("\n" + "="*60)
        print("   PROMPTS TO COPY")
        print("="*60)
        print("\nInstructions:")
        print("1. Press a number to copy that prompt")
        print("2. Paste into the corresponding AI tab")
        print("3. Type 'done' when finished\n")

        prompt_list = list(prompts.items())

        for i, (service, prompt) in enumerate(prompt_list, 1):
            preview = prompt[:50].replace('\n', ' ')
            print(f"  [{i}] {service}: {preview}...")

        print()

        while True:
            try:
                choice = input("Enter number to copy (or 'done'): ").strip()

                if choice.lower() == 'done':
                    break

                try:
                    idx = int(choice) - 1
                    if 0 <= idx < len(prompt_list):
                        service, prompt = prompt_list[idx]
                        self.copy_with_notification(prompt, f"Prompt for {service}")
                    else:
                        print("Invalid number")
                except ValueError:
                    print("Please enter a number or 'done'")

            except EOFError:
                break

    def get_history(self) -> list:
        """Get clipboard history for this session."""
        return self._history.copy()
