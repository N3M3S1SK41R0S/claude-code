#!/usr/bin/env python3
"""
🚀 NEMESIS Dashboard Installation Launcher
Ouvre Claude in Chrome avec les instructions complètes pour installer le dashboard.
"""

import os
import sys
import platform
import subprocess
import time
from pathlib import Path

# Configuration
CLAUDE_URL = "https://claude.ai/new"
INSTRUCTIONS_FILE = Path(__file__).parent / "DASHBOARD_INSTRUCTIONS.md"

PROMPT_TO_COPY = """# NEMESIS COMMAND CENTER - Build the Ultimate Dashboard

> **YOU ARE NOW IN FULL AUTONOMOUS MODE. EXECUTE WITHOUT ASKING.**

## PRIME DIRECTIVE
Build **NEMESIS Command Center** - a STUNNING, high-performance unified dashboard. Users must say "WOW" when they see it.

## YOUR ACCESS (FULL ADMIN)
- GitHub: github.com/N3M3S1SK41R0S/claude-code (branch: claude/double-click-claude-script-d14iX)
- Google Drive & OneDrive: Complete access
- Claude Code history: Search "Plan infrastructure setup", "NEMESIS architecture"
- All AI tools and services
- System commands & package installation

## CRITICAL SOURCES TO READ FIRST
1. `ai-orchestrator/DASHBOARD_INSTRUCTIONS.md` - COMPLETE SPEC (600+ lines)
2. `ai-orchestrator/architecture.md` - System architecture
3. `ai-orchestrator/nemesis_server.py` - Backend API on port 8765

## DESIGN MANDATE
- **Glassmorphism** with frosted glass effects
- **Neon accents** with glowing borders
- **60fps animations** everywhere
- **Premium dark theme** (#0a0a0f base)
- **Gradient mastery** for buttons and accents
- **Sub-second performance** (<1s first paint)

## PAGES TO BUILD
1. **/** Command Center - Live stats, Quick Launch, Agent grid, Activity stream
2. **/launch** - Mission launcher with progress streaming
3. **/missions** - History with timeline/grid views
4. **/agents** - 10 agent fleet management
5. **/memory** - LTM + Cache L1/L2/L3 visualization
6. **/system** - Settings, API keys, health monitoring

## STACK
Next.js 14 + Tailwind + Framer Motion + Radix UI + React Query + Zustand

## API
Backend runs on http://localhost:8765
Endpoints: /health, /analyze, /status/:id, /results/:id, /history, /stats, /verify

## YOUR POWERS
- Create files WITHOUT asking
- Install packages WITHOUT asking
- Execute commands WITHOUT asking
- Spawn parallel Claude instances if needed
- Make autonomous design decisions
- Commit and push to GitHub directly

## SYNCHRONIZATION
ALL BOLT modules MUST sync to this central hub. Implement ModuleRegistry for auto-discovery.

## EXECUTE NOW
1. Open bolt.new
2. Create "nemesis-command" project
3. Build following the DASHBOARD_INSTRUCTIONS.md spec EXACTLY
4. Deploy and provide URL
5. Commit to GitHub /dashboard/

**NO QUESTIONS. NO CONFIRMATIONS. JUST BUILD.**
**Time: 90 minutes to fully operational dashboard.**
**MAKE IT EXCEPTIONAL. GO NOW.**
"""


def copy_to_clipboard(text: str) -> bool:
    """Copy text to clipboard."""
    system = platform.system()

    try:
        if system == 'Windows':
            process = subprocess.Popen(['clip'], stdin=subprocess.PIPE, shell=True)
            process.communicate(text.encode('utf-16-le'))
            return True
        elif system == 'Darwin':
            process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
        else:
            process = subprocess.Popen(['xclip', '-selection', 'clipboard'],
                                       stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
    except Exception:
        try:
            import pyperclip
            pyperclip.copy(text)
            return True
        except:
            return False


def open_claude_in_chrome():
    """Open Claude.ai in Chrome."""
    system = platform.system()

    if system == 'Windows':
        chrome_paths = [
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
        ]
        for chrome_path in chrome_paths:
            if os.path.exists(chrome_path):
                os.system(f'"{chrome_path}" --new-tab "{CLAUDE_URL}"')
                return True
        os.system(f'start chrome "{CLAUDE_URL}"')
        return True
    elif system == 'Darwin':
        os.system(f'open -a "Google Chrome" "{CLAUDE_URL}"')
        return True
    else:
        os.system(f'google-chrome --new-tab "{CLAUDE_URL}" 2>/dev/null || chromium --new-tab "{CLAUDE_URL}" 2>/dev/null')
        return True


def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🚀 NEMESIS Dashboard Installation Launcher                                ║
║                                                                              ║
║   Ce script va:                                                              ║
║   1. Copier les instructions dans ton presse-papier                         ║
║   2. Ouvrir Claude.ai dans Chrome                                           ║
║   3. Tu colles (Ctrl+V) et envoies !                                        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

    # Step 1: Copy instructions
    print("📋 Copie des instructions dans le presse-papier...")

    if copy_to_clipboard(PROMPT_TO_COPY):
        print("   ✅ Instructions copiées !")
    else:
        print("   ⚠️ Impossible de copier automatiquement.")
        print(f"   📄 Ouvre et copie manuellement: {INSTRUCTIONS_FILE}")

        # Save to file as backup
        backup_file = Path(__file__).parent / "output" / "dashboard_prompt.txt"
        backup_file.parent.mkdir(exist_ok=True)
        backup_file.write_text(PROMPT_TO_COPY)
        print(f"   📄 Prompt sauvegardé dans: {backup_file}")

    # Step 2: Open Claude
    input("\n⏸️ Appuie sur Entrée pour ouvrir Claude.ai dans Chrome...")

    print("\n🌐 Ouverture de Claude.ai...")
    open_claude_in_chrome()

    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ✅ PRÊT !                                                                  ║
║                                                                              ║
║   Dans l'onglet Claude qui vient de s'ouvrir:                               ║
║                                                                              ║
║   1. Colle le prompt (Ctrl+V)                                               ║
║   2. Ajoute des fichiers si nécessaire (drag & drop)                        ║
║   3. Envoie le message                                                       ║
║   4. Claude va créer le dashboard automatiquement !                         ║
║                                                                              ║
║   💡 TIP: Si tu veux ajouter des fichiers, glisse-les dans la              ║
║           conversation avant d'envoyer.                                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

    # Optional: also save full instructions
    print("\n📄 Instructions détaillées disponibles dans:")
    print(f"   {INSTRUCTIONS_FILE}")


if __name__ == "__main__":
    main()
