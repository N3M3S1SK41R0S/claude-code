#!/usr/bin/env python3
"""
🚀 AUTO NEMESIS REVIEW - Fully Automated Multi-AI Analysis
Lance automatiquement l'analyse NEMESIS sur toutes les IAs disponibles.

Usage: python auto_nemesis_review.py
"""

import json
import os
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path

# =============================================================================
# CONFIGURATION
# =============================================================================

NEMESIS_REQUEST = """
# 🎯 ANALYSE CRITIQUE DU SYSTÈME NEMESIS

## Contexte
NEMESIS (Neural Expert Multi-agent Efficient System for Integrated Solutions) est un système d'orchestration multi-agents IA personnel.

**Objectif**: Traiter des tâches complexes avec l'efficacité d'un système simple, en 90 jours, $50-500/mois.

**Principe**: "Faire tourner un mastodonte comme une souris"

## Architecture (4 couches)
1. **ZEUS Coordinator** - Cerveau central, routing intelligent
2. **10 Agents spécialisés** - SCRIBE, ANALYST, ARCHITECT, CODER, STRATEGIST, CRITIC, MEMORY_KEEPER, SENTINEL, OPTIMIZER, RESEARCHER
3. **Outils** - N8N, Crew AI, Dify, Redis, SQLite, OpenTelemetry
4. **Évaluation 5 strates** - Conformité, Qualité, Complétude, Innovation, Performance

## 52 Patterns implémentés
- Matryoshka (agents imbriqués), Ghost Agents (virtuels), Circuit Breaker
- Cache L1/L2/L3, Request Coalescing, Speculative Execution
- Graceful Degradation (5 tiers), Self-Healing, A/B Testing

## Ta mission
En tant qu'expert IA, fournis une analyse CRITIQUE et CONSTRUCTIVE:

1. **5 FAIBLESSES MAJEURES** du design
2. **5 AMÉLIORATIONS PRIORITAIRES** concrètes
3. **RISQUES SOUS-ESTIMÉS** que je n'ai pas vus
4. **PATTERNS MANQUANTS** que je devrais ajouter
5. **VERDICT**: Faisable en 90 jours? (Oui/Non/Conditionnel + justification)

**Ton**: Direct, critique, pas de langue de bois. Je veux la vérité, pas des compliments.
"""

AI_SERVICES = [
    {
        "name": "Claude Sonnet",
        "url": "https://claude.ai/new",
        "model": "claude-sonnet-4-5-20250514"
    },
    {
        "name": "ChatGPT",
        "url": "https://chat.openai.com/",
        "model": "gpt-4"
    },
    {
        "name": "Gemini",
        "url": "https://gemini.google.com/",
        "model": "gemini-pro"
    },
    {
        "name": "Mistral",
        "url": "https://chat.mistral.ai/",
        "model": "mistral-large"
    },
    {
        "name": "Perplexity",
        "url": "https://www.perplexity.ai/",
        "model": "perplexity"
    }
]

# =============================================================================
# MAIN AUTOMATION
# =============================================================================

def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🚀 NEMESIS MULTI-AI REVIEW - FULLY AUTOMATED                              ║
║                                                                              ║
║   Ce script va automatiquement:                                              ║
║   1. Copier la demande dans le presse-papier                                ║
║   2. Ouvrir 5 onglets IA en parallèle                                       ║
║   3. Tu colles (Ctrl+V) et envoies dans chaque onglet                       ║
║   4. Collecte les réponses (tu copies chaque réponse)                       ║
║   5. Synthèse automatique des résultats                                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

def copy_to_clipboard(text):
    """Copy text to clipboard - supports Windows, macOS, and Linux."""
    import platform
    system = platform.system()

    try:
        if system == 'Windows':
            # Windows: use clip command
            process = subprocess.Popen(['clip'], stdin=subprocess.PIPE, shell=True)
            process.communicate(text.encode('utf-16-le'))
            return True
        elif system == 'Darwin':
            # macOS: use pbcopy
            process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
        else:
            # Linux: try xclip
            process = subprocess.Popen(['xclip', '-selection', 'clipboard'],
                                       stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
            return True
    except Exception as e:
        # Fallback: try pyperclip if installed
        try:
            import pyperclip
            pyperclip.copy(text)
            return True
        except:
            return False

def open_ai_tabs():
    """Open all AI service tabs - with better Windows support."""
    import platform
    system = platform.system()

    print("\n📂 Ouverture des onglets IA...")

    for i, ai in enumerate(AI_SERVICES):
        url = ai['url']
        print(f"   [{i+1}/5] {ai['name']}: {url}")

        try:
            if system == 'Windows':
                # Windows: use start command for more reliable browser opening
                os.system(f'start "" "{url}"')
            elif system == 'Darwin':
                # macOS: use open command
                os.system(f'open "{url}"')
            else:
                # Linux: use webbrowser
                webbrowser.open_new_tab(url)

            time.sleep(1.0)  # Longer delay for Windows
        except Exception as e:
            print(f"   ⚠️ Erreur ouverture {ai['name']}: {e}")
            # Fallback to webbrowser
            webbrowser.open_new_tab(url)

    print("   ✅ Tous les onglets ouverts!")

def save_request_to_file():
    """Save the request to a file for easy access."""
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    request_file = output_dir / f"nemesis_request_{timestamp}.txt"

    with open(request_file, 'w', encoding='utf-8') as f:
        f.write(NEMESIS_REQUEST)

    return request_file

def collect_responses():
    """Interactive collection of responses."""
    responses = {}

    print("\n" + "="*70)
    print("   📥 COLLECTE DES RÉPONSES")
    print("="*70)
    print("""
Pour chaque IA:
1. Copie sa réponse complète
2. Reviens ici et colle-la
3. Appuie sur Entrée deux fois pour valider

Tape 'skip' pour passer une IA, 'done' quand tu as fini.
    """)

    for ai in AI_SERVICES:
        print(f"\n{'─'*50}")
        print(f"📌 Réponse de {ai['name']}:")
        print("(Colle la réponse, puis Entrée deux fois pour valider)")
        print("─"*50)

        lines = []
        empty_count = 0

        while True:
            try:
                line = input()
                if line.lower() == 'skip':
                    print(f"   ⏭️ {ai['name']} skipped")
                    break
                if line.lower() == 'done':
                    if lines:
                        responses[ai['name']] = '\n'.join(lines)
                    return responses
                if line == '':
                    empty_count += 1
                    if empty_count >= 2 and lines:
                        responses[ai['name']] = '\n'.join(lines)
                        print(f"   ✅ {ai['name']} enregistré ({len(lines)} lignes)")
                        break
                else:
                    empty_count = 0
                    lines.append(line)
            except EOFError:
                break

    return responses

def synthesize_responses(responses):
    """Generate synthesis of all responses."""
    print("\n" + "="*70)
    print("   🔄 SYNTHÈSE DES RÉPONSES")
    print("="*70)

    if not responses:
        print("   ⚠️ Aucune réponse collectée")
        return None

    synthesis = f"""
# 📊 SYNTHÈSE MULTI-IA - REVUE NEMESIS
**Date**: {datetime.now().strftime("%Y-%m-%d %H:%M")}
**IAs consultées**: {', '.join(responses.keys())}

---

"""

    for ai_name, response in responses.items():
        synthesis += f"""
## 🤖 {ai_name}

{response[:2000]}{'...' if len(response) > 2000 else ''}

---
"""

    # Save synthesis
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    synthesis_file = output_dir / f"nemesis_synthesis_{timestamp}.md"

    with open(synthesis_file, 'w', encoding='utf-8') as f:
        f.write(synthesis)

    print(f"\n   ✅ Synthèse sauvegardée: {synthesis_file}")
    return synthesis_file

def main():
    print_banner()

    # Step 1: Save and copy request
    print("\n📋 ÉTAPE 1: Préparation de la demande")
    request_file = save_request_to_file()
    print(f"   📄 Demande sauvegardée: {request_file}")

    if copy_to_clipboard(NEMESIS_REQUEST):
        print("   📋 Demande copiée dans le presse-papier!")
    else:
        print("   ⚠️ Impossible de copier automatiquement.")
        print(f"   📄 Ouvre ce fichier et copie le contenu: {request_file}")

    # Step 2: Open AI tabs
    input("\n⏸️ Appuie sur Entrée pour ouvrir les 5 onglets IA...")
    open_ai_tabs()

    # Step 3: Instructions
    print("\n" + "="*70)
    print("   📝 INSTRUCTIONS")
    print("="*70)
    print("""
Dans CHAQUE onglet:
1. Colle la demande (Ctrl+V) - elle est dans ton presse-papier
2. Envoie le message
3. Attends la réponse complète
4. Copie la réponse (Ctrl+A, Ctrl+C)

Quand toutes les IAs ont répondu, reviens ici.
    """)

    input("⏸️ Appuie sur Entrée quand tu es prêt à collecter les réponses...")

    # Step 4: Collect responses
    responses = collect_responses()

    # Step 5: Synthesize
    if responses:
        synthesis_file = synthesize_responses(responses)

        print("\n" + "="*70)
        print("   🎉 TERMINÉ!")
        print("="*70)
        print(f"""
   📊 {len(responses)} réponses collectées
   📄 Synthèse: {synthesis_file}

   Prochaine étape: Ouvre la synthèse et analyse les patterns communs!
        """)
    else:
        print("\n   ⚠️ Aucune réponse collectée. Relance le script si besoin.")

if __name__ == "__main__":
    main()
