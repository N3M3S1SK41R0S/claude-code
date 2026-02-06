#!/bin/bash
# ==============================================================================
# AI Orchestrator - Linux/macOS Launcher
# Double-click this file to start the AI Orchestrator
# ==============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    AI ORCHESTRATOR                               ║"
echo "║              Multi-AI Collaboration System                       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for Python 3
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}Error: Python is not installed${NC}"
    echo "Please install Python 3.8 or higher"
    echo "Visit: https://www.python.org/downloads/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${GREEN}✓ Python $PYTHON_VERSION detected${NC}"

# Check/create virtual environment
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    $PYTHON_CMD -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check/install dependencies
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"

if [ -f "$REQUIREMENTS_FILE" ]; then
    echo -e "${YELLOW}Checking dependencies...${NC}"
    pip install -q -r "$REQUIREMENTS_FILE" 2>/dev/null
    echo -e "${GREEN}✓ Dependencies ready${NC}"
fi

# Create necessary directories
mkdir -p ~/.ai-orchestrator/logs
mkdir -p ~/.ai-orchestrator/projects

# Run the orchestrator
echo ""
echo -e "${BLUE}Starting AI Orchestrator...${NC}"
echo ""

cd "$SCRIPT_DIR"
$PYTHON_CMD orchestrator.py

# Deactivate virtual environment on exit
deactivate 2>/dev/null

echo ""
echo -e "${GREEN}AI Orchestrator session ended${NC}"
read -p "Press Enter to close..."
