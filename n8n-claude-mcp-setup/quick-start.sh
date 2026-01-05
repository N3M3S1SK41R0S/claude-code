#!/bin/bash
#===============================================================================
# Quick Start Script - N8N + Claude MCP
# Run this after the main installation to quickly start/stop services
#===============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|test|claude}"
    echo ""
    echo "Commands:"
    echo "  start    - Start N8N and MCP services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  status   - Show service status"
    echo "  logs     - Show N8N logs (follow mode)"
    echo "  test     - Run a quick test"
    echo "  claude   - Start Claude with MCP config"
    exit 1
}

start_services() {
    echo -e "${BLUE}[INFO]${NC} Starting N8N services..."
    cd "${SCRIPT_DIR}"
    docker compose up -d
    echo -e "${GREEN}[SUCCESS]${NC} Services started"
    echo ""
    echo "N8N is available at: http://localhost:5678"
}

stop_services() {
    echo -e "${BLUE}[INFO]${NC} Stopping N8N services..."
    cd "${SCRIPT_DIR}"
    docker compose down
    echo -e "${GREEN}[SUCCESS]${NC} Services stopped"
}

restart_services() {
    stop_services
    sleep 2
    start_services
}

show_status() {
    echo -e "${BLUE}[INFO]${NC} Service Status:"
    echo ""
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" ps
    echo ""

    # Check N8N health
    if curl -s "http://localhost:5678/healthz" 2>/dev/null | grep -q "ok"; then
        echo -e "N8N Health: ${GREEN}OK${NC}"
    else
        echo -e "N8N Health: ${RED}NOT READY${NC}"
    fi
}

show_logs() {
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" logs -f n8n
}

run_test() {
    echo -e "${BLUE}[INFO]${NC} Running quick test..."
    echo ""

    # Test N8N API
    echo "Testing N8N API..."
    response=$(curl -s "http://localhost:5678/api/v1/workflows" 2>/dev/null)
    if [ -n "$response" ]; then
        echo -e "${GREEN}[SUCCESS]${NC} N8N API is responding"
    else
        echo -e "${RED}[ERROR]${NC} N8N API not responding"
    fi

    # Test webhook
    echo ""
    echo "Testing webhook..."
    webhook_response=$(curl -s -X POST "http://localhost:5678/webhook/claude-test" \
        -H "Content-Type: application/json" \
        -d '{"test": "quick-start-test"}' 2>/dev/null)

    if echo "$webhook_response" | grep -q "success"; then
        echo -e "${GREEN}[SUCCESS]${NC} Webhook test passed"
        echo "Response: $webhook_response"
    else
        echo -e "${YELLOW}[WARNING]${NC} Webhook may not be configured yet"
    fi

    # Test MCP server
    echo ""
    echo "Testing MCP server..."
    if [ -f "${SCRIPT_DIR}/mcp-server/node_modules/@modelcontextprotocol/sdk/package.json" ]; then
        echo -e "${GREEN}[SUCCESS]${NC} MCP server dependencies installed"
    else
        echo -e "${YELLOW}[WARNING]${NC} MCP server dependencies may need installation"
        echo "Run: cd ${SCRIPT_DIR}/mcp-server && npm install"
    fi
}

start_claude() {
    echo -e "${BLUE}[INFO]${NC} Starting Claude with N8N MCP configuration..."
    echo ""

    if command -v claude &> /dev/null; then
        claude --mcp-config "${SCRIPT_DIR}/claude-mcp-config.json"
    else
        echo -e "${RED}[ERROR]${NC} Claude CLI not found in PATH"
        echo "Please ensure Claude Code is installed and in your PATH"
        exit 1
    fi
}

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    test)
        run_test
        ;;
    claude)
        start_claude
        ;;
    *)
        usage
        ;;
esac
