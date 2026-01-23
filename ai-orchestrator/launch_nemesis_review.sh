#!/bin/bash
# =============================================================================
# NEMESIS REVIEW - Multi-AI Analysis Launcher
# Lance l'orchestrateur avec la demande NEMESIS pré-chargée
# =============================================================================

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           NEMESIS SYSTEM REVIEW - MULTI-AI ANALYSIS              ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Ce script va:                                                   ║"
echo "║  1. Ouvrir Claude Sonnet pour clarifier la demande               ║"
echo "║  2. Interroger GPT-4, Gemini, Mistral en parallèle               ║"
echo "║  3. Synthétiser avec Claude Opus (3 rounds)                      ║"
echo "║  4. Formater pour documentation finale                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Afficher le résumé de la demande
echo "📋 Demande: Revue architecture NEMESIS"
echo "🎯 Objectif: Analyse critique multi-IA du système"
echo "📊 Sortie: Faiblesses, améliorations, verdict faisabilité"
echo ""

# Lancer l'orchestrateur
python orchestrator.py
