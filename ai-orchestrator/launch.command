#!/bin/bash
# ==============================================================================
# AI Orchestrator - macOS Launcher
# Double-click this file in Finder to start the AI Orchestrator
# ==============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Run the main launcher
"$SCRIPT_DIR/launch.sh"
