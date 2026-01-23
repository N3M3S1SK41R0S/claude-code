"""
Browser Automation Module
Handles Chrome tab management for parallel AI interactions.
"""

from .controller import BrowserController, Tab, TabStatus
from .clipboard import ClipboardManager

__all__ = ['BrowserController', 'Tab', 'TabStatus', 'ClipboardManager']
