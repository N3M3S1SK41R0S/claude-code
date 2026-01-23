#!/bin/bash
# ==============================================================================
# AI Orchestrator - Test Runner
# Double-click this file to run all tests
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              AI ORCHESTRATOR - TEST SUITE                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}Error: Python not found${NC}"
    read -p "Press Enter to exit..."
    exit 1
fi

# Activate venv if exists
if [ -d "$SCRIPT_DIR/.venv" ]; then
    source "$SCRIPT_DIR/.venv/bin/activate"
fi

# Install test dependencies
pip install -q pyyaml 2>/dev/null

echo -e "${YELLOW}Running tests...${NC}"
echo ""

cd "$SCRIPT_DIR"

# Run workflow tests
echo -e "${BLUE}=== Workflow Tests ===${NC}"
$PYTHON_CMD -m tests.test_workflow
WORKFLOW_EXIT=$?

echo ""
echo -e "${BLUE}=== Automation Tests ===${NC}"
$PYTHON_CMD -m tests.test_automation
AUTOMATION_EXIT=$?

# Combine exit codes
if [ $WORKFLOW_EXIT -eq 0 ] && [ $AUTOMATION_EXIT -eq 0 ]; then
    EXIT_CODE=0
else
    EXIT_CODE=1
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${RED}Some tests failed. Check the output above.${NC}"
fi

echo ""
read -p "Press Enter to close..."
exit $EXIT_CODE
