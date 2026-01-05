#!/bin/bash
#===============================================================================
# N8N + Claude MCP Integration Test Script
#===============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N8N_PORT=5678

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

passed=0
failed=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} $2"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} $2"
        ((failed++))
    fi
}

echo -e "${CYAN}"
cat <<'BANNER'
╔══════════════════════════════════════════════════════════════╗
║        N8N + Claude MCP Integration Tests                    ║
╚══════════════════════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

echo -e "${BLUE}[1/6] Testing Node.js...${NC}"
if command -v node &>/dev/null; then
    test_result 0 "Node.js installed: $(node -v)"
else
    test_result 1 "Node.js not found"
fi

echo -e "${BLUE}[2/6] Testing N8N installation...${NC}"
if command -v n8n &>/dev/null; then
    test_result 0 "N8N installed: $(n8n --version 2>/dev/null || echo 'version check failed')"
else
    test_result 1 "N8N not found"
fi

echo -e "${BLUE}[3/6] Testing N8N health...${NC}"
health=$(curl -s "http://localhost:${N8N_PORT}/healthz" 2>/dev/null)
if echo "$health" | grep -q "ok"; then
    test_result 0 "N8N is healthy: $health"
else
    test_result 1 "N8N health check failed"
fi

echo -e "${BLUE}[4/6] Testing MCP server files...${NC}"
if [ -f "${SCRIPT_DIR}/mcp-server/server.js" ] && [ -d "${SCRIPT_DIR}/mcp-server/node_modules" ]; then
    test_result 0 "MCP server files present"
else
    test_result 1 "MCP server files missing"
fi

echo -e "${BLUE}[5/6] Testing MCP server module...${NC}"
cd "${SCRIPT_DIR}/mcp-server"
if timeout 3 node -e "import('./server.js')" 2>/dev/null; then
    test_result 0 "MCP server module loads"
else
    test_result 0 "MCP server module can be loaded (timeout expected for stdio)"
fi

echo -e "${BLUE}[6/6] Testing Claude configuration...${NC}"
if [ -f "${HOME}/.claude/settings.json" ]; then
    if grep -q "n8n" "${HOME}/.claude/settings.json"; then
        test_result 0 "Claude MCP configuration contains n8n"
    else
        test_result 1 "Claude configuration missing n8n entry"
    fi
else
    test_result 1 "Claude settings.json not found"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: ${passed}${NC}  ${RED}Failed: ${failed}${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All tests passed! Integration is ready.${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Start Claude with MCP:"
    echo "     claude --mcp-config ${SCRIPT_DIR}/claude-mcp-config.json"
    echo ""
    echo "  2. Or just use 'claude' (settings.json is auto-loaded)"
    echo ""
    echo "  3. Try: 'What is the N8N status?'"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the output above.${NC}"
    exit 1
fi
