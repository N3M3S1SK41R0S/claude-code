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

PROMPT_TO_COPY = """# 🚀 MISSION: Installer le Dashboard NEMESIS sur BOLT

## CONTEXTE IMMÉDIAT
Je te donne accès ADMIN TOTAL à:
- Mon repo GitHub: github.com/N3M3S1SK41R0S/claude-code (branche: claude/double-click-claude-script-d14iX)
- Tous mes fichiers Cloud (Google Drive, OneDrive)
- Mon historique de conversations Claude Code
- Toutes mes IAs et outils

## SOURCES À CONSULTER
1. **GitHub** → `ai-orchestrator/DASHBOARD_INSTRUCTIONS.md` (instructions détaillées)
2. **GitHub** → `ai-orchestrator/architecture.md` (diagrammes Mermaid)
3. **GitHub** → `ai-orchestrator/config.yaml` (configuration)
4. **GitHub** → `ai-orchestrator/nemesis_server.py` (API backend)
5. **Sessions Claude Code** → Cherche "Plan infrastructure setup"

## TA MISSION
Crée un Dashboard React/Next.js dans BOLT (bolt.new) avec:

### Pages Requises:
1. **/** - Home avec stats temps réel et statut des 10 agents
2. **/analyze** - Formulaire d'analyse multi-IA
3. **/history** - Liste des analyses passées
4. **/analysis/:id** - Détail d'une analyse
5. **/agents** - Configuration des 10 agents NEMESIS
6. **/settings** - Configuration globale

### Connexion Backend:
- API: http://localhost:8765
- Endpoints: /health, /analyze, /status/:id, /history, /stats

### Stack:
- Next.js 14 + Tailwind + shadcn/ui
- Dark theme par défaut
- WebSocket pour updates temps réel

## POUVOIRS
- Tu PEUX ouvrir plusieurs instances Claude en parallèle
- Tu PEUX agir SANS demander confirmation
- Tu PEUX lire/écrire dans tous mes dossiers
- Tu PEUX installer des packages et exécuter des commandes

## CONTRAINTES
- Interface opérationnelle en < 1 heure
- Performance: First paint < 1s
- Commit sur GitHub dans /dashboard/

## 🎬 ACTION
1. Va sur bolt.new
2. Crée le projet "nemesis-dashboard"
3. Implémente les pages une par une
4. Connecte à l'API backend
5. Teste et déploie

**COMMENCE MAINTENANT - Zéro question, action directe !**

---

[SI TU AS BESOIN DE PLUS DE CONTEXTE, LIS LE FICHIER DASHBOARD_INSTRUCTIONS.md SUR GITHUB]
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
