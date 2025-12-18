#!/bin/bash
# ============================================================
# NEMESIS Hub - Test Runner for Linux/Mac
# ============================================================

set -e

echo ""
echo "========================================"
echo "  NEMESIS Hub - Workflow Test Suite"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed!${NC}"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

# Set n8n URL (default localhost:5678)
N8N_URL=${N8N_URL:-"http://localhost:5678"}

echo -e "${BLUE}[INFO]${NC} n8n URL: $N8N_URL"
echo ""

# Check if n8n is running
echo -e "${BLUE}[INFO]${NC} Checking if n8n is running..."
if curl -s -o /dev/null -w "%{http_code}" "$N8N_URL/healthz" 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}[OK]${NC} n8n is running"
else
    echo -e "${YELLOW}[WARNING]${NC} n8n does not appear to be running!"
    echo ""
    read -p "Would you like to start n8n? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[INFO]${NC} Starting n8n in background..."
        npx n8n &
        echo -e "${BLUE}[INFO]${NC} Waiting 10 seconds for n8n to start..."
        sleep 10
    else
        echo -e "${BLUE}[INFO]${NC} Exiting..."
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}[INFO]${NC} Running tests..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the test suite
node "$SCRIPT_DIR/test-all-workflows.js" "$@"

echo ""
echo "========================================"
echo "  Tests Complete"
echo "========================================"
echo ""
